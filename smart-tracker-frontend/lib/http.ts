/**
 * HTTP client กลาง (ห่อ fetch) — get/post/put/patch/delete + interceptor + header + query params
 *
 *   http.get<Ticket[]>("/tickets", { params: { status: "open", page: 1 } })
 *   http.post<Result>("/tickets", { title: "..." }, { headers: { "X-Foo": "bar" } })
 *   http.delete("/tickets/12")
 *
 *   http.interceptors.request.use((config) => { ...แก้ config แล้ว return... })
 *   http.interceptors.response.use(
 *     (res) => res,
 *     (err) => { if (err.status === 401) { ... } throw err; },
 *   )
 */

export class ApiError extends Error {
  constructor(
    public status: number, // 0 = เชื่อมต่อไม่ได้ / หมดเวลา
    message: string,
    public body?: unknown,
    /** request ที่ทำให้เกิด error (ใช้ยิงซ้ำใน interceptor เช่น หลังต่อ token) */
    public config?: RequestConfig,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type QueryValue = string | number | boolean | null | undefined;
/** ค่า null/undefined จะไม่ถูกส่ง, array จะส่งซ้ำหลายครั้ง (?id=1&id=2) */
export type QueryParams = Record<string, QueryValue | QueryValue[]>;

export interface RequestOptions {
  /** query string */
  params?: QueryParams;
  /** header เพิ่มเติม (ทับ header เริ่มต้นได้) */
  headers?: Record<string, string>;
  /** หมดเวลา (มิลลิวินาที) ค่าเริ่มต้น 15000 */
  timeoutMs?: number;
  /** ยกเลิก request จากภายนอก */
  signal?: AbortSignal;
  /** true = ไม่ต้องแนบ Authorization และไม่ต้องลองต่อ token เมื่อได้ 401 (ใช้กับ /auth/*) */
  skipAuth?: boolean;
}

export interface RequestConfig extends RequestOptions {
  url: string;
  method: HttpMethod;
  body?: unknown;
  /** ยิงซ้ำหลังต่อ token แล้ว (กันวน) */
  retried?: boolean;
}

export interface HttpResponse<T = unknown> {
  data: T;
  status: number;
  headers: Headers;
  config: RequestConfig;
}

type RequestHandler = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
type ResponseFulfilled = (res: HttpResponse) => HttpResponse | Promise<HttpResponse>;
type ResponseRejected = (err: ApiError) => HttpResponse | Promise<HttpResponse>;

class InterceptorManager<T> {
  handlers: Array<T | null> = [];
  use(handler: T): number {
    this.handlers.push(handler);
    return this.handlers.length - 1;
  }
  eject(id: number) {
    this.handlers[id] = null;
  }
}

class ResponseInterceptorManager {
  handlers: Array<{ onFulfilled?: ResponseFulfilled; onRejected?: ResponseRejected } | null> = [];
  use(onFulfilled?: ResponseFulfilled, onRejected?: ResponseRejected): number {
    this.handlers.push({ onFulfilled, onRejected });
    return this.handlers.length - 1;
  }
  eject(id: number) {
    this.handlers[id] = null;
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;

export class HttpClient {
  /** header ที่ส่งทุก request */
  defaults: { headers: Record<string, string> } = { headers: {} };

  interceptors = {
    request: new InterceptorManager<RequestHandler>(),
    response: new ResponseInterceptorManager(),
  };

  constructor(private readonly baseUrl: string) {}

  /** ตั้ง/ล้าง Authorization: Bearer <token> สำหรับทุก request */
  setAuthToken(token: string | null) {
    if (token) this.defaults.headers.Authorization = `Bearer ${token}`;
    else delete this.defaults.headers.Authorization;
  }

  get<T>(path: string, options?: RequestOptions) {
    return this.send<T>({ ...options, url: path, method: "GET" });
  }
  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.send<T>({ ...options, url: path, method: "POST", body });
  }
  put<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.send<T>({ ...options, url: path, method: "PUT", body });
  }
  patch<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.send<T>({ ...options, url: path, method: "PATCH", body });
  }
  delete<T>(path: string, options?: RequestOptions) {
    return this.send<T>({ ...options, url: path, method: "DELETE" });
  }

  /** ยิง request ตาม config (ใช้ซ้ำใน interceptor ได้ เช่น retry หลังต่อ token ใหม่) */
  async send<T>(config: RequestConfig): Promise<T> {
    return (await this.sendRaw(config)).data as T;
  }

  /** เหมือน send แต่คืน response เต็ม (ใช้ใน interceptor) */
  async sendRaw(config: RequestConfig): Promise<HttpResponse> {
    // 1) request interceptors — รันตามลำดับที่ลงทะเบียน
    let cfg = config;
    for (const handler of this.interceptors.request.handlers) {
      if (handler) cfg = await handler(cfg);
    }

    // 2) ยิงจริง แล้วต่อ response interceptors
    let chain: Promise<HttpResponse> = this.dispatch(cfg);
    for (const h of this.interceptors.response.handlers) {
      if (h) chain = chain.then(h.onFulfilled, h.onRejected);
    }
    return await chain;
  }

  private buildUrl(path: string, params?: QueryParams) {
    // baseUrl เป็น path สัมพัทธ์ได้ (เช่น "/api") → ต่อกับโดเมนที่เปิดอยู่
    const origin = typeof location !== "undefined" ? location.origin : "http://localhost";
    const url = new URL(path.startsWith("http") ? path : this.baseUrl + path, origin);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        const values = Array.isArray(value) ? value : [value];
        for (const v of values) {
          if (v !== null && v !== undefined) url.searchParams.append(key, String(v));
        }
      }
    }
    return url.toString();
  }

  private async dispatch(config: RequestConfig): Promise<HttpResponse> {
    const isForm = typeof FormData !== "undefined" && config.body instanceof FormData;
    const hasBody = config.body !== undefined && config.method !== "GET";

    const headers: Record<string, string> = {
      Accept: "application/json",
      // FormData ให้เบราว์เซอร์ใส่ Content-Type (พร้อม boundary) เอง
      ...(hasBody && !isForm ? { "Content-Type": "application/json" } : {}),
      ...(config.skipAuth ? {} : this.defaults.headers),
      ...config.headers,
    };

    // timeout + ยกเลิกจากภายนอก (เขียนเองแทน AbortSignal.timeout/any เผื่อ WebView เก่า)
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const onExternalAbort = () => controller.abort();
    config.signal?.addEventListener("abort", onExternalAbort);

    try {
      let res: Response;
      try {
        res = await fetch(this.buildUrl(config.url, config.params), {
          method: config.method,
          headers,
          body: hasBody ? (isForm ? (config.body as FormData) : JSON.stringify(config.body)) : undefined,
          signal: controller.signal,
        });
      } catch {
        throw new ApiError(
          0,
          timedOut
            ? "เซิร์ฟเวอร์ตอบช้าเกินไป กรุณาลองใหม่อีกครั้ง"
            : "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง",
        );
      }

      const data = await this.parse(res);

      if (!res.ok) {
        // NestJS ส่ง message เป็น string หรือ array (จาก ValidationPipe)
        const raw = (data as { message?: string | string[] } | undefined)?.message;
        const message = Array.isArray(raw) ? raw.join(", ") : (raw ?? "เกิดข้อผิดพลาด");
        throw new ApiError(res.status, message, data, config);
      }

      return { data, status: res.status, headers: res.headers, config };
    } finally {
      clearTimeout(timer);
      config.signal?.removeEventListener("abort", onExternalAbort);
    }
  }

  private async parse(res: Response): Promise<unknown> {
    if (res.status === 204) return undefined;
    const type = res.headers.get("content-type") ?? "";
    if (type.includes("application/json")) return res.json().catch(() => undefined);
    return res.text().catch(() => undefined);
  }
}

// ค่าเริ่มต้น "/api" = ผ่าน proxy ของ Next (ดู next.config.ts) — ตั้ง NEXT_PUBLIC_API_URL ถ้าจะยิงตรงไป backend
export const http = new HttpClient(process.env.NEXT_PUBLIC_API_URL ?? "/api");

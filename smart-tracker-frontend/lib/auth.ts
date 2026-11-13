/**
 * การยืนยันตัวตนกับ backend (JWT ของระบบเอง)
 *  - access JWT: เก็บในหน่วยความจำ (ใน http) แนบ Authorization: Bearer ให้ทุก request
 *  - refresh token: httpOnly cookie ที่ backend ตั้งให้ (JS อ่านไม่ได้) ใช้ผ่าน /auth/refresh เท่านั้น
 *  - ได้ 401 → ต่อ token เอง แล้วยิงซ้ำ; ต่อไม่ได้ → ล็อกอิน LINE ใหม่ (LIFF)
 *
 * ใช้ในหน้าที่ต้องล็อกอิน:  if (!(await ensureSession())) return;  แล้วเรียก api ได้เลย
 */
import { toast } from "sonner";
import { trace } from "./debug-trace";
import { ApiError, http, type HttpResponse } from "./http";
import { getLineSession } from "./liff";

type TokenResponse = { accessToken: string; expiresIn: number };

/** เวลา (ms) ที่ access token ในหน่วยความจำจะหมดอายุ */
let accessExpiresAt = 0;
const EXPIRY_MARGIN_MS = 30_000;

function applyToken(res: TokenResponse) {
  http.setAuthToken(res.accessToken);
  accessExpiresAt = Date.now() + res.expiresIn * 1000;
}

/** มี access token ที่ยังใช้ได้อยู่ในหน่วยความจำไหม (เปลี่ยนหน้าในแอปไม่ต้องต่ออายุซ้ำ) */
function hasFreshToken() {
  return Date.now() < accessExpiresAt - EXPIRY_MARGIN_MS;
}

/** ล็อกอินด้วย LINE ID Token → ได้ JWT (และ cookie refresh token) */
export async function loginWithLine(idToken: string): Promise<void> {
  const res = await http.post<TokenResponse>("/auth/line", { idToken }, { skipAuth: true });
  applyToken(res);
  trace("ล็อกอินระบบสำเร็จ (ได้ access token)");
}

// เรียกซ้อนกัน (เช่น React Strict Mode, หลาย request ได้ 401 พร้อมกัน) ให้รอผลเดียวกัน — refresh token ใช้ได้ครั้งเดียว
let refreshing: Promise<boolean> | null = null;

/** ต่อ access token ด้วย refresh cookie (true = สำเร็จ) */
export function restoreSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      applyToken(await http.post<TokenResponse>("/auth/refresh", undefined, { skipAuth: true }));
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status !== 0) return false; // ไม่มี/หมดอายุ/ถูกปิดใช้งาน
      throw e; // เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ฯลฯ
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

let relogin: Promise<boolean> | null = null;

/** ล็อกอินใหม่ผ่าน LINE (false = กำลังพาไปหน้าล็อกอิน LINE) */
function loginViaLine(): Promise<boolean> {
  relogin ??= (async () => {
    const line = await getLineSession();
    if (!line) return false;
    await loginWithLine(line.idToken);
    return true;
  })().finally(() => {
    relogin = null;
  });
  return relogin;
}

/**
 * ทำให้มี access token พร้อมใช้: ลอง refresh cookie ก่อน ไม่ได้ค่อยล็อกอิน LINE
 * คืน false เมื่อกำลังพาไปล็อกอิน LINE (ให้หยุดทำงานต่อ หน้าจะโหลดใหม่เอง)
 */
export async function ensureSession(): Promise<boolean> {
  if (hasFreshToken()) return true;
  if (await restoreSession()) return true;
  return loginViaLine();
}

/** ออกจากระบบ: เลิกใช้ refresh token แล้วล้าง access token */
export async function signOut(): Promise<void> {
  try {
    await http.post("/auth/logout", undefined, { skipAuth: true });
  } finally {
    http.setAuthToken(null);
    accessExpiresAt = 0;
  }
}

// ───────── interceptor: 401 → ต่อ token แล้วยิงซ้ำ ─────────

let installed = false;

function install() {
  if (installed) return;
  installed = true;

  http.interceptors.response.use(undefined, async (err): Promise<HttpResponse> => {
    const config = err.config;
    if (err.status !== 401 || !config || config.skipAuth || config.retried) throw err;

    trace("ได้ 401 → ต่อ token");
    let ok = await restoreSession();
    if (!ok) {
      toast.info("กำลังเข้าสู่ระบบใหม่", { description: "การเข้าสู่ระบบหมดอายุ" });
      ok = await loginViaLine();
    }
    if (!ok) throw err; // กำลังพาไปล็อกอิน LINE

    return http.sendRaw({ ...config, retried: true });
  });
}

install();

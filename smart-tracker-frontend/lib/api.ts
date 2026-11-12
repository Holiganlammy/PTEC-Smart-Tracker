import { http } from "./http";

export { ApiError } from "./http";

export type Vender = { venderCode: string; venderName: string };

export type UserStatus = "pending" | "approved" | "rejected" | "suspended";

export type MeResponse =
  | { registered: false }
  | {
      registered: true;
      status: UserStatus;
      role: string;
      rejectReason: string | null;
      firstName: string;
      lastName: string | null;
      venderCode: string | null;
    };

export type RegisterInput = {
  idToken: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  venderCode: string;
};

/** รวม endpoint ของ backend (ใช้ `http` จาก lib/http.ts) */
export const api = {
  getVenders: () => http.get<Vender[]>("/venders"),

  /** ต้องเรียก http.setAuthToken(...) ก่อน (แนบ Authorization ให้เอง) */
  getMe: () => http.get<MeResponse>("/users/me"),

  register: (input: RegisterInput) =>
    http.post<{ id: string; status: UserStatus }>("/users/register", input),
};

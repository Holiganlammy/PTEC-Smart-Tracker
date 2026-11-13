import { http } from "./http";

export { ApiError } from "./http";

export type Vender = { venderCode: string; venderName: string };

export type UserStatus = "pending" | "approved" | "rejected" | "suspended";

/** id ของ role (ตรงกับตาราง roles ใน backend) */
export const RoleId = { CONTRACTOR: 1, HEAD: 2, SUB_CONTRACTOR: 3, ADMIN: 4 } as const;
export type RoleId = (typeof RoleId)[keyof typeof RoleId];

export type UserRole = "contractor" | "head" | "sub_contractor" | "admin"; // รหัสที่ /users ส่งมา (ใช้แสดงผลเท่านั้น)

/** ผู้ใช้ตามที่แอดมินเห็นในหน้าอนุมัติ */
export type AdminUser = {
  id: string;
  firstName: string;
  lastName: string | null;
  phoneNumber: string;
  email: string | null;
  lineDisplayName: string | null;
  linePictureUrl: string | null;
  venderCode: string | null;
  venderName: string | null;
  roleId: RoleId;
  role: UserRole;
  roleName: string;
  status: UserStatus;
  active: boolean;
  rejectReason: string | null;
  approvedAt: string | null;
  createdAt: string;
};

export type UserCounts = Partial<Record<UserStatus, number>>;

/** สิทธิ์ที่เลือกได้ (จากตาราง roles) */
export type AdminRole = { id: RoleId; code: UserRole; nameTh: string };

/** ช่องที่แอดมินแก้ได้ (ส่งเฉพาะช่องที่เปลี่ยน; lastName/email ส่งค่าว่างเพื่อล้าง) */
export type UpdateUserInput = {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
  venderCode?: string;
  roleId?: RoleId;
};

export type RegisteredMe = {
  registered: true;
  id: string;
  status: UserStatus;
  active: boolean;
  roleId: RoleId;
  roleName: string;
  rejectReason: string | null;
  firstName: string;
  lastName: string | null;
  phoneNumber: string;
  email: string | null;
  venderCode: string | null;
  venderName: string | null;
  createdAt: string;
  approvedAt: string | null;
  line: { displayName: string | null; pictureUrl: string | null };
};

export type MeResponse = { registered: false } | RegisteredMe;

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

  /** ต้องล็อกอินก่อน (ensureSession ใน lib/auth.ts) */
  getMe: () => http.get<MeResponse>("/users/me"),

  register: (input: RegisterInput) =>
    http.post<{ id: string; status: UserStatus }>("/users/register", input),

  // ── แอดมิน (ต้องเป็น role admin) ──
  listUsers: (params?: { status?: UserStatus; q?: string; active?: boolean }) =>
    http.get<AdminUser[]>("/users", {
      params: params && { ...params, active: params.active === undefined ? undefined : String(params.active) },
    }),
  getRoles: () => http.get<AdminRole[]>("/users/roles"),
  updateUser: (id: string, input: UpdateUserInput) => http.patch<{ id: string }>(`/users/${id}`, input),
  getUserCounts: () => http.get<UserCounts>("/users/counts"),
  approveUser: (id: string) => http.patch<{ id: string; status: UserStatus }>(`/users/${id}/approve`),
  rejectUser: (id: string, reason: string) =>
    http.patch<{ id: string; status: UserStatus }>(`/users/${id}/reject`, { reason }),
  setUserActive: (id: string, active: boolean) =>
    http.patch<{ id: string; active: boolean }>(`/users/${id}/active`, { active }),
};

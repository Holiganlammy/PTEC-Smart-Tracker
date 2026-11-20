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

export type JobGroup = "all" | "open" | "closed";

export type Job = {
  id: string;
  /** เลขงานของเรา */
  jobCode: string;
  /** เลขงานของ OPS (ถ้ามาจาก OPS) */
  opsJobCode: string | null;
  venderCode: string;
  requestedAt: string;
  branchCode: string | null;
  branchName: string | null;
  jobType: string | null;
  statusId: number;
  statusCode: string;
  statusName: string;
  closed: boolean;
  details: string | null;
  brand: string | null;
  model: string | null;
  /** ผู้รับเหมาช่วงที่ได้รับมอบหมาย (null = ยังไม่มอบหมาย) */
  assigneeId: string | null;
  assigneeName: string | null;
  /** ผู้แจ้ง/เบอร์/สถานที่ (สำเนาจาก OPS แอดมินแก้ได้ก่อนอนุมัติ) */
  reporterName: string | null;
  reporterPhone: string | null;
  address: string | null;
};

/** จำนวนงานแต่ละกลุ่ม (ตามตัวกรองที่เลือกอยู่) */
export type JobCounts = { all: number; open: number; closed: number };

export type JobList = {
  items: Job[];
  total: number;
  page: number;
  pageSize: number;
  counts?: JobCounts;
};

/** ตัวกรองหน้ารายการงาน */
export type JobFilters = {
  /** รหัสสถานะ (ว่าง = ทุกสถานะ) */
  status: number[];
  /** branch_code ("" = ทุกสาขา) */
  branch: string;
  /** แจ้งงานภายใน N วันล่าสุด (null = ทั้งหมด) */
  days: number | null;
};

export type JobFilterOptions = {
  statuses: { id: number; code: string; name: string; closed: boolean }[];
  branches: { code: string; name: string }[];
};

/** เหตุการณ์เปลี่ยนสถานะของงาน (ใช้แสดง timeline) */
export type JobTimelineEvent = {
  id: string;
  /** สถานะที่งานเปลี่ยนไปเป็น */
  statusId: number;
  at: string;
  actorName: string | null;
  note: string | null;
};

/** งานอื่นของสถานที่เดียวกัน (ประวัติแจ้งซ่อมของสถานที่นี้) */
export type JobHistoryRelation = "same_job" | "same_type" | "same_branch";
export type JobHistoryItem = {
  id: string;
  jobCode: string;
  opsJobCode: string | null;
  jobType: string | null;
  requestedAt: string;
  statusCode: string;
  statusName: string;
  relation: JobHistoryRelation;
};

/** ชนิดไฟล์แนบ ผูกกับขั้นตอน: report=แจ้งงาน(OPS) accepted=ยืนยันรับงาน progress=กำลังดำเนินงาน completed=ส่งงาน */
export type AttatchKind = "report" | "accepted" | "progress" | "completed" | "document";
export type UploadKind = "accepted" | "progress" | "completed";

export type JobAttatch = {
  id: string;
  source: "ops" | "strack";
  kind: AttatchKind;
  originalName: string | null;
  mimeType: string | null;
  isImage: boolean;
  sizeBytes: number | null;
  uploadedByName: string | null;
  createdAt: string;
  canDelete: boolean;
};

/** การกระทำที่เปลี่ยนสถานะงาน: รับงาน / เริ่มดำเนินการ / รออะไหล่ / กลับมาทำต่อ / ส่งงาน */
export type JobAction = "accept" | "start" | "wait_parts" | "resume" | "deliver";

/** ข้อมูลที่ส่งตอนเปลี่ยนสถานะ (รูปแนบไปในคำขอเดียวกัน) */
export type ChangeJobStatusInput = {
  action: JobAction;
  note?: string;
  /** วันเวลาที่ซ่อมเสร็จ "YYYY-MM-DDTHH:mm" (เวลาท้องถิ่น ไม่มี timezone) — ใช้กับ deliver */
  repairedAt?: string;
  /** รายละเอียดการซ่อม — ใช้กับ deliver */
  details?: string;
  /** รูปของขั้นตอนนี้ (รับงาน / กำลังดำเนินงาน / หลังซ่อมเสร็จ) */
  files?: File[];
  /** รูปก่อนซ่อม (เฉพาะ deliver) */
  beforeFiles?: File[];
};

/** แชทของงาน — อ่านได้ทุกคนที่เห็นงาน พิมพ์ได้เฉพาะเจ้าของงาน (คนที่รับงาน/ผู้รับเหมาช่วงที่ถูกมอบหมาย) และแอดมิน */
export type MessageSenderRole = "contractor" | "head" | "sub_contractor" | "admin";

export type JobMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: MessageSenderRole;
  body: string;
  /** เวลาท้องถิ่นที่เก็บในฐานข้อมูล (ไม่มี timezone) แสดงแบบ UTC เหมือนเวลาอื่น */
  createdAt: string;
  /** ข้อความของผู้ใช้คนนี้ */
  mine: boolean;
};

/** เหตุที่พิมพ์ไม่ได้: closed = งานปิด/ยกเลิก, no_owner_yet = ยังไม่มีผู้รับงาน, not_owner = ไม่ใช่ผู้รับงานนี้ */
export type ChatBlockReason = "closed" | "no_owner_yet" | "not_owner";

export type JobMessageList = {
  items: JobMessage[];
  canPost: boolean;
  blockedReason: ChatBlockReason | null;
};

/** รายละเอียดงานเต็ม */
export type JobDetail = Job & {
  priority: { name: string | null; slaHours: number | null } | null;
  /** เวลาที่ OPS แจ้งงานจริง (ใช้นับ SLA) null = ใช้ requestedAt */
  opsRequestedAt: string | null;
  keyedByName: string | null;
  history: JobHistoryItem[];
  timeline: JobTimelineEvent[];
  attachments: JobAttatch[];
  /** ชนิดรูปที่ผู้ใช้อัปโหลดเพิ่มได้ในสถานะปัจจุบัน */
  uploadableKinds: UploadKind[];
  /** การเปลี่ยนสถานะที่ผู้ใช้ทำได้ตอนนี้ (server เป็นผู้ตัดสิน) */
  actions: JobAction[];
  /** ข้อมูลการส่งงานซ่อม (มีเมื่อส่งงานแล้ว) */
  repairedAt: string | null;
  repairDetails: string | null;
};

/** งานในคิวตรวจของแอดมิน (มีชื่อบริษัทผู้รับเหมา) */
export type ReviewJob = Job & { venderName: string | null };
/** ประเภทงานของ OPS (ตาราง JobType) */
export type JobType = { jobTypeId: number; name: string };
/** ช่องที่แอดมินแก้ได้ในงานที่รอตรวจ (ช่องว่าง = ล้างค่า) */
export type JobEditFields = {
  jobType: string;
  branchName: string;
  details: string;
  brand: string;
  model: string;
  reporterName: string;
  reporterPhone: string;
  address: string;
};
export type ReviewJobList = { items: ReviewJob[]; total: number; page: number; pageSize: number };

/** รวม endpoint ของ backend (ใช้ `http` จาก lib/http.ts) */
export const api = {
  getVenders: () => http.get<Vender[]>("/venders"),

  /** ต้องล็อกอินก่อน (ensureSession ใน lib/auth.ts) */
  getMe: () => http.get<MeResponse>("/users/me"),

  register: (input: RegisterInput) =>
    http.post<{ id: string; status: UserStatus }>("/users/register", input),

  // ── งานซ่อมของบริษัทผู้รับเหมา ──
  listJobs: (params: {
    group?: JobGroup;
    q?: string;
    page?: number;
    pageSize?: number;
    filters?: JobFilters;
  }) => {
    const { filters, ...rest } = params;
    return http.get<JobList>("/jobs", {
      params: {
        ...rest,
        status: filters?.status.length ? filters.status.join(",") : undefined,
        branch: filters?.branch || undefined,
        days: filters?.days ?? undefined,
      },
    });
  },
  listJobFilters: () => http.get<JobFilterOptions>("/jobs/filters"),
  getJob: (id: string) => http.get<JobDetail>(`/jobs/${id}`),
  /** เปลี่ยนสถานะงาน (รับงาน/เริ่ม/รออะไหล่/ส่งงาน) พร้อมแนบรูป — คืนรายละเอียดงานล่าสุด */
  changeJobStatus: (id: string, input: ChangeJobStatusInput) => {
    const form = new FormData();
    form.append("action", input.action);
    if (input.note) form.append("note", input.note);
    if (input.repairedAt) form.append("repairedAt", input.repairedAt);
    if (input.details) form.append("details", input.details);
    for (const f of input.files ?? []) form.append("files", f, f.name);
    for (const f of input.beforeFiles ?? []) form.append("beforeFiles", f, f.name);
    return http.post<JobDetail>(`/jobs/${id}/status`, form, { timeoutMs: 90_000 });
  },
  /** อัปโหลดรูปของงาน (ชนิด kind ตามขั้นตอน) */
  uploadJobFiles: (id: string, kind: UploadKind, files: File[]) => {
    const form = new FormData();
    form.append("kind", kind);
    for (const f of files) form.append("files", f, f.name);
    return http.post<JobAttatch[]>(`/jobs/${id}/attachments`, form, { timeoutMs: 60_000 });
  },
  deleteJobFile: (id: string, attId: string) => http.delete<void>(`/jobs/${id}/attachments/${attId}`),
  /** แชทของงาน: after = id ข้อความล่าสุดที่เห็นแล้ว (ได้เฉพาะที่ใหม่กว่า) */
  getJobMessages: (id: string, after?: string) =>
    http.get<JobMessageList>(`/jobs/${id}/messages${after ? `?after=${encodeURIComponent(after)}` : ""}`),
  sendJobMessage: (id: string, body: string) => http.post<JobMessage>(`/jobs/${id}/messages`, { body }),
  /** ตัวไฟล์ (ต้องแนบ token จึงดึงเป็น blob แล้วทำ object URL) */
  getJobFile: (id: string, attId: string) =>
    http.get<Blob>(`/jobs/${id}/attachments/${attId}/file`, { responseType: "blob", timeoutMs: 30_000 }),

  // ── แอดมิน: คิวตรวจงานจาก OPS ──
  listReviewJobs: (params: { q?: string; page?: number; pageSize?: number }) =>
    http.get<ReviewJobList>("/jobs/review", { params }),
  getReviewCount: () => http.get<{ pending: number }>("/jobs/review/count"),
  listJobTypes: () => http.get<JobType[]>("/jobs/types"),
  updateJob: (id: string, data: JobEditFields) => http.patch<{ id: string }>(`/jobs/${id}`, data),
  approveJob: (id: string) => http.patch<{ id: string; statusId: number }>(`/jobs/${id}/approve`),
  returnJob: (id: string, note: string) =>
    http.patch<{ id: string; statusId: number }>(`/jobs/${id}/return`, { note }),

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

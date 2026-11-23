import type { RoleCode } from '../service/job-permission';
import type { JobAttatchItem, UploadKind } from './job-attatch.type';

/** การกระทำของผู้รับเหมาที่เปลี่ยนสถานะงาน (POST /jobs/:id/status) */
export const JOB_ACTIONS = [
  'accept', // แจ้งงาน → รับงานแล้ว
  'start', // รับงานแล้ว → กำลังดำเนินการ
  'wait_parts', // กำลังดำเนินการ → รออะไหล่
  'resume', // รออะไหล่ → กำลังดำเนินการ
  'deliver', // กำลังดำเนินการ/รออะไหล่ → ส่งมอบงาน
  'reject', // แจ้งงาน/รับงานแล้ว → ปฏิเสธงาน (ต้องระบุเหตุผล รอแอดมินจ่ายให้บริษัทอื่น)
] as const;
export type JobAction = (typeof JOB_ACTIONS)[number];

/** รูปแบบข้อมูลงานที่ API ส่งออก (ผลลัพธ์ของ query Jobs join Job_Status) */
export interface JobItem {
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
}

/** ประเภทงานของ OPS (ตาราง JobType) */
export interface JobTypeItem {
  jobTypeId: number;
  name: string;
}

/** งานในคิวตรวจของแอดมิน (มีชื่อบริษัทผู้รับเหมาเพิ่ม) */
export interface ReviewJobItem extends JobItem {
  venderName: string | null;
}

/** งานที่บริษัทปฏิเสธ รอแอดมินจ่ายให้บริษัทอื่น (GET /jobs/rejected) */
export interface RejectedJobItem extends JobItem {
  /** บริษัทที่ปฏิเสธ (บริษัทปัจจุบันของงาน) */
  venderName: string | null;
  rejectedAt: string | null;
  rejectedByName: string | null;
  /** เหตุผลที่ปฏิเสธ */
  reason: string | null;
  /** true = ปฏิเสธหลังจากรับงานไปแล้ว */
  afterAccept: boolean;
}

/** จำนวนงานแยกตามกลุ่ม (ตามตัวกรองอื่น ๆ ที่เลือกอยู่) */
export interface JobCounts {
  all: number;
  open: number;
  closed: number;
}

/** รายการงานแบบแบ่งหน้า */
export interface JobList<T = JobItem> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  /** มีเฉพาะรายการงานของผู้รับเหมา (GET /jobs) */
  counts?: JobCounts;
}

/** ตัวเลือกของตัวกรองหน้ารายการงาน */
export interface JobFilterOptions {
  statuses: { id: number; code: string; name: string; closed: boolean }[];
  branches: { code: string; name: string }[];
}

/** แถวดิบจากฐานข้อมูลก่อนแปลงเป็น JobItem (closed เป็น bit/number, requestedAt เป็น Date) */
export type JobRow = Omit<
  JobItem,
  'closed' | 'requestedAt' | 'assigneeName'
> & {
  closed: boolean | number;
  requestedAt: Date;
  assigneeFirstName: string | null;
  assigneeLastName: string | null;
};

/** เหตุการณ์เปลี่ยนสถานะของงาน (จาก Jobs_Logs) ใช้แสดง timeline ในหน้ารายละเอียด */
export interface JobTimelineEvent {
  id: string;
  /** สถานะที่งานเปลี่ยนไปเป็น */
  statusId: number;
  at: string;
  actorName: string | null;
  note: string | null;
}

/** ความเกี่ยวข้องของงานในประวัติกับงานที่เปิดอยู่ */
export type JobHistoryRelation = 'same_job' | 'same_type' | 'same_branch';

/** งานที่เกี่ยวข้อง (ใบเดียวกันส่งซ้ำ / ประเภทเดียวกันในสาขา / งานอื่นของสาขา) */
export interface JobHistoryItem {
  id: string;
  jobCode: string;
  opsJobCode: string | null;
  jobType: string | null;
  requestedAt: string;
  statusCode: string;
  statusName: string;
  relation: JobHistoryRelation;
}

/**
 * สมาชิกในทีมรับผิดชอบของงาน (การ์ด "ทีมรับผิดชอบ") — เป็นรายการ เพิ่มแถวได้เรื่อย ๆ
 * ตอนนี้มีสองแบบ: คนที่กดรับงาน + ผู้รับเหมาช่วงที่ถูกมอบหมาย (บริษัทเดียวกัน)
 * ผู้รับเหมาช่วงต่างบริษัทจะเพิ่มเป็นแถวใหม่เมื่อมีตารางงานย่อย
 */
export interface JobTeamMember {
  userId: string;
  name: string;
  companyName: string | null;
  role: RoleCode;
  /** accepted = กดรับงาน, assigned = ถูกมอบหมายงาน */
  kind: 'accepted' | 'assigned';
}

/** รายละเอียดงานเต็ม (GET /jobs/:id) — อ่านจากตาราง Jobs ของเราทั้งหมด */
export interface JobDetail extends JobItem {
  /** ทีมรับผิดชอบ เรียงตามลำดับที่เข้ามาร่วมงาน (ว่าง = ยังไม่มีผู้รับผิดชอบ) */
  team: JobTeamMember[];
  /** ระดับความสำคัญ + SLA (สำเนาจาก PolicyLevel ของ OPS) */
  priority: { name: string | null; slaHours: number | null } | null;
  /** เวลาที่ OPS แจ้งงานจริง (ใช้นับ SLA) null = ไม่มี ให้ใช้ requestedAt */
  opsRequestedAt: string | null;
  /** เจ้าหน้าที่ OPS ที่คีย์งาน */
  keyedByName: string | null;
  /** ประวัติที่เกี่ยวข้อง จัดกลุ่มตาม relation (ใบเดียวกัน → ประเภทเดียวกัน → สาขาเดียวกัน) */
  history: JobHistoryItem[];
  timeline: JobTimelineEvent[];
  /** ไฟล์แนบ/รูปทุกขั้นตอน (รายการ ตัวไฟล์ดึงจาก /jobs/:id/attachments/:attId/file) */
  attachments: JobAttatchItem[];
  /** ชนิดไฟล์ที่ผู้ใช้คนนี้อัปโหลดเพิ่มได้ในสถานะปัจจุบัน */
  uploadableKinds: UploadKind[];
  /** การเปลี่ยนสถานะที่ผู้ใช้คนนี้ทำได้ตอนนี้ */
  actions: JobAction[];
  /** ข้อมูลการส่งงานซ่อม */
  repairedAt: string | null;
  repairDetails: string | null;
}

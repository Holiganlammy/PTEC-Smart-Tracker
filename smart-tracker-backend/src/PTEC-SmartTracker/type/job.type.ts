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
  /** งานย่อย: id ของงานแม่ที่มอบหมายต่อมา (null = งานหลัก/ลูกค้าตรง) */
  parentJobId: string | null;
  /** เฉพาะรายการงาน: งานย่อย → ชื่อบริษัทที่มอบหมายต่อมา */
  parentVenderName?: string | null;
  /** เฉพาะรายการงาน: งานหลัก → จำนวนงานย่อยที่มอบหมายต่อ (ไม่นับที่ยกเลิก) */
  subJobCount?: number;
  /** เฉพาะรายการงาน: งานย่อยที่ถูกตีกลับให้แก้ไขและยังไม่ได้ส่งใหม่ */
  reworking?: boolean;
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
  | 'closed'
  | 'requestedAt'
  | 'assigneeName'
  | 'parentVenderName'
  | 'subJobCount'
  | 'reworking'
> & {
  closed: boolean | number;
  requestedAt: Date;
  assigneeFirstName: string | null;
  assigneeLastName: string | null;
  /** บริษัทของงานแม่ (ใช้หาชื่อบริษัทที่มอบหมายต่อมา — ไม่ส่งออกตรง ๆ) */
  parentVenderCode: string | null;
};

/** เหตุการณ์เปลี่ยนสถานะของงาน (จาก Jobs_Logs) ใช้แสดง timeline ในหน้ารายละเอียด */
export interface JobTimelineEvent {
  id: string;
  /** ชนิดเหตุการณ์ (Jobs_Logs.action) เช่น rework = ตีกลับให้แก้ไข, inspected = ตรวจรับงานย่อย */
  action: string;
  /** สถานะที่งานเปลี่ยนไปเป็น */
  statusId: number;
  at: string;
  actorName: string | null;
  note: string | null;
}

/** งานย่อยที่ถูกตีกลับให้แก้ไขและยังไม่ได้ส่งงานใหม่ (ครั้งล่าสุด) */
export interface JobRework {
  /** ตีกลับมาแล้วกี่ครั้ง (รวมครั้งนี้) */
  count: number;
  /** สิ่งที่ต้องแก้ไข */
  note: string | null;
  byName: string | null;
  at: string;
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

/** งานย่อยที่ผู้รับเหมาหลักมอบหมายต่อให้บริษัทอื่น (การ์ด "มอบหมายงานผู้รับเหมา" ในหน้ารายละเอียดงานแม่) */
export interface SubJobItem {
  id: string;
  jobCode: string;
  venderCode: string;
  venderName: string | null;
  statusId: number;
  statusCode: string;
  statusName: string;
  /** ขอบเขตงานที่มอบหมาย */
  scope: string | null;
  /** กำหนดเสร็จ YYYY-MM-DD (แยกจาก Jobs.due_at) */
  dueDate: string | null;
  /** เวลากำหนดเสร็จ HH:mm (แยกจาก Jobs.due_at) */
  dueTime: string | null;
  /** คนที่กดรับงานย่อย (null = ยังไม่มีใครรับ) */
  acceptedByName: string | null;
  acceptedByPhone: string | null;
  /** ยกเลิกงานย่อยนี้ได้ (ผู้ใช้เป็นผู้จ่ายงาน และยังไม่มีใครรับ) */
  canCancel: boolean;
  /** ตรวจรับ/ตีกลับได้ตอนนี้ (ผู้ใช้เป็นเจ้าของงานแม่/หัวหน้า/แอดมิน และงานย่อยส่งมอบแล้ว) */
  canInspect: boolean;
  /** ถูกตีกลับให้แก้ไขมาแล้วกี่ครั้ง */
  reworkCount: number;
  /** กำลังแก้ไขตามที่ถูกตีกลับ (ยังไม่ได้ส่งงานใหม่) */
  reworking: boolean;
}

/**
 * ประวัติงานย่อยโดยละเอียด ให้ฝั่งงานแม่ดู (GET /jobs/:id/subjobs/:subId) — อ่านอย่างเดียว
 * ผู้รับเหมาหลักอยู่คนละบริษัทกับงานย่อย จึงเปิด /jobs/:subId ตรง ๆ ไม่ได้
 */
export interface SubJobHistory extends Omit<SubJobItem, 'canCancel'> {
  closed: boolean;
  /** เวลาที่มอบหมายงานย่อย */
  requestedAt: string;
  repairedAt: string | null;
  repairDetails: string | null;
  timeline: JobTimelineEvent[];
  /** รูปทุกขั้นตอน (ตัวไฟล์ดึงจาก /jobs/:id/subjobs/:subId/attachments/:attId/file) */
  attachments: JobAttatchItem[];
}

/** ฝั่งงานย่อย: ใครมอบหมายต่อมาให้ (แสดงเป็นแบนเนอร์ "รับช่วงจาก …" และการ์ดขอบเขตงาน) */
export interface SubJobOrigin {
  parentJobId: string;
  parentJobCode: string;
  parentOpsJobCode: string | null;
  parentVenderName: string | null;
  assignedByName: string | null;
  dueDate: string | null;
  /** เวลากำหนดเสร็จ HH:mm */
  dueTime: string | null;
  /** หมายเหตุที่ผู้รับเหมาหลักเขียนไว้ตอนมอบหมาย */
  note: string | null;
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
  /** งานย่อยที่มอบหมายต่อให้บริษัทอื่น (ว่างสำหรับงานย่อยเอง/งานที่ยังไม่มี) */
  subJobs: SubJobItem[];
  /** ผู้ใช้คนนี้เพิ่มงานย่อยได้ตอนนี้ (ปุ่ม "+ เพิ่มผู้รับเหมา") */
  canAddSubJob: boolean;
  /** มีค่าเมื่อเป็นงานย่อย — ใครมอบหมายต่อมาให้ */
  subJobOrigin: SubJobOrigin | null;
  /** มีค่าเมื่องานย่อยถูกตีกลับให้แก้ไขและยังไม่ได้ส่งงานใหม่ */
  rework: JobRework | null;
}

import { JobStatusId } from '../model/job-status.model';
import { RoleId } from '../model/role.model';

/**
 * กติกาว่าใครทำอะไรกับงานได้ (ฟังก์ชันล้วน ไม่แตะ DB — ทดสอบได้ตรง ๆ)
 *
 *  - ดูงาน/อ่านแชทได้: ทุกคนที่เห็นงานนั้น (ขอบเขตบริษัท/ผู้รับเหมาช่วง ตรวจที่ JobService.findAccessible)
 *  - "เจ้าของงาน" = คนที่กดรับงาน หรือผู้รับเหมาช่วงที่ถูกมอบหมาย
 *  - เปลี่ยนสถานะ: เจ้าของงานเท่านั้น (ยกเว้นสถานะแจ้งงานที่ยังไม่มีใครรับ — ใครในบริษัทก็กดรับได้)
 *  - พิมพ์แชท: เจ้าของงาน + แอดมิน และต้องเป็นงานที่ยังไม่ปิด/ยกเลิก
 */

/** รหัสบทบาทที่ส่งออกให้หน้าเว็บ (ป้ายข้างชื่อในแชท/ทีมรับผิดชอบ) */
export type RoleCode = 'contractor' | 'head' | 'sub_contractor' | 'admin';

const ROLE_CODE: Record<number, RoleCode> = {
  [RoleId.CONTRACTOR]: 'contractor',
  [RoleId.HEAD]: 'head',
  [RoleId.SUB_CONTRACTOR]: 'sub_contractor',
  [RoleId.ADMIN]: 'admin',
};

export function roleCode(roleId: number): RoleCode {
  return ROLE_CODE[Number(roleId)] ?? 'contractor';
}

/** ข้อมูลของงานที่ใช้ตัดสินสิทธิ์ */
export interface JobOwnership {
  statusId: number;
  /** ผู้รับเหมาช่วงที่ได้รับมอบหมาย (Users.id) */
  assignedTo: string | null;
  /** คนที่กดรับงาน (Users.id จากประวัติ Jobs_Logs) — null = ไม่มีประวัติรับงาน */
  acceptedBy: string | null;
}

export interface Actor {
  id: string;
  roleId: number;
}

/** role ที่เปลี่ยนสถานะงานได้ (แอดมินดูและพิมพ์แชทได้ แต่ไม่เปลี่ยนสถานะ) */
const STATUS_CHANGERS: number[] = [
  Number(RoleId.CONTRACTOR),
  Number(RoleId.HEAD),
  Number(RoleId.SUB_CONTRACTOR),
];

/** สถานะแจ้งงาน (ยังไม่มีใครรับ) */
const STATUS_NEW: number = JobStatusId.NEW;

/** สถานะปฏิเสธงาน (รอแอดมินจ่ายใหม่) */
const STATUS_REJECTED: number = JobStatusId.REJECTED;

/** สถานะที่แชทเป็นแบบอ่านอย่างเดียว */
const CHAT_CLOSED: number[] = [JobStatusId.COMPLETED, JobStatusId.CANCELLED];

export function isStatusChanger(user: Actor): boolean {
  return STATUS_CHANGERS.includes(Number(user.roleId));
}

/** เป็นเจ้าของงานนี้ไหม (คนที่รับงาน หรือผู้รับเหมาช่วงที่ถูกมอบหมาย) */
export function isJobOwner(user: Actor, o: JobOwnership): boolean {
  const me = String(user.id);
  if (o.acceptedBy !== null && String(o.acceptedBy) === me) return true;
  if (o.assignedTo !== null && String(o.assignedTo) === me) return true;
  // ข้อมูลเก่าที่ผ่านสถานะรับงานมาแล้วแต่ไม่มีประวัติรับงานและไม่มีผู้ถูกมอบหมาย:
  // ไม่รู้ว่าใครเป็นเจ้าของ จึงใช้กติกาเดิม (ทุกคนในบริษัททำได้) ไม่ให้งานค้างไม่มีใครขยับได้
  return (
    o.acceptedBy === null && o.assignedTo === null && o.statusId !== STATUS_NEW
  );
}

/** เปลี่ยนสถานะงานได้ไหม (ปุ่มรับงาน/เริ่ม/รออะไหล่/ส่งงาน) */
export function canChangeStatus(user: Actor, o: JobOwnership): boolean {
  if (!isStatusChanger(user)) return false;
  return o.statusId === STATUS_NEW || isJobOwner(user, o);
}

/** สถานะที่มอบหมายงานย่อยให้บริษัทอื่นได้ (รับงานแล้ว ยังไม่ส่งมอบ) */
const SUB_JOB_STATUSES: number[] = [
  JobStatusId.ACCEPTED,
  JobStatusId.IN_PROGRESS,
  JobStatusId.WAITING_PARTS,
];

/** role ที่มอบหมายงานย่อยได้ในฐานะเจ้าของงาน (ผู้รับเหมา/หัวหน้า — ผู้รับเหมาช่วงในบริษัทมอบต่อไม่ได้) */
const SUB_JOB_DISPATCHERS: number[] = [
  Number(RoleId.CONTRACTOR),
  Number(RoleId.HEAD),
];

/**
 * เพิ่ม/ยกเลิกงานย่อยของงานนี้ได้ไหม: ขณะที่งานรับแล้วและยังไม่ส่งมอบ
 *  - ผู้รับเหมา/หัวหน้า: ต้องเป็นเจ้าของงาน
 *  - แอดมิน: ทุกใบงานของทุกบริษัท ไม่ต้องเป็นเจ้าของงาน
 * งานย่อยเองมอบต่ออีกทอดไม่ได้ (ให้มีชั้นเดียวตาม Figma)
 */
export function canAddSubJob(
  user: Actor,
  o: JobOwnership,
  isSubJob: boolean,
): boolean {
  if (isSubJob) return false;
  if (!SUB_JOB_STATUSES.includes(o.statusId)) return false;
  if (Number(user.roleId) === Number(RoleId.ADMIN)) return true;
  if (!SUB_JOB_DISPATCHERS.includes(Number(user.roleId))) return false;
  return isJobOwner(user, o);
}

/** เหตุที่พิมพ์แชทไม่ได้ (UI แปลงเป็นข้อความไทยเอง) */
export type ChatBlockReason =
  'closed' | 'rejected' | 'no_owner_yet' | 'not_owner';

export interface ChatPermission {
  canPost: boolean;
  reason: ChatBlockReason | null;
}

export function chatPermission(user: Actor, o: JobOwnership): ChatPermission {
  if (CHAT_CLOSED.includes(o.statusId)) {
    return { canPost: false, reason: 'closed' };
  }
  if (Number(user.roleId) === Number(RoleId.ADMIN)) {
    return { canPost: true, reason: null };
  }
  // บริษัทที่ปฏิเสธงานแล้วอ่านอย่างเดียว (แอดมินยังพิมพ์ถามเหตุผลได้ — เช็กข้างบนแล้ว)
  if (o.statusId === STATUS_REJECTED) {
    return { canPost: false, reason: 'rejected' };
  }
  if (isStatusChanger(user) && isJobOwner(user, o)) {
    return { canPost: true, reason: null };
  }
  // ยังไม่มีใครรับงาน (และไม่ได้ถูกมอบหมายให้ใคร)
  if (o.statusId === STATUS_NEW && o.assignedTo === null) {
    return { canPost: false, reason: 'no_owner_yet' };
  }
  return { canPost: false, reason: 'not_owner' };
}

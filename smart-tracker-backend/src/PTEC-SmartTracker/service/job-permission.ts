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

/** เหตุที่พิมพ์แชทไม่ได้ (UI แปลงเป็นข้อความไทยเอง) */
export type ChatBlockReason = 'closed' | 'no_owner_yet' | 'not_owner';

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
  if (isStatusChanger(user) && isJobOwner(user, o)) {
    return { canPost: true, reason: null };
  }
  // ยังไม่มีใครรับงาน (และไม่ได้ถูกมอบหมายให้ใคร)
  if (o.statusId === STATUS_NEW && o.assignedTo === null) {
    return { canPost: false, reason: 'no_owner_yet' };
  }
  return { canPost: false, reason: 'not_owner' };
}

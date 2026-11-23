import type { ChatBlockReason, RoleCode } from '../service/job-permission';

/** รหัสบทบาทที่ส่งออกให้หน้าเว็บ (ใช้แสดงป้ายข้างชื่อ) */
export type MessageSenderRole = RoleCode;

export interface JobMessageItem {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: MessageSenderRole;
  body: string;
  /** ISO — ค่าเวลาท้องถิ่นที่เก็บในฐานข้อมูล (ไม่มี timezone) ให้ฝั่งเว็บแสดงแบบ UTC เหมือนเวลาอื่น */
  createdAt: string;
  /** ข้อความของผู้ใช้ที่เรียก API */
  mine: boolean;
}

/** GET /jobs/:id/messages */
export interface JobMessageList {
  items: JobMessageItem[];
  /** ผู้ใช้คนนี้พิมพ์ได้ไหม (false = ดูได้อย่างเดียว) */
  canPost: boolean;
  /** เหตุที่พิมพ์ไม่ได้ (null เมื่อพิมพ์ได้) */
  blockedReason: ChatBlockReason | null;
}

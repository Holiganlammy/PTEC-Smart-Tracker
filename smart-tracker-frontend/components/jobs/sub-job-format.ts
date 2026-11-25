import type { SubJob } from "@/lib/api";
import type { TONES } from "./job-list";

/** งานย่อยที่ถูกตัดออกจากงานหลักแล้ว: บริษัทปฏิเสธงาน / ยกเลิก — ยังแสดงในการ์ดได้ แต่ไม่ขวางการส่งงานหลัก */
export function isCutOff(s: Pick<SubJob, "statusCode">) {
  return s.statusCode === "rejected" || s.statusCode === "cancelled";
}

/** งานย่อยที่ยังค้าง (ยังทำอยู่และยังไม่ตรวจรับผ่าน) — งานหลักส่งงานได้เมื่อไม่เหลือรายการเลย (server ตรวจซ้ำ) */
export function pendingSubJobs(subJobs: SubJob[]) {
  return subJobs.filter((s) => s.statusCode !== "completed" && !isCutOff(s));
}

/** ป้ายสถานะงานย่อยตาม Figma (ชื่อเรียกต่างจากสถานะงานปกติ เช่น แจ้งงาน → รอตอบรับ, ส่งมอบ → รอตรวจรับ) */
export const SUB_STATUS: Record<string, { label: string; tone: keyof typeof TONES }> = {
  new: { label: "รอตอบรับ", tone: "brand" },
  accepted: { label: "รับงานแล้ว", tone: "brand" },
  in_progress: { label: "กำลังดำเนินการ", tone: "warning" },
  waiting_parts: { label: "รออะไหล่", tone: "warning" },
  delivered: { label: "รอตรวจรับ", tone: "sub" },
  completed: { label: "เสร็จสิ้น", tone: "success" },
  rejected: { label: "ปฏิเสธงาน", tone: "danger" },
  cancelled: { label: "ยกเลิกแล้ว", tone: "muted" },
};

/**
 * ป้ายสถานะของงานย่อย (สถานะที่ไม่มีในตาราง ใช้ชื่อจากฐานข้อมูล สีเทา)
 * reworking = ถูกหัวหน้าตีกลับให้แก้ไข — สถานะยังเป็นกำลังดำเนินการ/รออะไหล่ แต่แสดงเป็นงานแก้ไข (สีแดง)
 */
export function subStatusOf(statusCode: string, statusName: string, reworking = false) {
  if (reworking) {
    return { label: statusCode === "waiting_parts" ? "รออะไหล่ (แก้ไข)" : "กำลังแก้ไข", tone: "danger" as const };
  }
  return SUB_STATUS[statusCode] ?? { label: statusName, tone: "muted" as const };
}

export const dueFormat = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC", // กำหนดเสร็จเก็บเป็นวันที่ล้วน ไม่มีเวลา/timezone
});

/** เวลากำหนดเสร็จของงานย่อยที่ไม่ได้ระบุ (งานย่อยเก่าก่อนมีช่องเวลา) ถือเป็นเลิกงาน 18:00 น. (ตาม Figma) */
export const DEFAULT_DUE_TIME = "18:00";

/** กำหนดเสร็จของงานย่อย เช่น "25 พ.ย. 69 ก่อน 14:00 น." (time เป็น HH:mm) */
export function formatSubDue(date: string, time?: string | null) {
  return `${dueFormat.format(new Date(`${date}T00:00:00Z`))} ก่อน ${time ?? DEFAULT_DUE_TIME} น.`;
}

/**
 * เวลาที่เหลือถึงกำหนดเสร็จ (มิลลิวินาที ติดลบ = เกินแล้ว)
 * กำหนดเสร็จเป็นเวลาท้องถิ่นไม่มี timezone (อ่านเป็น UTC) จึงเทียบกับเวลาเครื่องในกรอบเดียวกัน
 */
export function dueRemainingMs(date: string, time: string | null | undefined, now: number) {
  return (
    new Date(`${date}T${time ?? DEFAULT_DUE_TIME}:00Z`).getTime() - (now - new Date().getTimezoneOffset() * 60_000)
  );
}

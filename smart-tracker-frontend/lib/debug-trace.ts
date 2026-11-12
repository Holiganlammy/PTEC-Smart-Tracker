/**
 * บันทึกขั้นตอนเล็ก ๆ ลง localStorage (คงอยู่ข้ามการ redirect) ไว้ดูบนหน้าจอมือถือที่เปิด console ไม่ได้
 * ห้ามบันทึกค่าลับ (token, code, state) — บันทึกได้แค่ชื่อพารามิเตอร์/ค่าสถานะ
 */
const KEY = "app-debug-trace";
const MAX_LINES = 40;

export function trace(message: string) {
  console.log("[trace]", message);
  try {
    const lines: string[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    lines.push(`${new Date().toTimeString().slice(0, 8)} ${message}`);
    localStorage.setItem(KEY, JSON.stringify(lines.slice(-MAX_LINES)));
  } catch {
    // localStorage ใช้ไม่ได้ ก็ข้ามไป
  }
}

export function readTrace(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

const LOADS_KEY = "page-load-times";
const LOADS_WINDOW_MS = 60_000;
export const MAX_LOADS_PER_WINDOW = 4;

/** นับจำนวนครั้งที่หน้านี้ถูกโหลดใน 1 นาทีล่าสุด (รวมครั้งนี้) — ใช้ตัดวงจร redirect ที่วนไม่จบ */
export function registerPageLoad(): number {
  try {
    const all: number[] = JSON.parse(localStorage.getItem(LOADS_KEY) ?? "[]");
    const recent = all.filter((t) => Date.now() - t < LOADS_WINDOW_MS);
    recent.push(Date.now());
    localStorage.setItem(LOADS_KEY, JSON.stringify(recent));
    return recent.length;
  } catch {
    return 1; // localStorage ใช้ไม่ได้ ก็ไม่มีตัวกัน
  }
}

/** ล้างตัวนับ (เรียกตอนผู้ใช้กด "ลองอีกครั้ง") */
export function resetLoadGuard() {
  try {
    localStorage.removeItem(LOADS_KEY);
    localStorage.removeItem("liff-login-attempts");
  } catch {
    // ข้าม
  }
}

export function clearTrace() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ข้าม
  }
}

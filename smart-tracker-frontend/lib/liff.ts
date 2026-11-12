import { trace } from "./debug-trace";

export type LineSession = {
  idToken: string;
  displayName: string;
  pictureUrl?: string;
};

type Liff = typeof import("@line/liff").default;

let initPromise: Promise<Liff> | null = null;

/** init LIFF ครั้งเดียว (ใช้ LIFF ID ของ MINI App) — เรียกได้เฉพาะฝั่ง browser */
function getLiff() {
  initPromise ??= (async () => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) throw new Error("ยังไม่ได้ตั้งค่า NEXT_PUBLIC_LIFF_ID");

    // บันทึกเฉพาะ "ชื่อ" พารามิเตอร์ใน URL (ไม่บันทึกค่า code/state)
    const paramNames = [...new URLSearchParams(location.search).keys()].join(",") || "-";
    trace(`โหลดหน้า ${location.protocol}//${location.host}${location.pathname} params=[${paramNames}]`);

    const liff = (await import("@line/liff")).default;
    try {
      await liff.init({ liffId });
    } catch (e) {
      trace(`liff.init ล้มเหลว: ${e instanceof Error ? e.message : String(e)}`);
      throw e;
    }
    trace(`liff.init ผ่าน ${diagnose(liff)}`);
    return liff;
  })();
  return initPromise;
}

const LOGIN_ATTEMPTS_KEY = "liff-login-attempts";
const LOGIN_WINDOW_MS = 2 * 60_000;
const LOGIN_MAX_ATTEMPTS = 2;

/** สั่งล็อกอิน LINE แต่กันวนซ้ำ: ภายใน 2 นาที สั่งได้ไม่เกิน 2 ครั้ง ครั้งที่ 3 จะหยุดและโยน error (นับใน localStorage เพราะคงอยู่ข้ามการ redirect) */
function loginOnce(liff: Liff, reason: string) {
  let recent: number[] = [];
  try {
    const all: number[] = JSON.parse(localStorage.getItem(LOGIN_ATTEMPTS_KEY) ?? "[]");
    recent = all.filter((t) => Date.now() - t < LOGIN_WINDOW_MS);
  } catch {
    // localStorage ใช้ไม่ได้ — ไม่มีตัวกันวน
  }

  if (recent.length >= LOGIN_MAX_ATTEMPTS) {
    // ไม่ล้างตัวนับ ให้หมดอายุเองตามช่วงเวลา ไม่งั้นจะเริ่มวนรอบใหม่ได้อีก
    trace(`หยุดวนล็อกอิน (${reason})`);
    throw new Error(`ล็อกอิน LINE วนซ้ำ (${reason}) — ${diagnose(liff)}`);
  }

  try {
    localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify([...recent, Date.now()]));
  } catch {
    // ข้าม
  }
  trace(`สั่ง liff.login() ครั้งที่ ${recent.length + 1} (${reason})`);
  liff.login();
}

/** ข้อมูลช่วยวินิจฉัยเวลา login ไม่ผ่าน */
function diagnose(liff: Liff) {
  return `inClient=${liff.isInClient()} os=${liff.getOS()} loggedIn=${liff.isLoggedIn()} idToken=${liff.getIDToken() ? "มี" : "ไม่มี"}`;
}

/**
 * ดึง session จาก LINE
 * - ยังไม่ได้ล็อกอิน จะพาไปหน้า login ของ LINE แล้วคืน null
 * - ล็อกอินแล้วคืน ID Token + ชื่อ LINE
 * - วนล็อกอินเกินกำหนด จะโยน error (พร้อมบันทึกขั้นตอนให้ดูบนหน้าจอ)
 */
export async function getLineSession(): Promise<LineSession | null> {
  const liff = await getLiff();

  if (!liff.isLoggedIn()) {
    loginOnce(liff, "ยังไม่ได้ล็อกอิน");
    return null;
  }

  const idToken = liff.getIDToken();
  if (!idToken) {
    // ล็อกอินอยู่แล้วแต่ LINE ไม่ออก ID Token = ไม่ได้เปิด scope `openid` — ล็อกอินซ้ำไม่ช่วย (และทำให้หน้าโหลดวน) จึงหยุดทันที
    trace(`ไม่ได้ ID Token ทั้งที่ล็อกอินแล้ว ${diagnose(liff)}`);
    throw new Error(
      "ไม่ได้รับ ID Token จาก LINE — ต้องเปิด scope openid ใน LINE Developers Console " +
        "(MINI App channel → Web app settings → Scope) แล้วเปิดแอปใหม่ — " +
        diagnose(liff),
    );
  }

  try {
    localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
  } catch {
    // ข้าม
  }

  const profile = await liff.getProfile();
  trace("ได้ ID Token และโปรไฟล์แล้ว");
  return {
    idToken,
    displayName: profile.displayName,
    pictureUrl: profile.pictureUrl,
  };
}

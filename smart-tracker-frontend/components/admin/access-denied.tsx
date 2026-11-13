import Link from "next/link";
import { BanIcon, ClockIcon, ShieldAlertIcon, UserRoundXIcon, XCircleIcon } from "lucide-react";
import { RoleId, type MeResponse } from "@/lib/api";

export type DeniedReason =
  | "not-registered"
  | "not-admin"
  | "admin-pending"
  | "admin-rejected"
  | "admin-inactive";

type Info = {
  title: string;
  description: string;
  Icon: typeof ClockIcon;
  tone: string;
  soft: string;
};

const INFO: Record<DeniedReason, Info> = {
  "not-registered": {
    title: "ยังไม่ได้ลงทะเบียน",
    description: "บัญชี LINE นี้ยังไม่มีในระบบ กรุณาลงทะเบียนก่อน",
    Icon: UserRoundXIcon,
    tone: "text-muted-foreground",
    soft: "bg-muted",
  },
  "not-admin": {
    title: "ไม่มีสิทธิ์เข้าถึงหน้านี้",
    description: "หน้านี้สำหรับผู้ดูแลระบบเท่านั้น หากต้องการใช้งาน กรุณาติดต่อผู้ดูแลระบบ",
    Icon: ShieldAlertIcon,
    tone: "text-danger",
    soft: "bg-danger/10",
  },
  "admin-pending": {
    title: "บัญชีผู้ดูแลรอการอนุมัติ",
    description: "คุณได้รับสิทธิ์ผู้ดูแลระบบแล้ว แต่บัญชียังไม่ได้รับการอนุมัติ จึงยังเข้าหน้านี้ไม่ได้",
    Icon: ClockIcon,
    tone: "text-warning",
    soft: "bg-warning-soft",
  },
  "admin-rejected": {
    title: "บัญชีไม่ได้รับการอนุมัติ",
    description: "บัญชีผู้ดูแลของคุณไม่ผ่านการอนุมัติ กรุณาติดต่อผู้ดูแลระบบ",
    Icon: XCircleIcon,
    tone: "text-danger",
    soft: "bg-danger/10",
  },
  "admin-inactive": {
    title: "บัญชีถูกปิดการใช้งาน",
    description: "ขณะนี้บัญชีของคุณใช้งานไม่ได้ กรุณาติดต่อผู้ดูแลระบบ",
    Icon: BanIcon,
    tone: "text-danger",
    soft: "bg-danger/10",
  },
};

/** ตัดสินว่าทำไมถึงเข้าหน้า admin ไม่ได้ (null = เข้าได้) */
export function getDeniedReason(me: MeResponse): DeniedReason | null {
  if (!me.registered) return "not-registered";
  if (me.roleId !== RoleId.ADMIN) return "not-admin";
  if (me.status === "rejected") return "admin-rejected";
  if (!me.active || me.status === "suspended") return "admin-inactive";
  if (me.status !== "approved") return "admin-pending";
  return null;
}

/** หน้าแจ้งว่าเข้าไม่ได้ (ไม่ใช่ admin / admin ยังไม่อนุมัติ ฯลฯ) */
export function AccessDenied({ reason, roleName }: { reason: DeniedReason; roleName?: string }) {
  const { title, description, Icon, tone, soft } = INFO[reason];

  return (
    <div className="p-4">
      <section className="flex flex-col items-center rounded-3xl border bg-card px-5 py-8 text-center shadow-sm">
        <div className={`flex size-16 items-center justify-center rounded-full ${soft} ${tone}`}>
          <Icon className="size-8" />
        </div>
        <h2 className={`mt-4 font-heading text-xl font-medium ${tone}`}>{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>

        {reason === "not-admin" && roleName && (
          <p className="mt-4 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            สิทธิ์ของคุณ: {roleName}
          </p>
        )}

        {reason === "not-registered" && (
          <Link
            href="/register"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-brand px-6 text-sm font-medium text-white"
          >
            ไปหน้าลงทะเบียน
          </Link>
        )}
      </section>
    </div>
  );
}

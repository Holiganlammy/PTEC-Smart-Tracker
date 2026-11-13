"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronRightIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  ClockIcon,
  PlusCircleIcon,
  SendIcon,
  StarIcon,
  UsersIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoleId, api, type RegisteredMe } from "@/lib/api";
import { ensureSession } from "@/lib/auth";

type Gate =
  | { name: "loading" }
  | { name: "error"; message: string }
  | { name: "ready"; me: RegisteredMe };

/** หน้าหลัก: เช็กสถานะก่อน — ยังไม่ลงทะเบียน/ยังไม่อนุมัติ จะพาไปหน้า /register */
export function HomeDashboard() {
  const router = useRouter();
  const [gate, setGate] = useState<Gate>({ name: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!(await ensureSession()) || cancelled) return; // false = กำลังพาไปล็อกอิน LINE

        const me = await api.getMe();
        if (cancelled) return;

        if (!me.registered) {
          toast.warning("ยังไม่ได้ลงทะเบียน", {
            description: "กรุณาลงทะเบียนก่อนเริ่มใช้งานระบบ",
          });
          router.replace("/register");
          return;
        }
        if (me.status !== "approved" || !me.active) {
          // รออนุมัติ / ไม่อนุมัติ / ปิดใช้งาน → หน้าสถานะ
          router.replace("/register");
          return;
        }
        setGate({ name: "ready", me });
      } catch (e) {
        if (!cancelled) {
          setGate({ name: "error", message: e instanceof Error ? e.message : "เกิดข้อผิดพลาด" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (gate.name === "loading") {
    return <p className="p-8 text-center text-sm text-muted-foreground">กำลังโหลด…</p>;
  }
  if (gate.name === "error") {
    return <p className="p-8 text-center text-sm text-danger">{gate.message}</p>;
  }
  return <Dashboard me={gate.me} />;
}

// ───────── ข้อมูลตัวอย่าง (mockup) — เปลี่ยนเป็นข้อมูลจริงเมื่อมี API งานซ่อม ─────────

const STATS = [
  { label: "งานรอรับ", value: 3, Icon: ClipboardListIcon, tone: "text-brand", soft: "bg-brand/10" },
  { label: "กำลังดำเนินการ", value: 5, Icon: ClockIcon, tone: "text-warning", soft: "bg-warning-soft" },
  { label: "รอส่งซ่อม", value: 2, Icon: SendIcon, tone: "text-sub-accent", soft: "bg-sub-accent/10" },
  { label: "คะแนนของฉัน", value: "4.6", Icon: StarIcon, tone: "text-success", soft: "bg-success-soft" },
];

const RECENT_JOBS = [
  { id: "JOB-2411-0087", title: "แอร์ไม่เย็น ห้องเซิร์ฟเวอร์", branch: "สาขาบางนา", status: "รอรับงาน", tone: "warning" },
  { id: "JOB-2411-0083", title: "เปลี่ยนหลอดไฟโซนหน้าร้าน", branch: "สาขารังสิต", status: "กำลังดำเนินการ", tone: "brand" },
  { id: "JOB-2411-0079", title: "ประตูอัตโนมัติค้าง", branch: "สาขาพระราม 9", status: "รอส่งซ่อม", tone: "sub" },
] as const;

const STATUS_STYLE = {
  warning: "bg-warning-soft text-warning",
  brand: "bg-brand/10 text-brand",
  sub: "bg-sub-accent/10 text-sub-accent",
} as const;

function Dashboard({ me }: { me: RegisteredMe }) {
  const isAdmin = me.roleId === RoleId.ADMIN;

  return (
    <div className="space-y-4 p-4">
      {/* ทักทาย */}
      <section className="flex items-center gap-3 rounded-3xl border bg-card p-4 shadow-sm">
        <Avatar className="size-12">
          <AvatarImage src={me.line.pictureUrl ?? undefined} alt="" />
          <AvatarFallback>{me.firstName.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">สวัสดี</p>
          <p className="truncate font-heading text-lg leading-tight font-medium">{me.firstName}</p>
          <p className="truncate text-xs text-muted-foreground">{me.venderName ?? me.venderCode ?? "-"}</p>
        </div>
        <Badge variant="secondary">{me.roleName}</Badge>
      </section>

      {isAdmin && <AdminShortcut />}

      {/* ปุ่มหลัก */}
      <Button
        disabled
        className="h-auto w-full justify-start gap-3 rounded-2xl bg-brand p-4 text-left whitespace-normal text-white shadow-sm hover:bg-brand disabled:opacity-90"
      >
        <span className="flex size-11 items-center justify-center rounded-xl bg-white/20">
          <PlusCircleIcon className="size-6" />
        </span>
        <span className="flex-1">
          <span className="block font-medium">ส่งงานซ่อม</span>
          <span className="block text-xs text-white/75">บันทึกงานที่ซ่อมเสร็จ (เร็วๆ นี้)</span>
        </span>
        <ChevronRightIcon className="size-5 text-white/70" />
      </Button>

      {/* สรุป */}
      <section className="space-y-2">
        <SectionTitle title="ภาพรวมของคุณ" />
        <div className="grid grid-cols-2 gap-3">
          {STATS.map(({ label, value, Icon, tone, soft }) => (
            <div key={label} className="rounded-2xl border bg-card p-3.5 shadow-sm">
              <span className={`flex size-9 items-center justify-center rounded-xl ${soft} ${tone}`}>
                <Icon className="size-5" />
              </span>
              <p className={`mt-2 font-heading text-2xl leading-none font-medium ${tone}`}>{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* งานล่าสุด */}
      <section className="space-y-2">
        <SectionTitle title="งานล่าสุด" />
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
          {RECENT_JOBS.map((job) => (
            <li key={job.id} className="flex items-center gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{job.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  <span className="font-mono">{job.id}</span> · {job.branch}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] ${STATUS_STYLE[job.tone]}`}>
                {job.status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="pb-2 text-center text-xs text-muted-foreground">
        ข้อมูลงานและตัวเลขข้างบนเป็นตัวอย่าง จะเชื่อมข้อมูลจริงเมื่อระบบงานซ่อมพร้อม
      </p>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <h2 className="text-sm font-medium">{title}</h2>
      <Badge variant="outline" className="text-[10px]">
        ตัวอย่าง
      </Badge>
    </div>
  );
}

/** การ์ดทางลัดสำหรับ admin: จำนวนที่รออนุมัติ (ข้อมูลจริง) */
function AdminShortcut() {
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    api
      .getUserCounts()
      .then((c) => setPending(c.pending ?? 0))
      .catch(() => setPending(null));
  }, []);

  return (
    <Link
      href="/admin/users"
      className="flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4"
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-card text-warning">
        {pending ? <UsersIcon className="size-5" /> : <ClipboardCheckIcon className="size-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">
          {pending === null ? "อนุมัติผู้ใช้" : pending > 0 ? `มี ${pending} คนรออนุมัติ` : "ไม่มีผู้ใช้รออนุมัติ"}
        </span>
        <span className="block text-xs text-muted-foreground">ผู้ดูแลระบบ · ตรวจสอบคำขอลงทะเบียน</span>
      </span>
      <ChevronRightIcon className="size-5 text-muted-foreground" />
    </Link>
  );
}

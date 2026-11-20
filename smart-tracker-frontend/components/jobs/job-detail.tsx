"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  MapPinIcon,
  PhoneIcon,
  UserIcon,
  WrenchIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { type JobAttatch, type JobDetail, type JobHistoryRelation, type JobTimelineEvent } from "@/lib/api";
import { JobActions } from "./job-actions";
import { JobChat } from "./job-chat";
import { JobPhotos } from "./job-photos";
import { STATUS_TONE, TONES } from "./job-list";
import { useJob } from "./use-job";

/** ขั้นตอนของงาน (ตรงกับแถบสถานะใน Figma) — statuses คือรหัสสถานะ (Job_Status) ที่อยู่ในขั้นนั้น */
const STEPS = [
  // kind = ชนิดรูปของขั้นนี้ (แจ้งงาน = รูปจาก OPS, ขั้นอื่นอัปโหลดจากระบบเรา)
  { label: "แจ้งงาน", title: "แจ้งงานผู้รับเหมา", statuses: [2], kind: "report" },
  { label: "รับงาน", title: "ยืนยันรับงาน", statuses: [3], kind: "accepted" },
  { label: "ดำเนินการ", title: "กำลังดำเนินการ", statuses: [4, 5], kind: "progress" },
  { label: "ส่งงาน", title: "ส่งงาน", statuses: [6, 7], kind: "completed" },
] as const;

const STATUS_COMPLETED = 7;
const STATUS_CANCELLED = 9;

/** ขั้นปัจจุบัน (0–3); STEPS.length = เสร็จครบทุกขั้น; -1 = ยกเลิก */
function currentStep(statusId: number): number {
  if (statusId === STATUS_CANCELLED) return -1;
  if (statusId === STATUS_COMPLETED) return STEPS.length;
  const i = STEPS.findIndex((s) => (s.statuses as readonly number[]).includes(statusId));
  return i === -1 ? 0 : i;
}

const dateTimeFormat = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC", // เวลาในฐานข้อมูลเป็นเวลาท้องถิ่น ไม่มี timezone — แสดงตามค่าที่เก็บ
});

const dateOnlyFormat = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

/** SLA เป็นชั่วโมง → ข้อความ (หารด้วย 24 ลงตัวตั้งแต่ 2 วันขึ้นไปแสดงเป็นวัน) */
function formatSla(hours: number) {
  return hours >= 48 && hours % 24 === 0 ? `${hours / 24} วัน` : `${hours} ชั่วโมง`;
}

/** เวลาที่เหลือ/เกิน SLA เป็นข้อความ เช่น "2 ชม. 15 นาที" */
function formatDuration(ms: number) {
  const totalMin = Math.floor(Math.abs(ms) / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const minutes = totalMin % 60;
  const parts = [];
  if (days > 0) parts.push(`${days} วัน`);
  if (hours > 0) parts.push(`${hours} ชม.`);
  if (days === 0) parts.push(`${minutes} นาที`);
  return parts.join(" ");
}

/** หน้าติดตามสถานะงาน (ผู้รับเหมา/หัวหน้า/ผู้รับเหมาช่วง) */
export function JobDetailView({ id }: { id: string }) {
  const { gate, job, setJob, error, reload } = useJob(id);

  if (gate.name === "loading") {
    return <p className="p-8 text-center text-sm text-muted-foreground">กำลังโหลด…</p>;
  }
  if (gate.name === "error") {
    return <p className="p-8 text-center text-sm text-danger">{gate.message}</p>;
  }
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <p className="text-sm text-danger">{error}</p>
        <BackButton />
      </div>
    );
  }
  if (!job) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  return (
    <JobDetailBody
      job={job}
      onAttachmentsChange={(attachments) => setJob((cur) => (cur ? { ...cur, attachments } : cur))}
      onJobChange={setJob}
      onReload={reload}
    />
  );
}

function BackButton() {
  return (
    <Button variant="outline" className="h-12 w-full rounded-xl" nativeButton={false} render={<Link href="/jobs" />}>
      ย้อนกลับ
    </Button>
  );
}

export function JobDetailBody({
  job,
  onAttachmentsChange,
  onJobChange,
  onReload,
}: {
  job: JobDetail;
  onAttachmentsChange: (next: JobAttatch[]) => void;
  /** เปลี่ยนสถานะสำเร็จ ได้รายละเอียดงานล่าสุด */
  onJobChange: (job: JobDetail) => void;
  onReload: () => void;
}) {
  const [fullOpen, setFullOpen] = useState(false);
  const [now] = useState(() => Date.now());
  const step = currentStep(job.statusId);
  const cancelled = step === -1;
  const tone = TONES[STATUS_TONE[job.statusCode] ?? "muted"];
  const location = job.address ?? job.branchName ?? job.branchCode;

  // SLA: เวลาแจ้งงานในฐานข้อมูลเป็นเวลาท้องถิ่น (อ่านเป็น UTC) จึงเทียบกับเวลาปัจจุบันของเครื่องในกรอบเดียวกัน
  const sla = job.priority?.slaHours ?? null;
  const showSla = sla !== null && !job.closed;
  const remainingMs = showSla
    ? new Date(job.opsRequestedAt ?? job.requestedAt).getTime() + sla * 3600_000 - (now - new Date().getTimezoneOffset() * 60_000)
    : 0;

  return (
    <div className="space-y-4 p-4">
      {/* หัวงาน */}
      <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div>
          <p className="text-xs text-muted-foreground">
            {job.opsJobCode ? `${job.opsJobCode} · ` : ""}
            <span className="font-mono">[{job.jobCode}]</span>
          </p>
          <h2 className="font-heading text-lg leading-snug font-medium">{job.jobType ?? "งานซ่อม"}</h2>
        </div>
        <dl className="space-y-2 border-t pt-3 text-sm text-muted-foreground">
          <InfoRow icon={<UserIcon className="size-4" />}>
            ผู้แจ้ง: {job.reporterName ?? "—"}
            {job.branchName ? ` (${job.branchName})` : ""}
          </InfoRow>
          {job.reporterPhone && (
            <InfoRow icon={<PhoneIcon className="size-4" />}>{job.reporterPhone}</InfoRow>
          )}
          {location && <InfoRow icon={<MapPinIcon className="size-4" />}>{location}</InfoRow>}
        </dl>
        <button
          type="button"
          onClick={() => setFullOpen(true)}
          className="flex items-center gap-0.5 text-sm font-medium text-brand"
        >
          ดูรายละเอียดงานฉบับเต็ม
          <ChevronRightIcon className="size-4" />
        </button>
      </section>

      {/* แถบขั้นตอน */}
      {cancelled ? (
        <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          <AlertTriangleIcon className="size-4 shrink-0" />
          งานนี้ถูกยกเลิกแล้ว
        </div>
      ) : (
        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">สถานะการดำเนินการ</h3>
          <Stepper step={step} />
        </section>
      )}

      {/* ประวัติโดยละเอียด */}
      <section className="space-y-3">
        <h3 className="px-1 text-sm font-medium text-muted-foreground">ประวัติการดำเนินการโดยละเอียด</h3>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <Timeline job={job} step={step} onAttachmentsChange={onAttachmentsChange} />
        </div>
      </section>

      {/* สถานะปัจจุบัน + SLA */}
      <section className={`space-y-1.5 rounded-2xl p-4 ${tone.chip}`}>
        <p className="text-sm font-medium">สถานะปัจจุบัน</p>
        <p className="font-heading text-2xl font-semibold">{job.statusName}</p>
        {showSla && (
          <p className="flex items-center gap-1.5 text-sm">
            <ClockIcon className="size-4" />
            {remainingMs >= 0
              ? `SLA เหลือ ${formatDuration(remainingMs)}`
              : `เกิน SLA แล้ว ${formatDuration(remainingMs)}`}
          </p>
        )}
        {job.priority && (job.priority.name || job.priority.slaHours !== null) && (
          <p className="text-xs opacity-80">
            {[job.priority.name, job.priority.slaHours !== null ? `SLA ${formatSla(job.priority.slaHours)}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </section>

      <JobChat jobId={job.id} />

      <JobActions job={job} onChanged={onJobChange} onReload={onReload} />

      <BackButton />

      <FullDetailDialog job={job} open={fullOpen} onOpenChange={setFullOpen} />
    </div>
  );
}

function InfoRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

/** แถบ 4 ขั้น: ✓ = ผ่านแล้ว, เลข = ขั้นปัจจุบัน, วงว่าง = ยังไม่ถึง */
function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-start">
      {STEPS.map((s, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <li key={s.label} className="relative flex flex-1 flex-col items-center gap-1.5">
            {i > 0 && (
              <span
                aria-hidden
                className={`absolute top-3.5 right-1/2 h-0.5 w-full -translate-y-1/2 ${
                  i <= step ? (i === step ? "bg-warning" : "bg-success") : "bg-border"
                }`}
              />
            )}
            <span
              className={`relative z-10 grid size-7 place-items-center rounded-full border-2 text-xs font-semibold ${
                done
                  ? "border-success bg-success text-white"
                  : current
                    ? "border-warning bg-warning text-white"
                    : "border-border bg-card text-muted-foreground"
              }`}
            >
              {done ? <CheckIcon className="size-4" /> : current ? i + 1 : ""}
            </span>
            <span className={`text-xs ${current ? "font-medium text-warning" : "text-muted-foreground"}`}>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** ประวัติแต่ละขั้น: ผู้ทำ + เวลา (จาก Jobs_Logs) ขั้นที่ยังไม่ถึงแสดงว่ายังไม่ถึง */
function Timeline({
  job,
  step,
  onAttachmentsChange,
}: {
  job: JobDetail;
  step: number;
  onAttachmentsChange: (next: JobAttatch[]) => void;
}) {
  return (
    <ol className="space-y-5">
      {STEPS.map((s, i) => {
        const done = i < step;
        const current = i === step;
        const event = lastEvent(job.timeline, s.statuses);
        // งานที่นำเข้าก่อนมีประวัติ: ขั้นแรกใช้เวลาแจ้งงานแทน
        const at = event?.at ?? (i === 0 ? job.requestedAt : null);

        return (
          <li key={s.label} className="flex gap-3">
            <span
              className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 ${
                done
                  ? "border-success bg-success text-white"
                  : current
                    ? "border-warning bg-warning text-white"
                    : "border-border bg-card"
              }`}
            >
              {done && <CheckIcon className="size-3.5" />}
              {current && <WrenchIcon className="size-3" />}
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className={`text-sm font-medium ${!done && !current ? "text-muted-foreground" : ""}`}>
                {s.title}
              </p>
              {done || current ? (
                <>
                  {(event?.actorName || at) && (
                    <p className="text-xs text-muted-foreground">
                      {event?.actorName && `${ACTOR_PREFIX[event.statusId] ?? "โดย"} ${event.actorName}`}
                      {event?.actorName && at ? " · " : ""}
                      {at && dateTimeFormat.format(new Date(at))}
                    </p>
                  )}
                  {event?.note && (
                    <p className="mt-1.5 rounded-lg bg-muted px-3 py-2 text-xs">หมายเหตุ: {event.note}</p>
                  )}
                  {s.kind === "completed" && (job.repairedAt || job.repairDetails) && (
                    <div className="mt-1.5 space-y-1 rounded-lg bg-muted px-3 py-2 text-xs">
                      {job.repairedAt && <p>ซ่อมเสร็จเมื่อ {dateTimeFormat.format(new Date(job.repairedAt))}</p>}
                      {job.repairDetails && <p className="whitespace-pre-line">รายละเอียดการซ่อม: {job.repairDetails}</p>}
                    </div>
                  )}
                  <JobPhotos
                    jobId={job.id}
                    kind={s.kind}
                    stepTitle={s.title}
                    attachments={job.attachments}
                    uploadable={s.kind !== "report" && job.uploadableKinds.includes(s.kind)}
                    onChange={onAttachmentsChange}
                  />
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">ยังไม่ถึงขั้นตอนนี้</p>
                  {s.kind !== "report" && (
                    <p className="mt-2.5 text-xs text-muted-foreground">แนบรูปได้เมื่อถึงขั้นตอนนี้</p>
                  )}
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** คำนำหน้าชื่อผู้ทำ ตามสถานะที่งานเปลี่ยนไปเป็น — ให้อ่านแล้วรู้ว่าคนนี้ทำอะไร ไม่ใช่แค่ชื่อเฉย ๆ */
const ACTOR_PREFIX: Record<number, string> = {
  2: "ส่งให้ผู้รับเหมาโดย",
  3: "รับงานโดย",
  4: "ดำเนินการโดย",
  5: "แจ้งรออะไหล่โดย",
  6: "ส่งงานโดย",
  7: "ปิดงานโดย",
};

function lastEvent(timeline: JobTimelineEvent[], statuses: readonly number[]) {
  return [...timeline].reverse().find((e) => statuses.includes(e.statusId));
}

/** หน้าต่างรายละเอียดงานฉบับเต็ม */
function FullDetailDialog({
  job,
  open,
  onOpenChange,
}: {
  job: JobDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const tone = TONES[STATUS_TONE[job.statusCode] ?? "muted"];
  const device = [job.brand, job.model].filter(Boolean).join(" ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogDescription className="font-mono text-xs">
            {job.opsJobCode ? `${job.opsJobCode} · ` : ""}
            {job.jobCode}
          </DialogDescription>
          <DialogTitle className="text-left">{job.jobType ?? "งานซ่อม"}</DialogTitle>
          <span
            className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tone.chip}`}
          >
            <span className="size-1.5 rounded-full bg-current" />
            {job.statusName}
          </span>
        </DialogHeader>

        <dl className="space-y-3 text-sm">
          <Field label="ผู้แจ้งซ่อม" value={job.reporterName} />
          <Field label="เบอร์ติดต่อ" value={job.reporterPhone} />
          <Field label="สถานที่แจ้งซ่อม" value={job.address ?? job.branchName ?? job.branchCode} />
          <Field label="ประเภทงาน" value={job.jobType} />
          <Field
            label="ระดับความสำคัญ"
            value={
              job.priority
                ? [job.priority.name, job.priority.slaHours !== null ? `SLA ${formatSla(job.priority.slaHours)}` : null]
                    .filter(Boolean)
                    .join(" · ") || null
                : null
            }
          />
          {device && <Field label="อุปกรณ์" value={device} />}
          <Field
            label="คีย์โดย"
            value={
              job.keyedByName
                ? `${job.keyedByName} (OPS) · ${dateTimeFormat.format(new Date(job.opsRequestedAt ?? job.requestedAt))}`
                : null
            }
          />
          <div className="space-y-1.5 border-t pt-3">
            <dt className="text-xs font-medium text-muted-foreground">รายละเอียดปัญหาที่แจ้ง</dt>
            <dd className="rounded-lg bg-muted px-3 py-2.5 leading-relaxed whitespace-pre-line">
              {job.details ?? "—"}
            </dd>
          </div>
          {HISTORY_GROUPS.map(({ relation, title, hint }) => {
            const items = job.history.filter((h) => h.relation === relation);
            if (items.length === 0) return null;
            return (
              <div key={relation} className="space-y-1.5 border-t pt-3">
                <dt className="text-xs font-medium text-muted-foreground">
                  {title}
                  <span className="ml-1.5 font-normal">· {hint}</span>
                </dt>
                <dd>
                  <ul className="divide-y">
                    {items.map((h) => {
                      const t = TONES[STATUS_TONE[h.statusCode] ?? "muted"];
                      return (
                        <li key={h.id}>
                          <Link
                            href={`/jobs/${h.id}`}
                            className="flex items-center justify-between gap-3 py-2 hover:text-brand"
                          >
                            <span className="min-w-0">
                              <span className="block truncate">
                                {h.opsJobCode ?? h.jobCode} · {h.jobType ?? "งานซ่อม"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {dateOnlyFormat.format(new Date(h.requestedAt))}
                              </span>
                            </span>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${t.chip}`}
                            >
                              {h.statusName}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </dd>
              </div>
            );
          })}
        </dl>
      </DialogContent>
    </Dialog>
  );
}

const HISTORY_GROUPS: {
  relation: JobHistoryRelation;
  title: string;
  hint: string;
}[] = [
  { relation: "same_job", title: "ประวัติของใบนี้", hint: "OPS ส่งมาแล้วหลายครั้ง" },
  { relation: "same_type", title: "งานประเภทเดียวกันในสาขานี้", hint: "ซ่อมซ้ำ/อุปกรณ์เดิม" },
  { relation: "same_branch", title: "งานอื่นของสาขานี้", hint: "ล่าสุด" },
];

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="space-y-0.5 border-b pb-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value ?? "—"}</dd>
    </div>
  );
}

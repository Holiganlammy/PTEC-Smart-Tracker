"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangleIcon,
  ChevronRightIcon,
  ClockIcon,
  MapPinIcon,
  PhoneIcon,
  RotateCcwIcon,
  UserIcon,
  UserPlusIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReassignDialog } from "@/components/admin/reassign-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RoleId,
  type JobAttatch,
  type JobDetail,
  type JobHistoryRelation,
  type JobTeamMember,
} from "@/lib/api";
import { JobActions } from "./job-actions";
import { JobChat } from "./job-chat";
import { JobFiles } from "./job-files";
import { STATUS_TONE, TONES } from "./job-list";
import { currentStep, formatDuration, Stepper, Timeline } from "./job-timeline";
import { SubJobsCard } from "./job-subjobs";
import { dueRemainingMs as subDueRemainingMs, formatSubDue, subStatusOf } from "./sub-job-format";
import { useJob } from "./use-job";

const STATUS_REJECTED = 10;

/** สถานะที่แอดมินย้ายงานไปให้บริษัทอื่นได้ (ตรงกับฝั่ง backend: ก่อนส่งมอบ + งานที่ถูกปฏิเสธ) */
const REASSIGNABLE_STATUSES = [2, 3, 4, 5, STATUS_REJECTED];

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
export function formatSla(hours: number) {
  return hours >= 48 && hours % 24 === 0 ? `${hours / 24} วัน` : `${hours} ชั่วโมง`;
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
      isAdmin={gate.me.roleId === RoleId.ADMIN}
      onAttachmentsChange={(attachments) => setJob((cur) => (cur ? { ...cur, attachments } : cur))}
      onJobChange={setJob}
      onReload={reload}
    />
  );
}

/** กลับหน้าก่อนหน้า (ผู้รับเหมามาจากรายการงาน แอดมินมาจากหน้าจัดการงาน) — ถ้าเปิดลิงก์ตรง ๆ ไปรายการงาน */
function BackButton() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      className="h-12 w-full rounded-xl"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/jobs"))}
    >
      ย้อนกลับ
    </Button>
  );
}

export function JobDetailBody({
  job,
  isAdmin,
  onAttachmentsChange,
  onJobChange,
  onReload,
}: {
  job: JobDetail;
  /** แอดมินเปิดดูงานของบริษัทใดก็ได้ (ดู/พิมพ์แชท/ย้ายบริษัท แต่เปลี่ยนสถานะงานไม่ได้) */
  isAdmin: boolean;
  onAttachmentsChange: (next: JobAttatch[]) => void;
  /** เปลี่ยนสถานะสำเร็จ ได้รายละเอียดงานล่าสุด */
  onJobChange: (job: JobDetail) => void;
  onReload: () => void;
}) {
  const [fullOpen, setFullOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [now] = useState(() => Date.now());
  const step = currentStep(job);
  const cancelled = step === -1;
  const rejected = job.statusId === STATUS_REJECTED;
  const rejection = rejected ? [...job.timeline].reverse().find((e) => e.statusId === STATUS_REJECTED) : undefined;
  // งานที่ถูกตีกลับให้แก้ไข: สถานะยังเป็นกำลังดำเนินการ แต่แสดงเป็น "กำลังแก้ไข" (สีแดง)
  const reworkStatus = job.rework ? subStatusOf(job.statusCode, job.statusName, true) : null;
  const tone = TONES[reworkStatus?.tone ?? STATUS_TONE[job.statusCode] ?? "muted"];
  const location = job.address ?? job.branchName ?? job.branchCode;

  // SLA: เวลาแจ้งงานในฐานข้อมูลเป็นเวลาท้องถิ่น (อ่านเป็น UTC) จึงเทียบกับเวลาปัจจุบันของเครื่องในกรอบเดียวกัน
  const sla = job.priority?.slaHours ?? null;
  const showSla = sla !== null && !job.closed && !rejected;
  const remainingMs = showSla
    ? new Date(job.opsRequestedAt ?? job.requestedAt).getTime() + sla * 3600_000 - (now - new Date().getTimezoneOffset() * 60_000)
    : 0;

  const origin = job.subJobOrigin;

  // งานย่อย: ไม่มี SLA ของตัวเอง — นับถอยหลังถึงกำหนดเสร็จที่ผู้มอบหมายตั้ง (วันที่ + เวลา; งานเก่าไม่มีเวลา = 18:00)
  const subDueDate = origin?.dueDate ?? null;
  const showDue = subDueDate !== null && !job.closed && !rejected && !cancelled;
  const dueRemainingMs = showDue ? subDueRemainingMs(subDueDate, origin?.dueTime, now) : 0;

  return (
    <div className="space-y-4 p-4">
      {/* งานย่อย: ใครมอบหมายต่อมาให้ (Figma: มุมมองของผู้รับเหมาช่วง) */}
      {origin && (
        <section className="flex items-start gap-2.5 rounded-2xl bg-success-soft p-3.5 text-sm text-success">
          <UserPlusIcon className="mt-0.5 size-4 shrink-0" />
          <p className="min-w-0 leading-relaxed">
            งานย่อยของ {origin.parentOpsJobCode ?? origin.parentJobCode}
            {origin.parentVenderName && <> · รับช่วงจาก {origin.parentVenderName}</>}
            {origin.assignedByName && <span className="block text-xs opacity-80">มอบหมายโดย {origin.assignedByName}</span>}
            {origin.dueDate && (
              <span className="block text-xs opacity-80">กำหนดเสร็จ {formatSubDue(origin.dueDate, origin.dueTime)}</span>
            )}
          </p>
        </section>
      )}

      {/* งานย่อยที่ถูกหัวหน้าของผู้รับเหมาหลักตีกลับ: บอกสิ่งที่ต้องแก้ไว้บนสุด */}
      {job.rework && (
        <section className="space-y-2 rounded-2xl bg-danger/10 p-4 text-danger">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <RotateCcwIcon className="size-4 shrink-0" />
            ผู้รับเหมาหลักตีกลับให้แก้ไข{job.rework.count > 1 ? ` (ครั้งที่ ${job.rework.count})` : ""}
          </p>
          {job.rework.note && (
            <p className="rounded-lg bg-card px-3 py-2 text-sm whitespace-pre-line text-foreground">
              สิ่งที่ต้องแก้ไข: {job.rework.note}
            </p>
          )}
          <p className="text-xs opacity-80">
            {[job.rework.byName, dateTimeFormat.format(new Date(job.rework.at))].filter(Boolean).join(" · ")}
          </p>
          <p className="text-xs">แก้ไขให้เรียบร้อย แล้วกด “ส่งงานที่แก้ไขแล้ว” พร้อมแนบรูปหลังแก้ไขใหม่</p>
        </section>
      )}

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
          {/* งานย่อยก็แสดงผู้แจ้ง/เบอร์ (คัดลอกมาจากงานแม่ตอนมอบหมาย) เพื่อให้รายย่อยประสานสาขาได้ */}
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

      {/* ขอบเขตงานที่ได้รับมอบหมาย (เฉพาะงานย่อย: ขอบเขตอยู่ในรายละเอียดงาน หมายเหตุจากผู้รับเหมาหลักอยู่ในประวัติ) */}
      {origin && (
        <section className="space-y-2.5 rounded-2xl border bg-card p-4 shadow-sm">
          <h3 className="font-heading text-base font-medium">ขอบเขตงานที่ได้รับมอบหมาย</h3>
          <p className="rounded-xl bg-muted px-3 py-2.5 text-sm leading-relaxed whitespace-pre-line">
            {job.details ?? "—"}
          </p>
          {origin.note && (
            <p className="flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2.5 text-xs whitespace-pre-line text-warning">
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
              <span>หมายเหตุจากผู้รับเหมาหลัก: {origin.note}</span>
            </p>
          )}
        </section>
      )}

      {/* แถบขั้นตอน */}
      {cancelled ? (
        <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          <AlertTriangleIcon className="size-4 shrink-0" />
          งานนี้ถูกยกเลิกแล้ว
        </div>
      ) : rejected ? (
        <section className="space-y-2 rounded-2xl bg-danger/10 p-4 text-danger">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <AlertTriangleIcon className="size-4 shrink-0" />
            {isAdmin ? "บริษัทนี้ปฏิเสธงาน" : "งานนี้ถูกปฏิเสธแล้ว"}
          </p>
          <p className="text-xs">
            {origin
              ? "งานย่อยนี้ถูกตัดออกจากงานของผู้รับเหมาหลักแล้ว ผู้รับเหมาหลักจะมอบหมายให้บริษัทอื่นเองถ้ายังต้องการ"
              : isAdmin
                ? "เปลี่ยนบริษัทเพื่อจ่ายงานให้บริษัทอื่น"
                : "รอแอดมินจ่ายงานให้บริษัทอื่น งานจะหายจากรายการของคุณเมื่อแอดมินย้ายบริษัทแล้ว"}
          </p>
          {rejection?.note && (
            <p className="rounded-lg bg-card px-3 py-2 text-sm whitespace-pre-line text-foreground">
              เหตุผล: {rejection.note}
            </p>
          )}
          {rejection && (
            <p className="text-xs opacity-80">
              {[rejection.actorName, dateTimeFormat.format(new Date(rejection.at))].filter(Boolean).join(" · ")}
            </p>
          )}
        </section>
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

      {/* มอบหมายงานผู้รับเหมา (งานย่อย) — ตำแหน่งตาม Figma: ต่อจากประวัติการดำเนินการ */}
      <SubJobsCard job={job} onChanged={onJobChange} onReload={onReload} />

      {/* สถานะปัจจุบัน + SLA */}
      <section className={`space-y-1.5 rounded-2xl p-4 ${tone.chip}`}>
        <p className="text-sm font-medium">สถานะปัจจุบัน</p>
        <p className="font-heading text-2xl font-semibold">{reworkStatus?.label ?? job.statusName}</p>
        {showSla && (
          <p className="flex items-center gap-1.5 text-sm">
            <ClockIcon className="size-4" />
            {remainingMs >= 0
              ? `SLA เหลือ ${formatDuration(remainingMs)}`
              : `เกิน SLA แล้ว ${formatDuration(remainingMs)}`}
          </p>
        )}
        {showDue && (
          <p className="flex items-center gap-1.5 text-sm">
            <ClockIcon className="size-4" />
            {dueRemainingMs >= 0
              ? `เหลือ ${formatDuration(dueRemainingMs)} ถึงกำหนดเสร็จ`
              : `เกินกำหนดเสร็จแล้ว ${formatDuration(dueRemainingMs)}`}
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

      <TeamCard team={job.team} />

      <JobFiles jobId={job.id} attachments={job.attachments} />

      <JobChat jobId={job.id} />

      <JobActions job={job} onChanged={onJobChange} onReload={onReload} />

      {/* งานย่อยย้ายบริษัทไม่ได้ (ผู้รับเหมาหลักมอบหมายใหม่เอง) — server กันซ้ำ */}
      {isAdmin && job.parentJobId === null && REASSIGNABLE_STATUSES.includes(job.statusId) && (
        <Button variant="outline" className="h-12 w-full rounded-xl" onClick={() => setReassignOpen(true)}>
          เปลี่ยนบริษัทผู้รับเหมา
        </Button>
      )}

      <BackButton />

      <FullDetailDialog job={job} open={fullOpen} onOpenChange={setFullOpen} />

      <ReassignDialog
        job={reassignOpen ? { id: job.id, jobCode: job.jobCode, jobType: job.jobType, venderCode: job.venderCode } : null}
        onClose={() => setReassignOpen(false)}
        onDone={onReload}
        onStale={onReload}
      />
    </div>
  );
}

const TEAM_ROLE_LABEL: Record<JobTeamMember["role"], string> = {
  contractor: "ผู้รับเหมา",
  head: "หัวหน้า",
  sub_contractor: "ผู้รับเหมาช่วง",
  admin: "แอดมิน",
};

/** ป้ายขวาของแต่ละแถวในทีมรับผิดชอบ */
const TEAM_BADGE: Record<JobTeamMember["kind"], { label: string; className: string }> = {
  accepted: { label: "รับงานแล้ว", className: "bg-success-soft text-success" },
  assigned: { label: "รับมอบหมาย", className: "bg-sub-accent/10 text-sub-accent" },
};

/**
 * การ์ด "ทีมรับผิดชอบ" (Figma): รายการผู้ที่รับผิดชอบงานนี้ทีละแถว — คนที่รับงาน, ผู้รับเหมาช่วงที่ถูกมอบหมาย
 * ต่อไปผู้รับเหมาช่วงต่างบริษัทก็จะต่อท้ายรายการนี้
 */
function TeamCard({ team }: { team: JobTeamMember[] }) {
  return (
    <section className="space-y-3">
      <h3 className="px-1 text-sm font-medium text-muted-foreground">ทีมรับผิดชอบ</h3>
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        {team.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีผู้รับผิดชอบ</p>
        ) : (
          <ul className="space-y-3.5">
            {team.map((m) => {
              const badge = TEAM_BADGE[m.kind];
              return (
                <li key={m.userId} className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/10 text-sm font-medium text-brand"
                  >
                    {Array.from(m.name.trim()).slice(0, 2).join("") || "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[m.companyName, TEAM_ROLE_LABEL[m.role]].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
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
          {job.subJobOrigin ? (
            <>
              {/* งานย่อย: ไม่ได้คีย์ผ่าน OPS — แสดงผู้มอบหมาย/บริษัทแม่ และกำหนดเสร็จแทน */}
              <Field
                label="มอบหมายโดย"
                value={`${[job.subJobOrigin.assignedByName, job.subJobOrigin.parentVenderName].filter(Boolean).join(" · ") || "ผู้รับเหมาหลัก"} · ${dateTimeFormat.format(new Date(job.requestedAt))}`}
              />
              <Field
                label="กำหนดเสร็จ"
                value={
                  job.subJobOrigin.dueDate ? formatSubDue(job.subJobOrigin.dueDate, job.subJobOrigin.dueTime) : null
                }
              />
            </>
          ) : (
            <Field
              label="คีย์โดย"
              value={
                job.keyedByName
                  ? `${job.keyedByName} (OPS) · ${dateTimeFormat.format(new Date(job.opsRequestedAt ?? job.requestedAt))}`
                  : null
              }
            />
          )}
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

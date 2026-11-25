"use client";

import { CheckIcon, WrenchIcon } from "lucide-react";
import type { JobAttatch, JobDetail, JobTimelineEvent } from "@/lib/api";
import { JobPhotos } from "./job-photos";

/**
 * แถบขั้นตอน + ประวัติการดำเนินการโดยละเอียดของงาน
 * ใช้ทั้งหน้ารายละเอียดงาน และ modal ประวัติงานย่อยที่ผู้รับเหมาหลักเปิดดู (แบบอ่านอย่างเดียว)
 */

/** ขั้นตอนของงาน (ตรงกับแถบสถานะใน Figma) — statuses คือรหัสสถานะ (Job_Status) ที่อยู่ในขั้นนั้น */
const STEPS = [
  // kind = ชนิดรูปของขั้นนี้ (แจ้งงาน = รูปจาก OPS, ขั้นอื่นอัปโหลดจากระบบเรา)
  { label: "แจ้งงาน", title: "แจ้งงานผู้รับเหมา", statuses: [2], kind: "report" },
  { label: "รับงาน", title: "ยืนยันรับงาน", statuses: [3], kind: "accepted" },
  { label: "ดำเนินการ", title: "กำลังดำเนินการ", statuses: [4, 5], kind: "progress" },
  { label: "ส่งงาน", title: "ส่งงาน", statuses: [6, 7], kind: "completed" },
] as const;

const STATUS_DELIVERED = 6;
const STATUS_COMPLETED = 7;
const STATUS_CANCELLED = 9;

/** หัวหน้าตีกลับงานย่อยให้แก้ไข (ส่งมอบ → กำลังดำเนินการ) */
const ACTION_REWORK = "rework";
/** ผู้รับเหมาหลักตรวจรับงานย่อยผ่าน (ส่งมอบ → ปิดงาน) */
const ACTION_INSPECTED = "inspected";

const stepOf = (statusId: number) => STEPS.findIndex((s) => (s.statuses as readonly number[]).includes(statusId));

/** ข้อมูลงานที่ไทม์ไลน์ใช้ (JobDetail หรือประวัติงานย่อยก็ได้) */
export type TimelineJob = Pick<
  JobDetail,
  "id" | "statusId" | "timeline" | "requestedAt" | "repairedAt" | "repairDetails" | "attachments"
> & {
  /** ชนิดรูปที่ผู้ใช้อัปโหลดเพิ่มได้ตอนนี้ (ไม่ส่ง = ดูอย่างเดียว) */
  uploadableKinds?: JobDetail["uploadableKinds"];
};

/** ขั้นปัจจุบัน (0–3); STEPS.length = เสร็จครบทุกขั้น; -1 = ยกเลิก */
export function currentStep(job: Pick<TimelineJob, "statusId" | "timeline">): number {
  if (job.statusId === STATUS_CANCELLED) return -1;
  if (job.statusId === STATUS_COMPLETED) return STEPS.length;
  const i = stepOf(job.statusId);
  if (i !== -1) return i;
  // สถานะนอกแถบขั้นตอน (เช่น ปฏิเสธงาน): ใช้ขั้นล่าสุดที่งานเคยไปถึง
  for (const e of [...job.timeline].reverse()) {
    const k = stepOf(e.statusId);
    if (k !== -1) return k;
  }
  return 0;
}

const dateTimeFormat = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC", // เวลาในฐานข้อมูลเป็นเวลาท้องถิ่น ไม่มี timezone — แสดงตามค่าที่เก็บ
});

/** เวลาที่เหลือ/เกิน SLA เป็นข้อความ เช่น "2 ชม. 15 นาที" */
export function formatDuration(ms: number) {
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

/** แถบ 4 ขั้น: ✓ = ผ่านแล้ว, เลข = ขั้นปัจจุบัน, วงว่าง = ยังไม่ถึง */
export function Stepper({ step }: { step: number }) {
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

/**
 * ประวัติแต่ละขั้น: ผู้ทำ + เวลา (จาก Jobs_Logs) + รูปของขั้นนั้น ขั้นที่ยังไม่ถึงแสดงว่ายังไม่ถึง
 * readOnly = ดูอย่างเดียว (ไม่มีกล่องแนบรูป/ข้อความชวนแนบรูป)
 */
export function Timeline({
  job,
  step,
  readOnly = false,
  onAttachmentsChange = () => {},
}: {
  job: TimelineJob;
  step: number;
  readOnly?: boolean;
  onAttachmentsChange?: (next: JobAttatch[]) => void;
}) {
  const uploadableKinds = readOnly ? [] : (job.uploadableKinds ?? []);
  return (
    <ol className="space-y-5">
      {STEPS.map((s, i) => {
        const done = i < step;
        const current = i === step;
        // ขั้นส่งงาน: บรรทัดหลักคือการส่งงาน ส่วนการปิดงาน/ตรวจรับแสดงแยกเป็นผลการตรวจด้านล่าง
        const event = lastEvent(job.timeline, s.kind === "completed" ? [STATUS_DELIVERED] : s.statuses);
        const closeEvent = s.kind === "completed" ? lastEvent(job.timeline, [STATUS_COMPLETED]) : undefined;
        // ขั้นดำเนินการ: ทุกครั้งที่ถูกตีกลับให้แก้ไข
        const reworks = s.kind === "progress" ? job.timeline.filter((e) => e.action === ACTION_REWORK) : [];
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
                  {reworks.map((r, n) => (
                    <div key={r.id} className="mt-1.5 space-y-0.5 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
                      <p className="font-medium">ตีกลับให้แก้ไข ครั้งที่ {n + 1}</p>
                      <p className="opacity-80">
                        {[r.actorName && `โดย ${r.actorName}`, dateTimeFormat.format(new Date(r.at))]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {r.note && <p className="whitespace-pre-line text-foreground">สิ่งที่ต้องแก้ไข: {r.note}</p>}
                    </div>
                  ))}
                  {s.kind === "completed" && (job.repairedAt || job.repairDetails) && (
                    <div className="mt-1.5 space-y-1 rounded-lg bg-muted px-3 py-2 text-xs">
                      {job.repairedAt && <p>ซ่อมเสร็จเมื่อ {dateTimeFormat.format(new Date(job.repairedAt))}</p>}
                      {job.repairDetails && <p className="whitespace-pre-line">รายละเอียดการซ่อม: {job.repairDetails}</p>}
                    </div>
                  )}
                  {closeEvent && (
                    <div
                      className={`mt-1.5 space-y-0.5 rounded-lg px-3 py-2 text-xs ${
                        closeEvent.action === ACTION_INSPECTED ? "bg-success-soft text-success" : "bg-muted"
                      }`}
                    >
                      <p className="font-medium">
                        {closeEvent.action === ACTION_INSPECTED ? "ตรวจรับผ่าน" : "ปิดงาน"}
                        {closeEvent.actorName && ` โดย ${closeEvent.actorName}`}
                      </p>
                      <p className="opacity-80">{dateTimeFormat.format(new Date(closeEvent.at))}</p>
                      {closeEvent.note && <p className="whitespace-pre-line text-foreground">หมายเหตุ: {closeEvent.note}</p>}
                    </div>
                  )}
                  <JobPhotos
                    jobId={job.id}
                    kind={s.kind}
                    stepTitle={s.title}
                    attachments={job.attachments}
                    uploadable={s.kind !== "report" && uploadableKinds.includes(s.kind)}
                    onChange={onAttachmentsChange}
                  />
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">ยังไม่ถึงขั้นตอนนี้</p>
                  {s.kind !== "report" && !readOnly && (
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
};

/** เหตุการณ์ล่าสุดที่งานเปลี่ยนไปเป็นสถานะเหล่านี้ (ไม่นับการตีกลับให้แก้ไข ซึ่งแสดงแยก) */
function lastEvent(timeline: JobTimelineEvent[], statuses: readonly number[]) {
  return [...timeline].reverse().find((e) => e.action !== ACTION_REWORK && statuses.includes(e.statusId));
}

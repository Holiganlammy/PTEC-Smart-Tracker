"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangleIcon,
  BuildingIcon,
  ClipboardListIcon,
  MapPinIcon,
  PenLineIcon,
  SendIcon,
  Undo2Icon,
  UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type JobDetail, type ReviewJob } from "@/lib/api";
import { formatSla } from "@/components/jobs/job-detail";
import { JobFiles } from "@/components/jobs/job-files";
import { STATUS_TONE, TONES } from "@/components/jobs/job-list";

const dateTimeFormat = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC", // เวลาในฐานข้อมูลเป็นเวลาท้องถิ่น ไม่มี timezone — แสดงตามค่าที่เก็บ
});

type Props = {
  /** งานที่กำลังตรวจ (null = ปิด modal) */
  job: ReviewJob | null;
  /** กำลังทำรายการกับงานนี้ (ปิดปุ่มทั้งหมดกันกดซ้ำ) */
  busy: boolean;
  onClose: () => void;
  onApprove: (job: ReviewJob) => void;
  onEdit: (job: ReviewJob) => void;
  onReturn: (job: ReviewJob) => void;
};

/**
 * modal ตรวจงานจาก OPS ของแอดมิน (Figma: iPhone 14 Page 15) — แตะการ์ดในคิวแล้วเปิด
 * แสดงข้อมูลงานครบ + ไฟล์แนบจาก OPS + จุดที่ระบบเตือน แล้วตัดสินใจ: อนุมัติ / แก้ไขข้อมูล / ตีกลับ
 * (ตีกลับไม่มีใน Figma แต่ flow ของเราต้องใช้ จึงเป็นปุ่มรอง)
 */
export function JobReviewDialog({ job, busy, onClose, onApprove, onEdit, onReturn }: Props) {
  return (
    <Dialog open={job !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        {/* key = เปลี่ยนงาน → โหลดรายละเอียดของงานนั้นใหม่ */}
        {job && (
          <ReviewBody key={job.id} job={job} busy={busy} onApprove={onApprove} onEdit={onEdit} onReturn={onReturn} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReviewBody({
  job,
  busy,
  onApprove,
  onEdit,
  onReturn,
}: Omit<Props, "job" | "onClose"> & { job: ReviewJob }) {
  // ข้อมูลที่ไม่อยู่ในการ์ดคิว (ความสำคัญ/SLA, คีย์โดย, ไฟล์แนบ) ดึงจากรายละเอียดงาน
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getJob(job.id)
      .then((d) => !cancelled && setDetail(d))
      .catch((e: unknown) => !cancelled && setLoadError(e instanceof Error ? e.message : "โหลดรายละเอียดไม่สำเร็จ"));
    return () => {
      cancelled = true;
    };
  }, [job.id]);

  const tone = TONES[STATUS_TONE[job.statusCode] ?? "muted"];
  const branch = job.branchName ?? job.branchCode;
  const device = [job.brand, job.model].filter(Boolean).join(" ");
  const phoneDigits = (job.reporterPhone ?? "").replace(/\D/g, "");
  const phoneProblem = phoneDigits.length === 0 ? "ไม่มีเบอร์โทรผู้แจ้ง" : phoneDigits.length !== 10 ? "เบอร์โทรผู้แจ้งไม่ครบ 10 หลัก" : null;

  const priority = detail?.priority
    ? [detail.priority.name, detail.priority.slaHours !== null ? `SLA ${formatSla(detail.priority.slaHours)}` : null]
        .filter(Boolean)
        .join(" · ")
    : null;
  const keyedBy = detail
    ? [detail.keyedByName, detail.opsRequestedAt ? dateTimeFormat.format(new Date(detail.opsRequestedAt)) : null]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <>
      <DialogHeader className="pr-8">
        <DialogDescription className="text-left font-mono text-xs">
          {job.opsJobCode ? `${job.opsJobCode} · ` : ""}
          {job.jobCode}
        </DialogDescription>
        <DialogTitle className="text-left text-lg leading-snug">{job.jobType ?? "งานซ่อม"}</DialogTitle>
        <span
          className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tone.chip}`}
        >
          <span className="size-1.5 rounded-full bg-current" />
          {job.statusName}
        </span>
      </DialogHeader>

      <dl className="divide-y border-y text-sm">
        <Row icon={<UserIcon className="size-4" />} label="ผู้แจ้ง">
          {[job.reporterName, branch, job.reporterPhone ? `โทร ${job.reporterPhone}` : null].filter(Boolean).join(" · ") || "—"}
        </Row>
        <Row icon={<MapPinIcon className="size-4" />} label="สถานที่">
          {job.address ?? branch ?? "—"}
        </Row>
        <Row icon={<ClipboardListIcon className="size-4" />} label="ประเภท · ความเร่งด่วน">
          {[job.jobType, detail ? priority : null].filter(Boolean).join(" · ") || "—"}
          {!detail && !loadError && <Skeleton className="mt-1 h-4 w-28" />}
        </Row>
        <Row icon={<BuildingIcon className="size-4" />} label="ผู้รับเหมาที่ OPS เลือก">
          {job.venderName ?? job.venderCode}
        </Row>
        <Row icon={<PenLineIcon className="size-4" />} label="คีย์โดย">
          {detail ? keyedBy || "—" : loadError ? "—" : <Skeleton className="h-4 w-40" />}
        </Row>
      </dl>

      <section className="space-y-1.5">
        <h4 className="text-xs font-medium text-muted-foreground">รายละเอียดปัญหา</h4>
        <p className="rounded-xl bg-muted px-3 py-2.5 text-sm leading-relaxed whitespace-pre-line">
          {job.details ?? "—"}
          {device && <span className="mt-1.5 block text-xs text-muted-foreground">เครื่อง: {device}</span>}
        </p>
      </section>

      {detail ? (
        <JobFiles jobId={job.id} attachments={detail.attachments} />
      ) : loadError ? (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">ดูไฟล์แนบไม่ได้: {loadError}</p>
      ) : (
        <Skeleton className="h-24 rounded-2xl" />
      )}

      {phoneProblem && (
        <div className="space-y-0.5 rounded-xl bg-warning/10 px-3 py-2.5 text-warning">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <AlertTriangleIcon className="size-4 shrink-0" />
            ระบบตรวจเบื้องต้นพบ 1 จุดที่ควรดู
          </p>
          <p className="pl-[22px] text-xs">{phoneProblem}</p>
        </div>
      )}

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button
            className="h-11 gap-1.5 rounded-xl bg-success px-2 text-[13px] text-white hover:bg-success/90"
            disabled={busy}
            onClick={() => onApprove(job)}
          >
            <SendIcon className="size-4 shrink-0" />
            อนุมัติและส่งให้ผู้รับเหมา
          </Button>
          <Button
            className="h-11 rounded-xl bg-brand px-2 text-[13px] text-white hover:bg-brand/90"
            disabled={busy}
            onClick={() => onEdit(job)}
          >
            แก้ไขข้อมูลของงาน
          </Button>
        </div>
        <Button
          variant="outline"
          className="h-10 w-full gap-1.5 rounded-xl border-danger/40 text-danger hover:bg-danger/10 hover:text-danger"
          disabled={busy}
          onClick={() => onReturn(job)}
        >
          <Undo2Icon className="size-4" />
          ตีกลับงาน
        </Button>
      </div>
    </>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-3">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="font-medium break-words">{children}</dd>
      </div>
    </div>
  );
}

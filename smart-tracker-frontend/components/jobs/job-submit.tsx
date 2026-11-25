"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangleIcon, CheckIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import { DatePicker, toDateStr, toTimeStr, useNow } from "@/components/date-picker";
import { TimePicker } from "@/components/time-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, type JobDetail, type SubJob } from "@/lib/api";
import { TONES } from "./job-list";
import { PhotoPicker } from "./photo-picker";
import { isCutOff, pendingSubJobs, subStatusOf } from "./sub-job-format";
import { useJob } from "./use-job";

/** หน้า "ส่งงานซ่อม" (Figma Page 5): วันเวลาที่เสร็จ รูปก่อน/หลังซ่อม รายละเอียดการซ่อม แล้วเปลี่ยนสถานะเป็นส่งมอบ */
export function JobSubmitView({ id }: { id: string }) {
  const { gate, job, error } = useJob(id);

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
        <Button variant="outline" className="h-12 w-full rounded-xl" nativeButton={false} render={<Link href="/jobs" />}>
          ย้อนกลับ
        </Button>
      </div>
    );
  }
  if (!job) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }
  if (!job.actions.includes("deliver")) {
    return (
      <div className="space-y-4 p-4">
        <p className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          ส่งงานไม่ได้ในสถานะ “{job.statusName}” (ส่งงานได้เมื่องานอยู่ในสถานะกำลังดำเนินการหรือรออะไหล่)
        </p>
        <Button
          variant="outline"
          className="h-12 w-full rounded-xl"
          nativeButton={false}
          render={<Link href={`/jobs/${job.id}`} />}
        >
          กลับไปหน้าติดตามงาน
        </Button>
      </div>
    );
  }

  return <SubmitForm job={job} />;
}

/** ปัญหาของวันเวลาที่ซ่อมเสร็จ (null = ใช้ได้): ต้องไม่ก่อนแจ้งงาน และไม่เกินเวลาปัจจุบัน — server ตรวจซ้ำ */
function repairedProblem(repairedAt: string, reportedAt: string, now: Date): string | null {
  if (repairedAt === "") return "กรุณาเลือกวันและเวลาที่ซ่อมเสร็จ";
  if (repairedAt < reportedAt) return "ต้องไม่ก่อนวันเวลาที่แจ้งงาน";
  if (repairedAt > `${toDateStr(now)}T${toTimeStr(now)}`) return "ต้องไม่เกินเวลาปัจจุบัน";
  return null;
}

function SubmitForm({ job }: { job: JobDetail }) {
  const router = useRouter();
  const now = useNow();
  // ตั้งต้นที่เวลาปัจจุบัน (ค่าเดียวกับ now ตอนเปิดหน้า จะได้ไม่ฟ้องว่าเกินเวลาปัจจุบัน)
  const [date, setDate] = useState(() => toDateStr(now));
  const [time, setTime] = useState(() => toTimeStr(now));
  const [before, setBefore] = useState<File[]>([]);
  const [after, setAfter] = useState<File[]>([]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  // งานที่ถูกตีกลับ: รูปหลังซ่อมรอบก่อนไม่นับ ต้องมีรูปหลังแก้ไขที่แนบหลังจากถูกตีกลับ (ตรงกับที่ server ตรวจ)
  const reworkAt = job.rework ? new Date(job.rework.at).getTime() : null;
  const existingAfter = job.attachments.filter(
    (a) => a.kind === "completed" && (reworkAt === null || new Date(a.createdAt).getTime() >= reworkAt),
  ).length;
  const repairedAt = date && time ? `${date}T${time}` : "";
  // วันเวลาแจ้งงาน "YYYY-MM-DDTHH:mm" (เวลาท้องถิ่น อ่านเป็น UTC) — ซ่อมเสร็จต้องไม่ก่อนหน้านี้
  const reportedAt = (job.opsRequestedAt ?? job.requestedAt).slice(0, 16);
  const [reportedDate, reportedTime] = reportedAt.split("T");
  const today = toDateStr(now);
  const nowTime = toTimeStr(now);
  const repairedError = repairedProblem(repairedAt, reportedAt, now);

  /** เปลี่ยนวัน: ถ้าเวลาที่เลือกไว้เลยช่วงของวันใหม่ (วันนี้ = ไม่เกินตอนนี้, วันแจ้งงาน = ไม่ก่อนเวลาแจ้ง) ขยับเข้าช่วงให้ */
  function changeDate(next: string) {
    setDate(next);
    if (next === today && time > nowTime) setTime(nowTime);
    else if (next === reportedDate && time < reportedTime) setTime(reportedTime);
  }

  // งานหลักที่มอบหมายงานย่อยไว้: งานย่อยที่ยังทำอยู่ต้องตรวจรับผ่านก่อน (ปฏิเสธ/ยกเลิก = ตัดออกแล้ว ไม่นับ — server ตรวจซ้ำ)
  const pending = pendingSubJobs(job.subJobs);
  const hasActiveSubs = job.subJobs.some((s) => !isCutOff(s));

  const checks = [
    { ok: repairedError === null, label: "ระบุวันที่และเวลาที่ซ่อมเสร็จ" },
    { ok: after.length + existingAfter > 0, label: job.rework ? "แนบรูปหลังแก้ไขแล้ว" : "แนบรูปหลังซ่อมแล้ว" },
    { ok: details.trim().length > 0, label: "กรอกรายละเอียดการซ่อมแล้ว" },
    ...(hasActiveSubs
      ? [{ ok: pending.length === 0, label: "งานย่อยตรวจรับครบแล้ว (ไม่นับที่ถูกปฏิเสธ/ยกเลิก)" }]
      : []),
  ];
  const allOk = checks.every((c) => c.ok);

  async function submit() {
    // ตรวจกับเวลา ณ ตอนกดอีกครั้ง (now อัปเดตทุก 30 วินาที)
    const problem = repairedProblem(repairedAt, reportedAt, new Date());
    if (problem) {
      toast.error("วันเวลาที่ซ่อมเสร็จไม่ถูกต้อง", { description: problem });
      return;
    }
    setBusy(true);
    try {
      await api.changeJobStatus(job.id, {
        action: "deliver",
        repairedAt,
        details: details.trim(),
        files: after,
        beforeFiles: before,
      });
      toast.success("ส่งงานเรียบร้อยแล้ว");
      router.replace(`/jobs/${job.id}`); // busy ค้างไว้จนเปลี่ยนหน้า กันกดซ้ำ
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ส่งงานไม่สำเร็จ");
      if (e instanceof ApiError && e.status === 409) {
        router.replace(`/jobs/${job.id}`); // สถานะเปลี่ยนไปแล้ว
        return;
      }
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <section className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="rounded-lg border-l-4 border-brand bg-muted/60 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            {job.opsJobCode ? `${job.opsJobCode} · ` : ""}
            <span className="font-mono">[{job.jobCode}]</span>
            {job.branchName ? ` · ${job.branchName}` : ""}
          </p>
          <p className="font-heading text-base leading-snug font-medium">{job.jobType ?? "งานซ่อม"}</p>
        </div>

        {job.rework && (
          <div className="space-y-1 rounded-xl bg-danger/10 px-3 py-2.5 text-xs text-danger">
            <p className="font-medium">ส่งงานที่แก้ไขแล้ว (ถูกตีกลับครั้งที่ {job.rework.count})</p>
            {job.rework.note && <p className="whitespace-pre-line text-foreground">สิ่งที่ต้องแก้ไข: {job.rework.note}</p>}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="repaired-date">
            วันที่และเวลาที่ซ่อมเสร็จ <span className="text-danger">*</span>
          </Label>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,9rem)] gap-2">
            <DatePicker
              id="repaired-date"
              aria-label="วันที่ซ่อมเสร็จ"
              value={date}
              onChange={changeDate}
              min={reportedDate}
              max={today}
              disabled={busy}
              invalid={repairedError !== null}
            />
            <TimePicker
              id="repaired-time"
              aria-label="เวลาที่ซ่อมเสร็จ"
              value={time}
              onChange={setTime}
              min={date === reportedDate ? reportedTime : undefined}
              max={date === today ? nowTime : undefined}
              disabled={busy}
              invalid={repairedError !== null}
            />
          </div>
          {repairedError && <p className="text-xs text-danger">{repairedError}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>รูปก่อนซ่อม</Label>
          <PhotoPicker files={before} onChange={setBefore} disabled={busy} />
        </div>

        <div className="space-y-1.5">
          <Label>
            {job.rework ? "รูปหลังแก้ไขเสร็จ" : "รูปหลังซ่อมเสร็จ"} <span className="text-danger">*</span>
          </Label>
          <PhotoPicker files={after} onChange={setAfter} disabled={busy} />
          {existingAfter > 0 && (
            <p className="text-xs text-muted-foreground">
              มีรูป{job.rework ? "หลังแก้ไข" : "หลังซ่อม"}แนบไว้แล้ว {existingAfter} รูป
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="repair-details">
            รายละเอียดการซ่อม <span className="text-danger">*</span>
          </Label>
          <Textarea
            id="repair-details"
            value={details}
            rows={4}
            maxLength={2000}
            disabled={busy}
            placeholder="เช่น เปลี่ยนตลับหมึกและทำความสะอาดหัวพิมพ์ ทดสอบพิมพ์ปกติแล้ว"
            onChange={(e) => setDetails(e.target.value)}
          />
        </div>
      </section>

      {pending.length > 0 && <PendingSubJobsCard jobId={job.id} pending={pending} />}

      <section className="space-y-2 rounded-2xl border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-medium">ก่อนส่งตรวจสอบว่า</h3>
        <ul className="space-y-1.5 text-sm">
          {checks.map((c) => (
            <li key={c.label} className={`flex items-center gap-2 ${c.ok ? "text-success" : "text-muted-foreground"}`}>
              <span
                className={`grid size-4.5 shrink-0 place-items-center rounded-full border ${
                  c.ok ? "border-success bg-success text-white" : "border-border"
                }`}
              >
                {c.ok && <CheckIcon className="size-3" />}
              </span>
              {c.label}
            </li>
          ))}
        </ul>
      </section>

      <Button
        className="h-14 w-full rounded-xl bg-success text-base text-white hover:bg-success/90"
        disabled={busy || !allOk}
        onClick={submit}
      >
        <SendIcon className="size-5" />
        {busy ? "กำลังส่งงาน…" : "ส่งงานซ่อมเสร็จสิ้น"}
      </Button>
      <Button
        variant="outline"
        className="h-12 w-full rounded-xl"
        disabled={busy}
        nativeButton={false}
        render={<Link href={`/jobs/${job.id}`} />}
      >
        ย้อนกลับ
      </Button>
    </div>
  );
}

/** การ์ด "งานย่อยที่ยังค้างอยู่" (Figma หน้าส่งงานซ่อม): ปิดงานหลักไม่ได้จนกว่างานย่อยจะตรวจรับหรือยกเลิกครบ */
function PendingSubJobsCard({ jobId, pending }: { jobId: string; pending: SubJob[] }) {
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
      <h3 className="font-heading text-base font-medium">งานย่อยที่ยังค้างอยู่</h3>
      <div className="flex items-start gap-2.5 rounded-xl bg-warning-soft px-3 py-2.5 text-warning">
        <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
        <div className="text-sm">
          <p className="font-medium">ส่งงานหลักไม่ได้จนกว่างานย่อยจะครบ</p>
          <p className="text-xs">
            เหลือ {pending.length} รายการที่ต้องรอส่งงานและตรวจรับ (งานที่ถูกปฏิเสธ/ยกเลิกไม่นับ)
          </p>
        </div>
      </div>
      <ul className="divide-y">
        {pending.map((s) => {
          const status = subStatusOf(s.statusCode, s.statusName, s.reworking);
          return (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="min-w-0 text-sm break-words">{s.venderName ?? s.venderCode}</span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${TONES[status.tone].chip}`}>
                {status.label}
              </span>
            </li>
          );
        })}
      </ul>
      <Button
        variant="outline"
        className="h-11 w-full rounded-xl"
        nativeButton={false}
        render={<Link href={`/jobs/${jobId}#subjobs`} />}
      >
        ไปจัดการงานย่อย
      </Button>
    </section>
  );
}

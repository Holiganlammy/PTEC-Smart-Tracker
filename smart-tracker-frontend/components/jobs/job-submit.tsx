"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, type JobDetail } from "@/lib/api";
import { PhotoPicker } from "./photo-picker";
import { useJob } from "./use-job";

/** วันที่/เวลาตามนาฬิกาเครื่อง (YYYY-MM-DD, HH:mm) — ตรงกับเวลาท้องถิ่นที่ฐานข้อมูลเก็บ */
function nowParts() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    time: `${p(d.getHours())}:${p(d.getMinutes())}`,
  };
}

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

function SubmitForm({ job }: { job: JobDetail }) {
  const router = useRouter();
  const [initial] = useState(nowParts);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [before, setBefore] = useState<File[]>([]);
  const [after, setAfter] = useState<File[]>([]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const existingAfter = job.attachments.filter((a) => a.kind === "completed").length;
  const repairedAt = date && time ? `${date}T${time}` : "";
  // วันที่แจ้งงาน (เวลาท้องถิ่น อ่านเป็น UTC) — ซ่อมเสร็จต้องไม่ก่อนหน้านี้
  const reportedAt = (job.opsRequestedAt ?? job.requestedAt).slice(0, 16);
  const beforeReport = repairedAt !== "" && repairedAt < reportedAt;

  const checks = [
    { ok: repairedAt !== "" && !beforeReport, label: "ระบุวันที่และเวลาที่ซ่อมเสร็จ" },
    { ok: after.length + existingAfter > 0, label: "แนบรูปหลังซ่อมแล้ว" },
    { ok: details.trim().length > 0, label: "กรอกรายละเอียดการซ่อมแล้ว" },
  ];
  const allOk = checks.every((c) => c.ok);

  async function submit() {
    const now = nowParts();
    if (repairedAt > `${now.date}T${now.time}`) {
      toast.error("วันเวลาที่ซ่อมเสร็จต้องไม่เกินเวลาปัจจุบัน");
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

        <div className="space-y-1.5">
          <Label htmlFor="repaired-date">วันที่และเวลาที่ซ่อมเสร็จ</Label>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Input
              id="repaired-date"
              type="date"
              value={date}
              min={reportedAt.slice(0, 10)}
              max={initial.date}
              disabled={busy}
              onChange={(e) => setDate(e.target.value)}
              className="h-11"
            />
            <Input
              type="time"
              aria-label="เวลาที่ซ่อมเสร็จ"
              value={time}
              disabled={busy}
              onChange={(e) => setTime(e.target.value)}
              className="h-11 w-32"
            />
          </div>
          {beforeReport && <p className="text-xs text-danger">ต้องไม่ก่อนวันที่แจ้งงาน</p>}
        </div>

        <div className="space-y-1.5">
          <Label>รูปก่อนซ่อม</Label>
          <PhotoPicker files={before} onChange={setBefore} disabled={busy} />
        </div>

        <div className="space-y-1.5">
          <Label>
            รูปหลังซ่อมเสร็จ <span className="text-danger">*</span>
          </Label>
          <PhotoPicker files={after} onChange={setAfter} disabled={busy} />
          {existingAfter > 0 && (
            <p className="text-xs text-muted-foreground">มีรูปหลังซ่อมแนบไว้แล้ว {existingAfter} รูป</p>
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

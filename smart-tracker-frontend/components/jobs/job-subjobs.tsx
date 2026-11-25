"use client";

import { useEffect, useMemo, useState } from "react";
import { PlusIcon, SendIcon, UserPlusIcon } from "lucide-react";
import { toast } from "sonner";
import { VenderCombobox } from "@/components/admin/vender-combobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, type JobDetail, type SubJob, type Vender } from "@/lib/api";
import { TONES } from "./job-list";
import { PhotoPicker } from "./photo-picker";

/** ป้ายสถานะงานย่อยตาม Figma (ชื่อเรียกต่างจากสถานะงานปกติ เช่น แจ้งงาน → รอตอบรับ, ส่งมอบ → รอตรวจรับ) */
const SUB_STATUS: Record<string, { label: string; tone: keyof typeof TONES }> = {
  new: { label: "รอตอบรับ", tone: "brand" },
  accepted: { label: "รับงานแล้ว", tone: "brand" },
  in_progress: { label: "กำลังดำเนินการ", tone: "warning" },
  waiting_parts: { label: "รออะไหล่", tone: "warning" },
  delivered: { label: "รอตรวจรับ", tone: "sub" },
  completed: { label: "เสร็จสิ้น", tone: "success" },
  rejected: { label: "ปฏิเสธงาน", tone: "danger" },
};

const dueFormat = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC", // กำหนดเสร็จเก็บเป็นวันที่ล้วน ไม่มีเวลา/timezone
});

/** เวลากำหนดเสร็จของงานย่อยที่ไม่ได้ระบุ (งานย่อยเก่าก่อนมีช่องเวลา) ถือเป็นเลิกงาน 18:00 น. (ตาม Figma) */
export const DEFAULT_DUE_TIME = "18:00";

/** กำหนดเสร็จของงานย่อย เช่น "25 พ.ย. 69 ก่อน 14:00 น." (time เป็น HH:mm) */
export function formatSubDue(date: string, time?: string | null) {
  return `${dueFormat.format(new Date(`${date}T00:00:00Z`))} ก่อน ${time ?? DEFAULT_DUE_TIME} น.`;
}

/** วันนี้ตามนาฬิกาเครื่อง YYYY-MM-DD (ใช้เป็นวันที่เร็วที่สุดที่เลือกได้) */
function todayLocal() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** เวลาตอนนี้ตามนาฬิกาเครื่อง HH:mm (ถ้าเลือกกำหนดเสร็จเป็นวันนี้ ต้องเป็นเวลาหลังจากนี้) */
function nowLocalTime() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

type Props = {
  job: JobDetail;
  /** เพิ่ม/ยกเลิกสำเร็จ ได้รายละเอียดงานแม่ล่าสุด */
  onChanged: (job: JobDetail) => void;
  /** สถานะงานเปลี่ยนไปแล้วโดยคนอื่น → โหลดใหม่ */
  onReload: () => void;
};

export function SubJobsCard({ job, onChanged, onReload }: Props) {
  const [adding, setAdding] = useState(false);
  const [cancelling, setCancelling] = useState<SubJob | null>(null);

  if (job.subJobs.length === 0 && !job.canAddSubJob) return null;

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-base font-medium">มอบหมายงานผู้รับเหมา</h3>
        {job.canAddSubJob && (
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setAdding(true)}>
            <PlusIcon />
            เพิ่มผู้รับเหมา
          </Button>
        )}
      </div>

      {job.subJobs.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          ยังไม่ได้มอบหมายงานต่อให้ผู้รับเหมารายย่อย กด “เพิ่มผู้รับเหมา” เพื่อส่งงานย่อยให้บริษัทอื่น
        </p>
      ) : (
        <ul className="divide-y">
          {job.subJobs.map((s) => {
            const status = SUB_STATUS[s.statusCode] ?? { label: s.statusName, tone: "muted" as const };
            return (
              <li key={s.id} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium break-words">{s.venderName ?? s.venderCode}</p>
                    <p className="text-xs text-muted-foreground break-words">
                      {s.acceptedByName
                        ? [s.acceptedByName, s.acceptedByPhone].filter(Boolean).join(" · ")
                        : "ยังไม่มีผู้รับงาน"}
                    </p>
                    {s.dueDate && (
                      <p className="text-xs text-muted-foreground">กำหนดเสร็จ {formatSubDue(s.dueDate, s.dueTime)}</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${TONES[status.tone].chip}`}
                  >
                    {status.label}
                  </span>
                </div>
                {s.scope && (
                  <p className="line-clamp-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs whitespace-pre-line text-muted-foreground">
                    {s.scope}
                  </p>
                )}
                {s.canCancel && (
                  <button
                    type="button"
                    onClick={() => setCancelling(s)}
                    className="text-xs font-medium text-danger underline-offset-2 hover:underline"
                  >
                    ยกเลิกงานย่อย
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <AddSubJobDialog job={adding ? job : null} onClose={() => setAdding(false)} onChanged={onChanged} onReload={onReload} />
      <CancelSubJobDialog
        parent={job}
        sub={cancelling}
        onClose={() => setCancelling(null)}
        onChanged={onChanged}
        onReload={onReload}
      />
    </section>
  );
}

/** ฟอร์ม "เพิ่มผู้รับเหมาช่วง" (Figma): บริษัท / ขอบเขตงาน / กำหนดเสร็จ / รูปประกอบ / หมายเหตุ */
function AddSubJobDialog({
  job,
  onClose,
  onChanged,
  onReload,
}: {
  /** งานแม่ (null = ปิดหน้าต่าง) */
  job: JobDetail | null;
  onClose: () => void;
  onChanged: (job: JobDetail) => void;
  onReload: () => void;
}) {
  return (
    <Dialog open={job !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        {job && <AddSubJobForm key={job.id} job={job} onClose={onClose} onChanged={onChanged} onReload={onReload} />}
      </DialogContent>
    </Dialog>
  );
}

function AddSubJobForm({
  job,
  onClose,
  onChanged,
  onReload,
}: {
  job: JobDetail;
  onClose: () => void;
  onChanged: (job: JobDetail) => void;
  onReload: () => void;
}) {
  const [venders, setVenders] = useState<Vender[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [venderCode, setVenderCode] = useState("");
  // ตั้งต้นด้วยปัญหาที่แจ้งของงานแม่ — ผู้มอบหมายแก้เป็นขอบเขตที่ให้บริษัทนั้นทำได้
  const [scope, setScope] = useState(() => (job.details ?? "").slice(0, 2000));
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState(DEFAULT_DUE_TIME);
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [today] = useState(todayLocal);
  const [nowTime] = useState(nowLocalTime);

  useEffect(() => {
    let cancelled = false;
    api
      .getVenders()
      .then((list) => !cancelled && setVenders(list))
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "โหลดรายชื่อบริษัทไม่สำเร็จ");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // ไม่ให้เลือกบริษัทของตัวเอง
  const options = useMemo(() => venders?.filter((v) => v.venderCode !== job.venderCode) ?? [], [venders, job.venderCode]);
  const target = options.find((v) => v.venderCode === venderCode) ?? null;
  // วันนี้ต้องเลือกเวลาหลังจากนี้ (เซิร์ฟเวอร์ตรวจซ้ำอีกชั้น)
  const dueOk = dueDate !== "" && dueTime !== "" && (dueDate > today || (dueDate === today && dueTime > nowTime));
  const valid = target !== null && scope.trim().length > 0 && dueOk;

  async function submit() {
    if (!target || !valid) return;
    setBusy(true);
    try {
      const updated = await api.addSubJob(job.id, {
        venderCode: target.venderCode,
        scope: scope.trim(),
        dueDate,
        dueTime,
        note: note.trim() || undefined,
        files,
      });
      toast.success(`มอบหมายงานย่อยให้ ${target.venderName} แล้ว`, { description: job.opsJobCode ?? job.jobCode });
      onChanged(updated);
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.info("มอบหมายไม่ได้", { description: e.message });
        onReload(); // สถานะงานเปลี่ยนไป/ส่งซ้ำ → โหลดใหม่ให้เห็นรายการล่าสุด
        onClose();
      } else {
        toast.error("มอบหมายงานย่อยไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogDescription className="text-left text-xs">
          {job.opsJobCode ?? job.jobCode} · มอบหมายงานย่อย
        </DialogDescription>
        <DialogTitle className="text-left text-lg">เพิ่มผู้รับเหมาช่วง</DialogTitle>
      </DialogHeader>

      <div className="space-y-4 text-sm">
        <div className="space-y-1.5">
          <Label htmlFor="sub-vender">
            บริษัทผู้รับเหมาช่วง <span className="text-danger">*</span>
          </Label>
          {loadError ? (
            <div className="space-y-2">
              <p className="text-xs text-danger">{loadError}</p>
              <Button
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => {
                  setLoadError(null);
                  setAttempt((n) => n + 1);
                }}
              >
                ลองอีกครั้ง
              </Button>
            </div>
          ) : venders === null ? (
            <p className="text-xs text-muted-foreground">กำลังโหลดรายชื่อบริษัท…</p>
          ) : (
            <VenderCombobox id="sub-vender" venders={options} value={venderCode} onChange={setVenderCode} disabled={busy} />
          )}
        </div>

        <p className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground">
          <UserPlusIcon className="mt-0.5 size-4 shrink-0" />
          ไม่ต้องระบุชื่อช่าง — เมื่อบริษัทนั้นกดรับงานย่อย ชื่อผู้รับผิดชอบจะขึ้นแสดงอัตโนมัติ
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="sub-scope">
            ขอบเขตงานที่มอบหมาย <span className="text-danger">*</span>
          </Label>
          <Textarea
            id="sub-scope"
            value={scope}
            rows={4}
            maxLength={2000}
            disabled={busy}
            placeholder="เช่น เดินสายแลนใหม่ชั้น 2 พร้อมเชื่อมต่อสวิตช์สำรอง"
            onChange={(e) => setScope(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sub-due">
            กำหนดเสร็จงานย่อย <span className="text-danger">*</span>
          </Label>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,9rem)] gap-2">
            <Input
              id="sub-due"
              type="date"
              aria-label="วันที่กำหนดเสร็จ"
              value={dueDate}
              min={today}
              disabled={busy}
              aria-invalid={dueDate !== "" && !dueOk}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-11"
            />
            <Input
              id="sub-due-time"
              type="time"
              aria-label="เวลาที่กำหนดเสร็จ"
              value={dueTime}
              disabled={busy}
              aria-invalid={dueDate !== "" && !dueOk}
              onChange={(e) => setDueTime(e.target.value)}
              className="h-11"
            />
          </div>
          {dueDate !== "" && !dueOk && <p className="text-xs text-danger">กำหนดเสร็จต้องไม่ย้อนหลัง</p>}
        </div>

        <div className="space-y-1.5">
          <Label>รูปภาพประกอบ (ถ้ามี)</Label>
          <PhotoPicker files={files} onChange={setFiles} max={5} disabled={busy} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sub-note">หมายเหตุ</Label>
          <Textarea
            id="sub-note"
            value={note}
            rows={3}
            maxLength={500}
            disabled={busy}
            placeholder="ไม่บังคับ"
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      <Button
        className="h-12 w-full gap-2 rounded-xl bg-success text-base text-white hover:bg-success/90"
        disabled={busy || !valid}
        onClick={() => void submit()}
      >
        <SendIcon className="size-5" />
        {busy ? "กำลังมอบหมาย…" : "มอบหมายงานให้ผู้รับเหมา"}
      </Button>
    </>
  );
}

function CancelSubJobDialog({
  parent,
  sub,
  onClose,
  onChanged,
  onReload,
}: {
  parent: JobDetail;
  sub: SubJob | null;
  onClose: () => void;
  onChanged: (job: JobDetail) => void;
  onReload: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!sub) return;
    setBusy(true);
    try {
      onChanged(await api.cancelSubJob(parent.id, sub.id));
      toast.success("ยกเลิกงานย่อยแล้ว", { description: sub.venderName ?? sub.venderCode });
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.info("ยกเลิกไม่ได้", { description: e.message });
        onReload();
        onClose();
      } else {
        toast.error("ยกเลิกไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={sub !== null} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-left">ยกเลิกงานย่อยนี้?</DialogTitle>
          <DialogDescription className="text-left">
            งานย่อยที่ส่งให้ {sub?.venderName ?? sub?.venderCode} จะถูกยกเลิก และบริษัทนั้นจะไม่เห็นงานนี้แล้ว (ยกเลิกได้เฉพาะตอนที่ยังไม่มีผู้ตอบรับ)
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" className="h-11 rounded-xl" disabled={busy} onClick={onClose}>
            ไม่ยกเลิก
          </Button>
          <Button
            className="h-11 rounded-xl bg-danger text-white hover:bg-danger/90"
            disabled={busy}
            onClick={() => void confirm()}
          >
            {busy ? "กำลังยกเลิก…" : "ยืนยันยกเลิกงานย่อย"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

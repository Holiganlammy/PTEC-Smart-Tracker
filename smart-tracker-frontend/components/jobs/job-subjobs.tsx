"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIcon,
  ClipboardCheckIcon,
  PlusIcon,
  RotateCcwIcon,
  SendIcon,
  UserPlusIcon,
} from "lucide-react";
import { toast } from "sonner";
import { VenderCombobox } from "@/components/admin/vender-combobox";
import { DatePicker, toDateStr, toTimeStr, useNow } from "@/components/date-picker";
import { TimePicker } from "@/components/time-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, type JobDetail, type SubJob, type Vender } from "@/lib/api";
import { TONES } from "./job-list";
import { PhotoPicker } from "./photo-picker";
import { SubJobHistoryDialog } from "./sub-job-history";
import { DEFAULT_DUE_TIME, formatSubDue, isCutOff, subStatusOf } from "./sub-job-format";

/** ปัญหาของกำหนดเสร็จ (null = ใช้ได้): ต้องหลังเวลาปัจจุบัน — เซิร์ฟเวอร์ตรวจซ้ำอีกชั้น */
function dueProblem(date: string, time: string, now: Date): string | null {
  if (date === "" || time === "") return "กรุณาเลือกวันและเวลากำหนดเสร็จ";
  const today = toDateStr(now);
  const nowTime = toTimeStr(now);
  if (date < today) return "วันที่กำหนดเสร็จต้องไม่ย้อนหลัง";
  if (date === today && time <= nowTime) return `ถ้าเลือกวันนี้ ต้องเป็นเวลาหลัง ${nowTime} น.`;
  return null;
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
  const [viewing, setViewing] = useState<SubJob | null>(null);
  // ซ่อนงานย่อยที่ถูกปฏิเสธ/ยกเลิก (ตัดออกจากงานหลักแล้ว) — ค่าเริ่มต้นแสดงทั้งหมด
  const [hideCutOff, setHideCutOff] = useState(false);
  const visible = job.subJobs.length > 0 || job.canAddSubJob;

  // มาจากปุ่ม "ไปจัดการงานย่อย" ในหน้าส่งงาน (/jobs/:id#subjobs) → เลื่อนมาที่การ์ดนี้หลังโหลดเสร็จ
  const scrollRef = useCallback((el: HTMLElement | null) => {
    if (el && window.location.hash === "#subjobs") el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (!visible) return null;
  const toInspect = job.subJobs.filter((s) => s.canInspect).length;
  const cutOffCount = job.subJobs.filter(isCutOff).length;
  const shown = hideCutOff ? job.subJobs.filter((s) => !isCutOff(s)) : job.subJobs;

  return (
    <section ref={scrollRef} id="subjobs" className="scroll-mt-4 space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-base font-medium">มอบหมายงานผู้รับเหมา</h3>
        {job.canAddSubJob && (
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setAdding(true)}>
            <PlusIcon />
            เพิ่มผู้รับเหมา
          </Button>
        )}
      </div>

      {toInspect > 0 && (
        <p className="flex items-start gap-2 rounded-xl bg-sub-accent/10 px-3 py-2.5 text-xs text-sub-accent">
          <ClipboardCheckIcon className="mt-0.5 size-4 shrink-0" />
          มีงานย่อยส่งมาให้ตรวจรับ {toInspect} งาน — กด “ตรวจรับงาน” เพื่อดูรูปและรายละเอียด แล้วเลือกตรวจรับผ่านหรือตีกลับให้แก้ไข
        </p>
      )}

      {cutOffCount > 0 && (
        <Label className="cursor-pointer gap-2 text-xs font-normal text-muted-foreground">
          <Checkbox checked={hideCutOff} onCheckedChange={(checked) => setHideCutOff(checked)} />
          ซ่อนงานที่ถูกปฏิเสธ/ยกเลิก ({cutOffCount})
        </Label>
      )}

      {job.subJobs.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          ยังไม่ได้มอบหมายงานต่อให้ผู้รับเหมารายย่อย กด “เพิ่มผู้รับเหมา” เพื่อส่งงานย่อยให้บริษัทอื่น
        </p>
      ) : shown.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          ซ่อนงานที่ถูกปฏิเสธ/ยกเลิกไว้ {cutOffCount} รายการ — ไม่มีงานย่อยที่ยังทำอยู่
        </p>
      ) : (
        <ul className="divide-y">
          {shown.map((s) => {
            const status = subStatusOf(s.statusCode, s.statusName, s.reworking);
            const cutOff = isCutOff(s);
            return (
              <li key={s.id} className={`space-y-1.5 py-3 first:pt-0 last:pb-0 ${cutOff ? "opacity-70" : ""}`}>
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
                    {s.reworkCount > 0 && (
                      <p className="flex items-center gap-1 text-xs text-danger">
                        <RotateCcwIcon className="size-3 shrink-0" />
                        ตีกลับให้แก้ไขแล้ว {s.reworkCount} ครั้ง
                      </p>
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
                {cutOff && (
                  <p className="text-xs text-muted-foreground">
                    ตัดออกจากงานหลักแล้ว — ไม่ต้องรอ ส่งงานหลักได้
                    {s.statusCode === "rejected" && " (ถ้ายังต้องการให้คนอื่นทำ กด “เพิ่มผู้รับเหมา” ใหม่)"}
                  </p>
                )}
                {/* ส่งงานมาแล้วแต่ผู้ใช้ตรวจไม่ได้ (ไม่ใช่เจ้าของงาน/หัวหน้า/แอดมิน) → บอกว่ารอใครอยู่ */}
                {!s.canInspect && s.statusCode === "delivered" && (
                  <p className="rounded-lg bg-sub-accent/10 px-2.5 py-1.5 text-xs text-sub-accent">
                    ส่งงานมาแล้ว รอผู้รับเหมาหลักตรวจรับ
                  </p>
                )}
                <div className="flex items-center justify-between gap-3 pt-0.5">
                  {/* ตรวจรับ/ตีกลับทำใน modal (ดูรูปและรายละเอียดก่อนตัดสินใจ) — ปุ่มเด่นขึ้นเมื่อรอผู้ใช้ตรวจ */}
                  {s.canInspect ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 gap-1.5 rounded-lg bg-sub-accent text-xs text-white hover:bg-sub-accent/90"
                      onClick={() => setViewing(s)}
                    >
                      <ClipboardCheckIcon className="size-3.5" />
                      ตรวจรับงาน
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 rounded-lg text-xs"
                      onClick={() => setViewing(s)}
                    >
                      <ActivityIcon className="size-3.5" />
                      ติดตามงานย่อย
                    </Button>
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
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <SubJobHistoryDialog
        parentId={job.id}
        sub={viewing}
        onClose={() => setViewing(null)}
        onChanged={onChanged}
        onReload={onReload}
      />
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
  const now = useNow();

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
  // กำหนดเสร็จต้องหลังเวลาปัจจุบัน (วันนี้ = เวลาหลังจากนี้)
  const dueError = dueProblem(dueDate, dueTime, now);
  const showDueError = dueDate !== "" && dueError !== null;
  const valid = target !== null && scope.trim().length > 0 && dueError === null;

  async function submit() {
    if (!target || !valid) return;
    // ตรวจกับเวลา ณ ตอนกดอีกครั้ง (now อัปเดตทุก 30 วินาที อาจช้ากว่าจริงเล็กน้อย)
    const late = dueProblem(dueDate, dueTime, new Date());
    if (late) {
      toast.error("กำหนดเสร็จไม่ถูกต้อง", { description: late });
      return;
    }
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
            <DatePicker
              id="sub-due"
              aria-label="วันที่กำหนดเสร็จ"
              value={dueDate}
              onChange={setDueDate}
              min={toDateStr(now)}
              disabled={busy}
              invalid={showDueError}
            />
            <TimePicker
              id="sub-due-time"
              aria-label="เวลาที่กำหนดเสร็จ"
              value={dueTime}
              onChange={setDueTime}
              after={dueDate === toDateStr(now) ? toTimeStr(now) : undefined}
              disabled={busy}
              invalid={showDueError}
            />
          </div>
          {showDueError && <p className="text-xs text-danger">{dueError}</p>}
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
            งานย่อยที่ส่งให้ {sub?.venderName ?? sub?.venderCode} จะถูกยกเลิก และบริษัทนั้นจะไม่เห็นงานนี้แล้ว
            (ยกเลิกได้เฉพาะตอนที่ยังไม่มีผู้ตอบรับ)
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

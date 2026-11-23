"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, type JobAction, type JobDetail } from "@/lib/api";
import { PhotoPicker } from "./photo-picker";

/** การกระทำที่ทำผ่านไดอะล็อกในหน้านี้ (ส่งงานไปทำที่หน้า "ส่งงานซ่อม") */
type DialogAction = Exclude<JobAction, "deliver">;

const COPY: Record<
  DialogAction,
  {
    label: string;
    title: string;
    description: string;
    /** null = ขั้นนี้ไม่แนบรูป */
    photoLabel: string | null;
    noteLabel: string;
    noteRequired: boolean;
    confirm: string;
    success: string;
  }
> = {
  accept: {
    label: "รับงาน",
    title: "ยืนยันรับงาน",
    description: "ชื่อของคุณจะถูกบันทึกในประวัติงานว่าเป็นผู้รับงานนี้",
    photoLabel: "รูปตอนรับงาน (ถ้ามี)",
    noteLabel: "หมายเหตุ (ถ้ามี)",
    noteRequired: false,
    confirm: "ยืนยันรับงาน",
    success: "รับงานเรียบร้อยแล้ว",
  },
  start: {
    label: "เริ่มดำเนินการ",
    title: "เริ่มดำเนินการ",
    description: "เปลี่ยนสถานะงานเป็น “กำลังดำเนินการ”",
    photoLabel: "รูปตอนเริ่มงาน (ถ้ามี)",
    noteLabel: "หมายเหตุ (ถ้ามี)",
    noteRequired: false,
    confirm: "เริ่มดำเนินการ",
    success: "เริ่มดำเนินการแล้ว",
  },
  wait_parts: {
    label: "แจ้งรออะไหล่",
    title: "แจ้งรออะไหล่/อุปกรณ์",
    description: "บันทึกว่างานหยุดรออะไหล่ ผู้ติดตามงานจะเห็นสถานะ “รออะไหล่”",
    photoLabel: "รูปประกอบ (ถ้ามี)",
    noteLabel: "รออะไหล่/อุปกรณ์อะไร",
    noteRequired: true,
    confirm: "แจ้งรออะไหล่",
    success: "บันทึกสถานะรออะไหล่แล้ว",
  },
  resume: {
    label: "กลับมาดำเนินการต่อ",
    title: "กลับมาดำเนินการต่อ",
    description: "ได้รับอะไหล่/อุปกรณ์แล้ว เปลี่ยนสถานะกลับเป็น “กำลังดำเนินการ”",
    photoLabel: "รูปประกอบ (ถ้ามี)",
    noteLabel: "หมายเหตุ (ถ้ามี)",
    noteRequired: false,
    confirm: "ดำเนินการต่อ",
    success: "กลับมาดำเนินการต่อแล้ว",
  },
  reject: {
    label: "ปฏิเสธงาน",
    title: "ปฏิเสธงานนี้",
    description:
      "ใช้เมื่อบริษัทของคุณรับงานนี้ไม่ได้ งานจะถูกส่งให้แอดมินจ่ายให้บริษัทอื่น คุณจะกดทำอะไรกับงานนี้ต่อไม่ได้ และงานจะหายจากรายการของคุณเมื่อแอดมินย้ายบริษัท",
    photoLabel: null,
    noteLabel: "เหตุผลที่ปฏิเสธงาน",
    noteRequired: true,
    confirm: "ยืนยันปฏิเสธงาน",
    success: "ปฏิเสธงานแล้ว รอแอดมินจ่ายให้บริษัทอื่น",
  },
};

/** ปุ่มเปลี่ยนสถานะท้ายหน้ารายละเอียดงาน — แสดงเฉพาะที่เซิร์ฟเวอร์บอกว่าทำได้ (job.actions) */
export function JobActions({
  job,
  onChanged,
  onReload,
}: {
  job: JobDetail;
  /** เปลี่ยนสถานะสำเร็จ ได้รายละเอียดงานล่าสุดกลับมา */
  onChanged: (job: JobDetail) => void;
  /** สถานะเปลี่ยนไปแล้วโดยคนอื่น → โหลดใหม่ */
  onReload: () => void;
}) {
  const [open, setOpen] = useState<DialogAction | null>(null);
  const can = (a: JobAction) => job.actions.includes(a);
  if (job.actions.length === 0) return null;

  // ปุ่มหลักของแต่ละสถานะ: รับงาน → เริ่มดำเนินการ → ส่งงาน (ปุ่มรองคือรออะไหล่/กลับมาทำต่อ)
  const primary: DialogAction | null = can("accept") ? "accept" : can("start") ? "start" : null;
  const secondary: DialogAction | null = can("wait_parts") ? "wait_parts" : can("resume") ? "resume" : null;

  return (
    <div className="space-y-2.5">
      {primary && (
        <Button className="h-12 w-full rounded-xl text-base" onClick={() => setOpen(primary)}>
          {COPY[primary].label}
        </Button>
      )}
      {can("deliver") && (
        <Button
          className="h-12 w-full rounded-xl text-base"
          nativeButton={false}
          render={<Link href={`/jobs/${job.id}/submit`} />}
        >
          ส่งงาน
        </Button>
      )}
      {secondary && (
        <Button variant="outline" className="h-12 w-full rounded-xl" onClick={() => setOpen(secondary)}>
          {COPY[secondary].label}
        </Button>
      )}
      {can("reject") && (
        <Button
          variant="outline"
          className="h-12 w-full rounded-xl border-danger/40 text-danger hover:bg-danger/10 hover:text-danger"
          onClick={() => setOpen("reject")}
        >
          {COPY.reject.label}
        </Button>
      )}

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          {open && (
            <ActionForm
              key={open}
              job={job}
              action={open}
              onClose={() => setOpen(null)}
              onChanged={onChanged}
              onReload={onReload}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActionForm({
  job,
  action,
  onClose,
  onChanged,
  onReload,
}: {
  job: JobDetail;
  action: DialogAction;
  onClose: () => void;
  onChanged: (job: JobDetail) => void;
  onReload: () => void;
}) {
  const copy = COPY[action];
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (copy.noteRequired && !note.trim()) {
      setError("กรุณาระบุรายละเอียด");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const updated = await api.changeJobStatus(job.id, {
        action,
        note: note.trim() || undefined,
        files: copy.photoLabel === null ? [] : files,
      });
      toast.success(copy.success);
      onChanged(updated);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
      if (e instanceof ApiError && e.status === 409) {
        onReload(); // สถานะเปลี่ยนไปแล้ว → โหลดใหม่ให้เห็นปุ่มที่ถูกต้อง
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogDescription className="font-mono text-xs">
          {job.opsJobCode ? `${job.opsJobCode} · ` : ""}
          {job.jobCode}
        </DialogDescription>
        <DialogTitle className="text-left">{copy.title}</DialogTitle>
        <DialogDescription className="text-left">{copy.description}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4 text-sm">
        {copy.photoLabel !== null && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">{copy.photoLabel}</p>
            <PhotoPicker files={files} onChange={setFiles} disabled={busy} />
          </div>
        )}
        <div className="space-y-1.5">
          <label htmlFor="action-note" className="text-xs font-medium text-muted-foreground">
            {copy.noteLabel}
            {copy.noteRequired && <span className="text-danger"> *</span>}
          </label>
          <Textarea
            id="action-note"
            value={note}
            maxLength={500}
            rows={3}
            disabled={busy}
            aria-invalid={error !== null}
            onChange={(e) => {
              setNote(e.target.value);
              setError(null);
            }}
          />
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" className="h-11 rounded-xl" disabled={busy} onClick={onClose}>
          ยกเลิก
        </Button>
        <Button
          className={`h-11 rounded-xl ${action === "reject" ? "bg-danger text-white hover:bg-danger/90" : ""}`}
          disabled={busy}
          onClick={submit}
        >
          {busy ? "กำลังบันทึก…" : copy.confirm}
        </Button>
      </DialogFooter>
    </>
  );
}

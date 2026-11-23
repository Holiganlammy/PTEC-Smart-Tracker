"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, type Vender } from "@/lib/api";
import { VenderCombobox } from "./vender-combobox";

export type ReassignTarget = {
  id: string;
  jobCode: string;
  jobType: string | null;
  /** บริษัทปัจจุบันของงาน (ไม่ให้เลือกซ้ำ) */
  venderCode: string;
};

type Props = {
  /** งานที่จะย้าย (null = ปิดหน้าต่าง) */
  job: ReassignTarget | null;
  onClose: () => void;
  /** ย้ายสำเร็จ */
  onDone: () => void;
  /** งานเปลี่ยนสถานะไปแล้วโดยคนอื่น (ย้ายไม่ได้แล้ว) */
  onStale?: () => void;
};

/** แอดมินเลือกบริษัทใหม่ให้งาน — งานกลับเป็น "แจ้งงาน" ของบริษัทใหม่ และหายจากรายการของบริษัทเดิม */
export function ReassignDialog({ job, onClose, onDone, onStale }: Props) {
  return (
    <Dialog open={job !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        {job && <ReassignForm key={job.id} job={job} onClose={onClose} onDone={onDone} onStale={onStale} />}
      </DialogContent>
    </Dialog>
  );
}

function ReassignForm({
  job,
  onClose,
  onDone,
  onStale,
}: {
  job: ReassignTarget;
  onClose: () => void;
  onDone: () => void;
  onStale?: () => void;
}) {
  const [venders, setVenders] = useState<Vender[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [venderCode, setVenderCode] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

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

  const current = venders?.find((v) => v.venderCode === job.venderCode) ?? null;
  const options = useMemo(() => venders?.filter((v) => v.venderCode !== job.venderCode) ?? [], [venders, job.venderCode]);
  const target = options.find((v) => v.venderCode === venderCode) ?? null;

  async function submit() {
    if (!target) return;
    setBusy(true);
    try {
      await api.reassignJob(job.id, { venderCode: target.venderCode, note: note.trim() || undefined });
      toast.success(`ย้ายงานไปให้ ${target.venderName} แล้ว`, { description: job.jobCode });
      onDone();
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.info("งานนี้เปลี่ยนสถานะไปแล้ว", { description: "ย้ายบริษัทไม่ได้ในสถานะปัจจุบัน ระบบโหลดข้อมูลใหม่ให้" });
        onStale?.();
        onClose();
      } else {
        toast.error("ย้ายงานไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogDescription className="font-mono text-xs">{job.jobCode}</DialogDescription>
        <DialogTitle className="text-left">เปลี่ยนบริษัทผู้รับเหมา</DialogTitle>
        <DialogDescription className="text-left">
          {job.jobType ? `${job.jobType} · ` : ""}
          งานจะกลับเป็น “แจ้งงาน” ของบริษัทใหม่ และหายจากรายการของ{current ? ` ${current.venderName}` : "บริษัทเดิม"} ประวัติ รูป
          และแชทของบริษัทเดิม บริษัทใหม่จะไม่เห็น (แอดมินยังเห็นทั้งหมด)
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 text-sm">
        <div className="space-y-1.5">
          <Label htmlFor="reassign-vender">
            บริษัทใหม่ <span className="text-danger">*</span>
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
            <VenderCombobox id="reassign-vender" venders={options} value={venderCode} onChange={setVenderCode} disabled={busy} />
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reassign-note">หมายเหตุ (ภายใน ไม่แสดงให้บริษัทใหม่เห็น)</Label>
          <Textarea
            id="reassign-note"
            value={note}
            rows={3}
            maxLength={500}
            disabled={busy}
            placeholder="เช่น บริษัทเดิมไม่มีช่างว่าง ย้ายตามที่คุยกับคนจ่ายงาน"
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" className="h-11 rounded-xl" disabled={busy} onClick={onClose}>
          ยกเลิก
        </Button>
        <Button className="h-11 rounded-xl" disabled={busy || !target} onClick={() => void submit()}>
          {busy ? "กำลังย้ายงาน…" : "ย้ายงาน"}
        </Button>
      </DialogFooter>
    </>
  );
}

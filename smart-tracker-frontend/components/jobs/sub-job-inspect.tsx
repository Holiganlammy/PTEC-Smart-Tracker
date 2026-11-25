"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, type JobDetail, type SubJob } from "@/lib/api";

export type InspectMode = "approve" | "rework";

type InspectSub = Pick<SubJob, "id" | "venderCode" | "venderName">;

export function InspectForm({
  parentId,
  sub,
  mode,
  onDone,
  onStale,
  onBack,
  backLabel = "ย้อนกลับ",
}: {
  parentId: string;
  sub: InspectSub;
  mode: InspectMode;
  /** บันทึกสำเร็จ ได้รายละเอียดงานแม่ล่าสุด */
  onDone: (parent: JobDetail) => void;
  /** งานย่อยถูกตรวจไปแล้วโดยคนอื่น → โหลดใหม่ */
  onStale: () => void;
  onBack: () => void;
  backLabel?: string;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const rework = mode === "rework";
  const valid = !rework || note.trim().length > 0;

  async function submit() {
    if (!valid) return;
    setBusy(true);
    try {
      const parent = await api.inspectSubJob(parentId, sub.id, { result: mode, note: note.trim() || undefined });
      toast.success(rework ? "ตีกลับให้แก้ไขแล้ว" : "ตรวจรับงานย่อยแล้ว", {
        description: sub.venderName ?? sub.venderCode,
      });
      onDone(parent);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.info("บันทึกผลการตรวจไม่ได้", { description: e.message });
        onStale();
      } else {
        toast.error("บันทึกผลการตรวจไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
        setBusy(false);
      }
    }
  }

  return (
    <div className="space-y-2 text-sm">
      <Label htmlFor="inspect-note">
        {rework ? (
          <>
            สิ่งที่ต้องแก้ไข <span className="text-danger">*</span>
          </>
        ) : (
          "หมายเหตุ (ไม่บังคับ)"
        )}
      </Label>
      <Textarea
        id="inspect-note"
        value={note}
        rows={3}
        maxLength={500}
        disabled={busy}
        autoFocus
        placeholder={rework ? "เช่น สายยังไม่เก็บเข้ารางให้เรียบร้อย ถ่ายรูปหลังแก้ไขส่งมาด้วย" : "ไม่บังคับ"}
        onChange={(e) => setNote(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        {rework
          ? "งานจะกลับไปเป็น “กำลังแก้ไข” บริษัทรายย่อยจะเห็นข้อความนี้ และต้องแนบรูปหลังแก้ไขใหม่ตอนส่งงานอีกครั้ง"
          : "งานย่อยจะปิดเป็น “เสร็จสิ้น” และแก้ไขผลการตรวจไม่ได้"}
      </p>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button variant="outline" className="h-11 rounded-xl" disabled={busy} onClick={onBack}>
          {backLabel}
        </Button>
        <Button
          className={`h-11 rounded-xl text-white ${
            rework ? "bg-danger hover:bg-danger/90" : "bg-success hover:bg-success/90"
          }`}
          disabled={busy || !valid}
          onClick={() => void submit()}
        >
          {busy ? "กำลังบันทึก…" : rework ? "ยืนยันตีกลับ" : "ยืนยันตรวจรับ"}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { FileIcon, ImagePlusIcon, Loader2Icon, Maximize2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, type AttatchKind, type JobAttatch, type UploadKind } from "@/lib/api";
import { compressImage } from "@/lib/image";
import { BlobImage } from "./blob-image";
import { EXPANDED_MODAL, ZoomableImage } from "./zoomable-image";

const uploadedAtFormat = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC", // เวลาในฐานข้อมูลเป็นเวลาท้องถิ่น ไม่มี timezone — แสดงตามค่าที่เก็บ
});

/**
 * รูปของหนึ่งขั้นตอน (kind) ตาม Figma: รูปย่อ + กล่อง "แนบรูป" (ถ้ามีสิทธิ์) แถวเดียวกัน แล้วข้อความสรุปใต้รูป
 * กดรูปเพื่อดูขยาย — ปุ่ม "ลบรูปนี้" อยู่ในหน้าต่างดูรูป
 *  - รูปจาก OPS/ของเราดึงผ่าน API ที่ตรวจสิทธิ์ (ต้องแนบ token) แล้วแสดงเป็น object URL
 *  - อัปโหลดสำเร็จ/ลบสำเร็จ แจ้งกลับผ่าน onChange เพื่อให้หน้าอัปเดตรายการทันที
 */
export function JobPhotos({
  jobId,
  kind,
  stepTitle,
  attachments,
  uploadable,
  onChange,
}: {
  jobId: string;
  kind: AttatchKind;
  /** ชื่อขั้นตอน ใช้เป็นหัวหน้าต่างดูรูป (เช่น "กำลังดำเนินการ") */
  stepTitle: string;
  attachments: JobAttatch[];
  /** true = ผู้ใช้อัปโหลดเพิ่มในขั้นนี้ได้ (kind ต้องเป็น UploadKind) */
  uploadable: boolean;
  onChange: (next: JobAttatch[]) => void;
}) {
  // ไทม์ไลน์แสดงเฉพาะรูป — ไฟล์เอกสารจาก OPS (PDF/Excel ฯลฯ) อยู่ในการ์ด "ไฟล์แนบ" ด้านล่าง (JobFiles)
  const items = attachments.filter((a) => a.kind === kind && a.isImage);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewing, setViewing] = useState<JobAttatch | null>(null);
  const [expanded, setExpanded] = useState(false); // modal ดูรูป: เล็ก ↔ ขยายเต็มจอ (ซูมได้)

  if (items.length === 0 && !uploadable) return null;

  function openViewer(a: JobAttatch) {
    setExpanded(false);
    setViewing(a);
  }

  function closeViewer() {
    setViewing(null);
    setExpanded(false);
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ""; // เลือกไฟล์เดิมซ้ำได้
    if (picked.length === 0) return;
    setBusy(true);
    try {
      const files = await Promise.all(picked.map(compressImage));
      const saved = await api.uploadJobFiles(jobId, kind as UploadKind, files);
      onChange([...attachments, ...saved]);
      toast.success(`อัปโหลดแล้ว ${saved.length} รูป`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(a: JobAttatch) {
    if (!window.confirm("ลบรูปนี้?")) return;
    setDeleting(true);
    try {
      await api.deleteJobFile(jobId, a.id);
      onChange(attachments.filter((x) => x.id !== a.id));
      closeViewer();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mt-2.5 space-y-2">
      <div className="flex flex-wrap gap-2.5">
        {items.map((a) => (
          <Thumb key={a.id} jobId={jobId} item={a} onOpen={() => openViewer(a)} />
        ))}
        {uploadable && (
          <>
            <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={onPick} />
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="flex size-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60"
            >
              {busy ? <Loader2Icon className="size-4 animate-spin" /> : <ImagePlusIcon className="size-4" />}
              <span className="text-[10px] leading-none">{busy ? "กำลังส่ง…" : "แนบรูป"}</span>
            </button>
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {items.length > 0 ? `แนบรูปแล้ว ${items.length} รูป · กดที่รูปเพื่อดูขยาย` : "ยังไม่มีรูปในขั้นตอนนี้"}
      </p>

      <Dialog open={viewing !== null} onOpenChange={(o) => !o && !deleting && closeViewer()}>
        {/* grid-cols-[minmax(0,1fr)]: ชื่อไฟล์ยาวไม่ดันเนื้อหาให้กว้างเกินกรอบ modal */}
        <DialogContent className={expanded ? EXPANDED_MODAL : "max-h-[90dvh] grid-cols-[minmax(0,1fr)] overflow-y-auto"}>
          <DialogHeader className={expanded ? "shrink-0 pr-8" : undefined}>
            <DialogDescription className="text-left text-xs font-medium">รูปแนบ · {stepTitle}</DialogDescription>
            <DialogTitle className="text-left leading-snug break-all">{viewing?.originalName ?? "รูปภาพ"}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <>
              {expanded ? (
                <ZoomableImage jobId={jobId} item={viewing} onShrink={() => setExpanded(false)} />
              ) : (
                <div className="relative">
                  <BlobImage jobId={jobId} item={viewing} className="w-full rounded-2xl border" />
                  <button
                    type="button"
                    aria-label="ขยายรูปเต็มจอและซูม"
                    onClick={() => setExpanded(true)}
                    className="absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/75"
                  >
                    <Maximize2Icon className="size-3.5" />
                    ขยาย
                  </button>
                </div>
              )}
              <p className="shrink-0 text-xs text-muted-foreground">
                {viewing.source === "ops" ? "จาก OPS" : `แนบโดย ${viewing.uploadedByName ?? "ไม่ทราบชื่อ"}`}
                {" · "}
                {uploadedAtFormat.format(new Date(viewing.createdAt))} น.
              </p>
              {viewing.canDelete && (
                <Button className="h-10 shrink-0 self-start rounded-xl px-5" disabled={deleting} onClick={() => onDelete(viewing)}>
                  {deleting ? "กำลังลบ…" : "ลบรูปนี้"}
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Thumb({ jobId, item, onOpen }: { jobId: string; item: JobAttatch; onOpen: () => void }) {
  if (!item.isImage) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex size-14 flex-col items-center justify-center gap-0.5 rounded-xl border bg-muted p-1 text-[10px] text-muted-foreground"
      >
        <FileIcon className="size-4" />
        <span className="line-clamp-1 w-full break-all">{item.originalName ?? "ไฟล์"}</span>
      </button>
    );
  }
  return (
    <button type="button" onClick={onOpen} className="block size-14 overflow-hidden rounded-xl border bg-muted">
      <BlobImage jobId={jobId} item={item} className="size-full object-cover" />
    </button>
  );
}

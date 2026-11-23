"use client";

import { useState } from "react";
import { CameraIcon, FileIcon, FileSpreadsheetIcon, FileTextIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, type JobAttatch } from "@/lib/api";
import { BlobImage } from "./job-photos";

type FileType = "image" | "pdf" | "sheet" | "doc" | "other";

const TYPE_LABEL: Record<FileType, string> = {
  image: "รูปภาพ",
  pdf: "PDF",
  sheet: "Excel",
  doc: "เอกสาร",
  other: "ไฟล์",
};

const TYPE_ICON: Record<FileType, React.ComponentType<{ className?: string }>> = {
  image: CameraIcon,
  pdf: FileTextIcon,
  sheet: FileSpreadsheetIcon,
  doc: FileTextIcon,
  other: FileIcon,
};

function fileType(a: JobAttatch): FileType {
  if (a.isImage) return "image";
  const ext = (a.originalName ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (a.mimeType === "application/pdf" || ext === "pdf") return "pdf";
  if (["xls", "xlsx", "csv"].includes(ext)) return "sheet";
  if (["doc", "docx", "ppt", "pptx", "txt"].includes(ext)) return "doc";
  return "other";
}

/** ขนาดไฟล์แบบอ่านง่าย (ไฟล์จาก OPS ไม่มีขนาดในฐานข้อมูล จึงอาจเป็น null) */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * การ์ด "ไฟล์แนบ" (Figma): ไฟล์ที่ OPS แนบมากับงาน (รูป/PDF/Excel ฯลฯ) แถวละไฟล์ ชื่อ + ขนาด
 * แสดงการ์ดเสมอ แม้ไม่มีไฟล์ (ขึ้นข้อความว่าไม่มี) เพื่อให้หน้ารายละเอียดมีโครงครบตาม Figma
 *  - รูป: กดเพื่อดูขยาย
 *  - PDF: เปิดในแท็บใหม่
 *  - ไฟล์อื่น (Excel/Word ฯลฯ): ดาวน์โหลดไปเปิดเอง
 * ไฟล์ดึงผ่าน API ที่ตรวจสิทธิ์ (ต้องแนบ token) แล้วทำ object URL จึงเปิดด้วยลิงก์ตรง ๆ ไม่ได้
 * รูปที่ผู้รับเหมาถ่ายในแต่ละขั้นตอนอยู่ในไทม์ไลน์ (JobPhotos) ไม่ได้อยู่ในการ์ดนี้
 */
export function JobFiles({ jobId, attachments }: { jobId: string; attachments: JobAttatch[] }) {
  const [viewing, setViewing] = useState<JobAttatch | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const files = attachments.filter((a) => a.kind === "report" || a.kind === "document");

  async function onOpen(a: JobAttatch) {
    const type = fileType(a);
    if (type === "image") {
      setViewing(a);
      return;
    }
    setBusyId(a.id);
    try {
      const blob = await api.getJobFile(jobId, a.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      if (type === "pdf") {
        link.target = "_blank";
        link.rel = "noopener";
      } else {
        link.download = a.originalName ?? "ไฟล์แนบ";
      }
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000); // เผื่อแท็บใหม่/ตัวดาวน์โหลดยังอ่านอยู่
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เปิดไฟล์ไม่ได้");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <h3 className="mb-1 font-heading text-base font-medium">ไฟล์แนบ</h3>
      {files.length === 0 && <p className="py-3 text-sm text-muted-foreground">ไม่มีไฟล์แนบจาก OPS</p>}
      <ul className="divide-y">
        {files.map((a) => {
          const type = fileType(a);
          const Icon = TYPE_ICON[type];
          const busy = busyId === a.id;
          return (
            <li key={a.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onOpen(a)}
                className="flex w-full items-center gap-3 py-3 text-left text-sm transition-colors hover:text-brand disabled:opacity-60"
              >
                {busy ? (
                  <Loader2Icon className="size-5 shrink-0 animate-spin" />
                ) : (
                  <Icon className="size-5 shrink-0" />
                )}
                <span className="min-w-0 flex-1 truncate">{a.originalName ?? "ไฟล์แนบ"}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {a.sizeBytes !== null ? formatSize(a.sizeBytes) : TYPE_LABEL[type]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <Dialog open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogDescription className="text-left text-xs font-medium">ไฟล์แนบ</DialogDescription>
            <DialogTitle className="text-left break-all">{viewing?.originalName ?? "รูปภาพ"}</DialogTitle>
          </DialogHeader>
          {viewing && <BlobImage jobId={jobId} item={viewing} className="w-full rounded-2xl border" />}
        </DialogContent>
      </Dialog>
    </section>
  );
}

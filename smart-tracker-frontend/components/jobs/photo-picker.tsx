"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlusIcon, Loader2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/image";

/**
 * เลือกรูปไว้ก่อน (ยังไม่อัปโหลด) — ใช้ในหน้าที่ส่งรูปพร้อมการเปลี่ยนสถานะ (รับงาน / ส่งงานซ่อม)
 * ย่อรูปในเครื่องก่อน แล้วให้ผู้เรียกส่งไปพร้อมคำขอเดียว
 */
export function PhotoPicker({
  files,
  onChange,
  max = 10,
  disabled = false,
  invalid = false,
}: {
  files: File[];
  onChange: (next: File[]) => void;
  max?: number;
  disabled?: boolean;
  /** true = กรอบแดง (เช่นช่องบังคับที่ยังไม่มีรูป) */
  invalid?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ""; // เลือกไฟล์เดิมซ้ำได้
    if (picked.length === 0) return;
    const room = max - files.length;
    if (picked.length > room) {
      toast.error(`แนบได้สูงสุด ${max} รูป`);
    }
    setBusy(true);
    try {
      const added = await Promise.all(picked.slice(0, Math.max(room, 0)).map(compressImage));
      onChange([...files, ...added]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {files.map((f, i) => (
        <Preview key={`${f.name}-${f.lastModified}-${i}`} file={f} onRemove={() => onChange(files.filter((_, j) => j !== i))} disabled={disabled} />
      ))}
      {files.length < max && (
        <>
          <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={onPick} />
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
            className={`flex size-16 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed text-[11px] text-muted-foreground disabled:opacity-60 ${
              invalid ? "border-danger text-danger" : ""
            }`}
          >
            {busy ? <Loader2Icon className="size-5 animate-spin" /> : <ImagePlusIcon className="size-5" />}
            {busy ? "กำลังย่อ…" : "แนบรูป"}
          </button>
        </>
      )}
    </div>
  );
}

function Preview({ file, onRemove, disabled }: { file: File; onRemove: () => void; disabled: boolean }) {
  const [src, setSrc] = useState<string | null>(null);

  // อ่านเป็น data URL (ไม่ต้องจัดการ revoke) — รูปผ่านการย่อมาแล้ว ขนาดไม่ใหญ่
  useEffect(() => {
    const reader = new FileReader();
    reader.onload = () => setSrc(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
    return () => reader.abort();
  }, [file]);

  return (
    <div className="relative size-16">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob URL ใช้ next/image ไม่ได้
        <img src={src} alt={file.name} className="size-full rounded-xl border object-cover" />
      ) : (
        <span className="block size-full animate-pulse rounded-xl bg-muted" />
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        aria-label="เอารูปออก"
        className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-danger text-white shadow disabled:opacity-60"
      >
        <XIcon className="size-3" />
      </button>
    </div>
  );
}

"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api, type JobAttatch } from "@/lib/api";

/**
 * วิธีดึงตัวไฟล์ของงาน — ค่าเริ่มต้นดึงจาก /jobs/:id/attachments/:attId/file
 * modal ประวัติงานย่อยครอบด้วย Provider ให้ดึงผ่านงานแม่แทน (ผู้รับเหมาหลักเปิดไฟล์ของงานย่อยตรง ๆ ไม่ได้)
 */
export const JobFileLoader = createContext<(jobId: string, attId: string) => Promise<Blob>>(api.getJobFile);

/** รูปที่ดึงผ่าน API ที่ต้องมี token (img src ธรรมดาแนบ Authorization ไม่ได้) */
export function BlobImage({ jobId, item, className }: { jobId: string; item: JobAttatch; className?: string }) {
  const load = useContext(JobFileLoader);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    load(jobId, item.id)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [load, jobId, item.id]);

  if (failed) {
    return <span className="grid size-full min-h-14 place-items-center p-1 text-center text-[10px] text-muted-foreground">โหลดรูปไม่ได้</span>;
  }
  if (!src) return <span className="block size-full min-h-14 animate-pulse bg-muted" />;
  // eslint-disable-next-line @next/next/no-img-element -- blob URL ใช้ next/image ไม่ได้
  return <img src={src} alt={item.originalName ?? "รูปงาน"} className={className} />;
}

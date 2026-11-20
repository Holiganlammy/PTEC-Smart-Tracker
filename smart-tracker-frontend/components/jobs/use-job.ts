"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, type JobDetail } from "@/lib/api";
import { useMemberGate } from "@/lib/use-member-gate";

/** โหลดรายละเอียดงาน (หลังผ่านเกต สมาชิก) — ใช้ร่วมกันระหว่างหน้า detail และหน้าส่งงานซ่อม */
export function useJob(id: string) {
  const gate = useMemberGate();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ready = gate.name === "ready";

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    api
      .getJob(id)
      .then((j) => !cancelled && setJob(j))
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(
          e instanceof ApiError && (e.status === 404 || e.status === 400)
            ? "ไม่พบงานนี้ หรือคุณไม่มีสิทธิ์ดูงานนี้"
            : e instanceof Error
              ? e.message
              : "โหลดงานไม่สำเร็จ",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [ready, id]);

  /** โหลดซ้ำเงียบ ๆ (เช่นหลังรู้ว่าสถานะงานเปลี่ยนไปแล้ว) */
  const reload = useCallback(() => {
    api
      .getJob(id)
      .then(setJob)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "โหลดงานไม่สำเร็จ"));
  }, [id]);

  return { gate, job, setJob, error, reload };
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, type RegisteredMe } from "@/lib/api";
import { ensureSession } from "@/lib/auth";

export type MemberGate =
  | { name: "loading" }
  | { name: "error"; message: string }
  | { name: "ready"; me: RegisteredMe };

/**
 * ล็อกอิน LINE แล้วเช็กว่าเป็นสมาชิกที่ใช้งานได้ (ลงทะเบียน + อนุมัติ + เปิดใช้งาน)
 * ไม่ผ่าน → พาไปหน้า /register ที่แสดงสถานะ
 */
export function useMemberGate(): MemberGate {
  const router = useRouter();
  const [gate, setGate] = useState<MemberGate>({ name: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!(await ensureSession()) || cancelled) return; // false = กำลังพาไปล็อกอิน LINE

        const me = await api.getMe();
        if (cancelled) return;

        if (!me.registered) {
          toast.warning("ยังไม่ได้ลงทะเบียน", {
            description: "กรุณาลงทะเบียนก่อนเริ่มใช้งานระบบ",
          });
          router.replace("/register");
          return;
        }
        if (me.status !== "approved" || !me.active) {
          router.replace("/register"); // รออนุมัติ / ไม่อนุมัติ / ปิดใช้งาน
          return;
        }
        setGate({ name: "ready", me });
      } catch (e) {
        if (!cancelled) {
          setGate({ name: "error", message: e instanceof Error ? e.message : "เกิดข้อผิดพลาด" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return gate;
}

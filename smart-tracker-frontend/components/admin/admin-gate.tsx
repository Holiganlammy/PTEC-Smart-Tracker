"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { ensureSession } from "@/lib/auth";
import { AccessDenied, getDeniedReason, type DeniedReason } from "./access-denied";

export type AdminGate =
  | { name: "loading" }
  | { name: "error"; message: string }
  | { name: "denied"; reason: DeniedReason; roleName?: string }
  | { name: "ready"; adminId: string };

/** ล็อกอิน แล้วเช็กว่าผู้ใช้เป็น admin ที่อนุมัติแล้วและเปิดใช้งานอยู่ — ใช้กับทุกหน้าของผู้ดูแลระบบ */
export function useAdminGate(): AdminGate {
  const [gate, setGate] = useState<AdminGate>({ name: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!(await ensureSession()) || cancelled) return; // false = กำลังพาไปล็อกอิน LINE

        const me = await api.getMe();
        if (cancelled) return;
        const reason = getDeniedReason(me);
        if (reason || !me.registered) {
          setGate({
            name: "denied",
            reason: reason ?? "not-registered",
            roleName: me.registered ? me.roleName : undefined,
          });
          return;
        }
        setGate({ name: "ready", adminId: me.id });
      } catch (e) {
        if (!cancelled) {
          setGate({ name: "error", message: e instanceof Error ? e.message : "เกิดข้อผิดพลาด" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return gate;
}

/** หน้าที่แสดงแทนเนื้อหา เมื่อ gate ยังไม่ ready (กำลังโหลด / error / เข้าไม่ได้) */
export function GateScreen({ gate }: { gate: Exclude<AdminGate, { name: "ready" }> }) {
  if (gate.name === "loading") {
    return <p className="p-8 text-center text-sm text-muted-foreground">กำลังโหลด…</p>;
  }
  if (gate.name === "denied") {
    return <AccessDenied reason={gate.reason} roleName={gate.roleName} />;
  }
  return (
    <div className="space-y-3 p-8 text-center">
      <p className="text-sm text-danger">{gate.message}</p>
      <Button variant="outline" onClick={() => location.reload()}>
        ลองอีกครั้ง
      </Button>
    </div>
  );
}

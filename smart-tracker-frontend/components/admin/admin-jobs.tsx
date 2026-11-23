"use client";

import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { GateScreen, useAdminGate } from "./admin-gate";
import { JobReview } from "./job-review";
import { RejectedJobs } from "./rejected-jobs";

type Tab = "review" | "rejected";

/** หน้าจัดการงานของแอดมิน: รอตรวจ (งานจาก OPS) และ รอจ่ายใหม่ (งานที่บริษัทปฏิเสธ) */
export function AdminJobs() {
  const gate = useAdminGate();
  const [tab, setTab] = useState<Tab>("review");
  const [counts, setCounts] = useState<Record<Tab, number | null>>({ review: null, rejected: null });

  const ready = gate.name === "ready";
  // จำนวนของทั้งสองแท็บ (แท็บที่เปิดอยู่จะอัปเดตเองเมื่อมีการทำรายการ)
  useEffect(() => {
    if (!ready) return;
    api
      .getReviewCount()
      .then((c) => setCounts((p) => ({ ...p, review: c.pending })))
      .catch(() => {});
    api
      .listRejectedJobs({ pageSize: 1 })
      .then((r) => setCounts((p) => ({ ...p, rejected: r.total })))
      .catch(() => {});
  }, [ready]);

  const onReviewTotal = useCallback((n: number) => setCounts((p) => (p.review === n ? p : { ...p, review: n })), []);
  const onRejectedTotal = useCallback((n: number) => setCounts((p) => (p.rejected === n ? p : { ...p, rejected: n })), []);

  if (gate.name !== "ready") return <GateScreen gate={gate} />;

  const tabs: { value: Tab; label: string }[] = [
    { value: "review", label: "รอตรวจ" },
    { value: "rejected", label: "รอจ่ายใหม่" },
  ];

  return (
    <div className="space-y-1 p-4 pb-0">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="grid h-auto group-data-horizontal/tabs:h-auto w-full grid-cols-2 rounded-2xl p-1">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="h-auto gap-1.5 rounded-xl py-2.5 text-sm">
              {t.label}
              {counts[t.value] !== null && (
                <span
                  className={`rounded-full px-1.5 text-xs tabular-nums ${
                    t.value === "rejected" && (counts.rejected ?? 0) > 0
                      ? "bg-danger/10 text-danger"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {counts[t.value]?.toLocaleString("th-TH")}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* แต่ละแท็บมีช่องไฟของตัวเอง (p-4) เหมือนเดิม จึงดึงขึ้นให้ชิดแท็บ */}
      <div className="-mx-4 -mt-1">
        {tab === "review" ? <JobReview onTotal={onReviewTotal} /> : <div className="px-4 pt-3 pb-4"><RejectedJobs onTotal={onRejectedTotal} /></div>}
      </div>
    </div>
  );
}

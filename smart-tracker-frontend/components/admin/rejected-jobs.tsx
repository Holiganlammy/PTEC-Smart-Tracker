"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { InboxIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { JobCard } from "@/components/jobs/job-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type RejectedJob } from "@/lib/api";
import { ReassignDialog } from "./reassign-dialog";

const rejectedAtFormat = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC", // เวลาในฐานข้อมูลเป็นเวลาท้องถิ่น ไม่มี timezone — แสดงตามค่าที่เก็บ
});

/**
 * คิว "รอจ่ายใหม่" (แอดมิน): งานที่บริษัทปฏิเสธ
 * แอดมินเปิดดูงาน/พิมพ์ถามเหตุผลในแชท หรือเปลี่ยนบริษัท — งานจะกลับเป็น "แจ้งงาน" ของบริษัทใหม่
 * (ต้องเรียกเมื่อผ่านตรวจสิทธิ์แอดมินแล้วเท่านั้น — ตัวห่อ AdminJobs ตรวจให้)
 */
export function RejectedJobs({ onTotal }: { onTotal?: (total: number) => void }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [jobs, setJobs] = useState<RejectedJob[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moving, setMoving] = useState<RejectedJob | null>(null);
  const requestId = useRef(0); // กันผลของคำขอเก่าเขียนทับของใหม่

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(
    async (nextPage: number) => {
      const id = ++requestId.current;
      try {
        const res = await api.listRejectedJobs({ q: debouncedQuery || undefined, page: nextPage });
        if (id !== requestId.current) return;
        setError(null);
        setTotal(res.total);
        setPage(res.page);
        setJobs((prev) => (nextPage === 1 || !prev ? res.items : [...prev, ...res.items]));
      } catch (e) {
        if (id !== requestId.current) return;
        const message = e instanceof Error ? e.message : "โหลดรายการไม่สำเร็จ";
        if (nextPage === 1) setError(message);
        else toast.error("โหลดเพิ่มไม่สำเร็จ", { description: message });
      }
    },
    [debouncedQuery],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(1);
  }, [load]);

  // แจ้งจำนวนให้ป้ายบนแท็บ (เฉพาะตอนไม่ได้ค้นหา — จำนวนตอนค้นหาไม่ใช่จำนวนทั้งหมด)
  useEffect(() => {
    if (jobs !== null && debouncedQuery === "") onTotal?.(total);
  }, [jobs, total, debouncedQuery, onTotal]);

  async function loadMore() {
    setLoadingMore(true);
    await load(page + 1);
    setLoadingMore(false);
  }

  function removeFromQueue(id: string) {
    setJobs((prev) => prev?.filter((j) => j.id !== id) ?? prev);
    setTotal((t) => Math.max(0, t - 1));
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาเลขงาน หรือรายละเอียด"
          className="h-11 rounded-xl pl-9"
        />
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <p className="text-sm text-danger">{error}</p>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              setError(null);
              setJobs(null);
              void load(1);
            }}
          >
            ลองอีกครั้ง
          </Button>
        </div>
      ) : jobs === null ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-14 text-center text-muted-foreground">
          <InboxIcon className="size-10 stroke-1" />
          <p className="text-sm">ไม่มีงานที่ถูกปฏิเสธ รอจ่ายใหม่</p>
        </div>
      ) : (
        <>
          <p className="px-1 text-xs text-muted-foreground">
            รอจ่ายใหม่ {total.toLocaleString("th-TH")} งาน (เรียงจากเก่าสุดก่อน)
          </p>
          <div className="space-y-3">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                venderName={job.venderName}
                footer={
                  <div className="space-y-3 border-t pt-3">
                    <div className="space-y-1 rounded-xl bg-danger/10 px-3 py-2.5 text-sm">
                      <p className="font-medium text-danger">
                        {job.venderName ?? "บริษัท"} ปฏิเสธงาน{job.afterAccept ? " (หลังรับงานแล้ว)" : ""}
                      </p>
                      <p className="whitespace-pre-line">เหตุผล: {job.reason ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {[job.rejectedByName, job.rejectedAt ? rejectedAtFormat.format(new Date(job.rejectedAt)) : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="h-10 rounded-xl"
                        nativeButton={false}
                        render={<Link href={`/jobs/${job.id}`} />}
                      >
                        เปิดดูงาน / แชท
                      </Button>
                      <Button className="h-10 rounded-xl" onClick={() => setMoving(job)}>
                        เปลี่ยนบริษัท
                      </Button>
                    </div>
                  </div>
                }
              />
            ))}
          </div>
          {jobs.length < total && (
            <Button
              variant="outline"
              className="h-11 w-full rounded-xl"
              disabled={loadingMore}
              onClick={() => void loadMore()}
            >
              {loadingMore ? "กำลังโหลด…" : "โหลดเพิ่ม"}
            </Button>
          )}
        </>
      )}

      <ReassignDialog
        job={moving ? { id: moving.id, jobCode: moving.jobCode, jobType: moving.jobType, venderCode: moving.venderCode } : null}
        onClose={() => setMoving(null)}
        onDone={() => moving && removeFromQueue(moving.id)}
        onStale={() => moving && removeFromQueue(moving.id)}
      />
    </div>
  );
}

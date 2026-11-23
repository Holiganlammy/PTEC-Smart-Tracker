"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckIcon, InboxIcon, PencilIcon, SearchIcon, Undo2Icon } from "lucide-react";
import { toast } from "sonner";
import { JobCard } from "@/components/jobs/job-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError, type ReviewJob } from "@/lib/api";
import { GateScreen, useAdminGate } from "./admin-gate";
import { JobEditDialog } from "./job-edit-dialog";
import { RejectDialog } from "./reject-dialog";

/** คิวตรวจงานจาก OPS (เฉพาะ admin): อนุมัติ = ส่งให้ผู้รับเหมา, ตีกลับ = ส่งกลับพร้อมเหตุผล */
export function JobReview({ onTotal }: { onTotal?: (total: number) => void } = {}) {
  const gate = useAdminGate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [jobs, setJobs] = useState<ReviewJob[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [returning, setReturning] = useState<ReviewJob | null>(null);
  const [editing, setEditing] = useState<ReviewJob | null>(null);
  const requestId = useRef(0); // กันผลของคำขอเก่าเขียนทับของใหม่

  // หน่วงคำค้นเล็กน้อยก่อนยิง API
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(
    async (nextPage: number) => {
      const id = ++requestId.current;
      try {
        const res = await api.listReviewJobs({ q: debouncedQuery || undefined, page: nextPage });
        if (id !== requestId.current) return;
        setError(null);
        setTotal(res.total);
        setPage(res.page);
        setJobs((prev) => (nextPage === 1 || !prev ? res.items : [...prev, ...res.items]));
      } catch (e) {
        if (id !== requestId.current) return;
        const message = e instanceof Error ? e.message : "โหลดคิวตรวจไม่สำเร็จ";
        if (nextPage === 1) setError(message);
        else toast.error("โหลดเพิ่มไม่สำเร็จ", { description: message });
      }
    },
    [debouncedQuery],
  );

  const ready = gate.name === "ready";
  useEffect(() => {
    if (!ready) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(1);
  }, [ready, load]);

  // แจ้งจำนวนให้ป้ายบนแท็บ (เฉพาะตอนไม่ได้ค้นหา — จำนวนตอนค้นหาไม่ใช่จำนวนทั้งหมด)
  useEffect(() => {
    if (jobs !== null && debouncedQuery === "") onTotal?.(total);
  }, [jobs, total, debouncedQuery, onTotal]);

  async function loadMore() {
    setLoadingMore(true);
    await load(page + 1);
    setLoadingMore(false);
  }

  /** ทำรายการกับงานหนึ่งใบ แล้วเอาออกจากคิวเมื่อสำเร็จ (หรือเมื่องานถูกตรวจไปแล้วโดยคนอื่น) */
  async function act(job: ReviewJob, run: () => Promise<unknown>, successMessage: string) {
    setBusyId(job.id);
    try {
      await run();
      toast.success(successMessage, { description: job.jobCode });
      removeFromQueue(job.id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.info("งานนี้ถูกตรวจไปแล้ว", { description: "ระบบนำออกจากคิวให้แล้ว" });
        removeFromQueue(job.id);
      } else {
        toast.error("ทำรายการไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
        throw e;
      }
    } finally {
      setBusyId(null);
    }
  }

  function removeFromQueue(id: string) {
    setJobs((prev) => prev?.filter((j) => j.id !== id) ?? prev);
    setTotal((t) => Math.max(0, t - 1));
  }

  if (gate.name !== "ready") return <GateScreen gate={gate} />;

  return (
    <div className="space-y-3 p-4">
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
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-14 text-center text-muted-foreground">
          <InboxIcon className="size-10 stroke-1" />
          <p className="text-sm">ไม่มีงานรอตรวจ</p>
        </div>
      ) : (
        <>
          <p className="px-1 text-xs text-muted-foreground">
            รอตรวจ {total.toLocaleString("th-TH")} งาน (เรียงจากเข้ามาก่อน)
          </p>
          <div className="space-y-3">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                venderName={job.venderName}
                footer={
                  <div className="grid grid-cols-3 gap-2 border-t pt-3">
                    <Button
                      variant="outline"
                      className="h-10 rounded-xl"
                      disabled={busyId === job.id}
                      onClick={() => setEditing(job)}
                    >
                      <PencilIcon className="size-4" />
                      แก้ไข
                    </Button>
                    <Button
                      variant="outline"
                      className="h-10 rounded-xl"
                      disabled={busyId === job.id}
                      onClick={() => setReturning(job)}
                    >
                      <Undo2Icon className="size-4" />
                      ตีกลับ
                    </Button>
                    <Button
                      className="h-10 rounded-xl"
                      disabled={busyId === job.id}
                      onClick={() => void act(job, () => api.approveJob(job.id), "อนุมัติแล้ว ส่งให้ผู้รับเหมา").catch(() => {})}
                    >
                      <CheckIcon className="size-4" />
                      อนุมัติ
                    </Button>
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

      <JobEditDialog
        job={editing}
        onClose={() => setEditing(null)}
        onSave={async (job, values) => {
          try {
            await api.updateJob(job.id, values);
          } catch (e) {
            if (e instanceof ApiError && e.status === 409) {
              toast.info("งานนี้ถูกตรวจไปแล้ว", { description: "แก้ไขไม่ได้ ระบบนำออกจากคิวให้แล้ว" });
              removeFromQueue(job.id);
              setEditing(null);
              return;
            }
            toast.error("บันทึกไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
            return; // เปิด dialog ค้างไว้ให้ลองใหม่
          }
          // อัปเดตการ์ดในคิวทันที (ช่องว่าง = ล้างค่า)
          setJobs(
            (prev) =>
              prev?.map((j) =>
                j.id === job.id
                  ? {
                      ...j,
                      jobType: values.jobType.trim() || null,
                      branchName: values.branchName.trim() || null,
                      details: values.details.trim() || null,
                      brand: values.brand.trim() || null,
                      model: values.model.trim() || null,
                      reporterName: values.reporterName.trim() || null,
                      reporterPhone: values.reporterPhone.trim() || null,
                      address: values.address.trim() || null,
                    }
                  : j,
              ) ?? prev,
          );
          toast.success("บันทึกแล้ว", { description: job.jobCode });
          setEditing(null);
        }}
      />

      <RejectDialog
        subject={returning ? `${returning.jobCode}${returning.jobType ? ` · ${returning.jobType}` : ""}` : null}
        title="ตีกลับงาน"
        label="เหตุผลที่ตีกลับ"
        placeholder="เช่น รายละเอียดงานไม่ครบ ระบุผู้รับเหมาไม่ถูกต้อง"
        confirmLabel="ยืนยันตีกลับ"
        onClose={() => setReturning(null)}
        onConfirm={async (note) => {
          if (!returning) return;
          try {
            await act(returning, () => api.returnJob(returning.id, note), "ตีกลับแล้ว");
            setReturning(null);
          } catch {
            // แสดง toast ไปแล้ว — เปิด dialog ค้างไว้ให้ลองใหม่
          }
        }}
      />
    </div>
  );
}

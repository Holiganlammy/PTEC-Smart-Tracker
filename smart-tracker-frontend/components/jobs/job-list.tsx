"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BuildingIcon,
  HashIcon,
  InboxIcon,
  MapPinIcon,
  PackageIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  api,
  RoleId,
  type Job,
  type JobCounts,
  type JobFilterOptions,
  type JobFilters,
  type JobGroup,
} from "@/lib/api";
import { useMemberGate } from "@/lib/use-member-gate";
import { countActiveFilters, EMPTY_FILTERS, JobFilterSheet } from "./job-filter-sheet";


const GROUPS: { value: JobGroup; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "open", label: "ดำเนินการ" },
  { value: "closed", label: "ปิดงาน" },
];

/** สีของสถานะ: chip = ป้ายสถานะ, bar = แถบสีด้านซ้ายของการ์ด */
export const TONES = {
  warning: { chip: "bg-warning-soft text-warning", bar: "bg-warning" },
  brand: { chip: "bg-brand/10 text-brand", bar: "bg-brand" },
  sub: { chip: "bg-sub-accent/10 text-sub-accent", bar: "bg-sub-accent" },
  success: { chip: "bg-success-soft text-success", bar: "bg-success" },
  danger: { chip: "bg-danger/10 text-danger", bar: "bg-danger" },
  muted: { chip: "bg-muted text-muted-foreground", bar: "bg-border" },
} as const;

export const STATUS_TONE: Record<string, keyof typeof TONES> = {
  pending_review: "warning",
  new: "warning",
  accepted: "brand",
  in_progress: "brand",
  waiting_parts: "warning",
  delivered: "sub",
  completed: "success",
  returned: "danger",
  cancelled: "muted",
};

const dateFormat = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "2-digit",
  timeZone: "UTC", // เวลาในฐานข้อมูลเป็นเวลาท้องถิ่น ไม่มี timezone — แสดงตามค่าที่เก็บ
});

const timeFormat = new Intl.DateTimeFormat("th-TH", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

type ViewProps = {
  venderName: string;
  /** ผู้รับเหมาช่วง: เห็นเฉพาะงานที่ได้รับมอบหมาย */
  isSub?: boolean;
  group: JobGroup;
  onGroupChange: (group: JobGroup) => void;
  /** จำนวนงานแต่ละกลุ่ม (null = ยังไม่โหลด) */
  counts: JobCounts | null;
  query: string;
  onQueryChange: (query: string) => void;
  filters: JobFilters;
  filterOptions: JobFilterOptions | null;
  onFiltersChange: (filters: JobFilters) => void;
  /** null = กำลังโหลด */
  jobs: Job[] | null;
  total: number;
  error: string | null;
  loadingMore: boolean;
  onRetry: () => void;
  onLoadMore: () => void;
};

/**
 * ปุ่มท้ายการ์ด (ตาม Figma): งานใหม่ = "ดูและรับงาน", กำลังทำ/รออะไหล่ = "ติดตาม" + "ส่งงาน", อื่น ๆ = "ติดตาม"
 * ปุ่มเหล่านี้แค่พาไปหน้าที่ทำรายการ (สิทธิ์จริงเซิร์ฟเวอร์ตรวจอีกชั้น)
 */
function JobCardActions({ job }: { job: Job }) {
  const detail = `/jobs/${job.id}`;
  const canAccept = job.statusCode === "new";
  const canSubmit = job.statusCode === "in_progress" || job.statusCode === "waiting_parts";
  return (
    <div className="flex gap-2 border-t pt-3">
      {canAccept ? (
        <Button className="h-10 flex-1 rounded-xl" nativeButton={false} render={<Link href={detail} />}>
          ดูและรับงาน
        </Button>
      ) : (
        <>
          <Button variant="outline" className="h-10 flex-1 rounded-xl" nativeButton={false} render={<Link href={detail} />}>
            ติดตาม
          </Button>
          {canSubmit && (
            <Button
              className="h-10 flex-1 rounded-xl bg-success text-white hover:bg-success/90"
              nativeButton={false}
              render={<Link href={`${detail}/submit`} />}
            >
              ส่งงาน
            </Button>
          )}
        </>
      )}
    </div>
  );
}

/** ส่วนแสดงผลของหน้ารายการงาน (ไม่ยุ่งกับ API) */
export function JobListView({
  venderName,
  isSub,
  group,
  onGroupChange,
  counts,
  query,
  onQueryChange,
  filters,
  filterOptions,
  onFiltersChange,
  jobs,
  total,
  error,
  loadingMore,
  onRetry,
  onLoadMore,
}: ViewProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const activeFilters = countActiveFilters(filters);

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2.5 rounded-2xl bg-brand/10 px-3.5 py-3 text-brand">
        <BuildingIcon className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{venderName}</span>
        {isSub && (
          <span className="shrink-0 rounded-full bg-sub-accent/10 px-2.5 py-0.5 text-xs font-medium text-sub-accent">
            ผู้รับเหมาช่วง
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="ค้นหาเลขงาน หรือรายละเอียด"
            className="h-11 rounded-xl pl-9"
          />
        </div>
        <Button
          variant={activeFilters > 0 ? "default" : "outline"}
          className="relative h-11 shrink-0 rounded-xl px-3.5"
          aria-label="ตัวกรอง"
          onClick={() => setFilterOpen(true)}
        >
          <SlidersHorizontalIcon className="size-4" />
          ตัวกรอง
          {activeFilters > 0 && (
            <span className="ml-0.5 grid size-5 place-items-center rounded-full bg-background text-xs font-semibold text-foreground">
              {activeFilters}
            </span>
          )}
        </Button>
      </div>

      <JobFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        options={filterOptions}
        value={filters}
        onApply={onFiltersChange}
      />

      <Tabs value={group} onValueChange={(v) => onGroupChange(v as JobGroup)}>
        <TabsList className="grid h-auto group-data-horizontal/tabs:h-auto w-full grid-cols-3 rounded-2xl p-1">
          {GROUPS.map((g) => (
            <TabsTrigger key={g.value} value={g.value} className="h-auto gap-1.5 rounded-xl py-2.5 text-sm">
              {g.label}
              {counts && (
                <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">
                  {counts[g.value].toLocaleString("th-TH")}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {error ? (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <p className="text-sm text-danger">{error}</p>
          <Button variant="outline" className="rounded-xl" onClick={onRetry}>
            ลองอีกครั้ง
          </Button>
        </div>
      ) : jobs === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-14 text-center text-muted-foreground">
          <InboxIcon className="size-10 stroke-1" />
          <p className="text-sm">
            {isSub && activeFilters === 0 && !query ? "ยังไม่มีงานที่ได้รับมอบหมาย" : "ไม่พบงาน"}
          </p>
        </div>
      ) : (
        <>
          <p className="px-1 text-xs text-muted-foreground">
            แสดง {jobs.length.toLocaleString("th-TH")} จาก {total.toLocaleString("th-TH")} งาน
          </p>
          <div className="space-y-3">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                footer={<JobCardActions job={job} />}
              />
            ))}
          </div>
          {jobs.length < total && (
            <Button
              variant="outline"
              className="h-11 w-full rounded-xl"
              disabled={loadingMore}
              onClick={onLoadMore}
            >
              {loadingMore ? "กำลังโหลด…" : "โหลดเพิ่ม"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

/** การ์ดงาน — `venderName` แสดงชื่อบริษัท (หน้าแอดมิน), `footer` ใส่ปุ่มดำเนินการใต้การ์ด */
export function JobCard({
  job,
  venderName,
  footer,
}: {
  job: Job;
  venderName?: string | null;
  footer?: React.ReactNode;
}) {
  const tone = TONES[STATUS_TONE[job.statusCode] ?? "muted"];
  const requested = new Date(job.requestedAt);
  const device = [job.brand, job.model].filter(Boolean).join(" ");
  const branch = job.branchName ?? job.branchCode;

  return (
    <article className="relative overflow-hidden rounded-2xl border bg-card shadow-sm">
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} />
      <div className="space-y-3 py-4 pr-4 pl-5">
        <div className="flex items-center justify-between gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tone.chip}`}
          >
            <span className="size-1.5 rounded-full bg-current" />
            {job.statusName}
          </span>
          <time dateTime={job.requestedAt} className="text-right text-xs leading-tight text-muted-foreground">
            {dateFormat.format(requested)}
            <span className="block">{timeFormat.format(requested)} น.</span>
          </time>
        </div>

        <div className="space-y-1">
          <h3 className="font-heading text-base leading-snug font-medium">{job.jobType ?? "งานซ่อม"}</h3>
          {job.details && (
            <p className="line-clamp-2 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
              {job.details}
            </p>
          )}
        </div>

        <dl className="space-y-1.5 border-t pt-3 text-xs text-muted-foreground">
          {venderName !== undefined && (
            <Row icon={<BuildingIcon className="size-3.5" />}>
              <span className="truncate font-medium text-foreground">{venderName ?? job.venderCode}</span>
            </Row>
          )}
          {job.assigneeName && (
            <Row icon={<UserIcon className="size-3.5" />}>
              <span className="truncate">
                มอบให้ <span className="font-medium text-foreground">{job.assigneeName}</span>
              </span>
            </Row>
          )}
          {branch && (
            <Row icon={<MapPinIcon className="size-3.5" />}>
              <span className="truncate">{branch}</span>
            </Row>
          )}
          {device && (
            <Row icon={<PackageIcon className="size-3.5" />}>
              <span className="truncate">{device}</span>
            </Row>
          )}
          <Row icon={<HashIcon className="size-3.5" />}>
            <span className="truncate font-mono">
              {job.jobCode}
              {job.opsJobCode && <span className="text-muted-foreground/70"> · OPS {job.opsJobCode}</span>}
            </span>
          </Row>
        </dl>

        {footer}
      </div>
    </article>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0">{icon}</span>
      <div className="flex min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** รายการงานของบริษัทผู้รับเหมาที่ผู้ใช้สังกัด (ผู้รับเหมาช่วงเห็นเฉพาะงานที่ได้รับมอบหมาย) */
export function JobList() {
  const gate = useMemberGate();
  const [group, setGroup] = useState<JobGroup>("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filters, setFilters] = useState<JobFilters>(EMPTY_FILTERS);
  const [filterOptions, setFilterOptions] = useState<JobFilterOptions | null>(null);
  const [counts, setCounts] = useState<JobCounts | null>(null);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        const res = await api.listJobs({ group, q: debouncedQuery || undefined, page: nextPage, filters });
        if (id !== requestId.current) return;
        setError(null);
        setTotal(res.total);
        setPage(res.page);
        if (res.counts) setCounts(res.counts);
        setJobs((prev) => (nextPage === 1 || !prev ? res.items : [...prev, ...res.items]));
      } catch (e) {
        if (id !== requestId.current) return;
        const message = e instanceof Error ? e.message : "โหลดรายการงานไม่สำเร็จ";
        if (nextPage === 1) setError(message);
        else toast.error("โหลดเพิ่มไม่สำเร็จ", { description: message });
      }
    },
    [group, debouncedQuery, filters],
  );

  const ready = gate.name === "ready";
  useEffect(() => {
    if (!ready) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(1);
  }, [ready, load]);

  // ตัวเลือกของตัวกรอง (สถานะ/สาขา) โหลดครั้งเดียว
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    api
      .listJobFilters()
      .then((o) => !cancelled && setFilterOptions(o))
      .catch(() => !cancelled && setFilterOptions({ statuses: [], branches: [] })); // ตัวกรองใช้ไม่ได้ แต่รายการยังดูได้
    return () => {
      cancelled = true;
    };
  }, [ready]);

  async function loadMore() {
    setLoadingMore(true);
    await load(page + 1);
    setLoadingMore(false);
  }

  if (gate.name === "loading") {
    return <p className="p-8 text-center text-sm text-muted-foreground">กำลังโหลด…</p>;
  }
  if (gate.name === "error") {
    return <p className="p-8 text-center text-sm text-danger">{gate.message}</p>;
  }

  return (
    <JobListView
        venderName={gate.me.venderName ?? gate.me.venderCode ?? "ยังไม่ระบุบริษัท"}
        isSub={gate.me.roleId === RoleId.SUB_CONTRACTOR}
        group={group}
        onGroupChange={(g) => {
          setGroup(g);
          setJobs(null); // เปลี่ยนแท็บ → แสดงโครงโหลดแทนรายการเดิม
          setError(null);
        }}
        counts={counts}
        query={query}
        onQueryChange={setQuery}
        filters={filters}
        filterOptions={filterOptions}
        onFiltersChange={(f) => {
          setFilters(f);
          setJobs(null);
          setError(null);
        }}
        jobs={jobs}
        total={total}
        error={error}
        loadingMore={loadingMore}
        onRetry={() => {
          setError(null);
          setJobs(null);
          void load(1);
        }}
        onLoadMore={() => void loadMore()}
      />
  );
}

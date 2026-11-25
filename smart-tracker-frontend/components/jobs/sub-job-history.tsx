"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangleIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  ClockIcon,
  RotateCcwIcon,
  UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type JobDetail, type SubJob, type SubJobHistory } from "@/lib/api";
import { JobFileLoader } from "./blob-image";
import { TONES } from "./job-list";
import { currentStep, formatDuration, Stepper, Timeline } from "./job-timeline";
import { dueRemainingMs, formatSubDue, subStatusOf } from "./sub-job-format";
import { InspectForm, type InspectMode } from "./sub-job-inspect";

const STATUS_REJECTED = 10;

/**
 * modal ติดตามงานย่อย (ปุ่ม "ติดตามงานย่อย" / "ตรวจรับงาน" ในการ์ด "มอบหมายงานผู้รับเหมา" ของหน้างานแม่)
 * แสดงขั้นตอน + สถานะปัจจุบัน + ผู้รับผิดชอบ + ขอบเขตงาน + ประวัติการดำเนินการโดยละเอียดพร้อมรูป
 * งานย่อยที่ส่งมอบแล้ว: ผู้รับเหมาหลัก (เจ้าของงาน/หัวหน้า) หรือแอดมินตรวจรับผ่าน หรือตีกลับให้แก้ไขได้ที่แถบติดล่างของ modal (ที่เดียว)
 */
export function SubJobHistoryDialog({
  parentId,
  sub,
  onClose,
  onChanged,
  onReload,
}: {
  parentId: string;
  /** งานย่อยที่เลือก (null = ปิด) */
  sub: SubJob | null;
  onClose: () => void;
  /** ตรวจรับ/ตีกลับสำเร็จ ได้รายละเอียดงานแม่ล่าสุด */
  onChanged: (job: JobDetail) => void;
  /** งานย่อยถูกตรวจไปแล้วโดยคนอื่น → โหลดงานแม่ใหม่ */
  onReload: () => void;
}) {
  return (
    <Dialog open={sub !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] grid-cols-[minmax(0,1fr)] overflow-y-auto">
        {sub && (
          <SubJobHistoryBody key={sub.id} parentId={parentId} sub={sub} onChanged={onChanged} onReload={onReload} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SubJobHistoryBody({
  parentId,
  sub,
  onChanged,
  onReload,
}: {
  parentId: string;
  sub: SubJob;
  onChanged: (job: JobDetail) => void;
  onReload: () => void;
}) {
  const [data, setData] = useState<SubJobHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    api
      .getSubJobHistory(parentId, sub.id)
      .then((d) => !cancelled && setData(d))
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "โหลดประวัติงานย่อยไม่สำเร็จ");
      });
    return () => {
      cancelled = true;
    };
  }, [parentId, sub.id, attempt]);

  // รูปของงานย่อยต้องดึงผ่านงานแม่ (ผู้รับเหมาหลักอยู่คนละบริษัทกับงานย่อย)
  const loadFile = useCallback((subId: string, attId: string) => api.getSubJobFile(parentId, subId, attId), [parentId]);

  /** หลังตรวจ (หรือพบว่ามีคนตรวจไปแล้ว) โหลดประวัติใหม่ให้เห็นผลล่าสุด */
  function refresh() {
    setData(null);
    setAttempt((n) => n + 1);
  }

  return (
    <>
      <DialogHeader>
        <DialogDescription className="text-left text-xs">{sub.jobCode} · งานย่อย</DialogDescription>
        <DialogTitle className="text-left text-lg leading-snug">{sub.venderName ?? sub.venderCode}</DialogTitle>
      </DialogHeader>

      {error ? (
        <div className="space-y-3 py-6 text-center">
          <p className="text-sm text-danger">{error}</p>
          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          >
            ลองอีกครั้ง
          </Button>
        </div>
      ) : !data ? (
        <div className="space-y-3">
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : (
        <>
          <HistoryContent data={data} now={now} loadFile={loadFile} />
          {data.canInspect && (
            <InspectPanel
              parentId={parentId}
              sub={data}
              onDone={(parent) => {
                onChanged(parent);
                refresh();
              }}
              onStale={() => {
                onReload();
                refresh();
              }}
            />
          )}
        </>
      )}
    </>
  );
}

function HistoryContent({
  data,
  now,
  loadFile,
}: {
  data: SubJobHistory;
  now: number;
  loadFile: (subId: string, attId: string) => Promise<Blob>;
}) {
  const step = currentStep(data);
  const rejected = data.statusId === STATUS_REJECTED;
  const rejection = rejected ? [...data.timeline].reverse().find((e) => e.statusId === STATUS_REJECTED) : undefined;
  const status = subStatusOf(data.statusCode, data.statusName, data.reworking);
  const showDue = data.dueDate !== null && !data.closed && !rejected;
  const remaining = showDue ? dueRemainingMs(data.dueDate!, data.dueTime, now) : 0;

  return (
    <div className="space-y-4 text-sm">
      <Stepper step={step} />

      {rejected ? (
        <section className="space-y-2 rounded-2xl bg-danger/10 p-4 text-danger">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangleIcon className="size-4 shrink-0" />
            บริษัทนี้ปฏิเสธงานย่อย
          </p>
          {rejection?.note && (
            <p className="rounded-lg bg-card px-3 py-2 whitespace-pre-line text-foreground">เหตุผล: {rejection.note}</p>
          )}
        </section>
      ) : (
        <section className={`space-y-1.5 rounded-2xl p-4 ${TONES[status.tone].chip}`}>
          <p className="font-medium">สถานะปัจจุบัน</p>
          <p className="font-heading text-xl font-semibold">{status.label}</p>
          {showDue && (
            <p className="flex items-center gap-1.5">
              <ClockIcon className="size-4 shrink-0" />
              {remaining >= 0
                ? `เหลือ ${formatDuration(remaining)} ถึงกำหนดเสร็จ`
                : `เกินกำหนดเสร็จแล้ว ${formatDuration(remaining)}`}
            </p>
          )}
          {data.reworkCount > 0 && (
            <p className="flex items-center gap-1.5 text-xs">
              <RotateCcwIcon className="size-3.5 shrink-0" />
              ตีกลับให้แก้ไขแล้ว {data.reworkCount} ครั้ง
            </p>
          )}
          {data.canInspect && (
            <p className="text-xs opacity-90">ตรวจรูปและรายละเอียดการซ่อมในประวัติด้านล่าง แล้วกดตรวจรับผ่านหรือตีกลับที่แถบล่างสุด</p>
          )}
        </section>
      )}

      <dl className="space-y-2.5">
        <div className="flex items-start gap-2.5">
          <UserIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">ผู้รับผิดชอบ</dt>
            <dd className="font-medium break-words">
              {data.acceptedByName
                ? [data.acceptedByName, data.acceptedByPhone].filter(Boolean).join(" · ")
                : "ยังไม่มีผู้รับงาน"}
            </dd>
          </div>
        </div>
        {data.dueDate && (
          <div className="flex items-start gap-2.5">
            <CalendarClockIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">กำหนดเสร็จ</dt>
              <dd className="font-medium">{formatSubDue(data.dueDate, data.dueTime)}</dd>
            </div>
          </div>
        )}
      </dl>

      <section className="space-y-1.5">
        <h3 className="text-xs font-medium text-muted-foreground">ขอบเขตงานที่มอบหมาย</h3>
        <p className="rounded-xl bg-muted px-3 py-2.5 leading-relaxed whitespace-pre-line">{data.scope ?? "—"}</p>
      </section>

      <section className="space-y-2.5">
        <h3 className="text-xs font-medium text-muted-foreground">ประวัติการดำเนินการโดยละเอียด</h3>
        <div className="rounded-2xl border bg-card p-4">
          <JobFileLoader.Provider value={loadFile}>
            <Timeline job={data} step={step} readOnly />
          </JobFileLoader.Provider>
        </div>
      </section>
    </div>
  );
}

/**
 * ส่วนตรวจรับงานย่อย (ผู้รับเหมาหลัก/แอดมิน เมื่องานย่อยส่งมอบแล้ว)
 *  ตรวจรับผ่าน → ปิดงานย่อย (หมายเหตุไม่บังคับ)
 *  ตีกลับให้แก้ไข → กลับไปกำลังดำเนินการ ต้องระบุสิ่งที่ต้องแก้ บริษัทรายย่อยส่งงานใหม่พร้อมรูปหลังแก้ไข
 */
function InspectPanel({
  parentId,
  sub,
  onDone,
  onStale,
}: {
  parentId: string;
  sub: SubJobHistory;
  onDone: (parent: JobDetail) => void;
  onStale: () => void;
}) {
  const [mode, setMode] = useState<InspectMode | null>(null);

  // แถบติดล่างของ modal: เลื่อนดูรูป/ประวัติได้ตลอดโดยปุ่มตรวจรับยังอยู่ให้เห็น
  // sticky นับจากขอบ padding ของ modal (p-4) → ใช้ -bottom-4 ให้ชิดขอบล่างจริง, -mx-4/-mb-4 ให้เต็มความกว้างและปิดช่องล่างตอนเลื่อนสุด
  return (
    <section className="sticky -bottom-4 z-10 -mx-4 -mb-4 space-y-2.5 border-t bg-popover px-4 pt-3 pb-4 text-sm shadow-[0_-10px_20px_-16px_rgb(0_0_0/0.35)]">
      <p className="flex items-center gap-1.5 font-medium text-sub-accent">
        <ClipboardCheckIcon className="size-4 shrink-0" />
        ตรวจรับงานย่อย
        <span className="font-normal text-muted-foreground">· ดูรูปและรายละเอียดด้านบนก่อน</span>
      </p>

      {mode === null ? (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="h-11 gap-1.5 rounded-xl border-danger/40 text-danger hover:bg-danger/10 hover:text-danger"
            onClick={() => setMode("rework")}
          >
            <RotateCcwIcon className="size-4" />
            ตีกลับให้แก้ไข
          </Button>
          <Button
            className="h-11 gap-1.5 rounded-xl bg-success text-white hover:bg-success/90"
            onClick={() => setMode("approve")}
          >
            <CheckCircle2Icon className="size-4" />
            ตรวจรับผ่าน
          </Button>
        </div>
      ) : (
        <InspectForm
          key={mode}
          parentId={parentId}
          sub={sub}
          mode={mode}
          onDone={onDone}
          onStale={onStale}
          onBack={() => setMode(null)}
        />
      )}
    </section>
  );
}

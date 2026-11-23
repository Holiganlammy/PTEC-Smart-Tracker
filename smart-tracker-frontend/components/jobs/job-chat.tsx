"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircleIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, type ChatBlockReason, type JobMessage, type MessageSenderRole } from "@/lib/api";

/** ดึงข้อความใหม่ทุกกี่วินาที (เฉพาะตอนเปิดหน้าอยู่) — ยังไม่ใช้ WebSocket */
const POLL_MS = 10_000;

const timeFormat = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC", // เวลาในฐานข้อมูลเป็นเวลาท้องถิ่น ไม่มี timezone — แสดงตามค่าที่เก็บ
});

const BLOCKED_TEXT: Record<ChatBlockReason, string> = {
  closed: "งานนี้ปิดแล้ว ส่งข้อความเพิ่มไม่ได้",
  rejected: "งานนี้ถูกปฏิเสธแล้ว รอแอดมินจ่ายงานให้บริษัทอื่น ส่งข้อความไม่ได้",
  no_owner_yet: "ยังไม่มีผู้รับงานนี้ พิมพ์ได้หลังมีผู้รับงานแล้ว",
  not_owner: "คุณดูแชทได้อย่างเดียว เฉพาะผู้ที่รับงานนี้เท่านั้นที่พิมพ์ได้",
};

/** ป้ายบทบาทข้างชื่อ (ผู้รับเหมาทั่วไปไม่ต้องมีป้าย) */
const ROLE_BADGE: Partial<Record<MessageSenderRole, { label: string; className: string }>> = {
  admin: { label: "แอดมิน", className: "bg-brand/10 text-brand" },
  head: { label: "หัวหน้า", className: "bg-warning-soft text-warning" },
  sub_contractor: { label: "ผู้รับเหมาช่วง", className: "bg-sub-accent/10 text-sub-accent" },
};

function merge(prev: JobMessage[], next: JobMessage[]): JobMessage[] {
  if (next.length === 0) return prev;
  const seen = new Set(prev.map((m) => m.id));
  const added = next.filter((m) => !seen.has(m.id));
  return added.length ? [...prev, ...added] : prev;
}

function initials(name: string) {
  return Array.from(name.trim()).slice(0, 2).join("") || "?";
}

/** การ์ด "พูดคุยกัน" ในหน้ารายละเอียดงาน */
export function JobChat({ jobId }: { jobId: string }) {
  const [items, setItems] = useState<JobMessage[] | null>(null);
  const [canPost, setCanPost] = useState(false);
  const [blocked, setBlocked] = useState<ChatBlockReason | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [attempt, setAttempt] = useState(0); // เปลี่ยนค่าเพื่อโหลดใหม่หลังโหลดครั้งแรกไม่สำเร็จ

  const itemsRef = useRef<JobMessage[] | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true); // อยู่ท้ายรายการ → เลื่อนตามข้อความใหม่

  useEffect(() => {
    itemsRef.current = items;
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [items]);

  useEffect(() => {
    let cancelled = false;

    /** ครั้งแรกดึงข้อความล่าสุด ครั้งต่อไปดึงเฉพาะที่ใหม่กว่าข้อความสุดท้ายที่เห็น */
    function fetchNow() {
      const current = itemsRef.current;
      const after = current && current.length > 0 ? current[current.length - 1].id : undefined;
      api
        .getJobMessages(jobId, after)
        .then((res) => {
          if (cancelled) return;
          setItems((prev) => (prev === null ? res.items : merge(prev, res.items)));
          setCanPost(res.canPost);
          setBlocked(res.blockedReason);
          setLoadError(null);
        })
        .catch((e: unknown) => {
          // เรียกซ้ำเงียบ ๆ: มีข้อความแสดงอยู่แล้วก็ปล่อยไว้ รอรอบหน้า
          if (cancelled || itemsRef.current !== null) return;
          setLoadError(e instanceof Error ? e.message : "โหลดแชทไม่สำเร็จ");
        });
    }

    fetchNow();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") fetchNow();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && fetchNow();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [jobId, attempt]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const sent = await api.sendJobMessage(jobId, body);
      stickRef.current = true; // เลื่อนลงไปหาข้อความที่เพิ่งส่ง
      setItems((prev) => merge(prev ?? [], [sent]));
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ส่งข้อความไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  }

  function onScroll() {
    const el = listRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-1.5 px-1 text-sm font-medium text-muted-foreground">
        <MessageCircleIcon className="size-4" />
        พูดคุยกับผู้รับเหมา
        {items && items.length > 0 && <span className="text-xs font-normal">({items.length})</span>}
      </h3>

      <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
        {loadError ? (
          <div className="space-y-2 text-center text-sm">
            <p className="text-danger">{loadError}</p>
            <Button variant="outline" className="h-10 rounded-xl" onClick={() => setAttempt((n) => n + 1)}>
              ลองใหม่
            </Button>
          </div>
        ) : items === null ? (
          <p className="py-4 text-center text-sm text-muted-foreground">กำลังโหลดแชท…</p>
        ) : (
          <div ref={listRef} onScroll={onScroll} className="max-h-96 space-y-3.5 overflow-y-auto pr-0.5">
            {items.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">ยังไม่มีข้อความ</p>
            ) : (
              items.map((m) => <Bubble key={m.id} m={m} />)
            )}
          </div>
        )}

        {items !== null &&
          (canPost ? (
            <div className="flex items-end gap-2 border-t pt-3">
              <Textarea
                value={text}
                rows={1}
                maxLength={1000}
                disabled={sending}
                placeholder="พิมพ์ข้อความ…"
                aria-label="พิมพ์ข้อความ"
                className="max-h-28 min-h-10 flex-1 resize-none rounded-xl"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <Button
                className="size-10 shrink-0 rounded-xl p-0"
                aria-label="ส่งข้อความ"
                disabled={sending || text.trim() === ""}
                onClick={() => void send()}
              >
                <SendIcon className="size-4" />
              </Button>
            </div>
          ) : (
            <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
              {BLOCKED_TEXT[blocked ?? "not_owner"]}
            </p>
          ))}
      </div>
    </section>
  );
}

function Bubble({ m }: { m: JobMessage }) {
  const badge = ROLE_BADGE[m.senderRole];
  return (
    <div className={`flex gap-2 ${m.mine ? "flex-row-reverse" : ""}`}>
      <span
        aria-hidden
        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground"
      >
        {initials(m.senderName)}
      </span>
      <div className={`min-w-0 max-w-[82%] space-y-1 ${m.mine ? "items-end text-right" : ""}`}>
        <div
          className={`inline-block rounded-2xl px-3 py-2 text-left text-sm break-words whitespace-pre-wrap ${
            m.mine ? "bg-brand text-white" : "bg-muted"
          }`}
        >
          {m.body}
        </div>
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className={m.mine ? "ml-auto" : ""}>
            {m.senderName}
            {m.mine ? " (คุณ)" : ""}
          </span>
          {badge && <span className={`rounded-full px-1.5 py-px ${badge.className}`}>{badge.label}</span>}
          <span>· {timeFormat.format(new Date(m.createdAt))} น.</span>
        </p>
      </div>
    </div>
  );
}

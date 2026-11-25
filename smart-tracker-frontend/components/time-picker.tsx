"use client";

import { useCallback, useState } from "react";
import { ClockIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

/** "HH:mm" ↔ นาทีนับจากเที่ยงคืน */
const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMinutes = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

type Props = {
  id?: string;
  /** "HH:mm" (24 ชั่วโมง) หรือ "" = ยังไม่เลือก */
  value: string;
  onChange: (value: string) => void;
  /** เลือกได้เฉพาะเวลาหลังจากนี้ "HH:mm" (ไม่รวมเวลานี้) — เช่น กำหนดเสร็จวันนี้ต้องหลังเวลาปัจจุบัน */
  after?: string;
  /** เวลาแรกที่เลือกได้ "HH:mm" (รวมเวลานี้) — เช่น ซ่อมเสร็จต้องไม่ก่อนเวลาแจ้งงาน */
  min?: string;
  /** เวลาสุดท้ายที่เลือกได้ "HH:mm" (รวมเวลานี้) — เช่น ซ่อมเสร็จวันนี้ต้องไม่เกินเวลาปัจจุบัน */
  max?: string;
  disabled?: boolean;
  invalid?: boolean;
  "aria-label"?: string;
};

/**
 * เลือกเวลาแบบ 24 ชั่วโมง (ไม่มี AM/PM): กดแล้วเปิดคอลัมน์ ชั่วโมง | นาที ให้แตะเลือก
 * เลือกชั่วโมงแล้วค่าเปลี่ยนทันที เลือกนาทีแล้วปิดเอง (หรือกด "ตกลง" / แตะนอกกรอบ)
 * เวลานอกช่วง (after/min/max) กดไม่ได้ เลือกชั่วโมงแล้วนาทีเดิมเลยช่วง → ขยับเข้าช่วงให้เอง
 */
export function TimePicker({
  id,
  value,
  onChange,
  after,
  min,
  max,
  disabled,
  invalid,
  "aria-label": ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const hour = value ? value.slice(0, 2) : null;
  const minute = value ? value.slice(3, 5) : null;

  // ช่วงที่เลือกได้เป็นนาทีนับจากเที่ยงคืน [lo, hi]
  const lo = Math.max(min ? toMinutes(min) : 0, after ? toMinutes(after) + 1 : 0);
  const hi = max ? toMinutes(max) : 24 * 60 - 1;
  const hourDisabled = (h: string) => Number(h) * 60 + 59 < lo || Number(h) * 60 > hi;
  const minuteDisabled = (m: string) => {
    if (hour === null) return false;
    const t = Number(hour) * 60 + Number(m);
    return t < lo || t > hi;
  };
  /** เลือกชั่วโมงใหม่: คงนาทีเดิมไว้ถ้ายังอยู่ในช่วง ไม่งั้นขยับไปขอบที่ใกล้ที่สุด */
  const pickHour = (h: string) => {
    const t = Number(h) * 60 + Number(minute ?? "00");
    onChange(fromMinutes(Math.min(Math.max(t, lo), hi)));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            variant="outline"
            aria-label={ariaLabel}
            disabled={disabled}
            aria-invalid={invalid}
            className="h-11 w-full justify-start gap-2 px-3 font-normal"
          />
        }
      >
        <ClockIcon className="size-4 text-muted-foreground" />
        <span className={cn("truncate tabular-nums", !value && "text-muted-foreground")}>
          {value ? `${value} น.` : "เลือกเวลา"}
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto gap-0 p-0">
        <div className="flex divide-x">
          <TimeColumn
            label="ชั่วโมง"
            items={HOURS}
            selected={hour}
            isDisabled={hourDisabled}
            onPick={pickHour}
          />
          <TimeColumn
            label="นาที"
            items={MINUTES}
            selected={minute}
            isDisabled={minuteDisabled}
            onPick={(m) => {
              onChange(`${hour ?? "00"}:${m}`);
              setOpen(false);
            }}
          />
        </div>
        <div className="border-t p-2">
          <Button className="h-9 w-full rounded-lg" onClick={() => setOpen(false)}>
            ตกลง
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TimeColumn({
  label,
  items,
  selected,
  isDisabled,
  onPick,
}: {
  label: string;
  items: string[];
  selected: string | null;
  isDisabled: (item: string) => boolean;
  onPick: (item: string) => void;
}) {
  // เปิดมาแล้วเลื่อนให้ค่าที่เลือกอยู่กลางคอลัมน์ (ทำครั้งเดียวตอนเปิด ไม่กระตุกตอนเลือกค่าใหม่)
  const scrollToSelected = useCallback((list: HTMLDivElement | null) => {
    const el = list?.querySelector<HTMLElement>("[data-selected='true']");
    if (list && el) list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2;
  }, []);

  return (
    <div className="w-20">
      <p className="border-b py-2 text-center text-xs font-medium text-muted-foreground">{label}</p>
      <div
        ref={scrollToSelected}
        className="relative h-56 space-y-0.5 overflow-y-auto overscroll-contain p-1.5 [scrollbar-width:thin]"
      >
        {items.map((item) => {
          const active = item === selected;
          return (
            <button
              key={item}
              type="button"
              data-selected={active}
              aria-pressed={active}
              disabled={isDisabled(item)}
              onClick={() => onPick(item)}
              className={cn(
                "flex h-9 w-full items-center justify-center rounded-md text-sm tabular-nums transition-colors outline-none",
                "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                "disabled:pointer-events-none disabled:opacity-30",
                active && "bg-primary font-medium text-primary-foreground hover:bg-primary",
              )}
            >
              {item}
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { CalendarIcon } from "lucide-react";
import type { Matcher } from "react-day-picker";
import { th } from "react-day-picker/locale";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const pad = (n: number) => String(n).padStart(2, "0");

/** วันที่ตามนาฬิกาเครื่อง YYYY-MM-DD */
export function toDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** เวลาตามนาฬิกาเครื่อง HH:mm */
export function toTimeStr(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "YYYY-MM-DD" → Date เที่ยงคืนตามเวลาเครื่อง (ให้ปฏิทินไฮไลต์วันตรงกับที่เลือก) */
export function fromDateStr(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** เวลาปัจจุบันที่อัปเดตทุก 30 วินาที — เปิดฟอร์มค้างไว้นาน ๆ ก็ยังตรวจกับเวลาล่าสุด */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** หัวปฏิทิน เช่น "พฤศจิกายน 2569" (ปี พ.ศ.) */
const captionFormat = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" });

/** วันที่บนปุ่ม เช่น "25 พ.ย. 2569" */
const valueFormat = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC", // ค่าเป็นวันที่ล้วน แปลงเป็นเที่ยงคืน UTC แล้วแสดงตามนั้น
});

type Props = {
  id?: string;
  /** "YYYY-MM-DD" หรือ "" = ยังไม่เลือก */
  value: string;
  onChange: (value: string) => void;
  /** วันแรกที่เลือกได้ "YYYY-MM-DD" (รวมวันนั้น) */
  min?: string;
  /** วันสุดท้ายที่เลือกได้ "YYYY-MM-DD" (รวมวันนั้น) */
  max?: string;
  disabled?: boolean;
  invalid?: boolean;
  "aria-label"?: string;
};

/** เลือกวันที่ด้วยปฏิทิน shadcn (ภาษาไทย ปี พ.ศ.) — ใช้คู่กับ TimePicker */
export function DatePicker({ id, value, onChange, min, max, disabled, invalid, "aria-label": ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const blocked: Matcher[] = [];
  if (min) blocked.push({ before: fromDateStr(min) });
  if (max) blocked.push({ after: fromDateStr(max) });
  const fallbackMonth = max ? fromDateStr(max) : min ? fromDateStr(min) : new Date();

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
        <CalendarIcon className="size-4 text-muted-foreground" />
        <span className={cn("truncate", !value && "text-muted-foreground")}>
          {value ? valueFormat.format(new Date(`${value}T00:00:00Z`)) : "เลือกวันที่"}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          locale={th}
          selected={value ? fromDateStr(value) : undefined}
          defaultMonth={value ? fromDateStr(value) : fallbackMonth}
          startMonth={min ? fromDateStr(min) : undefined}
          endMonth={max ? fromDateStr(max) : undefined}
          disabled={blocked}
          formatters={{ formatCaption: (month) => captionFormat.format(month) }}
          onSelect={(d) => {
            if (!d) return;
            onChange(toDateStr(d));
            setOpen(false);
          }}
          className="[--cell-size:--spacing(9)]"
        />
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { JobFilterOptions, JobFilters } from "@/lib/api";

export const EMPTY_FILTERS: JobFilters = { status: [], branch: "", days: null };

/** จำนวนตัวกรองที่เปิดอยู่ (ไว้โชว์บนปุ่มตัวกรอง) */
export function countActiveFilters(f: JobFilters) {
  return (f.status.length > 0 ? 1 : 0) + (f.branch ? 1 : 0) + (f.days ? 1 : 0);
}

const ALL_BRANCHES = "__all";
const ALL_DAYS = "__all";

const DAY_ITEMS = [
  { value: ALL_DAYS, label: "ทั้งหมด" },
  { value: "7", label: "7 วันล่าสุด" },
  { value: "30", label: "30 วันล่าสุด" },
  { value: "90", label: "90 วันล่าสุด" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = กำลังโหลดตัวเลือก */
  options: JobFilterOptions | null;
  value: JobFilters;
  onApply: (filters: JobFilters) => void;
};

/** ตัวกรองรายการงาน: สถานะ (เลือกได้หลายอัน) / สาขา / ช่วงเวลาที่แจ้งงาน */
export function JobFilterSheet({ open, onOpenChange, options, value, onApply }: Props) {
  const [draft, setDraft] = useState<JobFilters>(value);

  // เปิดใหม่ทุกครั้ง → เริ่มจากตัวกรองที่ใช้อยู่จริง
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setDraft(value);
  }, [open, value]);

  function toggleStatus(id: number) {
    setDraft((d) => ({
      ...d,
      status: d.status.includes(id) ? d.status.filter((s) => s !== id) : [...d.status, id],
    }));
  }

  const branchItems = [
    { value: ALL_BRANCHES, label: "ทุกสาขา" },
    ...(options?.branches ?? []).map((b) => ({ value: b.code, label: b.name })),
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>ตัวกรอง</SheetTitle>
          <SheetDescription>เลือกเงื่อนไขที่ต้องการดูงาน</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 overflow-y-auto px-4 pb-2">
          <Field>
            <FieldLabel>สถานะ</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {(options?.statuses ?? []).map((s) => {
                const on = draft.status.includes(s.id);
                return (
                  <Button
                    key={s.id}
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    aria-pressed={on}
                    className="h-9 rounded-full px-3.5"
                    onClick={() => toggleStatus(s.id)}
                  >
                    {s.name}
                  </Button>
                );
              })}
              {options === null && <p className="text-sm text-muted-foreground">กำลังโหลด…</p>}
            </div>
          </Field>

          <Field>
            <FieldLabel htmlFor="job-filter-branch">สาขา</FieldLabel>
            <Select
              items={branchItems}
              value={draft.branch || ALL_BRANCHES}
              onValueChange={(v) => setDraft((d) => ({ ...d, branch: v === ALL_BRANCHES ? "" : (v ?? "") }))}
            >
              <SelectTrigger id="job-filter-branch" className="h-11 w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {branchItems.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="job-filter-days">วันที่แจ้งงาน</FieldLabel>
            <Select
              items={DAY_ITEMS}
              value={draft.days ? String(draft.days) : ALL_DAYS}
              onValueChange={(v) =>
                setDraft((d) => ({ ...d, days: !v || v === ALL_DAYS ? null : Number(v) }))
              }
            >
              <SelectTrigger id="job-filter-days" className="h-11 w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {DAY_ITEMS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <SheetFooter className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => setDraft(EMPTY_FILTERS)}>
            ล้างตัวกรอง
          </Button>
          <Button
            className="h-11 rounded-xl"
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            ใช้ตัวกรอง
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

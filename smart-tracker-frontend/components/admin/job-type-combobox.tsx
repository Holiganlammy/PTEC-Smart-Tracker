"use client";

import { useMemo, useState } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import type { JobType } from "@/lib/api";

type Props = {
  /** ประเภทงานของ OPS ที่ยังใช้งาน */
  types: JobType[];
  /** ชื่อประเภทงานที่เลือกอยู่ ("" = ยังไม่เลือก) */
  value: string;
  onChange: (name: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
};

/** เลือกประเภทงานของ OPS — พิมพ์ค้นหาได้ */
export function JobTypeCombobox({ types, value, onChange, disabled, invalid, id }: Props) {
  // ค่าเดิมของงานอาจไม่อยู่ในรายการ (ประเภทที่ยกเลิกใช้งานแล้ว) — ใส่เป็นตัวเลือกพิเศษให้ยังเห็น/เก็บไว้ได้
  const items = useMemo<JobType[]>(
    () =>
      value && !types.some((t) => t.name === value)
        ? [{ jobTypeId: 0, name: value }, ...types]
        : types,
    [types, value],
  );
  const selected = useMemo(() => items.find((t) => t.name === value) ?? null, [items, value]);
  const [query, setQuery] = useState(value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // พิมพ์ตรงกับค่าที่เลือกอยู่ (เพิ่งเปิดหน้าต่าง) → แสดงทั้งหมด ไม่กรอง
    if (!q || q === value.toLowerCase()) return items;
    return items.filter((t) => t.name.toLowerCase().includes(q));
  }, [items, query, value]);

  return (
    <Combobox<JobType>
      items={items}
      filteredItems={filtered}
      value={selected}
      onValueChange={(t) => onChange(t?.name ?? "")}
      inputValue={query}
      onInputValueChange={setQuery}
      itemToStringLabel={(t) => t.name}
      isItemEqualToValue={(a, b) => a.name === b.name}
      disabled={disabled}
    >
      <ComboboxInput
        id={id}
        placeholder="เลือกประเภทงาน"
        aria-invalid={invalid}
        showClear={value !== ""}
        className="h-11 rounded-xl"
      />
      <ComboboxContent>
        <ComboboxEmpty>ไม่พบประเภทงานที่ค้นหา</ComboboxEmpty>
        <ComboboxList>
          {(t: JobType) => (
            <ComboboxItem key={`${t.jobTypeId}-${t.name}`} value={t}>
              <span className="min-w-0 flex-1 whitespace-normal">{t.name}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

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
import type { Vender } from "@/lib/api";

type Props = {
  venders: Vender[];
  /** รหัสบริษัทที่เลือกอยู่ ("" = ยังไม่เลือก) */
  value: string;
  onChange: (venderCode: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
};

/** เลือกบริษัทผู้รับเหมา — พิมพ์ค้นหาจากชื่อหรือรหัสได้ */
export function VenderCombobox({ venders, value, onChange, disabled, invalid, id }: Props) {
  const selected = useMemo(() => venders.find((v) => v.venderCode === value) ?? null, [venders, value]);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // ช่องค้นหาตรงกับชื่อที่เลือกอยู่ (เพิ่งเลือกเสร็จ) → แสดงทั้งหมด ไม่กรอง
    if (!q || (selected && q === selected.venderName.toLowerCase())) return venders;
    return venders.filter(
      (v) => v.venderName.toLowerCase().includes(q) || v.venderCode.toLowerCase().includes(q),
    );
  }, [venders, query, selected]);

  return (
    <Combobox<Vender>
      items={venders}
      filteredItems={filtered}
      value={selected}
      onValueChange={(v) => onChange(v?.venderCode ?? "")}
      inputValue={query}
      onInputValueChange={setQuery}
      itemToStringLabel={(v) => v.venderName}
      isItemEqualToValue={(a, b) => a.venderCode === b.venderCode}
      disabled={disabled}
    >
      <ComboboxInput
        id={id}
        placeholder="เลือกบริษัท (พิมพ์ค้นหาได้)"
        aria-invalid={invalid}
        showClear={value !== ""}
        className="h-11 rounded-xl"
      />
      <ComboboxContent>
        <ComboboxEmpty>ไม่พบบริษัทที่ค้นหา</ComboboxEmpty>
        <ComboboxList>
          {(v: Vender) => (
            <ComboboxItem key={v.venderCode} value={v}>
              <span className="min-w-0 flex-1 whitespace-normal">{v.venderName}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

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

const MAX_VISIBLE = 50; // มีบริษัทเป็นพันราย แสดงเฉพาะที่ตรงกับคำค้นไม่เกินจำนวนนี้

type Props = {
  venders: Vender[];
  value: Vender | null;
  onChange: (vender: Vender | null) => void;
  disabled?: boolean;
  invalid?: boolean;
};

/** เลือกบริษัทผู้รับเหมา (Vendor) — พิมพ์ค้นหาได้ */
export function VenderCombobox({ venders, value, onChange, disabled, invalid }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? venders.filter(
          (v) =>
            v.venderName.toLowerCase().includes(q) ||
            v.venderCode.toLowerCase().includes(q),
        )
      : venders;
    return matches.slice(0, MAX_VISIBLE);
  }, [venders, query]);

  return (
    <Combobox<Vender>
      items={venders}
      filteredItems={filtered}
      value={value}
      onValueChange={onChange}
      inputValue={query}
      onInputValueChange={setQuery}
      itemToStringLabel={(v) => v.venderName}
      isItemEqualToValue={(a, b) => a.venderCode === b.venderCode}
      disabled={disabled}
    >
      <ComboboxInput
        placeholder="เลือกบริษัท"
        aria-invalid={invalid}
        className="h-11 rounded-xl"
      />
      <ComboboxContent>
        <ComboboxEmpty>ไม่พบบริษัทที่ค้นหา</ComboboxEmpty>
        <ComboboxList>
          {(v: Vender) => (
            <ComboboxItem key={v.venderCode} value={v}>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{v.venderName}</span>
                <span className="block font-mono text-xs text-muted-foreground">
                  {v.venderCode}
                </span>
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

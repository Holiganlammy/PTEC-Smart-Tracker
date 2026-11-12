"use client";

import { useEffect, useState } from "react";
import { clearTrace, readTrace } from "@/lib/debug-trace";

/** แสดงบันทึกขั้นตอน (ไม่มีค่าลับ) ใช้ตอนวินิจฉัยบนมือถือ */
export function DebugTracePanel() {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    // อ่าน localStorage ได้เฉพาะฝั่ง browser
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLines(readTrace());
  }, []);

  if (lines.length === 0) return null;

  return (
    <details className="rounded-xl border bg-muted/50 p-3 text-left text-xs" open>
      <summary className="cursor-pointer font-medium">บันทึกขั้นตอน (ส่งให้ผู้พัฒนา)</summary>
      <pre className="mt-2 max-h-64 overflow-auto font-mono leading-relaxed break-all whitespace-pre-wrap">
        {lines.join("\n")}
      </pre>
      <button
        type="button"
        className="mt-2 underline"
        onClick={() => {
          clearTrace();
          setLines([]);
        }}
      >
        ล้างบันทึก
      </button>
    </details>
  );
}

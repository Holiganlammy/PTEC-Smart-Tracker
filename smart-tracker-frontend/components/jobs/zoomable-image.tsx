"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Minimize2Icon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { JobAttatch } from "@/lib/api";
import { BlobImage } from "./blob-image";

/** modal ดูรูปแบบขยาย (ซ้อนบน modal อื่นได้): สูงเกือบเต็มจอ หัวคงที่ รูปอยู่ในพื้นที่ซูมได้ */
export const EXPANDED_MODAL =
  "flex h-[92dvh] max-h-[92dvh] w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] flex-col gap-3 sm:max-w-3xl";

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const STEP = 0.5;
const DOUBLE_TAP_ZOOM = 2.5;

const clamp = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
const touchDistance = (a: React.Touch, b: React.Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

/**
 * ดูรูปเต็มพื้นที่ซูมได้ (1x–5x): ปุ่ม − / + , แตะสองครั้งเพื่อขยาย/กลับ, บีบสองนิ้วบนมือถือ
 * ซูมแล้วเลื่อนดูส่วนอื่นของรูปด้วยการลาก/scroll — จุดที่ซูมจะอยู่ตำแหน่งเดิมใต้นิ้ว
 * ต้องวางในพื้นที่ที่มีความสูงแน่นอน (flex-1 ในกล่องที่กำหนดความสูง)
 */
export function ZoomableImage({
  jobId,
  item,
  onShrink,
}: {
  jobId: string;
  item: JobAttatch;
  /** ปุ่ม "ย่อ" กลับไปมุมมองเล็ก */
  onShrink?: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const scroller = useRef<HTMLDivElement>(null);
  // จุดอ้างอิงตอนซูม: สัดส่วนของจุดนั้นในรูป + ตำแหน่งบนจอ เพื่อเลื่อน scroll ให้จุดเดิมอยู่ใต้นิ้วหลังขนาดเปลี่ยน
  const anchor = useRef<{ fx: number; fy: number; cx: number; cy: number } | null>(null);
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  function changeZoom(next: number, point?: { x: number; y: number }) {
    const el = scroller.current;
    const z = clamp(next);
    if (!el || z === zoom) return;
    const cx = point?.x ?? el.clientWidth / 2;
    const cy = point?.y ?? el.clientHeight / 2;
    anchor.current = {
      fx: (el.scrollLeft + cx) / el.scrollWidth,
      fy: (el.scrollTop + cy) / el.scrollHeight,
      cx,
      cy,
    };
    setZoom(z);
  }

  useLayoutEffect(() => {
    const el = scroller.current;
    const a = anchor.current;
    if (!el || !a) return;
    anchor.current = null;
    el.scrollLeft = a.fx * el.scrollWidth - a.cx;
    el.scrollTop = a.fy * el.scrollHeight - a.cy;
  }, [zoom]);

  function localPoint(clientX: number, clientY: number) {
    const rect = scroller.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  }

  return (
    <>
      <div
        ref={scroller}
        style={{ touchAction: "pan-x pan-y" }}
        className={`min-h-0 flex-1 overflow-auto rounded-xl border bg-muted ${zoom > 1 ? "cursor-zoom-out" : "cursor-zoom-in"}`}
        onDoubleClick={(e) => changeZoom(zoom > 1 ? 1 : DOUBLE_TAP_ZOOM, localPoint(e.clientX, e.clientY))}
        onTouchStart={(e) => {
          if (e.touches.length === 2) pinch.current = { dist: touchDistance(e.touches[0], e.touches[1]), zoom };
        }}
        onTouchMove={(e) => {
          if (e.touches.length !== 2 || !pinch.current || pinch.current.dist === 0) return;
          const [a, b] = [e.touches[0], e.touches[1]];
          const ratio = touchDistance(a, b) / pinch.current.dist;
          changeZoom(pinch.current.zoom * ratio, localPoint((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2));
        }}
        onTouchEnd={(e) => {
          if (e.touches.length < 2) pinch.current = null;
        }}
      >
        <div style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
          <BlobImage jobId={jobId} item={item} className="size-full object-contain" />
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2">
        {onShrink ? (
          <Button type="button" variant="outline" size="sm" onClick={onShrink}>
            <Minimize2Icon />
            ย่อ
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="ซูมออก"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => changeZoom(zoom - STEP)}
          >
            <ZoomOutIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-w-14 tabular-nums"
            aria-label="ซูมพอดีจอ"
            disabled={zoom === MIN_ZOOM}
            onClick={() => changeZoom(MIN_ZOOM)}
          >
            {Math.round(zoom * 100)}%
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="ซูมเข้า"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => changeZoom(zoom + STEP)}
          >
            <ZoomInIcon />
          </Button>
        </div>
      </div>
      <p className="shrink-0 text-center text-[11px] text-muted-foreground">บีบสองนิ้วหรือแตะสองครั้งเพื่อซูม</p>
    </>
  );
}

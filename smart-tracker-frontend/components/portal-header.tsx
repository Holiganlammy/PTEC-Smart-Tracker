"use client";

import { MenuIcon, WrenchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

/**
 * แถบหัวสีเข้มของ Contractor Portal
 * - `menu` = true จะแสดงปุ่ม 3 ขีดทางซ้ายเพื่อเปิดเมนูข้าง (ต้องอยู่ใน PortalShell)
 */
export function PortalHeader({ title, menu = false }: { title: string; menu?: boolean }) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 bg-neutral-900 px-4 py-3 text-white">
      {menu && <MenuToggle />}
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
        <WrenchIcon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium tracking-[0.14em] text-white/60">
          CONTRACTOR PORTAL
        </p>
        <h1 className="truncate font-heading text-lg leading-tight font-medium">
          {title}
        </h1>
      </div>
    </header>
  );
}

function MenuToggle() {
  const { toggleSidebar } = useSidebar();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleSidebar}
      aria-label="เปิดเมนู"
      className="-ml-2 size-9 shrink-0 rounded-lg text-white hover:bg-white/15 hover:text-white active:bg-white/25"
    >
      <MenuIcon className="size-5" />
    </Button>
  );
}

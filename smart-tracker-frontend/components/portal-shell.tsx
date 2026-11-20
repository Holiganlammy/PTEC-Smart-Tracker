"use client";

import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { PortalHeader } from "@/components/portal-header";
import { SidebarProvider } from "@/components/ui/sidebar";

/** โครงหน้าที่มีเมนูข้าง: header (พร้อมปุ่มเมนู) + drawer + เนื้อหา */
export function PortalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false} className="min-h-0 flex-1 flex-col">
      {/* usePathname() ในเมนูเป็นข้อมูลตอนรันจริง (หน้าแบบ /jobs/[id]) ต้องอยู่ใน Suspense ไม่งั้น prerender ไม่ผ่าน */}
      <Suspense fallback={null}>
        <AppSidebar />
      </Suspense>
      <PortalHeader title={title} menu />
      {children}
    </SidebarProvider>
  );
}

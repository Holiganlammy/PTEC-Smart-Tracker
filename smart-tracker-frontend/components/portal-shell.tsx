"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { PortalHeader } from "@/components/portal-header";
import { SidebarProvider } from "@/components/ui/sidebar";

/** โครงหน้าที่มีเมนูข้าง: header (พร้อมปุ่มเมนู) + drawer + เนื้อหา */
export function PortalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false} className="min-h-0 flex-1 flex-col">
      <AppSidebar />
      <PortalHeader title={title} menu />
      {children}
    </SidebarProvider>
  );
}

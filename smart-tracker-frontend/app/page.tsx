import type { Metadata } from "next";
import { HomeDashboard } from "@/components/home/home-dashboard";
import { PortalShell } from "@/components/portal-shell";

export const metadata: Metadata = { title: "หน้าหลัก | PTEC" };

// หน้าหลัก: เช็กสถานะผู้ใช้ — ยังไม่ลงทะเบียน/ยังไม่อนุมัติ จะพาไป /register
export default function Home() {
  return (
    <PortalShell title="หน้าหลัก">
      <HomeDashboard />
    </PortalShell>
  );
}

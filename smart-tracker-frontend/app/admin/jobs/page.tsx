import type { Metadata } from "next";
import { AdminJobs } from "@/components/admin/admin-jobs";
import { PortalShell } from "@/components/portal-shell";

export const metadata: Metadata = { title: "จัดการงาน | PTEC" };

export default function AdminJobsPage() {
  return (
    <PortalShell title="จัดการงาน">
      <AdminJobs />
    </PortalShell>
  );
}

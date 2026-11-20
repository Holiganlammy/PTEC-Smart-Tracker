import type { Metadata } from "next";
import { JobList } from "@/components/jobs/job-list";
import { PortalShell } from "@/components/portal-shell";

export const metadata: Metadata = { title: "รายการงาน | PTEC" };

export default function JobsPage() {
  return (
    <PortalShell title="รายการงาน">
      <JobList />
    </PortalShell>
  );
}

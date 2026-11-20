import type { Metadata } from "next";
import { JobReview } from "@/components/admin/job-review";
import { PortalShell } from "@/components/portal-shell";

export const metadata: Metadata = { title: "ตรวจงานจาก OPS | PTEC" };

export default function ReviewJobsPage() {
  return (
    <PortalShell title="ตรวจงานจาก OPS">
      <JobReview />
    </PortalShell>
  );
}

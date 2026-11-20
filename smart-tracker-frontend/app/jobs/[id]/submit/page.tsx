import { Suspense } from "react";
import type { Metadata } from "next";
import { JobSubmitView } from "@/components/jobs/job-submit";
import { PortalShell } from "@/components/portal-shell";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "ส่งงานซ่อม | PTEC" };

export default function JobSubmitPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <PortalShell title="ส่งงานซ่อม">
      {/* params เป็นข้อมูลตอนรันจริง ต้องอ่านใน Suspense เพื่อให้ส่วนโครงหน้า prerender ได้ */}
      <Suspense fallback={<SubmitSkeleton />}>
        <JobSubmitContent params={params} />
      </Suspense>
    </PortalShell>
  );
}

async function JobSubmitContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobSubmitView id={id} />;
}

function SubmitSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}

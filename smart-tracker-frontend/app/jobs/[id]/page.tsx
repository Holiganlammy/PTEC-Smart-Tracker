import { Suspense } from "react";
import type { Metadata } from "next";
import { JobDetailView } from "@/components/jobs/job-detail";
import { PortalShell } from "@/components/portal-shell";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "ติดตามสถานะงาน | PTEC" };

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <PortalShell title="ติดตามสถานะงาน">
      {/* params เป็นข้อมูลตอนรันจริง ต้องอ่านใน Suspense เพื่อให้ส่วนโครงหน้า prerender ได้ */}
      <Suspense fallback={<DetailSkeleton />}>
        <JobDetailContent params={params} />
      </Suspense>
    </PortalShell>
  );
}

async function JobDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobDetailView id={id} />;
}

function DetailSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}

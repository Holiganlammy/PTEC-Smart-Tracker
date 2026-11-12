import { CheckCircle2Icon, ClockIcon, XCircleIcon } from "lucide-react";
import type { UserStatus } from "@/lib/api";

const STATUS_VIEW: Record<
  UserStatus,
  { label: string; className: string; Icon: typeof ClockIcon }
> = {
  pending: { label: "รอ OPS ตรวจสอบ", className: "text-warning", Icon: ClockIcon },
  approved: { label: "อนุมัติแล้ว", className: "text-success", Icon: CheckCircle2Icon },
  rejected: { label: "ไม่อนุมัติ", className: "text-danger", Icon: XCircleIcon },
  suspended: { label: "ระงับการใช้งาน", className: "text-danger", Icon: XCircleIcon },
};

/** กล่อง "สถานะการสมัคร" */
export function ApplicationStatus({
  status,
  rejectReason,
}: {
  status: UserStatus;
  rejectReason?: string | null;
}) {
  const { label, className, Icon } = STATUS_VIEW[status];

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">สถานะการสมัคร</p>
      <p className={`mt-1 flex items-center gap-2 font-medium ${className}`}>
        <Icon className="size-5" />
        {label}
      </p>
      {rejectReason && (
        <p className="mt-2 text-sm text-muted-foreground">เหตุผล: {rejectReason}</p>
      )}
    </section>
  );
}

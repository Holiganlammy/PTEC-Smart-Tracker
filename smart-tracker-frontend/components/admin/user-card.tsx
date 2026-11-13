"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BuildingIcon, MailIcon, MessageCircleIcon, PhoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdminUser, UserStatus } from "@/lib/api";

export const STATUS_VIEW: Record<UserStatus, { label: string; className: string }> = {
  pending: { label: "รอตรวจสอบ", className: "bg-warning-soft text-warning" },
  approved: { label: "อนุมัติแล้ว", className: "bg-success-soft text-success" },
  rejected: { label: "ไม่อนุมัติ", className: "bg-danger/10 text-danger" },
  suspended: { label: "ระงับ", className: "bg-danger/10 text-danger" },
};

type Props = {
  user: AdminUser;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
};

export function UserCard({ user, busy, onApprove, onReject }: Props) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const status = STATUS_VIEW[user.status];
  const created = new Date(user.createdAt).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });

  return (
    <article className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar className="size-11">
          <AvatarImage src={user.linePictureUrl ?? undefined} alt="" />
          <AvatarFallback>{user.firstName.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{fullName}</p>
          <p className="text-xs text-muted-foreground">สมัครเมื่อ {created}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
          {status.label}
        </span>
      </div>

      <dl className="space-y-1.5 text-sm">
        <Row icon={<BuildingIcon className="size-4" />}>
          <span className="block truncate">{user.venderName ?? user.venderCode ?? "-"}</span>
          {user.venderCode && (
            <span className="block font-mono text-xs text-muted-foreground">{user.venderCode}</span>
          )}
        </Row>
        <Row icon={<PhoneIcon className="size-4" />}>{user.phoneNumber}</Row>
        {user.email && (
          <Row icon={<MailIcon className="size-4" />}>
            <span className="block truncate">{user.email}</span>
          </Row>
        )}
        {user.lineDisplayName && (
          <Row icon={<MessageCircleIcon className="size-4" />}>
            <span className="block truncate">LINE: {user.lineDisplayName}</span>
          </Row>
        )}
      </dl>

      {user.status === "rejected" && user.rejectReason && (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          เหตุผล: {user.rejectReason}
        </p>
      )}

      {user.status === "pending" ? (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11 rounded-xl text-danger" disabled={busy} onClick={onReject}>
            ไม่อนุมัติ
          </Button>
          <Button className="h-11 rounded-xl" disabled={busy} onClick={onApprove}>
            อนุมัติ
          </Button>
        </div>
      ) : user.status === "rejected" ? (
        <Button variant="outline" className="h-11 w-full rounded-xl" disabled={busy} onClick={onApprove}>
          อนุมัติใหม่
        </Button>
      ) : null}
    </article>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

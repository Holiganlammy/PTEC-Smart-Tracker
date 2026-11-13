import type { Metadata } from "next";
import { UserApproval } from "@/components/admin/user-approval";
import { PortalShell } from "@/components/portal-shell";

export const metadata: Metadata = { title: "อนุมัติผู้ใช้ | PTEC" };

export default function AdminUsersPage() {
  return (
    <PortalShell title="อนุมัติผู้ใช้">
      <UserApproval />
    </PortalShell>
  );
}

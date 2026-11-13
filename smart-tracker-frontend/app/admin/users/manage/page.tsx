import type { Metadata } from "next";
import { UserManagement } from "@/components/admin/user-management";
import { PortalShell } from "@/components/portal-shell";

export const metadata: Metadata = { title: "จัดการผู้ใช้ | PTEC" };

export default function ManageUsersPage() {
  return (
    <PortalShell title="จัดการผู้ใช้">
      <UserManagement />
    </PortalShell>
  );
}

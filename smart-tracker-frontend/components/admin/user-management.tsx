"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BuildingIcon,
  MailIcon,
  PencilIcon,
  PhoneIcon,
  SearchIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, type AdminUser } from "@/lib/api";
import { GateScreen, useAdminGate } from "./admin-gate";
import { EditUserDialog } from "./edit-user-dialog";
import { STATUS_VIEW } from "./user-card";

type Filter = "all" | "active" | "inactive";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "active", label: "เปิดใช้งาน" },
  { value: "inactive", label: "ปิดใช้งาน" },
];

/** หน้าจัดการผู้ใช้ (เฉพาะ admin): แก้ข้อมูล + เปิด/ปิดการใช้งาน */
export function UserManagement() {
  const gate = useAdminGate();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);

  // หน่วงคำค้นเล็กน้อยก่อนยิง API
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    try {
      setUsers(
        await api.listUsers({
          q: debouncedQuery || undefined,
          active: filter === "all" ? undefined : filter === "active",
        }),
      );
    } catch (e) {
      toast.error("โหลดรายชื่อไม่สำเร็จ", {
        description: e instanceof Error ? e.message : undefined,
      });
      setUsers((prev) => prev ?? []);
    }
  }, [filter, debouncedQuery]);

  useEffect(() => {
    if (gate.name !== "ready") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [gate.name, load]);

  async function toggleActive(user: AdminUser, active: boolean) {
    setBusyId(user.id);
    try {
      await api.setUserActive(user.id, active);
      toast.success(active ? "เปิดใช้งานแล้ว" : "ปิดการใช้งานแล้ว");
      await load();
    } catch (e) {
      toast.error("ทำรายการไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusyId(null);
    }
  }

  if (gate.name !== "ready") return <GateScreen gate={gate} />;

  return (
    <div className="space-y-3 p-4">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาชื่อ เบอร์ อีเมล หรือบริษัท"
          className="h-11 rounded-xl pl-9"
        />
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl p-1">
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value} className="rounded-xl py-2.5 text-sm">
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {users === null ? (
        <p className="p-8 text-center text-sm text-muted-foreground">กำลังโหลดรายชื่อ…</p>
      ) : users.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">ไม่พบผู้ใช้</p>
      ) : (
        <>
          <p className="px-1 text-xs text-muted-foreground">{users.length} คน</p>
          <div className="space-y-3">
            {users.map((user) => (
              <ManagedUserCard
                key={user.id}
                user={user}
                busy={busyId === user.id}
                isSelf={user.id === gate.adminId}
                onEdit={() => setEditing(user)}
                onToggleActive={(active) => void toggleActive(user, active)}
              />
            ))}
          </div>
        </>
      )}

      <EditUserDialog
        user={editing}
        isSelf={editing?.id === gate.adminId}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void load();
        }}
      />
    </div>
  );
}

function ManagedUserCard({
  user,
  busy,
  isSelf,
  onEdit,
  onToggleActive,
}: {
  user: AdminUser;
  busy: boolean;
  isSelf: boolean;
  onEdit: () => void;
  onToggleActive: (active: boolean) => void;
}) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const status = STATUS_VIEW[user.status];

  return (
    <article
      className={`space-y-3 rounded-2xl border bg-card p-4 shadow-sm ${user.active ? "" : "bg-muted/40"}`}
    >
      <div className="flex items-start gap-3">
        <Avatar className="size-11">
          <AvatarImage src={user.linePictureUrl ?? undefined} alt="" className={user.active ? "" : "grayscale"} />
          <AvatarFallback>{user.firstName.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {fullName}
            {isSelf && <span className="ml-2 text-xs font-normal text-muted-foreground">(คุณ)</span>}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{user.roleName}</Badge>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${status.className}`}>
              {status.label}
            </span>
          </div>
        </div>
      </div>

      <dl className="space-y-1.5 text-sm">
        <Row icon={<BuildingIcon className="size-4" />}>
          <span className="block truncate">{user.venderName ?? user.venderCode ?? "-"}</span>
        </Row>
        <Row icon={<PhoneIcon className="size-4" />}>{user.phoneNumber}</Row>
        {user.email && (
          <Row icon={<MailIcon className="size-4" />}>
            <span className="block truncate">{user.email}</span>
          </Row>
        )}
      </dl>

      <div className="flex items-center justify-between gap-3 border-t pt-3">
        <Label className="flex items-center gap-2 text-sm">
          <Switch
            checked={user.active}
            disabled={busy || isSelf}
            onCheckedChange={onToggleActive}
            aria-label="เปิด/ปิดการใช้งานผู้ใช้"
          />
          {user.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
        </Label>
        <Button variant="outline" size="sm" className="h-9 rounded-xl" disabled={busy} onClick={onEdit}>
          <PencilIcon className="size-4" />
          แก้ไข
        </Button>
      </div>
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

"use client";

import { useCallback, useEffect, useState } from "react";
import { SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, api, type AdminUser, type UserCounts, type UserStatus } from "@/lib/api";
import { GateScreen, useAdminGate } from "./admin-gate";
import { RejectDialog } from "./reject-dialog";
import { UserCard } from "./user-card";

type Filter = UserStatus | "all";

const FILTERS: { value: Filter; label: string; tone?: string }[] = [
  { value: "pending", label: "รออนุมัติ", tone: "group-data-active/tab:text-warning" },
  { value: "approved", label: "อนุมัติแล้ว", tone: "group-data-active/tab:text-success" },
  { value: "rejected", label: "ไม่อนุมัติ", tone: "group-data-active/tab:text-danger" },
  { value: "all", label: "ทั้งหมด" },
];

/** หน้าอนุมัติผู้ใช้ (เฉพาะ role admin) */
export function UserApproval() {
  const gate = useAdminGate();
  const [filter, setFilter] = useState<Filter>("pending");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [counts, setCounts] = useState<UserCounts>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<AdminUser | null>(null);

  // หน่วงคำค้นเล็กน้อยก่อนยิง API
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([
        api.listUsers({
          status: filter === "all" ? undefined : filter,
          q: debouncedQuery || undefined,
        }),
        api.getUserCounts(),
      ]);
      setUsers(list);
      setCounts(count);
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

  /** ทำรายการกับผู้ใช้ 1 คน แล้วโหลดรายการใหม่ */
  async function act(user: AdminUser, run: () => Promise<unknown>, successMessage: string) {
    setBusyId(user.id);
    try {
      await run();
      toast.success(successMessage);
      await load();
    } catch (e) {
      const message = e instanceof ApiError || e instanceof Error ? e.message : undefined;
      toast.error("ทำรายการไม่สำเร็จ", { description: message });
      throw e;
    } finally {
      setBusyId(null);
    }
  }

  if (gate.name !== "ready") return <GateScreen gate={gate} />;

  const countOf = (f: Filter) =>
    f === "all"
      ? Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0)
      : (counts[f] ?? 0);

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

      {/* ตัวกรองสถานะ: 4 ช่องเท่ากันพอดีหน้าจอ ไม่ต้องเลื่อนซ้าย-ขวา */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="grid h-auto w-full grid-cols-4 rounded-2xl p-1">
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value} className="group/tab h-auto flex-col gap-0 rounded-xl px-1 py-2">
              <span className={`text-base leading-tight ${f.tone ?? ""}`}>{countOf(f.value)}</span>
              <span className="text-[11px] leading-tight">{f.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {users === null ? (
        <p className="p-8 text-center text-sm text-muted-foreground">กำลังโหลดรายชื่อ…</p>
      ) : users.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">ไม่พบผู้ใช้</p>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              busy={busyId === user.id}
              onApprove={() => void act(user, () => api.approveUser(user.id), "อนุมัติแล้ว").catch(() => {})}
              onReject={() => setRejecting(user)}
            />
          ))}
        </div>
      )}

      <RejectDialog
        userName={rejecting ? [rejecting.firstName, rejecting.lastName].filter(Boolean).join(" ") : null}
        onClose={() => setRejecting(null)}
        onConfirm={async (reason) => {
          if (!rejecting) return;
          try {
            await act(rejecting, () => api.rejectUser(rejecting.id, reason), "ไม่อนุมัติแล้ว");
            setRejecting(null);
          } catch {
            // act() แจ้งผ่าน toast แล้ว — เปิด dialog ค้างไว้ให้ลองใหม่
          }
        }}
      />
    </div>
  );
}

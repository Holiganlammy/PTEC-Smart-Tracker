"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenIcon,
  ClipboardListIcon,
  HomeIcon,
  MapPinIcon,
  ShieldCheckIcon,
  StarIcon,
  UserCheckIcon,
  UsersIcon,
  WrenchIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleId, api, type RegisteredMe } from "@/lib/api";

type NavItem = {
  label: string;
  href: string;
  Icon: typeof HomeIcon;
  /** false = ยังไม่มีหน้านี้ (แสดงเป็น "เร็วๆ นี้") */
  ready: boolean;
};

const MAIN_MENU: NavItem[] = [
  { label: "หน้าหลัก", href: "/", Icon: HomeIcon, ready: true },
  { label: "รายการงาน", href: "/jobs", Icon: ClipboardListIcon, ready: false },
  { label: "ติดตามงาน", href: "/tracking", Icon: MapPinIcon, ready: false },
  { label: "คะแนนของฉัน", href: "/score", Icon: StarIcon, ready: false },
  { label: "คู่มือการใช้งาน", href: "/guide", Icon: BookOpenIcon, ready: false },
];

const ADMIN_MENU: NavItem[] = [
  { label: "อนุมัติผู้ใช้", href: "/admin/users", Icon: UserCheckIcon, ready: true },
  { label: "จัดการผู้ใช้", href: "/admin/users/manage", Icon: UsersIcon, ready: true },
];

/** เมนูข้าง (drawer) — เปิดจากปุ่มที่ header เมนูผู้ดูแลระบบจะแสดงเฉพาะ role admin */
export function AppSidebar() {
  const pathname = usePathname();
  const { openMobile, setOpenMobile } = useSidebar();
  const [me, setMe] = useState<RegisteredMe | null | undefined>(undefined);

  // โหลดข้อมูลผู้ใช้ตอนเปิดเมนูครั้งแรก (หน้านั้นตั้ง token ไว้ให้แล้ว)
  useEffect(() => {
    if (!openMobile || me !== undefined) return;
    api
      .getMe()
      .then((res) => setMe(res.registered ? res : null))
      .catch(() => setMe(null));
  }, [openMobile, me]);

  const isAdmin = me?.roleId === RoleId.ADMIN && me.status === "approved" && me.active;
  const fullName = me ? [me.firstName, me.lastName].filter(Boolean).join(" ") : "";

  return (
    <Sidebar>
      <SidebarHeader className="bg-neutral-900 p-4 text-white">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <WrenchIcon className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-[0.14em] text-white/60">CONTRACTOR PORTAL</p>
            <p className="font-heading leading-tight font-medium">PTEC</p>
          </div>
        </div>

        {/* ผู้ใช้ */}
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/10 p-2.5">
          {me === undefined ? (
            <>
              <Skeleton className="size-10 rounded-full bg-white/20" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-28 bg-white/20" />
                <Skeleton className="h-3 w-20 bg-white/20" />
              </div>
            </>
          ) : me ? (
            <>
              <Avatar className="size-10">
                <AvatarImage src={me.line.pictureUrl ?? undefined} alt="" />
                <AvatarFallback>{me.firstName.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{fullName}</p>
                <p className="truncate text-xs text-white/60">{me.venderName ?? me.venderCode ?? "-"}</p>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {me.roleName}
              </Badge>
            </>
          ) : (
            <p className="px-1 text-sm text-white/70">ยังไม่ได้ลงทะเบียน</p>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        <NavGroup label="เมนูหลัก" items={MAIN_MENU} pathname={pathname} onNavigate={() => setOpenMobile(false)} />
        {isAdmin && (
          <NavGroup
            label="ผู้ดูแลระบบ"
            icon={<ShieldCheckIcon className="size-3.5" />}
            items={ADMIN_MENU}
            pathname={pathname}
            onNavigate={() => setOpenMobile(false)}
          />
        )}
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <p className="text-center text-xs text-muted-foreground">PTEC Contractor Portal</p>
      </SidebarFooter>
    </Sidebar>
  );
}

function NavGroup({
  label,
  icon,
  items,
  pathname,
  onNavigate,
}: {
  label: string;
  icon?: React.ReactNode;
  items: NavItem[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="gap-1.5">
        {icon}
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-1">
          {items.map(({ label, href, Icon, ready }) => (
            <SidebarMenuItem key={href}>
              {ready ? (
                <SidebarMenuButton
                  size="lg"
                  isActive={pathname === href}
                  className="rounded-xl text-base [&_svg]:size-5"
                  render={<Link href={href} onClick={onNavigate} />}
                >
                  <Icon />
                  <span>{label}</span>
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton
                  size="lg"
                  disabled
                  className="rounded-xl text-base [&_svg]:size-5"
                >
                  <Icon />
                  <span className="flex-1">{label}</span>
                  <Badge variant="outline" className="text-[10px]">
                    เร็วๆ นี้
                  </Badge>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

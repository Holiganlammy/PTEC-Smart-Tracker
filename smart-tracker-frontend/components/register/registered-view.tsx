import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  BanIcon,
  BuildingIcon,
  CheckCircle2Icon,
  CheckIcon,
  ClockIcon,
  MailIcon,
  PhoneIcon,
  XCircleIcon,
  XIcon,
} from "lucide-react";
import type { RegisteredMe } from "@/lib/api";

type ViewKey = "pending" | "approved" | "rejected" | "inactive";

const VIEW: Record<
  ViewKey,
  {
    title: string;
    description: string;
    Icon: typeof ClockIcon;
    tone: string; // สีข้อความ/ไอคอน
    soft: string; // สีพื้นวงกลมไอคอน
  }
> = {
  pending: {
    title: "รอตรวจสอบ",
    description: "เจ้าหน้าที่ OPS กำลังตรวจสอบข้อมูลของคุณ ปิดหน้านี้ได้ แล้วกลับมาเปิดดูสถานะภายหลัง",
    Icon: ClockIcon,
    tone: "text-warning",
    soft: "bg-warning-soft",
  },
  approved: {
    title: "อนุมัติแล้ว",
    description: "บัญชีของคุณพร้อมใช้งานระบบแจ้งซ่อมแล้ว",
    Icon: CheckCircle2Icon,
    tone: "text-success",
    soft: "bg-success-soft",
  },
  rejected: {
    title: "ไม่อนุมัติ",
    description: "ข้อมูลที่ลงทะเบียนไม่ผ่านการตรวจสอบ หากคิดว่าไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ",
    Icon: XCircleIcon,
    tone: "text-danger",
    soft: "bg-danger/10",
  },
  inactive: {
    title: "บัญชีถูกปิดการใช้งาน",
    description: "ขณะนี้บัญชีของคุณใช้งานไม่ได้ กรุณาติดต่อผู้ดูแลระบบ",
    Icon: BanIcon,
    tone: "text-danger",
    soft: "bg-danger/10",
  },
};

function viewKey(me: RegisteredMe): ViewKey {
  if (!me.active || me.status === "suspended") return "inactive";
  if (me.status === "approved") return "approved";
  if (me.status === "rejected") return "rejected";
  return "pending";
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

/** หน้า "คุณลงทะเบียนแล้ว" — แสดงสถานะ ขั้นตอน และข้อมูลที่ลงทะเบียนไว้ */
export function RegisteredView({ me }: { me: RegisteredMe }) {
  const key = viewKey(me);
  const { title, description, Icon, tone, soft } = VIEW[key];
  const fullName = [me.firstName, me.lastName].filter(Boolean).join(" ");

  return (
    <div className="space-y-4 p-4">
      {/* สถานะหลัก */}
      <section className="flex flex-col items-center rounded-3xl border bg-card px-5 py-7 text-center shadow-sm">
        <div className={`flex size-16 items-center justify-center rounded-full ${soft} ${tone}`}>
          <Icon className="size-8" />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">คุณลงทะเบียนแล้ว</p>
        <h2 className={`font-heading text-xl font-medium ${tone}`}>{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>

        {key === "rejected" && me.rejectReason && (
          <div className="mt-4 w-full rounded-xl bg-danger/10 px-3 py-2.5 text-left text-sm">
            <p className="text-xs text-muted-foreground">เหตุผล</p>
            <p className="text-danger">{me.rejectReason}</p>
          </div>
        )}
      </section>

      {/* ขั้นตอน */}
      <Steps me={me} />

      {/* ข้อมูลที่ลงทะเบียน */}
      <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Avatar className="size-11">
            <AvatarImage src={me.line.pictureUrl ?? undefined} alt="" />
            <AvatarFallback>{me.firstName.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium">{fullName}</p>
            {me.line.displayName && (
              <p className="truncate text-xs text-muted-foreground">LINE: {me.line.displayName}</p>
            )}
          </div>
        </div>

        <dl className="space-y-2 border-t pt-3 text-sm">
          <InfoRow icon={<BuildingIcon className="size-4" />}>
            <span className="block">{me.venderName ?? me.venderCode ?? "-"}</span>
            {me.venderCode && (
              <span className="block font-mono text-xs text-muted-foreground">{me.venderCode}</span>
            )}
          </InfoRow>
          <InfoRow icon={<PhoneIcon className="size-4" />}>{me.phoneNumber}</InfoRow>
          {me.email && (
            <InfoRow icon={<MailIcon className="size-4" />}>
              <span className="break-all">{me.email}</span>
            </InfoRow>
          )}
        </dl>
      </section>
    </div>
  );
}

type StepState = "done" | "current" | "failed" | "todo";

function Steps({ me }: { me: RegisteredMe }) {
  const key = viewKey(me);
  const decided = key === "approved" || key === "rejected" || key === "inactive";
  const decidedDate = formatDate(me.approvedAt);

  const steps: { label: string; note: string | null; state: StepState }[] = [
    { label: "ส่งใบสมัคร", note: formatDate(me.createdAt), state: "done" },
    {
      label: "รอแอดมินตรวจสอบ",
      note: null,
      state: decided ? "done" : "current",
    },
    key === "rejected"
      ? { label: "ไม่อนุมัติ", note: decidedDate, state: "failed" }
      : { label: "อนุมัติ พร้อมใช้งาน", note: decided ? decidedDate : null, state: key === "pending" ? "todo" : "done" },
  ];

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <p className="mb-3 text-sm font-medium">ขั้นตอนการสมัคร</p>
      <ol>
        {steps.map((step, i) => (
          <li key={step.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <StepDot state={step.state} />
              {i < steps.length - 1 && <span className="my-1 w-px flex-1 bg-border" />}
            </div>
            <div className={`pb-4 ${i === steps.length - 1 ? "pb-0" : ""}`}>
              <p className={`text-sm ${step.state === "todo" ? "text-muted-foreground" : "font-medium"}`}>
                {step.label}
              </p>
              {step.note && <p className="text-xs text-muted-foreground">{step.note}</p>}
              {step.state === "current" && <p className="text-xs text-warning">กำลังดำเนินการ</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function StepDot({ state }: { state: StepState }) {
  const base = "flex size-6 shrink-0 items-center justify-center rounded-full";
  if (state === "done") {
    return (
      <span className={`${base} bg-success text-white`}>
        <CheckIcon className="size-3.5" />
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span className={`${base} bg-danger text-white`}>
        <XIcon className="size-3.5" />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className={`${base} bg-warning-soft text-warning`}>
        <ClockIcon className="size-3.5" />
      </span>
    );
  }
  return <span className={`${base} border-2 border-dashed border-border`} />;
}

function InfoRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

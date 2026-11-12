"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { MessageCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError, api, type UserStatus, type Vender } from "@/lib/api";
import { DebugTracePanel } from "@/components/debug-trace-panel";
import {
  MAX_LOADS_PER_WINDOW,
  registerPageLoad,
  resetLoadGuard,
  trace,
} from "@/lib/debug-trace";
import { http } from "@/lib/http";
import { getLineSession, type LineSession } from "@/lib/liff";
import { ApplicationStatus } from "./application-status";
import { BenefitsCard } from "./benefits-card";
import { VenderCombobox } from "./vender-combobox";

type Stage =
  | { name: "loading" }
  | { name: "error"; message: string }
  | { name: "form" }
  | { name: "registered"; status: UserStatus; rejectReason: string | null };

const PHONE_PATTERN = /^0\d{8,9}$/; // ตรงกับ backend (AddUserDto)

const registerSchema = z.object({
  fullName: z.string().trim().min(1, "กรุณากรอกชื่อ-นามสกุล"),
  phone: z.string().regex(PHONE_PATTERN, "เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก ขึ้นต้นด้วย 0"),
  email: z.union([z.literal(""), z.email("รูปแบบอีเมลไม่ถูกต้อง")]),
  vender: z
    .object({ venderCode: z.string(), venderName: z.string() })
    .nullable()
    .refine((v) => v !== null, "กรุณาเลือกบริษัทผู้รับเหมา"),
});

type RegisterType = z.input<typeof registerSchema>;

export default function RegisterForm() {
  const [stage, setStage] = useState<Stage>({ name: "loading" });
  const [session, setSession] = useState<LineSession | null>(null);
  const [venders, setVenders] = useState<Vender[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<RegisterType, unknown, RegisterType>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", phone: "", email: "", vender: null },
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // ตัดวงจรวน: โหลดหน้านี้ซ้ำเกินกำหนดใน 1 นาที = มี redirect วนอยู่ ให้หยุดก่อนเรียก LIFF
        const loads = registerPageLoad();
        trace(`หน้านี้โหลดครั้งที่ ${loads} ใน 1 นาที UA=${navigator.userAgent}`);
        if (loads > MAX_LOADS_PER_WINDOW) {
          throw new Error(
            "หน้านี้ถูกโหลดซ้ำหลายครั้งผิดปกติ (น่าจะวนล็อกอิน) จึงหยุดไว้ก่อน — ดูบันทึกด้านล่าง",
          );
        }

        const line = await getLineSession();
        if (!line) return; // กำลังพาไปล็อกอิน LINE
        if (cancelled) return;
        setSession(line);
        http.setAuthToken(line.idToken); // ทุก request หลังจากนี้ติด Authorization: Bearer ให้เอง

        const me = await api.getMe();
        if (cancelled) return;

        if (me.registered) {
          setStage({
            name: "registered",
            status: me.status,
            rejectReason: me.rejectReason,
          });
          return;
        }

        setVenders(await api.getVenders());
        if (!cancelled) setStage({ name: "form" });
      } catch (e) {
        if (!cancelled) {
          setStage({
            name: "error",
            message: e instanceof Error ? e.message : "เกิดข้อผิดพลาด",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (values: RegisterType) => {
    if (!session || !values.vender) return;

    setSubmitting(true);
    try {
      const result = await api.register({
        idToken: session.idToken,
        fullName: values.fullName,
        phoneNumber: values.phone,
        email: values.email.trim() || undefined,
        venderCode: values.vender.venderCode,
      });
      toast.success("ลงทะเบียนสำเร็จ", { description: "รอผู้ดูแลตรวจสอบและอนุมัติ" });
      setStage({ name: "registered", status: result.status, rejectReason: null });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // สมัครไปแล้ว — แสดงสถานะแทน
        const status = (err.body as { status?: UserStatus } | undefined)?.status ?? "pending";
        toast.info("บัญชี LINE นี้ลงทะเบียนไว้แล้ว");
        setStage({ name: "registered", status, rejectReason: null });
      } else {
        const message = err instanceof Error ? err.message : "ลงทะเบียนไม่สำเร็จ";
        toast.error("ลงทะเบียนไม่สำเร็จ", { description: message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (stage.name === "loading") {
    return <p className="p-8 text-center text-sm text-muted-foreground">กำลังโหลด…</p>;
  }

  if (stage.name === "error") {
    return (
      <div className="space-y-3 p-8 text-center">
        <p className="text-sm text-danger">{stage.message}</p>
        <Button
          variant="outline"
          onClick={() => {
            resetLoadGuard();
            location.reload();
          }}
        >
          ลองอีกครั้ง
        </Button>
        <DebugTracePanel />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="px-1 pt-2">
        <h2 className="font-heading text-xl font-medium">ลงทะเบียนผู้รับเหมา</h2>
        <p className="text-sm text-muted-foreground">
          กรอกข้อมูลให้ครบก่อนเริ่มใช้งานระบบแจ้งซ่อม
        </p>
      </div>

      {stage.name === "form" && (
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="space-y-4 rounded-3xl border bg-card p-4 shadow-sm"
        >
          <div className="flex items-center gap-3 rounded-xl bg-success-soft px-3 py-2.5 text-success">
            <MessageCircleIcon className="size-5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] leading-tight">เชื่อมต่อ LINE แล้ว</p>
              <p className="truncate font-medium">{session?.displayName}</p>
            </div>
          </div>

          <Controller
            name="fullName"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>ชื่อจริง / นามสกุล</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  placeholder="มนตรี การช่าง"
                  autoComplete="name"
                  aria-invalid={fieldState.invalid}
                  className="h-11 rounded-xl"
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="phone"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>เบอร์โทร</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="tel"
                  inputMode="numeric"
                  onChange={(e) => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="08X-XXX-XXXX"
                  autoComplete="tel"
                  aria-invalid={fieldState.invalid}
                  className="h-11 rounded-xl"
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>อีเมล</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="email"
                  placeholder="name@company.com"
                  autoComplete="email"
                  aria-invalid={fieldState.invalid}
                  className="h-11 rounded-xl"
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="vender"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>เลือกบริษัทผู้รับเหมา</FieldLabel>
                <VenderCombobox
                  venders={venders}
                  value={field.value}
                  onChange={field.onChange}
                  invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />


          <Button type="submit" size="lg" className="h-12 w-full rounded-xl" disabled={submitting}>
            {submitting ? "กำลังบันทึก…" : "ลงทะเบียน"}
          </Button>
        </form>
      )}

      {stage.name === "registered" && (
        <ApplicationStatus status={stage.status} rejectReason={stage.rejectReason} />
      )}

      <BenefitsCard />
    </div>
  );
}

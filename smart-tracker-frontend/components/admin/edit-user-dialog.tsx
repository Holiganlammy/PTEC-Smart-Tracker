"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  api,
  type AdminRole,
  type AdminUser,
  type RoleId,
  type UpdateUserInput,
  type Vender,
} from "@/lib/api";
import { VenderCombobox } from "@/components/register/vender-combobox";

const PHONE_PATTERN = /^0\d{8,9}$/; // ตรงกับ backend

const editSchema = z.object({
  firstName: z.string().trim().min(1, "กรุณากรอกชื่อ").max(100, "ไม่เกิน 100 ตัวอักษร"),
  lastName: z.string().trim().max(100, "ไม่เกิน 100 ตัวอักษร"),
  phone: z.string().regex(PHONE_PATTERN, "เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก ขึ้นต้นด้วย 0"),
  email: z.union([z.literal(""), z.email("รูปแบบอีเมลไม่ถูกต้อง")]),
  vender: z
    .object({ venderCode: z.string(), venderName: z.string() })
    .nullable()
    .refine((v) => v !== null, "กรุณาเลือกบริษัทผู้รับเหมา"),
  roleId: z.number(),
});

type EditValues = z.input<typeof editSchema>;

type Props = {
  /** ผู้ใช้ที่กำลังแก้ (null = ปิด dialog) */
  user: AdminUser | null;
  /** แก้ข้อมูลของตัวเอง (เปลี่ยนสิทธิ์ตัวเองไม่ได้) */
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
};

function toDefaults(user: AdminUser): EditValues {
  return {
    firstName: user.firstName,
    lastName: user.lastName ?? "",
    phone: user.phoneNumber,
    email: user.email ?? "",
    vender: user.venderCode
      ? { venderCode: user.venderCode, venderName: user.venderName ?? user.venderCode }
      : null,
    roleId: user.roleId,
  };
}

/** แอดมินแก้ข้อมูลผู้ใช้ (ชื่อ เบอร์ อีเมล บริษัท สิทธิ์) */
export function EditUserDialog({ user, isSelf, onClose, onSaved }: Props) {
  const [venders, setVenders] = useState<Vender[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);

  const form = useForm<EditValues, unknown, EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: user ? toDefaults(user) : undefined,
  });

  // เปิดแก้ผู้ใช้คนใหม่ → ใส่ค่าของคนนั้น + โหลดรายชื่อบริษัท/สิทธิ์ (โหลดครั้งเดียว)
  useEffect(() => {
    if (!user) return;
    form.reset(toDefaults(user));
  }, [user, form]);

  useEffect(() => {
    if (!user || (venders.length > 0 && roles.length > 0)) return;
    Promise.all([api.getVenders(), api.getRoles()])
      .then(([v, r]) => {
        setVenders(v);
        setRoles(r);
      })
      .catch((e) =>
        toast.error("โหลดรายการบริษัท/สิทธิ์ไม่สำเร็จ", {
          description: e instanceof Error ? e.message : undefined,
        }),
      );
  }, [user, venders.length, roles.length]);

  // ยังโหลดรายการไม่เสร็จ แสดงสิทธิ์ปัจจุบันไว้ก่อน
  const roleItems = (roles.length > 0 ? roles : user ? [{ id: user.roleId, nameTh: user.roleName }] : []).map(
    (r) => ({ value: r.id, label: r.nameTh }),
  );

  async function submit(values: EditValues) {
    if (!user || !values.vender) return;

    // ส่งเฉพาะช่องที่เปลี่ยน
    const changes: UpdateUserInput = {};
    if (values.firstName.trim() !== user.firstName) changes.firstName = values.firstName.trim();
    if (values.lastName.trim() !== (user.lastName ?? "")) changes.lastName = values.lastName.trim();
    if (values.phone !== user.phoneNumber) changes.phoneNumber = values.phone;
    if (values.email !== (user.email ?? "")) changes.email = values.email;
    if (values.vender.venderCode !== user.venderCode) changes.venderCode = values.vender.venderCode;
    if (values.roleId !== user.roleId) changes.roleId = values.roleId as RoleId;

    if (Object.keys(changes).length === 0) {
      toast.info("ไม่มีข้อมูลที่เปลี่ยน");
      onClose();
      return;
    }

    try {
      await api.updateUser(user.id, changes);
      toast.success("บันทึกข้อมูลแล้ว");
      onSaved();
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
    }
  }

  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form onSubmit={form.handleSubmit(submit)} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>แก้ไขข้อมูลผู้ใช้</DialogTitle>
            <DialogDescription>
              {user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <Controller
              name="firstName"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>ชื่อ</FieldLabel>
                  <Input {...field} id={field.name} aria-invalid={fieldState.invalid} className="h-11 rounded-xl" />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="lastName"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>นามสกุล</FieldLabel>
                  <Input {...field} id={field.name} aria-invalid={fieldState.invalid} className="h-11 rounded-xl" />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </div>

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
                  placeholder="ไม่บังคับ"
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
                <FieldLabel>บริษัทผู้รับเหมา</FieldLabel>
                <VenderCombobox
                  key={user?.id}
                  venders={venders}
                  value={field.value}
                  onChange={field.onChange}
                  invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="roleId"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>สิทธิ์การใช้งาน</FieldLabel>
                <Select
                  items={roleItems}
                  value={field.value}
                  onValueChange={(v) => field.onChange(v)}
                  disabled={isSelf}
                >
                  <SelectTrigger id={field.name} className="h-11 w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>role</SelectLabel>
                      {roleItems.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {isSelf && (
                  <p className="text-xs text-muted-foreground">เปลี่ยนสิทธิ์ของบัญชีตัวเองไม่ได้</p>
                )}
              </Field>
            )}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

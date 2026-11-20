"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Textarea } from "@/components/ui/textarea";

const rejectSchema = z.object({
  reason: z.string().trim().min(1, "กรุณาระบุเหตุผล").max(500, "ไม่เกิน 500 ตัวอักษร"),
});

type RejectValues = z.infer<typeof rejectSchema>;

type Props = {
  /** สิ่งที่กำลังจะไม่อนุมัติ/ตีกลับ เช่น ชื่อผู้สมัคร หรือเลขงาน (null = ปิด dialog) */
  subject: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  /** ปรับข้อความได้ (ค่าเริ่มต้นเป็นของการไม่อนุมัติผู้สมัคร) */
  title?: string;
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
};

/** กรอกเหตุผลก่อนไม่อนุมัติ/ตีกลับ (ใช้กับผู้สมัคร และงานในคิวตรวจ) */
export function RejectDialog({
  subject,
  onClose,
  onConfirm,
  title = "ไม่อนุมัติผู้สมัคร",
  label = "เหตุผลที่ไม่อนุมัติ",
  placeholder = "เช่น ข้อมูลบริษัทไม่ตรงกับที่ลงทะเบียนไว้",
  confirmLabel = "ยืนยันไม่อนุมัติ",
}: Props) {
  const form = useForm<RejectValues>({
    resolver: zodResolver(rejectSchema),
    defaultValues: { reason: "" },
  });

  async function submit(values: RejectValues) {
    await onConfirm(values.reason);
    form.reset();
  }

  return (
    <Dialog
      open={subject !== null}
      onOpenChange={(open) => {
        if (!open) {
          form.reset();
          onClose();
        }
      }}
    >
      <DialogContent>
        <form onSubmit={form.handleSubmit(submit)} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{subject}</DialogDescription>
          </DialogHeader>

          <Controller
            name="reason"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
                <Textarea
                  {...field}
                  id={field.name}
                  rows={3}
                  placeholder={placeholder}
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button type="submit" variant="destructive" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "กำลังบันทึก…" : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

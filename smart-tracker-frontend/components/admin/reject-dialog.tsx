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
  /** ชื่อผู้สมัครที่กำลังจะตีกลับ (null = ปิด dialog) */
  userName: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
};

/** กรอกเหตุผลก่อนตีกลับผู้สมัคร (ผู้สมัครเห็นเหตุผลนี้ในหน้าสถานะ) */
export function RejectDialog({ userName, onClose, onConfirm }: Props) {
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
      open={userName !== null}
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
            <DialogTitle>ไม่อนุมัติผู้สมัคร</DialogTitle>
            <DialogDescription>{userName}</DialogDescription>
          </DialogHeader>

          <Controller
            name="reason"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>เหตุผลที่ไม่อนุมัติ</FieldLabel>
                <Textarea
                  {...field}
                  id={field.name}
                  rows={3}
                  placeholder="เช่น ข้อมูลบริษัทไม่ตรงกับที่ลงทะเบียนไว้"
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
              {form.formState.isSubmitting ? "กำลังบันทึก…" : "ยืนยันไม่อนุมัติ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, type JobEditFields, type JobType, type ReviewJob } from "@/lib/api";
import { JobTypeCombobox } from "./job-type-combobox";

const editSchema = z.object({
  jobType: z.string().trim().max(100, "ไม่เกิน 100 ตัวอักษร"),
  branchName: z.string().trim().max(200, "ไม่เกิน 200 ตัวอักษร"),
  details: z.string().trim().max(2000, "ไม่เกิน 2,000 ตัวอักษร"),
  brand: z.string().trim().max(100, "ไม่เกิน 100 ตัวอักษร"),
  model: z.string().trim().max(100, "ไม่เกิน 100 ตัวอักษร"),
  reporterName: z.string().trim().max(200, "ไม่เกิน 200 ตัวอักษร"),
  reporterPhone: z.string().trim().max(30, "ไม่เกิน 30 ตัวอักษร"),
  address: z.string().trim().max(500, "ไม่เกิน 500 ตัวอักษร"),
});

function toValues(job: ReviewJob): JobEditFields {
  return {
    jobType: job.jobType ?? "",
    branchName: job.branchName ?? "",
    details: job.details ?? "",
    brand: job.brand ?? "",
    model: job.model ?? "",
    reporterName: job.reporterName ?? "",
    reporterPhone: job.reporterPhone ?? "",
    address: job.address ?? "",
  };
}

type Props = {
  /** งานที่กำลังแก้ (null = ปิด dialog) */
  job: ReviewJob | null;
  onClose: () => void;
  onSave: (job: ReviewJob, values: JobEditFields) => Promise<void>;
};

/** แก้ข้อมูลงานที่ส่งมาจาก OPS ก่อนอนุมัติ (เฉพาะแอดมิน) */
export function JobEditDialog({ job, onClose, onSave }: Props) {
  const [types, setTypes] = useState<JobType[] | null>(null);
  const opened = job !== null;

  // โหลดรายการประเภทงานของ OPS ครั้งแรกที่เปิด dialog (ใช้ซ้ำหลังจากนั้น)
  useEffect(() => {
    if (!opened || types !== null) return;
    let cancelled = false;
    api
      .listJobTypes()
      .then((list) => !cancelled && setTypes(list))
      .catch((e: unknown) => {
        if (cancelled) return;
        toast.error("โหลดประเภทงานไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
        setTypes([]); // ยังแก้ช่องอื่นได้ (ประเภทงานเดิมยังเลือกค้างไว้ได้)
      });
    return () => {
      cancelled = true;
    };
  }, [opened, types]);

  return (
    <Dialog open={opened} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        {/* key = เปลี่ยนงาน → ฟอร์มเริ่มใหม่ด้วยค่าของงานนั้น */}
        {job && <JobEditForm key={job.id} job={job} types={types} onClose={onClose} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  );
}

function JobEditForm({
  job,
  types,
  onClose,
  onSave,
}: {
  job: ReviewJob;
  types: JobType[] | null;
  onClose: () => void;
  onSave: Props["onSave"];
}) {
  const form = useForm<JobEditFields>({
    resolver: zodResolver(editSchema),
    defaultValues: toValues(job),
  });

  return (
    <form onSubmit={form.handleSubmit((values) => onSave(job, values))} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle>แก้ไขข้อมูลงาน</DialogTitle>
        <DialogDescription>
          {job.jobCode}
          {job.opsJobCode ? ` · OPS ${job.opsJobCode}` : ""}
        </DialogDescription>
      </DialogHeader>

      <Controller
        name="jobType"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>ประเภทงาน</FieldLabel>
            {types === null ? (
              <Skeleton className="h-11 rounded-xl" />
            ) : (
              <JobTypeCombobox
                id={field.name}
                types={types}
                value={field.value}
                onChange={field.onChange}
                invalid={fieldState.invalid}
              />
            )}
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <div className="grid grid-cols-2 gap-3">
        <Controller
          name="reporterName"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>ผู้แจ้ง</FieldLabel>
              <Input {...field} id={field.name} aria-invalid={fieldState.invalid} />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="reporterPhone"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>เบอร์ผู้แจ้ง</FieldLabel>
              <Input {...field} id={field.name} inputMode="tel" aria-invalid={fieldState.invalid} />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </div>

      <Controller
        name="branchName"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>สาขา</FieldLabel>
            <Input {...field} id={field.name} aria-invalid={fieldState.invalid} />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <Controller
        name="address"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>ที่อยู่สถานที่</FieldLabel>
            <Textarea {...field} id={field.name} rows={2} aria-invalid={fieldState.invalid} />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <Controller
        name="details"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>รายละเอียดงาน</FieldLabel>
            <Textarea {...field} id={field.name} rows={4} aria-invalid={fieldState.invalid} />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <div className="grid grid-cols-2 gap-3">
        <Controller
          name="brand"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>ยี่ห้อ</FieldLabel>
              <Input {...field} id={field.name} aria-invalid={fieldState.invalid} />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="model"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>รุ่น</FieldLabel>
              <Input {...field} id={field.name} aria-invalid={fieldState.invalid} />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </DialogFooter>
    </form>
  );
}

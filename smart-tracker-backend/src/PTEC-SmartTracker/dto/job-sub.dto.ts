import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() || undefined : value;

/**
 * POST /jobs/:id/subjobs (multipart/form-data) — ผู้รับเหมาหลักมอบหมายงานย่อยให้บริษัทอื่น
 *   venderCode  บริษัทผู้รับเหมาช่วง (ต้องไม่ใช่บริษัทของตัวเอง)
 *   scope       ขอบเขตงานที่มอบหมาย
 *   dueDate     กำหนดเสร็จ "YYYY-MM-DD" (ไม่ย้อนหลัง)
 *   dueTime     เวลากำหนดเสร็จ "HH:mm" (ถ้าเป็นวันนี้ ต้องเป็นเวลาหลังจากนี้)
 *   note        หมายเหตุ (ไม่บังคับ)
 *   files[]     รูปประกอบ (ไม่บังคับ — บริษัทผู้รับช่วงเห็นในขั้น "แจ้งงาน")
 */
export class CreateSubJobDto {
  @Transform(trim)
  @IsString({ message: 'กรุณาเลือกบริษัทผู้รับเหมาช่วง' })
  @IsNotEmpty({ message: 'กรุณาเลือกบริษัทผู้รับเหมาช่วง' })
  @MaxLength(30)
  venderCode!: string;

  @Transform(trim)
  @IsString({ message: 'กรุณาระบุขอบเขตงานที่มอบหมาย' })
  @IsNotEmpty({ message: 'กรุณาระบุขอบเขตงานที่มอบหมาย' })
  @MaxLength(2000, { message: 'ขอบเขตงานยาวเกิน 2000 ตัวอักษร' })
  scope!: string;

  @Transform(trim)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'กรุณาระบุกำหนดเสร็จงานย่อย' })
  dueDate!: string;

  @Transform(trim)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'กรุณาระบุเวลากำหนดเสร็จ (รูปแบบ HH:mm)',
  })
  dueTime!: string;

  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'หมายเหตุยาวเกิน 500 ตัวอักษร' })
  note?: string;
}

/**
 * PATCH /jobs/:id/subjobs/:subId/inspect — หัวหน้าตรวจงานย่อยที่บริษัทรายย่อยส่งมา
 *   result  approve = ตรวจรับผ่าน (ปิดงานย่อย), rework = ตีกลับให้แก้ไข (กลับไปกำลังดำเนินการ)
 *   note    หมายเหตุ — ตีกลับต้องระบุสิ่งที่ต้องแก้ไข (ตรวจที่ service)
 */
export class InspectSubJobDto {
  @IsIn(['approve', 'rework'], { message: 'ผลการตรวจไม่ถูกต้อง' })
  result!: 'approve' | 'rework';

  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'หมายเหตุยาวเกิน 500 ตัวอักษร' })
  note?: string;
}

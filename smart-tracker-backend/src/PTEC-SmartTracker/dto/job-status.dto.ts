import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { JOB_ACTIONS, type JobAction } from '../type/job.type';

const trimToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() || undefined : value;

/**
 * POST /jobs/:id/status (multipart/form-data)
 *   action      accept | start | wait_parts | resume | deliver
 *   note        หมายเหตุ (ไม่บังคับ)
 *   repairedAt  วันเวลาที่ซ่อมเสร็จ "YYYY-MM-DDTHH:mm" เวลาท้องถิ่นไม่มี timezone — บังคับเมื่อ deliver
 *   details     รายละเอียดการซ่อม — บังคับเมื่อ deliver
 *   files[]       รูปของขั้นตอนนี้ (accept → ยืนยันรับงาน, start/wait_parts/resume → กำลังดำเนินงาน, deliver → หลังซ่อมเสร็จ)
 *   beforeFiles[] รูปก่อนซ่อม (เฉพาะ deliver เก็บเป็นรูปขั้นกำลังดำเนินงาน)
 */
export class ChangeJobStatusDto {
  @IsIn(JOB_ACTIONS)
  action!: JobAction;

  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  /** เวลาท้องถิ่นแบบไม่มี timezone เช่น 2026-11-19T10:30 (เหมือนเวลาอื่นในฐานข้อมูล) */
  @Transform(trimToUndefined)
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, {
    message: 'รูปแบบวันเวลาที่ซ่อมเสร็จไม่ถูกต้อง',
  })
  repairedAt?: string;

  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;
}

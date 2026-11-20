import { IsOptional, Matches } from 'class-validator';

/** PATCH /jobs/:id/assign — มอบหมายงานให้ผู้รับเหมาช่วง (null = ยกเลิกการมอบหมาย) */
export class AssignJobDto {
  @IsOptional()
  @Matches(/^\d{1,19}$/, { message: 'รหัสผู้รับเหมาช่วงไม่ถูกต้อง' })
  assigneeId?: string | null;
}

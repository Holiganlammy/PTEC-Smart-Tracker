import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const trimToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() || undefined : value;

/** PATCH /jobs/:id/reassign — แอดมินย้ายงานไปให้บริษัทผู้รับเหมาอื่น */
export class ReassignJobDto {
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'กรุณาเลือกบริษัท' })
  @IsNotEmpty({ message: 'กรุณาเลือกบริษัท' })
  @MaxLength(30)
  venderCode!: string;

  /** หมายเหตุของแอดมิน (เก็บในประวัติ ไม่แสดงให้บริษัทใหม่เห็น) */
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** ข้อความที่ trim แล้ว; ว่างเปล่า = null (ล้างค่า) */
const emptyToNull = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() || null : value;

/** PATCH /jobs/:id — แอดมินแก้ข้อมูลงานที่ส่งมาจาก OPS (ส่งครบทุกช่อง; ช่องว่าง = ล้างค่า) */
export class UpdateJobDto {
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobType?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  branchName?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reporterName?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  reporterPhone?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;
}

/** PATCH /jobs/:id/return — ตีกลับงานที่รอแอดมินตรวจ */
export class ReturnJobDto {
  /** เหตุผลที่ตีกลับ (แอดมินใช้แจ้งต่อ) */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'กรุณาระบุเหตุผล' })
  @MaxLength(500)
  note!: string;
}

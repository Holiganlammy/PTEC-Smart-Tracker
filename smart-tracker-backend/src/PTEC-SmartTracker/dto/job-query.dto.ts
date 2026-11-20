import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const JOB_GROUPS = ['all', 'open', 'closed'] as const;
export type JobGroup = (typeof JOB_GROUPS)[number];

export class ListJobsQuery {
  /** all = ทั้งหมด, open = กำลังดำเนินการ, closed = ปิดงาน/ยกเลิก */
  @IsOptional()
  @IsIn(JOB_GROUPS)
  group?: JobGroup;

  /** ค้นหาเลขที่งาน หรือรายละเอียดงาน */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;

  /** กรองตามสถานะ (รหัสสถานะคั่นด้วย , เช่น status=2,3) */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .filter((v) => v.trim() !== '')
          .map(Number)
      : value,
  )
  @IsArray()
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(99, { each: true })
  status?: number[];

  /** กรองตามสาขา (branch_code) */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  branch?: string;

  /** เฉพาะงานที่แจ้งภายใน N วันล่าสุด */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;

  /** เฉพาะแอดมิน: ดูงานของบริษัทอื่น (ผู้ใช้ทั่วไปถูกบังคับเป็นบริษัทตัวเอง) */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  venderCode?: string;
}

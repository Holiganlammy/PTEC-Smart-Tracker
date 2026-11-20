import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/** POST /jobs/:id/messages  { body } */
export class SendJobMessageDto {
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'กรุณาพิมพ์ข้อความ' })
  @IsNotEmpty({ message: 'กรุณาพิมพ์ข้อความ' })
  @MaxLength(1000, { message: 'ข้อความยาวเกิน 1,000 ตัวอักษร' })
  body!: string;
}

/** GET /jobs/:id/messages?after=<id> — after = id ข้อความล่าสุดที่เห็นแล้ว (ไม่ส่ง = ดึง 200 ข้อความล่าสุด) */
export class ListJobMessagesQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  after?: number;
}

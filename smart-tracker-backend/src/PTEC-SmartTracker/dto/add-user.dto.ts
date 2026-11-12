import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** Body ของ POST /users/register (หน้าลงทะเบียนผู้รับเหมา) */
export class AddUserDto {
  /** LIFF ID Token จาก liff.getIDToken() — userId ของ LINE ได้จากการ verify token นี้เท่านั้น ไม่รับจาก client */
  @IsString()
  @IsNotEmpty()
  idToken: string;

  /** ช่องเดียว "ชื่อจริง / นามสกุล" — service จะตัดที่ช่องว่างแรก */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName: string;

  @Matches(/^0\d{8,9}$/, { message: 'เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก ขึ้นต้นด้วย 0' })
  phoneNumber: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  /** รหัสบริษัทผู้รับเหมา (vender_code) จาก dropdown */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  venderCode: string;
}

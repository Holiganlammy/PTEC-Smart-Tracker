import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { RoleId } from '../model/role.model';

/** Body ของ PATCH /users/:id/reject */
export class RejectUserDto {
  @IsString()
  @IsNotEmpty({ message: 'กรุณาระบุเหตุผล' })
  @MaxLength(500)
  reason: string;
}

/** Body ของ PATCH /users/:id/active (เปิด/ปิดผู้ใช้) */
export class SetActiveDto {
  @IsBoolean()
  active: boolean;
}

/** Body ของ PATCH /users/:id (แอดมินแก้ข้อมูลผู้ใช้ — ส่งเฉพาะช่องที่จะแก้) */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'กรุณากรอกชื่อ' })
  @MaxLength(100)
  firstName?: string;

  /** ส่งค่าว่างเพื่อล้างนามสกุล */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @Matches(/^0d{8,9}$/, {
    message: 'เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก ขึ้นต้นด้วย 0',
  })
  phoneNumber?: string;

  /** ส่งค่าว่างเพื่อล้างอีเมล */
  @ValidateIf((_, v) => v !== undefined && v !== '')
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  venderCode?: string;

  @IsOptional()
  @IsInt()
  @IsIn(Object.values(RoleId).filter((v): v is number => typeof v === 'number'))
  roleId?: number;
}

/** Query ของ GET /users */
export class ListUsersQuery {
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected', 'suspended'])
  status?: 'pending' | 'approved' | 'rejected' | 'suspended';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  /** กรองตามเปิด/ปิดใช้งาน */
  @IsOptional()
  @IsIn(['true', 'false'])
  active?: 'true' | 'false';
}

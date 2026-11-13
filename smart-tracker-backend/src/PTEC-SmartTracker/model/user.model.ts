import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Role, RoleId } from './role.model';

export type UserStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

/** ตาราง dbo.users */
@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string; // mssql ส่ง bigint กลับมาเป็น string

  @Column({ name: 'line_user_id', type: 'varchar', length: 100, unique: true })
  lineUserId!: string;

  @Column({
    name: 'line_display_name',
    type: 'nvarchar',
    length: 100,
    nullable: true,
  })
  lineDisplayName!: string | null;

  @Column({
    name: 'line_picture_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  linePictureUrl!: string | null;

  @Column({ name: 'first_name', type: 'nvarchar', length: 100 })
  firstName!: string;

  @Column({ name: 'last_name', type: 'nvarchar', length: 100, nullable: true })
  lastName!: string | null;

  @Column({ name: 'phone_number', type: 'varchar', length: 20 })
  phoneNumber!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email!: string | null;

  @Column({ name: 'vender_code', type: 'varchar', length: 100, nullable: true })
  venderCode!: string | null;

  /** สิทธิ์ของผู้ใช้ (อ้าง dbo.roles) */
  @Column({ name: 'role_id', type: 'int', default: RoleId.CONTRACTOR })
  roleId!: number;

  /** โหลดมาพร้อมผู้ใช้เสมอ เพื่อใช้ role.code ตรวจสิทธิ์ */
  @ManyToOne(() => Role, { eager: true })
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: UserStatus;

  /** เปิด/ปิดการใช้งานผู้ใช้ (bit 1/0) แยกจาก status */
  @Column({ type: 'bit', nullable: false, default: true })
  active!: boolean;

  @Column({ name: 'approved_by', type: 'bigint', nullable: true })
  approvedBy!: string | null;

  @Column({
    name: 'approved_at',
    type: 'datetime2',
    precision: 0,
    nullable: true,
  })
  approvedAt!: Date | null;

  @Column({
    name: 'reject_reason',
    type: 'nvarchar',
    length: 500,
    nullable: true,
  })
  rejectReason!: string | null;

  @Column({
    name: 'last_login_at',
    type: 'datetime2',
    precision: 0,
    nullable: true,
  })
  lastLoginAt!: Date | null;

  @Column({
    name: 'created_at',
    type: 'datetime2',
    precision: 0,
    insert: false,
    update: false,
  })
  createdAt!: Date; // ค่า default ตั้งที่ DB (SYSDATETIME)

  @Column({
    name: 'updated_at',
    type: 'datetime2',
    precision: 0,
    nullable: true,
  })
  updatedAt!: Date | null;
}

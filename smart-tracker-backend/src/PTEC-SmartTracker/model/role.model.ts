import { Column, Entity, PrimaryColumn } from 'typeorm';

/** id ของ role (ตรงกับข้อมูลตั้งต้นในตาราง dbo.roles — ห้ามเปลี่ยนเลข) */
export enum RoleId {
  CONTRACTOR = 1,
  HEAD = 2,
  SUB_CONTRACTOR = 3,
  ADMIN = 4,
}

/** ตาราง dbo.roles — ตารางอ้างอิงสิทธิ์ผู้ใช้ (users.role_id อ้างมาที่นี่) */
@Entity({ name: 'roles' })
export class Role {
  /** กำหนดเลขเอง ไม่ใช่ identity */
  @PrimaryColumn({ type: 'int' })
  id!: number;

  /** รหัสสำหรับใช้ในโค้ด/API เช่น 'admin' */
  @Column({ type: 'varchar', length: 30, unique: true })
  code!: string;

  /** ชื่อที่แสดงบนหน้าจอ */
  @Column({ name: 'name_th', type: 'nvarchar', length: 100 })
  nameTh!: string;

  @Column({ type: 'nvarchar', length: 300, nullable: true })
  description!: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ type: 'bit', nullable: false, default: true })
  active!: boolean;

  @Column({
    name: 'created_at',
    type: 'datetime2',
    precision: 0,
    insert: false,
    update: false,
  })
  createdAt!: Date; // ค่า default ตั้งที่ DB (SYSDATETIME)
}

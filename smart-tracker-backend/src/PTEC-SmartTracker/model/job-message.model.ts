import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** ตาราง dbo.Jobs_Messages — แชทของงาน (เพิ่มอย่างเดียว ไม่แก้/ลบ) */
@Entity({ name: 'Jobs_Messages' })
@Index('IX_Jobs_Messages_job', ['jobId', 'id'])
export class JobMessage {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'job_id', type: 'bigint' })
  jobId!: string;

  @Column({ name: 'sender_id', type: 'bigint' })
  senderId!: string;

  /** role ของผู้ส่ง ณ ตอนส่ง */
  @Column({ name: 'sender_role_id', type: 'int' })
  senderRoleId!: number;

  /**
   * บริษัทของงาน "ณ ตอนที่ส่งข้อความ" — ถ้างานถูกย้ายไปให้บริษัทอื่น ข้อความช่วงบริษัทเดิมจะไม่ถูกส่งให้บริษัทใหม่เห็น
   * (แอดมินเห็นทั้งหมด) null = ข้อมูลที่ไม่ได้ระบุบริษัท เห็นได้ทุกบริษัท
   */
  @Column({ name: 'vender_code', type: 'varchar', length: 30, nullable: true })
  venderCode!: string | null;

  @Column({ type: 'nvarchar', length: 1000 })
  body!: string;

  @Column({
    name: 'created_at',
    type: 'datetime2',
    precision: 6,
    insert: false,
    update: false,
  })
  createdAt!: Date;
}

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

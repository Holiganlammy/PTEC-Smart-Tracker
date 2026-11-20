import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** ชนิดเหตุการณ์ในประวัติงาน (ค่าที่เก็บใน Jobs_Logs.action) */
export enum JobLogAction {
  /** งานเข้าระบบจาก OPS (บันทึกโดย SP STrack_Send_AcceptJobs_V2) */
  CREATED = 'created',
  /** แอดมินแก้ข้อมูลงาน */
  UPDATED = 'updated',
  APPROVED = 'approved',
  RETURNED = 'returned',
  /** ยกเลิกอัตโนมัติ เมื่อ OPS ส่งงานเดิมมาซ้ำ (บันทึกโดย SP) */
  CANCELLED = 'cancelled',
  /** มอบหมายงานให้ผู้รับเหมาช่วง */
  ASSIGNED = 'assigned',
  UNASSIGNED = 'unassigned',
  /** ผู้รับเหมาเปลี่ยนสถานะงาน */
  ACCEPTED = 'accepted',
  STARTED = 'started',
  WAITING_PARTS = 'waiting_parts',
  RESUMED = 'resumed',
  DELIVERED = 'delivered',
  /** แนบ/ลบไฟล์แนบ */
  ATTACHED = 'attached',
  DETACHED = 'detached',
}

/**
 * ตาราง dbo.Jobs_Logs — ประวัติทุกการเปลี่ยนแปลงของงาน (เพิ่มอย่างเดียว ไม่แก้/ลบ)
 * ใช้ทำ timeline หน้าติดตามงาน และตรวจสอบย้อนหลังว่าใครทำอะไรเมื่อไหร่
 */
@Entity({ name: 'Jobs_Logs' })
@Index('IX_Jobs_Logs_job', ['jobId', 'id'])
export class JobLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'job_id', type: 'bigint' })
  jobId!: string;

  @Column({ type: 'varchar', length: 30 })
  action!: JobLogAction;

  /** สถานะก่อน/หลัง (null = ไม่ได้เปลี่ยนสถานะ) */
  @Column({ name: 'from_status_id', type: 'int', nullable: true })
  fromStatusId!: number | null;

  @Column({ name: 'to_status_id', type: 'int', nullable: true })
  toStatusId!: number | null;

  /** ผู้ทำรายการ (Users.id) — null = ระบบ/SP */
  @Column({ name: 'actor_id', type: 'bigint', nullable: true })
  actorId!: string | null;

  /** หมายเหตุ เช่น เหตุผลที่ตีกลับ */
  @Column({ type: 'nvarchar', length: 500, nullable: true })
  note!: string | null;

  /** JSON ของช่องที่เปลี่ยน { ช่อง: { from, to } } (เฉพาะการแก้ข้อมูล) */
  @Column({ type: 'nvarchar', length: 'max', nullable: true })
  changes!: string | null;

  @Column({
    name: 'created_at',
    type: 'datetime2',
    precision: 0,
    insert: false,
    update: false,
  })
  createdAt!: Date;
}

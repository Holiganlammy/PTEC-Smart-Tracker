import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * ตาราง dbo.jobs — งานของบริษัทผู้รับเหมา (ข้อมูลของเราเอง)
 * งานที่ OPS จ่ายมาถูกคัดลอกมาเก็บที่นี่ (OPS อ่านอย่างเดียว) หลังจากนั้นแก้ที่ฝั่งเราทั้งหมด
 * ผูกกับบริษัทด้วย vender_code (รหัสเดียวกับ users.vender_code)
 */
@Entity({ name: 'Jobs' })
@Index('IX_jobs_vender_status', ['venderCode', 'statusId'])
export class Job {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  /** เลขงานของเรา (งานจาก OPS ใช้ STrack_Code เช่น STK261100152) */
  @Column({ name: 'job_code', type: 'varchar', length: 30, unique: true })
  jobCode!: string;

  @Column({ name: 'vender_code', type: 'varchar', length: 30 })
  venderCode!: string;

  @Column({ name: 'branch_code', type: 'varchar', length: 20, nullable: true })
  branchCode!: string | null;

  @Column({
    name: 'branch_name',
    type: 'nvarchar',
    length: 200,
    nullable: true,
  })
  branchName!: string | null;

  /** ประเภทงาน เช่น ตู้จ่ายน้ำมัน */
  @Column({ name: 'job_type', type: 'nvarchar', length: 100, nullable: true })
  jobType!: string | null;

  @Column({ name: 'status_id', type: 'int' })
  statusId!: number;

  @Column({ type: 'nvarchar', length: 2000, nullable: true })
  details!: string | null;

  @Column({ type: 'nvarchar', length: 100, nullable: true })
  brand!: string | null;

  @Column({ type: 'nvarchar', length: 100, nullable: true })
  model!: string | null;

  /** วันที่แจ้งงาน */
  @Column({ name: 'requested_at', type: 'datetime2', precision: 0 })
  requestedAt!: Date;

  /** เลขงานใน OPS (Jobs.JobCode) */
  @Column({
    name: 'ops_job_code',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  opsJobCode!: string | null;

  @Column({ name: 'ops_job_id', type: 'bigint', nullable: true })
  opsJobId!: string | null;

  @Column({ name: 'ops_job_detail_id', type: 'bigint', nullable: true })
  opsJobDetailId!: string | null;

  /** แอดมินที่ตรวจงาน (อนุมัติ/ตีกลับ) */
  @Column({ name: 'reviewed_by', type: 'bigint', nullable: true })
  reviewedBy!: string | null;

  @Column({
    name: 'reviewed_at',
    type: 'datetime2',
    precision: 0,
    nullable: true,
  })
  reviewedAt!: Date | null;

  /** เหตุผลที่ตีกลับ */
  @Column({
    name: 'review_note',
    type: 'nvarchar',
    length: 500,
    nullable: true,
  })
  reviewNote!: string | null;

  /** ผู้รับเหมาช่วงที่ได้รับมอบหมาย (Users.id ของ role sub_contractor) — null = ยังไม่มอบหมาย */
  @Column({ name: 'assigned_to', type: 'bigint', nullable: true })
  assignedTo!: string | null;

  @Column({
    name: 'assigned_at',
    type: 'datetime2',
    precision: 0,
    nullable: true,
  })
  assignedAt!: Date | null;

  /** ผู้แจ้ง (ผู้จัดการสาขา) — สำเนาจาก OPS ตอนส่งงาน แอดมินแก้ได้ก่อนอนุมัติ */
  @Column({
    name: 'reporter_name',
    type: 'nvarchar',
    length: 200,
    nullable: true,
  })
  reporterName!: string | null;

  @Column({
    name: 'reporter_phone',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  reporterPhone!: string | null;

  /** สถานที่ (ที่อยู่สาขา) */
  @Column({ type: 'nvarchar', length: 500, nullable: true })
  address!: string | null;

  /** ระดับความสำคัญ (PolicyLevel ของ OPS) และ SLA เป็นชั่วโมง */
  @Column({
    name: 'priority_name',
    type: 'nvarchar',
    length: 100,
    nullable: true,
  })
  priorityName!: string | null;

  @Column({ name: 'sla_hours', type: 'int', nullable: true })
  slaHours!: number | null;

  /** เวลาที่ OPS แจ้งงานจริง (ใช้นับ SLA) */
  @Column({
    name: 'ops_requested_at',
    type: 'datetime2',
    precision: 0,
    nullable: true,
  })
  opsRequestedAt!: Date | null;

  /** เจ้าหน้าที่ OPS ที่คีย์งาน */
  @Column({
    name: 'keyed_by_name',
    type: 'nvarchar',
    length: 200,
    nullable: true,
  })
  keyedByName!: string | null;

  /** วันเวลาที่ซ่อมเสร็จ (ผู้รับเหมาระบุตอนส่งงาน) */
  @Column({
    name: 'repaired_at',
    type: 'datetime2',
    precision: 0,
    nullable: true,
  })
  repairedAt!: Date | null;

  /** รายละเอียดการซ่อม (ตอนส่งงาน) */
  @Column({
    name: 'repair_details',
    type: 'nvarchar',
    length: 2000,
    nullable: true,
  })
  repairDetails!: string | null;

  @Column({
    name: 'created_at',
    type: 'datetime2',
    precision: 0,
    insert: false,
    update: false,
  })
  createdAt!: Date;

  @Column({
    name: 'updated_at',
    type: 'datetime2',
    precision: 0,
    insert: false,
  })
  updatedAt!: Date;
}

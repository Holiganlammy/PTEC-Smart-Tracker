import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** ตาราง dbo.Jobs_Attatch — ไฟล์แนบของงาน (รูป/เอกสาร) */
@Entity({ name: 'Jobs_Attatch' })
@Index('IX_Jobs_Attatch_job', ['jobId'])
export class JobAttatch {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'job_id', type: 'bigint' })
  jobId!: string;

  /** ops = คัดลอกรายการมาจาก OPS (ตัวไฟล์อยู่ที่ OPS), strack = อัปโหลดจากระบบเรา */
  @Column({ type: 'varchar', length: 10 })
  source!: 'ops' | 'strack';

  @Column({ type: 'varchar', length: 20 })
  kind!: string;

  /** ops: ชื่อไฟล์ใน OPS / strack: ชื่อที่ระบบสุ่มให้ตอนเก็บ (ในโฟลเดอร์ jobs/<jobId>/) */
  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string;

  @Column({
    name: 'original_name',
    type: 'nvarchar',
    length: 255,
    nullable: true,
  })
  originalName!: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 100, nullable: true })
  mimeType!: string | null;

  @Column({ name: 'size_bytes', type: 'bigint', nullable: true })
  sizeBytes!: string | null;

  @Column({ name: 'ops_attatch_id', type: 'bigint', nullable: true })
  opsAttatchId!: string | null;

  @Column({ name: 'uploaded_by', type: 'bigint', nullable: true })
  uploadedBy!: string | null;

  @Column({
    name: 'created_at',
    type: 'datetime2',
    precision: 6,
    insert: false,
    update: false,
  })
  createdAt!: Date;

  @Column({
    name: 'deleted_at',
    type: 'datetime2',
    precision: 6,
    nullable: true,
  })
  deletedAt!: Date | null;
}

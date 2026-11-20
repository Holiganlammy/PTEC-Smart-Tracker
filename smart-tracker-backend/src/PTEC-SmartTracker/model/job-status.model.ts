import { Column, Entity, PrimaryColumn } from 'typeorm';

/** id ของสถานะงาน (ตรงกับข้อมูลตั้งต้นในตาราง dbo.job_status — ห้ามเปลี่ยนเลข) */
export enum JobStatusId {
  PENDING_REVIEW = 1, // รอแอดมินตรวจ
  NEW = 2, // แจ้งงาน (รอผู้รับเหมาตอบรับ)
  ACCEPTED = 3, // รับงานแล้ว
  IN_PROGRESS = 4, // กำลังดำเนินการ
  WAITING_PARTS = 5, // รออะไหล่/อุปกรณ์
  DELIVERED = 6, // ส่งมอบงาน (รอตรวจรับ)
  COMPLETED = 7, // ปิดงาน
  RETURNED = 8, // ตีกลับ
  CANCELLED = 9, // ยกเลิก
}

/** ตาราง dbo.job_status — สถานะงาน (jobs.status_id อ้างมาที่นี่) */
@Entity({ name: 'Job_Status' })
export class JobStatus {
  /** กำหนดเลขเอง ไม่ใช่ identity */
  @PrimaryColumn({ type: 'int' })
  id!: number;

  /** รหัสสำหรับใช้ในโค้ด/API เช่น 'completed' */
  @Column({ type: 'varchar', length: 30, unique: true })
  code!: string;

  @Column({ name: 'name_th', type: 'nvarchar', length: 100 })
  nameTh!: string;

  /** สถานะที่จบงานแล้ว (ปิดงาน/ตีกลับ/ยกเลิก) */
  @Column({ name: 'is_closed', type: 'bit', default: false })
  isClosed!: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ type: 'bit', default: true })
  active!: boolean;
}

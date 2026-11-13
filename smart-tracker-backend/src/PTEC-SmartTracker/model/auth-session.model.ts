import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * ตาราง dbo.auth_sessions — refresh token ของแต่ละการล็อกอิน (เก็บเฉพาะค่าแฮช ไม่เก็บ token จริง)
 * ผูกกับ line_user_id (ไม่ใช่ user_id) เพราะคนที่ยังไม่ลงทะเบียนก็ต้องมี session ได้
 */
@Entity({ name: 'auth_sessions' })
export class AuthSession {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'line_user_id', type: 'varchar', length: 100 })
  lineUserId!: string;

  /** sha256 (hex) ของ refresh token */
  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'datetime2', precision: 0 })
  expiresAt!: Date;

  /** ออกจากระบบแล้ว — ใช้ต่ออายุไม่ได้ */
  @Column({
    name: 'revoked_at',
    type: 'datetime2',
    precision: 0,
    nullable: true,
  })
  revokedAt!: Date | null;

  @Column({
    name: 'created_at',
    type: 'datetime2',
    precision: 0,
    default: () => 'SYSDATETIME()',
  })
  createdAt!: Date;

  /** ใช้งาน (ต่ออายุ) ล่าสุดเมื่อไร */
  @Column({
    name: 'last_used_at',
    type: 'datetime2',
    precision: 0,
    default: () => 'SYSDATETIME()',
  })
  lastUsedAt!: Date;

  @Column({ name: 'user_agent', type: 'nvarchar', length: 300, nullable: true })
  userAgent!: string | null;
}

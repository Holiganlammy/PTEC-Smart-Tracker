import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobMessage } from '../model/job-message.model';
import { RoleId } from '../model/role.model';
import { User } from '../model/user.model';
import type {
  JobMessageItem,
  JobMessageList,
  MessageSenderRole,
} from '../type/job-message.type';
import { JobService } from './job.service';
import { chatPermission, type ChatBlockReason } from './job-permission';

/** ดึงข้อความครั้งแรก/ครั้งเดียวสูงสุดกี่ข้อความ */
const PAGE_SIZE = 200;

const BLOCKED_TEXT: Record<ChatBlockReason, string> = {
  closed: 'งานนี้ปิดแล้ว ส่งข้อความเพิ่มไม่ได้',
  no_owner_yet: 'งานนี้ยังไม่มีผู้รับงาน ส่งข้อความได้หลังมีผู้รับงานแล้ว',
  not_owner:
    'เฉพาะผู้ที่รับงานนี้เท่านั้นที่ส่งข้อความได้ (คุณดูได้อย่างเดียว)',
};

const ROLE_CODE: Record<number, MessageSenderRole> = {
  [RoleId.CONTRACTOR]: 'contractor',
  [RoleId.HEAD]: 'head',
  [RoleId.SUB_CONTRACTOR]: 'sub_contractor',
  [RoleId.ADMIN]: 'admin',
};

interface MessageRow {
  id: string;
  senderId: string;
  senderRoleId: number;
  body: string;
  createdAt: Date;
  firstName: string | null;
  lastName: string | null;
}

/** แชทของงาน: อ่านได้ทุกคนที่เห็นงานนั้น, พิมพ์ได้ตามกติกาใน job-permission.ts */
@Injectable()
export class JobMessageService {
  constructor(
    @InjectRepository(JobMessage)
    private readonly messages: Repository<JobMessage>,
    private readonly jobService: JobService,
  ) {}

  private toItem(row: MessageRow, me: string): JobMessageItem {
    return {
      id: String(row.id),
      senderId: String(row.senderId),
      senderName:
        [row.firstName, row.lastName].filter(Boolean).join(' ') ||
        'ไม่ทราบชื่อ',
      senderRole: ROLE_CODE[Number(row.senderRoleId)] ?? 'contractor',
      body: row.body,
      createdAt: new Date(row.createdAt).toISOString(),
      mine: String(row.senderId) === me,
    };
  }

  /** ข้อความของงาน (after = ดึงเฉพาะที่ใหม่กว่า id นี้ เพื่อให้เรียกซ้ำได้เบา ๆ) + สิทธิ์พิมพ์ของผู้เรียก */
  async list(
    user: User,
    jobId: string,
    after?: number,
  ): Promise<JobMessageList> {
    const job = await this.jobService.findAccessible(user, jobId);
    const perm = chatPermission(user, await this.jobService.getOwnership(job));

    const qb = this.messages
      .createQueryBuilder('m')
      .innerJoin(User, 'u', 'u.id = m.senderId')
      .select([
        'm.id AS id',
        'm.senderId AS senderId',
        'm.senderRoleId AS senderRoleId',
        'm.body AS body',
        'm.createdAt AS createdAt',
        'u.firstName AS firstName',
        'u.lastName AS lastName',
      ])
      .where('m.jobId = :jobId', { jobId: job.id })
      .limit(PAGE_SIZE);

    let rows: MessageRow[];
    if (after !== undefined) {
      rows = await qb
        .andWhere('m.id > :after', { after })
        .orderBy('m.id', 'ASC')
        .getRawMany<MessageRow>();
    } else {
      // 200 ข้อความล่าสุด แล้วกลับลำดับให้เก่า → ใหม่
      rows = (
        await qb.orderBy('m.id', 'DESC').getRawMany<MessageRow>()
      ).reverse();
    }

    return {
      items: rows.map((r) => this.toItem(r, String(user.id))),
      canPost: perm.canPost,
      blockedReason: perm.reason,
    };
  }

  async send(user: User, jobId: string, body: string): Promise<JobMessageItem> {
    const job = await this.jobService.findAccessible(user, jobId);
    const perm = chatPermission(user, await this.jobService.getOwnership(job));
    if (!perm.canPost) {
      throw new ForbiddenException(BLOCKED_TEXT[perm.reason ?? 'not_owner']);
    }

    const res = await this.messages.insert({
      jobId: job.id,
      senderId: user.id,
      senderRoleId: Number(user.roleId),
      body,
    });
    const id = String(res.identifiers[0].id);

    // created_at เป็นค่า default ของ DB จึงอ่านกลับมาเพื่อให้ได้เวลาเดียวกับที่เก็บ
    const row = await this.messages
      .createQueryBuilder('m')
      .innerJoin(User, 'u', 'u.id = m.senderId')
      .select([
        'm.id AS id',
        'm.senderId AS senderId',
        'm.senderRoleId AS senderRoleId',
        'm.body AS body',
        'm.createdAt AS createdAt',
        'u.firstName AS firstName',
        'u.lastName AS lastName',
      ])
      .where('m.id = :id', { id })
      .getRawOne<MessageRow>();
    return this.toItem(row!, String(user.id));
  }
}

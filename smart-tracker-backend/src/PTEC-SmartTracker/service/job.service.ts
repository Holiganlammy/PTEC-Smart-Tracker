import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  DataSource,
  In,
  IsNull,
  Not,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { OPS_CONNECTION } from '../../database/database.module';
import type { UpdateJobDto } from '../dto/job-review.dto';
import type { ReassignJobDto } from '../dto/job-reassign.dto';
import type { ChangeJobStatusDto } from '../dto/job-status.dto';
import type { ListJobsQuery } from '../dto/job-query.dto';
import { Job } from '../model/job.model';
import { JobLog, JobLogAction } from '../model/job-log.model';
import { JobStatus, JobStatusId } from '../model/job-status.model';
import { RoleId } from '../model/role.model';
import { User } from '../model/user.model';
import type { JobLogChanges } from '../type/job-log.type';
import type { UploadedFileLike, UploadKind } from '../type/job-attatch.type';
import type {
  JobCounts,
  JobAction,
  JobFilterOptions,
  JobHistoryItem,
  JobDetail,
  JobItem,
  JobList,
  JobRow,
  JobTeamMember,
  RejectedJobItem,
  JobTimelineEvent,
  JobTypeItem,
  ReviewJobItem,
  SubJobItem,
  SubJobOrigin,
} from '../type/job.type';
import { JobAttatchService, type StagedFile } from './job-attatch.service';
import {
  canAddSubJob,
  canChangeStatus,
  roleCode,
  type JobOwnership,
} from './job-permission';
import { VenderService } from './vender.service';

/**
 * Jobs.due_at (datetime2 เวลาท้องถิ่น ไม่มี timezone) จากฐานข้อมูลอาจมาเป็น Date (อ่านเป็น UTC — ค่าตรงตามที่เก็บ)
 * หรือสตริง → แยกเป็นวันที่ YYYY-MM-DD กับเวลา HH:mm (API ยังส่ง dueDate/dueTime แยกกัน)
 */
export function splitDueAt(v: Date | string | null | undefined): {
  dueDate: string | null;
  dueTime: string | null;
} {
  if (v === null || v === undefined) return { dueDate: null, dueTime: null };
  const iso = (typeof v === 'string' ? v : v.toISOString()).replace(' ', 'T');
  return { dueDate: iso.slice(0, 10), dueTime: iso.slice(11, 16) };
}

/** สถานะที่ผู้รับเหมาไม่เห็น: รอแอดมินตรวจ / ตีกลับ */
/** การเปลี่ยนสถานะที่ผู้รับเหมาทำได้: จากสถานะไหน → ไปสถานะไหน, รูปที่แนบเป็นชนิดอะไร */
const TRANSITIONS: Record<
  JobAction,
  { from: JobStatusId[]; to: JobStatusId; kind: UploadKind; log: JobLogAction }
> = {
  accept: {
    from: [JobStatusId.NEW],
    to: JobStatusId.ACCEPTED,
    kind: 'accepted',
    log: JobLogAction.ACCEPTED,
  },
  start: {
    from: [JobStatusId.ACCEPTED],
    to: JobStatusId.IN_PROGRESS,
    kind: 'progress',
    log: JobLogAction.STARTED,
  },
  wait_parts: {
    from: [JobStatusId.IN_PROGRESS],
    to: JobStatusId.WAITING_PARTS,
    kind: 'progress',
    log: JobLogAction.WAITING_PARTS,
  },
  resume: {
    from: [JobStatusId.WAITING_PARTS],
    to: JobStatusId.IN_PROGRESS,
    kind: 'progress',
    log: JobLogAction.RESUMED,
  },
  deliver: {
    from: [JobStatusId.IN_PROGRESS, JobStatusId.WAITING_PARTS],
    to: JobStatusId.DELIVERED,
    kind: 'completed',
    log: JobLogAction.DELIVERED,
  },
  // ปฏิเสธงาน: ทำได้ก่อนเริ่มงานเท่านั้น (ต้องระบุเหตุผล ไม่แนบรูป) — kind ไม่ถูกใช้
  reject: {
    from: [JobStatusId.NEW, JobStatusId.ACCEPTED],
    to: JobStatusId.REJECTED,
    kind: 'accepted',
    log: JobLogAction.REJECTED,
  },
};

/** สถานะที่แอดมินย้ายงานไปให้บริษัทอื่นได้ (ก่อนส่งมอบ/ปิดงาน รวมงานที่ถูกปฏิเสธ) */
const REASSIGNABLE = [
  JobStatusId.NEW,
  JobStatusId.ACCEPTED,
  JobStatusId.IN_PROGRESS,
  JobStatusId.WAITING_PARTS,
  JobStatusId.REJECTED,
];

const HIDDEN_FROM_CONTRACTOR = [
  JobStatusId.PENDING_REVIEW,
  JobStatusId.RETURNED,
];

/** สถานะที่ยังมอบหมายงานให้ผู้รับเหมาช่วงได้ (ยังไม่ส่งมอบ/ปิดงาน) */
const ASSIGNABLE = [
  JobStatusId.NEW,
  JobStatusId.ACCEPTED,
  JobStatusId.IN_PROGRESS,
  JobStatusId.WAITING_PARTS,
];

/** งานของบริษัทผู้รับเหมา + คิวตรวจของแอดมิน — อ่าน/เขียนตาราง Jobs ของ Smart Tracker */
@Injectable()
export class JobService {
  constructor(
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(JobStatus)
    private readonly statuses: Repository<JobStatus>,
    @InjectDataSource(OPS_CONNECTION) private readonly ops: DataSource,
    private readonly venderService: VenderService,
    private readonly attatchService: JobAttatchService,
  ) {}

  /** ประเภทงานของ OPS ที่ยังใช้งาน (ให้แอดมินเลือกตอนแก้ไขงาน) */
  async listJobTypes(): Promise<JobTypeItem[]> {
    const rows = await this.ops.query<{ jobTypeId: number; name: string }[]>(
      `SELECT JobTypeID AS jobTypeId, LTRIM(RTRIM(Name)) AS name
       FROM dbo.JobType
       WHERE actived = 1 AND Name IS NOT NULL
       ORDER BY JobTypeID`,
    );
    return rows;
  }

  /** query พื้นฐาน: Jobs join Job_Status พร้อมเลือกคอลัมน์ที่ส่งออก */
  private baseQuery(): SelectQueryBuilder<Job> {
    return this.jobs
      .createQueryBuilder('j')
      .innerJoin(JobStatus, 's', 's.id = j.statusId')
      .leftJoin(User, 'a', 'a.id = j.assignedTo')
      .leftJoin(Job, 'p', 'p.id = j.parentJobId')
      .select([
        'j.id AS id',
        'j.jobCode AS jobCode',
        'j.opsJobCode AS opsJobCode',
        'j.venderCode AS venderCode',
        'j.requestedAt AS requestedAt',
        'j.branchCode AS branchCode',
        'j.branchName AS branchName',
        'j.jobType AS jobType',
        'j.statusId AS statusId',
        's.code AS statusCode',
        's.nameTh AS statusName',
        's.isClosed AS closed',
        'j.details AS details',
        'j.brand AS brand',
        'j.model AS model',
        'j.reporterName AS reporterName',
        'j.reporterPhone AS reporterPhone',
        'j.address AS address',
        'j.assignedTo AS assigneeId',
        'a.firstName AS assigneeFirstName',
        'a.lastName AS assigneeLastName',
        'j.parentJobId AS parentJobId',
        'p.venderCode AS parentVenderCode',
      ]);
  }

  /** แปลงแถวดิบจาก query เป็น JobItem */
  private toItem({
    assigneeFirstName,
    assigneeLastName,
    parentVenderCode,
    ...r
  }: JobRow): JobItem {
    void parentVenderCode; // ใช้ใน addSubInfo หาชื่อบริษัทแม่ ไม่ส่งออกรหัสตรง ๆ
    return {
      ...r,
      closed: Boolean(r.closed),
      requestedAt: new Date(r.requestedAt).toISOString(),
      assigneeName: assigneeFirstName
        ? [assigneeFirstName, assigneeLastName].filter(Boolean).join(' ')
        : null,
    };
  }

  private async fetchPage(
    qb: SelectQueryBuilder<Job>,
    page: number,
    pageSize: number,
    order: 'ASC' | 'DESC',
  ): Promise<{ items: JobItem[]; total: number }> {
    const total = await qb.getCount();
    const rows = await qb
      .orderBy('j.requestedAt', order)
      .addOrderBy('j.id', order)
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawMany<JobRow>();

    const items = rows.map((r) => this.toItem(r));
    await this.addSubInfo(items, rows);
    return { total, items };
  }

  /**
   * ใส่ข้อมูลงานย่อยให้การ์ดในรายการงาน:
   *  - งานย่อย → ชื่อบริษัทที่มอบหมายต่อมา (ป้าย "รับช่วงจาก …")
   *  - งานหลัก → จำนวนงานย่อยที่มอบหมายต่อ (ไม่นับที่ยกเลิก) ใน query เดียวต่อหน้า
   */
  private async addSubInfo(items: JobItem[], rows: JobRow[]): Promise<void> {
    const parentIds = items
      .filter((i) => i.parentJobId === null)
      .map((i) => i.id);
    const [names, counts] = await Promise.all([
      this.venderService.getNames(
        rows.map((r) => r.parentVenderCode).filter((c): c is string => !!c),
      ),
      parentIds.length
        ? this.jobs
            .createQueryBuilder('c')
            .select('c.parentJobId', 'parentJobId')
            .addSelect('COUNT(*)', 'n')
            .where('c.parentJobId IN (:...parentIds)', { parentIds })
            .andWhere('c.statusId <> :cancelled', {
              cancelled: JobStatusId.CANCELLED,
            })
            .groupBy('c.parentJobId')
            .getRawMany<{ parentJobId: string; n: number }>()
        : Promise.resolve([]),
    ]);
    const countOf = new Map(
      counts.map((c) => [String(c.parentJobId), Number(c.n)]),
    );
    items.forEach((item, i) => {
      const code = rows[i].parentVenderCode;
      if (item.parentJobId !== null) {
        item.parentVenderName = code ? (names.get(code) ?? null) : null;
      } else {
        item.subJobCount = countOf.get(String(item.id)) ?? 0;
      }
    });
  }

  private applySearch(qb: SelectQueryBuilder<Job>, q?: string) {
    const term = q?.trim();
    if (!term) return;
    qb.andWhere(
      '(j.jobCode LIKE :q OR j.opsJobCode LIKE :q OR j.details LIKE :q)',
      { q: `%${term}%` },
    );
  }

  // ───────── ผู้รับเหมา ─────────

  /** บริษัทที่ผู้ใช้ดูได้ (แอดมินเลือกบริษัทอื่นได้) */
  private resolveVender(user: User, venderCode?: string): string {
    const code =
      user.roleId === Number(RoleId.ADMIN) && venderCode
        ? venderCode
        : user.venderCode;
    if (!code)
      throw new ForbiddenException('บัญชีนี้ยังไม่ผูกกับบริษัทผู้รับเหมา');
    return code;
  }

  /**
   * บริษัทที่ใช้ตรวจสิทธิ์เข้าถึงงานใบหนึ่ง: ผู้รับเหมา = บริษัทของตัวเอง, แอดมิน = บริษัทของงานนั้น (เปิดดูได้ทุกบริษัท)
   */
  private async resolveJobVender(user: User, id: string): Promise<string> {
    if (Number(user.roleId) !== Number(RoleId.ADMIN)) {
      return this.resolveVender(user);
    }
    const job = await this.jobs.findOne({
      where: { id },
      select: { id: true, venderCode: true },
    });
    if (!job) throw new NotFoundException('ไม่พบงาน');
    return job.venderCode;
  }

  /**
   * ขอบเขตงานที่ผู้ใช้เห็นได้: ของบริษัทตัวเอง และไม่รวมสถานะรอตรวจ/ตีกลับ (กรองฝั่ง server)
   * ผู้รับเหมาช่วงเห็นเฉพาะงานที่ได้รับมอบหมายให้ตัวเอง
   * includeHidden = true เฉพาะตอนแอดมินเปิดดูงานใบเดียว (เช่น ตรวจงานในคิวรอตรวจ) — รายการงานยังซ่อนตามเดิม
   */
  private scope<T extends object>(
    qb: SelectQueryBuilder<T>,
    user: User,
    venderCode: string,
    includeHidden = false,
  ) {
    qb.where('j.venderCode = :venderCode', { venderCode });
    if (!includeHidden) {
      qb.andWhere('j.statusId NOT IN (:...hidden)', {
        hidden: HIDDEN_FROM_CONTRACTOR,
      });
    }
    if (user.roleId === Number(RoleId.SUB_CONTRACTOR)) {
      qb.andWhere('j.assignedTo = :me', { me: user.id });
    }
    return qb;
  }

  private applyFilters(qb: SelectQueryBuilder<Job>, query: ListJobsQuery) {
    this.applySearch(qb, query.q);
    if (query.status?.length) {
      qb.andWhere('j.statusId IN (:...statuses)', { statuses: query.status });
    }
    if (query.branch) {
      qb.andWhere('j.branchCode = :branch', { branch: query.branch });
    }
    if (query.days) {
      qb.andWhere('j.requestedAt >= DATEADD(day, :negDays, SYSDATETIME())', {
        negDays: -query.days,
      });
    }
  }

  /** จำนวนงานแต่ละกลุ่ม (ตามตัวกรองที่เลือกอยู่ ยกเว้นกลุ่มเอง) ในคิวรีเดียว */
  private async countByGroup(qb: SelectQueryBuilder<Job>): Promise<JobCounts> {
    const row = await qb
      .clone()
      .select('COUNT(*)', 'total')
      .addSelect('SUM(CASE WHEN s.isClosed = 0 THEN 1 ELSE 0 END)', 'openCount')
      .addSelect(
        'SUM(CASE WHEN s.isClosed = 1 THEN 1 ELSE 0 END)',
        'closedCount',
      )
      .getRawOne<{
        total: number;
        openCount: number | null;
        closedCount: number | null;
      }>();
    return {
      all: Number(row?.total ?? 0),
      open: Number(row?.openCount ?? 0),
      closed: Number(row?.closedCount ?? 0),
    };
  }

  async listForUser(user: User, query: ListJobsQuery): Promise<JobList> {
    const venderCode = this.resolveVender(user, query.venderCode);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const qb = this.scope(this.baseQuery(), user, venderCode);
    this.applyFilters(qb, query);
    const counts = await this.countByGroup(qb);

    if (query.group === 'open') qb.andWhere('s.isClosed = 0');
    if (query.group === 'closed') qb.andWhere('s.isClosed = 1');

    const { items, total } = await this.fetchPage(qb, page, pageSize, 'DESC');
    return { items, total, page, pageSize, counts };
  }

  /** ตัวเลือกของตัวกรอง: สถานะที่ผู้ใช้เห็นได้ + สาขาที่มีงานอยู่ในขอบเขตของผู้ใช้ */
  async getFilterOptions(
    user: User,
    venderCode?: string,
  ): Promise<JobFilterOptions> {
    const vender = this.resolveVender(user, venderCode);

    const statuses = await this.statuses.find({
      where: { active: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });

    const qb = this.scope(
      this.jobs
        .createQueryBuilder('j')
        .select('j.branchCode', 'code')
        .addSelect('MAX(j.branchName)', 'name'),
      user,
      vender,
    )
      .andWhere('j.branchCode IS NOT NULL')
      .groupBy('j.branchCode');
    const branches = await qb.getRawMany<{
      code: string;
      name: string | null;
    }>();

    return {
      statuses: statuses
        .filter((s) => !HIDDEN_FROM_CONTRACTOR.includes(s.id))
        .map((s) => ({
          id: s.id,
          code: s.code,
          name: s.nameTh,
          closed: Boolean(s.isClosed),
        })),
      branches: branches
        .map((b) => ({ code: b.code, name: b.name ?? b.code }))
        .sort((a, b) => a.name.localeCompare(b.name, 'th')),
    };
  }

  /** รายละเอียดงานหนึ่งใบ (ต้องอยู่ในขอบเขตที่ผู้ใช้เห็นได้) — อ่านจากตาราง Jobs ของเราทั้งหมด */
  async getDetail(user: User, id: string): Promise<JobDetail> {
    const venderCode = await this.resolveJobVender(user, id);
    const qb = this.scope(
      this.baseQuery(),
      user,
      venderCode,
      Number(user.roleId) === Number(RoleId.ADMIN),
    ).andWhere('j.id = :id', { id });
    const row = (await qb.limit(1).getRawMany<JobRow>())[0];
    if (!row) throw new NotFoundException('ไม่พบงาน');

    // คอลัมน์ที่ไม่อยู่ใน JobItem (ความสำคัญ/SLA/คีย์โดย)
    const full = await this.jobs.findOne({ where: { id } });
    const ownership = await this.getOwnership({
      id,
      statusId: Number(row.statusId),
      assignedTo: row.assigneeId,
    });
    const isSubJob = full?.parentJobId != null;
    const canAdd = canAddSubJob(user, ownership, isSubJob);
    const [timeline, history, attachments, team, subJobs, subJobOrigin] =
      await Promise.all([
        this.getTimeline(id, Number(user.roleId) === Number(RoleId.ADMIN)),
        this.getHistory(user, venderCode, {
          id,
          branchCode: row.branchCode,
          jobType: row.jobType,
          opsJobDetailId: full?.opsJobDetailId ?? null,
        }),
        this.attatchService.list(user, {
          id,
          statusId: row.statusId,
          venderCode,
        }),
        this.getTeam(venderCode, ownership),
        isSubJob ? Promise.resolve([]) : this.getSubJobs(id, canAdd),
        full && isSubJob ? this.getSubJobOrigin(full) : Promise.resolve(null),
      ]);

    return {
      ...this.toItem(row),
      team,
      priority:
        full?.priorityName || full?.slaHours != null
          ? { name: full.priorityName, slaHours: full.slaHours }
          : null,
      opsRequestedAt: full?.opsRequestedAt
        ? new Date(full.opsRequestedAt).toISOString()
        : null,
      keyedByName: full?.keyedByName ?? null,
      history,
      timeline,
      attachments,
      uploadableKinds: this.attatchService.uploadableKinds(user, row.statusId),
      actions: this.allowedActions(user, ownership),
      repairedAt: full?.repairedAt
        ? new Date(full.repairedAt).toISOString()
        : null,
      repairDetails: full?.repairDetails ?? null,
      subJobs,
      canAddSubJob: canAdd,
      subJobOrigin,
    };
  }

  /**
   * งานย่อยของงานแม่ (ไม่รวมที่ยกเลิก) เรียงตามที่มอบหมาย — พร้อมชื่อบริษัทและคนที่กดรับ
   * canManage = ผู้ดูเป็นผู้จ่ายงาน → ยกเลิกงานย่อยที่ยังไม่มีใครรับได้
   */
  private async getSubJobs(
    parentId: string,
    canManage: boolean,
  ): Promise<SubJobItem[]> {
    const rows = await this.jobs
      .createQueryBuilder('j')
      .innerJoin(JobStatus, 's', 's.id = j.statusId')
      .select([
        'j.id AS id',
        'j.jobCode AS jobCode',
        'j.venderCode AS venderCode',
        'j.statusId AS statusId',
        's.code AS statusCode',
        's.nameTh AS statusName',
        'j.details AS scope',
        'j.dueAt AS dueAt',
      ])
      .where('j.parentJobId = :parentId', { parentId })
      .andWhere('j.statusId <> :cancelled', {
        cancelled: JobStatusId.CANCELLED,
      })
      .orderBy('j.id', 'ASC')
      .getRawMany<{
        id: string;
        jobCode: string;
        venderCode: string;
        statusId: number;
        statusCode: string;
        statusName: string;
        scope: string | null;
        dueAt: Date | string | null;
      }>();
    if (rows.length === 0) return [];

    const [names, accepts] = await Promise.all([
      this.venderService.getNames(rows.map((r) => r.venderCode)),
      this.jobs.manager.find(JobLog, {
        where: {
          jobId: In(rows.map((r) => r.id)),
          action: JobLogAction.ACCEPTED,
        },
        order: { id: 'DESC' },
        select: { id: true, jobId: true, actorId: true },
      }),
    ]);
    // คนที่กดรับล่าสุดของแต่ละงานย่อย
    const acceptorOf = new Map<string, string>();
    for (const l of accepts) {
      if (l.actorId && !acceptorOf.has(String(l.jobId))) {
        acceptorOf.set(String(l.jobId), l.actorId);
      }
    }
    const users = acceptorOf.size
      ? await this.jobs.manager.find(User, {
          where: { id: In([...new Set(acceptorOf.values())]) },
        })
      : [];
    const userById = new Map(users.map((u) => [String(u.id), u]));

    return rows.map((r) => {
      const acceptor = userById.get(String(acceptorOf.get(String(r.id))));
      return {
        id: String(r.id),
        jobCode: r.jobCode,
        venderCode: r.venderCode,
        venderName: names.get(r.venderCode) ?? null,
        statusId: Number(r.statusId),
        statusCode: r.statusCode,
        statusName: r.statusName,
        scope: r.scope,
        ...splitDueAt(r.dueAt),
        acceptedByName: acceptor
          ? [acceptor.firstName, acceptor.lastName].filter(Boolean).join(' ')
          : null,
        acceptedByPhone: acceptor?.phoneNumber ?? null,
        canCancel: canManage && Number(r.statusId) === Number(JobStatusId.NEW),
      };
    });
  }

  /** ฝั่งงานย่อย: งานแม่ + ผู้มอบหมาย + หมายเหตุตอนมอบหมาย (จากประวัติ 'created' ของงานย่อย) */
  private async getSubJobOrigin(job: Job): Promise<SubJobOrigin | null> {
    if (job.parentJobId === null) return null;
    const [parent, created] = await Promise.all([
      this.jobs.findOne({
        where: { id: job.parentJobId },
        select: { id: true, jobCode: true, opsJobCode: true, venderCode: true },
      }),
      this.jobs.manager.findOne(JobLog, {
        where: { jobId: job.id, action: JobLogAction.CREATED },
        order: { id: 'ASC' },
      }),
    ]);
    if (!parent) return null;
    const [names, assigner] = await Promise.all([
      this.venderService.getNames([parent.venderCode]),
      created?.actorId
        ? this.jobs.manager.findOne(User, { where: { id: created.actorId } })
        : Promise.resolve(null),
    ]);
    return {
      parentJobId: String(parent.id),
      parentJobCode: parent.jobCode,
      parentOpsJobCode: parent.opsJobCode,
      parentVenderName: names.get(parent.venderCode) ?? null,
      assignedByName: assigner
        ? [assigner.firstName, assigner.lastName].filter(Boolean).join(' ')
        : null,
      ...splitDueAt(job.dueAt),
      note: created?.note ?? null,
    };
  }

  /**
   * การเปลี่ยนสถานะที่ผู้ใช้ทำได้ ณ สถานะปัจจุบัน
   * เฉพาะเจ้าของงาน (คนที่รับงาน/ผู้รับเหมาช่วงที่ถูกมอบหมาย) — ยกเว้นสถานะแจ้งงานที่ยังไม่มีใครรับ
   */
  private allowedActions(user: User, o: JobOwnership): JobAction[] {
    if (!canChangeStatus(user, o)) return [];
    return (Object.keys(TRANSITIONS) as JobAction[]).filter((a) =>
      TRANSITIONS[a].from.includes(o.statusId),
    );
  }

  /**
   * ทีมรับผิดชอบ: คนที่กดรับงาน แล้วตามด้วยผู้รับเหมาช่วงที่ถูกมอบหมาย (คนเดียวกันไม่ซ้ำแถว)
   * ผู้รับเหมาช่วงต่างบริษัทจะต่อท้ายรายการนี้เมื่อมีตารางงานย่อย
   */
  private async getTeam(
    venderCode: string,
    o: JobOwnership,
  ): Promise<JobTeamMember[]> {
    const ids = [
      ...new Set(
        [o.acceptedBy, o.assignedTo]
          .filter((x): x is string => x !== null)
          .map(String),
      ),
    ];
    if (ids.length === 0) return [];

    const [users, names] = await Promise.all([
      this.jobs.manager.find(User, { where: { id: In(ids) } }),
      this.venderService.getNames([venderCode]),
    ]);
    const byId = new Map(users.map((u) => [String(u.id), u]));
    const companyName = names.get(venderCode) ?? null;

    const team: JobTeamMember[] = [];
    const add = (id: string | null, kind: JobTeamMember['kind']) => {
      if (id === null || team.some((m) => m.userId === String(id))) return;
      const u = byId.get(String(id));
      if (!u) return;
      team.push({
        userId: String(u.id),
        name:
          [u.firstName, u.lastName].filter(Boolean).join(' ') || 'ไม่ทราบชื่อ',
        companyName,
        role: roleCode(u.roleId),
        kind,
      });
    };
    add(o.acceptedBy, 'accepted');
    add(o.assignedTo, 'assigned');
    return team;
  }

  /** ใครเป็นเจ้าของงาน: คนที่กดรับงานล่าสุด (จากประวัติ) + ผู้รับเหมาช่วงที่ถูกมอบหมาย */
  async getOwnership(job: {
    id: string;
    statusId: number;
    assignedTo: string | null;
  }): Promise<JobOwnership> {
    const [accepted, moved] = await Promise.all([
      this.jobs.manager.findOne(JobLog, {
        where: { jobId: job.id, action: JobLogAction.ACCEPTED },
        order: { id: 'DESC' },
        select: { id: true, actorId: true },
      }),
      this.jobs.manager.findOne(JobLog, {
        where: { jobId: job.id, action: JobLogAction.REASSIGNED },
        order: { id: 'DESC' },
        select: { id: true },
      }),
    ]);
    // คนที่รับงานก่อนแอดมินย้ายบริษัท ไม่นับเป็นเจ้าของงานของบริษัทใหม่
    const acceptedNow =
      accepted && (!moved || BigInt(accepted.id) > BigInt(moved.id))
        ? accepted.actorId
        : null;
    return {
      statusId: Number(job.statusId),
      assignedTo: job.assignedTo ?? null,
      acceptedBy: acceptedNow,
    };
  }

  /**
   * ผู้รับเหมาเปลี่ยนสถานะงาน (รับงาน / เริ่มดำเนินการ / รออะไหล่ / ส่งงาน) พร้อมแนบรูปในคำขอเดียว
   * - เปลี่ยนแบบมีเงื่อนไข (WHERE status_id IN from) กันกดซ้ำ/สองคนกดพร้อมกัน
   * - สถานะ + รูป + ประวัติ อยู่ในทรานแซกชันเดียว ถ้าล้มเหลวจะลบไฟล์ที่เขียนไปแล้ว
   */
  async changeStatus(
    user: User,
    id: string,
    dto: ChangeJobStatusDto,
    upload: { files?: UploadedFileLike[]; beforeFiles?: UploadedFileLike[] },
  ): Promise<JobDetail> {
    const rule = TRANSITIONS[dto.action];
    const job = await this.findAccessible(user, id);
    const ownership = await this.getOwnership(job);
    if (!canChangeStatus(user, ownership)) {
      throw new ForbiddenException(
        'เฉพาะผู้ที่รับงานนี้เท่านั้นที่เปลี่ยนสถานะงานได้ (คุณดูได้อย่างเดียว)',
      );
    }
    if (!this.allowedActions(user, ownership).includes(dto.action)) {
      throw new ConflictException(
        'ทำรายการนี้ไม่ได้ในสถานะปัจจุบันของงาน (อาจมีคนเปลี่ยนสถานะไปแล้ว กรุณารีเฟรช)',
      );
    }

    if (dto.action === 'reject' && !dto.note) {
      throw new BadRequestException('กรุณาระบุเหตุผลที่ปฏิเสธงาน');
    }

    // ปฏิเสธงานไม่แนบรูป (ไฟล์ที่ส่งมาจะถูกละไว้)
    const files = dto.action === 'reject' ? [] : (upload.files ?? []);
    const beforeFiles =
      dto.action === 'deliver' ? (upload.beforeFiles ?? []) : [];
    let repairedAt: Date | null = null;

    if (dto.action === 'deliver') {
      if (!dto.repairedAt) {
        throw new BadRequestException('กรุณาระบุวันและเวลาที่ซ่อมเสร็จ');
      }
      if (!dto.details) {
        throw new BadRequestException('กรุณากรอกรายละเอียดการซ่อม');
      }
      // เวลาในฐานข้อมูลเป็นเวลาท้องถิ่นเก็บแบบไม่มี timezone (driver อ่าน/เขียนเป็น UTC)
      // จึงตีความค่าที่ผู้ใช้ส่งมา (เวลาบนนาฬิกา) เป็น "UTC" เพื่อให้ตรงกับที่เก็บ และเทียบกับเวลาของ DB เอง
      repairedAt = new Date(
        `${dto.repairedAt.length === 16 ? `${dto.repairedAt}:00` : dto.repairedAt}Z`,
      );
      if (Number.isNaN(repairedAt.getTime())) {
        throw new BadRequestException('วันเวลาที่ซ่อมเสร็จไม่ถูกต้อง');
      }
      const [{ now }] = await this.jobs.query<{ now: Date }[]>(
        'SELECT SYSDATETIME() AS now',
      );
      if (repairedAt.getTime() > new Date(now).getTime() + 5 * 60_000) {
        throw new BadRequestException(
          'วันเวลาที่ซ่อมเสร็จต้องไม่เกินเวลาปัจจุบัน',
        );
      }
      const full = await this.jobs.findOne({
        where: { id },
        select: { id: true, requestedAt: true, opsRequestedAt: true },
      });
      const reportedAt = full?.opsRequestedAt ?? full?.requestedAt;
      if (reportedAt && repairedAt.getTime() < new Date(reportedAt).getTime()) {
        throw new BadRequestException(
          'วันเวลาที่ซ่อมเสร็จต้องไม่ก่อนวันที่แจ้งงาน',
        );
      }
      const existing = await this.attatchService.countLive(id, 'completed');
      if (existing + files.length === 0) {
        throw new BadRequestException(
          'กรุณาแนบรูปหลังซ่อมเสร็จอย่างน้อย 1 รูป',
        );
      }
    }

    await this.attatchService.assertCapacity(id, rule.kind, files.length);
    await this.attatchService.assertCapacity(
      id,
      'progress',
      beforeFiles.length,
    );

    const staged: StagedFile[] = [];
    try {
      const main = await this.attatchService.stage(id, files);
      staged.push(...main);
      const before = await this.attatchService.stage(id, beforeFiles);
      staged.push(...before);

      await this.jobs.manager.transaction(async (em) => {
        const res = await em.update(
          Job,
          { id, statusId: In(rule.from) },
          {
            statusId: rule.to,
            updatedAt: () => 'SYSDATETIME()',
            ...(dto.action === 'deliver'
              ? { repairedAt, repairDetails: dto.details ?? null }
              : {}),
          },
        );
        if (!res.affected) {
          throw new ConflictException(
            'สถานะงานเปลี่ยนไปแล้ว กรุณารีเฟรชหน้าแล้วลองใหม่',
          );
        }
        await this.attatchService.insertStaged(em, user, id, rule.kind, main);
        await this.attatchService.insertStaged(
          em,
          user,
          id,
          'progress',
          before,
        );
        await em.insert(JobLog, {
          jobId: id,
          action: rule.log,
          fromStatusId: job.statusId,
          toStatusId: rule.to,
          actorId: user.id,
          note: dto.note ?? null,
          changes:
            dto.action === 'deliver'
              ? JSON.stringify({
                  repairedAt: { from: null, to: dto.repairedAt ?? null },
                  repairDetails: { from: null, to: dto.details ?? null },
                } satisfies JobLogChanges)
              : null,
        });
      });
    } catch (err) {
      await this.attatchService.discard(staged);
      throw err;
    }

    return this.getDetail(user, id);
  }

  /** งานที่ผู้ใช้เข้าถึงได้ (ตามขอบเขตบริษัท/ผู้รับเหมาช่วง) — ใช้ตรวจสิทธิ์ก่อนทำงานกับไฟล์แนบ */
  async findAccessible(
    user: User,
    id: string,
  ): Promise<{
    id: string;
    statusId: number;
    assignedTo: string | null;
    /** บริษัทของงาน ณ ตอนนี้ (scope กรองด้วยรหัสนี้อยู่แล้ว) */
    venderCode: string;
  }> {
    const venderCode = await this.resolveJobVender(user, id);
    const row = await this.scope(
      this.jobs
        .createQueryBuilder('j')
        .select([
          'j.id AS id',
          'j.statusId AS statusId',
          'j.assignedTo AS assignedTo',
        ]),
      user,
      venderCode,
      Number(user.roleId) === Number(RoleId.ADMIN),
    )
      .andWhere('j.id = :id', { id })
      .limit(1)
      .getRawOne<{ id: string; statusId: number; assignedTo: string | null }>();
    if (!row) throw new NotFoundException('ไม่พบงาน');
    return {
      id: row.id,
      statusId: Number(row.statusId),
      assignedTo: row.assignedTo ?? null,
      venderCode,
    };
  }

  /**
   * ประวัติที่เกี่ยวข้องกับงานนี้ (เฉพาะที่ผู้ใช้เห็นได้ ไม่รวมงานนี้) แบ่ง 3 กลุ่ม:
   *  - same_job    ใบเดียวกันที่ OPS ส่งมาซ้ำ (ops_job_detail_id เดียวกัน)
   *  - same_type   ประเภทงานเดียวกันในสาขาเดียวกัน (ใกล้เคียง "ของชิ้นเดียวกัน" ที่สุด
   *                เพราะ OPS ส่วนใหญ่ไม่ได้ระบุรหัสทรัพย์สิน/ยี่ห้อ/รุ่น)
   *  - same_branch งานอื่นของสาขาเดียวกัน
   */
  private async getHistory(
    user: User,
    venderCode: string,
    job: {
      id: string;
      branchCode: string | null;
      jobType: string | null;
      opsJobDetailId: string | null;
    },
  ): Promise<JobHistoryItem[]> {
    if (!job.branchCode && !job.opsJobDetailId) return [];
    const qb = this.scope(
      this.jobs
        .createQueryBuilder('j')
        .innerJoin(JobStatus, 's', 's.id = j.statusId')
        .select([
          'j.id AS id',
          'j.jobCode AS jobCode',
          'j.opsJobCode AS opsJobCode',
          'j.jobType AS jobType',
          'j.requestedAt AS requestedAt',
          'j.branchCode AS branchCode',
          'j.opsJobDetailId AS opsJobDetailId',
          's.code AS statusCode',
          's.nameTh AS statusName',
        ]),
      user,
      venderCode,
    ).andWhere('j.id <> :excludeId', { excludeId: job.id });

    qb.andWhere(
      new Brackets((w) => {
        if (job.opsJobDetailId) {
          w.orWhere('j.opsJobDetailId = :detailId', {
            detailId: job.opsJobDetailId,
          });
        }
        if (job.branchCode) {
          w.orWhere('j.branchCode = :branchCode', {
            branchCode: job.branchCode,
          });
        }
      }),
    );

    const rows = await qb
      .orderBy('j.requestedAt', 'DESC')
      .limit(40)
      .getRawMany<{
        id: string;
        jobCode: string;
        opsJobCode: string | null;
        jobType: string | null;
        requestedAt: Date;
        branchCode: string | null;
        opsJobDetailId: string | null;
        statusCode: string;
        statusName: string;
      }>();

    const LIMIT: Record<JobHistoryItem['relation'], number> = {
      same_job: 10,
      same_type: 5,
      same_branch: 5,
    };
    const ORDER = ['same_job', 'same_type', 'same_branch'] as const;
    const grouped: Record<JobHistoryItem['relation'], JobHistoryItem[]> = {
      same_job: [],
      same_type: [],
      same_branch: [],
    };
    for (const r of rows) {
      const relation: JobHistoryItem['relation'] =
        job.opsJobDetailId && r.opsJobDetailId === job.opsJobDetailId
          ? 'same_job'
          : job.jobType && r.jobType === job.jobType
            ? 'same_type'
            : 'same_branch';
      if (grouped[relation].length >= LIMIT[relation]) continue;
      grouped[relation].push({
        id: r.id,
        jobCode: r.jobCode,
        opsJobCode: r.opsJobCode,
        jobType: r.jobType,
        requestedAt: new Date(r.requestedAt).toISOString(),
        statusCode: r.statusCode,
        statusName: r.statusName,
        relation,
      });
    }
    return ORDER.flatMap((k) => grouped[k]);
  }

  /** เหตุการณ์เปลี่ยนสถานะของงาน (ไม่รวมขั้นตรวจของแอดมิน: รอตรวจ/ตีกลับ) เรียงเก่า → ใหม่ */
  private async getTimeline(
    jobId: string,
    isAdmin: boolean,
  ): Promise<JobTimelineEvent[]> {
    let logs = await this.jobs.manager.find(JobLog, {
      where: { jobId, toStatusId: Not(IsNull()) },
      order: { id: 'ASC' },
    });
    // งานที่แอดมินย้ายมาให้บริษัทนี้: บริษัทเห็นประวัติเริ่มจากตอนที่ย้ายมา (ไม่เห็นของบริษัทเดิม) — แอดมินเห็นทั้งหมด
    if (!isAdmin) {
      const moved = logs
        .map((l) => l.action)
        .lastIndexOf(JobLogAction.REASSIGNED);
      if (moved > 0) logs = logs.slice(moved);
    }
    // ตัดขั้นตรวจของแอดมิน (รอตรวจ/ตีกลับ) ออกในโค้ด เพราะผู้รับเหมาไม่ควรเห็น
    const events = logs.filter(
      (l) =>
        l.toStatusId !== null && !HIDDEN_FROM_CONTRACTOR.includes(l.toStatusId),
    );
    const actorIds = [
      ...new Set(events.map((e) => e.actorId).filter((a): a is string => !!a)),
    ];
    const actors = actorIds.length
      ? await this.jobs.manager.find(User, { where: { id: In(actorIds) } })
      : [];
    const names = new Map(
      actors.map((u) => [
        u.id,
        [u.firstName, u.lastName].filter(Boolean).join(' '),
      ]),
    );
    return events.map((e) => ({
      id: e.id,
      statusId: e.toStatusId!,
      at: new Date(e.createdAt).toISOString(),
      actorName: e.actorId ? (names.get(e.actorId) ?? null) : null,
      // หมายเหตุตอนแอดมินย้ายบริษัทเป็นข้อมูลภายใน ไม่ให้บริษัทใหม่เห็น
      note: !isAdmin && e.action === JobLogAction.REASSIGNED ? null : e.note,
    }));
  }

  /**
   * มอบหมายงานให้ผู้รับเหมาช่วงในบริษัทเดียวกัน (assigneeId = null → ยกเลิกการมอบหมาย)
   * บันทึกประวัติ (Jobs_Logs) ในทรานแซกชันเดียวกัน
   */
  async assign(user: User, id: string, assigneeId: string | null) {
    const venderCode = this.resolveVender(user);

    return this.jobs.manager.transaction(async (em) => {
      const job = await em.findOne(Job, { where: { id, venderCode } });
      if (!job) throw new NotFoundException('ไม่พบงาน');

      if (assigneeId !== null) {
        const sub = await em.findOne(User, { where: { id: assigneeId } });
        if (
          !sub ||
          sub.roleId !== Number(RoleId.SUB_CONTRACTOR) ||
          sub.status !== 'approved' ||
          !sub.active ||
          sub.venderCode !== venderCode
        )
          throw new BadRequestException('ผู้รับเหมาช่วงไม่ถูกต้อง');
      }
      if (job.assignedTo === assigneeId) return { id, assigneeId };

      const res = await em.update(
        Job,
        { id, statusId: In(ASSIGNABLE) },
        {
          assignedTo: assigneeId,
          assignedAt: assigneeId ? () => 'SYSDATETIME()' : null,
          updatedAt: () => 'SYSDATETIME()',
        },
      );
      if (!res.affected)
        throw new ConflictException('งานนี้อยู่ในสถานะที่มอบหมายไม่ได้');

      await em.insert(JobLog, {
        jobId: id,
        action: assigneeId ? JobLogAction.ASSIGNED : JobLogAction.UNASSIGNED,
        actorId: user.id,
        changes: JSON.stringify({
          assignedTo: { from: job.assignedTo, to: assigneeId },
        } satisfies JobLogChanges),
      });
      return { id, assigneeId };
    });
  }

  // ───────── แอดมิน: คิวตรวจงานจาก OPS ─────────

  /** งานที่รอแอดมินตรวจ เรียงเก่าสุดก่อน (ตรวจตามลำดับที่เข้ามา) */
  async listPendingReview(
    query: ListJobsQuery,
  ): Promise<JobList<ReviewJobItem>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const qb = this.baseQuery().where('j.statusId = :pending', {
      pending: JobStatusId.PENDING_REVIEW,
    });
    if (query.venderCode) {
      qb.andWhere('j.venderCode = :venderCode', {
        venderCode: query.venderCode,
      });
    }
    this.applySearch(qb, query.q);

    const { items, total } = await this.fetchPage(qb, page, pageSize, 'ASC');
    const names = await this.venderService.getNames(
      items.map((i) => i.venderCode),
    );
    return {
      items: items.map((i) => ({
        ...i,
        venderName: names.get(i.venderCode) ?? null,
      })),
      total,
      page,
      pageSize,
    };
  }

  async countPendingReview(): Promise<{ pending: number }> {
    const pending = await this.jobs.count({
      where: { statusId: JobStatusId.PENDING_REVIEW },
    });
    return { pending };
  }

  /** งานที่บริษัทปฏิเสธ รอแอดมินจ่ายให้บริษัทอื่น (เก่า → ใหม่) พร้อมเหตุผลและผู้ปฏิเสธ */
  async listRejected(query: ListJobsQuery): Promise<JobList<RejectedJobItem>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const qb = this.baseQuery().where('j.statusId = :rejected', {
      rejected: JobStatusId.REJECTED,
    });
    if (query.venderCode) {
      qb.andWhere('j.venderCode = :venderCode', {
        venderCode: query.venderCode,
      });
    }
    this.applySearch(qb, query.q);

    const { items, total } = await this.fetchPage(qb, page, pageSize, 'ASC');
    if (items.length === 0) return { items: [], total, page, pageSize };

    const logs = await this.jobs.manager.find(JobLog, {
      where: {
        jobId: In(items.map((i) => i.id)),
        action: JobLogAction.REJECTED,
      },
      order: { id: 'ASC' },
    });
    const lastByJob = new Map(logs.map((l) => [String(l.jobId), l])); // รายการหลังทับรายการก่อน = ครั้งล่าสุด
    const actorIds = [
      ...new Set(
        [...lastByJob.values()]
          .map((l) => l.actorId)
          .filter((a): a is string => !!a),
      ),
    ];
    const [actors, names] = await Promise.all([
      actorIds.length
        ? this.jobs.manager.find(User, { where: { id: In(actorIds) } })
        : Promise.resolve([] as User[]),
      this.venderService.getNames(items.map((i) => i.venderCode)),
    ]);
    const actorNames = new Map(
      actors.map((u) => [
        String(u.id),
        [u.firstName, u.lastName].filter(Boolean).join(' '),
      ]),
    );

    return {
      items: items.map((i) => {
        const log = lastByJob.get(String(i.id));
        return {
          ...i,
          venderName: names.get(i.venderCode) ?? null,
          rejectedAt: log ? new Date(log.createdAt).toISOString() : null,
          rejectedByName: log?.actorId
            ? (actorNames.get(String(log.actorId)) ?? null)
            : null,
          reason: log?.note ?? null,
          afterAccept:
            Number(log?.fromStatusId) === Number(JobStatusId.ACCEPTED),
        };
      }),
      total,
      page,
      pageSize,
    };
  }

  /**
   * แอดมินย้ายงานไปให้บริษัทอื่น: งานใบเดิมเปลี่ยนบริษัท กลับเป็นสถานะ "แจ้งงาน" และล้างผู้ถูกมอบหมาย
   * (งานหายจากรายการของบริษัทเดิม; ประวัติ/รูป/แชทของบริษัทเดิมบริษัทใหม่ไม่เห็น แอดมินเห็นทั้งหมด)
   * เปลี่ยนแบบมีเงื่อนไข (สถานะ + บริษัทเดิม) กันแอดมินสองคนกดพร้อมกัน บันทึกประวัติในทรานแซกชันเดียวกัน
   */
  async reassign(adminId: string, id: string, dto: ReassignJobDto) {
    if (!(await this.venderService.exists(dto.venderCode))) {
      throw new BadRequestException('ไม่พบบริษัทนี้');
    }
    return this.jobs.manager.transaction(async (em) => {
      const job = await em.findOne(Job, { where: { id } });
      if (!job) throw new NotFoundException('ไม่พบงาน');
      if (!REASSIGNABLE.includes(Number(job.statusId))) {
        throw new ConflictException(
          'งานนี้ย้ายบริษัทไม่ได้ในสถานะปัจจุบัน (ส่งมอบ/ปิดงาน/ยกเลิกแล้ว หรือยังรอตรวจ)',
        );
      }
      if (job.venderCode === dto.venderCode) {
        throw new BadRequestException('งานนี้เป็นของบริษัทนี้อยู่แล้ว');
      }

      const res = await em.update(
        Job,
        { id, statusId: job.statusId, venderCode: job.venderCode },
        {
          venderCode: dto.venderCode,
          statusId: JobStatusId.NEW,
          assignedTo: null,
          assignedAt: null,
          updatedAt: () => 'SYSDATETIME()',
        },
      );
      if (!res.affected) {
        throw new ConflictException(
          'งานเปลี่ยนไปแล้ว กรุณารีเฟรชหน้าแล้วลองใหม่',
        );
      }
      await em.insert(JobLog, {
        jobId: id,
        action: JobLogAction.REASSIGNED,
        fromStatusId: job.statusId,
        toStatusId: JobStatusId.NEW,
        actorId: adminId,
        note: dto.note ?? null,
        changes: JSON.stringify({
          venderCode: { from: job.venderCode, to: dto.venderCode },
          assignedTo: { from: job.assignedTo, to: null },
        } satisfies JobLogChanges),
      });
      return { id, venderCode: dto.venderCode };
    });
  }

  /**
   * แก้ข้อมูลงานที่ยัง "รอแอดมินตรวจ" เท่านั้น (ผู้รับเหมายังไม่เห็น จึงแก้ได้อิสระ)
   * บันทึกประวัติ (Jobs_Logs) ในทรานแซกชันเดียวกัน — ไม่มีช่องไหนเปลี่ยนก็ไม่บันทึก
   */
  async updateDetails(id: string, adminId: string, dto: UpdateJobDto) {
    return this.jobs.manager.transaction(async (em) => {
      const current = await em.findOne(Job, { where: { id } });
      if (!current) throw new NotFoundException('ไม่พบงาน');
      if (current.statusId !== Number(JobStatusId.PENDING_REVIEW))
        throw new ConflictException('งานนี้ถูกตรวจไปแล้ว จึงแก้ไขข้อมูลไม่ได้');

      const next = {
        jobType: dto.jobType ?? null,
        branchName: dto.branchName ?? null,
        details: dto.details ?? null,
        brand: dto.brand ?? null,
        model: dto.model ?? null,
        reporterName: dto.reporterName ?? null,
        reporterPhone: dto.reporterPhone ?? null,
        address: dto.address ?? null,
      };
      const changes: JobLogChanges = {};
      for (const field of Object.keys(next) as (keyof typeof next)[]) {
        if (current[field] !== next[field]) {
          changes[field] = { from: current[field], to: next[field] };
        }
      }
      if (Object.keys(changes).length === 0) return { id };

      const res = await em.update(
        Job,
        { id, statusId: JobStatusId.PENDING_REVIEW },
        { ...next, updatedAt: () => 'SYSDATETIME()' },
      );
      if (!res.affected)
        throw new ConflictException('งานนี้ถูกตรวจไปแล้ว จึงแก้ไขข้อมูลไม่ได้');

      await em.insert(JobLog, {
        jobId: id,
        action: JobLogAction.UPDATED,
        actorId: adminId,
        changes: JSON.stringify(changes),
      });
      return { id };
    });
  }

  /** อนุมัติ → สถานะ "แจ้งงาน" (ผู้รับเหมาเริ่มเห็น) */
  approve(id: string, adminId: string) {
    return this.review(id, adminId, JobStatusId.NEW, null);
  }

  /** ตีกลับ → สถานะ "ตีกลับ" พร้อมเหตุผล */
  returnJob(id: string, adminId: string, note: string) {
    return this.review(id, adminId, JobStatusId.RETURNED, note);
  }

  /**
   * เปลี่ยนสถานะงานที่ "รอแอดมินตรวจ" เท่านั้น (compare-and-swap ในคำสั่งเดียว)
   * กันแอดมินสองคนกดพร้อมกัน/กดซ้ำ — คนที่มาทีหลังได้ 409
   * บันทึกประวัติ (Jobs_Logs) ในทรานแซกชันเดียวกัน
   */
  private async review(
    id: string,
    adminId: string,
    to: JobStatusId,
    note: string | null,
  ) {
    return this.jobs.manager.transaction(async (em) => {
      const res = await em.update(
        Job,
        { id, statusId: JobStatusId.PENDING_REVIEW },
        {
          statusId: to,
          reviewedBy: adminId,
          reviewedAt: () => 'SYSDATETIME()',
          reviewNote: note,
          updatedAt: () => 'SYSDATETIME()',
        },
      );
      if (!res.affected) {
        const exists = await em.exists(Job, { where: { id } });
        if (!exists) throw new NotFoundException('ไม่พบงาน');
        throw new ConflictException(
          'งานนี้ถูกตรวจไปแล้ว หรือไม่ได้อยู่ในสถานะรอตรวจ',
        );
      }

      await em.insert(JobLog, {
        jobId: id,
        action:
          to === JobStatusId.RETURNED
            ? JobLogAction.RETURNED
            : JobLogAction.APPROVED,
        fromStatusId: JobStatusId.PENDING_REVIEW,
        toStatusId: to,
        actorId: adminId,
        note,
      });
      return { id, statusId: to };
    });
  }
}

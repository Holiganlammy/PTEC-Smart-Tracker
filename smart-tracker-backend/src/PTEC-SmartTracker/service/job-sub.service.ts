import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { CreateSubJobDto, InspectSubJobDto } from '../dto/job-sub.dto';
import { Job } from '../model/job.model';
import { JobLog, JobLogAction } from '../model/job-log.model';
import { JobStatusId } from '../model/job-status.model';
import { User } from '../model/user.model';
import type { JobLogChanges } from '../type/job-log.type';
import type { UploadedFileLike } from '../type/job-attatch.type';
import type { JobDetail } from '../type/job.type';
import { JobAttatchService, type StagedFile } from './job-attatch.service';
import { JobService } from './job.service';
import {
  canAddSubJob,
  isSubJobInspector,
  SUB_JOB_CANCELLABLE,
} from './job-permission';
import { VenderService } from './vender.service';

/**
 * งานย่อย: ผู้รับเหมาหลักมอบหมายงานต่อให้บริษัทผู้รับเหมารายย่อย (Figma "มอบหมายงานผู้รับเหมา")
 * งานย่อยคือแถวใหม่ในตาราง Jobs ของบริษัทรายย่อย อ้างงานแม่ด้วย parent_job_id (ดู docs/sql/10)
 * เลขงาน = เลขงานแม่ต่อท้าย -S1, -S2 … บริษัทรายย่อยจึงรับงาน/ทำงาน/คุยแชทได้ด้วยระบบเดิมทั้งหมด
 */
@Injectable()
export class JobSubService {
  constructor(
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    private readonly jobService: JobService,
    private readonly venderService: VenderService,
    private readonly attatchService: JobAttatchService,
  ) {}

  /** ตรวจว่าผู้ใช้เป็นผู้จ่ายงานของงานแม่นี้ได้ (เห็นงาน + เป็นเจ้าของงาน หรือเป็นแอดมิน + งานอยู่สถานะที่มอบหมายต่อได้) */
  private async requireDispatcher(user: User, parentId: string): Promise<Job> {
    await this.jobService.findAccessible(user, parentId); // 404 ถ้าไม่ใช่งานที่เห็น
    const parent = await this.jobs.findOne({ where: { id: parentId } });
    if (!parent) throw new NotFoundException('ไม่พบงาน');
    const ownership = await this.jobService.getOwnership({
      id: parent.id,
      statusId: Number(parent.statusId),
      assignedTo: parent.assignedTo,
    });
    if (!canAddSubJob(user, ownership, parent.parentJobId !== null)) {
      throw new ForbiddenException(
        'มอบหมายงานย่อยไม่ได้: ต้องเป็นผู้ที่รับงานนี้ (หรือแอดมิน) และงานต้องอยู่ในสถานะรับงานแล้ว/กำลังดำเนินการ/รออะไหล่ (งานย่อยมอบต่อไม่ได้)',
      );
    }
    return parent;
  }

  /** มอบหมายงานย่อยให้บริษัทอื่น พร้อมรูปประกอบ (ถ้ามี) — คืนรายละเอียดงานแม่ล่าสุด */
  async create(
    user: User,
    parentId: string,
    dto: CreateSubJobDto,
    files: UploadedFileLike[],
  ): Promise<JobDetail> {
    const parent = await this.requireDispatcher(user, parentId);

    if (dto.venderCode === parent.venderCode) {
      throw new BadRequestException(
        'เลือกบริษัทของตัวเองไม่ได้ ให้เลือกบริษัทผู้รับเหมาช่วง',
      );
    }
    if (!(await this.venderService.exists(dto.venderCode))) {
      throw new BadRequestException('ไม่พบบริษัทนี้');
    }
    const [{ today, nowTime }] = await this.jobs.query<
      { today: string; nowTime: string }[]
    >(
      `SELECT CONVERT(varchar(10), SYSDATETIME(), 23) AS today,
              CONVERT(varchar(5), SYSDATETIME(), 108) AS nowTime`,
    );
    // วันที่ต้องมีอยู่จริง (เช่น 2026-02-31 ไม่ผ่าน) ไม่งั้นฐานข้อมูลแปลงค่าไม่ได้
    const due = new Date(`${dto.dueDate}T00:00:00Z`);
    if (
      Number.isNaN(due.getTime()) ||
      due.toISOString().slice(0, 10) !== dto.dueDate
    ) {
      throw new BadRequestException('กำหนดเสร็จไม่ถูกต้อง');
    }
    // วันนี้: เวลาต้องยังไม่ผ่านไปแล้ว (เทียบเวลาของเซิร์ฟเวอร์ฐานข้อมูล ซึ่งเป็นเวลาท้องถิ่นเดียวกับที่เก็บ)
    if (
      dto.dueDate < today ||
      (dto.dueDate === today && dto.dueTime <= nowTime)
    ) {
      throw new BadRequestException('กำหนดเสร็จต้องไม่ย้อนหลัง');
    }

    let staged: StagedFile[] = [];
    try {
      await this.jobs.manager.transaction(async (em) => {
        // ล็อกช่วงงานย่อยของงานแม่ก่อน: กันสองคนกดพร้อมกันได้เลขซ้ำ และกันงานแม่ถูกส่งงานไปพร้อมกัน
        // (การส่งงานหลักล็อกช่วงเดียวกันแล้วตรวจว่างานย่อยจบครบ — ใครได้ล็อกก่อนอีกฝั่งต้องรอ)
        const [{ n }] = await em.query<{ n: number }[]>(
          'SELECT COUNT(*) AS n FROM dbo.Jobs WITH (UPDLOCK, HOLDLOCK) WHERE parent_job_id = @0',
          [parent.id],
        );

        // งานแม่ต้องยังอยู่สถานะที่มอบหมายต่อได้ ณ ตอนบันทึก (กันสถานะเปลี่ยนระหว่างกรอกฟอร์ม)
        const still = await em.findOne(Job, {
          where: {
            id: parent.id,
            statusId: In([
              JobStatusId.ACCEPTED,
              JobStatusId.IN_PROGRESS,
              JobStatusId.WAITING_PARTS,
            ]),
          },
          select: { id: true },
        });
        if (!still) {
          throw new ConflictException(
            'งานเปลี่ยนสถานะไปแล้ว กรุณารีเฟรชหน้าแล้วลองใหม่',
          );
        }

        // กดซ้ำ: บริษัทนี้ยังไม่ได้ตอบรับงานย่อยก่อนหน้า
        const [{ waiting }] = await em.query<{ waiting: number }[]>(
          `SELECT COUNT(*) AS waiting FROM dbo.Jobs
            WHERE parent_job_id = @0 AND vender_code = @1 AND status_id = @2`,
          [parent.id, dto.venderCode, JobStatusId.NEW],
        );
        if (Number(waiting) > 0) {
          throw new ConflictException(
            'ส่งงานย่อยให้บริษัทนี้แล้ว กำลังรอตอบรับ — ยกเลิกอันเดิมก่อนถ้าต้องการส่งใหม่',
          );
        }

        // ออกเลข -S{n} จากจำนวนที่นับไว้ตอนล็อก
        const jobCode = `${parent.jobCode}-S${Number(n) + 1}`;

        const inserted = await em.insert(Job, {
          jobCode,
          venderCode: dto.venderCode,
          branchCode: parent.branchCode,
          branchName: parent.branchName,
          jobType: parent.jobType,
          statusId: JobStatusId.NEW,
          details: dto.scope,
          brand: parent.brand,
          model: parent.model,
          requestedAt: () => 'SYSDATETIME()',
          address: parent.address,
          // ผู้ติดต่อหน้างาน + ระดับความสำคัญ คัดลอกจากงานแม่ (รายย่อยต้องประสานสาขาเอง)
          // ไม่คัดลอก SLA (เป็นของผู้รับเหมาหลัก — รายย่อยใช้กำหนดเสร็จ due_at) และข้อมูล OPS (รหัส/ผู้คีย์)
          reporterName: parent.reporterName,
          reporterPhone: parent.reporterPhone,
          priorityName: parent.priorityName,
          parentJobId: parent.id,
        });
        const childId = String((inserted.identifiers[0] as { id: string }).id);
        // กำหนดเสร็จเขียนด้วย SQL ตรง ๆ: ส่ง 'YYYY-MM-DD HH:mm:ss' เป็นพารามิเตอร์ให้ SQL Server แปลงเป็น DATETIME2 เอง
        // (ค่านี้เป็นเวลาท้องถิ่นแบบไม่มี timezone — ถ้าส่งเป็น Date ผ่าน driver จะเสี่ยงเพี้ยนตาม timezone ของเครื่อง)
        await em.query('UPDATE dbo.Jobs SET due_at = @0 WHERE id = @1', [
          `${dto.dueDate} ${dto.dueTime}:00`,
          childId,
        ]);

        staged = await this.attatchService.stage(childId, files);
        await this.attatchService.insertStaged(
          em,
          user,
          childId,
          'report',
          staged,
        );
        await em.insert(JobLog, {
          jobId: childId,
          action: JobLogAction.CREATED,
          fromStatusId: null,
          toStatusId: JobStatusId.NEW,
          actorId: user.id,
          note: dto.note ?? null,
          changes: JSON.stringify({
            parentJobId: { from: null, to: parent.id },
            venderCode: { from: null, to: dto.venderCode },
            dueDate: { from: null, to: dto.dueDate },
            dueTime: { from: null, to: dto.dueTime },
          } satisfies JobLogChanges),
        });
      });
    } catch (err) {
      await this.attatchService.discard(staged); // DB ล้มเหลว → ไม่ให้เหลือไฟล์กำพร้า
      throw err;
    }

    return this.jobService.getDetail(user, parent.id);
  }

  /** ยกเลิกงานย่อยที่ยังไม่มีใครรับ (เลือกบริษัทผิด ฯลฯ) — คืนรายละเอียดงานแม่ล่าสุด (สถานะที่ยกเลิกได้: SUB_JOB_CANCELLABLE) */
  async cancel(
    user: User,
    parentId: string,
    subId: string,
  ): Promise<JobDetail> {
    const parent = await this.requireDispatcher(user, parentId);

    await this.jobs.manager.transaction(async (em) => {
      const sub = await em.findOne(Job, {
        where: { id: subId, parentJobId: parent.id },
        select: { id: true, statusId: true },
      });
      const from = sub ? Number(sub.statusId) : null;
      if (from === null || !SUB_JOB_CANCELLABLE.includes(from)) {
        throw new ConflictException(
          'ยกเลิกไม่ได้: งานย่อยนี้มีผู้รับไปแล้วหรือถูกยกเลิกไปแล้ว กรุณารีเฟรชหน้า',
        );
      }
      // เปลี่ยนแบบมีเงื่อนไข: สถานะต้องยังเป็นค่าที่อ่านมา (กันบริษัทกดรับงานพร้อมกัน)
      const res = await em.update(
        Job,
        { id: subId, parentJobId: parent.id, statusId: from },
        { statusId: JobStatusId.CANCELLED, updatedAt: () => 'SYSDATETIME()' },
      );
      if (!res.affected) {
        throw new ConflictException(
          'ยกเลิกไม่ได้: สถานะงานย่อยเปลี่ยนไปแล้ว กรุณารีเฟรชหน้า',
        );
      }
      await em.insert(JobLog, {
        jobId: subId,
        action: JobLogAction.CANCELLED,
        fromStatusId: from,
        toStatusId: JobStatusId.CANCELLED,
        actorId: user.id,
        note: 'ผู้รับเหมาหลักยกเลิกก่อนมีผู้ตอบรับ',
      });
    });

    return this.jobService.getDetail(user, parent.id);
  }

  /**
   * ผู้รับเหมาหลัก (เจ้าของงานแม่ / หัวหน้าของบริษัท) หรือแอดมินตรวจงานย่อยที่บริษัทรายย่อยส่งมา — คืนรายละเอียดงานแม่ล่าสุด
   *  approve → ปิดงานย่อย (ส่งมอบ → ปิดงาน)
   *  rework  → ตีกลับให้แก้ไข (ส่งมอบ → กำลังดำเนินการ) ต้องระบุสิ่งที่ต้องแก้ บริษัทรายย่อยต้องส่งงานใหม่พร้อมรูปหลังแก้ไข
   */
  async inspect(
    user: User,
    parentId: string,
    subId: string,
    dto: InspectSubJobDto,
  ): Promise<JobDetail> {
    const parent = await this.jobService.findAccessible(user, parentId); // 404 ถ้าไม่เห็นงานแม่
    if (!isSubJobInspector(user, await this.jobService.getOwnership(parent))) {
      throw new ForbiddenException(
        'ตรวจรับงานย่อยได้เฉพาะผู้รับเหมาที่รับงานนี้ หัวหน้าของบริษัท หรือแอดมิน',
      );
    }
    const sub = await this.jobs.findOne({
      where: { id: subId, parentJobId: parentId },
      select: { id: true, statusId: true },
    });
    if (!sub || Number(sub.statusId) === Number(JobStatusId.CANCELLED)) {
      throw new NotFoundException('ไม่พบงานย่อย');
    }
    const approve = dto.result === 'approve';
    if (!approve && !dto.note) {
      throw new BadRequestException('กรุณาระบุสิ่งที่ต้องแก้ไข');
    }
    const to = approve ? JobStatusId.COMPLETED : JobStatusId.IN_PROGRESS;

    await this.jobs.manager.transaction(async (em) => {
      // เปลี่ยนแบบมีเงื่อนไข: ต้องยังรอตรวจรับอยู่ (กันกดซ้ำ/หัวหน้าสองคนตรวจพร้อมกัน)
      const res = await em.update(
        Job,
        { id: subId, parentJobId: parentId, statusId: JobStatusId.DELIVERED },
        { statusId: to, updatedAt: () => 'SYSDATETIME()' },
      );
      if (!res.affected) {
        throw new ConflictException(
          'งานย่อยนี้ไม่ได้รอตรวจรับแล้ว (อาจมีคนตรวจไปแล้ว) กรุณารีเฟรชหน้า',
        );
      }
      await em.insert(JobLog, {
        jobId: subId,
        action: approve ? JobLogAction.INSPECTED : JobLogAction.REWORK,
        fromStatusId: JobStatusId.DELIVERED,
        toStatusId: to,
        actorId: user.id,
        note: dto.note ?? null,
      });
    });

    return this.jobService.getDetail(user, parentId);
  }
}

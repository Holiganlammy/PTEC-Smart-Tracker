import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { EntityManager, Repository } from 'typeorm';
import { JobAttatch } from '../model/job-attatch.model';
import { JobLog, JobLogAction } from '../model/job-log.model';
import { JobStatusId } from '../model/job-status.model';
import { RoleId } from '../model/role.model';
import { User } from '../model/user.model';
import type {
  AttatchKind,
  JobAttatchItem,
  UploadedFileLike,
  UploadKind,
} from '../type/job-attatch.type';

/** งานที่ผ่านการตรวจสิทธิ์การเข้าถึงมาแล้ว (JobService.findAccessible) */
export interface AccessibleJob {
  id: string;
  statusId: number;
}

/** ไฟล์ที่ตรวจผ่านและเขียนลงดิสก์แล้ว แต่ยังไม่ได้บันทึกลง DB */
export interface StagedFile {
  path: string;
  stored: string;
  originalName: string;
  mime: string;
  size: number;
  buffer: Buffer;
}

interface DetectedImage {
  mime: string;
  ext: string;
}

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

/** สถานะของงานที่อัปโหลดแต่ละชนิดได้ (ยืนยันรับงาน → กำลังดำเนินงาน → ส่งงาน) */
const UPLOAD_RULES: Record<UploadKind, JobStatusId[]> = {
  accepted: [JobStatusId.NEW, JobStatusId.ACCEPTED],
  progress: [
    JobStatusId.ACCEPTED,
    JobStatusId.IN_PROGRESS,
    JobStatusId.WAITING_PARTS,
  ],
  completed: [
    JobStatusId.IN_PROGRESS,
    JobStatusId.WAITING_PARTS,
    JobStatusId.DELIVERED,
  ],
};

const UPLOADERS: number[] = [
  Number(RoleId.CONTRACTOR),
  Number(RoleId.HEAD),
  Number(RoleId.SUB_CONTRACTOR),
];

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_REQUEST = 5;
const MAX_FILES_PER_KIND = 20;

@Injectable()
export class JobAttatchService {
  private readonly logger = new Logger(JobAttatchService.name);

  constructor(
    @InjectRepository(JobAttatch)
    private readonly attatches: Repository<JobAttatch>,
  ) {}

  /** ที่เก็บไฟล์ที่อัปโหลดจากระบบเรา (ตั้ง UPLOAD_DIR ได้ ค่าเริ่มต้น ./uploads) */
  private get uploadRoot() {
    return resolve(process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'));
  }

  /** ชนิดไฟล์ที่ผู้ใช้คนนี้อัปโหลดเพิ่มได้ ณ สถานะงานปัจจุบัน */
  uploadableKinds(user: User, statusId: number): UploadKind[] {
    if (!UPLOADERS.includes(Number(user.roleId))) return [];
    return (Object.keys(UPLOAD_RULES) as UploadKind[]).filter((k) =>
      UPLOAD_RULES[k].includes(statusId),
    );
  }

  async list(user: User, job: AccessibleJob): Promise<JobAttatchItem[]> {
    const rows = await this.attatches
      .createQueryBuilder('a')
      .leftJoin(User, 'u', 'u.id = a.uploadedBy')
      .select([
        'a.id AS id',
        'a.source AS source',
        'a.kind AS kind',
        'a.fileName AS fileName',
        'a.originalName AS originalName',
        'a.mimeType AS mimeType',
        'a.sizeBytes AS sizeBytes',
        'a.uploadedBy AS uploadedBy',
        'a.createdAt AS createdAt',
        'u.firstName AS firstName',
        'u.lastName AS lastName',
      ])
      .where('a.jobId = :jobId', { jobId: job.id })
      .andWhere('a.deletedAt IS NULL')
      .orderBy('a.id', 'ASC')
      .getRawMany<{
        id: string;
        source: 'ops' | 'strack';
        kind: AttatchKind;
        fileName: string;
        originalName: string | null;
        mimeType: string | null;
        sizeBytes: string | null;
        uploadedBy: string | null;
        createdAt: Date;
        firstName: string | null;
        lastName: string | null;
      }>();

    const deletable = this.uploadableKinds(user, job.statusId);
    return rows.map((r) => {
      const mime =
        r.mimeType ?? MIME_BY_EXT[extname(r.fileName).toLowerCase()] ?? null;
      return {
        id: r.id,
        source: r.source,
        kind: r.kind,
        originalName:
          r.originalName ?? (r.source === 'ops' ? r.fileName : null),
        mimeType: mime,
        isImage: !!mime && mime.startsWith('image/'),
        sizeBytes: r.sizeBytes ? Number(r.sizeBytes) : null,
        uploadedByName:
          [r.firstName, r.lastName].filter(Boolean).join(' ') || null,
        createdAt: new Date(r.createdAt).toISOString(),
        // ลบได้เฉพาะไฟล์ที่ตัวเองอัปโหลด (หัวหน้าลบของลูกทีมได้) ในขั้นที่ยังอัปโหลดได้
        canDelete:
          r.source === 'strack' &&
          deletable.includes(r.kind as UploadKind) &&
          (r.uploadedBy === user.id ||
            Number(user.roleId) === Number(RoleId.HEAD)),
      };
    });
  }

  async upload(
    user: User,
    job: AccessibleJob,
    kind: string,
    files: UploadedFileLike[],
  ): Promise<JobAttatchItem[]> {
    const allowed = this.uploadableKinds(user, job.statusId);
    if (!allowed.includes(kind as UploadKind)) {
      throw new ForbiddenException(
        'อัปโหลดรูปชนิดนี้ไม่ได้ในสถานะปัจจุบันของงาน',
      );
    }
    if (!files?.length) throw new BadRequestException('ยังไม่ได้เลือกไฟล์');
    await this.assertCapacity(job.id, kind, files.length);

    const staged = await this.stage(job.id, files);
    try {
      const saved = await this.attatches.manager.transaction(async (em) => {
        const rows = await this.insertStaged(em, user, job.id, kind, staged);
        await em.insert(JobLog, {
          jobId: job.id,
          action: JobLogAction.ATTACHED,
          actorId: user.id,
          note: `${kind} × ${rows.length}`,
        });
        return rows;
      });
      const ids = new Set(saved.map((s) => s.id));
      return (await this.list(user, job)).filter((i) => ids.has(i.id));
    } catch (err) {
      await this.discard(staged); // DB ล้มเหลว → ไม่ให้เหลือไฟล์กำพร้า
      throw err;
    }
  }

  /** จำนวนไฟล์ที่ยังไม่ถูกลบของงานในขั้นนั้น */
  countLive(jobId: string, kind: string): Promise<number> {
    return this.attatches
      .createQueryBuilder('a')
      .where('a.jobId = :jobId AND a.kind = :kind AND a.deletedAt IS NULL', {
        jobId,
        kind,
      })
      .getCount();
  }

  /** กันแนบเกินจำนวนสูงสุดต่อขั้น */
  async assertCapacity(jobId: string, kind: string, adding: number) {
    if (adding === 0) return;
    const live = await this.countLive(jobId, kind);
    if (live + adding > MAX_FILES_PER_KIND) {
      throw new ConflictException(
        `แนบได้สูงสุด ${MAX_FILES_PER_KIND} รูปต่อขั้นตอน (มีแล้ว ${live} รูป)`,
      );
    }
  }

  /**
   * ตรวจไฟล์ทั้งหมดแล้วเขียนลงดิสก์ (ยังไม่ลง DB)
   * ผู้เรียกต้องเรียก insertStaged ในทรานแซกชัน และเรียก discard ถ้าขั้นต่อไปล้มเหลว
   */
  async stage(jobId: string, files: UploadedFileLike[]): Promise<StagedFile[]> {
    // ตรวจทุกไฟล์ก่อนเขียนอะไรลงดิสก์
    const dir = join(this.uploadRoot, 'jobs', jobId);
    const prepared: StagedFile[] = files.map((f) => {
      if (f.size > MAX_FILE_BYTES) {
        throw new BadRequestException(
          `ไฟล์ ${f.originalname} ใหญ่เกิน ${MAX_FILE_BYTES / 1024 / 1024} MB`,
        );
      }
      const type = this.detectImage(f.buffer);
      if (!type) {
        throw new BadRequestException(
          `ไฟล์ ${f.originalname} ไม่ใช่รูป JPG/PNG/WebP`,
        );
      }
      const stored = `${randomUUID()}${type.ext}`;
      return {
        path: join(dir, stored),
        stored,
        originalName: this.cleanName(f.originalname),
        mime: type.mime,
        size: f.size,
        buffer: f.buffer,
      };
    });
    if (prepared.length === 0) return prepared;

    await mkdir(dir, { recursive: true });
    const written: StagedFile[] = [];
    try {
      for (const p of prepared) {
        await writeFile(p.path, p.buffer);
        written.push(p);
      }
    } catch (err) {
      await this.discard(written);
      throw err;
    }
    return prepared;
  }

  /** บันทึกรายการไฟล์ที่ stage แล้วลง Jobs_Attatch (ภายในทรานแซกชันของผู้เรียก) */
  insertStaged(
    em: EntityManager,
    user: User,
    jobId: string,
    kind: string,
    staged: StagedFile[],
  ): Promise<JobAttatch[]> {
    if (staged.length === 0) return Promise.resolve([]);
    return em.save(
      JobAttatch,
      staged.map((p) =>
        em.create(JobAttatch, {
          jobId,
          source: 'strack',
          kind,
          fileName: p.stored,
          originalName: p.originalName,
          mimeType: p.mime,
          sizeBytes: String(p.size),
          uploadedBy: user.id,
        }),
      ),
    );
  }

  /** ลบไฟล์ที่ stage ไว้ (ใช้เมื่อบันทึก DB ไม่สำเร็จ) */
  async discard(staged: StagedFile[]) {
    await Promise.all(staged.map((p) => rm(p.path, { force: true })));
  }

  async remove(user: User, job: AccessibleJob, attId: string): Promise<void> {
    const items = await this.list(user, job);
    const item = items.find((i) => i.id === attId);
    if (!item) throw new NotFoundException('ไม่พบไฟล์');
    if (!item.canDelete) throw new ForbiddenException('ลบไฟล์นี้ไม่ได้');

    await this.attatches.manager.transaction(async (em) => {
      await em.update(
        JobAttatch,
        { id: attId },
        { deletedAt: () => 'SYSDATETIME()' },
      );
      await em.insert(JobLog, {
        jobId: job.id,
        action: JobLogAction.DETACHED,
        actorId: user.id,
        note: `${item.kind}: ${item.originalName ?? attId}`.slice(0, 500),
      });
    });
    // ตัวไฟล์ไม่ลบทันที (soft delete) เผื่อกู้คืน/ตรวจสอบย้อนหลัง
  }

  /** เปิดตัวไฟล์: strack อ่านจากที่เก็บของเรา, ops อ่านจาก OPS_FILE_DIR หรือ OPS_FILE_BASE_URL */
  async open(job: AccessibleJob, attId: string) {
    const row = await this.attatches.findOne({
      where: { id: attId, jobId: job.id },
    });
    if (!row || row.deletedAt) throw new NotFoundException('ไม่พบไฟล์');

    const name = basename(row.fileName); // กัน path traversal
    const mime =
      row.mimeType ??
      MIME_BY_EXT[extname(name).toLowerCase()] ??
      'application/octet-stream';

    if (row.source === 'strack') {
      return this.fromDisk(join(this.uploadRoot, 'jobs', job.id, name), mime);
    }

    const dir = process.env.OPS_FILE_DIR;
    if (dir) return this.fromDisk(join(resolve(dir), name), mime);

    const base = process.env.OPS_FILE_BASE_URL;
    if (base) {
      const url = `${base.replace(/\/+$/, '')}/${encodeURIComponent(name)}`;
      const res = await fetch(url).catch(() => null);
      if (!res?.ok || !res.body) {
        throw new NotFoundException('ไม่พบไฟล์ใน OPS');
      }
      return {
        file: new StreamableFile(
          Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
        ),
        mime,
      };
    }
    throw new NotFoundException('ยังไม่ได้ตั้งค่าที่เก็บไฟล์ของ OPS');
  }

  private async fromDisk(path: string, mime: string) {
    const exists = await stat(path)
      .then((s) => s.isFile())
      .catch(() => false);
    if (!exists) {
      this.logger.warn(`ไม่พบไฟล์บนดิสก์: ${path}`);
      throw new NotFoundException('ไม่พบไฟล์');
    }
    return { file: new StreamableFile(createReadStream(path)), mime };
  }

  /** ตรวจชนิดรูปจาก byte แรก (ไม่เชื่อ mimetype/นามสกุลที่ผู้ใช้ส่งมา) */
  private detectImage(buf: Buffer): DetectedImage | null {
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      return { mime: 'image/jpeg', ext: '.jpg' };
    }
    if (buf.length > 8 && buf.toString('hex', 0, 8) === '89504e470d0a1a0a') {
      return { mime: 'image/png', ext: '.png' };
    }
    if (
      buf.length > 12 &&
      buf.toString('ascii', 0, 4) === 'RIFF' &&
      buf.toString('ascii', 8, 12) === 'WEBP'
    ) {
      return { mime: 'image/webp', ext: '.webp' };
    }
    return null;
  }

  private cleanName(name: string) {
    return basename(name)
      .replace(/[\r\n\t]/g, ' ')
      .slice(0, 255);
  }
}

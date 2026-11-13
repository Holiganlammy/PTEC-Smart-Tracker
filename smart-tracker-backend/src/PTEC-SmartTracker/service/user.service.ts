import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { AddUserDto } from '../dto/add-user.dto';
import { ListUsersQuery, UpdateUserDto } from '../dto/admin-user.dto';
import { Role, RoleId } from '../model/role.model';
import { User } from '../model/user.model';
import { LineAuthService } from './line-auth.service';
import { VenderService } from './vender.service';

/** จัดการผู้ใช้ทั้งหมด (ตาราง users) */
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    private readonly lineAuth: LineAuthService,
    private readonly venderService: VenderService,
  ) {}

  /** ลงทะเบียนผู้ใช้ใหม่ (สถานะ "รอ OPS ตรวจสอบ") */
  async addUser(dto: AddUserDto) {
    // userId มาจาก ID Token ที่ verify แล้วเท่านั้น
    const profile = await this.lineAuth.verifyIdToken(dto.idToken);

    const existing = await this.users.findOne({
      where: { lineUserId: profile.userId },
    });
    if (existing) {
      throw new ConflictException({
        message: 'บัญชี LINE นี้ลงทะเบียนแล้ว',
        status: existing.status,
      });
    }

    if (!(await this.venderService.exists(dto.venderCode))) {
      throw new BadRequestException('ไม่พบบริษัทผู้รับเหมานี้');
    }

    const [firstName, ...rest] = dto.fullName.trim().split(/\s+/);
    const lastName = rest.join(' ') || null;

    const user = await this.users.save(
      this.users.create({
        lineUserId: profile.userId,
        lineDisplayName: profile.displayName,
        linePictureUrl: profile.pictureUrl,
        firstName,
        lastName,
        phoneNumber: dto.phoneNumber,
        email: dto.email ?? null,
        venderCode: dto.venderCode,
        roleId: RoleId.CONTRACTOR,
        status: 'pending',
      }),
    );

    return { id: user.id, status: user.status };
  }

  /** ข้อมูลของผู้ใช้ที่ล็อกอินอยู่ (user = null แปลว่ายังไม่ได้ลงทะเบียน) */
  async getMe(user: User | null) {
    if (!user) return { registered: false };

    const line = {
      displayName: user.lineDisplayName,
      pictureUrl: user.linePictureUrl,
    };

    const names = await this.venderService.getNames([user.venderCode ?? '']);

    return {
      registered: true,
      id: user.id,
      status: user.status,
      active: user.active,
      roleId: user.roleId,
      roleName: user.role.nameTh,
      rejectReason: user.rejectReason,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      email: user.email,
      venderCode: user.venderCode,
      venderName: user.venderCode ? (names.get(user.venderCode) ?? null) : null,
      createdAt: user.createdAt,
      approvedAt: user.approvedAt,
      line,
    };
  }

  // ───────── ส่วนของแอดมิน (ใช้คู่กับ JwtAuthGuard + RolesGuard) ─────────

  /** รายชื่อผู้ใช้ กรองตามสถานะ/คำค้น (ชื่อ เบอร์ อีเมล ชื่อ LINE รหัสบริษัท) ล่าสุดก่อน สูงสุด 200 แถว */
  async listUsers({ status, q, active }: ListUsersQuery) {
    const keyword = q?.trim();
    const base = {
      ...(status ? { status } : {}),
      ...(active ? { active: active === 'true' } : {}),
    };
    const where = keyword
      ? (
          [
            'firstName',
            'lastName',
            'phoneNumber',
            'email',
            'lineDisplayName',
            'venderCode',
          ] as const
        ).map((field) => ({ ...base, [field]: Like(`%${keyword}%`) }))
      : base;

    const users = await this.users.find({
      where,
      order: { createdAt: 'DESC' },
      take: 200,
    });
    const names = await this.venderService.getNames(
      users.map((u) => u.venderCode ?? ''),
    );

    return users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      phoneNumber: u.phoneNumber,
      email: u.email,
      lineDisplayName: u.lineDisplayName,
      linePictureUrl: u.linePictureUrl,
      venderCode: u.venderCode,
      venderName: u.venderCode ? (names.get(u.venderCode) ?? null) : null,
      roleId: u.roleId,
      role: u.role.code,
      roleName: u.role.nameTh,
      status: u.status,
      active: u.active,
      rejectReason: u.rejectReason,
      approvedAt: u.approvedAt,
      createdAt: u.createdAt,
    }));
  }

  /** นับจำนวนผู้ใช้ตามสถานะ (โชว์ตัวเลขบนแท็บ) */
  async countByStatus() {
    const rows = await this.users
      .createQueryBuilder('u')
      .select('u.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('u.status')
      .getRawMany<{ status: string; count: string }>();
    return Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
  }

  /** อนุมัติผู้สมัคร (ล้างเหตุผลที่เคยตีกลับ) */
  async approve(id: string, adminId: string) {
    const user = await this.findOrFail(id);
    user.status = 'approved';
    user.approvedBy = adminId;
    user.approvedAt = new Date();
    user.rejectReason = null;
    user.updatedAt = new Date();
    await this.users.save(user);
    return { id: user.id, status: user.status };
  }

  /** ตีกลับ/ไม่อนุมัติ พร้อมเหตุผล (ผู้สมัครเห็นในหน้าสถานะ) */
  async reject(id: string, adminId: string, reason: string) {
    const user = await this.findOrFail(id);
    user.status = 'rejected';
    user.approvedBy = adminId;
    user.approvedAt = new Date();
    user.rejectReason = reason.trim();
    user.updatedAt = new Date();
    await this.users.save(user);
    return { id: user.id, status: user.status };
  }

  /** รายการสิทธิ์ที่เลือกได้ (ใช้กับ dropdown หน้าจัดการผู้ใช้) */
  async listRoles() {
    const roles = await this.roles.find({
      where: { active: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    return roles.map((r) => ({ id: r.id, code: r.code, nameTh: r.nameTh }));
  }

  /** แอดมินแก้ข้อมูลผู้ใช้ (ชื่อ เบอร์ อีเมล บริษัท สิทธิ์) — เปลี่ยนสิทธิ์ตัวเองไม่ได้ */
  async updateUser(id: string, dto: UpdateUserDto, adminId: string) {
    const user = await this.findOrFail(id);

    if (
      dto.roleId !== undefined &&
      dto.roleId !== user.roleId &&
      user.id === adminId
    ) {
      throw new BadRequestException('ไม่สามารถเปลี่ยนสิทธิ์ของตัวเองได้');
    }
    if (dto.venderCode !== undefined && dto.venderCode !== user.venderCode) {
      if (!(await this.venderService.exists(dto.venderCode))) {
        throw new BadRequestException('ไม่พบบริษัทผู้รับเหมานี้');
      }
    }
    if (
      dto.roleId !== undefined &&
      !(await this.roles.existsBy({ id: dto.roleId, active: true }))
    ) {
      throw new BadRequestException('ไม่พบสิทธิ์นี้');
    }

    await this.users.update(
      { id: user.id },
      {
        ...(dto.firstName !== undefined && { firstName: dto.firstName.trim() }),
        ...(dto.lastName !== undefined && {
          lastName: dto.lastName.trim() || null,
        }),
        ...(dto.phoneNumber !== undefined && { phoneNumber: dto.phoneNumber }),
        ...(dto.email !== undefined && { email: dto.email.trim() || null }),
        ...(dto.venderCode !== undefined && { venderCode: dto.venderCode }),
        ...(dto.roleId !== undefined && { roleId: dto.roleId }),
        updatedAt: new Date(),
      },
    );
    return { id: user.id };
  }

  /** เปิด/ปิดการใช้งานผู้ใช้ (active 1/0) — ปิดบัญชีตัวเองไม่ได้ */
  async setActive(id: string, active: boolean, adminId: string) {
    if (!active && id === adminId) {
      throw new BadRequestException('ไม่สามารถปิดการใช้งานบัญชีของตัวเองได้');
    }
    const user = await this.findOrFail(id);
    user.active = active;
    user.updatedAt = new Date();
    await this.users.save(user);
    return { id: user.id, active: user.active };
  }

  private async findOrFail(id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('ไม่พบผู้ใช้');
    return user;
  }
}

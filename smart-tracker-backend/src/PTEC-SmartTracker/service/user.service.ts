import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AddUserDto } from '../dto/add-user.dto';
import { User } from '../model/user.model';
import { LineAuthService } from './line-auth.service';
import { VenderService } from './vender.service';

/** จัดการผู้ใช้ทั้งหมด (ตาราง users) */
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
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
        role: 'contractor',
        status: 'pending',
      }),
    );

    return { id: user.id, status: user.status };
  }

  /** เช็กว่าบัญชี LINE นี้ลงทะเบียนหรือยัง และสถานะเป็นอะไร (ใช้ตอนเปิดแอป) */
  async getMe(idToken: string) {
    const profile = await this.lineAuth.verifyIdToken(idToken);
    const line = {
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
    };

    const user = await this.users.findOne({
      where: { lineUserId: profile.userId },
    });
    if (!user) return { registered: false, line };

    return {
      registered: true,
      id: user.id,
      status: user.status,
      role: user.role,
      rejectReason: user.rejectReason,
      firstName: user.firstName,
      lastName: user.lastName,
      venderCode: user.venderCode,
      line,
    };
  }
}

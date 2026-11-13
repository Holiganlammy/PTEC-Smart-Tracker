import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AddUserDto } from '../dto/add-user.dto';
import { RoleId } from '../model/role.model';
import { User } from '../model/user.model';
import { LineAuthService } from './line-auth.service';

@Injectable()
export class AddUserService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly lineAuth: LineAuthService,
  ) {}

  async execute(dto: AddUserDto) {
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
}

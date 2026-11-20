import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../model/user.model';
import { AuthService } from '../service/auth.service';
import type { AuthedRequest } from '../type/auth.type';

/**
 * ตรวจ access JWT (Authorization: Bearer) แล้วโหลดผู้ใช้จาก DB ใส่ request
 * โหลดจาก DB ทุกครั้งเพื่อให้การปิดใช้งาน/เปลี่ยน role มีผลทันที ไม่ต้องรอ JWT หมดอายุ
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();

    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException('ไม่พบ token');

    const lineUserId = await this.auth.verifyAccessToken(token);
    const user = await this.users.findOne({ where: { lineUserId } });
    if (user && !user.active) {
      throw new ForbiddenException('บัญชีนี้ถูกปิดการใช้งาน');
    }

    req.lineUserId = lineUserId;
    req.currentUser = user;
    return true;
  }
}

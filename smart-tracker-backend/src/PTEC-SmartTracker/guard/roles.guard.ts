import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleId } from '../model/role.model';
import type { AuthedRequest } from './jwt-auth.guard';

const ROLES_KEY = 'roles';

/** จำกัดสิทธิ์ตาม role — ใช้คู่กับ JwtAuthGuard:  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(RoleId.ADMIN) */
export const Roles = (...roles: RoleId[]) => SetMetadata(ROLES_KEY, roles);

/** ผู้ใช้ต้องลงทะเบียน + อนุมัติแล้ว + เปิดใช้งาน + อยู่ใน role ที่กำหนด */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<RoleId[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) return true;

    const user = context.switchToHttp().getRequest<AuthedRequest>().currentUser;
    if (
      !user ||
      user.status !== 'approved' ||
      !user.active ||
      !roles.includes(user.roleId)
    ) {
      throw new ForbiddenException('ไม่มีสิทธิ์ใช้งานส่วนนี้');
    }
    return true;
  }
}

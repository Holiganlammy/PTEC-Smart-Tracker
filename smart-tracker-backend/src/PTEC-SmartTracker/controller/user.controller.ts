import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AddUserDto } from '../dto/add-user.dto';
import {
  ListUsersQuery,
  RejectUserDto,
  SetActiveDto,
  UpdateUserDto,
} from '../dto/admin-user.dto';
import { JwtAuthGuard, type AuthedRequest } from '../guard/jwt-auth.guard';
import { Roles, RolesGuard } from '../guard/roles.guard';
import { RoleId } from '../model/role.model';
import { UserService } from '../service/user.service';

/** endpoint ทั้งหมดที่เกี่ยวกับผู้ใช้ — /users/... */
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** POST /users/register  (ยังรับ LIFF ID Token ใน body เพื่อยืนยันชื่อ/รูปจาก LINE) */
  @Post('register')
  register(@Body() dto: AddUserDto) {
    return this.userService.addUser(dto);
  }

  /** GET /users/me   (Header: Authorization: Bearer <access JWT>) */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: AuthedRequest) {
    return this.userService.getMe(req.currentUser);
  }

  // ───────── แอดมิน (JwtAuthGuard + role admin) ─────────

  /** GET /users?status=pending&q=คำค้น */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleId.ADMIN)
  @Get()
  list(@Query() query: ListUsersQuery) {
    return this.userService.listUsers(query);
  }

  /** GET /users/roles → [{ id, code, nameTh }] */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleId.ADMIN)
  @Get('roles')
  roles() {
    return this.userService.listRoles();
  }

  /** PATCH /users/:id  { firstName?, lastName?, phoneNumber?, email?, venderCode?, roleId? } */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleId.ADMIN)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: AuthedRequest,
  ) {
    return this.userService.updateUser(id, dto, req.currentUser!.id);
  }

  /** GET /users/counts → { pending: 3, approved: 10, ... } */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleId.ADMIN)
  @Get('counts')
  counts() {
    return this.userService.countByStatus();
  }

  /** PATCH /users/:id/approve */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleId.ADMIN)
  @Patch(':id/approve')
  approve(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.userService.approve(id, req.currentUser!.id);
  }

  /** PATCH /users/:id/reject  { reason } */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleId.ADMIN)
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectUserDto,
    @Req() req: AuthedRequest,
  ) {
    return this.userService.reject(id, req.currentUser!.id, dto.reason);
  }

  /** PATCH /users/:id/active  { active: true|false } */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleId.ADMIN)
  @Patch(':id/active')
  setActive(
    @Param('id') id: string,
    @Body() dto: SetActiveDto,
    @Req() req: AuthedRequest,
  ) {
    return this.userService.setActive(id, dto.active, req.currentUser!.id);
  }
}

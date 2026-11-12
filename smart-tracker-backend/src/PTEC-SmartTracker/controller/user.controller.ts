import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { AddUserDto } from '../dto/add-user.dto';
import { UserService } from '../service/user.service';

/** endpoint ทั้งหมดที่เกี่ยวกับผู้ใช้ — /users/... */
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** POST /users/register */
  @Post('register')
  register(@Body() dto: AddUserDto) {
    return this.userService.addUser(dto);
  }

  /** GET /users/me   (Header: Authorization: Bearer <LIFF ID Token>) — ชั่วคราว จะเปลี่ยนเป็น JWT เมื่อทำ Auth module */
  @Get('me')
  me(@Headers('authorization') authorization?: string) {
    const idToken = authorization?.replace(/^Bearer\s+/i, '');
    if (!idToken) throw new UnauthorizedException('ไม่พบ ID Token');
    return this.userService.getMe(idToken);
  }
}

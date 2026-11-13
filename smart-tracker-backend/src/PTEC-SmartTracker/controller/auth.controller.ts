import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { IsString, MinLength } from 'class-validator';
import { AuthService, IssuedTokens } from '../service/auth.service';

class LineLoginDto {
  @IsString()
  @MinLength(10)
  idToken!: string;
}

const REFRESH_COOKIE = 'rt';

/**
 * /auth/...
 *  - access JWT: ส่งใน response body → หน้าเว็บเก็บในหน่วยความจำ แล้วแนบ Authorization: Bearer
 *  - refresh token: ตั้งเป็น httpOnly cookie (JS อ่านไม่ได้) ใช้ได้เฉพาะ /auth/refresh กับ /auth/logout
 */
@Controller('auth')
export class AuthController {
  private readonly cookieOptions: CookieOptions;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.cookieOptions = {
      httpOnly: true,
      // ใช้ https เท่านั้น (ตั้ง AUTH_COOKIE_SECURE=false เฉพาะตอน dev แบบ http ล้วน)
      secure: config.get('AUTH_COOKIE_SECURE') !== 'false',
      sameSite: 'lax', // กัน CSRF — POST ข้ามเว็บไม่ส่ง cookie นี้
      // ต้องตรงกับ path ที่เบราว์เซอร์เห็น (ผ่าน proxy ของ Next = /api/auth)
      path: config.get<string>('AUTH_COOKIE_PATH') ?? '/api/auth',
    };
  }

  /** POST /auth/line  { idToken } → { accessToken, expiresIn } + cookie refresh token */
  @Post('line')
  @HttpCode(200)
  async line(
    @Body() dto: LineLoginDto,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.loginWithLine(dto.idToken, userAgent);
    return this.respond(res, tokens);
  }

  /** POST /auth/refresh  (อ่าน refresh token จาก cookie) → { accessToken, expiresIn } */
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const tokens = await this.auth.refresh(this.readCookie(req), userAgent);
      return this.respond(res, tokens);
    } catch (e) {
      res.clearCookie(REFRESH_COOKIE, this.cookieOptions);
      throw e;
    }
  }

  /** POST /auth/logout */
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(this.readCookie(req));
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions);
  }

  private respond(res: Response, tokens: IssuedTokens) {
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...this.cookieOptions,
      expires: tokens.refreshExpiresAt,
    });
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  private readCookie(req: Request): string | undefined {
    const header = req.headers.cookie;
    if (!header) return undefined;
    for (const part of header.split(';')) {
      const [name, ...rest] = part.trim().split('=');
      if (name === REFRESH_COOKIE) return decodeURIComponent(rest.join('='));
    }
    return undefined;
  }
}

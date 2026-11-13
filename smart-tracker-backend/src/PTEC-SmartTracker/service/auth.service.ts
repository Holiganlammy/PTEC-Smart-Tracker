import { createHash, randomBytes } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { AuthSession } from '../model/auth-session.model';
import { User } from '../model/user.model';
import { LineAuthService } from './line-auth.service';

export interface AccessPayload {
  /** LINE userId */
  sub: string;
}

export interface IssuedTokens {
  accessToken: string;
  /** อายุ access token (วินาที) */
  expiresIn: number;
  /** refresh token ตัวจริง (ส่งให้เบราว์เซอร์ทาง httpOnly cookie เท่านั้น) */
  refreshToken: string;
  refreshExpiresAt: Date;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** ออก/ต่ออายุ/เลิกใช้ token ของระบบเอง (access JWT สั้น ๆ + refresh token ใน DB) */
@Injectable()
export class AuthService {
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlDays: number;

  constructor(
    config: ConfigService,
    private readonly jwt: JwtService,
    private readonly lineAuth: LineAuthService,
    @InjectRepository(AuthSession)
    private readonly sessions: Repository<AuthSession>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    this.accessTtlSeconds = Number(config.get('JWT_ACCESS_TTL_SECONDS') ?? 900);
    this.refreshTtlDays = Number(config.get('JWT_REFRESH_TTL_DAYS') ?? 14);
  }

  /** ล็อกอินด้วย LIFF ID Token → ออก token ชุดใหม่ */
  async loginWithLine(idToken: string, userAgent?: string) {
    const profile = await this.lineAuth.verifyIdToken(idToken);

    const user = await this.users.findOne({
      where: { lineUserId: profile.userId },
    });
    this.assertUsable(user);

    // อัปเดตชื่อ/รูป LINE ล่าสุดให้ผู้ใช้ที่ลงทะเบียนแล้ว
    if (
      user &&
      (user.lineDisplayName !== profile.displayName ||
        user.linePictureUrl !== profile.pictureUrl)
    ) {
      await this.users.update(
        { id: user.id },
        {
          lineDisplayName: profile.displayName,
          linePictureUrl: profile.pictureUrl,
        },
      );
    }

    return this.issue(profile.userId, userAgent);
  }

  /**
   * แลก refresh token เป็นชุดใหม่ (หมุนเปลี่ยน — ตัวเก่าใช้ซ้ำไม่ได้)
   * อัปเดตแถวเดิมของอุปกรณ์นี้ ไม่เพิ่มแถวใหม่ → ตารางมีขนาดเท่าจำนวนอุปกรณ์ที่ล็อกอิน ไม่โตตามจำนวนครั้งที่ต่ออายุ
   */
  async refresh(refreshToken: string | undefined, userAgent?: string) {
    if (!refreshToken) throw new UnauthorizedException('ไม่พบ session');

    const session = await this.sessions.findOne({
      where: { tokenHash: sha256(refreshToken) },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
    }

    const user = await this.users.findOne({
      where: { lineUserId: session.lineUserId },
    });
    this.assertUsable(user);

    // เปลี่ยนค่าแฮชในแถวเดิม โดยเทียบกับค่าเก่า: สองคำขอที่แลกตัวเดียวกันพร้อมกัน มีแค่คำขอเดียวที่สำเร็จ
    const next = this.newRefreshToken();
    const res = await this.sessions.update(
      { id: session.id, tokenHash: session.tokenHash, revokedAt: IsNull() },
      {
        tokenHash: sha256(next.token),
        expiresAt: next.expiresAt,
        lastUsedAt: new Date(),
        userAgent: userAgent?.slice(0, 300) ?? session.userAgent,
      },
    );
    if (!res.affected) {
      throw new UnauthorizedException('session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
    }

    return {
      accessToken: await this.signAccess(session.lineUserId),
      expiresIn: this.accessTtlSeconds,
      refreshToken: next.token,
      refreshExpiresAt: next.expiresAt,
    };
  }

  /** ออกจากระบบ: เลิกใช้ refresh token ตัวนี้ */
  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return;
    await this.sessions.update(
      { tokenHash: sha256(refreshToken), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  /** ตรวจ access JWT → LINE userId (โยน 401 ถ้าไม่ถูกต้อง/หมดอายุ) */
  async verifyAccessToken(token: string): Promise<string> {
    try {
      const payload = await this.jwt.verifyAsync<AccessPayload>(token);
      return payload.sub;
    } catch {
      throw new UnauthorizedException('token ไม่ถูกต้องหรือหมดอายุ');
    }
  }

  /** ผู้ใช้ที่ลงทะเบียนแล้วแต่ถูกปิดใช้งาน/ระงับ จะไม่ได้ token */
  private assertUsable(user: User | null) {
    if (user && (!user.active || user.status === 'suspended')) {
      throw new UnauthorizedException('บัญชีนี้ถูกปิดการใช้งาน');
    }
  }

  /** ล็อกอินใหม่ = เปิด session ใหม่ 1 แถว (อุปกรณ์/การล็อกอินใหม่) */
  private async issue(
    lineUserId: string,
    userAgent?: string,
  ): Promise<IssuedTokens> {
    // เก็บกวาด session ที่หมดอายุของคนนี้
    await this.sessions.delete({ lineUserId, expiresAt: LessThan(new Date()) });

    const refresh = this.newRefreshToken();
    await this.sessions.insert({
      lineUserId,
      tokenHash: sha256(refresh.token),
      expiresAt: refresh.expiresAt,
      lastUsedAt: new Date(),
      userAgent: userAgent?.slice(0, 300) ?? null,
    });

    return {
      accessToken: await this.signAccess(lineUserId),
      expiresIn: this.accessTtlSeconds,
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
    };
  }

  private signAccess(lineUserId: string) {
    return this.jwt.signAsync({ sub: lineUserId } satisfies AccessPayload, {
      expiresIn: this.accessTtlSeconds,
    });
  }

  private newRefreshToken() {
    return {
      token: randomBytes(48).toString('base64url'),
      expiresAt: new Date(
        Date.now() + this.refreshTtlDays * 24 * 60 * 60 * 1000,
      ),
    };
  }
}

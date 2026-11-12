import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface LineProfile {
  userId: string;
  displayName: string | null;
  pictureUrl: string | null;
}

/** ตรวจ LIFF ID Token กับ LINE (client_id = Channel ID ของ MINI App channel) */
@Injectable()
export class LineAuthService {
  constructor(private readonly config: ConfigService) {}

  async verifyIdToken(idToken: string): Promise<LineProfile> {
    const clientId = this.config.getOrThrow<string>('LINE_MINIAPP_CHANNEL_ID');

    const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: clientId }),
    });

    if (!res.ok) {
      throw new UnauthorizedException('LINE ID Token ไม่ถูกต้องหรือหมดอายุ');
    }

    const payload = (await res.json()) as {
      sub: string;
      name?: string;
      picture?: string;
    };
    return {
      userId: payload.sub,
      displayName: payload.name ?? null,
      pictureUrl: payload.picture ?? null,
    };
  }
}

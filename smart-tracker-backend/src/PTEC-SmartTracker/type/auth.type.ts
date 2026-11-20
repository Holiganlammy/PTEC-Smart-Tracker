import type { User } from '../model/user.model';

export interface AccessPayload {
  sub: string;
}

/** token ชุดที่ออกให้ผู้ใช้ */
export interface IssuedTokens {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface AuthedRequest {
  headers: Record<string, string | undefined>;
  lineUserId: string;
  currentUser: User | null;
}

export interface LineProfile {
  userId: string;
  displayName: string | null;
  pictureUrl: string | null;
}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { SmartTrackerModule } from './PTEC-SmartTracker/smart-tracker.module';

@Module({
  imports: [
    // .env.local มาก่อน .env (ค่าที่ซ้ำกันใช้ของไฟล์แรก)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    // rate limit ต่อ IP: ทุก endpoint 300 ครั้ง/นาที (ส่วน /auth/* เข้มกว่านั้น ดู auth.controller)
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    DatabaseModule,
    SmartTrackerModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

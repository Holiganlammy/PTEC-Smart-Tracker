import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { SmartTrackerModule } from './PTEC-SmartTracker/smart-tracker.module';

@Module({
  imports: [
    // .env.local มาก่อน .env (ค่าที่ซ้ำกันใช้ของไฟล์แรก)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    SmartTrackerModule,
  ],
})
export class AppModule {}

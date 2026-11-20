import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const isProduction = process.env.NODE_ENV === 'production';

  // อยู่หลัง proxy (Next rewrite / tunnel / load balancer) → ต้องบอกจำนวน hop ที่เชื่อถือได้
  // ไม่งั้น req.ip เป็นที่อยู่ของ proxy ทำให้ rate limit นับรวมทุกคนเป็นคนเดียว
  // ค่าเริ่มต้น 1 = Next proxy ตัวเดียว (ถ้ามี tunnel/LB อีกชั้นให้ตั้ง TRUST_PROXY=2)
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));

  // security headers (API ส่งแต่ JSON จึงใช้ค่าเริ่มต้นของ helmet ได้)
  app.use(helmet());

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // error ทุก API: log (พร้อม requestId) + ตอบ JSON รูปแบบเดียวกัน { success:false, message, requestId, ... }
  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS: production ต้องระบุ origin ชัดเจน (dev ไม่ตั้งก็เปิดกว้างได้)
  const origins = process.env.CORS_ORIGIN?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (isProduction && !origins?.length) {
    throw new Error('ต้องตั้ง CORS_ORIGIN เมื่อรันแบบ production');
  }
  if (!origins?.length) {
    new Logger('Bootstrap').warn(
      'ไม่ได้ตั้ง CORS_ORIGIN — เปิดรับทุก origin (ใช้ได้เฉพาะตอนพัฒนา)',
    );
  }
  app.enableCors({ origin: origins?.length ? origins : true });

  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();

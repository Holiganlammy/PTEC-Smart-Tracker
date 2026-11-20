import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

/** รูปแบบ error ที่ทุก API ตอบกลับ (เห็นใน Network ของเบราว์เซอร์) */
export interface ApiErrorBody {
  success: false;
  statusCode: number;
  /** ข้อความสำหรับแสดงผู้ใช้ (ValidationPipe อาจเป็น array) */
  message: string | string[];
  /** ชื่อชนิด error เช่น BadRequest, QueryFailedError */
  error: string;
  method: string;
  path: string;
  timestamp: string;
  /** รหัสอ้างอิง ใช้ค้นใน log ของ backend */
  requestId: string;
  /** รายละเอียดของ error ภายใน (เฉพาะตอนพัฒนา ไม่ส่งใน production) */
  detail?: string;
}

/** ข้อความภาษาไทยของ error ที่มาจาก library (เช่น multer) */
const STATUS_MESSAGE: Partial<Record<number, string>> = {
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'ไฟล์ใหญ่เกินกำหนด',
  [HttpStatus.TOO_MANY_REQUESTS]: 'ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่',
};

/**
 * ดัก error ของทุก API ที่เดียว (แทนการเขียน try/catch ในทุก endpoint)
 * - log: method + path + ผู้ใช้ + requestId (+ stack ถ้าเป็น error ภายใน 5xx)
 * - ตอบกลับ JSON รูปแบบเดียวกันทุก endpoint พร้อม requestId ไว้ค้น log
 * - error ภายใน: ตอนพัฒนาส่งข้อความจริงใน message/detail, production ส่งข้อความกลาง ๆ (กันข้อมูลระบบรั่ว)
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('API');
  private readonly isProduction = process.env.NODE_ENV === 'production';

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<
      Request & { currentUser?: { id?: string } | null }
    >();
    const res = ctx.getResponse<Response>();
    const requestId = randomUUID().slice(0, 8);

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const errorName =
      exception instanceof Error ? exception.constructor.name : 'UnknownError';
    const rawMessage =
      exception instanceof Error ? exception.message : String(exception);

    let message: string | string[];
    if (isHttp) {
      const body = exception.getResponse();
      const fromBody =
        typeof body === 'object' && body !== null && 'message' in body
          ? (body as { message: string | string[] }).message
          : typeof body === 'string'
            ? body
            : rawMessage;
      // ข้อความภาษาอังกฤษจาก library → ใช้ข้อความไทยแทน (ข้อความที่เราเขียนเองเป็นไทยอยู่แล้ว)
      message = STATUS_MESSAGE[status] ?? fromBody;
    } else {
      // แนบรหัสอ้างอิงท้ายข้อความ ผู้ใช้แจ้งรหัสนี้มา แล้วค้นใน log ของ backend ได้ทันที
      message = `${
        this.isProduction
          ? 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่หรือแจ้งผู้ดูแลระบบ'
          : `${errorName}: ${this.describe(exception)}`
      } (รหัสอ้างอิง ${requestId})`;
    }

    const who = req.currentUser?.id ? ` user=${req.currentUser.id}` : '';
    const line = `[${requestId}] ${req.method} ${req.originalUrl} → ${status}${who} ${errorName}: ${this.describe(exception)}`;
    if (status >= 500) {
      this.logger.error(
        line,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(line);
    }

    if (res.headersSent) return; // เริ่มส่งไฟล์ไปแล้ว ตอบซ้ำไม่ได้ (log ไว้แล้ว)

    const payload: ApiErrorBody = {
      success: false,
      statusCode: status,
      message,
      error: isHttp ? this.httpErrorName(status, errorName) : errorName,
      method: req.method,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
      requestId,
      ...(!this.isProduction && !isHttp
        ? { detail: this.describe(exception) }
        : {}),
    };
    res.status(status).json(payload);
  }

  /** ข้อความของ error (QueryFailedError แนบ SQL error จริงจาก driver) */
  private describe(exception: unknown): string {
    if (exception instanceof QueryFailedError) {
      const driver = (
        exception as QueryFailedError & {
          driverError?: { message?: string; number?: number };
        }
      ).driverError;
      const code = driver?.number ? ` (SQL ${driver.number})` : '';
      return `${driver?.message ?? exception.message}${code}`;
    }
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const msg =
        typeof body === 'object' && body !== null && 'message' in body
          ? body.message
          : body;
      return Array.isArray(msg) ? msg.join(', ') : String(msg);
    }
    return exception instanceof Error ? exception.message : String(exception);
  }

  private httpErrorName(status: number, fallback: string) {
    const name = HttpStatus[status] as string | undefined;
    return name
      ? name
          .toLowerCase()
          .split('_')
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join('')
      : fallback;
  }
}

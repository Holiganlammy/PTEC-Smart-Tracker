import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { Roles, RolesGuard } from '../guard/roles.guard';
import { RoleId } from '../model/role.model';
import {
  fileResponseHeaders,
  JobAttatchService,
  MAX_FILE_BYTES,
  MAX_FILES_PER_REQUEST,
} from '../service/job-attatch.service';
import { JobService } from '../service/job.service';
import type { AuthedRequest } from '../type/auth.type';
import type { UploadedFileLike } from '../type/job-attatch.type';

/** ไฟล์แนบ/รูปของงาน — /jobs/:id/attachments (สิทธิ์ตามขอบเขตงานเดียวกับ /jobs/:id) */
@Controller('jobs/:id/attachments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleId.CONTRACTOR, RoleId.HEAD, RoleId.SUB_CONTRACTOR, RoleId.ADMIN)
export class JobAttatchController {
  constructor(
    private readonly jobService: JobService,
    private readonly attatchService: JobAttatchService,
  ) {}

  /** GET /jobs/:id/attachments */
  @Get()
  async list(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    const user = req.currentUser!;
    const job = await this.jobService.findAccessible(user, String(id));
    return this.attatchService.list(user, job);
  }

  /** POST /jobs/:id/attachments  multipart: kind=accepted|progress|completed, files[] (jpg/png/webp) */
  @Roles(RoleId.CONTRACTOR, RoleId.HEAD, RoleId.SUB_CONTRACTOR)
  @Post()
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES_PER_REQUEST, {
      limits: { fileSize: MAX_FILE_BYTES },
    }),
  )
  async upload(
    @Param('id', ParseIntPipe) id: number,
    @Body('kind') kind: string,
    @UploadedFiles() files: UploadedFileLike[],
    @Req() req: AuthedRequest,
  ) {
    const user = req.currentUser!;
    const job = await this.jobService.findAccessible(user, String(id));
    return this.attatchService.upload(user, job, kind, files ?? []);
  }

  /** GET /jobs/:id/attachments/:attId/file — ตัวไฟล์ (ต้องแนบ Authorization เสมอ ไม่เปิดสาธารณะ) */
  @Get(':attId/file')
  async file(
    @Param('id', ParseIntPipe) id: number,
    @Param('attId', ParseIntPipe) attId: number,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = req.currentUser!;
    const job = await this.jobService.findAccessible(user, String(id));
    const { file, mime } = await this.attatchService.open(
      user,
      job,
      String(attId),
    );
    res.set(fileResponseHeaders(mime));
    return file;
  }

  /** DELETE /jobs/:id/attachments/:attId */
  @Roles(RoleId.CONTRACTOR, RoleId.HEAD, RoleId.SUB_CONTRACTOR)
  @Delete(':attId')
  @HttpCode(204)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Param('attId', ParseIntPipe) attId: number,
    @Req() req: AuthedRequest,
  ) {
    const user = req.currentUser!;
    const job = await this.jobService.findAccessible(user, String(id));
    await this.attatchService.remove(user, job, String(attId));
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { Roles, RolesGuard } from '../guard/roles.guard';
import { AssignJobDto } from '../dto/job-assign.dto';
import { ReturnJobDto, UpdateJobDto } from '../dto/job-review.dto';
import { ListJobsQuery } from '../dto/job-query.dto';
import { ChangeJobStatusDto } from '../dto/job-status.dto';
import { MAX_FILE_BYTES } from '../service/job-attatch.service';
import type { UploadedFileLike } from '../type/job-attatch.type';
import { RoleId } from '../model/role.model';
import { JobService } from '../service/job.service';
import type { AuthedRequest } from '../type/auth.type';

/** endpoint ทั้งหมดที่เกี่ยวกับงาน — /jobs/... */
@Controller('jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleId.CONTRACTOR, RoleId.HEAD, RoleId.SUB_CONTRACTOR, RoleId.ADMIN)
export class JobController {
  constructor(private readonly jobService: JobService) {}

  /** GET /jobs — งานของบริษัทผู้รับเหมาที่ผู้ใช้สังกัด */
  @Get()
  list(@Req() req: AuthedRequest, @Query() query: ListJobsQuery) {
    return this.jobService.listForUser(req.currentUser!, query);
  }

  /** GET /jobs/filters → { statuses, branches } ตัวเลือกของตัวกรอง */
  @Get('filters')
  filters(@Req() req: AuthedRequest, @Query('venderCode') venderCode?: string) {
    return this.jobService.getFilterOptions(req.currentUser!, venderCode);
  }

  /** PATCH /jobs/:id/assign  { assigneeId | null } — มอบหมายงานให้ผู้รับเหมาช่วง */
  @Roles(RoleId.CONTRACTOR, RoleId.HEAD)
  @Patch(':id/assign')
  assign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignJobDto,
    @Req() req: AuthedRequest,
  ) {
    return this.jobService.assign(
      req.currentUser!,
      String(id),
      dto.assigneeId ?? null,
    );
  }

  /**
   * POST /jobs/:id/status (multipart) — ผู้รับเหมาเปลี่ยนสถานะงาน พร้อมแนบรูป
   * action: accept | start | wait_parts | resume | deliver  (ดู ChangeJobStatusDto)
   * คืนรายละเอียดงานล่าสุด (รูปแบบเดียวกับ GET /jobs/:id)
   */
  @Roles(RoleId.CONTRACTOR, RoleId.HEAD, RoleId.SUB_CONTRACTOR)
  @Post(':id/status')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'files', maxCount: 10 },
        { name: 'beforeFiles', maxCount: 10 },
      ],
      { limits: { fileSize: MAX_FILE_BYTES } },
    ),
  )
  changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeJobStatusDto,
    @UploadedFiles()
    upload: { files?: UploadedFileLike[]; beforeFiles?: UploadedFileLike[] },
    @Req() req: AuthedRequest,
  ) {
    return this.jobService.changeStatus(
      req.currentUser!,
      String(id),
      dto,
      upload ?? {},
    );
  }

  // ───────── แอดมิน: คิวตรวจงานจาก OPS (เฉพาะ role admin) ─────────

  /** GET /jobs/review?q=&page= — งานที่รอแอดมินตรวจ */
  @Roles(RoleId.ADMIN)
  @Get('review')
  reviewList(@Query() query: ListJobsQuery) {
    return this.jobService.listPendingReview(query);
  }

  /** GET /jobs/types → [{ jobTypeId, name }] ประเภทงานของ OPS ที่ยังใช้งาน */
  @Roles(RoleId.ADMIN)
  @Get('types')
  jobTypes() {
    return this.jobService.listJobTypes();
  }

  /** GET /jobs/review/count → { pending } */
  @Roles(RoleId.ADMIN)
  @Get('review/count')
  reviewCount() {
    return this.jobService.countPendingReview();
  }

  /** PATCH /jobs/:id  { jobType, branchName, details, brand, model } — แก้ข้อมูลงานที่รอตรวจ */
  @Roles(RoleId.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateJobDto,
    @Req() req: AuthedRequest,
  ) {
    return this.jobService.updateDetails(String(id), req.currentUser!.id, dto);
  }

  /** PATCH /jobs/:id/approve — อนุมัติ → ส่งให้ผู้รับเหมา */
  @Roles(RoleId.ADMIN)
  @Patch(':id/approve')
  approve(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    return this.jobService.approve(String(id), req.currentUser!.id);
  }

  /** PATCH /jobs/:id/return  { note } — ตีกลับ */
  @Roles(RoleId.ADMIN)
  @Patch(':id/return')
  returnJob(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReturnJobDto,
    @Req() req: AuthedRequest,
  ) {
    return this.jobService.returnJob(String(id), req.currentUser!.id, dto.note);
  }

  /** GET /jobs/:id — รายละเอียดงาน (ต้องประกาศท้ายสุด ไม่ให้ชนกับ /jobs/review, /jobs/types ฯลฯ) */
  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    return this.jobService.getDetail(req.currentUser!, String(id));
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { Roles, RolesGuard } from '../guard/roles.guard';
import {
  ListJobMessagesQuery,
  SendJobMessageDto,
} from '../dto/job-message.dto';
import { RoleId } from '../model/role.model';
import { JobMessageService } from '../service/job-message.service';
import type { AuthedRequest } from '../type/auth.type';

/** แชทของงาน — /jobs/:id/messages (ขอบเขตการมองเห็นเดียวกับ /jobs/:id, สิทธิ์พิมพ์ตรวจใน service) */
@Controller('jobs/:id/messages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleId.CONTRACTOR, RoleId.HEAD, RoleId.SUB_CONTRACTOR, RoleId.ADMIN)
export class JobMessageController {
  constructor(private readonly messageService: JobMessageService) {}

  /** GET /jobs/:id/messages?after=<id> → { items, canPost, blockedReason } */
  @Get()
  list(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: ListJobMessagesQuery,
    @Req() req: AuthedRequest,
  ) {
    return this.messageService.list(req.currentUser!, String(id), query.after);
  }

  /** POST /jobs/:id/messages { body } → ข้อความที่เพิ่งส่ง (กันรัวเกินไป: 30 ข้อความ/นาที) */
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post()
  send(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendJobMessageDto,
    @Req() req: AuthedRequest,
  ) {
    return this.messageService.send(req.currentUser!, String(id), dto.body);
  }
}

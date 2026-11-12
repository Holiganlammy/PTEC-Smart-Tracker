import { Controller, Get } from '@nestjs/common';
import { VenderService } from '../service/vender.service';

@Controller('venders')
export class VenderController {
  constructor(private readonly venderService: VenderService) {}

  /** GET /venders — รายชื่อบริษัทสำหรับ dropdown หน้าลงทะเบียน (เรียกได้ก่อนล็อกอิน) */
  @Get()
  list() {
    return this.venderService.getVenders();
  }
}

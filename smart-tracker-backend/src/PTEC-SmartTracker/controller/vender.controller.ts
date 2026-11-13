import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { VenderService } from '../service/vender.service';

@Controller('venders')
export class VenderController {
  constructor(private readonly venderService: VenderService) {}

  /** GET /venders — รายชื่อบริษัทสำหรับ dropdown หน้าลงทะเบียน (ต้องล็อกอินก่อน) */
  @UseGuards(JwtAuthGuard)
  @Get()
  list() {
    return this.venderService.getVenders();
  }
}

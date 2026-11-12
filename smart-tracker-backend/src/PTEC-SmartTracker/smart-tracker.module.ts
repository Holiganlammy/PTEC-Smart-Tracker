import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './controller/user.controller';
import { VenderController } from './controller/vender.controller';
import { User } from './model/user.model';
import { LineAuthService } from './service/line-auth.service';
import { UserService } from './service/user.service';
import { VenderService } from './service/vender.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserController, VenderController],
  providers: [LineAuthService, UserService, VenderService],
})
export class SmartTrackerModule {}

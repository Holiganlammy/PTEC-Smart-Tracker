import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './controller/auth.controller';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { RolesGuard } from './guard/roles.guard';
import { AuthSession } from './model/auth-session.model';
import { AuthService } from './service/auth.service';
import { JobAttatchController } from './controller/job-attatch.controller';
import { JobController } from './controller/job.controller';
import { JobMessageController } from './controller/job-message.controller';
import { UserController } from './controller/user.controller';
import { VenderController } from './controller/vender.controller';
import { Job } from './model/job.model';
import { JobAttatch } from './model/job-attatch.model';
import { JobLog } from './model/job-log.model';
import { JobMessage } from './model/job-message.model';
import { JobStatus } from './model/job-status.model';
import { Role } from './model/role.model';
import { User } from './model/user.model';
import { JobAttatchService } from './service/job-attatch.service';
import { JobMessageService } from './service/job-message.service';
import { JobService } from './service/job.service';
import { LineAuthService } from './service/line-auth.service';
import { UserService } from './service/user.service';
import { VenderService } from './service/vender.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Role,
      AuthSession,
      Job,
      JobStatus,
      JobLog,
      JobAttatch,
      JobMessage,
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [
    AuthController,
    UserController,
    VenderController,
    JobController,
    JobAttatchController,
    JobMessageController,
  ],
  providers: [
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    LineAuthService,
    UserService,
    VenderService,
    JobService,
    JobAttatchService,
    JobMessageService,
  ],
})
export class SmartTrackerModule {}

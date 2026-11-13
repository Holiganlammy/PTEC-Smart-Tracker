import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './controller/auth.controller';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { RolesGuard } from './guard/roles.guard';
import { AuthSession } from './model/auth-session.model';
import { AuthService } from './service/auth.service';
import { UserController } from './controller/user.controller';
import { VenderController } from './controller/vender.controller';
import { Role } from './model/role.model';
import { User } from './model/user.model';
import { LineAuthService } from './service/line-auth.service';
import { UserService } from './service/user.service';
import { VenderService } from './service/vender.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, AuthSession]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController, UserController, VenderController],
  providers: [
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    LineAuthService,
    UserService,
    VenderService,
  ],
})
export class SmartTrackerModule {}

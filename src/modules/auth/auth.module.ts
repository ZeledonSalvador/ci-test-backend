import { forwardRef, Module } from '@nestjs/common';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './services/jwt.strategy';
import { AuthGuard } from './guards/auth.guard';
import { ConfigModule, ConfigService } from '@nestjs/config';
@Module({
  imports: [
    forwardRef(() => UsersModule),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: configService.get<string>('JWT_EXPIRATION') },
      }),
    }),
    UsersModule
  ],
  providers: [AuthService, JwtStrategy, AuthGuard],
  controllers: [AuthController],
  exports: [AuthGuard, JwtModule, AuthService, UsersModule],
})
export class AuthModule { }

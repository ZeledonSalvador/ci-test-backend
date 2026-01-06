import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InternalAuthController } from './controllers/internal-auth.controller';
import { InternalAuthService } from './services/internal-auth.service';
import { InternalAuthGuard } from './guards/internal-auth.guard';
import { InternalUsers } from 'src/models/InternalUsers';
import { Roles } from 'src/models/Roles';
import { Categories } from 'src/models/Categories';
import { Modules } from 'src/models/Modules';
import { Permissions } from 'src/models/Permissions';
import { UserWeighbridges } from 'src/models/UserWeighbridges';
import { SessionsLogs } from 'src/models/SessionsLogs';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InternalUsers,
      Roles,
      Categories,
      Modules,
      Permissions,
      UserWeighbridges,
      SessionsLogs,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '8h' },
      }),
    }),
    forwardRef(() => UsersModule),
  ],
  providers: [InternalAuthService, InternalAuthGuard],
  controllers: [InternalAuthController],
  exports: [InternalAuthService, InternalAuthGuard, JwtModule],
})
export class InternalAuthModule {}

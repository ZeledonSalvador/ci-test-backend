import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clients } from 'src/models/Clients';
import { MillsService } from './services/mills.service';
import { MillsController } from './controllers/mills.controller';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../auth/guards/auth.guard';
import { Users } from 'src/models/Users';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Clients, Users]),
    AuthModule,
    UsersModule,
  ],
  controllers: [MillsController],
  providers: [MillsService, AuthGuard],
  exports: [MillsService],
})
export class MillsModule {}

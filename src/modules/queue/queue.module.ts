import { Module } from '@nestjs/common';
import { QueueController } from './controllers/queue.controller';
import { QueueService } from './services/queue.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Queue } from 'src/models/Queue';
import { Shipments } from 'src/models/Shipments';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../auth/guards/auth.guard';
import { StatusModule } from '../status/status.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Queue, Shipments]),
    AuthModule,
    StatusModule
  ],
  controllers: [QueueController],
  providers: [QueueService, AuthGuard]
})
export class QueueModule { }

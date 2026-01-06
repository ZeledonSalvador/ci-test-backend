import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationTime } from './types/operation-time.entity';
import { OperationTimesService } from './services/operation-times.service';
import { OperationTimesController } from './controllers/operation-times.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([OperationTime]), AuthModule],
  controllers: [OperationTimesController],
  providers: [OperationTimesService],
})
export class OperationTimesModule {}

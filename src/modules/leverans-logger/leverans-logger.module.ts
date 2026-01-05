import { Module } from '@nestjs/common';
import { LeveransLoggerController } from './controllers/leverans-logger.controller';
import { LeveransLoggerService } from './services/leverans-logger.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ShipmentsModule } from '../shipments/shipments.module';
import { StatusModule } from '../status/status.module';
import { Status } from 'src/models/Status';
import { Shipments } from 'src/models/Shipments';
import { LeveransLogger } from 'src/models/LeveransLogger';
import { LeveransUserLoginHistory } from 'src/models/LeveransUserLoginHistory';
import { LeveransUsers } from 'src/models/LeveransUsers';
import { PredefinedStatuses } from 'src/models/PredefinedStatuses';

@Module({
  imports : [
    TypeOrmModule.forFeature([
      LeveransLogger,
      LeveransUserLoginHistory,
      LeveransUsers,
      Status,
      Shipments,
      PredefinedStatuses
    ]),
    AuthModule
  ],
  controllers: [LeveransLoggerController],
  providers: [LeveransLoggerService],
  exports : [LeveransLoggerService]
})
export class LeveransLoggerModule {}

import { forwardRef, Module } from '@nestjs/common';
import { StatusController } from './controllers/status.controller';
import { StatusService } from './services/status.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shipments } from 'src/models/Shipments';
import { Status } from 'src/models/Status';
import { PredefinedStatuses } from 'src/models/PredefinedStatuses';
import { AuthModule } from '../auth/auth.module';
import { StatusClientController } from './controllers/status-client.controller';
import { ShipmentsModule } from '../shipments/shipments.module';
import { HttpManager } from 'src/utils/HttpManager';
import { NavModule } from '../nav/nav.module';
import { PreTransactionsLeveransModule } from '../pre-transactions-leverans/pre-transactions-leverans.module';
import { LogsModule } from '../logs/logs.module';
import { TimeModule } from '../time/time.module';
import { ContingencyModule } from '../contingency/contingency.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PredefinedStatuses, Status, Shipments]),
    AuthModule,
    forwardRef(() => NavModule),
    PreTransactionsLeveransModule,
    forwardRef(() => ShipmentsModule),
    LogsModule,
    TimeModule,
    ContingencyModule
  ],
  controllers: [StatusController, StatusClientController],
  providers: [StatusService, HttpManager],
  exports: [StatusService]
})
export class StatusModule {}

import { Module } from '@nestjs/common';
import { LogsShipmentsController } from './controllers/logs-shipments.controller';
import { LogsShipmentsService } from './services/logs-shipments.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShipmentLogs } from 'src/models/ShipmentLogs';
import { LogMetadata } from 'src/models/LogMetadata';
import { Shipments } from 'src/models/Shipments';
import { LogsSystemService } from './services/logs-system.service';
import { SysLogs } from 'src/models/SysLogs';
import { TransactionLogEntity } from 'src/models/TransactionLogEntity';
import { TransactionLogsService } from './services/transaction-logs.service';
import { TransactionLogsController } from './controllers/transaction-logs.controller';
import { IngenioLogEntity } from 'src/models/IngenioLogEntity';
import { IngenioLogsController } from './controllers/ingenio-logs.controller';
import { IngenioLogsService } from './services/ingenio-logs.service';
import { AuthModule } from 'src/modules/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShipmentLogs,
      LogMetadata,
      Shipments,
      SysLogs,
      TransactionLogEntity,
      IngenioLogEntity,
    ]),
    AuthModule,
  ],
  controllers: [
    LogsShipmentsController,
    TransactionLogsController,
    IngenioLogsController,
  ],
  providers: [
    LogsShipmentsService,
    LogsSystemService,
    TransactionLogsService,
    IngenioLogsService,
  ],
  exports: [
    LogsShipmentsService,
    LogsSystemService,
    TransactionLogsService,
    IngenioLogsService,
  ],
})
export class LogsModule {}

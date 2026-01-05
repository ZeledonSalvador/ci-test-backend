import { forwardRef, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ShipmentsService } from './services/shipments.service';
import { ShippingController } from './controllers/shipments.controller';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthModule } from '../auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shipments } from 'src/models/Shipments';
import MassConverter from 'src/utils/massConverter.util';
import { StatusModule } from '../status/status.module';
import { ShippingClientController } from './controllers/shipments-client.controller';
import { ShipmentAttachments } from 'src/models/ShipmentAttachments';
import { ShipmentSeals } from 'src/models/ShipmentSeals';
import { Clients } from 'src/models/Clients';
import { Drivers } from 'src/models/Drivers';
import { NavModule } from '../nav/nav.module';
import { Vehicles } from 'src/models/Vehicles';
import { BlacklistModule } from '../blacklist/blacklist.module';
import { PreTransactionsLeveransModule } from '../pre-transactions-leverans/pre-transactions-leverans.module';
import { LogsModule } from '../logs/logs.module';
import { ShipmentsUpdateService } from './services/shipments-update.service';
import { ShipmentsQueryService } from './services/shipments-query.service';
import { ShipmentsQueryController } from './controllers/shipments-query.controller';
import { Status } from 'src/models/Status';
import { PredefinedStatuses } from 'src/models/PredefinedStatuses';
import { DataInconsistency } from 'src/models/DataInconsistency';
import { ShipmentTemperature } from 'src/models/ShipmentTemperature';
import { Brix } from 'src/models/Brix';
import { BlocksModule } from '../blocks/blocks.module';
import { OperationTime } from '../operation-times/types/operation-time.entity';
import { ShipmentWeight } from 'src/models/ShipmentWeight';
import { Comprobante } from 'src/models/Comprobante';
import { SerialComprobante } from 'src/models/SerialComprobante';
import { SealSeries } from 'src/models/SealSeries';
import { Marchamos } from 'src/models/Marchamos';
import { Locations } from 'src/models/Locations';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Drivers,
      Vehicles,
      Clients,
      Shipments,
      ShipmentAttachments,
      ShipmentSeals,
      Status,
      PredefinedStatuses,
      DataInconsistency,
      ShipmentTemperature,
      Brix,
      OperationTime,
      ShipmentWeight,
      SerialComprobante,
      SealSeries,
      Comprobante,
      Marchamos,
      Locations,
    ]),
    AuthModule,
    HttpModule,
    forwardRef(() => StatusModule),
    forwardRef(() => NavModule),
    forwardRef(() => PreTransactionsLeveransModule),
    LogsModule,
    BlacklistModule,
    BlocksModule,
  ],
  controllers: [ShippingController, ShippingClientController, ShipmentsQueryController],
  providers: [ShipmentsService, ShipmentsUpdateService, ShipmentsQueryService, AuthGuard, MassConverter],
  exports: [ShipmentsService, ShipmentsUpdateService, ShipmentsQueryService, TypeOrmModule, MassConverter]
})
export class ShipmentsModule {}

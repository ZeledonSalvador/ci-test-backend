import { Module } from '@nestjs/common';
import { InvalidatedShipmentsController } from './controllers/invalidated-shipments.controller';
import { InvalidatedShipmentsService } from './services/invalidated-shipments.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shipments } from 'src/models/Shipments';
import { Status } from 'src/models/Status';
import { InvalidatedShipments } from 'src/models/InvalidatedShipments';
import { StatusModule } from '../status/status.module';
import { AuthModule } from '../auth/auth.module';
import { ShipmentsModule } from '../shipments/shipments.module';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Shipments, Status, InvalidatedShipments]),
    StatusModule,
    AuthModule,
    ShipmentsModule,
    LogsModule
  ],
  controllers: [InvalidatedShipmentsController],
  providers: [InvalidatedShipmentsService]
})
export class InvalidatedShipmentsModule {}

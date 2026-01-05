import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ControlSystemController } from './controllers/control-system.controller';
import { ControlSystemService } from './services/control-system.service';
import { HttpManager } from 'src/utils/HttpManager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shipments } from 'src/models/Shipments';
import { InvalidatedShipments } from 'src/models/InvalidatedShipments';
import { Vehicles } from 'src/models/Vehicles';
import { AuthModule } from '../auth/auth.module';
import { DiscoveryModule } from '@nestjs/core';
@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([
      Shipments,
      InvalidatedShipments,
      Vehicles,
    ]),
    AuthModule,
    DiscoveryModule
  ],
  controllers: [ControlSystemController],
  providers: [
    ControlSystemService,
    HttpManager
  ],
})
export class ControlSystemModule { }

import { forwardRef, Module } from '@nestjs/common';
import { PreTransactionsLeveransController } from './controllers/pre-transactions-leverans.controller';
import { PreTransactionsLeveransService } from './services/pre-transactions-leverans.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shipments } from 'src/models/Shipments';
import { ShipmentsModule } from '../shipments/shipments.module';
import { HttpModule } from '@nestjs/axios';
import { HttpManager } from 'src/utils/HttpManager';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports : [
    TypeOrmModule.forFeature([Shipments]),
    forwardRef(() => ShipmentsModule),
    HttpModule,
    LogsModule
  ],
  controllers: [PreTransactionsLeveransController],
  providers: [PreTransactionsLeveransService, HttpManager],
  exports: [PreTransactionsLeveransService, HttpModule, HttpManager]
})
export class PreTransactionsLeveransModule {}

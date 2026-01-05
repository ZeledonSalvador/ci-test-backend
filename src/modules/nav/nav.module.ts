import { Module, forwardRef } from '@nestjs/common';
import { NavController } from './controllers/nav.controller';
import { NavService } from './services/nav.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shipments } from 'src/models/Shipments';
import { HttpManager } from 'src/utils/HttpManager';
import { HttpModule } from '@nestjs/axios';
import { LogsModule } from '../logs/logs.module';
import { StatusModule } from '../status/status.module';
import { AuthModule } from '../auth/auth.module';
import { PreTransactionsLeveransModule } from '../pre-transactions-leverans/pre-transactions-leverans.module';
import { ShipmentsModule } from 'src/modules/shipments/shipments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Shipments]),
    forwardRef(() => ShipmentsModule),            // 👈 solo así
    HttpModule,
    LogsModule,
    forwardRef(() => StatusModule),
    AuthModule,
    PreTransactionsLeveransModule,                // si aquí no hay ciclo, puede ir normal
    // ❌ ShipmentsModule (ELIMINADO, causaba el error en el índice 7)
  ],
  controllers: [NavController],
  providers: [NavService, HttpManager],
  exports: [NavService, HttpModule, HttpManager],
})
export class NavModule {}

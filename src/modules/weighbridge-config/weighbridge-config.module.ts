import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SerialComprobante } from 'src/models/SerialComprobante';
import { SealSeries } from 'src/models/SealSeries';
import { Marchamos } from 'src/models/Marchamos';
import { Comprobante } from 'src/models/Comprobante';
import { WeighbridgeConfigController } from './controllers/weighbridge-config.controller';
import { WeighbridgeConfigService } from './services/weighbridge-config.service';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../auth/guards/auth.guard';
import { Shipments } from 'src/models/Shipments';
import { Clients } from 'src/models/Clients';
import { EmailModule } from '../email/email.module';
import { ConfigModule as SystemConfigModule } from '../config/config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SerialComprobante,
      SealSeries,
      Marchamos,
      Comprobante,
      Shipments,
      Clients,
    ]),
    AuthModule,
    EmailModule,
    SystemConfigModule,
  ],
  controllers: [WeighbridgeConfigController],
  providers: [WeighbridgeConfigService, AuthGuard],
  exports: [WeighbridgeConfigService],
})
export class WeighbridgeConfigModule {}

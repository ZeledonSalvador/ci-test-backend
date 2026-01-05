import { Module } from '@nestjs/common';
import { BlacklistController } from './controllers/blacklist.controller';
import { MediaController } from './controllers/evidence.controller';
import { BlacklistService } from './services/blacklist.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../auth/guards/auth.guard';
import { Drivers } from 'src/models/Drivers';
import { BlacklistDrivers } from 'src/models/BlacklistDrivers';
import { Shipments } from 'src/models/Shipments';
import { ShipmentAttachments } from 'src/models/ShipmentAttachments';
import { Clients } from 'src/models/Clients';
import { BlacklistDriversHistory } from 'src/models/BlacklistDriversHistory';
import { GraphModule } from '../graph/graph.module';
import { OneDriveService } from './services/onedrive.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Drivers, 
      BlacklistDrivers,
      BlacklistDriversHistory, 
      Shipments, 
      ShipmentAttachments,
      Clients,
    ]),
    GraphModule,
    AuthModule,
  ],
  controllers: [BlacklistController, MediaController],
  providers: [BlacklistService, AuthGuard, OneDriveService],
  exports: [BlacklistService],
})
export class BlacklistModule { }
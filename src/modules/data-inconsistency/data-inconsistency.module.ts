import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataInconsistencyController } from './controllers/data-inconsistency.controller';
import { DataInconsistencyService } from './services/data-inconsistency.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthModule } from '../auth/auth.module';
import { DataInconsistency } from 'src/models/DataInconsistency';
import { Shipments } from 'src/models/Shipments';
import { Users } from 'src/models/Users';
import { ShipmentSeals } from 'src/models/ShipmentSeals';
import { Status } from 'src/models/Status';
import { PredefinedStatuses } from 'src/models/PredefinedStatuses';
import { LogsModule } from '../logs/logs.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            DataInconsistency, 
            Shipments, 
            Users, 
            ShipmentSeals,
            Status,
            PredefinedStatuses
        ]),
        AuthModule,
        LogsModule
    ],
    controllers: [DataInconsistencyController],
    providers: [DataInconsistencyService, AuthGuard],
    exports: [DataInconsistencyService, TypeOrmModule]
})
export class DataInconsistencyModule { }
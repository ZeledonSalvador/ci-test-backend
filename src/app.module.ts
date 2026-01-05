import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ShipmentsModule } from './modules/shipments/shipments.module';
import { StatusModule } from './modules/status/status.module';
import { BlacklistModule } from './modules/blacklist/blacklist.module';
import { Drivers } from './models/Drivers';
import { PredefinedStatuses } from './models/PredefinedStatuses';
import { Shipments } from './models/Shipments';
import { Status } from './models/Status';
import { MillsModule } from './modules/mills/mills.module';
import { Users } from './models/Users';
import { BotModule } from './modules/bot/bot.module';
import { ShipmentAttachments } from './models/ShipmentAttachments';
import { InvalidatedShipments } from './models/InvalidatedShipments';
import { InvalidatedShipmentsModule } from './modules/invalidated-shipments/invalidated-shipments.module';
import { ShipmentSeals } from './models/ShipmentSeals';
import { QueueModule } from './modules/queue/queue.module';
import { Queue } from './models/Queue';
import { NavModule } from './modules/nav/nav.module';
import { Clients } from './models/Clients';
import { ShipmentLogs } from './models/ShipmentLogs';
import { LogMetadata } from './models/LogMetadata';
import { Vehicles } from './models/Vehicles';
import { PreTransactionsLeveransModule } from './modules/pre-transactions-leverans/pre-transactions-leverans.module';
import { LogsModule } from './modules/logs/logs.module';
import { SysLogs } from './models/SysLogs';
import { BlacklistDrivers } from './models/BlacklistDrivers';
import { LeveransLogger } from './models/LeveransLogger';
import { LeveransUserLoginHistory } from './models/LeveransUserLoginHistory';
import { LeveransUsers } from './models/LeveransUsers';
import { TimeModule } from './modules/time/time.module';
import { ControlSystemModule } from './modules/control-system/control-system.module';
import { TransactionLogEntity } from './models/TransactionLogEntity';
import { DataInconsistency } from './models/DataInconsistency';
import { DataInconsistencyModule } from './modules/data-inconsistency/data-inconsistency.module';
import { OperationTime } from './modules/operation-times/types/operation-time.entity'; 
import { OperationTimesModule } from './modules/operation-times/operation-times.module';
import { ShipmentTemperature } from './models/ShipmentTemperature';
import { InternalAuthModule } from './modules/internal-auth/internal-auth.module';
import { Roles } from './models/Roles';
import { InternalUsers } from './models/InternalUsers';
import { Menu } from './models/Menu';
import { Permissions } from './models/Permissions';
import { Categories } from './models/Categories';
import { Modules } from './models/Modules';
import { UserWeighbridges } from './models/UserWeighbridges';
import { SessionsLogs } from './models/SessionsLogs';
import { Role } from './modules/auth/enums/roles.enum';
import { BlacklistDriversHistory } from './models/BlacklistDriversHistory';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { IngenioLogEntity } from './models/IngenioLogEntity';
import { Brix } from './models/Brix';
import { ProductIngenioBlock } from './models/ProductIngenioBlock';
import { EmailUsers } from './models/EmailUsers';
import { NotificationLogs } from './models/NotificationLogs';
import { EmailModule } from './modules/email/email.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { GraphModule } from './modules/graph/graph.module';
import { ContingencyTransactions } from './models/ContingencyTransactions';
import { ScheduleModule } from '@nestjs/schedule';
import { SerialComprobante } from './models/SerialComprobante';
import { SealSeries } from './models/SealSeries';
import { WeighbridgeConfigModule } from './modules/weighbridge-config/weighbridge-config.module';
import { Marchamos } from './models/Marchamos';
import { ShipmentWeight } from 'src/models/ShipmentWeight';
import { Comprobante } from './models/Comprobante';
import { Locations } from 'src/models/Locations';
import { SystemConfig } from './models/SystemConfig';
import { ConfigModule as SystemConfigModule } from './modules/config/config.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    
    TypeOrmModule.forRoot({
      type: process.env.DATABASE_TYPE as 'mssql',
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT, 10),
      username: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      entities: [
        Users,
        BlacklistDrivers,
        Drivers,
        PredefinedStatuses,
        Shipments,
        Status,
        Vehicles,
        Clients,
        ShipmentAttachments,
        InvalidatedShipments,
        ShipmentSeals,
        Queue,
        ShipmentLogs,
        LogMetadata,
        SysLogs,
        LeveransLogger,
        LeveransUserLoginHistory,
        LeveransUsers,
        TransactionLogEntity,
        DataInconsistency,
        OperationTime,
        ShipmentTemperature,
        InternalUsers,
        Roles,
        Categories,
        Modules,
        Menu,
        Permissions,
        UserWeighbridges,
        SessionsLogs,
        BlacklistDriversHistory,
        IngenioLogEntity,
        Brix,
        ProductIngenioBlock,
        EmailUsers,
        NotificationLogs,
        SerialComprobante,
        SealSeries,
        NotificationLogs,
        ContingencyTransactions,
        Marchamos,
        ShipmentWeight,
        Comprobante,
        Locations,
        SystemConfig,
      ],
      options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 15000, // 15 segundos de timeout para conexión
      },
      extra: {
        connectionLimit: 20,
        max: 20, // Máximo de conexiones en el pool
        min: 1,  // Mínimo de conexiones en el pool
        idleTimeoutMillis: 30000, // Tiempo antes de cerrar conexiones idle
      },
      synchronize: false,
      logging: false,
      autoLoadEntities: false,
    }),
    
    // EventEmitter debe ir antes de NotificationsModule
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 10,
      verboseMemoryLeak: true,
    }),
    ScheduleModule.forRoot(), // 👈 Necesario para habilitar los @Cron()

    // NotificationsModule debe ir ANTES de los módulos que lo usan
    NotificationsModule,
    // Módulos existentes
    AuthModule,
    UsersModule,
    StatusModule,
    BlacklistModule,
    ShipmentsModule,
    MillsModule,
    BotModule,
    InvalidatedShipmentsModule,
    QueueModule,
    NavModule,
    LogsModule,
    PreTransactionsLeveransModule,
    TimeModule,
    ControlSystemModule,
    DataInconsistencyModule,
    OperationTimesModule,
    InternalAuthModule,
    DashboardModule,
    GraphModule,
    EmailModule,
    SystemConfigModule,
    WeighbridgeConfigModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
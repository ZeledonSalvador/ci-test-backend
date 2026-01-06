import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './controllers/users.controller';
import { UsersService } from './services/users.service';
import { Users } from 'src/models/Users';
import { AuthModule } from '../auth/auth.module';
import { Shipments } from 'src/models/Shipments';
import { Clients } from 'src/models/Clients';
import { InvalidatedShipmentsModule } from '../invalidated-shipments/invalidated-shipments.module'; // Agregar esta importación
import { InvalidatedShipments } from 'src/models/InvalidatedShipments';

@Module({
  imports: [
    TypeOrmModule.forFeature([Users, Shipments, Clients, InvalidatedShipments]),
    forwardRef(() => AuthModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailController } from './controllers/email.controller';
import { EmailService } from './services/email.service';
import { EmailUsers } from '../../models/EmailUsers';
import { Shipments } from '../../models/Shipments';
import { Clients } from '../../models/Clients';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthModule } from '../auth/auth.module';
import { EmailNotificationListener } from './listeners/email-notification.listener'
import { GraphModule } from '../graph/graph.module';

@Module({
  imports: [TypeOrmModule.forFeature([EmailUsers, Shipments, Clients]), AuthModule, GraphModule],
  controllers: [EmailController],
  providers: [EmailService, AuthGuard, EmailNotificationListener],
  exports: [EmailService], // Esto permite que otros módulos usen EmailService
})
export class EmailModule {}
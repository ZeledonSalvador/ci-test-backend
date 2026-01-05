import { Module } from '@nestjs/common';
import { BotService } from './services/bot.service';
import { BotController } from './controllers/bot.controller';
import { AuthModule } from '../auth/auth.module'; // Asegúrate de que la ruta sea correcta
import { AuthGuard } from '../auth/guards/auth.guard';
import { UsersService } from '../users/services/users.service';
import { UsersModule } from '../users/users.module';



@Module({
  imports: [
    UsersModule,
    AuthModule
  ],
  controllers: [BotController],
  providers: [BotService, AuthGuard],
  exports: [BotService],
})
export class BotModule { }

// src/modules/dashboard/dashboard.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AuthModule } from 'src/modules/auth/auth.module';

@Module({
  imports: [
    forwardRef(() => AuthModule), // ⬅️ trae JwtService y el AuthGuard desde AuthModule
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule { }

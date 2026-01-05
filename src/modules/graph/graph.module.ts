import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphAuthService } from './services/graph-auth.service';
import { GraphController } from './controllers/graph.controller';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [GraphController],
  providers: [GraphAuthService,AuthGuard],
  exports: [GraphAuthService],
})
export class GraphModule {}
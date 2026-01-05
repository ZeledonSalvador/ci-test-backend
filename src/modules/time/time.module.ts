import { Module } from '@nestjs/common';
import { TimeController } from './controllers/time.controller';
import { TimeService } from './services/time.service';

@Module({
  controllers: [TimeController],
  providers: [TimeService],
  exports : [TimeService]
})
export class TimeModule {}


// 232401 ARRIBO 
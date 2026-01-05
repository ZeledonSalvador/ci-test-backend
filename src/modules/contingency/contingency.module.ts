import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContingencyService } from './contingency.service';
import { ContingencyTransactions } from 'src/models/ContingencyTransactions';
import { Shipments } from 'src/models/Shipments';

@Module({
  imports: [TypeOrmModule.forFeature([ContingencyTransactions, Shipments])],
  providers: [ContingencyService],
  exports: [ContingencyService],
})
export class ContingencyModule {}

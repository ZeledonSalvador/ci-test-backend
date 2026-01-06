import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OperationTime } from '../types/operation-time.entity';
import { CreateOperationTimeDto } from '../dto/create-operation-time.dto';

@Injectable()
export class OperationTimesService {
  constructor(
    @InjectRepository(OperationTime)
    private readonly repo: Repository<OperationTime>,
  ) {}

  async create(dto: CreateOperationTimeDto): Promise<OperationTime> {
    const newRecord = this.repo.create(dto);
    return await this.repo.save(newRecord);
  }

  async findAll(): Promise<OperationTime[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }
}

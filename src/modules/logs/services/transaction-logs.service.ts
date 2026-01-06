import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionLogEntity } from 'src/models/TransactionLogEntity';
import { Between } from 'typeorm';

@Injectable()
export class TransactionLogsService {
  constructor(
    @InjectRepository(TransactionLogEntity)
    private readonly logRepo: Repository<TransactionLogEntity>,
  ) {}

  async createLog(data: Partial<TransactionLogEntity>) {
    const log = this.logRepo.create({
      ...data,
      json_enviado:
        typeof data.json_enviado === 'object'
          ? JSON.stringify(data.json_enviado)
          : data.json_enviado,
      json_modificacion:
        typeof data.json_modificacion === 'object'
          ? JSON.stringify(data.json_modificacion)
          : data.json_modificacion,
    });

    return await this.logRepo.save(log);
  }

  async getLogsByCodeGen(codeGen: string) {
    return await this.logRepo.find({
      where: { code_gen: codeGen },
      order: { fecha_creacion: 'DESC' },
    });
  }
  async getLogsByDateRange(fechaInicio: string, fechaFin: string) {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
      throw new Error('Las fechas proporcionadas no son válidas');
    }

    return await this.logRepo.find({
      where: {
        fecha_creacion: Between(inicio, fin),
      },
      order: { fecha_creacion: 'DESC' },
    });
  }
}

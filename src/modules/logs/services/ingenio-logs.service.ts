// src/modules/logs/services/ingenio-logs.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { IngenioLogEntity } from 'src/models/IngenioLogEntity';

@Injectable()
export class IngenioLogsService {
  constructor(
    @InjectRepository(IngenioLogEntity)
    private readonly logRepo: Repository<IngenioLogEntity>,
  ) {}

  async createLog(data: Partial<IngenioLogEntity>) {
    const log = this.logRepo.create({
      ...data,
      jsonEnviado:
        typeof data.jsonEnviado === 'object'
          ? JSON.stringify(data.jsonEnviado)
          : data.jsonEnviado,
      jsonModificacion:
        typeof data.jsonModificacion === 'object'
          ? JSON.stringify(data.jsonModificacion)
          : data.jsonModificacion,
    });

    return await this.logRepo.save(log);
  }

  async getLogsByCodeGen(codeGen: string) {
    return await this.logRepo.find({
      where: { codigoGeneracion: codeGen },
      order: { fechaCreacion: 'DESC' },
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
        fechaCreacion: Between(inicio, fin),
      },
      order: { fechaCreacion: 'DESC' },
    });
  }

  async getLogsByUsuario(usuario: string) {
    return await this.logRepo.find({
      where: { usuario },
      order: { fechaCreacion: 'DESC' },
    });
  }

  async getLogsByEstatus(estatus: string) {
    return await this.logRepo.find({
      where: { estatus },
      order: { fechaCreacion: 'DESC' },
    });
  }

  async updateLogEstatus(
    id: number,
    estatus: string,
    motivoInvalidacion?: string,
  ) {
    const updateData: any = { estatus };
    if (motivoInvalidacion) {
      updateData.motivoInvalidacion = motivoInvalidacion;
    }

    await this.logRepo.update(id, updateData);
    return await this.logRepo.findOne({ where: { id } });
  }

  async getAllLogs(page: number = 1, limit: number = 50) {
    const [logs, total] = await this.logRepo.findAndCount({
      order: { fechaCreacion: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: logs,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  // Método helper para logging de errores específicos de ingenios
  async logIngenioError(
    codeGen: string,
    usuario: string,
    estatus: string,
    errorMessage: string,
    requestData?: any,
  ): Promise<void> {
    try {
      await this.createLog({
        codigoGeneracion: codeGen,
        jsonEnviado: JSON.stringify(
          requestData || { error: 'Error en operación de ingenio' },
        ),
        usuario: usuario,
        estatus: estatus,
        motivoInvalidacion: errorMessage,
      });
    } catch (logError) {
      console.error(`Failed to log ingenio error: ${logError.message}`);
    }
  }

  // Método helper para logging de éxitos específicos de ingenios
  async logIngenioSuccess(
    codeGen: string,
    usuario: string,
    estatus: string,
    operationType: string,
    requestData?: any,
    responseData?: any,
  ): Promise<void> {
    try {
      await this.createLog({
        codigoGeneracion: codeGen,
        jsonEnviado: JSON.stringify(requestData || {}),
        usuario: usuario,
        estatus: estatus,
        jsonModificacion: JSON.stringify({
          action: operationType,
          success: true,
          timestamp: new Date().toISOString(),
          responseData: responseData || null,
        }),
      });
    } catch (logError) {
      console.error(`Failed to log ingenio success: ${logError.message}`);
    }
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LogMetadata } from 'src/models/LogMetadata';
import { ShipmentLogs } from 'src/models/ShipmentLogs';
import { Shipments } from 'src/models/Shipments';
import { Repository } from 'typeorm';
import { TypeLogsShipments } from '../enums/typesShipmentsLogs.enum';

@Injectable()
export class LogsShipmentsService {
  constructor(
    @InjectRepository(ShipmentLogs)
    private readonly shipmentLogs: Repository<ShipmentLogs>,
    @InjectRepository(LogMetadata)
    private readonly logMetadata: Repository<LogMetadata>,
    @InjectRepository(Shipments)
    private readonly shipmentRepository: Repository<Shipments>,
  ) {}

  /**
   * Agregar un log genérico o específico a un envío.
   */
  async addLog(
    codeGen: string,
    type: TypeLogsShipments,
    description: string,
    metadata?: Record<string, any>,
  ): Promise<ShipmentLogs> {
    const shipment = await this.shipmentRepository.findOne({
      where: { codeGen },
    });
    if (!shipment) {
      throw new NotFoundException(
        `Shipment con codeGen ${codeGen} no encontrado.`,
      );
    }

    // Validar metadatos según el tipo
    /*  if (type === TypeLogsShipments.ESTATUS && !metadata?.status) {
             throw new Error(`El log de tipo ESTATUS requiere el campo 'status'.`);
         }
         if (type === TypeLogsShipments.SUGAR_TIMES && !metadata?.time) {
             throw new Error(`El log de tipo SUGAR_TIMES requiere el campo 'time'.`);
         }
  */
    // Crear log principal
    const log = this.shipmentLogs.create({
      shipment,
      logType: type,
      logText: description, //esto de description puede ir el id del status tambien
    });

    const savedLog = await this.shipmentLogs.save(log);

    console.log('Estos son los metadata: ', metadata);
    if (metadata && Object.keys(metadata).length > 0) {
      await this.addMetadataToLog(savedLog.id, metadata);
    }

    return savedLog;
  }

  /**
   * Agregar metadatos a un log existente.
   */
  async addMetadataToLog(
    logId: number,
    metadata: Record<string, any>,
  ): Promise<LogMetadata[]> {
    const log = await this.shipmentLogs.findOne({ where: { id: logId } });
    if (!log) {
      throw new NotFoundException(`Log con ID ${logId} no encontrado.`);
    }

    const metadataEntries = Object.entries(metadata).map(([key, value]) =>
      this.logMetadata.create({
        log,
        metadataKey: key,
        metadataValue: value.toString(),
      }),
    );

    return this.logMetadata.save(metadataEntries);
  }

  /**
   * Método auxiliar para transformar los metadatos en objetos key-value.
   */
  private transformLogMetadataToKeyValue(
    logs: ShipmentLogs[],
  ): Record<string, string>[] {
    return logs.map((log) =>
      Object.fromEntries(
        log.logMetadata.map((metadata) => [
          metadata.metadataKey,
          metadata.metadataValue,
        ]),
      ),
    );
  }

  /**
   * Obtener logs generales o específicos por tipo.
   */
  async getLogsByCodeGenAndType(
    codeGen: string,
    type?: TypeLogsShipments,
  ): Promise<ShipmentLogs[]> {
    // Buscamos el 'shipment' usando 'codeGen' y cargamos los 'shipmentLogs' y 'logMetadata' con 'relations'
    const shipment = await this.shipmentRepository.findOne({
      where: { codeGen },
      relations: ['shipmentLogs', 'shipmentLogs.logMetadata'], // Incluimos las relaciones con los logs y los metadatos
    });

    if (!shipment) {
      throw new NotFoundException(
        `Shipment con codeGen ${codeGen} no encontrado.`,
      );
    }

    // Filtramos los logs por el 'type' si se proporciona
    const filteredLogs = shipment.shipmentLogs.filter((log) => {
      return type ? log.logType === type : true;
    });

    return filteredLogs;
  }

  /**
   * Obtiene un array de los valores de los metadatos de logs de tipo ESTATUS.
   */
  async getStatusLogs(
    codeGen: string,
    statusId?: number,
  ): Promise<Record<string, string>[]> {
    const logs = await this.getLogsByCodeGenAndType(
      codeGen,
      TypeLogsShipments.ESTATUS,
    );

    // Si se proporciona un statusId, filtrar los logs
    const filteredLogs = statusId
      ? logs.filter((log) => log.logText === statusId.toString())
      : logs;

    return this.transformLogMetadataToKeyValue(filteredLogs);
  }

  /**
   * Obtiene un array de los valores de los metadatos de logs de tipo SUGAR_TIMES.
   */
  async getSugarTimesLogs(codeGen: string): Promise<Record<string, string>[]> {
    const logs = await this.getLogsByCodeGenAndType(
      codeGen,
      TypeLogsShipments.SUGAR_TIMES,
    );
    return this.transformLogMetadataToKeyValue(logs);
  }

  /**
   * Obtiene un array de los valores de los metadatos de logs de tipo REQUIRE_SWEEPING.
   */
  async getSweepingLogs(codeGen: string): Promise<Record<string, string>[]> {
    const logs = await this.getLogsByCodeGenAndType(
      codeGen,
      TypeLogsShipments.REQUIRE_SWEEPING,
    );
    return this.transformLogMetadataToKeyValue(logs);
  }

  /**
   * Obtiene un array de los valores de los metadatos de logs de tipo OTRO.
   */
  async getGeneralLogs(codeGen: string): Promise<Record<string, string>[]> {
    const logs = await this.getLogsByCodeGenAndType(
      codeGen,
      TypeLogsShipments.OTRO,
    );
    return this.transformLogMetadataToKeyValue(logs);
  }

  /**
   * Setear un log de status.
   */
  async setStatusLog(
    codeGen: string,
    statusId: number,
    observations: string,
  ): Promise<ShipmentLogs> {
    const metadata = { observations };
    return this.addLog(
      codeGen,
      TypeLogsShipments.ESTATUS,
      statusId.toString(),
      metadata,
    );
  }

  /**
   * Setear un log de tiempos de azúcar.
   */
  async setSugarTimesLog(
    codeGen: string,
    time: string,
    observation: string,
  ): Promise<ShipmentLogs> {
    const metadata = { time, observation };
    return this.addLog(codeGen, TypeLogsShipments.SUGAR_TIMES, time, metadata);
  }

  /**
   * Setear un log de requiere barrido.
   */
  async setSweepingLog(
    codeGen: string,
    requiresSweeping: boolean,
    observations: string,
  ): Promise<ShipmentLogs> {
    const metadata = { requiresSweeping, observations };
    return this.addLog(
      codeGen,
      TypeLogsShipments.REQUIRE_SWEEPING,
      `Barrido: ${requiresSweeping}`,
      metadata,
    );
  }

  /**
   * Setear un log general (tipo OTRO).
   */
  async setGeneralLog(
    codeGen: string,
    description: string,
  ): Promise<ShipmentLogs> {
    return this.addLog(codeGen, TypeLogsShipments.OTRO, description);
  }
}

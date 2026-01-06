import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isNumber } from 'class-validator';
import * as moment from 'moment-timezone';
import axios from 'axios';
import { PredefinedStatuses } from 'src/models/PredefinedStatuses';
import { Shipments } from 'src/models/Shipments';
import { Status } from 'src/models/Status';
import { LogSysType } from 'src/modules/logs/enums/typeSysLogs.enum';
import { LogsShipmentsService } from 'src/modules/logs/services/logs-shipments.service';
import { LogsSystemService } from 'src/modules/logs/services/logs-system.service';
import { NavService } from 'src/modules/nav/services/nav.service';
import { PreTransactionsLeveransService } from 'src/modules/pre-transactions-leverans/services/pre-transactions-leverans.service';
import { AttachmentType } from 'src/modules/shipments/enums/typeFileUpload.enum';
import { ShipmentsService } from 'src/modules/shipments/services/shipments.service';
import { TimeService } from 'src/modules/time/services/time.service';
import { Repository } from 'typeorm';
import { ContingencyService } from 'src/modules/contingency/contingency.service';

@Injectable()
export class StatusService {
  constructor(
    @InjectRepository(Status)
    private readonly statusRepository: Repository<Status>,

    @InjectRepository(Shipments)
    private readonly shipmentRepository: Repository<Shipments>,

    @InjectRepository(PredefinedStatuses)
    private readonly predefinedStatusRepository: Repository<PredefinedStatuses>,

    @Inject(forwardRef(() => NavService))
    private readonly navService: NavService,

    private readonly preTransactionsLeveransService: PreTransactionsLeveransService,

    @Inject(forwardRef(() => ShipmentsService))
    private readonly shipmentsService: ShipmentsService,

    private readonly logsShipmentsService: LogsShipmentsService,

    private readonly logsSystemService: LogsSystemService,

    private readonly timeService: TimeService,
    private readonly contingencyService: ContingencyService,
  ) {}

  // HELPER
  private formatAxiosError(error: any): string {
    // Si viene de Axios, enriquecemos el mensaje
    const isAxiosError = !!error?.isAxiosError;

    if (isAxiosError) {
      const status = error?.response?.status;
      const statusText = error?.response?.statusText;
      const data = error?.response?.data;

      const parts: string[] = [];

      // Mensaje base
      parts.push(error.message || 'Axios error');

      // Status HTTP
      if (status) {
        parts.push(`status=${status}${statusText ? ' ' + statusText : ''}`);
      }

      // Cuerpo de la respuesta
      if (data !== undefined) {
        let body: string;
        if (typeof data === 'string') {
          body = data;
        } else {
          try {
            body = JSON.stringify(data);
          } catch {
            body = String(data);
          }
        }

        // Para no inundar logs, recortamos si es muy largo
        if (body.length > 500) {
          body = body.slice(0, 500) + '...';
        }

        parts.push(`body=${body}`);
      }

      return parts.join(' | ');
    }

    // Si no es AxiosError, devolvemos lo que haya
    return error?.message || String(error);
  }

  async addStatusByCodeGen(
    codeGen: string,
    predefinedStatusId: number,
    observation?: string,
    leveransUsername?: string,
  ): Promise<Status> {
    console.log(
      `[DEBUG] Iniciando addStatusByCodeGen para ${codeGen} con predefinedStatusId: ${predefinedStatusId}`,
    );

    const shipment = await this.shipmentRepository.findOne({
      where: { codeGen },
    });
    if (!shipment) {
      throw new NotFoundException(`Envío con código ${codeGen} no encontrado.`);
    }

    const predefinedStatus = await this.predefinedStatusRepository.findOne({
      where: { id: predefinedStatusId },
    });
    if (!predefinedStatus) {
      throw new NotFoundException(
        `Estado predefinido con ID ${predefinedStatusId} no encontrado.`,
      );
    }

    try {
      /* 
                Obtener el último estado creado cronológicamente
                para validar si el estado que se está tratando de insertar
                es el siguiente esperado o no.
            */
      const lastStatus = await this.statusRepository.findOne({
        where: { shipment },
        relations: ['predefinedStatus'],
        order: { createdAt: 'DESC' },
      });

      console.log(
        `[DEBUG] Último estado para ${codeGen}: ${lastStatus ? `ID: ${lastStatus.predefinedStatus.id}, Creado: ${lastStatus.createdAt}` : 'ninguno'}`,
      );

      if (lastStatus) {
        const expectedNextId = lastStatus.predefinedStatus.id + 1;
        console.log(
          `[DEBUG] Último estado: ${lastStatus.predefinedStatus.id}, Esperado siguiente: ${expectedNextId}, Intentando insertar: ${predefinedStatusId}`,
        );

        if (predefinedStatusId !== expectedNextId) {
          /* 
                        Estados especiales que pueden ser insertados fuera de secuencia.
                        Si el estado es 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 o 15,
                        el estado puede haber sido activado en NAV pero aún no en la API interna
                        
                        Esta validación se permite porque puede ser que en NAV se controlen
                        de una manera diferente en función del tiempo que la API del shipment
                        aunque deberían coincidir, pero por si acaso...
                    */
          if (
            ![3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].includes(
              predefinedStatusId,
            )
          ) {
            console.error(
              `[ERROR] Estado ${predefinedStatusId} no permitido después del estado ${lastStatus.predefinedStatus.id}`,
            );
            throw new BadRequestException(
              `No se puede insertar el estado con ID ${predefinedStatusId}. El siguiente estado debe ser ${expectedNextId}.`,
            );
          } else {
            console.log(
              `[WARNING] Estado especial ${predefinedStatusId} detectado, permitiendo inserción fuera de secuencia`,
            );

            await this.logsSystemService.createLog(
              LogSysType.NAV_STATUS_ACTIVATED_BUT_NOT_IN_SHIPMENT_API,
              `El estado ${predefinedStatusId} fue activado en NAV, pero aún no ha llegado al Shipment en la API interna.`,
            );

            if (lastStatus.predefinedStatus.id === predefinedStatusId) {
              /* 
                                Significa que está tratando de insertar nuevamente el mismo ID
                                cosa que no debería suceder
                            */
              console.error(`[ERROR] Estado ${predefinedStatusId} ya existe`);
              throw new BadRequestException(
                `El estado ${predefinedStatusId} ya fue registrado.`,
              );
            }
          }
        } else {
          console.log(
            `[SUCCESS] Estado ${predefinedStatusId} es el siguiente esperado después de ${lastStatus.predefinedStatus.id}`,
          );
        }
      } else {
        if (predefinedStatusId !== 1) {
          console.error(
            `[ERROR] Primer estado debe ser 1, se recibió ${predefinedStatusId}`,
          );
          throw new BadRequestException(
            `El primer estado debe ser 1, pero se recibió ${predefinedStatusId}.`,
          );
        }
        console.log(`[SUCCESS] Primer estado válido: ${predefinedStatusId}`);
      }

      if (predefinedStatusId === 2) {
        /* 
                    Esto significa que se está prechequeando por lo tanto
                    se tiene que setear la fecha de prechequeo en 
                    la tabla shipments
                */
        await this.shipmentRepository.update(
          { codeGen: shipment.codeGen },
          { dateTimePrecheckeo: this.timeService.getCurrentDate() },
        );
        console.log(`[INFO] Fecha de prechequeo actualizada para ${codeGen}`);
      }

      if (predefinedStatusId === 3) {
        /* 
                    Esto significa que el status está
                    cambiado a transacción autorizada
                    justamente acá es donde se tiene
                    que guardar el registro en NAV
                */
        if (shipment.magneticCard === null) {
          throw new ConflictException(
            'Para cambiar el estado a transacción autorizada se debe definir la tarjeta magnética antes.',
          );
        }

        const attachments = await this.shipmentsService.getAttachmentsByCodeGen(
          codeGen,
          AttachmentType.PRECHECK_DRIVER,
        );

        /* 
                    Para prechequearse ahora es necesario una foto
                    del motorista ya seteada para
                    poderla guardar en NAV
                */
        if (!attachments || attachments.length === 0) {
          throw new BadRequestException(
            'No se puede autorizar un envío si no tiene una foto del motorista prechequedo.',
          );
        }

        /* 
                    Este proceso puede tardar bastante tiempo
                    Se maneja con timeout y retry para mejorar la robustez
                    Se ejecuta en paralelo para optimizar el rendimiento
                */
        try {
          console.log(`[INFO] Enviando datos a NAV y Leverans para ${codeGen}`);

          const navPromise = this.navService
            .push(shipment.codeGen)
            .catch((error) => {
              console.error(
                `[ERROR] Fallo la conexión con NAV para ${codeGen}:`,
                error.message,
              );
              throw new ConflictException(
                `Error al conectar con el sistema NAV: ${error.message}`,
              );
            });

          const leveransPromise = this.preTransactionsLeveransService
            .push(shipment.codeGen)
            .catch((error) => {
              console.error(
                `[ERROR] Fallo la conexión con Leverans para ${codeGen}:`,
                error.message,
              );
              throw new ConflictException(
                `Error al conectar con el sistema Leverans: ${error.message}`,
              );
            });

          await Promise.all([navPromise, leveransPromise]);
          console.log(
            `[SUCCESS] Datos enviados exitosamente a NAV y Leverans para ${codeGen}`,
          );
        } catch (error) {
          console.error(
            `[ERROR] Error de conectividad con sistemas externos:`,
            error,
          );
          throw new ConflictException(
            `No se pudo completar la autorización debido a problemas de conectividad: ${error.message}`,
          );
        }
      }

      if (predefinedStatusId === 4) {
        const saveUpdateToTwoLeverans: boolean =
          await this.preTransactionsLeveransService.updateStatusLeveransRecord(
            shipment.codeGen,
            3,
          );

        if (!saveUpdateToTwoLeverans) {
          /* 
                        Esto significa que hubo un error al guardar, así que
                        no se puede seguir porque pues no va a abrir las básculas
                        así que no se puede continuar
                    */
          throw new ConflictException(
            'Ocurrió un error al tratar de actualizar el estado de Leverans a 3 ' +
              'para abrir básculas, el proceso no puede continuar.',
          );
        }
        console.log(
          `[SUCCESS] Estado de Leverans actualizado a 3 para ${codeGen}`,
        );
      }

      if (predefinedStatusId === 5) {
        /* 
                    Esto significa que se está actualizando 
                    el status hacia status 5 que es la autorización
                    del camión al portón 4 por lo tanto se tiene
                    que actualizar el status del record de Leverans
                    a 4 para autorizar hacia las básculas
                */
        const saveUpdateToThreeLeverans: boolean =
          await this.preTransactionsLeveransService.updateStatusLeveransRecord(
            shipment.codeGen,
            4,
          );

        if (!saveUpdateToThreeLeverans) {
          /* 
                        Esto significa que hubo un error al guardar, así que
                        no se puede seguir porque pues no va a abrir las básculas
                        así que no se puede continuar
                    */
          throw new ConflictException(
            'Ocurrió un error al tratar de actualizar el estado de Leverans a 4 ' +
              'para abrir básculas, el proceso no puede continuar.',
          );
        }
        console.log(
          `[SUCCESS] Estado de Leverans actualizado a 4 para ${codeGen}`,
        );
      }

      if (predefinedStatusId === 12) {
        // Disparamos el envío a Excalibur en background, sin bloquear la respuesta del endpoint
        this.sendReceiptToExcalibur(codeGen, predefinedStatusId).catch(
          (err) => {
            // Por seguridad extra, por si algo se escapa del try/catch interno del método
            console.error(
              '[MW ERROR] sendReceiptToExcalibur (unhandled):',
              err?.message || err,
            );
          },
        );
      }

      /* 
                Por cada cambio de status, los campos current_status y 
                date_current_status deben actualizarse en la tabla shipments
            */
      await this.shipmentRepository.update(
        { codeGen: shipment.codeGen },
        {
          currentStatus: predefinedStatusId,
          dateTimeCurrentStatus: this.timeService.getCurrentDate(),
        },
      );

      if (observation) {
        this.logsShipmentsService.setStatusLog(
          shipment.codeGen,
          predefinedStatusId,
          observation,
        );
      }

      const status = this.statusRepository.create({
        shipment,
        predefinedStatus,
      });

      const savedStatus = await this.statusRepository.save(status);
      console.log(
        `[SUCCESS] Estado ${predefinedStatusId} guardado exitosamente para ${codeGen}`,
      );
      return savedStatus;
    } catch (error) {
      console.error(
        `[ERROR] Fallo al agregar estado ${predefinedStatusId} para ${codeGen}: ${error.message}`,
      );
      throw error;
    }
  }

  async statusExistsForShipment(
    codeGen: string,
    predefinedStatusId: number,
  ): Promise<boolean> {
    const shipment = await this.shipmentRepository.findOne({
      where: { codeGen },
      relations: ['statuses', 'statuses.predefinedStatus'],
    });

    if (!shipment) {
      return false;
    }

    const exists = shipment.statuses.some((status) => {
      return status.predefinedStatus?.id === predefinedStatusId;
    });

    return exists;
  }

  async removeStatusFromShipmentByPredefined(
    codeGen: string,
    predefinedStatusId: number,
  ): Promise<boolean> {
    const statusToRemove = await this.statusRepository.findOne({
      where: {
        shipment: { codeGen },
        predefinedStatus: { id: predefinedStatusId },
      },
      order: { id: 'DESC' },
    });

    if (!statusToRemove) {
      return false;
    }

    await this.statusRepository.delete(statusToRemove.id);
    console.log(
      `[INFO] Estado ${predefinedStatusId} eliminado para ${codeGen}`,
    );
    return true;
  }

  async updateStatusesForShipment(
    codeGen: string,
    predefinedStatusIds: number[] | number,
    observationsChangeStatus?: string,
    leveransUsernameChangeStatus?: string,
  ): Promise<Status> {
    console.log(
      `[UPDATE] Iniciando actualización de estados para envío: ${codeGen}`,
    );

    const predefinedIds = Array.isArray(predefinedStatusIds)
      ? predefinedStatusIds
      : [predefinedStatusIds];

    let status: Status | undefined;

    for (const predefinedStatusId of predefinedIds) {
      if (await this.statusExistsForShipment(codeGen, predefinedStatusId)) {
        console.log(
          `[INFO] Eliminando estado duplicado: ${predefinedStatusId} en ${codeGen}`,
        );
        await this.removeStatusFromShipmentByPredefined(
          codeGen,
          predefinedStatusId,
        );
      }

      status = await this.addStatusByCodeGen(
        codeGen,
        predefinedStatusId,
        observationsChangeStatus,
        leveransUsernameChangeStatus,
      );
    }

    console.log(`[INFO] Verificando orden de estados: ${codeGen}`);
    await this.ensureStatusOrder(codeGen);
    return status;
  }

  /* 
        Método helper para actualizar el estado actual del shipment
        evitando duplicación de código
    */
  private async updateShipmentCurrentStatus(
    shipment: Shipments,
    lastStatus: Status,
  ): Promise<void> {
    const updates: Partial<Shipments> = {};

    if (shipment.currentStatus !== lastStatus.predefinedStatus.id) {
      console.log(
        `[INFO] Actualizando estado actual de ${shipment.currentStatus} a ${lastStatus.predefinedStatus.id} en ${shipment.codeGen}`,
      );
      updates.currentStatus = lastStatus.predefinedStatus.id;
    }

    if (
      shipment.dateTimeCurrentStatus.getTime() !==
      lastStatus.createdAt.getTime()
    ) {
      console.log(
        `[INFO] Actualizando fecha de estado actual en ${shipment.codeGen}`,
      );
      updates.dateTimeCurrentStatus = lastStatus.createdAt;
    }

    if (Object.keys(updates).length > 0) {
      await this.shipmentRepository.update(shipment.id, updates);
      console.log(
        `[SUCCESS] Estado actual del shipment actualizado para ${shipment.codeGen}`,
      );
    }
  }

  private async sendReceiptToExcalibur(
    codeGen: string,
    predefinedStatusId: number,
  ) {
    try {
      const base = process.env.SERVER_EXCALIBUR_NAME;
      if (!base) {
        console.warn(
          '[MW→EXC] SERVER_EXCALIBUR_NAME no configurado, se omite envío.',
        );
        return;
      }

      const authKey =
        process.env.MIDDLEWARE_AUTH_KEY || 'super-clave-compartida';
      const endpoint = `${base.replace(/\/$/, '')}/receipt/${encodeURIComponent(codeGen)}/send`;

      console.log(`[MW→EXC] POST ${endpoint}`);

      const res = await axios.post(endpoint, null, {
        headers: { 'X-Auth-Key': authKey, 'Content-Type': 'application/json' },
        timeout: 60000,
      });

      const data = res.data || {};
      let documentCode: string | undefined = data.document_code;

      if (!documentCode && typeof data.wsResponse === 'string') {
        const m = data.wsResponse.match(
          /<return_value>([^<]+)<\/return_value>/i,
        );
        if (m) documentCode = m[1]?.trim();
      }

      if (documentCode) {
        await this.shipmentRepository.update(
          { codeGen },
          { idExcalibur: documentCode },
        );
        console.log(
          `[MW→EXC] ${codeGen} document_code=${documentCode} guardado en id_excalibur`,
        );
      } else {
        console.warn(
          `[MW→EXC] ${codeGen} sin document_code en respuesta`,
          data,
        );
      }
    } catch (e: any) {
      const details = this.formatAxiosError(e);

      console.error(`[MW ERROR] ${codeGen}: ${details}`);

      await this.contingencyService.registerFailure(
        codeGen,
        predefinedStatusId,
        null,
        details, // 👈 guardamos el detalle completo
      );

      console.warn(
        `[CONTINGENCY] ${codeGen} registrado como pendiente por error: ${details}`,
      );
    }
  }

  async ensureStatusOrder(codeGen: string): Promise<void> {
    const shipment = await this.shipmentRepository.findOne({
      where: { codeGen },
    });

    if (!shipment) {
      console.error(`[ERROR] Envío no encontrado: ${codeGen}`);
      return;
    }

    /* 
            OBTENER ESTADOS ORDENADOS POR CREACIÓN (cronológico)
            Este es el orden que debe mantenerse
        */
    const shipmentStatuses = await this.statusRepository.find({
      where: { shipment: { codeGen } },
      relations: ['predefinedStatus'],
      order: { createdAt: 'ASC' }, // Orden cronológico
    });

    /* 
            VERIFICAR SI ESTÁN CORRECTAMENTE ORDENADOS CRONOLÓGICAMENTE
            Comparar orden actual vs orden cronológico correcto
        */
    const currentOrder = shipmentStatuses.map((s) => s.id);
    const chronologicalOrder = [...shipmentStatuses]
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
      .map((s) => s.id);

    /* 
            REORDENAR SI NO ESTÁN EN ORDEN CRONOLÓGICO CORRECTO
        */
    if (JSON.stringify(currentOrder) !== JSON.stringify(chronologicalOrder)) {
      console.log(
        `[INFO] Estados no están en orden cronológico correcto en ${codeGen}, reordenando...`,
      );
      console.log(`[INFO] Orden actual: [${currentOrder.join(',')}]`);
      console.log(
        `[INFO] Orden cronológico correcto: [${chronologicalOrder.join(',')}]`,
      );

      await this.reorderStatusesByChronologicalOrder(
        shipment,
        shipmentStatuses,
      );

      /* 
                Recargar estados después del reordenamiento para obtener
                el estado actual correcto
            */
      const reorderedStatuses = await this.statusRepository.find({
        where: { shipment: { codeGen } },
        relations: ['predefinedStatus'],
        order: { createdAt: 'ASC' },
      });

      const lastStatus = reorderedStatuses.at(-1);
      if (lastStatus?.predefinedStatus) {
        await this.updateShipmentCurrentStatus(shipment, lastStatus);
      }
    } else {
      /* 
                Si ya están ordenados cronológicamente, solo actualizar el estado actual
                del shipment con el último estado cronológico
            */
      const lastStatus = shipmentStatuses.at(-1);
      if (lastStatus?.predefinedStatus) {
        await this.updateShipmentCurrentStatus(shipment, lastStatus);
      }
      console.log(
        `[INFO] Estados ya están en orden cronológico correcto para ${codeGen}`,
      );
    }
  }

  /* 
        Reordena estados por orden cronológico (createdAt)
        Elimina e inserta estados en el orden cronológico correcto
    */
  async reorderStatusesByChronologicalOrder(
    shipment: Shipments,
    statuses: Status[],
  ): Promise<void> {
    console.log(
      `[INFO] Iniciando reordenamiento cronológico para ${shipment.codeGen}`,
    );

    /* 
            ORDENAR ESTADOS POR FECHA DE CREACIÓN (cronológico)
            Este es el orden correcto que debe mantenerse
        */
    const statusesInChronologicalOrder = [...statuses].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    console.log(
      `[INFO] Estados antes del reordenamiento:`,
      statuses.map(
        (s) =>
          `ID:${s.id}, PredefinedStatus:${s.predefinedStatus.id}, CreatedAt:${s.createdAt.toISOString()}`,
      ),
    );

    console.log(
      `[INFO] Estados en orden cronológico correcto:`,
      statusesInChronologicalOrder.map(
        (s) =>
          `ID:${s.id}, PredefinedStatus:${s.predefinedStatus.id}, CreatedAt:${s.createdAt.toISOString()}`,
      ),
    );

    /* 
            ELIMINAR TODOS LOS ESTADOS EXISTENTES
        */
    console.log(
      `[INFO] Eliminando ${statuses.length} estados existentes para ${shipment.codeGen}`,
    );
    await this.statusRepository.remove(statuses);

    /* 
            REINSERTAR ESTADOS EN ORDEN CRONOLÓGICO CORRECTO
            Mantener todas las fechas y relaciones originales
        */
    console.log(
      `[INFO] Reinsertando ${statusesInChronologicalOrder.length} estados en orden cronológico para ${shipment.codeGen}`,
    );

    const reorderedStatuses = statusesInChronologicalOrder.map((status) => {
      return this.statusRepository.create({
        shipment: shipment,
        predefinedStatus: status.predefinedStatus,
        createdAt: status.createdAt,
        updatedAt: status.updatedAt,
      });
    });

    await this.statusRepository.save(reorderedStatuses);

    console.log(
      `[SUCCESS] Reordenamiento cronológico completado para ${shipment.codeGen}`,
    );
    console.log(
      `[INFO] Estados después del reordenamiento en orden cronológico correcto`,
    );
  }

  async getLastStatusByCodeGen(codeGen: string): Promise<StatusResponse> {
    const filteredStatus = await this.getStatusByCodeGen(codeGen);
    if (!filteredStatus || filteredStatus.length === 0) {
      throw new NotFoundException(
        `No se encontraron estados para el código de generación: ${codeGen}`,
      );
    }
    return filteredStatus[filteredStatus.length - 1];
  }

  async formatStatusByShipment(
    shipment: Shipments,
    current: boolean = false,
    forClients: boolean = false,
  ) {
    if (!shipment) {
      throw new NotFoundException('Envío no proporcionado.');
    }

    const getFormattedStatus = async (status: any) => {
      const createdAt = moment(status.createdAt).tz('America/El_Salvador');
      const formattedDate = createdAt.format('D [de] MMMM [de] YYYY');
      const formattedTime = createdAt.format('hh:mm:ss A');
      const observation = await this.logsShipmentsService.getStatusLogs(
        shipment.codeGen,
        status.predefinedStatus.id,
      );

      return {
        id: status.predefinedStatus.id,
        status: status.predefinedStatus.name,
        createdAt: status.createdAt,
        observation,
        date: formattedDate,
        time: formattedTime,
      };
    };

    if (forClients) {
      return this.getFilteredStatusByCodeGen(shipment.codeGen, current);
    }

    if (current) {
      const latestStatus = shipment.statuses.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0];

      if (latestStatus) {
        return [await getFormattedStatus(latestStatus)];
      }

      throw new NotFoundException(
        'No se encontraron estados, eso en teoría no debería pasar.',
      );
    }

    const statuses = await Promise.all(
      shipment.statuses.map(getFormattedStatus),
    );
    return statuses;
  }

  async getStatusByCodeGen(
    codeGen: string,
    current: boolean = false,
    forClients: boolean = false,
  ): Promise<StatusResponse[]> {
    if (forClients) {
      return this.getFilteredStatusByCodeGen(codeGen, current);
    }

    const shipment = await this.shipmentRepository.findOne({
      where: { codeGen },
      relations: ['statuses', 'statuses.predefinedStatus'],
    });

    if (!shipment) {
      throw new NotFoundException(`No se encontró el envío ${codeGen}`);
    }

    return this.formatStatusByShipment(shipment, current, forClients);
  }

  async getStatusesForShipment(codeGen: string): Promise<number[]> {
    const shipment = await this.shipmentRepository.findOne({
      where: { codeGen },
      relations: ['statuses', 'statuses.predefinedStatus'],
    });

    if (!shipment) {
      return [];
    }

    return shipment.statuses.map((status) => status.predefinedStatus.id);
  }

  async getFilteredStatusByCodeGen(
    codeGen: string,
    current: boolean = false,
  ): Promise<StatusResponse[]> {
    const statuses: StatusResponse[] = await this.getStatusByCodeGen(
      codeGen,
      false,
    );
    if (statuses.length === 0) return [];

    const statusLabels = new Map<number, string>([
      [1, 'En Tránsito'],
      [2, 'Prechequeado'],
      [3, 'Transacción Autorizada'],
      [12, 'Finalizado'],
      [13, 'Pendiente de validar información'],
      [14, 'Anulado'],
      [15, 'En Enfriamiento'],
    ]);

    const formattedStatuses: StatusResponse[] = [];
    const inProcessStatuses: StatusResponse[] = [];

    for (const status of statuses) {
      if (status.id >= 4 && status.id <= 11) {
        inProcessStatuses.push(status);
      } else {
        const label = statusLabels.get(status.id) ?? status.status;
        formattedStatuses.push({
          id: status.id,
          status: label,
          observation: status.observation,
          date: status.date,
          time: status.time,
          createdAt: status.createdAt,
        });
      }
    }

    if (inProcessStatuses.length > 0) {
      // Puedes usar .at(0) para el primero, o .at(-1) para el último
      const base = inProcessStatuses.at(0); // usar el primero en el historial
      formattedStatuses.push({
        id: 999, // ID virtual para "En proceso"
        status: 'En proceso',
        observation: [
          {
            observations: 'Estado en proceso interno',
          },
        ],
        date: base?.date,
        time: base?.time,
        createdAt: base?.createdAt,
      });
    }

    // Orden final por fecha (opcional si ya viene ordenado)
    formattedStatuses.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    return current && formattedStatuses.length > 0
      ? [formattedStatuses[formattedStatuses.length - 1]]
      : formattedStatuses;
  }

  async getLastStatusByShipmentId(shipmentId: number): Promise<Status | null> {
    return this.statusRepository
      .createQueryBuilder('status')
      .leftJoinAndSelect('status.predefinedStatus', 'predefinedStatus') // Esto es clave para obtener la relación
      .where('status.shipment_id = :shipmentId', { shipmentId })
      .orderBy('status.createdAt', 'DESC')
      .getOne();
  }

  async getLastStatusByShipment(shipmentId: number): Promise<Status | null> {
    return this.statusRepository
      .createQueryBuilder('status')
      .where('status.shipment_id = :shipmentId', { shipmentId })
      .orderBy('status.createdAt', 'DESC')
      .getOne();
  }
}

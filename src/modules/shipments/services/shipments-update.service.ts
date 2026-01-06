import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, QueryRunner, DataSource } from 'typeorm';
import { Shipments } from 'src/models/Shipments';
import { Drivers } from 'src/models/Drivers';
import { MassUnit } from '../enums/unitMeasure.enum';
import MassConverter from 'src/utils/massConverter.util';
import { StatusService } from 'src/modules/status/services/status.service';
import { ShipmentSeals } from 'src/models/ShipmentSeals';
import { Clients } from 'src/models/Clients';
import { Vehicles } from 'src/models/Vehicles';
import { NavService } from 'src/modules/nav/services/nav.service';
import { Status } from 'src/models/Status';
import { PredefinedStatuses } from 'src/models/PredefinedStatuses';
import { DataInconsistency } from 'src/models/DataInconsistency';
import { TransactionLogsService } from '../../logs/services/transaction-logs.service';
import { IngenioLogsService } from 'src/modules/logs/services/ingenio-logs.service';
import { AuthService } from 'src/modules/auth/services/auth.service';
import { Role } from 'src/modules/auth/enums/roles.enum';

@Injectable()
export class ShipmentsUpdateService {
  private readonly logger = new Logger(ShipmentsUpdateService.name);

  constructor(
    @InjectRepository(Shipments)
    private shipmentsRepository: Repository<Shipments>,
    @InjectRepository(Drivers)
    private driversRepository: Repository<Drivers>,
    @InjectRepository(Vehicles)
    private vehiclesRepository: Repository<Vehicles>,
    @InjectRepository(Clients)
    private clientsRepository: Repository<Clients>,
    @InjectRepository(ShipmentSeals)
    private shipmentSealsRepository: Repository<ShipmentSeals>,
    @InjectRepository(Status)
    private statusRepository: Repository<Status>,
    @InjectRepository(PredefinedStatuses)
    private predefinedStatusesRepository: Repository<PredefinedStatuses>,
    @InjectRepository(DataInconsistency)
    private dataInconsistencyRepository: Repository<DataInconsistency>,
    private massConverter: MassConverter,
    private statusService: StatusService,
    private navService: NavService,
    private transactionLogsService: TransactionLogsService,
    private ingenioLogsService: IngenioLogsService,
    private authService: AuthService,
    private connection: DataSource,
  ) {}

  private shipmentToUpdate: Shipments = null;

  /**
   * Actualiza un envío con validaciones específicas y manejo de resolución de inconsistencias
   */
  async updateShipment(
    idShipment: number,
    updateData: Partial<Shipments> & {
      usuario?: string;
      reportedPositions?: string[]; // Para validación de posiciones específicas
    },
    allowedFields: (keyof Shipments)[] = [],
    userFromSession?: any, // Usuario de la sesión JWT
  ): Promise<Shipments> {
    console.log(`Iniciando actualización del envío ID: ${idShipment}`);

    // IMPLEMENTAR TRANSACCIONES
    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let isInconsistencyResolution = false;
    let previousStatus: number | null = null;
    let usernameForLog = 'UNKNOWN';
    let isClientUpdate = false; // Para identificar si es actualización de cliente

    // Extraer campos especiales del updateData
    const { usuario, reportedPositions, ...actualUpdateData } = updateData;

    try {
      // 1. OBTENER USERNAME DEL USUARIO
      // Prioridad: 1. usuario pasado manualmente, 2. usuario de sesión, 3. UNKNOWN
      if (usuario && usuario.trim()) {
        // Si se proporciona username directamente (manual override)
        usernameForLog = usuario.trim();
        console.log(`Usuario directo proporcionado: ${usernameForLog}`);
      } else if (userFromSession) {
        // Tomar username de la sesión JWT
        const roles = userFromSession.roles || [];

        if (roles.includes(Role.CLIENT)) {
          usernameForLog = `${userFromSession.username}`;
          isClientUpdate = true;
          console.log(`Username de sesión CLIENT: ${usernameForLog}`);
        } else {
          // Para otros roles (ADMIN, BOT), usar username directo
          usernameForLog = userFromSession.username || 'UNKNOWN';
          console.log(`Username de sesión (no cliente): ${usernameForLog}`);
        }
      } else {
        usernameForLog = 'UNKNOWN';
        console.log('Usuario no proporcionado ni en sesión, usando UNKNOWN');
      }

      // Determinar si es actualización de cliente basándose en campos restringidos o rol
      if (!isClientUpdate && allowedFields.length > 0) {
        isClientUpdate = true;
        console.log(
          `Detectada actualización de cliente por campos restringidos`,
        );
      }

      // 2. BUSCAR EL ENVÍO A ACTUALIZAR CON LOCKING OPTIMISTA
      this.shipmentToUpdate = await queryRunner.manager.findOne(Shipments, {
        where: { id: idShipment },
        relations: ['driver', 'vehicle', 'ingenio'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!this.shipmentToUpdate) {
        const errorMsg = 'Recurso no encontrado';
        await this.logError(
          queryRunner,
          'UNKNOWN',
          usernameForLog,
          'UNKNOWN',
          `Shipment ID ${idShipment} not found`,
        );

        // Log de ingenio si es actualización de cliente
        if (isClientUpdate) {
          await this.ingenioLogsService.logIngenioError(
            'UNKNOWN',
            usernameForLog,
            '404',
            `Shipment ID ${idShipment} not found`,
            { idShipment, updateData: actualUpdateData },
          );
        }

        throw new NotFoundException(errorMsg);
      }

      console.log(
        `Envío encontrado: ${this.shipmentToUpdate.codeGen}, Estado actual: ${this.shipmentToUpdate.currentStatus}`,
      );

      // Log de inicio de actualización para clientes
      if (isClientUpdate) {
        await this.ingenioLogsService.logIngenioSuccess(
          this.shipmentToUpdate.codeGen,
          usernameForLog,
          this.shipmentToUpdate.currentStatus.toString(),
          'UPDATE_SHIPMENT_START',
          { idShipment, updateData: actualUpdateData, allowedFields },
        );
      }

      // Guardar estado y timestamp originales para validación optimista
      const originalStatus = this.shipmentToUpdate.currentStatus;
      const originalUpdatedAt = this.shipmentToUpdate.updatedAt;

      // 3. VALIDAR QUE EL ENVÍO TENGA ESTADOS
      const status = await queryRunner.manager.find(Status, {
        where: { shipment: { codeGen: this.shipmentToUpdate.codeGen } },
        relations: ['predefinedStatus'],
      });

      if (!status || status.length === 0) {
        const errorMsg = 'Estado del envío no válido';
        await this.logError(
          queryRunner,
          this.shipmentToUpdate.codeGen,
          usernameForLog,
          this.shipmentToUpdate.currentStatus.toString(),
          'Shipment without status',
        );

        if (isClientUpdate) {
          await this.ingenioLogsService.logIngenioError(
            this.shipmentToUpdate.codeGen,
            usernameForLog,
            this.shipmentToUpdate.currentStatus.toString(),
            'Shipment without status',
            { idShipment, updateData: actualUpdateData },
          );
        }

        throw new BadRequestException(errorMsg);
      }

      // 4. VALIDAR CAMPOS PERMITIDOS
      const fieldsToUpdate = Object.keys(
        actualUpdateData,
      ) as (keyof Shipments)[];
      console.log(`Campos a actualizar: ${fieldsToUpdate.join(', ')}`);

      if (allowedFields.length > 0) {
        const invalidFields = fieldsToUpdate.filter(
          (field) => !allowedFields.includes(field),
        );
        if (invalidFields.length > 0) {
          const errorMsg = 'Campos no permitidos para actualización';
          await this.logError(
            queryRunner,
            this.shipmentToUpdate.codeGen,
            usernameForLog,
            this.shipmentToUpdate.currentStatus.toString(),
            `Invalid fields: ${invalidFields.join(', ')}. Allowed: ${allowedFields.join(', ')}`,
          );

          if (isClientUpdate) {
            await this.ingenioLogsService.logIngenioError(
              this.shipmentToUpdate.codeGen,
              usernameForLog,
              this.shipmentToUpdate.currentStatus.toString(),
              `Invalid fields: ${invalidFields.join(', ')}. Allowed: ${allowedFields.join(', ')}`,
              { idShipment, updateData: actualUpdateData, allowedFields },
            );
          }

          throw new ForbiddenException(errorMsg);
        }
      }

      // 5. *** VALIDAR MARCHAMOS ANTES DE PROCESAR (si se van a actualizar) ***
      if (actualUpdateData.shipmentSeals !== undefined) {
        try {
          await this.validateSealsUpdate(
            queryRunner,
            actualUpdateData.shipmentSeals,
          );
        } catch (validationError) {
          await this.logError(
            queryRunner,
            this.shipmentToUpdate.codeGen,
            usernameForLog,
            this.shipmentToUpdate.currentStatus.toString(),
            validationError.message,
          );

          if (isClientUpdate) {
            await this.ingenioLogsService.logIngenioError(
              this.shipmentToUpdate.codeGen,
              usernameForLog,
              this.shipmentToUpdate.currentStatus.toString(),
              validationError.message,
              { idShipment, updateData: actualUpdateData },
            );
          }

          throw validationError;
        }
      }

      // 6. *** VERIFICAR SI ES RESOLUCIÓN DE INCONSISTENCIA ***
      isInconsistencyResolution = this.shipmentToUpdate.currentStatus === 13;
      let resolvedInconsistency: DataInconsistency | null = null;

      if (isInconsistencyResolution) {
        console.log(
          `DETECTADA RESOLUCIÓN DE INCONSISTENCIA para envío: ${this.shipmentToUpdate.codeGen}`,
        );

        // 6.1 Buscar el estado anterior diferente a 13
        try {
          previousStatus = await this.findPreviousNonInconsistencyStatus(
            queryRunner,
            this.shipmentToUpdate.id,
          );

          if (previousStatus === null) {
            const errorMsg = 'Estado anterior no encontrado';
            await this.logError(
              queryRunner,
              this.shipmentToUpdate.codeGen,
              usernameForLog,
              this.shipmentToUpdate.currentStatus.toString(),
              `No previous valid status found for shipment ${this.shipmentToUpdate.codeGen}`,
            );

            if (isClientUpdate) {
              await this.ingenioLogsService.logIngenioError(
                this.shipmentToUpdate.codeGen,
                usernameForLog,
                this.shipmentToUpdate.currentStatus.toString(),
                `No previous valid status found for shipment ${this.shipmentToUpdate.codeGen}`,
                { idShipment, updateData: actualUpdateData },
              );
            }

            throw new BadRequestException(errorMsg);
          }
        } catch (findStatusError) {
          await this.logError(
            queryRunner,
            this.shipmentToUpdate.codeGen,
            usernameForLog,
            this.shipmentToUpdate.currentStatus.toString(),
            findStatusError.message,
          );

          if (isClientUpdate) {
            await this.ingenioLogsService.logIngenioError(
              this.shipmentToUpdate.codeGen,
              usernameForLog,
              this.shipmentToUpdate.currentStatus.toString(),
              findStatusError.message,
              { idShipment, updateData: actualUpdateData },
            );
          }

          throw findStatusError;
        }

        // 6.2 Buscar el reporte de inconsistencia para actualizarlo
        resolvedInconsistency = await queryRunner.manager.findOne(
          DataInconsistency,
          {
            where: { shipment: { id: this.shipmentToUpdate.id } },
            relations: ['shipment'],
          },
        );

        if (resolvedInconsistency) {
          console.log(
            `Reporte de inconsistencia encontrado ID: ${resolvedInconsistency.id}`,
          );
        }
      }

      // 7. *** RESOLVER INCONSISTENCIA PRIMERO SI APLICA ***
      if (isInconsistencyResolution && previousStatus !== null) {
        console.log(`Resolviendo inconsistencia antes de procesar campos...`);
        try {
          await this.resolveInconsistency(
            queryRunner,
            previousStatus,
            resolvedInconsistency,
          );
          console.log(
            `Inconsistencia resuelta. Nuevo estado: ${this.shipmentToUpdate.currentStatus}`,
          );
        } catch (resolveError) {
          await this.logError(
            queryRunner,
            this.shipmentToUpdate.codeGen,
            usernameForLog,
            this.shipmentToUpdate.currentStatus.toString(),
            `Error resolving inconsistency: ${resolveError.message}`,
          );

          if (isClientUpdate) {
            await this.ingenioLogsService.logIngenioError(
              this.shipmentToUpdate.codeGen,
              usernameForLog,
              this.shipmentToUpdate.currentStatus.toString(),
              `Error resolving inconsistency: ${resolveError.message}`,
              { idShipment, updateData: actualUpdateData },
            );
          }

          throw resolveError;
        }
      }

      // 8. PROCESAR LAS ACTUALIZACIONES DE CAMPOS (DESPUÉS DE RESOLVER INCONSISTENCIA)
      console.log(`🔧 Procesando actualizaciones de campos...`);
      for (const field of fieldsToUpdate) {
        console.log(`Actualizando campo: ${field}`);

        try {
          switch (field) {
            case 'unitMeasure':
              await this.handleUnitMeasure(
                queryRunner,
                actualUpdateData.unitMeasure,
                actualUpdateData.productQuantity,
              );
              break;
            case 'productQuantity':
              await this.handleProductQuantity(
                actualUpdateData.productQuantity,
              );
              break;
            case 'productQuantityKg':
              await this.handleProductQuantityKg(
                actualUpdateData.productQuantityKg,
              );
              break;
            case 'vehicle':
              await this.handleVehicle(queryRunner, actualUpdateData.vehicle);
              break;
            case 'ingenio':
              await this.handleIngenio(
                queryRunner,
                actualUpdateData.ingenio?.ingenioCode,
              );
              break;
            case 'shipmentSeals':
              // VALIDACIÓN DE POSICIÓN ESPECÍFICA
              await this.handleUpdateSeals(
                queryRunner,
                actualUpdateData.shipmentSeals,
                reportedPositions,
              );
              break;
            case 'driver':
              await this.handleDriver(queryRunner, actualUpdateData.driver);
              break;
            default:
              // Para campos que no necesitan manejo especial
              if (actualUpdateData[field] !== undefined) {
                (this.shipmentToUpdate as any)[field] =
                  actualUpdateData[field]!;
                console.log(`Campo ${field} actualizado directamente`);
              }
          }
        } catch (fieldError) {
          await this.logError(
            queryRunner,
            this.shipmentToUpdate.codeGen,
            usernameForLog,
            this.shipmentToUpdate.currentStatus.toString(),
            `Error updating field ${field}: ${fieldError.message}`,
          );

          if (isClientUpdate) {
            await this.ingenioLogsService.logIngenioError(
              this.shipmentToUpdate.codeGen,
              usernameForLog,
              this.shipmentToUpdate.currentStatus.toString(),
              `Error updating field ${field}: ${fieldError.message}`,
              { idShipment, updateData: actualUpdateData, field },
            );
          }

          throw fieldError;
        }
      }

      // 9. *** VALIDACIÓN OPTIMISTA ANTES DE GUARDAR (SOLO SI NO ES RESOLUCIÓN DE INCONSISTENCIA) ***
      if (!isInconsistencyResolution) {
        const currentShipmentState = await queryRunner.manager.findOne(
          Shipments,
          {
            where: { id: idShipment },
            select: ['currentStatus', 'updatedAt'],
          },
        );

        if (currentShipmentState.currentStatus !== originalStatus) {
          const conflictMsg =
            'El envío fue modificado por otro usuario. Intente nuevamente.';

          if (isClientUpdate) {
            await this.ingenioLogsService.logIngenioError(
              this.shipmentToUpdate.codeGen,
              usernameForLog,
              this.shipmentToUpdate.currentStatus.toString(),
              conflictMsg,
              { idShipment, updateData: actualUpdateData },
            );
          }

          throw new ConflictException(conflictMsg);
        }
      } else {
        console.log(
          `Skipping optimistic validation for inconsistency resolution`,
        );
      }

      // 10. ACTUALIZAR TIMESTAMP Y GUARDAR
      this.shipmentToUpdate.updatedAt = new Date();
      const savedShipment = await queryRunner.manager.save(
        Shipments,
        this.shipmentToUpdate,
      );

      console.log(
        `Envío actualizado exitosamente: ${savedShipment.codeGen}, Nuevo estado: ${savedShipment.currentStatus}`,
      );

      // 11. *** REGISTRAR LOG DE ÉXITO ***
      await this.transactionLogsService.createLog({
        code_gen: savedShipment.codeGen,
        json_enviado: JSON.stringify({
          idShipment,
          updateData: actualUpdateData,
        }),
        usuario: usernameForLog,
        estatus: savedShipment.currentStatus.toString(),
        json_modificacion: JSON.stringify({
          action: isInconsistencyResolution
            ? 'INCONSISTENCY_RESOLVED'
            : 'SHIPMENT_UPDATED',
          shipmentCodeGen: savedShipment.codeGen,
          fieldsUpdated: fieldsToUpdate,
          inconsistencyResolution: isInconsistencyResolution
            ? {
                wasInconsistencyResolution: true,
                previousStatus: 13,
                newStatus: savedShipment.currentStatus,
                previousStatusFoundInHistory: previousStatus,
                resolvedAt: new Date().toISOString(),
                resolvedBy: usernameForLog,
              }
            : null,
          updateDetails: {
            updatedFields: actualUpdateData,
            updateTimestamp: new Date().toISOString(),
            shipmentUpdatedAt: savedShipment.updatedAt?.toISOString(),
            statusUpdatedAt: savedShipment.dateTimeCurrentStatus?.toISOString(),
          },
          metadata: {
            serviceVersion: '3.0',
            hasNavIntegration: savedShipment.idNavRecord != null,
            totalFieldsModified: fieldsToUpdate.length,
            usuario: usernameForLog !== 'UNKNOWN' ? usernameForLog : null,
            username: usernameForLog !== 'UNKNOWN' ? usernameForLog : null,
            reportedPositions: reportedPositions || null,
            isClientUpdate: isClientUpdate,
            sessionUsed: userFromSession ? 'yes' : 'no',
            userSource: usuario
              ? 'manual'
              : userFromSession
                ? 'session'
                : 'none',
          },
        }),
      });

      // Log de éxito para ingenios
      if (isClientUpdate) {
        await this.ingenioLogsService.logIngenioSuccess(
          savedShipment.codeGen,
          usernameForLog,
          savedShipment.currentStatus.toString(),
          isInconsistencyResolution
            ? 'INCONSISTENCY_RESOLVED'
            : 'UPDATE_SHIPMENT_SUCCESS',
          { idShipment, updateData: actualUpdateData, allowedFields },
          {
            shipmentCodeGen: savedShipment.codeGen,
            fieldsUpdated: fieldsToUpdate,
            newStatus: savedShipment.currentStatus,
            updatedAt: savedShipment.updatedAt?.toISOString(),
          },
        );
      }

      // COMMIT DE LA TRANSACCIÓN
      await queryRunner.commitTransaction();

      return savedShipment;
    } catch (error) {
      // ROLLBACK EN CASO DE ERROR
      await queryRunner.rollbackTransaction();

      // MANEJO SEGURO DE ERRORES
      const isAlreadyLogged =
        error.message.includes('Recurso no encontrado') ||
        error.message.includes('Estado del envío no válido') ||
        error.message.includes('Campos no permitidos') ||
        error.message.includes('Estado anterior no encontrado') ||
        error.message.includes('fue modificado por otro usuario');

      if (!isAlreadyLogged) {
        await this.logError(
          queryRunner,
          this.shipmentToUpdate?.codeGen || 'UNKNOWN',
          usernameForLog,
          this.shipmentToUpdate?.currentStatus?.toString() || 'UNKNOWN',
          error.message,
        );

        // Log de error para ingenios si no se logueó antes
        if (isClientUpdate && !isAlreadyLogged) {
          await this.ingenioLogsService.logIngenioError(
            this.shipmentToUpdate?.codeGen || 'UNKNOWN',
            usernameForLog,
            this.shipmentToUpdate?.currentStatus?.toString() || 'UNKNOWN',
            error.message,
            { idShipment, updateData: actualUpdateData },
          );
        }
      }

      console.error(
        `Error en actualización de envío ID ${idShipment}: ${error.message}`,
      );
      throw error;
    } finally {
      // LIBERAR RECURSOS DE LA TRANSACCIÓN
      await queryRunner.release();
    }
  }

  /**
   * Método para logging seguro de errores
   */
  private async logError(
    queryRunner: QueryRunner,
    codeGen: string,
    usuario: string,
    estatus: string,
    internalError: string,
  ): Promise<void> {
    try {
      await this.transactionLogsService.createLog({
        code_gen: codeGen,
        json_enviado: JSON.stringify({ error: 'Error en actualización' }),
        usuario: usuario,
        estatus: estatus,
        motivo_invalidacion: 'Error interno del sistema',
      });

      // Log interno detallado para debugging
      console.error(`Internal error: ${internalError}`, {
        codeGen,
        usuario,
        estatus,
        timestamp: new Date().toISOString(),
      });
    } catch (logError) {
      console.error(`Failed to log error: ${logError.message}`);
    }
  }

  /**
   * Valida los marchamos antes de actualizar
   * Permite arrays vacíos para casos donde no se actualizan marchamos (inconsistencias de licencia/placa)
   */
  private async validateSealsUpdate(
    queryRunner: QueryRunner,
    sealsToUpdate: ShipmentSeals[],
  ): Promise<void> {
    // Si el array está vacío, no hay nada que validar (caso válido para actualizaciones sin marchamos)
    if (!sealsToUpdate || sealsToUpdate.length === 0) {
      console.log('No hay marchamos para actualizar - validación omitida');
      return;
    }

    // Obtener los marchamos existentes del shipment ordenados por createdAt
    const existingSeals = await queryRunner.manager.find(ShipmentSeals, {
      where: { shipment: { id: this.shipmentToUpdate.id } },
      order: { createdAt: 'ASC' },
    });

    // Validar que no se intente actualizar más marchamos de los que existen
    if (sealsToUpdate.length > existingSeals.length) {
      throw new BadRequestException(
        'Número de marchamos excede los disponibles',
      );
    }

    // Validar que no hay códigos duplicados en los marchamos a actualizar
    const sealCodes = sealsToUpdate
      .map((seal) => seal.sealCode?.trim().toLowerCase())
      .filter((code) => code);
    const uniqueSealCodes = new Set(sealCodes);
    if (sealCodes.length !== uniqueSealCodes.size) {
      throw new BadRequestException(
        'Códigos de marchamos duplicados no permitidos',
      );
    }

    // Validar que todos los marchamos tienen códigos válidos
    const invalidSeals = sealsToUpdate.filter(
      (seal) => !seal.sealCode || seal.sealCode.trim() === '',
    );
    if (invalidSeals.length > 0) {
      throw new BadRequestException('Códigos de marchamos inválidos');
    }

    console.log(
      `Validación de marchamos exitosa: ${sealsToUpdate.length} marchamos válidos para actualizar`,
    );
  }

  /**
   * Busca el estado anterior diferente a 13 en el historial de estados
   */
  private async findPreviousNonInconsistencyStatus(
    queryRunner: QueryRunner,
    shipmentId: number,
  ): Promise<number | null> {
    try {
      const statuses = await queryRunner.manager.find(Status, {
        where: { shipment: { id: shipmentId } },
        relations: ['predefinedStatus'],
        order: { createdAt: 'DESC' },
      });

      if (statuses.length === 0) {
        console.warn(
          `⚠️ No se encontraron estados para el shipment ${shipmentId}`,
        );
        return null;
      }

      // Recorrido en reversa: buscar el primer estado diferente a 13
      for (const status of statuses) {
        const statusId = status.predefinedStatus.id;
        if (statusId !== 13) {
          return statusId;
        }
      }

      console.warn(
        `⚠️ No se encontró estado anterior diferente a 13 para shipment ${shipmentId}`,
      );
      return null;
    } catch (error) {
      console.error(`❌ Error buscando estado anterior: ${error.message}`);
      throw new BadRequestException('Error interno al buscar estado anterior');
    }
  }

  /**
   * Resuelve la inconsistencia actualizando estados y registros
   */
  private async resolveInconsistency(
    queryRunner: QueryRunner,
    newStatusId: number,
    inconsistencyReport: DataInconsistency | null,
  ): Promise<void> {
    const currentDate = new Date();

    try {
      // 1. VERIFICAR QUE EL NUEVO ESTADO EXISTE
      const newPredefinedStatus = await queryRunner.manager.findOne(
        PredefinedStatuses,
        {
          where: { id: newStatusId },
        },
      );

      if (!newPredefinedStatus) {
        throw new NotFoundException('Estado no encontrado');
      }

      // 2. ACTUALIZAR SOLO EL ESTADO DEL SHIPMENT (NO SOBRESCRIBIR OTROS CAMPOS)
      this.shipmentToUpdate.currentStatus = newStatusId;
      this.shipmentToUpdate.dateTimeCurrentStatus = currentDate;
      // NO hacer save() aquí - se guarda al final del método principal

      // 3. ACTUALIZAR UPDATEDAT DEL REPORTE DE INCONSISTENCIA
      if (inconsistencyReport) {
        inconsistencyReport.updatedAt = currentDate;
        await queryRunner.manager.save(DataInconsistency, inconsistencyReport);
      } else {
        console.warn(
          `⚠️ No se encontró reporte de inconsistencia para actualizar`,
        );
      }

      // 4. REGISTRAR EL NUEVO ESTADO EN LA TABLA STATUS
      try {
        const statusRecord = queryRunner.manager.create(Status, {
          shipment: this.shipmentToUpdate,
          predefinedStatus: newPredefinedStatus,
          createdAt: currentDate,
        });

        await queryRunner.manager.save(Status, statusRecord);
      } catch (statusError) {
        console.warn(`Error al registrar estado: ${statusError.message}`);
      }
    } catch (error) {
      console.error(`❌ Error resolviendo inconsistencia: ${error.message}`);
      throw new BadRequestException('Error interno al resolver inconsistencia');
    }
  }

  // ==========================================
  // MÉTODOS PRIVADOS PARA MANEJO DE CAMPOS ESPECÍFICOS
  // ==========================================

  /**
   * Actualiza SOLO los datos del conductor actual del shipment (NO cambia la referencia)
   */
  private async handleDriver(queryRunner: QueryRunner, driverUpdate: Drivers) {
    if (!driverUpdate) return;

    // Verificar que el shipment tenga un driver asignado
    if (!this.shipmentToUpdate.driver) {
      throw new BadRequestException('El envío no tiene conductor asignado');
    }

    const currentDriver = this.shipmentToUpdate.driver;
    let wasUpdated = false;
    const updateFields = [];

    // Si se intenta actualizar la licencia
    if (
      driverUpdate.license &&
      driverUpdate.license.trim() !== '' &&
      driverUpdate.license !== currentDriver.license
    ) {
      const newLicense = driverUpdate.license.trim();

      // ✅ VALIDAR FORMATO: Solo números
      if (!/^\d+$/.test(newLicense)) {
        throw new BadRequestException(
          `La licencia "${newLicense}" tiene un formato inválido. Debe contener solo números.`,
        );
      }

      // Verificar si ya existe otro conductor con esta licencia
      const existingDriver = await queryRunner.manager.findOne(Drivers, {
        where: { license: newLicense },
      });

      if (existingDriver && existingDriver.id !== currentDriver.id) {
        // La licencia ya pertenece a otro conductor - NO permitir actualización
        throw new ConflictException(
          `La licencia ${newLicense} ya está asignada a otro conductor` +
            `No se puede actualizar.`,
        );
      }

      // Si llegamos aquí, la licencia no existe o es del mismo conductor
      const oldLicense = currentDriver.license;
      currentDriver.license = newLicense;
      wasUpdated = true;
      updateFields.push(
        `license: "${oldLicense}" -> "${currentDriver.license}"`,
      );
    }

    // Actualizar name si se proporciona y es diferente
    if (
      driverUpdate.name &&
      driverUpdate.name.trim() !== '' &&
      driverUpdate.name !== currentDriver.name
    ) {
      const oldName = currentDriver.name;
      currentDriver.name = driverUpdate.name.trim();
      wasUpdated = true;
      updateFields.push(`name: "${oldName}" -> "${currentDriver.name}"`);
    }

    // Solo guardar si hubo cambios
    if (wasUpdated) {
      currentDriver.updatedAt = new Date();
      await queryRunner.manager.save(Drivers, currentDriver);
      console.log(
        `Conductor actualizado ID ${currentDriver.id}: ${updateFields.join(', ')}`,
      );
    } else {
      console.log(
        `Conductor sin cambios ID ${currentDriver.id}: ${currentDriver.license} - ${currentDriver.name}`,
      );
    }

    // NO cambiar la referencia en el shipment - mantener el mismo driver
    // this.shipmentToUpdate.driver sigue siendo el mismo objeto
  }

  /**
   * Actualiza SOLO los datos del vehículo actual del shipment (NO cambia la referencia)
   */
  private async handleVehicle(
    queryRunner: QueryRunner,
    vehicleData?: Vehicles,
  ) {
    if (!vehicleData) return;

    // Verificar que el shipment tenga un vehicle asignado
    if (!this.shipmentToUpdate.vehicle) {
      throw new BadRequestException('El envío no tiene vehículo asignado');
    }

    const currentVehicle = this.shipmentToUpdate.vehicle;
    let wasUpdated = false;
    const updateFields = [];

    // Actualizar plate si se proporciona y es diferente
    if (
      vehicleData.plate &&
      vehicleData.plate.trim() !== '' &&
      vehicleData.plate !== currentVehicle.plate
    ) {
      const newPlate = vehicleData.plate.trim();

      // Debe comenzar con "C" seguido de números
      if (!/^C\d+$/.test(newPlate)) {
        throw new BadRequestException(
          `La placa del cabezal "${newPlate}" tiene un formato inválido. Debe comenzar con "C" seguido de números.`,
        );
      }

      const oldPlate = currentVehicle.plate;
      currentVehicle.plate = newPlate;
      wasUpdated = true;
      updateFields.push(`plate: "${oldPlate}" -> "${currentVehicle.plate}"`);
    }

    // Actualizar trailerPlate si se proporciona y es diferente
    if (
      vehicleData.trailerPlate !== undefined &&
      vehicleData.trailerPlate !== currentVehicle.trailerPlate
    ) {
      const newTrailerPlate = vehicleData.trailerPlate;

      // Debe comenzar con "RE" seguido de números (si no es vacío/null)
      if (
        newTrailerPlate &&
        newTrailerPlate.trim() !== '' &&
        !/^RE\d+$/.test(newTrailerPlate.trim())
      ) {
        throw new BadRequestException(
          `La placa del remolque "${newTrailerPlate}" tiene un formato inválido. Debe comenzar con "RE" seguido de números.`,
        );
      }

      const oldTrailerPlate = currentVehicle.trailerPlate;
      currentVehicle.trailerPlate = newTrailerPlate;
      wasUpdated = true;
      updateFields.push(
        `trailerPlate: "${oldTrailerPlate}" -> "${currentVehicle.trailerPlate}"`,
      );
    }

    // Actualizar truckType si se proporciona y es diferente
    if (
      vehicleData.truckType &&
      vehicleData.truckType.trim() !== '' &&
      vehicleData.truckType !== currentVehicle.truckType
    ) {
      const oldTruckType = currentVehicle.truckType;
      currentVehicle.truckType = vehicleData.truckType.trim();
      wasUpdated = true;
      updateFields.push(
        `truckType: "${oldTruckType}" -> "${currentVehicle.truckType}"`,
      );
    }

    // Solo guardar si hubo cambios
    if (wasUpdated) {
      currentVehicle.updatedAt = new Date();
      await queryRunner.manager.save(Vehicles, currentVehicle);
      console.log(
        `Vehículo actualizado ID ${currentVehicle.id}: ${updateFields.join(', ')}`,
      );
    } else {
      console.log(
        `Vehículo sin cambios ID ${currentVehicle.id}: ${currentVehicle.plate} - ${currentVehicle.truckType}`,
      );
    }

    // NO cambiar la referencia en el shipment - mantener el mismo vehicle
    // this.shipmentToUpdate.vehicle sigue siendo el mismo objeto
  }

  private async handleUnitMeasure(
    queryRunner: QueryRunner,
    unitMeasure?: string,
    productQuantity?: number,
  ) {
    if (!unitMeasure) return;

    if (!Object.values(MassUnit).includes(unitMeasure as MassUnit)) {
      throw new ConflictException('Unidad de medida inválida');
    }

    this.shipmentToUpdate.unitMeasure = unitMeasure;

    const cantidadProducto =
      productQuantity !== undefined
        ? productQuantity
        : this.shipmentToUpdate.productQuantity;

    this.shipmentToUpdate.productQuantityKg = this.massConverter.convert(
      cantidadProducto,
      unitMeasure as MassUnit,
      MassUnit.Kilogram,
    );

    if (this.shipmentToUpdate.idNavRecord != null) {
      await this.navService.updatePesoClienteNav(this.shipmentToUpdate);
    }
  }

  private async handleProductQuantity(productQuantity?: number) {
    if (productQuantity === undefined) return;

    this.shipmentToUpdate.productQuantity = productQuantity;

    this.shipmentToUpdate.productQuantityKg = this.massConverter.convert(
      productQuantity,
      this.shipmentToUpdate.unitMeasure as MassUnit,
      MassUnit.Kilogram,
    );
  }

  private async handleProductQuantityKg(productQuantityKg?: number) {
    if (productQuantityKg === undefined) return;

    this.shipmentToUpdate.productQuantityKg = productQuantityKg;

    this.shipmentToUpdate.productQuantity = this.massConverter.convert(
      productQuantityKg,
      MassUnit.Kilogram,
      this.shipmentToUpdate.unitMeasure as MassUnit,
    );
  }

  private async handleIngenio(queryRunner: QueryRunner, ingenioCode?: string) {
    if (!ingenioCode) return;

    const ingenio = await queryRunner.manager.findOne(Clients, {
      where: { ingenioCode },
    });
    if (!ingenio) {
      throw new NotFoundException('Código de ingenio no encontrado');
    }

    this.shipmentToUpdate.ingenio = ingenio;
  }

  /**
   * Actualiza los marchamos validando posiciones específicas
   * Actualiza marchamos basándose en posiciones reportadas en inconsistencias
   */
  private async handleUpdateSeals(
    queryRunner: QueryRunner,
    sealsToUpdate?: ShipmentSeals[],
    reportedPositions?: string[],
  ): Promise<void> {
    if (!sealsToUpdate || sealsToUpdate.length === 0) {
      console.log('No hay marchamos para actualizar - operación omitida');
      return;
    }

    console.log(`Actualizando ${sealsToUpdate.length} marchamos...`);

    // Obtener los marchamos existentes ordenados por createdAt (mismo orden que en el reporte)
    const existingSeals = await queryRunner.manager.find(ShipmentSeals, {
      where: { shipment: { id: this.shipmentToUpdate.id } },
      order: { createdAt: 'ASC' },
    });

    console.log(`Marchamos existentes encontrados: ${existingSeals.length}`);
    console.log(`Marchamos a actualizar: ${sealsToUpdate.length}`);

    const updatePromises: Promise<ShipmentSeals>[] = [];

    // Si vienen posiciones específicas del reporte de inconsistencia
    if (reportedPositions && reportedPositions.length > 0) {
      console.log(
        `Actualizando marchamos por posiciones específicas: ${reportedPositions.join(', ')}`,
      );

      for (let i = 0; i < reportedPositions.length; i++) {
        const position = reportedPositions[i];
        const positionMatch = position.match(/marchamo(\d+)/i);

        if (positionMatch) {
          const sealIndex = parseInt(positionMatch[1]) - 1;

          if (
            sealIndex >= 0 &&
            sealIndex < existingSeals.length &&
            sealIndex < sealsToUpdate.length
          ) {
            const existingSeal = existingSeals[sealIndex];
            const newSealData = sealsToUpdate[sealIndex];

            console.log(
              `   Actualizando seal por posición específica ${position}:`,
            );
            console.log(`   ID: ${existingSeal.id}`);
            console.log(`   Código anterior: ${existingSeal.sealCode}`);
            console.log(`   Código nuevo: ${newSealData.sealCode}`);

            // Actualizar solo el código del seal (mantener ID y otros campos)
            existingSeal.sealCode = newSealData.sealCode;

            // Actualizar descripción si se proporciona
            if (newSealData.sealDescription !== undefined) {
              existingSeal.sealDescription = newSealData.sealDescription;
            }

            // Agregar a la lista de promesas para guardar
            updatePromises.push(
              queryRunner.manager.save(ShipmentSeals, existingSeal),
            );
          } else {
            console.warn(
              `Posición ${position} fuera de rango para marchamos existentes`,
            );
          }
        }
      }
    } else {
      // Actualización secuencial normal (comportamiento original)
      console.log(
        `Actualizando marchamos por orden secuencial (comportamiento original)`,
      );

      for (let i = 0; i < sealsToUpdate.length; i++) {
        if (i < existingSeals.length) {
          const existingSeal = existingSeals[i];
          const newSealData = sealsToUpdate[i];

          console.log(`   Actualizando seal secuencial ${i + 1}:`);
          console.log(`   ID: ${existingSeal.id}`);
          console.log(`   Código anterior: ${existingSeal.sealCode}`);
          console.log(`   Código nuevo: ${newSealData.sealCode}`);

          // Actualizar solo el código del seal (mantener ID y otros campos)
          existingSeal.sealCode = newSealData.sealCode;

          // Actualizar descripción si se proporciona
          if (newSealData.sealDescription !== undefined) {
            existingSeal.sealDescription = newSealData.sealDescription;
          }

          // Agregar a la lista de promesas para guardar
          updatePromises.push(
            queryRunner.manager.save(ShipmentSeals, existingSeal),
          );
        }
      }
    }

    // Ejecutar todas las actualizaciones
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
      console.log(
        `${updatePromises.length} marchamos actualizados exitosamente`,
      );
    }

    console.log(`Actualización de marchamos completada`);
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, SelectQueryBuilder } from 'typeorm';
import { DataInconsistency } from 'src/models/DataInconsistency';
import { Shipments } from 'src/models/Shipments';
import { ShipmentSeals } from 'src/models/ShipmentSeals';
import { Status } from 'src/models/Status';
import { PredefinedStatuses } from 'src/models/PredefinedStatuses';
import { TransactionLogsService } from '../../logs/services/transaction-logs.service';
import {
  ReportInconsistencyDto,
  GetInconsistenciesQueryDto,
} from '../dto/inconsistency-report.dto';
import { InconsistencyResponseDto } from '../dto/inconsistency-response.dto';
import { InconsistencyType } from '../enums/inconsistency-types.enum';
import {
  InconsistencyDataStructure,
  SealInfo,
  ShipmentPrecheckInfo,
  SealCodeRequest,
} from '../interfaces/inconsistency-data.interface';
import { Pagination } from 'src/dto/pagination';
import { NotificationService } from '../../notifications/services/notification.service';

@Injectable()
export class DataInconsistencyService {
  constructor(
    @InjectRepository(DataInconsistency)
    private dataInconsistencyRepository: Repository<DataInconsistency>,
    @InjectRepository(Shipments)
    private shipmentsRepository: Repository<Shipments>,
    @InjectRepository(ShipmentSeals)
    private shipmentSealsRepository: Repository<ShipmentSeals>,
    @InjectRepository(Status)
    private statusRepository: Repository<Status>,
    @InjectRepository(PredefinedStatuses)
    private predefinedStatusesRepository: Repository<PredefinedStatuses>,
    private transactionLogsService: TransactionLogsService,
    private notificationService: NotificationService,
  ) {}

  /**
   * Formatear fecha en formato dd/mm/yyyy HH:mm (24 horas)
   */
  private formatDateSV(date: Date): string {
    const salvadorTime = new Date(
      date.toLocaleString('en-US', {
        timeZone: 'America/El_Salvador',
      }),
    );

    const day = salvadorTime.getDate().toString().padStart(2, '0');
    const month = (salvadorTime.getMonth() + 1).toString().padStart(2, '0');
    const year = salvadorTime.getFullYear();
    const hours = salvadorTime.getHours().toString().padStart(2, '0');
    const minutes = salvadorTime.getMinutes().toString().padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  /**
   * Formatear cualquier string de la BD a formato legible
   */
  private normalizeTextForEmail(text: string | null | undefined): string {
    if (!text) return 'No especificado';

    let cleaned = text.trim();

    // Paso 1: Reemplazar guiones bajos y guiones por espacios
    cleaned = cleaned.replace(/[_-]/g, ' ');

    // Paso 2: Separar camelCase (ej: "transportistaXYZ" → "transportista XYZ")
    cleaned = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2');

    // Paso 3: Limpiar espacios múltiples
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

    // Paso 4: Capitalizar cada palabra correctamente
    return cleaned
      .toLowerCase()
      .split(' ')
      .map((word) => {
        if (word.length === 0) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }

  async reportInconsistency(
    reportData: ReportInconsistencyDto,
  ): Promise<InconsistencyResponseDto> {
    const {
      codeGen,
      reportType,
      comments,
      userId,
      license,
      trailerPlate,
      truckPlate,
      seals,
    } = reportData;

    let isUpdate = false;
    let shipment: Shipments;

    try {
      // Verificar que el envío existe con relaciones para precheck
      shipment = await this.shipmentsRepository.findOne({
        where: { codeGen },
        relations: ['driver', 'vehicle', 'ingenio'],
      });

      if (!shipment) {
        const errorMsg = `Envío con código ${codeGen} no encontrado`;
        await this.transactionLogsService.createLog({
          code_gen: codeGen,
          json_enviado: JSON.stringify(reportData),
          usuario: userId.toString(),
          estatus: 'UNKNOWN',
          motivo_invalidacion: errorMsg,
        });
        throw new NotFoundException(errorMsg);
      }

      // VALIDAR QUE EL INGENIO EXISTE
      if (!shipment.ingenio) {
        const errorMsg = `El envío ${codeGen} no tiene un ingenio asociado`;
        await this.transactionLogsService.createLog({
          code_gen: codeGen,
          json_enviado: JSON.stringify(reportData),
          usuario: userId.toString(),
          estatus: shipment.currentStatus?.toString() || 'UNKNOWN',
          motivo_invalidacion: errorMsg,
        });
        throw new BadRequestException(errorMsg);
      }

      // Verificar que el estado predefinido 13 existe
      const predefinedStatus = await this.predefinedStatusesRepository.findOne({
        where: { id: 13 },
      });

      if (!predefinedStatus) {
        const errorMsg = `Estado predefinido con ID 13 (inconsistencia) no encontrado`;
        await this.transactionLogsService.createLog({
          code_gen: codeGen,
          json_enviado: JSON.stringify(reportData),
          usuario: userId.toString(),
          estatus: shipment.currentStatus?.toString() || 'UNKNOWN',
          motivo_invalidacion: errorMsg,
        });
        throw new NotFoundException(errorMsg);
      }

      // Validar que se proporcionaron datos inconsistentes según el tipo
      try {
        await this.validateInconsistentData(reportType, reportData, shipment);
      } catch (validationError) {
        await this.transactionLogsService.createLog({
          code_gen: codeGen,
          json_enviado: JSON.stringify(reportData),
          usuario: userId.toString(),
          estatus: shipment.currentStatus?.toString() || 'UNKNOWN',
          motivo_invalidacion: validationError.message,
        });
        throw validationError;
      }

      // Buscar si ya existe un reporte para esta shipment
      let existingReport = await this.dataInconsistencyRepository.findOne({
        where: { shipment: { id: shipment.id } },
        relations: [
          'shipment',
          'shipment.driver',
          'shipment.vehicle',
          'shipment.ingenio',
          'shipment.shipmentSeals',
        ],
      });

      isUpdate = !!existingReport;
      const reportedAt = new Date().toISOString();

      // CREAR NUEVO JSON COMPLETAMENTE (NO PARSEAR DATOS EXISTENTES)
      const newInconsistencyData: InconsistencyDataStructure = {};

      if (reportType === InconsistencyType.PRECHECK) {
        // Debug para verificar los valores
        console.log('DEBUG - Datos del vehículo:', {
          vehicleId: shipment.vehicle?.id,
          plate: shipment.vehicle?.plate,
          trailerPlate: shipment.vehicle?.trailerPlate,
          truckType: shipment.vehicle?.truckType,
        });

        console.log('DEBUG - Datos del conductor:', {
          driverId: shipment.driver?.id,
          license: shipment.driver?.license,
          name: shipment.driver?.name,
        });

        // Datos reportados como inconsistentes (filtrar solo los que tienen valor)
        const reportedData: Partial<ShipmentPrecheckInfo> = {};
        if (license !== undefined) reportedData.license = license;
        if (trailerPlate !== undefined)
          reportedData.trailerPlate = trailerPlate;
        if (truckPlate !== undefined) reportedData.truckPlate = truckPlate;

        console.log('DEBUG - reportedData construido:', reportedData);

        // shipmentData solo incluye los campos que se están reportando
        const shipmentData: Partial<ShipmentPrecheckInfo> = {};
        if (license !== undefined)
          shipmentData.license = shipment.driver?.license || null;
        if (trailerPlate !== undefined)
          shipmentData.trailerPlate = shipment.vehicle?.trailerPlate || null;
        if (truckPlate !== undefined)
          shipmentData.truckPlate = shipment.vehicle?.plate || null;

        console.log(
          'DEBUG - shipmentData construido (solo campos reportados):',
          shipmentData,
        );

        newInconsistencyData.precheck = {
          reportedData,
          shipmentData,
          reportedAt,
          reportedBy: userId.toString(),
        };

        console.log(
          'DEBUG - newInconsistencyData.precheck:',
          newInconsistencyData.precheck,
        );
      } else if (reportType === InconsistencyType.SEALS) {
        // Obtener TODOS los seals del shipment ordenados por createdAt
        const allShipmentSeals = await this.shipmentSealsRepository.find({
          where: { shipment: { id: shipment.id } },
          order: { createdAt: 'ASC' },
        });

        // Crear estructura dinámica para los seals del shipment
        const shipmentSeals: SealInfo[] = allShipmentSeals.map((seal) => ({
          id: seal.id,
          sealCode: seal.sealCode,
        }));

        // USAR DIRECTAMENTE LOS SEALS SIN NINGUNA MODIFICACIÓN
        console.log('DEBUG - Seals recibidos del frontend (SIN TOCAR):', seals);

        // USAR LOS SEALS EXACTAMENTE COMO VIENEN DEL FRONTEND
        const reportedSeals: SealCodeRequest[] = seals
          ? seals.map((seal) => ({
              position: seal.position,
              sealCode: seal.sealCode,
            }))
          : [];

        console.log('DEBUG - reportedSeals (SIN MODIFICAR):', reportedSeals);
        console.log('DEBUG - shipmentSeals:', shipmentSeals);

        newInconsistencyData.seals = {
          reportedSeals: reportedSeals,
          shipmentSeals,
          reportedAt,
          reportedBy: userId.toString(),
        };
      }

      let savedReport: DataInconsistency;
      const currentDate = new Date();

      if (existingReport) {
        // REEMPLAZAR COMPLETAMENTE - NO preservar datos anteriores
        // IMPORTANTE: Actualizar TAMBIÉN createdAt en cada POST
        existingReport.inconsistencyType = JSON.stringify(newInconsistencyData);
        existingReport.comments = comments || null;
        existingReport.userId = userId;
        existingReport.createdAt = currentDate; // Actualizar createdAt en cada POST
        existingReport.updatedAt = null; // Establecer updatedAt en null para nuevos reportes

        savedReport =
          await this.dataInconsistencyRepository.save(existingReport);
      } else {
        // Crear nuevo reporte
        const dataInconsistency = this.dataInconsistencyRepository.create({
          shipment,
          inconsistencyType: JSON.stringify(newInconsistencyData),
          comments: comments || null,
          userId,
          createdAt: currentDate,
        });

        savedReport =
          await this.dataInconsistencyRepository.save(dataInconsistency);
      }

      // ACTUALIZAR EL ESTADO DEL SHIPMENT A 13 (INCONSISTENCIA REPORTADA)
      // IMPORTANTE: Tanto para PRECHECK como para SEALS el estado cambia a 13
      const previousStatus = shipment.currentStatus;
      shipment.currentStatus = 13;
      shipment.dateTimeCurrentStatus = currentDate;

      await this.shipmentsRepository.save(shipment);

      // REGISTRAR EL CAMBIO DE ESTADO EN LA TABLA STATUS
      try {
        const statusRecord = this.statusRepository.create({
          shipment: shipment,
          predefinedStatus: predefinedStatus,
          createdAt: currentDate,
        });

        await this.statusRepository.save(statusRecord);
      } catch (statusError) {
        console.warn(`Error al registrar estado: ${statusError.message}`);
        // No lanzar error, ya que el reporte principal se guardó correctamente
      }

      // REGISTRAR LOG DE TRANSACCIÓN EXITOSA
      // IMPORTANTE: En este punto el shipment ya tiene currentStatus = 13 (tanto para PRECHECK como SEALS)
      await this.transactionLogsService.createLog({
        code_gen: codeGen,
        json_enviado: JSON.stringify(reportData),
        usuario: userId.toString(),
        estatus: shipment.currentStatus.toString(),
        json_modificacion: JSON.stringify({
          ...newInconsistencyData,
          reportType: reportType,
          previousStatus: previousStatus,
          newStatus: shipment.currentStatus,
          isUpdate: isUpdate,
          createdAtUpdated: currentDate.toISOString(),
        }),
      });

      // ===== EMITIR NOTIFICACIÓN DE NUEVA INCONSISTENCIA =====
      try {
        const ingenioCode = shipment.ingenio.ingenioCode;

        // Formatear fecha del reporte
        const reportDate = this.formatDateSV(currentDate);

        // Determinar tipo de inconsistencia en texto
        const inconsistencyTypeText =
          reportType === InconsistencyType.PRECHECK
            ? 'Licencia o Placas'
            : 'Marchamos';

        // Preparar datos del template
        const commonTemplateData = {
          shipmentCode: codeGen,
          ingenioName: this.normalizeTextForEmail(shipment.ingenio.name),
          driverName:
            this.normalizeTextForEmail(shipment.driver?.name) || 'N/A',
          driverLicense: shipment.driver?.license || 'N/A',
          truckPlate: shipment.vehicle?.plate || 'N/A',
          trailerPlate: shipment.vehicle?.trailerPlate || 'N/A',
          inconsistencyType: inconsistencyTypeText,
          reportDate,
          comments: comments || 'Sin comentarios adicionales',
        };

        // SIEMPRE SE ENVÍA A ASOCIACIÓN Y AL INGENIO
        const mixedTargets = {
          allUsersInRoles: [3], // Asociación (rol 3) - TODOS
          specificUsers: {
            4: [ingenioCode], // Ingenio cliente específico (rol 4)
          },
        };

        // Emitir evento sin bloquear
        this.notificationService
          .emit({
            type: 'email',
            eventName: 'inconsistency-reported.email',
            data: {
              templatesByRole: {
                3: 'inconsistency-reported',
                4: 'inconsistency-reported',
              },
              subject: 'Nueva Inconsistencia Reportada',
              mixedTargets,
              templateData: commonTemplateData,
              priority: 'high' as const,
            },
            metadata: {
              referenceId: savedReport.id,
              referenceType: 'data-inconsistency',
              priority: 'high',
            },
          })
          .catch((err) => {
            console.error(
              'Error emitiendo notificación de inconsistencia (no crítico):',
              err.message,
            );
          });

        console.log(
          `Notificación de inconsistencia encolada - Asociación + Ingenio ${ingenioCode}: ${codeGen}`,
        );
      } catch (notificationError) {
        console.error(
          'Error al preparar notificación de inconsistencia:',
          notificationError,
        );
      }

      return new InconsistencyResponseDto(savedReport);
    } catch (error) {
      // REGISTRAR LOG DE ERROR SI AUN NO SE HA REGISTRADO
      const isAlreadyLogged =
        error.message.includes('no encontrado') ||
        error.message.includes('seals no existen') ||
        error.message.includes('proporcionar al menos') ||
        error.message.includes('códigos de seals no existen') ||
        error.message.includes('cantidad de seals') ||
        error.message.includes('códigos de seals duplicados');

      if (!isAlreadyLogged) {
        await this.transactionLogsService.createLog({
          code_gen: codeGen,
          json_enviado: JSON.stringify(reportData),
          usuario: userId?.toString() || 'UNKNOWN',
          estatus: shipment?.currentStatus?.toString() || 'UNKNOWN',
          motivo_invalidacion: error.message,
        });
      }

      console.error(
        `Error en reporte de inconsistencia para ${codeGen}: ${error.message}`,
      );
      throw error;
    }
  }

  async getInconsistencyByShipment(
    codeGen: string,
  ): Promise<
    | InconsistencyResponseDto
    | { message: string; codeGen: string; statusCode: number }
  > {
    const shipment = await this.shipmentsRepository.findOne({
      where: { codeGen },
    });

    if (!shipment) {
      throw new NotFoundException(`Envío con código ${codeGen} no encontrado`);
    }

    const report = await this.dataInconsistencyRepository.findOne({
      where: { shipment: { id: shipment.id } },
      relations: [
        'shipment',
        'shipment.driver',
        'shipment.vehicle',
        'shipment.ingenio',
        'shipment.shipmentSeals',
      ],
    });

    if (report) {
      return new InconsistencyResponseDto(report);
    } else {
      return {
        message: 'Envío sin inconsistencias encontradas actualmente',
        codeGen: codeGen,
        statusCode: 200,
      };
    }
  }

  // MÉTODO OPTIMIZADO PARA QUERY DE CONTEO (sin JOINs innecesarios)
  private buildCountQuery(
    filters?: GetInconsistenciesQueryDto,
  ): SelectQueryBuilder<DataInconsistency> {
    const queryBuilder = this.dataInconsistencyRepository
      .createQueryBuilder('di')
      .leftJoin('di.shipment', 's')
      .leftJoin('s.ingenio', 'i');

    return this.applyFilters(queryBuilder, filters);
  }

  // MÉTODO OPTIMIZADO PARA QUERY DE DATOS (con todos los JOINs necesarios)
  private buildDataQuery(
    filters?: GetInconsistenciesQueryDto,
  ): SelectQueryBuilder<DataInconsistency> {
    const queryBuilder = this.dataInconsistencyRepository
      .createQueryBuilder('di')
      .leftJoinAndSelect('di.shipment', 's')
      .leftJoinAndSelect('s.driver', 'd')
      .leftJoinAndSelect('s.vehicle', 'v')
      .leftJoinAndSelect('s.ingenio', 'i')
      .leftJoinAndSelect('s.shipmentSeals', 'ss');

    return this.applyFilters(queryBuilder, filters);
  }

  // MÉTODO HELPER PARA APLICAR FILTROS (reutilizable)
  private applyFilters(
    queryBuilder: SelectQueryBuilder<DataInconsistency>,
    filters?: GetInconsistenciesQueryDto,
  ): SelectQueryBuilder<DataInconsistency> {
    // Aplicar filtros de fecha si se proporcionan
    if (filters?.startDate && filters?.endDate) {
      queryBuilder.andWhere('di.createdAt BETWEEN :startDate AND :endDate', {
        startDate: new Date(`${filters.startDate}T00:00:00`),
        endDate: new Date(`${filters.endDate}T23:59:59`),
      });
    }

    // Aplicar filtro de tipo si se especifica (en SQL)
    if (filters?.reportType) {
      const typeCondition =
        filters.reportType === 'PRECHECK'
          ? 'di.inconsistencyType LIKE \'%"precheck":%\''
          : 'di.inconsistencyType LIKE \'%"seals":%\'';

      queryBuilder.andWhere(typeCondition);
    }

    // Aplicar filtro de status si se especifica (en SQL)
    if (filters?.status) {
      if (filters.status === 'PENDING') {
        queryBuilder.andWhere('di.updatedAt IS NULL');
      } else if (filters.status === 'RESOLVED') {
        queryBuilder.andWhere('di.updatedAt IS NOT NULL');
      }
    }

    return queryBuilder;
  }

  async getInconsistenciesByIngenio(
    ingenioCode: string,
    page: number = 1,
    size: number = 10,
    filters?: GetInconsistenciesQueryDto,
  ): Promise<{
    data: InconsistencyResponseDto[];
    pagination: Pagination;
  }> {
    console.log('SERVICE - getInconsistenciesByIngenio - Parámetros:', {
      ingenioCode,
      page,
      size,
      filters,
    });

    // CONSULTA OPTIMIZADA PARA CONTEO (sin JOINs innecesarios)
    const countQuery = this.buildCountQuery(filters).andWhere(
      'i.ingenioCode = :ingenioCode',
      { ingenioCode },
    );

    const totalCount = await countQuery.getCount();
    console.log('SERVICE - Total con filtros aplicados:', totalCount);

    // Si no hay registros, retornar inmediatamente
    if (totalCount === 0) {
      return {
        data: [],
        pagination: { count: 0, limit: size, offset: (page - 1) * size },
      };
    }

    // CONSULTA OPTIMIZADA PARA DATOS (solo si hay registros)
    const dataQuery = this.buildDataQuery(filters)
      .andWhere('i.ingenioCode = :ingenioCode', { ingenioCode })
      .orderBy('di.createdAt', 'DESC')
      .skip((page - 1) * size)
      .take(size);

    const data = await dataQuery.getMany();
    console.log('SERVICE - Registros obtenidos:', data.length);

    // Convertir a DTO
    const mappedData = data.map(
      (report) => new InconsistencyResponseDto(report),
    );

    const pagination: Pagination = {
      count: totalCount,
      limit: size,
      offset: (page - 1) * size,
    };

    return { data: mappedData, pagination };
  }

  async getInconsistenciesByIngenioNav(
    ingenioNavCode: string,
    page: number = 1,
    size: number = 10,
    filters?: GetInconsistenciesQueryDto,
  ): Promise<{
    data: InconsistencyResponseDto[];
    pagination: Pagination;
  }> {
    console.log('SERVICE - getInconsistenciesByIngenioNav - Parámetros:', {
      ingenioNavCode,
      page,
      size,
      filters,
    });

    // CONSULTA OPTIMIZADA PARA CONTEO (sin JOINs innecesarios)
    const countQuery = this.buildCountQuery(filters).andWhere(
      'i.ingenioNavCode = :ingenioNavCode',
      { ingenioNavCode },
    );

    const totalCount = await countQuery.getCount();
    console.log('SERVICE - Total con filtros aplicados:', totalCount);

    // Si no hay registros, retornar inmediatamente
    if (totalCount === 0) {
      return {
        data: [],
        pagination: { count: 0, limit: size, offset: (page - 1) * size },
      };
    }

    // CONSULTA OPTIMIZADA PARA DATOS (solo si hay registros)
    const dataQuery = this.buildDataQuery(filters)
      .andWhere('i.ingenioNavCode = :ingenioNavCode', { ingenioNavCode })
      .orderBy('di.createdAt', 'DESC')
      .skip((page - 1) * size)
      .take(size);

    const data = await dataQuery.getMany();
    console.log('SERVICE - Registros obtenidos:', data.length);

    // Convertir a DTO
    const mappedData = data.map(
      (report) => new InconsistencyResponseDto(report),
    );

    const pagination: Pagination = {
      count: totalCount,
      limit: size,
      offset: (page - 1) * size,
    };

    return { data: mappedData, pagination };
  }

  async getAllInconsistencies(
    page: number = 1,
    size: number = 10,
    filters?: GetInconsistenciesQueryDto,
  ): Promise<{
    data: InconsistencyResponseDto[];
    pagination: Pagination;
  }> {
    console.log('SERVICE - getAllInconsistencies - Parámetros:', {
      page,
      size,
      filters,
    });

    // CONSULTA OPTIMIZADA PARA CONTEO (sin JOINs innecesarios)
    const countQuery = this.buildCountQuery(filters);

    const totalCount = await countQuery.getCount();
    console.log('SERVICE - Total con filtros aplicados:', totalCount);

    // Si no hay registros, retornar inmediatamente
    if (totalCount === 0) {
      return {
        data: [],
        pagination: { count: 0, limit: size, offset: (page - 1) * size },
      };
    }

    // CONSULTA OPTIMIZADA PARA DATOS (solo si hay registros)
    const dataQuery = this.buildDataQuery(filters)
      .orderBy('di.createdAt', 'DESC')
      .skip((page - 1) * size)
      .take(size);

    const data = await dataQuery.getMany();
    console.log('SERVICE - Registros obtenidos:', data.length);

    // Convertir a DTO
    const mappedData = data.map(
      (report) => new InconsistencyResponseDto(report),
    );

    const pagination: Pagination = {
      count: totalCount,
      limit: size,
      offset: (page - 1) * size,
    };

    return { data: mappedData, pagination };
  }

  async getSealsByShipment(shipmentId: number): Promise<SealInfo[]> {
    const seals = await this.shipmentSealsRepository.find({
      where: { shipment: { id: shipmentId } },
      order: { createdAt: 'ASC' },
    });

    return seals.map((seal) => ({
      id: seal.id,
      sealCode: seal.sealCode,
    }));
  }

  async getSealsByShipmentCode(codeGen: string): Promise<SealInfo[]> {
    const shipment = await this.shipmentsRepository.findOne({
      where: { codeGen },
    });

    if (!shipment) {
      throw new NotFoundException(`Envío con código ${codeGen} no encontrado`);
    }

    return this.getSealsByShipment(shipment.id);
  }

  // CONSULTA OPTIMIZADA PARA ESTADÍSTICAS GENERALES
  async getInconsistenciesStats(filters?: GetInconsistenciesQueryDto): Promise<{
    total: number;
    pending: number;
    resolved: number;
  }> {
    console.log(
      'SERVICE - getInconsistenciesStats - Filtros recibidos:',
      filters,
    );

    // CONSULTA OPTIMIZADA PARA ESTADÍSTICAS (mínimos JOINs)
    const queryBuilder = this.dataInconsistencyRepository
      .createQueryBuilder('di')
      .leftJoin('di.shipment', 's')
      .leftJoin('s.ingenio', 'i')
      .select([
        'COUNT(*) as total',
        'COUNT(CASE WHEN di.updatedAt IS NULL THEN 1 END) as pending',
        'COUNT(CASE WHEN di.updatedAt IS NOT NULL THEN 1 END) as resolved',
      ]);

    // Aplicar filtros usando el método helper
    this.applyFilters(queryBuilder, filters);

    const result = await queryBuilder.getRawOne();

    const stats = {
      total: parseInt(result.total) || 0,
      pending: parseInt(result.pending) || 0,
      resolved: parseInt(result.resolved) || 0,
    };

    console.log('SERVICE - getInconsistenciesStats - Resultado:', stats);
    return stats;
  }

  async getInconsistenciesStatsByIngenioNav(
    ingenioNavCode: string,
    filters?: GetInconsistenciesQueryDto,
  ): Promise<{
    total: number;
    pending: number;
    resolved: number;
  }> {
    console.log('SERVICE - getInconsistenciesStatsByIngenioNav - Filtros:', {
      ingenioNavCode,
      filters,
    });

    // CONSULTA OPTIMIZADA PARA ESTADÍSTICAS (mínimos JOINs)
    const queryBuilder = this.dataInconsistencyRepository
      .createQueryBuilder('di')
      .leftJoin('di.shipment', 's')
      .leftJoin('s.ingenio', 'i')
      .select([
        'COUNT(*) as total',
        'COUNT(CASE WHEN di.updatedAt IS NULL THEN 1 END) as pending',
        'COUNT(CASE WHEN di.updatedAt IS NOT NULL THEN 1 END) as resolved',
      ])
      .where('i.ingenioNavCode = :ingenioNavCode', { ingenioNavCode });

    // Aplicar filtros usando el método helper
    this.applyFilters(queryBuilder, filters);

    const result = await queryBuilder.getRawOne();

    const stats = {
      total: parseInt(result.total) || 0,
      pending: parseInt(result.pending) || 0,
      resolved: parseInt(result.resolved) || 0,
    };

    console.log(
      'SERVICE - getInconsistenciesStatsByIngenioNav - Resultado:',
      stats,
    );
    return stats;
  }

  /*
        Métodos privados para lógica interna
    */
  private async validateInconsistentData(
    reportType: InconsistencyType,
    data: ReportInconsistencyDto,
    shipment: Shipments,
  ): Promise<void> {
    if (reportType === InconsistencyType.PRECHECK) {
      if (!data.license && !data.trailerPlate && !data.truckPlate) {
        throw new BadRequestException(
          'Para reportes de prechequeado debe proporcionar al menos un campo: licencia, placa remolque o placa camión',
        );
      }
    } else if (reportType === InconsistencyType.SEALS) {
      if (!data.seals || data.seals.length === 0) {
        throw new BadRequestException(
          'Para reportes de marchamos debe proporcionar al menos un código de seal',
        );
      }

      // Validar que todos los seals tienen sealCode
      const invalidSeals = data.seals.filter(
        (seal) => !seal.sealCode || seal.sealCode.trim() === '',
      );
      if (invalidSeals.length > 0) {
        throw new BadRequestException(
          'Todos los seals deben tener un código válido',
        );
      }

      // Obtener los seals del shipment para validaciones adicionales
      const shipmentSeals = await this.shipmentSealsRepository.find({
        where: { shipment: { id: shipment.id } },
        order: { createdAt: 'ASC' },
      });

      // Validar que no se reporte más marchamos de los que tiene el shipment
      if (data.seals.length > shipmentSeals.length) {
        throw new BadRequestException(
          `No se pueden reportar más marchamos (${data.seals.length}) de los que tiene el envío (${shipmentSeals.length})`,
        );
      }

      // Validar que no hay códigos duplicados en los marchamos reportados
      const reportedSealCodes = data.seals.map((seal) =>
        seal.sealCode.trim().toLowerCase(),
      );
      const uniqueSealCodes = new Set(reportedSealCodes);
      if (reportedSealCodes.length !== uniqueSealCodes.size) {
        throw new BadRequestException(
          'No se permiten códigos de marchamos duplicados en el reporte',
        );
      }
    }
  }

  private parseInconsistencyData(
    inconsistencyType: string,
  ): InconsistencyDataStructure | null {
    try {
      return JSON.parse(inconsistencyType);
    } catch (error) {
      console.warn('Error parseando inconsistency_type:', error.message);
      return null;
    }
  }
}

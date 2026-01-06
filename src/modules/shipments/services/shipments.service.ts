import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  getMetadataArgsStorage,
  LessThan,
  In,
  MoreThan,
  IsNull,
} from 'typeorm';
import { CreateShipmentDto, VehiculoDto } from '../dto/shipmentRequest.dto';
import { Shipments } from 'src/models/Shipments';
import { Drivers } from 'src/models/Drivers';
import { Status } from 'src/models/Status';
import { MassUnit } from '../enums/unitMeasure.enum';
import MassConverter from 'src/utils/massConverter.util';
import { StatusService } from 'src/modules/status/services/status.service';
import { VehiculoUpdateDto } from '../dto/updateShiment.dto';
import { ShipmentAttachments } from 'src/models/ShipmentAttachments';
import {
  getFileTypeFromExtension,
  getFileTypeFromMimeType,
  getKeyByValueEnum,
} from 'src/utils/functions.util';
import { AttachmentType, FileType } from '../enums/typeFileUpload.enum';
import ShipmentsWithFormattedStatusesAndFormatResponseAndFormatResponse from '../interfaces/ShipmentsWithFormattedStatusesAndFormatResponse.interface';
import { ProductType } from '../enums/productType.enum';
import { ShipmentSeals } from 'src/models/ShipmentSeals';
import { TipoCamion } from '../enums/tipoCamion.enum';
import { Clients } from 'src/models/Clients';
import { NavService } from 'src/modules/nav/services/nav.service';
import { LogsShipmentsService } from 'src/modules/logs/services/logs-shipments.service';
import { Vehicles } from 'src/models/Vehicles';
import { BlacklistService } from 'src/modules/blacklist/services/blacklist.service';
import { BlacklistDetailsResponseDto } from 'src/modules/blacklist/dto/BlacklistDetailsResponseDto';
import { Pagination } from 'src/dto/pagination';
import ObjectTransformer from 'src/utils/ObjectTransformer';
import { DataSource } from 'typeorm';
import { Not } from 'typeorm';
import { ShipmentTemperature } from 'src/models/ShipmentTemperature'; // según tu path
import { Brackets } from 'typeorm';
import { ShipmentTimesFilterDto } from 'src/modules/shipments/dto/shipment-times.dto';
import { Brix } from 'src/models/Brix';
import { BrixEligibleQueryDto } from '../dto/brix-query.dto';
import { AssignBrixDto } from '../dto/assign-brix.dto';
import { BlocksService } from 'src/modules/blocks/blocks.service';
import * as ExcelJS from 'exceljs';
const PdfPrinter = require('pdfmake');
import * as fs from 'fs';
import * as path from 'path';
import { IngenioLogsService } from 'src/modules/logs/services/ingenio-logs.service';
import { Role } from 'src/modules/auth/enums/roles.enum';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { OperationTime } from '../../operation-times/types/operation-time.entity';
import { ShipmentWeight } from 'src/models/ShipmentWeight';
import { RegistrarPesosDto } from '../dto/registrar-pesos.dto';
import { Comprobante } from 'src/models/Comprobante';
import { Marchamos } from 'src/models/Marchamos';
import { Locations } from 'src/models/Locations';
import { TemperatureReportFilterDto } from 'src/modules/shipments/dto/temperature-report.dto';

@Injectable()
export class ShipmentsService {
  constructor(
    @InjectRepository(Shipments)
    private readonly shipmentsRepository: Repository<Shipments>,
    @InjectRepository(Drivers)
    private driversRepository: Repository<Drivers>,
    @InjectRepository(Vehicles)
    private vehiclesRepository: Repository<Vehicles>,
    @InjectRepository(Clients)
    private clientsRepository: Repository<Clients>,
    @InjectRepository(ShipmentAttachments)
    private shipmentAttachments: Repository<ShipmentAttachments>,
    @InjectRepository(ShipmentSeals)
    private shipmentSeals: Repository<ShipmentSeals>,
    private massConverter: MassConverter,
    @Inject(forwardRef(() => StatusService))
    private statusService: StatusService,
    @InjectRepository(Brix) private readonly brixRepo: Repository<Brix>,
    @InjectRepository(ShipmentTemperature)
    private readonly temperatureRepo: Repository<ShipmentTemperature>,
    @InjectRepository(Shipments)
    private readonly shipmentRepo: Repository<Shipments>,
    @InjectRepository(OperationTime)
    private readonly opTimesRepo: Repository<OperationTime>,
    private navService: NavService,
    private logsShipmentsService: LogsShipmentsService,
    private readonly blocksService: BlocksService,
    private blacklistService: BlacklistService,
    private readonly dataSource: DataSource,
    private readonly http: HttpService,
    private ingenioLogsService: IngenioLogsService,
    @InjectRepository(Comprobante)
    private readonly comprobanteRepo: Repository<Comprobante>,
    @InjectRepository(Marchamos)
    private readonly marchamosRepo: Repository<Marchamos>,
    @InjectRepository(ShipmentWeight)
    private readonly weightRepo: Repository<ShipmentWeight>,
    @InjectRepository(Locations)
    private readonly locationsRepo: Repository<Locations>,
  ) {}

  /** Une base + path sin dobles slashes */
  private joinUrl(base: string, path: string) {
    const b = (base || '').replace(/\/+$/, '');
    const p = (path || '').replace(/^\/+/, '');
    return `${b}/${p}`;
  }

  /**
   * Obtener nombre del producto a partir del codigo
   */
  private getProductNameByCode(productCode: string): string {
    const productName = Object.keys(ProductType).find(
      (key) => ProductType[key as keyof typeof ProductType] === productCode,
    );
    if (productName) return productName;
    return 'N/A';
  }

  async pingMiddleware() {
    // Usa tu URL base y reemplaza la ruta por /health
    const base =
      process.env.MW_UPDATE_TEMP_URL ||
      'http://localhost:5063/api/shipment/update-temperature-nav';
    const healthUrl = base.replace('/update-temperature-nav', '/health');

    try {
      const t0 = Date.now();
      const resp = await firstValueFrom(
        this.http.get(healthUrl, {
          timeout: 3000,
          validateStatus: () => true,
        }),
      );
      return {
        url: healthUrl,
        ok: resp.status === 200,
        status: resp.status,
        ms: Date.now() - t0,
        body: resp.data,
      };
    } catch (e: any) {
      return {
        url: healthUrl,
        ok: false,
        error: e?.message ?? String(e),
      };
    }
  }

  /**
   * Helper para determinar si se debe registrar logs de ingenio
   */
  private shouldLogIngenio(userFromSession?: any): boolean {
    if (!userFromSession) return false;
    const roles = userFromSession.roles || [];
    return roles.includes(Role.CLIENT);
  }

  /**
   * Helper para generar username para logs
   */
  private generateUsernameForLog(
    userFromSession?: any,
    ingenioCode?: string,
  ): string {
    if (!userFromSession) return 'UNKNOWN';

    const roles = userFromSession.roles || [];
    if (roles.includes(Role.CLIENT)) {
      return `${userFromSession.username}`;
    }

    return userFromSession.username || 'UNKNOWN';
  }

  /* 
        Método helper para limpiar y validar el número de estado
        corrige casos donde viene como string '3,3' o similar
    */
  private cleanStatusId(currentStatus: any): number {
    if (currentStatus === null || currentStatus === undefined) {
      return 0;
    }
    return parseInt(String(currentStatus).split(',')[0]);
  }

  async createShipment(
    createShipmentDto: CreateShipmentDto,
    mapping: boolean = false,
    userFromSession?: any,
  ): Promise<
    { shipment?: Shipments; logs: string[] } | BlacklistDetailsResponseDto
  > {
    const {
      codigo_gen,
      producto,
      tipo_operacion,
      tipo_carga,
      vehiculo,
      transportista,
      codigo_ingenio,
      cantidad_producto,
      unidad_medida,
      require_barrido,
      peso_bruto,
      peso_tara,
      marchamos,
    } = createShipmentDto;

    console.log('Producto recibido:', producto);
    console.log('Tipo del producto:', typeof producto);
    console.log("¿Es igual a 'MEL-001'?:", producto === 'MEL-001');
    console.log(
      '¿Es igual a ProductType.MELAZA?:',
      producto === ProductType.MELAZA,
    );

    const logs: string[] = [];
    const driverLicense = createShipmentDto.vehiculo.motorista.licencia;

    // Determinar si se deben registrar logs de ingenio
    const shouldLog = this.shouldLogIngenio(userFromSession);
    const usernameForLog = this.generateUsernameForLog(
      userFromSession,
      codigo_ingenio,
    );

    try {
      console.log('=== LOG INGENIOS ===');
      console.log('shouldLog:', shouldLog);
      console.log('usernameForLog:', usernameForLog);
      console.log('IngenioLogsService disponible:', !!this.ingenioLogsService);
      console.log('============================');

      // Log de inicio de creación (solo para clientes)
      if (shouldLog) {
        await this.ingenioLogsService.logIngenioSuccess(
          codigo_gen,
          usernameForLog,
          '200',
          'CREATE_SHIPMENT_START',
          createShipmentDto,
        );
      }

      // =============================================
      // TODAS LAS VALIDACIONES ANTES DE CREAR NADA
      // =============================================

      // 1. Verificación de blacklist
      const blacklistCheck =
        await this.blacklistService.getBlacklistDetails(driverLicense);
      if (!blacklistCheck.isBanEnded) {
        // Caso especial: registrar log porque no va al catch
        if (shouldLog) {
          await this.ingenioLogsService.logIngenioError(
            codigo_gen,
            usernameForLog,
            '400',
            `Driver ${driverLicense} is blacklisted`,
            createShipmentDto,
          );
        }
        return blacklistCheck;
      } else {
        console.log('Verificación de blacklist pasada');
      }

      console.log('esto es lo que viene: ', unidad_medida);

      // 2. Validación de unidad de medida
      if (!Object.values(MassUnit).includes(unidad_medida as MassUnit)) {
        const validUnits = Object.values(MassUnit).join(', ');
        const errorMsg = `Invalid unit of measure. Available units: ${validUnits}`;
        // NO registrar log aquí - se hará en el catch
        throw new ConflictException(errorMsg);
      } else {
        console.log('Validación de unidad de medida pasada');
      }

      // 3. Verificación de existencia de envío
      const existShipment = await this.shipmentsRepository.findOne({
        where: { codeGen: codigo_gen },
      });
      if (existShipment) {
        const errorMsg = `El envío con código ${codigo_gen} ya existe.`;
        // NO registrar log aquí - se hará en el catch
        throw new ConflictException(errorMsg);
      } else {
        console.log(
          'Verificación de duplicados pasada para código:',
          codigo_gen,
        );
      }

      // 4. Búsqueda del cliente/ingenio
      const client = await this.clientsRepository.findOne({
        where: { ingenioCode: codigo_ingenio },
        relations: ['user'],
      });
      if (!client) {
        const errorMsg = `Ingenio no encontrado con código ${codigo_ingenio}.`;
        // NO registrar log aquí - se hará en el catch
        throw new NotFoundException(errorMsg);
      } else {
        console.log('Cliente encontrado:', client);
      }
      await this.blocksService.assertNotBlocked(codigo_ingenio, producto);
      logs.push(`Ingenio encontrado: ${client.user.username}.`);

      // 5. Crear/buscar driver y vehicle
      const driver = await this.findOrCreateDriver(vehiculo.motorista, logs);
      const vehicle = await this.findOrCreateVehicle(vehiculo, logs);

      console.log('Driver y Vehicle procesados:', { driver, vehicle });

      // 6. Validación para camión tipo P si el producto es Melaza
      if (producto === ProductType.MELAZA && vehicle.truckType !== 'P') {
        const errorMsg =
          'Para el producto MELAZA, el tipo de camión debe ser "P".';
        // NO registrar log aquí - se hará en el catch
        throw new BadRequestException(errorMsg);
      }
      if (producto !== ProductType.MELAZA && vehicle.truckType === 'P') {
        const errorMsg =
          'El tipo de camión "P" solo está permitido para el producto MELAZA.';
        // NO registrar log aquí - se hará en el catch
        throw new BadRequestException(errorMsg);
      } else {
        console.log(
          'Validación de tipo de camión pasada para producto:',
          producto,
        );
      }

      // 7. Validación: require_barrido es obligatorio si el producto NO es MELAZA
      if (producto !== ProductType.MELAZA && require_barrido === undefined) {
        const errorMsg =
          'El campo "require_barrido" es obligatorio para productos que no son MELAZA.';
        // NO registrar log aquí - se hará en el catch
        throw new BadRequestException(errorMsg);
      } else {
        console.log(
          'Validación de require_barrido pasada para producto:',
          producto,
        );
      }

      // 8. Validación de marchamos (según producto)
      const normalizedSeals = Array.isArray(marchamos)
        ? marchamos
            .map((m) => (m ?? '').toString().trim().toUpperCase())
            .filter((m) => m.length > 0)
        : [];

      const isMelaza = producto === 'MEL-001';
      const isAzucar = producto === 'AZ-001';

      // Reglas por producto
      if (isAzucar) {
        const sealsCount = normalizedSeals.length;
        const plural = sealsCount === 1 ? 'marchamo' : 'marchamos';

        if (sealsCount < 4) {
          throw new BadRequestException(
            `Para Azúcar debes agregar 4 marchamos; actualmente se han enviado ${sealsCount} ${plural}.`,
          );
        }

        if (sealsCount > 4) {
          throw new BadRequestException(
            `Para Azúcar no se permite asignar esa cantidad de ${plural}; deben ser exactamente 4. Actualmente se han enviado ${sealsCount} ${plural}.`,
          );
        }
      }

      if (isMelaza) {
        const sealsCount = normalizedSeals.length;
        const plural = sealsCount === 1 ? 'marchamo' : 'marchamos';

        if (sealsCount < 1) {
          throw new BadRequestException(
            'Para Melaza debes agregar al menos 1 marchamo.',
          );
        }

        if (sealsCount >= 4) {
          throw new BadRequestException(
            `Para Melaza no se permite asignar esa cantidad de ${plural}; el máximo permitido es 3. Actualmente se han enviado ${sealsCount} ${plural}.`,
          );
        }
      }

      // Duplicados dentro del payload
      const seen = new Set<string>();
      const dupes = normalizedSeals.filter((m) =>
        seen.has(m) ? true : (seen.add(m), false),
      );
      if (dupes.length > 0) {
        throw new BadRequestException(
          `Hay marchamos repetidos en la solicitud: ${[...new Set(dupes)].join(', ')}. Cada marchamo debe ser único.`,
        );
      }

      // Verificar que no estén en uso en otro envío EN PROCESO (current_status < 12)
      if (normalizedSeals.length > 0) {
        const inUse = await this.shipmentSeals
          .createQueryBuilder('seal')
          .innerJoin('seal.shipment', 's')
          .where('UPPER(seal.sealCode) IN (:...codes)', {
            codes: normalizedSeals,
          })
          .andWhere('s.currentStatus < :done', { done: 12 }) // “en proceso”
          .getMany();

        if (inUse.length > 0) {
          const taken = [
            ...new Set(
              inUse.map((x) => x.sealCode?.toString().trim().toUpperCase()),
            ),
          ];
          throw new BadRequestException(
            `Los siguientes marchamos ya están asociados a otro envío: ${taken.join(', ')}.`,
          );
        }
      }

      if (normalizedSeals.length > 0) {
        console.log(
          `Validación de marchamos pasada: ${normalizedSeals.length} marchamo(s) para producto ${producto}`,
        );
      }

      // =============================================
      // TODAS LAS VALIDACIONES PASARON - AHORA SÍ CREAR
      // =============================================

      const unitMeasure = unidad_medida as MassUnit;
      const productQuantityKg = this.massConverter.convert(
        cantidad_producto,
        unitMeasure,
        MassUnit.Kilogram,
      );

      console.log('Peso convertido:', productQuantityKg);
      const pesoBrutoNum = this.parseAndValidatePeso('peso_bruto', peso_bruto, {
        allowComma: false,
      });
      const pesoTaraNum = this.parseAndValidatePeso('peso_tara', peso_tara, {
        allowComma: false,
      });

      // Creación del shipment (UNA SOLA VEZ)
      const shipment = this.shipmentsRepository.create({
        codeGen: codigo_gen,
        product: producto,
        operationType: tipo_operacion,
        loadType: tipo_carga,
        transporter: transportista.nombre,
        productQuantity: cantidad_producto,
        productQuantityKg: productQuantityKg,
        pesoBruto: pesoBrutoNum,
        pesoTara: pesoTaraNum,
        unitMeasure: unitMeasure,
        driver,
        vehicle,
        ingenio: client,
        mapping: mapping,
        requiresSweeping:
          producto === ProductType.MELAZA ? 'N' : require_barrido,
        activityNumber: '2', // El dos está quemado ahorita por que ahorita todo será azúcar y melaza
      });

      const shipmentRegisterSave =
        await this.shipmentsRepository.save(shipment);

      if (shouldLog) {
        console.log('Shipment creado con ID:', shipmentRegisterSave.id);
      }

      // Actualización de estado
      this.statusService.updateStatusesForShipment(codigo_gen, 1);

      if (shouldLog) {
        console.log('Estado inicial actualizado para shipment:', codigo_gen);
      }

      // Procesamiento de marchamos
      if (marchamos && marchamos.length > 0) {
        const shipmentSeals = marchamos.map((sealCode) => {
          return this.shipmentSeals.create({
            sealCode: sealCode,
            sealDescription: null,
            shipment: shipmentRegisterSave,
          });
        });

        await this.shipmentSeals.save(shipmentSeals);
        console.log('Marchamos procesados:', marchamos);
      }

      logs.push(`Envío creado con éxito: ${shipment.codeGen}.`);

      // Log de éxito final de creación (solo para clientes)
      if (shouldLog) {
        await this.ingenioLogsService.logIngenioSuccess(
          codigo_gen,
          usernameForLog,
          '1',
          'CREATE_SHIPMENT_SUCCESS',
          createShipmentDto,
          {
            shipmentId: shipmentRegisterSave.id,
            codeGen: codigo_gen,
            driver: driver.license,
            vehicle: vehicle.plate,
            logs: logs,
            completedAt: new Date().toISOString(),
          },
        );
      }

      return { shipment: shipmentRegisterSave, logs };
    } catch (error) {
      // ÚNICO lugar donde se registran logs de error
      if (shouldLog) {
        await this.ingenioLogsService.logIngenioError(
          codigo_gen,
          usernameForLog,
          '400',
          error.message,
          createShipmentDto,
        );
      }

      throw error;
    }
  }

  async getShipmentByCodeNullable(codeGen: string): Promise<Shipments | null> {
    const shipment = this.shipmentsRepository.findOne({
      where: {
        codeGen: codeGen,
      },
    });

    if (!shipment) {
      return null;
    }

    return shipment;
  }

  async getShipmentByCode(
    codeGen: string,
    includeAttachments: boolean = false,
    forClients: boolean = false,
  ): Promise<ShipmentsWithFormattedStatusesAndFormatResponseAndFormatResponse> {
    const shipment = await this.shipmentsRepository.findOne({
      where: { codeGen },
      relations: [
        'driver',
        'vehicle',
        'statuses',
        'ingenio',
        'shipmentTemperatures',
        'ingenio.user',
        'shipmentSeals',
      ],
    });

    if (!shipment) {
      throw new NotFoundException('No se encontro envio ' + codeGen);
    }

    const statuses: StatusResponse[] =
      await this.statusService.getStatusByCodeGen(
        shipment.codeGen,
        false,
        forClients,
      );

    // =============================
    //  Comprobante de báscula
    // =============================
    const comprobante = await this.comprobanteRepo.findOne({
      where: {
        idShipment: shipment.id,
        status: 0, // 0 = activo/asignado
      },
      order: { createdAt: 'DESC' },
    });

    const no_comprobante = comprobante
      ? {
          id: comprobante.id,
          number: comprobante.noComprobante,
          status: comprobante.status,
          createdAt: comprobante.createdAt,
        }
      : null;

    // =============================
    //  Marchamos registrados
    // =============================
    const marchamos = await this.marchamosRepo.find({
      where: {
        // 👈 aquí usamos la relación 'shipment', no la columna 'shipment_id'
        shipment: {
          id: shipment.id,
        },
      },
      order: { createdAt: 'DESC' },
    });

    const marchamosFormatted = marchamos.map((m) => ({
      id: m.id,
      code: m.sealCode,
      status: m.status,
      createdAt: m.createdAt,
    }));

    // =============================
    //  Humedad
    // =============================
    const humidity =
      (shipment as any).humidity !== undefined
        ? (shipment as any).humidity
        : null;

    /*
     Nav record solamente existe cuando el status haya sido mayor o igual a 3
     (O sea la transaccion haya sido autorizada) o mejor,
     cuando la columna de idnavrecord sea diferente a null
   */
    const navRecord =
      shipment.idNavRecord !== null
        ? await this.navService.get(shipment.codeGen, forClients)
        : null;

    // Armamos igual que antes, pero como any para poder agregar campos nuevos
    const formattedShipment: any = {
      nameProduct: getKeyByValueEnum(shipment.product, ProductType),
      truckType: getKeyByValueEnum(shipment.vehicle.truckType, TipoCamion),
      ...shipment,
      statuses,
      ...(includeAttachments && {
        shipmentAttachments: await this.getAttachmentsByCodeGen(
          shipment.codeGen,
          AttachmentType.PRECHECK_DRIVER,
        ),
      }),
      navRecord: navRecord,

      // ✅ Nuevos campos
      no_comprobante,
      humidity,
      marchamos: marchamosFormatted,
    };

    // =========================
    // PESOS: NAV vs INGENIO
    // =========================
    const weights = await this.weightRepo.find({
      where: { shipment: { id: shipment.id } },
      relations: ['shipment'],
      order: { datetime_in: 'ASC', id: 'ASC' },
    });

    const pesosSummary = this.buildWeightsSummary(weights, shipment);
    formattedShipment.Pesos = pesosSummary;

    // =========================
    // Download time
    // =========================
    const dl = await this.opTimesRepo.findOne({
      where: { shipmentId: shipment.id },
      order: { createdAt: 'DESC' },
    });

    if (dl) {
      formattedShipment.downloadTime = {
        duration: dl.duration,
        observation: dl.comment,
        createdAt: dl.createdAt,
      };
    }

    formattedShipment.Temperature = shipment.shipmentTemperatures?.map(
      (temp, index) => ({
        registro: index + 1,
        temperature: temp.temperature,
        createdAt: temp.created_at,
      }),
    );

    // Ya no queremos devolver el arreglo crudo
    delete formattedShipment.shipmentTemperatures;

    // Normaliza como siempre
    const normalized = this.normalizeShipment(
      formattedShipment,
      forClients,
    ) as any;

    // Eliminar 'buzzer' del resultado
    delete normalized.buzzer;

    // Reordenar para que 'nameProduct' vaya inmediatamente después de 'id'
    const { id, nameProduct, ...rest } = normalized;

    return {
      id,
      nameProduct,
      ...rest,
    } as ShipmentsWithFormattedStatusesAndFormatResponseAndFormatResponse;
  }

  async getShipmentsByIngenio(
    codigoIngenio: string,
    page: number,
    size: number,
    start?: Date,
    end?: Date,
    forClients: boolean = false,
  ): Promise<{
    data: ShipmentsWithFormattedStatusesAndFormatResponseAndFormatResponse[];
    pagination: Pagination;
  }> {
    // 0) Validación de ingenio
    const ingenioExists = await this.clientsRepository.findOne({
      where: { ingenioCode: codigoIngenio },
    });
    if (!ingenioExists) {
      throw new NotFoundException(
        `Ingenio con código ${codigoIngenio} no existe`,
      );
    }

    // 1) Filtros base
    const whereConditions: any = { 'ingenio.ingenioCode': codigoIngenio };
    if (start && !end) {
      whereConditions['createdAt'] = Between(start, start);
    } else if (start && end) {
      whereConditions['createdAt'] = Between(start, end);
    }

    // 2) Traer envíos paginados
    const [shipments, totalRecords] =
      await this.shipmentsRepository.findAndCount({
        where: whereConditions,
        relations: [
          'driver',
          'vehicle',
          'ingenio',
          'statuses',
          'statuses.predefinedStatus',
        ],
        skip: (page - 1) * size,
        take: size,
        order: { createdAt: 'DESC' },
      });

    if (!shipments?.length) {
      throw new NotFoundException(
        `No se encontraron registros con estos filtros: ` +
          `codigoIngenio: ${codigoIngenio}, ` +
          `page: ${page}, size: ${size}, ` +
          `start: ${start ? start.toISOString() : 'no especificado'}, ` +
          `end: ${end ? end.toISOString() : 'no especificado'}, ` +
          `forClients: ${forClients}`,
      );
    }

    const ids = shipments.map((s) => s.id);

    // 3) Trae el último OperationTime por shipment
    const allTimes = await this.opTimesRepo.find({
      where: { shipmentId: In(ids) },
      order: { createdAt: 'DESC' },
    });

    const bestByShipmentId = new Map<number, OperationTime>();
    for (const t of allTimes) {
      if (!bestByShipmentId.has(t.shipmentId))
        bestByShipmentId.set(t.shipmentId, t);
    }

    // 4) Adjunta statuses, NAV record y downloadTime
    const withStatusesAndNav = await Promise.all(
      shipments.map(async (shipment) => {
        const statuses = await this.statusService.formatStatusByShipment(
          shipment,
          false,
          forClients,
        );

        /*
                  NAV record: solo si el idNavRecord es diferente de null
                  (equivale a una transacción autorizada, status >= 3)
                */
        const navRecord =
          shipment.idNavRecord !== null
            ? await this.navService.get(shipment.codeGen, forClients)
            : null;

        const t = bestByShipmentId.get(shipment.id);

        const base: any = {
          ...shipment,
          statuses,
          navRecord,
        };

        if (t) {
          base.downloadTime = {
            duration: t.duration,
            observation: (t as any).comment,
            createdAt: t.createdAt,
          };
        }

        return base;
      }),
    );

    // 5) Normalización y limpieza
    let normalized = this.normalizeShipment(
      withStatusesAndNav,
      forClients,
    ) as any[];

    normalized = normalized.map((n, idx) => {
      const s = shipments[idx];
      const t = bestByShipmentId.get(s.id);
      return {
        ...n,
        ...(t && {
          downloadTime: {
            duration: t.duration,
            observation: (t as any).comment,
            createdAt: t.createdAt,
          },
        }),
      };
    });

    // 6) Limpieza final y reordenamiento
    const data = normalized.map((item: any) => {
      const { id, product, buzzer, ...rest } = item;
      return {
        id,
        nameProduct: getKeyByValueEnum(product, ProductType),
        ...rest,
      };
    });

    const pagination: Pagination = {
      count: totalRecords,
      limit: size,
      offset: (page - 1) * size,
    };

    return { data, pagination };
  }

  async getAllShipments(
    page: number,
    size: number,
    startDate?: string,
    endDate?: string,
    search?: string,
    nameProduct?: string,
    truckType?: string,
    excludeStatus?: string,
    includeAttachments: boolean = false,
    includeStatuses: boolean = false,
    forClients: boolean = false,
  ): Promise<{
    data: ShipmentsWithFormattedStatusesAndFormatResponseAndFormatResponse[];
    pagination: Pagination;
  }> {
    console.log(`[ShipmentsService.getAllShipments] Parámetros:`, {
      page,
      size,
      startDate,
      endDate,
      search,
      nameProduct,
      truckType,
      excludeStatus,
      includeAttachments,
      includeStatuses,
      forClients,
    });

    const queryBuilder = this.shipmentsRepository
      .createQueryBuilder('shipment')
      .leftJoinAndSelect('shipment.driver', 'driver')
      .leftJoinAndSelect('shipment.vehicle', 'vehicle')
      .leftJoinAndSelect('shipment.ingenio', 'ingenio')
      .leftJoinAndSelect('shipment.shipmentSeals', 'shipmentSeals')
      .leftJoinAndSelect(
        'shipment.shipmentTemperatures',
        'shipmentTemperatures',
      );

    if (includeAttachments) {
      queryBuilder.leftJoinAndSelect(
        'shipment.shipmentAttachments',
        'shipmentAttachments',
      );
    }

    // Filtro por fechas
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      queryBuilder.andWhere(
        'shipment.createdAt BETWEEN :startDate AND :endDate',
        {
          startDate: start,
          endDate: end,
        },
      );
    } else if (startDate) {
      const start = new Date(startDate);
      queryBuilder.andWhere('shipment.createdAt >= :startDate', {
        startDate: start,
      });
    } else if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      queryBuilder.andWhere('shipment.createdAt <= :endDate', {
        endDate: end,
      });
    }

    // Filtro por producto
    if (nameProduct && nameProduct.trim()) {
      const productCode = this.getProductCodeFromName(nameProduct.trim());
      if (productCode) {
        queryBuilder.andWhere('shipment.product = :product', {
          product: productCode,
        });
      }
    }

    // Filtro por tipo de camión
    if (truckType && truckType.trim()) {
      const truckCode = this.getTruckCodeFromName(truckType.trim());
      if (truckCode) {
        queryBuilder.andWhere('vehicle.truckType = :truckType', {
          truckType: truckCode,
        });
      }
    }

    // Filtro para excluir estados
    if (excludeStatus && excludeStatus.trim()) {
      const statusesToExclude = this.parseStatusList(excludeStatus.trim());
      if (statusesToExclude.length > 0) {
        queryBuilder.andWhere(
          'shipment.currentStatus NOT IN (:...excludeStatuses)',
          {
            excludeStatuses: statusesToExclude,
          },
        );
      }
    }

    // Filtro de búsqueda
    if (search && search.trim()) {
      const searchTerm = search.trim();
      queryBuilder.andWhere(
        `(
                    shipment.codeGen LIKE :search OR
                    shipment.product LIKE :search OR
                    shipment.transporter LIKE :search OR
                    driver.name LIKE :search OR
                    driver.license LIKE :search OR
                    vehicle.plate LIKE :search OR
                    vehicle.trailerPlate LIKE :search OR
                    ingenio.ingenioCode LIKE :search
                )`,
        { search: `%${searchTerm}%` },
      );
    }

    // Paginación y ordenamiento
    queryBuilder
      .orderBy('shipment.createdAt', 'DESC')
      .skip((page - 1) * size)
      .take(size);

    try {
      const [shipments, totalCount] = await queryBuilder.getManyAndCount();

      if (!shipments || shipments.length === 0) {
        return {
          data: [],
          pagination: {
            count: 0,
            limit: size,
            offset: (page - 1) * size,
          },
        };
      }

      const formattedShipments = await Promise.all(
        shipments.map(
          async (
            shipment,
          ): Promise<ShipmentsWithFormattedStatusesAndFormatResponseAndFormatResponse> => {
            try {
              let statuses: StatusResponse[] = [];
              if (includeStatuses) {
                try {
                  statuses = await this.statusService.getStatusByCodeGen(
                    shipment.codeGen,
                    false,
                    forClients,
                  );
                } catch (statusError) {
                  statuses = [];
                }
              }

              const temps = shipment.shipmentTemperatures ?? [];
              const formattedShipment: ShipmentsWithFormattedStatusesAndFormatResponseAndFormatResponse =
                {
                  nameProduct: getKeyByValueEnum(shipment.product, ProductType),
                  truckType: getKeyByValueEnum(
                    shipment.vehicle?.truckType,
                    TipoCamion,
                  ),
                  ...shipment,
                  statuses,
                  ...(includeAttachments &&
                    shipment.shipmentAttachments && {
                      shipmentAttachments: shipment.shipmentAttachments,
                    }),
                };

              // 👉 añadir después, sobre un objeto ya creado (cast leve para evitar choque de tipos)
              (formattedShipment as any).Temperature = temps.map(
                (temp, tempIndex) => ({
                  registro: tempIndex + 1,
                  temperature: temp.temperature,
                  createdAt: temp.created_at,
                }),
              );

              delete (formattedShipment as any).shipmentTemperatures;
              return formattedShipment;
            } catch (error) {
              const temps2 = shipment.shipmentTemperatures ?? [];
              const basicShipment: ShipmentsWithFormattedStatusesAndFormatResponseAndFormatResponse =
                {
                  nameProduct:
                    getKeyByValueEnum(shipment.product, ProductType) ||
                    'UNKNOWN',
                  truckType:
                    getKeyByValueEnum(
                      shipment.vehicle?.truckType,
                      TipoCamion,
                    ) || 'UNKNOWN',
                  ...shipment,
                  statuses: [],
                  ...(includeAttachments &&
                    shipment.shipmentAttachments && {
                      shipmentAttachments: shipment.shipmentAttachments,
                    }),
                };

              (basicShipment as any).Temperature = temps2.map(
                (temp, tempIndex) => ({
                  registro: tempIndex + 1,
                  temperature: temp.temperature,
                  createdAt: temp.created_at,
                }),
              );

              delete (basicShipment as any).shipmentTemperatures;
              return basicShipment;
            }
          },
        ),
      );

      const normalizedShipments = this.normalizeShipment(
        formattedShipments,
        forClients,
      );

      const result = {
        data: normalizedShipments,
        pagination: {
          count: totalCount,
          limit: size,
          offset: (page - 1) * size,
        },
      };

      console.log(`[ShipmentsService.getAllShipments] Resultado:`, {
        totalRecords: totalCount,
        returnedRecords: result.data.length,
        pagination: result.pagination,
      });

      return result;
    } catch (queryError) {
      console.error(
        `[ShipmentsService.getAllShipments] Error:`,
        queryError.message,
      );
      throw new InternalServerErrorException(
        `Error obteniendo lista de envíos: ${queryError.message}`,
      );
    }
  }

  private parseStatusList(statusList: string): number[] {
    try {
      return statusList
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== '')
        .map((s) => parseInt(s))
        .filter((n) => !isNaN(n) && n >= 0);
    } catch (error) {
      console.error(
        `[ShipmentsService.parseStatusList] Error parseando estados:`,
        error,
      );
      return [];
    }
  }

  private getProductCodeFromName(nameProduct: string): string | null {
    const productMapping = {
      MELAZA: 'MEL-001',
      AZUCAR_CRUDO_GRANEL: 'AZ-001',
      AZUCAR_CRUDO: 'AZ-002',
    };

    return productMapping[nameProduct.toUpperCase()] || null;
  }

  private getTruckCodeFromName(truckTypeName: string): string | null {
    const truckMapping = {
      PIPA: 'P',
      VOLTEO: 'V',
      RASTRA: 'R',
    };

    return truckMapping[truckTypeName.toUpperCase()] || null;
  }

  private async findOrCreateDriver(motorista, logs: string[]) {
    let driver = await this.driversRepository.findOne({
      where: { license: motorista.licencia },
    });
    if (driver) {
      logs.push(
        `Conductor encontrado: ${driver.name} con licencia ${motorista.licencia}.`,
      );
    } else {
      driver = this.driversRepository.create({
        license: motorista.licencia,
        name: motorista.nombre,
      });
      await this.driversRepository.save(driver);
      logs.push(
        `Conductor creado: ${driver.name} con licencia ${motorista.licencia}.`,
      );
    }
    return driver;
  }

  private async findOrCreateVehicle(
    vehiculo: VehiculoDto | VehiculoUpdateDto,
    logs: string[],
  ) {
    let vehicle = await this.vehiclesRepository.findOne({
      where: {
        plate: vehiculo.placa,
        trailerPlate: vehiculo.placa_remolque,
        truckType: vehiculo.tipo_camion,
      },
    });

    console.log('buscando para ', {
      where: {
        plate: vehiculo.placa,
        trailerPlate: vehiculo.placa_remolque,
        truckType: vehiculo.tipo_camion,
      },
    });

    if (!vehicle) {
      if (!vehiculo.tipo_camion) {
        throw new BadRequestException(
          `No existe el camión. Debes crear uno y especificar un tipo de camión. Tipos de camión requeridos: ${Object.values(TipoCamion).join(', ')}.`,
        );
      }
      vehicle = this.vehiclesRepository.create({
        plate: vehiculo.placa,
        trailerPlate: vehiculo.placa_remolque || null,
        truckType: vehiculo.tipo_camion,
      });
      logs.push(`Vehículo creado: ${vehicle.plate}.`);
      await this.vehiclesRepository.save(vehicle);
    }
    return vehicle;
  }

  async getShipmentsByStatus(
    statusType: number,
    startDate?: string,
    endDate?: string,
    includeAttachments: boolean = false,
    page: number = 1,
    size: number = 30,
    forClients: boolean = false,
    reportType?: 'PRECHECK' | 'SEALS',
  ): Promise<{
    data: ShipmentsWithFormattedStatusesAndFormatResponseAndFormatResponse[];
    pagination: Pagination;
  }> {
    let relations = [
      'driver',
      'vehicle',
      'ingenio',
      'shipmentSeals',
      'shipmentTemperatures',
    ];

    if (includeAttachments) {
      relations.push('shipmentAttachments');
    }

    let whereCondition: any = {
      currentStatus: statusType,
    };

    if (startDate && endDate) {
      whereCondition.createdAt = Between(
        new Date(startDate),
        new Date(endDate),
      );
    }

    let queryBuilder = this.shipmentsRepository.createQueryBuilder('shipment');

    // Agregar JOINs dinámicamente
    relations.forEach((relation) => {
      queryBuilder = queryBuilder.leftJoinAndSelect(
        `shipment.${relation}`,
        relation,
      );
    });

    // JOIN para filtrar pero NO incluir en response
    if (statusType === 13 && reportType) {
      queryBuilder = queryBuilder.innerJoin(
        'shipment.dataInconsistencies',
        'dataInconsistencies',
      );
    }

    queryBuilder = queryBuilder.where(whereCondition);

    if (statusType === 13 && reportType) {
      if (reportType === 'PRECHECK') {
        queryBuilder = queryBuilder.andWhere(
          'dataInconsistencies.inconsistencyType LIKE :precheckType',
          {
            precheckType: '%"precheck":%',
          },
        );
      } else if (reportType === 'SEALS') {
        queryBuilder = queryBuilder.andWhere(
          'dataInconsistencies.inconsistencyType LIKE :sealsType',
          {
            sealsType: '%"seals":%',
          },
        );
      }
    }

    const [shipments, totalCount] = await queryBuilder
      .skip((page - 1) * size)
      .take(size)
      .getManyAndCount();

    if (!shipments || shipments.length === 0) {
      throw new NotFoundException(
        `No shipments found with status type ${statusType}`,
      );
    }

    const normalizedShipments = shipments.map((s) =>
      this.normalizeShipment(s, forClients),
    );
    const formattedShipments = await Promise.all(
      normalizedShipments.map(async (shipment: any) => {
        const { id, product, shipmentTemperatures, buzzer, ...rest } = shipment;

        return {
          id, // primero id
          nameProduct: getKeyByValueEnum(product, ProductType), // inmediatamente debajo de id
          buzzer: buzzer,
          ...rest,
          Temperature: shipmentTemperatures?.map((temp, idx) => ({
            registro: idx + 1,
            temperature: temp.temperature,
            createdAt: temp.created_at,
          })),
        };
      }),
    );

    return {
      data: formattedShipments,
      pagination: {
        count: totalCount,
        limit: size,
        offset: (page - 1) * size,
      },
    };
  }

  async uploadFile(
    urlfileOrbase64file: string,
    type: AttachmentType,
    isBase64: boolean,
    codeGen: string,
  ): Promise<ShipmentAttachments> {
    const shipment = await this.shipmentsRepository.findOne({
      where: { codeGen: codeGen },
    });

    if (!shipment) {
      throw new NotFoundException(`El envío ${codeGen} no fue encontrado`);
    }

    let fileUrl: string;
    let fileName: string;
    let fileType: FileType;

    if (isBase64) {
      const mimeTypeMatch = urlfileOrbase64file.match(/^data:(.+?);base64,/);
      if (!mimeTypeMatch) {
        throw new BadRequestException(
          'Formato de base64 no válido, el formato debe de ser: data:<MIME_TYPE>;base64,<BASE64_ENCODED_FILE>',
        );
      }

      const mimeType = mimeTypeMatch[1];
      fileType = getFileTypeFromMimeType(mimeType);
      fileName = `file_${Date.now()}.${mimeType.split('/')[1]}`;
      fileUrl = urlfileOrbase64file;
    } else {
      fileUrl = urlfileOrbase64file;
      fileName = fileUrl.split('/').pop() || 'unknown_file';
      fileType = getFileTypeFromExtension(fileName);
    }

    const attachment = this.shipmentAttachments.create({
      fileUrl,
      fileName,
      fileType,
      attachmentType: type,
      shipment,
    });

    return this.shipmentAttachments.save(attachment);
  }

  async getAttachmentsByCodeGen(
    codeGen: string,
    type?: AttachmentType,
  ): Promise<ShipmentAttachments[]> {
    const shipment = await this.shipmentsRepository.findOne({
      where: { codeGen: codeGen },
    });
    if (!shipment) {
      throw new NotFoundException(
        `El envío con código ${codeGen} no fue encontrado`,
      );
    }

    const queryBuilder = this.shipmentAttachments
      .createQueryBuilder('attachment')
      .where('attachment.shipment = :shipmentId', { shipmentId: shipment.id });

    if (type) {
      queryBuilder.andWhere('attachment.attachmentType = :type', { type });
    }

    const attachments = await queryBuilder.getMany();
    return attachments;
  }

  async findAllRecordByCodeGen(codeGen: string): Promise<Shipments | null> {
    const relations = getMetadataArgsStorage()
      .relations.filter((relation) => relation.target === Shipments)
      .map((relation) => relation.propertyName);

    const shipment = await this.shipmentsRepository.findOne({
      where: { codeGen },
      relations,
    });

    if (!shipment) {
      throw new NotFoundException(
        `Shipment con codeGen ${codeGen} no encontrado.`,
      );
    }

    return shipment;
  }

  async deleteShipment(codeGen: string): Promise<Shipments> {
    const shipment = await this.findAllRecordByCodeGen(codeGen);
    await this.shipmentsRepository.remove(shipment);
    return shipment;
  }

  async createAllRecord(shipmentData: Partial<Shipments>): Promise<Shipments> {
    const newShipment = this.shipmentsRepository.create(shipmentData);
    return this.shipmentsRepository.save(newShipment);
  }

  async addMagneticCardNavToShipment(codeGen: string, magneticCard: number) {
    const shipment = await this.shipmentsRepository.findOne({
      where: { codeGen },
    });

    if (!shipment) {
      throw new NotFoundException(
        `El código de generación ${codeGen} no existe`,
      );
    }

    try {
      shipment.magneticCard = magneticCard;
      await this.shipmentsRepository.save(shipment);
      return {
        message: `La tarjeta magnética se ha añadido correctamente al envío con código ${codeGen}`,
        shipment,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Hubo un error al actualizar el envío con código ${codeGen}: ${error.message}`,
      );
    }
  }

  async setMagneticCard(codeGen: string, numberMagneticCard: number) {
    console.log(
      `[INFO] Intentando asignar tarjeta magnética ${numberMagneticCard} al envío ${codeGen}`,
    );

    const shipment: Shipments = await this.shipmentsRepository.findOne({
      where: { codeGen: codeGen },
    });

    if (!shipment) {
      throw new BadRequestException(`El envío ${codeGen} no existe.`);
    }

    /* 
            Verificar si la tarjeta magnética ya está asociada a otro envío en proceso
            Para verificar si la tarjeta está en otro proceso se evalúa que su estatus
            sea menor que 12, ya que si es menor que 12 significa que aún no ha terminado
            el status 12 en quickpass se asigna cuando el status de nav pasa a 3
            que significa finalizado
        */
    const existingShipmentWithSameCard: Shipments =
      await this.shipmentsRepository.findOne({
        where: {
          magneticCard: numberMagneticCard,
          currentStatus: LessThan(12),
        },
      });

    if (existingShipmentWithSameCard) {
      /* 
                Si la tarjeta ya está asignada al mismo envío, permitir la reasignación
                y retornar mensaje de éxito
            */
      if (existingShipmentWithSameCard.codeGen === codeGen) {
        console.log(
          `[INFO] Tarjeta magnética ${numberMagneticCard} ya está asignada al mismo envío ${codeGen}, permitiendo reasignación`,
        );

        return {
          success: true,
          message: `Tarjeta magnética ${numberMagneticCard} asignada correctamente.`,
          data: shipment,
        };
      } else {
        /* 
                    La tarjeta está asignada a otro envío diferente
                */
        throw new BadRequestException(
          `La tarjeta magnética ${numberMagneticCard} ya está asignada a otro envío en proceso.`,
        );
      }
    }

    /* 
            Asignar la tarjeta magnética al envío
        */
    shipment.magneticCard = numberMagneticCard;
    await this.shipmentsRepository.save(shipment);

    console.log(
      `[SUCCESS] Tarjeta magnética ${numberMagneticCard} asignada exitosamente al envío ${codeGen}`,
    );

    /* 
            Si el envío ya tiene un estado avanzado, actualizar también en NAV y Leverans
        */
    if (
      shipment.currentStatus > 3 &&
      shipment.idNavRecord !== null &&
      shipment.idPreTransaccionLeverans !== null
    ) {
      await this.navService.updateMagneticCardInNavAndLeveransPretrassacionts(
        shipment,
      );
      console.log(
        `[INFO] Tarjeta magnética actualizada en NAV y Leverans para envío ${codeGen}`,
      );
    }

    return {
      success: true,
      message: `Tarjeta magnética ${numberMagneticCard} asignada correctamente.`,
      data: shipment,
    };
  }

  async setSugarTime(codeGen: string, time: string, observation: string) {
    return this.logsShipmentsService.setSugarTimesLog(
      codeGen,
      time,
      observation,
    );
  }

  async getSugarTime(codeGen: string) {
    return this.logsShipmentsService.getSugarTimesLogs(codeGen);
  }

  async setSweepingLog(
    codeGen: string,
    requiresSweeping: boolean,
    observation: string,
  ) {
    return this.logsShipmentsService.setSweepingLog(
      codeGen,
      requiresSweeping,
      observation,
    );
  }

  async getSweepingLog(codeGen: string) {
    return this.logsShipmentsService.getSweepingLogs(codeGen);
  }

  async setIdNavRecord(
    codeGen: string,
    idNavRecord: number,
  ): Promise<Shipments> {
    const shipment = await this.shipmentsRepository.findOne({
      where: { codeGen },
    });

    if (!shipment) {
      throw new NotFoundException('No se encontró ese envío');
    }

    shipment.idNavRecord = idNavRecord;

    return await this.shipmentsRepository.save(shipment);
  }

  async setIdPreTransaccionLeverans(
    codeGen: string,
    idPreTransaccionLeverans: number,
  ): Promise<Shipments> {
    const shipment = await this.shipmentsRepository.findOne({
      where: { codeGen },
    });

    if (!shipment) {
      throw new NotFoundException('No se encontró ese envío');
    }

    shipment.idPreTransaccionLeverans = idPreTransaccionLeverans;

    return await this.shipmentsRepository.save(shipment);
  }

  // 1. Sobrecarga para arrays
  public normalizeShipment<
    T extends
      | Shipments
      | ShipmentsWithFormattedStatusesAndFormatResponseAndFormatResponse,
  >(
    shipment: T[],
    forClients: boolean,
    customConfig?: Partial<ObjectTransformer['config']>,
  ): T[];

  // 2. Sobrecarga para objetos individuales
  public normalizeShipment<
    T extends
      | Shipments
      | ShipmentsWithFormattedStatusesAndFormatResponseAndFormatResponse,
  >(
    shipment: T,
    forClients: boolean,
    customConfig?: Partial<ObjectTransformer['config']>,
  ): T;

  public normalizeShipment<
    T extends
      | Shipments
      | ShipmentsWithFormattedStatusesAndFormatResponseAndFormatResponse,
  >(
    shipment: T | T[],
    forClients: boolean,
    customConfig?: Partial<ObjectTransformer['config']>,
  ): T | T[] {
    if (!shipment) return null;
    if (Array.isArray(shipment)) {
      return shipment.map((s) =>
        this.normalizeShipment(s, forClients, customConfig),
      );
    }

    if (!forClients) {
      return shipment;
    }

    const baseConfig = {
      keysToRemove: {
        root: [
          'id',
          'truckType',
          'product',
          'activityNumber',
          'magneticCard',
          'currentStatus',
          'dateTimeCurrentStatus',
          'dateTimePrecheckeo',
          'idNavRecord',
          'idPreTransaccionLeverans',
          'mapping',
          'leveransLoggers',
          'queues',
          'shipmentLogs',
        ],
        driver: ['id', 'createdAt', 'updatedAt'],
        vehicle: ['id', 'createdAt', 'updatedAt'],
        ingenio: ['id', 'user', 'ingenioNavCode', 'createdAt', 'updatedAt'],
        shipmentSeals: ['id', 'sealDescription', 'createdAt'],
        statuses: ['id', 'createdAt'],
      },
      keysToMove: [{ from: 'navRecord', to: 'root' }],
      strictMode: false,
    };

    const mergedConfig = customConfig
      ? ObjectTransformer.mergeConfigs(baseConfig, customConfig)
      : baseConfig;

    const transformer = new ObjectTransformer(mergedConfig);
    const newObject = transformer.transform(shipment);
    console.log('Estos son los logs del transform: ', transformer.getLogs());
    return newObject;
  }

  async getVehicleByPlateAndTrailerPlate(plate: string, trailerPlate: string) {
    const vehicle = await this.vehiclesRepository.findOne({
      where: {
        plate: plate,
        trailerPlate: trailerPlate,
      },
    });
    return vehicle;
  }

  async getTruckTypeVehicleByPlateAndTrailerPlate(
    plate: string,
    trailerPlate: string,
  ) {
    const vehicle = await this.getVehicleByPlateAndTrailerPlate(
      plate,
      trailerPlate,
    );
    return vehicle?.truckType ?? null;
  }

  async getDriverStatsByLicense(license: string): Promise<any[]> {
    return await this.dataSource.query(
      `
            SELECT 
            d.license AS Licencia,
            d.name AS Motorista,
            s.product,
            COUNT(s.driver_id) AS N_Veces,
            CASE 
                WHEN COUNT(s.driver_id) BETWEEN 1 AND 50 THEN 'Pionero del Trayecto'
                WHEN COUNT(s.driver_id) BETWEEN 51 AND 100 THEN 'As del Volante'
                WHEN COUNT(s.driver_id) BETWEEN 101 AND 150 THEN 'Maestro de Ruta'
                WHEN COUNT(s.driver_id) BETWEEN 151 AND 200 THEN 'Ícono del Camino'
                WHEN COUNT(s.driver_id) BETWEEN 201 AND 250 THEN 'Leyenda del Camino'
                WHEN COUNT(s.driver_id) >= 251 THEN 'Mito Viviente'
                ELSE 'Sin Clasificación'
            END AS Estatus
            FROM Shipments s
            INNER JOIN Drivers d ON d.id = s.driver_id
            INNER JOIN Status st ON st.shipment_id = s.id
            WHERE d.license = @0
            AND st.predefined_status_id = 2
            GROUP BY s.driver_id, d.license, d.name, s.product
            ORDER BY N_Veces DESC;
        `,
      [license],
    );
  }

  async asignarBuzzer(shipmentId: number, buzzer: number): Promise<any> {
    console.log('[INFO] Iniciando asignación de buzzer');
    console.log(`[INFO] shipmentId recibido: ${shipmentId}`);
    console.log(`[INFO] buzzer recibido: ${buzzer}`);

    /* 
            1. Obtener el envío actual
        */
    const shipment = await this.shipmentsRepository
      .createQueryBuilder('s1')
      .where('s1.id = :id', { id: shipmentId })
      .getOne();

    if (!shipment) {
      throw new NotFoundException(`Envío con ID ${shipmentId} no encontrado.`);
    }

    /* 
            Limpiar y validar el estado actual
        */
    const statusId = this.cleanStatusId(shipment.currentStatus);

    console.log(`[INFO] Estado actual del envío: ${statusId}`);

    /*
            2. ASIGNACIÓN: Solo permitida en estado 2 (Prechequeado)
        */
    if (statusId === 2) {
      console.log(
        '[INFO] Validando disponibilidad del buzzer para asignación...',
      );

      /*
                Buscar si otro envío tiene el buzzer Y está en estado activo (< 4)
                Esto permite mantener el historial del buzzer sin bloquearlo después de estado 4
            */
      const existing = await this.shipmentsRepository
        .createQueryBuilder('s2')
        .where('s2.buzzer = :buzzer', { buzzer })
        .andWhere('s2.id != :currentId', { currentId: shipmentId })
        .andWhere('s2.current_status < 4') // Solo bloquear si está ANTES del estado 4
        .getOne();

      if (existing) {
        const existingStatus = this.cleanStatusId(existing.currentStatus);

        console.log(
          `[WARNING] Buzzer ${buzzer} ya está en uso activo por envío ${existing.codeGen}`,
        );
        console.log(`[INFO] Estado del envío que lo tiene: ${existingStatus}`);

        throw new ConflictException(
          `El buzzer ${buzzer} ya está asignado a otro envío en proceso.`,
        );
      }

      /*
                Verificar si el buzzer ya está asignado al mismo envío
            */
      if (shipment.buzzer === buzzer) {
        return {
          success: true,
          message: `Buzzer ${buzzer} ya está asignado a este envío.`,
          codeGen: shipment.codeGen,
          affected: 1,
        };
      }

      console.log(
        `[SUCCESS] El buzzer ${buzzer} está disponible para asignación`,
      );
      console.log(
        `[INFO] Asignando buzzer ${buzzer} al envío ${shipment.codeGen}...`,
      );

      const result = await this.shipmentsRepository.update(shipmentId, {
        buzzer,
      });

      return {
        success: true,
        message: `Buzzer ${buzzer} asignado correctamente.`,
        codeGen: shipment.codeGen,
        affected: result.affected || 1,
      };
    }

    /*
            3. ESTADO 4 (Autorizado): El buzzer se mantiene como historial
            Ya NO se limpia el buzzer, permitiendo mantener la trazabilidad
        */
    if (statusId === 4) {
      console.log(`[INFO] Envío ${shipment.codeGen} en estado finalizado (4)`);
      console.log(
        `[INFO] El buzzer ${shipment.buzzer} se mantiene como registro histórico`,
      );

      return {
        success: true,
        message: `Buzzer liberado correctamente.`,
        codeGen: shipment.codeGen,
        buzzer: shipment.buzzer,
        note: 'El buzzer queda disponible para reasignación pero se mantiene el registro histórico',
      };
    }

    /*
            4. Cualquier otro estado no está permitido
        */
    console.log(
      `[ERROR] Estado no permitido para operación de buzzer: ${statusId}`,
    );
    throw new BadRequestException(
      `Solo se puede asignar buzzer en estado 2 (Prechequeado). Estado actual: ${statusId}`,
    );
  }

  async registrarTemperatura(codeGen: string, temperature: number) {
    // 1) Buscar el shipment
    const shipment = await this.shipmentRepo.findOne({ where: { codeGen } });
    if (!shipment) {
      throw new NotFoundException({
        message: `No existe la transacción con codeGen ${codeGen}.`,
      });
    }

    // 2) Obtener id de NAV (camel o snake, sin tocar la entidad)
    const idNavRecord =
      (shipment as any).idNavRecord ?? (shipment as any).id_nav_record ?? null;

    if (idNavRecord == null || String(idNavRecord).trim() === '') {
      throw new BadRequestException({
        message: `La transacción ${codeGen} no posee id_nav_record asociado (NAV).`,
      });
    }

    // 3) Guardar temperatura en dbo.ShipmentsTemperature
    const nuevo = this.temperatureRepo.create({
      shipment, // o { id: shipment.id }
      temperature: Number(temperature),
    });
    const saved = await this.temperatureRepo.save(nuevo);

    // 4) Regla de negocio: solo enviar a NAV si temperatura < 41
    const threshold = Number(process.env.NAV_TEMP_MAX ?? 41); // opcional por env
    let nav: any = {
      message:
        Number(temperature) < threshold
          ? 'Intento de envío a NAV pendiente de ejecutar.' // se reemplazará abajo
          : `No se registro la temperatura en NAV ya que debe de ser menor a  ${threshold}°C.`,
      success: Number(temperature) < threshold ? undefined : true, // mantener success true del flujo local
    };

    if (Number(temperature) < threshold) {
      // 4.1 Llamar al Middleware
      const base =
        process.env.SERVER_MIDDLEWARE_NAME || 'http://localhost:5063/api/';
      const path =
        process.env.SERVER_MIDDLEWARE_UPDATE_TEMPERATURE ||
        'shipment/update-temperature-nav';
      const url = `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

      const payload = {
        idNavRecord: Number(idNavRecord),
        temperature: Number(temperature),
        codeGen,
      };

      try {
        const resp = await firstValueFrom(
          this.http.post(url, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000,
            validateStatus: () => true,
          }),
        );
        nav = resp.data; // solo el body del middleware
      } catch (e: any) {
        nav = {
          message: 'No se pudo contactar la Middleware.',
          error: e?.message ?? String(e),
        };
      }
    }

    // 5) Respuesta SIN "sent"
    return {
      success: true,
      message: 'Temperatura registrada correctamente.',
      data: {
        shipmentId: shipment.id,
        codeGen: shipment.codeGen ?? (shipment as any).code_gen,
        id_nav_record: String(idNavRecord),
        id: saved.id,
        temperature: Number(saved?.temperature ?? temperature),
        createdAt:
          (saved as any).created_at ??
          (saved as any).createdAt ??
          saved['created_at'],
        nav, // body del middleware o nota de que no se envió por umbral
      },
    };
  }

  async registrarHumedad(codeGen: string, humidity: number) {
    // 1) Buscar el shipment
    const shipment = await this.shipmentRepo.findOne({ where: { codeGen } });
    if (!shipment) {
      throw new NotFoundException({
        message: `No existe la transacción con codeGen ${codeGen}.`,
      });
    }

    // 2) Obtener id de NAV (camel o snake)
    const idNavRecord =
      (shipment as any).idNavRecord ?? (shipment as any).id_nav_record ?? null;

    if (idNavRecord == null || String(idNavRecord).trim() === '') {
      throw new BadRequestException({
        message: `La transacción ${codeGen} no posee id_nav_record asociado (NAV).`,
      });
    }

    // 3) Guardar humedad en dbo.Shipments
    (shipment as any).humidity = Number(humidity);
    const savedShipment = await this.shipmentRepo.save(shipment);

    // 4) Llamar al Middleware para actualizar NAV (pero sin devolver todo el detalle)
    const base =
      process.env.SERVER_MIDDLEWARE_NAME || 'http://localhost:5063/api/';
    const path =
      process.env.SERVER_MIDDLEWARE_UPDATE_HUMIDITY ||
      'shipment/update-humidity-nav';
    const url = `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

    const payload = {
      idNavRecord: Number(idNavRecord),
      humidity: Number(humidity),
      codeGen,
    };

    try {
      const resp = await firstValueFrom(
        this.http.post(url, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000,
          validateStatus: () => true,
        }),
      );

      // Si quieres logear algo:
      // this.logger.log(`NAV humidity response: ${JSON.stringify(resp.data)}`);
    } catch (e) {
      // Si quieres solo logear el error y NO romper el flujo:
      // this.logger.error(`Error enviando humedad a NAV: ${e?.message ?? e}`);
    }

    // 👇 Devolvemos solo lo básico
    return {
      shipmentId: savedShipment.id,
      codeGen: savedShipment.codeGen,
      humidity: Number((savedShipment as any).humidity ?? humidity),
    };
  }

  //REPORTE DE TEMPERATURA:

  async getTemperatureReport(filter: TemperatureReportFilterDto = {}) {
    const qb = this.temperatureRepo
      .createQueryBuilder('st')
      .innerJoin('st.shipment', 's')
      .innerJoin('s.ingenio', 'c')
      .innerJoin('s.vehicle', 'v')
      .where('s.brix IS NOT NULL')
      .andWhere(
        `
        EXISTS (
            SELECT 1
            FROM ingenioapi.dbo.Status sta
            WHERE sta.shipment_id = s.id
            AND sta.predefined_status_id = :statusId
        )
        `,
        { statusId: 12 },
      );

    if (filter?.from) {
      qb.andWhere('st.created_at >= :from', {
        from: new Date(`${filter.from}T00:00:00`),
      });
    }
    if (filter?.to) {
      qb.andWhere('st.created_at <= :to', {
        to: new Date(`${filter.to}T23:59:59`),
      });
    }

    qb.select('CAST(st.created_at AS DATE)', 'fecha')
      .addSelect('CONVERT(TIME(0), st.created_at)', 'hora')
      .addSelect('v.trailer_plate', 're_pipa')
      .addSelect('c.name', 'Ingenio')
      .addSelect('st.temperature', 'temperatura')
      .addSelect('s.brix', 'brix_recepcion')
      .addSelect('(s.brix + 4.6)', 'brix_corregido')
      .orderBy('st.created_at', 'DESC');

    return qb.getRawMany();
  }

  //REPORTE BARRIDO

  async getRequiresSweepingReport() {
    const qb = this.shipmentsRepository
      .createQueryBuilder('s')
      .innerJoin('s.ingenio', 'c')
      .innerJoin('s.driver', 'd')
      .innerJoin('s.vehicle', 'v')
      .innerJoin('s.statuses', 's2')
      .where('s.id_nav_record IS NOT NULL');

    qb.select('c.name', 'ingenio')
      .addSelect('s.code_gen', 'codigo_generacion')
      .addSelect('s.id_nav_record', 'id_nav')
      .addSelect('d.license', 'licencia')
      .addSelect('d.name', 'motorista')
      .addSelect('v.plate', 'placa_cabezal')
      .addSelect('v.trailer_plate', 'placa_remolque')
      .addSelect(
        `CASE s.requiresSweeping
                WHEN 'S' THEN 'SI'
                WHEN 'N' THEN 'NO'
                ELSE NULL
            END`,
        'solicito_barrido',
      )
      .addSelect(
        'MAX(CASE WHEN s2.predefined_status_id = 2 THEN s2.updated_at END)',
        'fecha_prechequeo',
      )
      .addSelect(
        'MAX(CASE WHEN s2.predefined_status_id = 5 THEN s2.updated_at END)',
        'fecha_entrada',
      )
      .addSelect(
        'MAX(CASE WHEN s2.predefined_status_id = 11 THEN s2.updated_at END)',
        'fecha_salida',
      )
      .groupBy('c.name')
      .addGroupBy('s.code_gen')
      .addGroupBy('s.id_nav_record')
      .addGroupBy('d.license')
      .addGroupBy('d.name')
      .addGroupBy('v.plate')
      .addGroupBy('v.trailer_plate')
      .addGroupBy('s.requiresSweeping')
      .orderBy('fecha_salida', 'DESC');

    return qb.getRawMany();
  }

  async registrarLocation(codeGen: string, locationCode: string) {
    const code = locationCode.trim();

    // 1) Buscar shipment
    const shipment = await this.shipmentRepo.findOne({ where: { codeGen } });

    if (!shipment) {
      throw new NotFoundException({
        message: `No existe la transacción con codeGen ${codeGen}.`,
      });
    }

    // 2) Validar NAV
    const idNavRecord =
      (shipment as any).idNavRecord ?? (shipment as any).id_nav_record ?? null;

    if (idNavRecord == null || String(idNavRecord).trim() === '') {
      throw new BadRequestException({
        message: `La transacción ${codeGen} no posee id_nav_record asociado (NAV).`,
      });
    }

    // 3) VALIDAR que el código exista en Locations
    const location = await this.locationsRepo.findOne({ where: { code } });

    if (!location) {
      // ⛔ No permitimos registrar si el código no existe
      throw new BadRequestException({
        message: `El código de almacén "${code}" no está configurado en Locations.`,
        code,
      });
    }

    // 4) Guardar code_location en Shipments
    (shipment as any).locationCode = code; // mapeado a columna code_location
    const savedShipment = await this.shipmentRepo.save(shipment);

    // 5) Llamar a Middleware para actualizar NAV (campo 'almacen')
    const base =
      process.env.SERVER_MIDDLEWARE_NAME || 'http://localhost:5063/api/';
    const path =
      process.env.SERVER_MIDDLEWARE_UPDATE_WAREHOUSE ||
      'shipment/update-warehouse-nav';

    const url = `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

    const payload = {
      idNavRecord: Number(idNavRecord),
      almacen: code,
      codeGen,
    };

    try {
      await firstValueFrom(
        this.http.post(url, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000,
          validateStatus: () => true,
        }),
      );
    } catch (e) {
      // Si quieres solo log: no rompemos el flujo de Quickpass
      // this.logger.error(`Error enviando almacén a NAV: ${e?.message ?? e}`);
    }

    return {
      shipmentId: savedShipment.id,
      codeGen: savedShipment.codeGen,
      locationCode: code,
    };
  }

  async getReport(filter: ShipmentTimesFilterDto) {
    const mode = filter.mode ?? 2;

    if (mode === 1) {
      return this.getBlacklistRows(filter); // << habilitado lista negra
    }
    if (mode === 2) {
      return this.getShipmentTimes(filter);
    }
    throw new BadRequestException(
      'Parámetro "mode" inválido. Solo se permite 1 o 2.',
    );
  }

  /** ========= Genera archivo (PDF/Excel) ========= */
  async getReportFile(
    filter: ShipmentTimesFilterDto,
  ): Promise<{ buffer: Buffer; filename: string; mime: string }> {
    const mode = filter.mode ?? 2;

    // ======== MODO 1: Lista negra ========
    if (mode === 1) {
      // 1) Datos
      const result = await this.getBlacklistRows(filter);
      const rows = result.rows as any[];
      const range = result.range ?? { from: null, to: null };

      // 2) Columnas en el orden pedido
      const headers = [
        'N°',
        'Motorista',
        'Licencia',
        'Empresa Transporte',
        'Tipo Castigo',
        'Fecha Inicio',
        'Fecha Fin',
        'Tiempo (días)',
        'Comentario',
      ];

      // 3) Mapeo filas -> celdas
      const mapped = rows.map((r, i) => [
        i + 1,
        r['Motorista'] ?? '',
        r['Licencia'] ?? '',
        r['Empresa Transporte'] ?? '',
        r['Tipo Castigo'] ?? '',
        r['Fecha Inicio'] ?? '',
        r['Fecha Fin'] ?? '',
        r['Tiempo'] ?? '',
        r['Comentario'] ?? '',
      ]);

      const title = 'REPORTE DE LISTA NEGRA DE MOTORISTAS';
      const subtitle =
        range?.from || range?.to
          ? `Del ${range.from ?? '...'} - ${range.to ?? '...'}`
          : '';

      if (filter.format === 'excel') {
        const buffer = await this.buildExcel({
          title,
          subtitle,
          headers,
          data: mapped,
          // Medidas específicas para este reporte
          widths: [6, 28, 16, 28, 20, 14, 14, 12, 40],
          align: [
            'center',
            'left',
            'left',
            'left',
            'left',
            'center',
            'center',
            'center',
            'left',
          ],
          headerRowHeight: 42,
          rowHeight: 20,
        });
        const filename = this.buildFilename(
          'reporte_lista_negra',
          'xlsx',
          range,
        );
        return {
          buffer,
          filename,
          mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }

      if (filter.format === 'pdf') {
        const buffer = await this.buildPdf({
          title,
          subtitle,
          headers,
          data: mapped,
          columnWidths: [15, 100, 70, 100, 80, 50, 50, 60, '*'],
          //centerCols: [5, 6, 7], // Fechas + días
          // (el resto se queda igual)
        });
        const filename = this.buildFilename(
          'reporte_lista_negra',
          'pdf',
          range,
        );
        return { buffer, filename, mime: 'application/pdf' };
      }
      throw new BadRequestException(
        'Formato inválido. Usa format=pdf o format=excel.',
      );
    }

    // ======== MODO 2: lo que ya tenías (ingreso camiones) ========
    if (mode !== 2) {
      throw new BadRequestException('Parámetro "mode" inválido. Solo 1 o 2.');
    }

    // 1) Datos
    const result = await this.getShipmentTimes(filter);
    const rows = result.rows as any[];
    const range = result.range ?? { from: null, to: null };

    // 2) Columnas (como ya las tenías)
    const headers = [
      'N°',
      'Fecha y Hora\nDe Ingreso',
      'Fecha y Hora\nDe Salida',
      'Motorista',
      'Licencia',
      'Placa\n Cabezal',
      'Placa\n Remolque',
      'Transportista',
      'Actividad',
    ];

    // Helper: celda apilada fecha/tiempo centrada
    const splitDateTimeCell = (dt?: string) => {
      if (!dt) return { text: '' };
      const [date, time] = dt.split(' ');
      return {
        stack: [
          { text: date ?? '' },
          { text: time ?? '', fontSize: 10, color: '#555' },
        ],
        alignment: 'center',
        lineHeight: 1.0,
      };
    };

    // 3) Mapeo filas
    const mapped = rows.map((r, i) => [
      i + 1,
      splitDateTimeCell(r['Fecha Hora Ingreso']),
      splitDateTimeCell(r['Fecha Hora Salida']),
      r['Motorista'] ?? '',
      r['Licencia'] ?? '',
      r['Placa Cabezal'] ?? '',
      r['Placa Remolque'] ?? '',
      r['Transportista'] ?? '',
      r['Actividad'] ?? '',
    ]);

    const title = 'REPORTE DE INGRESO DE CAMIONES';
    const subtitle =
      range?.from || range?.to
        ? `Del ${range.from ?? '...'} - ${range.to ?? '...'}`
        : '';

    if (filter.format === 'excel') {
      const buffer = await this.buildExcel({
        title,
        subtitle,
        headers,
        data: mapped,
        // Medidas para el reporte de tiempos
        widths: [6, 22, 22, 28, 18, 12, 12, 28, 28],
        align: [
          'center',
          'center',
          'center',
          'left',
          'left',
          'center',
          'center',
          'left',
          'left',
        ],
        headerRowHeight: 75,
        rowHeight: 46,
      });
      const filename = this.buildFilename(
        'reporte_ingreso_camiones',
        'xlsx',
        range,
      );
      return {
        buffer,
        filename,
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }

    if (filter.format === 'pdf') {
      const buffer = await this.buildPdf({
        title,
        subtitle,
        headers,
        data: mapped,
        // Si quieres fijar medidas también aquí:
        columnWidths: [15, 60, 60, 125, 80, 45, 45, 125, 105],
        centerCols: [0, 1, 2], // Nº + fechas
      });
      const filename = this.buildFilename(
        'reporte_ingreso_camiones',
        'pdf',
        range,
      );
      return { buffer, filename, mime: 'application/pdf' };
    }

    throw new BadRequestException(
      'Formato inválido. Usa format=pdf o format=excel.',
    );
  }

  /** Helper para validar pesos **/
  private parseAndValidatePeso(
    label: 'peso_bruto' | 'peso_tara',
    raw: unknown,
    opts?: { allowComma?: boolean },
  ): number | null {
    if (raw === undefined || raw === null || raw === '') return null;

    let s = String(raw).trim();

    // (Opcional) aceptar coma como separador decimal
    if (opts?.allowComma) s = s.replace(',', '.');

    // Acepta enteros o decimales con punto. Rechaza letras/símbolos (ej. 1678kg)
    if (!/^\d+(\.\d+)?$/.test(s)) {
      if (/[^0-9.,]/.test(String(raw))) {
        throw new BadRequestException(
          `El campo "${label}" solo debe contener números (y un punto decimal opcional, ej. "1678.00").`,
        );
      }
      throw new BadRequestException(
        `Formato inválido para "${label}". Usa números y punto decimal opcional (ej. "1678" o "1678.50").`,
      );
    }

    const num = Number(s);
    if (!Number.isFinite(num)) {
      throw new BadRequestException(`"${label}" no es un número válido.`);
    }
    return num;
  }

  /** ========= Helper: resumen de pesos NAV vs INGENIO ========= */
  private buildWeightsSummary(weights: ShipmentWeight[], shipment: Shipments) {
    // Peso neto INGENIO (peso_bruto - peso_tara en Quickpass)
    const bruto = Number(
      (shipment as any).pesoBruto ?? (shipment as any).peso_bruto ?? 0,
    );
    const tara = Number(
      (shipment as any).pesoTara ?? (shipment as any).peso_tara ?? 0,
    );

    const hasIngenio = Number.isFinite(bruto) && Number.isFinite(tara);
    const pesoNetoIngenio = hasIngenio ? bruto - tara : null;

    // Si no hay pesos en NAV, devolvemos []
    if (!weights || !weights.length) {
      return [];
    }

    // Armamos un arreglo de pesajes (1er pesaje, 2do, etc.)
    return weights.map((w, index) => {
      const pesoEntrada = w.pesoin != null ? Number(w.pesoin) : null;
      const pesoSalida = w.pesoout != null ? Number(w.pesoout) : null;

      // Si NAV ya manda peso neto, úsalo; si no, lo calculamos
      let pesoNetoNav: number | null = null;
      if (w.pesoneto != null) {
        pesoNetoNav = Number(w.pesoneto);
      } else if (pesoEntrada != null && pesoSalida != null) {
        pesoNetoNav = pesoSalida - pesoEntrada;
      }

      // Diferencias NAV vs INGENIO
      const pesoBrutoDiferencia =
        hasIngenio && pesoEntrada != null ? bruto - pesoEntrada : null;

      const pesoTaraDiferencia =
        hasIngenio && pesoSalida != null ? tara - pesoSalida : null;

      const pesoNetoDiferencia =
        pesoNetoIngenio != null && pesoNetoNav != null
          ? pesoNetoIngenio - pesoNetoNav
          : null;

      // Alias para mantener el campo original
      const diferencia = pesoNetoDiferencia;

      return {
        pesaje: index + 1, // 1 = primer pesaje, 2 = segundo, etc.

        // NAV
        pesoEntradaNav: pesoEntrada,
        pesoSalidaNav: pesoSalida,
        pesoNetoNav,
        basculaEntrada: w.bascula_in ?? null,
        basculaSalida: w.bascula_out ?? null,
        fechaEntrada: w.datetime_in ?? null,
        fechaSalida: w.datetime_out ?? null,

        // INGENIO
        pesoBrutoIngenio: hasIngenio ? bruto : null,
        pesoTaraIngenio: hasIngenio ? tara : null,
        pesoNetoIngenio,

        // Diferencias NAV vs INGENIO
        diferencia, // campo original (neto)
        pesoBrutoDiferencia, // nuevo
        pesoTaraDiferencia, // nuevo
        pesoNetoDiferencia, // nuevo
      };
    });
  }

  /** ========= Helper: nombre del archivo ========= */
  private buildFilename(
    base: string,
    ext: 'pdf' | 'xlsx',
    range?: { from?: string | null; to?: string | null },
  ) {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const tag =
      range?.from || range?.to
        ? `_${range?.from ?? ''}_${range?.to ?? ''}`
        : '';
    return `${base}${tag}_${stamp}.${ext}`;
  }

  /** ========= Excel (ExcelJS) ========= */
  private async buildExcel(opts: {
    title: string;
    subtitle: string;
    headers: string[];
    data: any[][];
    // NUEVO: opciones de presentación por reporte
    widths?: number[]; // ancho por columna (en “excel width” units)
    align?: Array<'left' | 'center' | 'right'>; // alineación horizontal por columna
    headerRowHeight?: number; // alto del encabezado (px aprox.)
    rowHeight?: number; // alto de filas de datos
  }): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Reporte');

    // Logo (opcional)
    const logoPath = this.getLogoFilePath();
    let hasLogo = false;
    if (logoPath) {
      const imageId = wb.addImage({ filename: logoPath, extension: 'png' });
      ws.addImage(imageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 160, height: 40 },
      });
      hasLogo = true;
    }

    // Título
    const titleRow = ws.addRow([opts.title]);
    titleRow.font = { bold: true, size: 14 };
    ws.mergeCells(titleRow.number, 1, titleRow.number, opts.headers.length);
    titleRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Subtítulo
    const subRow = ws.addRow([opts.subtitle]);
    ws.mergeCells(subRow.number, 1, subRow.number, opts.headers.length);
    subRow.alignment = { vertical: 'middle', horizontal: 'center' };

    if (hasLogo) ws.addRow([]); // espacio bajo cabecera

    // Encabezados
    const headerRow = ws.addRow(opts.headers);
    headerRow.font = { bold: true };
    headerRow.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
    headerRow.eachCell((c) => {
      c.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
      c.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEFEFEF' },
      };
    });

    // Altura del encabezado (configurable)
    headerRow.height = opts.headerRowHeight ?? 40;

    // ✅ APLICA ANCHOS COLUMNA POR COLUMNA ANTES DE LOS DATOS
    const defaultWidths = [6, 22, 22, 28, 18, 12, 12, 28, 28];
    for (let i = 0; i < opts.headers.length; i++) {
      const w = opts.widths?.[i] ?? defaultWidths[i] ?? 22;
      ws.getColumn(i + 1).width = w;
    }

    // Datos
    opts.data.forEach((row) => {
      const excelRow = row.map((cell: any) => {
        if (cell && typeof cell === 'object') {
          if (Array.isArray(cell.stack)) {
            return cell.stack.map((p: any) => p?.text ?? '').join('\n');
          }
          if ('text' in cell) return String(cell.text ?? '');
        }
        return cell ?? '';
      });

      const r = ws.addRow(excelRow);

      // Altura de filas de datos (opcional)
      if (opts.rowHeight) r.height = opts.rowHeight;

      r.eachCell((c, colNumber) => {
        c.border = {
          top: { style: 'hair' },
          bottom: { style: 'hair' },
          left: { style: 'hair' },
          right: { style: 'hair' },
        };
        // Alineación por columna si viene, si no: primeras 3 centradas (fechas/nro), resto a la izquierda
        const idx = colNumber - 1;
        const colAlign = opts.align?.[idx];
        if (colAlign) {
          c.alignment = {
            vertical: 'middle',
            horizontal: colAlign as any,
            wrapText: true,
          };
        } else {
          c.alignment = {
            vertical: 'middle',
            horizontal: colNumber <= 3 ? 'center' : 'left',
            wrapText: true,
          };
        }
      });
    });

    const arrayBuffer = await wb.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  /** ========= PDF (pdfmake) ========= */
  private async buildPdf(opts: {
    title: string;
    subtitle?: string;
    headers: string[];
    data: any[][];
    // Opcionales de “presentación”
    pageSize?: 'A4' | 'LETTER';
    orientation?: 'landscape' | 'portrait';
    zebra?: boolean; // filas alternas sombreadas
    showPageNumbers?: boolean; // numeración de páginas en footer
    watermarkText?: string; // marca de agua
    columnWidths?: Array<number | 'auto' | '*'>; // anchos de columnas
    centerCols?: number[]; // índices de columnas a centrar (ej. fechas)
    rightCols?: number[]; // índices a alinear a la derecha (números)
    keepHeader?: boolean; // repetir header y evitar cortes feos
  }): Promise<Buffer> {
    const {
      title,
      subtitle = '',
      headers,
      data,
      pageSize = 'LETTER',
      orientation = 'landscape',
      zebra = true,
      showPageNumbers = true,
      watermarkText,
      columnWidths, // si no viene, calculamos abajo
      centerCols = [0, 1], // por defecto, centramos primeras 2 (fechas)
      rightCols = [], // numéricas a la derecha
      keepHeader = true,
    } = opts;

    // 1) Fuentes locales
    const fonts = {
      Roboto: {
        normal: path.join(process.cwd(), 'assets/fonts/Roboto-Regular.ttf'),
        bold: path.join(process.cwd(), 'assets/fonts/Roboto-Medium.ttf'),
        italics: path.join(process.cwd(), 'assets/fonts/Roboto-Italic.ttf'),
        bolditalics: path.join(
          process.cwd(),
          'assets/fonts/Roboto-MediumItalic.ttf',
        ),
      },
    };
    const printer = new (PdfPrinter as any)(fonts);

    // 2) Logo (base64) opcional
    const logo = this.getLogoBase64();

    // 3) Construcción de body de tabla
    // Encabezado con estilo
    const headerRow = headers.map((h) => ({
      text: h,
      style: 'tableHeader',
      alignment: 'center',
    }));

    // Mapear filas con alineación por columna
    const bodyRows = data.map((r) =>
      r.map((cell, i) => {
        const val = cell ?? '';
        const base: any = { text: String(val) };
        if (centerCols.includes(i)) base.alignment = 'center';
        else if (rightCols.includes(i)) base.alignment = 'right';
        else base.alignment = 'left';
        return base;
      }),
    );

    // 4) Anchos de columna
    const widths =
      columnWidths ??
      headers.map((_, i) => {
        if (centerCols.includes(i)) return 90;
        if (rightCols.includes(i)) return 'auto';
        return '*';
      });

    // 5) docDefinition
    const docDef: any = {
      pageSize,
      pageOrientation: orientation,
      pageMargins: [30, 40, 30, 40],
      // Marca de agua (opcional)
      background: watermarkText
        ? (currentPage: number) => ({
            text: watermarkText,
            style: 'watermark',
          })
        : undefined,
      // Footer con numeración y fecha/hora
      footer: showPageNumbers
        ? (currentPage: number, pageCount: number) => ({
            columns: [
              {
                text: `Generado: ${new Date().toLocaleString('es-SV')}`,
                margin: [30, 0, 0, 0],
              },
              {
                text: `Página ${currentPage} de ${pageCount}`,
                alignment: 'right',
                margin: [0, 0, 30, 0],
              },
            ],
            fontSize: 8,
          })
        : undefined,
      // Estilos reutilizables
      styles: {
        titleCenter: { bold: true, fontSize: 12, alignment: 'center' },
        subtitleCenter: { fontSize: 9, alignment: 'center' },
        h1: {
          bold: true,
          fontSize: 12,
          alignment: 'center',
          margin: [0, 4, 0, 0],
        },
        h2: { fontSize: 9, alignment: 'center', margin: [0, 2, 0, 0] },
        tableHeader: { bold: true, fillColor: '#efefef' },
        watermark: {
          color: '#e0e0e0',
          bold: true,
          fontSize: 80,
          opacity: 0.15,
          alignment: 'center',
        },
      },
      content: [
        // Título + subtítulo
        {
          stack: [
            logo
              ? {
                  image: logo,
                  width: 150,
                  alignment: 'right',
                  margin: [0, 0, 0, 12],
                }
              : {
                  text: '',
                },
            {
              text: opts.title,
              style: 'titleCenter',
            },
            opts.subtitle
              ? {
                  text: opts.subtitle,
                  style: 'subtitleCenter',
                }
              : {},
          ],
          margin: [0, 0, 0, 10],
        },
        // Tabla
        {
          table: {
            headerRows: 1,
            widths,
            body: [
              opts.headers.map((h) => ({
                text: h,
                bold: true,
                alignment: 'center',
              })),
              ...opts.data.map((r) =>
                r.map((c, i) => {
                  // si ya viene un objeto pdfmake (stack/text), lo respetamos
                  if (
                    c &&
                    typeof c === 'object' &&
                    ('text' in c || 'stack' in c)
                  ) {
                    // si no trae alignment, aplicamos el default por columna
                    return 'alignment' in c
                      ? c
                      : { ...c, alignment: i < 3 ? 'center' : 'left' };
                  }
                  // si viene como primitivo, lo envolvemos
                  return {
                    text: c ?? '',
                    alignment: i < 3 ? 'center' : 'left',
                  };
                }),
              ),
            ],
          },
          layout: {
            // Cebra y header gris
            fillColor: (rowIndex: number) => {
              if (rowIndex === 0) return '#efefef'; // header
              if (zebra && rowIndex % 2 === 0) return '#fbfbfb'; // cebra
              return null;
            },
            hLineColor: () => '#cccccc',
            vLineColor: () => '#cccccc',
            hLineWidth: (i: number, node: any) =>
              i === 0 || i === node.table.body.length ? 1 : 0.3,
            vLineWidth: () => 0.3,
          },
          // Mantener filas sin partir y encabezado repetido
          dontBreakRows: keepHeader,
          keepWithHeaderRows: keepHeader ? 1 : 0,
        },
      ],
      defaultStyle: { fontSize: 9 },
    };

    // 6) Render
    const pdfDoc = printer.createPdfKitDocument(docDef);
    const chunks: Buffer[] = [];
    return await new Promise<Buffer>((resolve, reject) => {
      pdfDoc.on('data', (d: Buffer) => chunks.push(d));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });
  }

  /** ========= Consulta lista negra (modo 1) ========= */
  private async getBlacklistRows(filter: ShipmentTimesFilterDto) {
    const { from, to } = filter;

    if (from && to && new Date(from) > new Date(to)) {
      throw new BadRequestException('"from" no puede ser mayor que "to".');
    }

    // 🔧 Parametrización @0, @1, @2...
    const params: any[] = [];
    const addParam = (v: any) => {
      const idx = params.length;
      params.push(v);
      return `@${idx}`;
    };

    // ===== WHERE interno (subquery) =====
    let innerWhere = `
    WHERE bd.status_blacklist <> 3
  `;

    // Filtros por rango (opcionales) — intersección con la ventana de castigo
    if (from && to) {
      const pFrom1 = addParam(from);
      const pTo1 = addParam(to);
      const pFrom2 = addParam(from);
      const pTo2 = addParam(to);
      const pFrom3 = addParam(from);
      const pTo3 = addParam(to);

      innerWhere += `
      AND (
        (CAST(bd.penalty_start_date AS DATE) BETWEEN ${pFrom1} AND ${pTo1})
        OR
        (CAST(bd.penalty_end_date   AS DATE) BETWEEN ${pFrom2} AND ${pTo2})
        OR
        (CAST(bd.penalty_start_date AS DATE) <= ${pFrom3} AND CAST(bd.penalty_end_date AS DATE) >= ${pTo3})
      )
    `;
    } else if (from) {
      const pFromA = addParam(from);
      const pFromB = addParam(from);
      innerWhere += `
      AND (
        CAST(bd.penalty_start_date AS DATE) >= ${pFromA}
        OR CAST(bd.penalty_end_date AS DATE) >= ${pFromB}
      )
    `;
    } else if (to) {
      const pToA = addParam(to);
      const pToB = addParam(to);
      innerWhere += `
      AND (
        CAST(bd.penalty_start_date AS DATE) <= ${pToA}
        OR CAST(bd.penalty_end_date AS DATE) <= ${pToB}
      )
    `;
    }

    // ===== Subquery DISTINCT + claves de orden =====
    const innerSelect = `
    SELECT DISTINCT
      d.name                              AS [Motorista],
      d.license                           AS [Licencia],
      s.transporter                       AS [Empresa Transporte],
      bd.penalty_type                     AS [Tipo Castigo],
      CONVERT(VARCHAR(10), bd.penalty_start_date, 120) AS [Fecha Inicio],
      CONVERT(VARCHAR(10), bd.penalty_end_date,   120) AS [Fecha Fin],
      bd.ban_duration_days                AS [Tiempo],
      bd.description                      AS [Comentario],
      -- claves de ordenamiento (no visibles fuera)
      bd.penalty_start_date               AS sort_start,
      bd.penalty_end_date                 AS sort_end
    FROM BlacklistDrivers bd
    INNER JOIN Drivers   d ON d.id = bd.driver_id
    INNER JOIN Shipments s ON s.id = bd.shipment_id
    ${innerWhere}
  `;

    // ===== SELECT externo con ORDER BY usando las claves =====
    const sql = `
    SELECT 
      q.[Motorista],
      q.[Licencia],
      q.[Empresa Transporte],
      q.[Tipo Castigo],
      q.[Fecha Inicio],
      q.[Fecha Fin],
      q.[Tiempo],
      q.[Comentario]
    FROM ( ${innerSelect} ) AS q
    ORDER BY
      CASE WHEN q.sort_start IS NULL THEN 1 ELSE 0 END,
      q.sort_start,
      CASE WHEN q.sort_end   IS NULL THEN 1 ELSE 0 END,
      q.sort_end,
      q.[Motorista]
  `;

    const rows = await this.dataSource.manager.query(sql, params);

    return {
      variant: 'blacklist',
      count: rows.length,
      rows,
      range: from || to ? { from: from ?? null, to: to ?? null } : null,
    };
  }

  /** ========= Consulta principal (modo 2) ========= */
  private async getShipmentTimes(filter: ShipmentTimesFilterDto) {
    const { from, to, onlyCompleted } = filter;

    if (!from && !to) {
      throw new BadRequestException(
        'Debes enviar al menos un filtro: fecha desde o fecha hasta.',
      );
    }
    if (from && to && new Date(from) > new Date(to)) {
      throw new BadRequestException('"from" no puede ser mayor que "to".');
    }

    const q = this.shipmentsRepository
      .createQueryBuilder('s')
      .innerJoin('s.driver', 'd')
      .innerJoin('s.vehicle', 'v')
      .leftJoin('s.statuses', 'ingreso', 'ingreso.predefined_status_id = 6')
      .leftJoin('s.statuses', 'salida', 'salida.predefined_status_id = 12')
      .leftJoin('s.ingenio', 'cli')
      .leftJoin('cli.user', 'u')
      .select([
        // === Número consecutivo ===
        `ROW_NUMBER() OVER (
          ORDER BY 
            CASE WHEN ingreso.created_at IS NULL THEN 1 ELSE 0 END,
            ingreso.created_at,
            CASE WHEN salida.created_at IS NULL THEN 1 ELSE 0 END,
            salida.created_at
       ) AS Id`,

        'd.license AS Licencia',
        'd.name AS Motorista',
        's.transporter AS Transportista',

        // Cliente sin guion bajo en el contenido
        "REPLACE(cli.name, '_', ' ') AS Cliente",

        // Producto
        `CASE 
                    WHEN UPPER(LTRIM(RTRIM(s.product))) = 'AZ-001'  THEN N'Azúcar'
                    WHEN UPPER(LTRIM(RTRIM(s.product))) = 'MEL-001' THEN N'Melaza'
                    ELSE LTRIM(RTRIM(s.product))
                END AS Producto`,

        // Actividad
        `CASE 
                    WHEN UPPER(LTRIM(RTRIM(s.activity_number))) = 2 THEN N'Recepción de Azúcar y Melaza'
                    ELSE LTRIM(RTRIM(s.activity_number))
                END AS Actividad`,

        'v.plate AS [Placa Cabezal]',
        'v.trailer_plate AS [Placa Remolque]',
        'CONVERT(VARCHAR(19), ingreso.created_at, 120) AS [Fecha Hora Ingreso]',
        'CONVERT(VARCHAR(19), salida.created_at, 120)  AS [Fecha Hora Salida]',
        `CASE 
         WHEN ingreso.created_at IS NOT NULL 
          AND salida.created_at  IS NOT NULL 
          AND salida.created_at  >= ingreso.created_at
         THEN 
           RIGHT(CONCAT('00', DATEDIFF(SECOND, ingreso.created_at, salida.created_at)/3600), 2) + ':' +
           RIGHT(CONCAT('00', (DATEDIFF(SECOND, ingreso.created_at, salida.created_at)%3600)/60), 2) + ':' +
           RIGHT(CONCAT('00', DATEDIFF(SECOND, ingreso.created_at, salida.created_at)%60), 2)
         ELSE NULL
       END AS Tiempo`,
      ]);

    // === Filtros de fecha ===
    if (from && to) {
      q.andWhere(
        new Brackets((qb) =>
          qb
            .where('CAST(ingreso.created_at AS DATE) BETWEEN :from AND :to')
            .orWhere('CAST(salida.created_at  AS DATE) BETWEEN :from AND :to'),
        ),
        { from, to },
      );
    } else if (from) {
      q.andWhere(
        new Brackets((qb) =>
          qb
            .where('CAST(ingreso.created_at AS DATE) >= :from')
            .orWhere('CAST(salida.created_at  AS DATE) >= :from'),
        ),
        { from },
      );
    } else if (to) {
      q.andWhere(
        new Brackets((qb) =>
          qb
            .where('CAST(ingreso.created_at AS DATE) <= :to')
            .orWhere('CAST(salida.created_at  AS DATE) <= :to'),
        ),
        { to },
      );
    }

    if (onlyCompleted === 'true') {
      q.andWhere('ingreso.created_at IS NOT NULL')
        .andWhere('salida.created_at  IS NOT NULL')
        .andWhere('salida.created_at  >= ingreso.created_at');
    }

    const rows = await q.getRawMany();

    return {
      variant: 'times',
      count: rows.length,
      rows,
      range: from || to ? { from: from ?? null, to: to ?? null } : null,
      onlyCompleted: onlyCompleted === 'true',
    };
  }

  private getLogoFilePath(): string | null {
    const candidates = [
      // build (assets copiados con nest-cli)
      path.resolve(__dirname, '../../assets/almapac.png'),
      // dev (ejecutando desde src)
      path.resolve(process.cwd(), 'src/assets/almapac.png'),
      // si decides moverlo a public/
      path.resolve(process.cwd(), 'public/almapac.png'),
      path.resolve(__dirname, '../../public/almapac.png'),
    ];
    for (const p of candidates) if (fs.existsSync(p)) return p;
    console.warn('[Report] Logo no encontrado. Rutas probadas:', candidates);
    return null;
  }

  private getLogoBase64(): string | undefined {
    const file = this.getLogoFilePath();
    if (!file) return undefined;
    const b64 = fs.readFileSync(file).toString('base64');
    return `data:image/png;base64,${b64}`;
  }

  async findBrixEligible(query: BrixEligibleQueryDto) {
    const {
      startDate,
      endDate,
      ingenio,
      trailerPlate,
      page = 1,
      pageSize = 20,
    } = query;

    const hasRange = !!(startDate && endDate);
    const start = hasRange ? new Date(`${startDate}T00:00:00`) : null;
    const end = hasRange ? new Date(`${endDate}T23:59:59.999`) : null;

    const qb = this.shipmentRepo
      .createQueryBuilder('s')
      // relaciones
      .innerJoin('s.ingenio', 'c')
      .leftJoin('s.vehicle', 'v')
      .leftJoin('s.shipmentTemperatures', 'st_temp')
      // JOIN con el último status usando window function para SQL Server
      .innerJoin(
        `(
                    SELECT *, 
                    ROW_NUMBER() OVER (PARTITION BY shipment_id ORDER BY created_at DESC) as rn
                    FROM Status
                )`,
        'st',
        'st.shipment_id = s.id AND st.rn = 1',
      )
      .where('s.product = :product', { product: 'MEL-001' })
      .andWhere('s.brix IS NULL')
      // solo envíos con current_status >= 9 Y <= 12
      //.andWhere('s.current_status >= :minCurrent', { minCurrent: 9 })
      //.andWhere('s.current_status <= :maxCurrent', { maxCurrent: 12 })
      // Validar que el último status tenga predefined_status_id >= 9
      .andWhere('st.predefined_status_id BETWEEN :minStatus AND :maxStatus', {
        minStatus: 9,
        maxStatus: 12,
      });

    if (ingenio) {
      qb.andWhere('c.ingenioCode = :ingenio', { ingenio });
    }

    if (trailerPlate) {
      qb.andWhere('v.trailer_plate = :trailerPlate', { trailerPlate });
    }

    if (hasRange) {
      qb.andWhere('st.created_at BETWEEN :start AND :end', { start, end });
    }

    qb.select([
      'c.name             AS ingenio_name',
      'c.ingenioCode      AS ingenio_code',
      's.id               AS shipment_id',
      'v.truck_type       AS truckType',
      'v.plate            AS plate',
      'v.trailer_plate    AS trailerPlate',
      'st.created_at      AS dateTimeDownload',
    ])
      .groupBy('c.name')
      .addGroupBy('c.ingenioCode')
      .addGroupBy('s.id')
      .addGroupBy('v.truck_type')
      .addGroupBy('v.plate')
      .addGroupBy('v.trailer_plate')
      .addGroupBy('st.id')
      .addGroupBy('st.created_at')
      // Validar que NO tenga 4 o más registros de temperatura
      .having('COUNT(st_temp.id) < :maxTemperatures', { maxTemperatures: 4 })
      .orderBy('st.created_at', 'DESC');

    // total (aplicando las mismas validaciones)
    const totalRow = await qb
      .clone()
      .select('COUNT(DISTINCT s.id)', 'cnt')
      .orderBy() // limpiar ORDER BY en el conteo
      .getRawOne<{ cnt: string }>();
    const total = Number(totalRow?.cnt ?? 0);

    const rows = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getRawMany<{
        ingenio_name: string;
        ingenio_code: string;
        shipment_id: number;
        truckType: string | null;
        plate: string | null;
        trailerPlate: string | null;
        dateTimeDownload: Date | null;
      }>();

    const buckets = new Map<
      string,
      { name: string; ingenioCode: string; total: number; data: any[] }
    >();
    for (const r of rows) {
      const code = r.ingenio_code ?? 'SIN_CODIGO';
      const name = r.ingenio_name ?? 'Sin nombre';
      if (!buckets.has(code))
        buckets.set(code, { name, ingenioCode: code, total: 0, data: [] });
      const b = buckets.get(code)!;
      b.total += 1;
      b.data.push({
        shipment_id: r.shipment_id,
        truckType: r.truckType ?? null,
        plate: r.plate ?? null,
        trailerPlate: r.trailerPlate ?? null,
        dateTimeDownload: r.dateTimeDownload,
      });
    }

    return {
      page,
      pageSize,
      total,
      ingenio: Array.from(buckets.values()),
    };
  }

  /** ===== POST: Asignar Brix a EXACTAMENTE 3 shipments =====
   * Valida: 3 IDs, mismo ingenio, current_status > 9, brix NULL
   * Inserta en tabla Brix e actualiza shipments.brix
   */
  async assignBrix(dto: AssignBrixDto) {
    const { brix, shipments: ids } = dto;

    // 🔒 Validar duplicados
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length !== ids.length) {
      throw new BadRequestException('No se permiten shipment_id repetidos.');
    }

    if (uniqueIds.length !== 3) {
      throw new BadRequestException(
        'Debes enviar exactamente 3 shipment_id distintos.',
      );
    }

    // Cargar shipments
    const shipments = await this.shipmentRepo.find({
      where: { id: In(uniqueIds) },
      select: ['id', 'currentStatus', 'brix', 'product'],
      relations: ['ingenio'],
    });

    if (shipments.length !== 3) {
      throw new BadRequestException('Alguno de los shipment_id no existe.');
    }

    // Validar mismo ingenio
    const ingenios = new Set(shipments.map((s) => s.ingenio?.ingenioCode));
    if (ingenios.size !== 1) {
      throw new BadRequestException(
        'Los 3 shipments deben pertenecer al mismo ingenio.',
      );
    }

    // Validar estado y brix existente
    for (const s of shipments) {
      if ((s.currentStatus ?? 0) <= 8) {
        throw new BadRequestException(
          `El shipment ${s.id} no cumple con currentStatus > 8.`,
        );
      }
      if (s.brix !== null && s.brix !== undefined) {
        // 🚨 Mensaje explícito
        throw new BadRequestException(
          `El shipment ${s.id} ya tiene un valor de brix asignado (${s.brix}).`,
        );
      }
    }

    // Transacción: insertar en Brix y actualizar Shipments
    return await this.dataSource.transaction(async (manager) => {
      const brixEntities = uniqueIds.map((id) => {
        const rec = new Brix();
        rec.shipment_id = id;
        rec.brix = brix;
        return rec;
      });
      await manager.getRepository(Brix).save(brixEntities);

      for (const id of uniqueIds) {
        await manager
          .getRepository(Shipments)
          .createQueryBuilder()
          .update(Shipments)
          .set({ brix })
          .where('id = :id', { id })
          .andWhere('brix IS NULL')
          .andWhere('current_status > 8')
          .execute();
      }

      return {
        ok: true,
        message: 'Brix asignado a 3 shipments.',
        brix,
        ingenio: [...ingenios][0],
        updated: uniqueIds,
      };
    });
  }

  /**
   * Obtiene estadísticas de transacciones del día actual o rango de fechas
   * Retorna totales de productos, unidades y transacciones agrupadas por estado
   */
  async getDailyTransactionsStats(
    customerId?: string,
    productId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    try {
      // Si se proporcionan fechas, usarlas; de lo contrario, usar el día actual
      let startOfDay: Date;
      let endOfDay: Date;

      if (startDate && endDate) {
        startOfDay = new Date(`${startDate}T00:00:00`);
        endOfDay = new Date(`${endDate}T23:59:59.999`);
      } else {
        const today = new Date();
        startOfDay = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          0,
          0,
          0,
        );
        endOfDay = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          23,
          59,
          59,
          999,
        );
      }

      // Construir query con filtros opcionales
      const queryBuilder = this.shipmentsRepository
        .createQueryBuilder('s')
        .leftJoin('s.ingenio', 'c')
        .where('s.dateTimeCurrentStatus BETWEEN :startOfDay AND :endOfDay', {
          startOfDay,
          endOfDay,
        })
        .select(['s.id', 's.product', 's.productQuantity', 's.currentStatus']);

      // Filtrar por customerId si se proporciona
      if (customerId) {
        queryBuilder.andWhere('c.ingenioNavCode = :customerId', { customerId });
      }

      // Filtrar por productId si se proporciona
      if (productId) {
        queryBuilder.andWhere('s.product = :productId', { productId });
      }

      const shipments = await queryBuilder.getMany();

      // Calcular totales
      const uniqueProducts = new Set(shipments.map((s) => s.product)).size;
      const totalUnits = shipments.reduce(
        (sum, s) => sum + (Number(s.productQuantity) || 0),
        0,
      );
      const totalTransactions = shipments.length;

      // Contar por estado
      const inTransito = shipments.filter((s) => s.currentStatus === 1).length;
      const inPreCheck = shipments.filter((s) => s.currentStatus === 2).length;
      const inProgress = shipments.filter(
        (s) =>
          s.currentStatus > 2 &&
          s.currentStatus !== 12 &&
          s.currentStatus !== 14,
      ).length;
      const dispatched = shipments.filter(
        (s) => s.currentStatus >= 11 && s.currentStatus <= 12,
      ).length;

      return {
        header: {
          code: 200,
          message: 'Estadísticas obtenidas exitosamente',
          exception: null,
        },
        data: {
          totalProducts: uniqueProducts,
          totalUnits: Math.round(totalUnits * 100) / 100,
          totalTransactions,
          transactions: {
            inTransito,
            inPreCheck,
            inProgress,
            dispatched,
          },
        },
      };
    } catch (error) {
      throw new InternalServerErrorException({
        header: {
          code: 500,
          message: 'Error al obtener estadísticas de transacciones',
          exception: error.message,
        },
        data: null,
      });
    }
  }

  /**
   * Obtiene reporte detallado de envíos filtrado por código de producto, estados, ingenio y con paginación
   * Incluye fechas y horas de prechequeo, creación, entrada y salida
   */
  async getDetailedShipmentReport(
    productId?: string,
    transactionStatus?: number,
    customerId?: string,
    pageNumber: number = 1,
    pageSize: number = 10,
    startDate?: string,
    endDate?: string,
  ) {
    try {
      // Si se proporcionan fechas, usarlas; de lo contrario, usar el día actual
      let startOfDay: Date;
      let endOfDay: Date;

      if (startDate && endDate) {
        startOfDay = new Date(`${startDate}T00:00:00`);
        endOfDay = new Date(`${endDate}T23:59:59.999`);
      } else {
        const today = new Date();
        startOfDay = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          0,
          0,
          0,
        );
        endOfDay = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          23,
          59,
          59,
          999,
        );
      }

      // Construir query base sin cargar statuses directamente para evitar duplicados
      const queryBuilder = this.shipmentsRepository
        .createQueryBuilder('s')
        .leftJoinAndSelect('s.vehicle', 'v')
        .leftJoinAndSelect('s.driver', 'd')
        .leftJoinAndSelect('s.ingenio', 'c')
        .where('s.dateTimeCurrentStatus BETWEEN :startOfDay AND :endOfDay', {
          startOfDay,
          endOfDay,
        });

      // Filtrar por código de producto si se proporciona
      if (productId) {
        queryBuilder.andWhere('s.product = :productId', { productId });
      }

      // Filtrar por ingenio (customerId = ingenio_nav_code) si se proporciona
      if (customerId) {
        queryBuilder.andWhere('c.ingenioNavCode = :customerId', { customerId });
      }

      // Filtrar por estados si se proporcionan
      const status = transactionStatus;
      if (status === 1) {
        queryBuilder.andWhere('s.currentStatus = 1');
      } else if (status === 2) {
        queryBuilder.andWhere('s.currentStatus = 2');
      } else if (status === 3) {
        // inProgress: status > 2 y != 12 y != 14
        queryBuilder.andWhere(
          's.currentStatus > 2 AND s.currentStatus != 12 AND s.currentStatus != 14',
        );
      } else if (status === 4) {
        // dispatched: status = 12
        queryBuilder.andWhere(
          's.currentStatus >= 11 AND s.currentStatus <= 12',
        );
      } else if (status) {
        throw new BadRequestException(
          'Estado inválido. Los estados válidos son: 1, 2, 3, 4',
        );
      }

      // Contar total de registros antes de paginar
      const total = await queryBuilder.getCount();

      // Aplicar paginación y ordenamiento por fecha de creación descendente
      queryBuilder
        .orderBy('s.createdAt', 'DESC')
        .skip((pageNumber - 1) * pageSize)
        .take(pageSize);

      const shipments = await queryBuilder.getMany();

      // Cargar los statuses por separado para evitar duplicados
      const shipmentIds = shipments.map((s) => s.id);

      let statusesMap: Map<number, any[]> = new Map();
      if (shipmentIds.length > 0) {
        const statuses = await this.dataSource
          .getRepository(Status)
          .createQueryBuilder('st')
          .leftJoinAndSelect('st.predefinedStatus', 'ps')
          .leftJoin('st.shipment', 's')
          .addSelect('s.id')
          .where('s.id IN (:...ids)', { ids: shipmentIds })
          .getMany();

        // Agrupar statuses por shipment_id
        statuses.forEach((status) => {
          const shipmentId = status.shipment?.id;
          if (shipmentId) {
            if (!statusesMap.has(shipmentId)) {
              statusesMap.set(shipmentId, []);
            }
            statusesMap.get(shipmentId)!.push(status);
          }
        });
      }

      // Formatear resultados
      const formattedData = shipments.map((shipment) => {
        // Obtener los statuses de este shipment desde el mapa
        const shipmentStatuses = statusesMap.get(shipment.id) || [];

        // Buscar fecha de entrada (status 5)
        const entryStatus = shipmentStatuses.find(
          (st) => st.predefinedStatus?.id === 5,
        );
        const admissionDate = entryStatus?.createdAt;

        // Buscar fecha de salida (status 11)
        const exitStatus = shipmentStatuses.find(
          (st) => st.predefinedStatus?.id === 11,
        );
        const departureDate = exitStatus?.createdAt;

        return {
          product: this.getProductNameByCode(shipment.product),
          preCheckDate: shipment.dateTimePrecheckeo
            ? new Date(shipment.dateTimePrecheckeo).toISOString().split('T')[0]
            : null,
          preCheckTime: shipment.dateTimePrecheckeo
            ? new Date(shipment.dateTimePrecheckeo).toTimeString().split(' ')[0]
            : null,
          createdDate: shipment.createdAt
            ? new Date(shipment.createdAt).toISOString().split('T')[0]
            : null,
          createdTime: shipment.createdAt
            ? new Date(shipment.createdAt).toTimeString().split(' ')[0]
            : null,
          plate: shipment.vehicle?.plate || null,
          trailer: shipment.vehicle?.trailerPlate || null,
          driver: shipment.driver?.name || null,
          transport: shipment.transporter,
          admissionDate: admissionDate
            ? new Date(admissionDate).toISOString().split('T')[0]
            : null,
          admissionTime: admissionDate
            ? new Date(admissionDate).toTimeString().split(' ')[0]
            : null,
          departureDate: departureDate
            ? new Date(departureDate).toISOString().split('T')[0]
            : null,
          departureTime: departureDate
            ? new Date(departureDate).toTimeString().split(' ')[0]
            : null,
          netWeight:
            Math.round((shipment.pesoBruto - shipment.pesoTara) * 1000) / 1000,
        };
      });

      return {
        header: {
          code: 200,
          message: 'Reporte obtenido exitosamente',
          exception: null,
        },
        data: formattedData,
        pagination: {
          pageNumber,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    } catch (error) {
      throw new InternalServerErrorException({
        header: {
          code: 500,
          message: 'Error al obtener reporte',
          exception: error.message,
        },
        data: null,
      });
    }
  }

  /**
   * Obtiene el total de transacciones agrupadas por fecha
   * Retorna el total de transacciones para cada fecha en el rango especificado
   */
  async getTransactionsByDateRange(
    customerId?: string,
    productId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    try {
      // Validar que se proporcionen ambas fechas
      if (!startDate || !endDate) {
        throw new BadRequestException({
          header: {
            code: 400,
            message: 'Se requieren startDate y endDate',
            exception: 'Ambas fechas son obligatorias',
          },
          data: null,
        });
      }

      const startOfRange = new Date(`${startDate}T00:00:00`);
      const endOfRange = new Date(`${endDate}T23:59:59.999`);

      // Construir query con filtros opcionales
      const queryBuilder = this.shipmentsRepository
        .createQueryBuilder('s')
        .leftJoin('s.ingenio', 'c')
        .where(
          's.dateTimeCurrentStatus BETWEEN :startOfRange AND :endOfRange',
          { startOfRange, endOfRange },
        )
        .select([
          's.id',
          's.dateTimeCurrentStatus',
          's.product',
          's.idNavRecord',
        ]);

      // Filtrar por customerId si se proporciona
      if (customerId) {
        queryBuilder.andWhere('c.ingenioNavCode = :customerId', { customerId });
      }

      // Filtrar por productId si se proporciona
      if (productId) {
        queryBuilder.andWhere('s.product = :productId', { productId });
      }

      const shipments = await queryBuilder.getMany();

      // Calcular totales generales
      const totalTransactions = shipments.length;
      const uniqueProducts = new Set(shipments.map((s) => s.product)).size;

      // Contar transacciones por producto (general)
      const productCounts: { [key: string]: number } = {};
      shipments.forEach((shipment) => {
        if (shipment.product) {
          productCounts[shipment.product] =
            (productCounts[shipment.product] || 0) + 1;
        }
      });

      // Agrupar transacciones por fecha y por producto
      const transactionsByDate: {
        [key: string]: {
          count: number;
          products: Set<string>;
          productCounts: { [key: string]: number };
        };
      } = {};

      shipments.forEach((shipment) => {
        if (shipment.dateTimeCurrentStatus) {
          const date = new Date(shipment.dateTimeCurrentStatus)
            .toISOString()
            .split('T')[0];

          if (!transactionsByDate[date]) {
            transactionsByDate[date] = {
              count: 0,
              products: new Set(),
              productCounts: {},
            };
          }

          transactionsByDate[date].count += 1;

          if (shipment.product) {
            transactionsByDate[date].products.add(shipment.product);
            transactionsByDate[date].productCounts[shipment.product] =
              (transactionsByDate[date].productCounts[shipment.product] || 0) +
              1;
          }
        }
      });

      // Convertir el objeto a un array ordenado por fecha
      const dailyStats = Object.entries(transactionsByDate)
        .map(([date, data]) => {
          const dailyData: any = {
            date,
            totalTransactions: data.count,
            uniqueProducts: data.products.size,
          };

          // Si NO se filtra por producto, mostrar el desglose por producto
          if (!productId) {
            dailyData.productBreakdown = Object.entries(data.productCounts).map(
              ([code, count]) => ({
                productCode: code,
                totalTransactions: count,
              }),
            );
          }

          return dailyData;
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      // Calcular días totales en el rango (incluyendo días sin transacciones)
      const totalDaysInRange =
        Math.ceil(
          (endOfRange.getTime() - startOfRange.getTime()) /
            (1000 * 60 * 60 * 24),
        ) + 1;
      const daysWithTransactions = dailyStats.length;

      // Calcular mediana de transacciones por día
      const transactionsPerDayArray = dailyStats
        .map((d) => d.totalTransactions)
        .sort((a, b) => a - b);
      const median =
        transactionsPerDayArray.length > 0
          ? transactionsPerDayArray.length % 2 === 0
            ? (transactionsPerDayArray[transactionsPerDayArray.length / 2 - 1] +
                transactionsPerDayArray[transactionsPerDayArray.length / 2]) /
              2
            : transactionsPerDayArray[
                Math.floor(transactionsPerDayArray.length / 2)
              ]
          : 0;

      // Encontrar día con más y menos transacciones
      const maxDay =
        dailyStats.length > 0
          ? dailyStats.reduce(
              (max, day) =>
                day.totalTransactions > max.totalTransactions ? day : max,
              dailyStats[0],
            )
          : null;
      const minDay =
        dailyStats.length > 0
          ? dailyStats.reduce(
              (min, day) =>
                day.totalTransactions < min.totalTransactions ? day : min,
              dailyStats[0],
            )
          : null;

      // Preparar el summary
      const summaryData: any = {
        totalTransactions,
        uniqueProducts,
        dateRange: {
          startDate,
          endDate,
          totalDays: totalDaysInRange,
          daysWithTransactions,
        },
        statistics: {
          median: Math.round(median * 100) / 100,
        },
        extremes: {
          maxTransactionsDay: maxDay,
          minTransactionsDay: minDay,
        },
      };

      // Si NO se filtra por producto, agregar el total por producto en general
      if (!productId) {
        summaryData.productTotals = Object.entries(productCounts).map(
          ([code, count]) => ({
            productCode: code,
            totalTransactions: count,
          }),
        );
      } else {
        // Si se filtra por producto, agregar info del producto filtrado
        summaryData.filteredProduct = {
          productCode: productId,
        };
      }

      return {
        header: {
          code: 200,
          message: 'Transacciones por fecha obtenidas exitosamente',
          exception: null,
        },
        data: {
          summary: summaryData,
          dailyBreakdown: dailyStats,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException({
        header: {
          code: 500,
          message: 'Error al obtener transacciones por fecha',
          exception: error.message,
        },
        data: null,
      });
    }
  }

  async registrarPesos(codeGen: string, navStatus: number) {
    console.log('>>> registrarPesos INICIO', { codeGen, navStatus });

    // 1) Buscar shipment por codeGen
    const shipment = await this.shipmentRepo.findOne({
      where: { codeGen }, // OJO: si tu campo en DB es code_gen, usa { code_gen: codeGen as any }
    });

    if (!shipment) {
      console.error('>>> NO se encontró shipment por codeGen', codeGen);
      throw new NotFoundException({
        message: `No existe la transacción con codeGen ${codeGen}.`,
      });
    }

    const idNavRecordFromShipment =
      (shipment as any).idNavRecord ?? (shipment as any).id_nav_record ?? null;

    if (
      idNavRecordFromShipment == null ||
      String(idNavRecordFromShipment).trim() === ''
    ) {
      console.error('>>> shipment SIN id_nav_record', {
        shipmentId: shipment.id,
        codeGen,
        idNavRecordFromShipment,
      });
      throw new BadRequestException({
        message: `La transacción ${codeGen} no tiene id_nav_record asociado.`,
      });
    }

    console.log('>>> Llamando middleware con', {
      urlBase: process.env.SERVER_MIDDLEWARE_NAME,
      idNavRecordFromShipment,
      navStatus,
    });

    // 2) Llamar a la Middleware
    const base =
      process.env.SERVER_MIDDLEWARE_NAME || 'http://localhost:5063/api/';
    const url = `${base.replace(/\/+$/, '')}/shipment/register-weights-on-status-change`;

    const payload = {
      idNavRecord: Number(idNavRecordFromShipment),
      newStatus: Number(navStatus),
      codeGen,
    };

    let middlewareBody: any;
    try {
      const resp = await firstValueFrom(
        this.http.post(url, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000,
          validateStatus: () => true,
        }),
      );
      middlewareBody = resp.data;
      console.log('>>> Respuesta middleware', JSON.stringify(middlewareBody));
    } catch (e: any) {
      console.error('>>> Error llamando middleware', e?.message ?? e);
      throw new BadRequestException({
        message: 'Error llamando al middleware para registrar pesos en NAV.',
        error: e?.message ?? String(e),
      });
    }

    if (!middlewareBody) {
      console.error('>>> middlewareBody vacío');
      throw new BadRequestException({
        message: 'Respuesta vacía del middleware al registrar pesos.',
      });
    }

    const navData = middlewareBody.data; // 👈 en tu JSON está todo dentro de "data"

    if (!navData) {
      console.error('>>> middlewareBody.data vacío');
      throw new BadRequestException({
        message: 'La respuesta del middleware no contiene el objeto data.',
        raw: middlewareBody,
      });
    }

    // 3) Extraer pesos EXACTAMENTE como vienen en tu JSON
    const pesoIn = navData.pesoIn ?? null;
    const pesoOut = navData.pesoOut ?? null;
    const pesoNeto = navData.pesoNeto ?? null;
    const idNavFromResponse =
      navData.idNavRecord ?? Number(idNavRecordFromShipment);

    console.log('>>> Pesos recibidos de NAV', {
      pesoIn,
      pesoOut,
      pesoNeto,
      idNavFromResponse,
    });

    // Si no viene ningún peso, no tiene sentido guardar
    if (
      (pesoIn == null || Number.isNaN(Number(pesoIn))) &&
      (pesoOut == null || Number.isNaN(Number(pesoOut))) &&
      (pesoNeto == null || Number.isNaN(Number(pesoNeto)))
    ) {
      console.warn('>>> No hay pesos válidos en la respuesta del middleware');
      return {
        success: false,
        message:
          'La respuesta del middleware no contiene pesos válidos para registrar.',
        nav: middlewareBody,
      };
    }

    // 4) Buscar (o crear) registro en shipment_weight
    let weight = await this.weightRepo.findOne({
      where: { shipment: { id: shipment.id } },
      relations: ['shipment'],
    });

    if (!weight) {
      console.log('>>> No existía registro en shipment_weight, creando nuevo');
      weight = this.weightRepo.create({
        shipment,
        pesoin: null,
        pesoout: null,
        pesoneto: null,
        datetime_in: null,
        datetime_out: null,
        bascula_in: null,
        bascula_out: null,
        id_nav_record: Number(idNavFromResponse),
      });
    } else {
      console.log('>>> Se encontró registro existente en shipment_weight', {
        weightId: weight.id,
      });
    }

    const now = new Date();

    // 5) Actualizar pesos y FECHAS (solo si antes eran null)
    if (pesoIn != null && !Number.isNaN(Number(pesoIn))) {
      weight.pesoin = Number(pesoIn);
      if (!weight.datetime_in) {
        weight.datetime_in = now; // 👈 fecha/hora actual
      }
    }

    if (pesoOut != null && !Number.isNaN(Number(pesoOut))) {
      weight.pesoout = Number(pesoOut);
      if (!weight.datetime_out) {
        weight.datetime_out = now; // 👈 fecha/hora actual
      }
    }

    if (pesoNeto != null && !Number.isNaN(Number(pesoNeto))) {
      weight.pesoneto = Number(pesoNeto);
    }

    weight.id_nav_record = Number(idNavFromResponse);

    const saved = await this.weightRepo.save(weight);
    console.log('Registro guardado en shipment_weight', {
      weightId: saved.id,
      shipmentId: shipment.id,
      pesoin: saved.pesoin,
      pesoout: saved.pesoout,
      pesoneto: saved.pesoneto,
      datetime_in: saved.datetime_in,
      datetime_out: saved.datetime_out,
    });

    return {
      success: true,
      message:
        'Pesos registrados/actualizados correctamente en shipment_weight.',
      data: {
        shipmentId: shipment.id,
        codeGen: shipment.codeGen ?? (shipment as any).code_gen,
        id_nav_record: saved.id_nav_record,
        pesoin: saved.pesoin,
        datetime_in: saved.datetime_in,
        pesoout: saved.pesoout,
        datetime_out: saved.datetime_out,
        pesoneto: saved.pesoneto,
        nav: middlewareBody,
      },
    };
  }
}

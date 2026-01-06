import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between } from 'typeorm';
import { SerialComprobante } from 'src/models/SerialComprobante';
import { SealSeries } from 'src/models/SealSeries';
import { Marchamos } from 'src/models/Marchamos';
import { CreateSerialComprobanteDto } from '../dto/create-serial-comprobante.dto';
import { UpdateSerialComprobanteDto } from '../dto/update-serial-comprobante.dto';
import { CreateSealSeriesDto } from '../dto/create-seal-series.dto';
import { UpdateSealSeriesDto } from '../dto/update-seal-series.dto';
import { CreateMarchamoDto } from '../dto/create-marchamo.dto';
import { Comprobante } from 'src/models/Comprobante';
import { AssignComprobanteDto } from '../dto/assign-comprobante.dto';
import { Shipments } from 'src/models/Shipments';
import { Clients } from 'src/models/Clients';
import { getProductNameByCode } from 'src/modules/data-inconsistency/utils/product.utils';
import { EmailService } from 'src/modules/email/services/email.service';
import { ConfigService } from 'src/modules/config/services/config.service';
import { AnularMarchamoDto } from '../dto/anular-marchamo.dto';

@Injectable()
export class WeighbridgeConfigService {
  constructor(
    @InjectRepository(SerialComprobante)
    private readonly serialRepo: Repository<SerialComprobante>,

    @InjectRepository(SealSeries)
    private readonly sealSeriesRepo: Repository<SealSeries>,

    @InjectRepository(Marchamos)
    private readonly marchamosRepo: Repository<Marchamos>,

    @InjectRepository(Comprobante)
    private readonly comprobanteRepo: Repository<Comprobante>,

    @InjectRepository(Shipments)
    private readonly shipmentsRepo: Repository<Shipments>,

    @InjectRepository(Clients)
    private readonly clientsRepo: Repository<Clients>,

    private readonly emailService: EmailService,

    private readonly configService: ConfigService,
  ) {}

  /**
   * Helper: Convierte el status de marchamo/comprobante a texto
   * status: 0 = ASIGNADO, 1 = ANULADO
   */
  private getStatusText(status: number | null | undefined): string {
    return status === 1 ? 'ANULADO' : 'ASIGNADO';
  }

  /**
   * Helper: Formatea un nombre eliminando guiones bajos y guiones
   */
  private formatName(name: string | null | undefined): string {
    if (!name) return '';
    return name.replace(/_/g, ' ').replace(/-/g, ' ').trim();
  }

  // ---------- Serial Comprobante ----------

  /**
   * Obtiene el siguiente comprobante disponible para una báscula,
   * tomando en cuenta TODAS sus series y TODOS los comprobantes ya usados.
   */

  // ---------- Serial Comprobante ----------
  async createSerialComprobante(dto: CreateSerialComprobanteDto) {
    if (dto.min_serialnumber > dto.max_serialnumber) {
      throw new BadRequestException(
        'El número inicial no puede ser mayor que el número final del rango.',
      );
    }

    // Validar que la última serie de la báscula tenga menos de 100 disponibles
    const ultimaSerie = await this.serialRepo.findOne({
      where: { id_bascula: dto.id_bascula },
      order: { created_at: 'DESC' } as any,
    });

    if (ultimaSerie) {
      // Calcular disponibles de la última serie
      const total =
        ultimaSerie.max_serialnumber - ultimaSerie.min_serialnumber + 1;

      const usados = await this.comprobanteRepo.count({
        where: {
          noComprobante: Between(
            ultimaSerie.min_serialnumber,
            ultimaSerie.max_serialnumber,
          ),
        },
      });

      const disponibles = total - usados;

      if (disponibles > 100) {
        throw new BadRequestException(
          `No se puede agregar una nueva serie. La última serie de la báscula ${dto.id_bascula} aún tiene ${disponibles} comprobantes disponibles.`,
        );
      }
    }

    // Validar que no existan rangos solapados con series existentes
    const seriesExistentes = await this.serialRepo.find();

    for (const serie of seriesExistentes) {
      const hayRangoSolapado =
        (dto.min_serialnumber >= serie.min_serialnumber &&
          dto.min_serialnumber <= serie.max_serialnumber) ||
        (dto.max_serialnumber >= serie.min_serialnumber &&
          dto.max_serialnumber <= serie.max_serialnumber) ||
        (dto.min_serialnumber <= serie.min_serialnumber &&
          dto.max_serialnumber >= serie.max_serialnumber);

      if (hayRangoSolapado) {
        throw new BadRequestException(
          `No se puede crear la serie. El rango ${dto.min_serialnumber} a ${dto.max_serialnumber} ya está en uso por otra serie de la báscula ${serie.id_bascula}.`,
        );
      }
    }

    const entity = this.serialRepo.create(dto);
    return this.serialRepo.save(entity);
  }

  /**
   * Eliminar una serie de comprobantes
   * Solo se permite si no hay comprobantes registrados en esa serie
   */
  async deleteSerialComprobante(id: number) {
    // Verificar que exista la serie
    const serie = await this.serialRepo.findOne({ where: { id } });

    if (!serie) {
      throw new BadRequestException(
        `No se encontró la serie de comprobantes solicitada.`,
      );
    }

    // Verificar si existen comprobantes en el rango de esta serie
    const comprobantesEnSerie = await this.comprobanteRepo.find({
      where: {
        noComprobante: Between(serie.min_serialnumber, serie.max_serialnumber),
      },
    });

    if (comprobantesEnSerie.length > 0) {
      throw new BadRequestException(
        `No se puede eliminar esta serie porque tiene ${comprobantesEnSerie.length} comprobante${comprobantesEnSerie.length > 1 ? 's' : ''} registrado${comprobantesEnSerie.length > 1 ? 's' : ''}.`,
      );
    }

    // Si no hay comprobantes, eliminar la serie
    await this.serialRepo.remove(serie);

    return {
      message: `Serie de comprobantes ${id} eliminada exitosamente.`,
      id,
      rango: `${serie.min_serialnumber}-${serie.max_serialnumber}`,
    };
  }

  /**
   * Actualiza una serie de comprobantes existente
   * PATCH /weighbridge/comprobante/series/:id
   */
  async updateSerialComprobante(id: number, dto: UpdateSerialComprobanteDto) {
    // 1) Verificar que la serie exista
    const serie = await this.serialRepo.findOne({ where: { id } });

    if (!serie) {
      throw new BadRequestException(
        `No se encontró la serie de comprobantes con id ${id}.`,
      );
    }

    // 2) Si se envía min o max, validar que min <= max
    const newMin = dto.min_serialnumber ?? serie.min_serialnumber;
    const newMax = dto.max_serialnumber ?? serie.max_serialnumber;

    if (newMin > newMax) {
      throw new BadRequestException(
        `El número inicial (${newMin}) no puede ser mayor que el número final (${newMax}).`,
      );
    }

    // 3) Buscar comprobantes ya asignados en esta serie
    const comprobantesUsados = await this.comprobanteRepo.find({
      where: {
        noComprobante: Between(serie.min_serialnumber, serie.max_serialnumber),
      },
      select: ['noComprobante'],
    });

    // 4) Si hay comprobantes usados, validar que el nuevo rango los incluya
    if (comprobantesUsados.length > 0) {
      const numerosUsados = comprobantesUsados.map((c) => c.noComprobante);
      const minUsado = Math.min(...numerosUsados);
      const maxUsado = Math.max(...numerosUsados);

      if (newMin > minUsado || newMax < maxUsado) {
        throw new BadRequestException(
          `No se puede cambiar el rango porque hay comprobantes asignados fuera del nuevo rango. ` +
            `Comprobantes usados: ${minUsado} - ${maxUsado}. Nuevo rango propuesto: ${newMin} - ${newMax}.`,
        );
      }

      // No permitir cambiar id_bascula si hay comprobantes asignados
      // (En este caso no se permite cambiar id_bascula en el DTO, pero es buena práctica validarlo)
    }

    // 5) Validar que el nuevo rango no se solape con otras series de la misma báscula
    if (
      dto.min_serialnumber !== undefined ||
      dto.max_serialnumber !== undefined
    ) {
      const seriesSolapadas = await this.serialRepo
        .createQueryBuilder('s')
        .where('s.id_bascula = :id_bascula', { id_bascula: serie.id_bascula })
        .andWhere('s.id != :id', { id })
        .andWhere(
          '(:newMin <= s.max_serialnumber AND :newMax >= s.min_serialnumber)',
          { newMin, newMax },
        )
        .getMany();

      if (seriesSolapadas.length > 0) {
        const detalles = seriesSolapadas
          .map(
            (s) => `Serie ${s.id}: ${s.min_serialnumber}-${s.max_serialnumber}`,
          )
          .join('; ');
        throw new BadRequestException(
          `El nuevo rango (${newMin}-${newMax}) se solapa con otras series de la misma báscula: ${detalles}`,
        );
      }
    }

    // 6) Aplicar los cambios
    if (dto.min_serialnumber !== undefined) {
      serie.min_serialnumber = dto.min_serialnumber;
    }
    if (dto.max_serialnumber !== undefined) {
      serie.max_serialnumber = dto.max_serialnumber;
    }
    if (dto.numero_caja !== undefined) {
      serie.numero_caja = dto.numero_caja;
    }

    // 7) Guardar cambios
    await this.serialRepo.save(serie);

    return {
      message: 'Serie de comprobantes actualizada exitosamente.',
      serie: {
        id: serie.id,
        id_bascula: serie.id_bascula,
        min_serialnumber: serie.min_serialnumber,
        max_serialnumber: serie.max_serialnumber,
        numero_caja: serie.numero_caja,
        created_at: serie.created_at,
      },
    };
  }

  /**
   * Lista las series de comprobantes por báscula (si se envía),
   * con: total, usados, anulados y disponibles de cada serie.
   */
  async listSerialesConUso(
    id_bascula?: number,
    page: number = 1,
    limit: number = 10,
  ) {
    const where: any = {};
    if (id_bascula) {
      where.id_bascula = id_bascula;
    }

    // Contar total de series
    const count = await this.serialRepo.count({ where });

    // Calcular offset
    const offset = (page - 1) * limit;

    const series = await this.serialRepo.find({
      where,
      order: { created_at: 'ASC', id: 'ASC' } as any,
      skip: offset,
      take: limit,
    });

    const result = [];

    for (const serie of series) {
      const min = serie.min_serialnumber;
      const max = serie.max_serialnumber;

      // Incluir ambos extremos: 2300 a 3300 = 1001 elementos (no 1000)
      const total =
        typeof min === 'number' && typeof max === 'number'
          ? max - min + 1
          : null;

      // Comprobantes usados dentro del rango de esta serie
      const comprobantes = await this.comprobanteRepo.find({
        where: {
          noComprobante: Between(min, max),
        },
        select: ['noComprobante', 'status'],
        order: { noComprobante: 'ASC' } as any,
      });

      const usadosSet = new Set(
        comprobantes.map((c) => Number(c.noComprobante)),
      );
      const usadosCount = usadosSet.size;

      // 👇 Total de comprobantes ANULADOS en esta serie
      const anuladosCount = comprobantes.filter((c) => c.status === 1).length;

      result.push({
        serieId: serie.id,
        id_bascula: serie.id_bascula,
        numero_caja: serie.numero_caja,
        min_serialnumber: serie.min_serialnumber,
        max_serialnumber: serie.max_serialnumber,
        total,
        usados: usadosCount,
        anulados: anuladosCount,
        disponibles: total !== null ? total - usadosCount : null,
        created_at: serie.created_at,
      });
    }

    return {
      data: result,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalRecords: count,
        totalPages: Math.ceil(count / limit),
      },
      message: 'Series de comprobantes encontradas exitosamente.',
    };
  }

  /**
   * Devuelve el siguiente comprobante disponible.
   * El id_bascula es opcional y solo se devuelve en la respuesta
   * para que el front lo pueda mostrar, no afecta el cálculo.
   */
  async getNextComprobante(id_bascula?: number) {
    // 📌 Caso 1: viene id_bascula → solo esa báscula
    if (id_bascula != null) {
      const next = await this.getNextComprobanteByBascula(id_bascula);
      return {
        id_bascula,
        next_comprobante: next,
      };
    }

    // 📌 Caso 2: sin id_bascula → listado de todas las básculas con series
    // Sacamos todas las básculas que tienen series registradas
    const basculasRaw = await this.serialRepo
      .createQueryBuilder('s')
      .select('DISTINCT s.id_bascula', 'id_bascula')
      .getRawMany();

    const results = [];

    for (const row of basculasRaw) {
      const basculaId = Number(row.id_bascula);

      try {
        const next = await this.getNextComprobanteByBascula(basculaId);
        results.push({
          id_bascula: basculaId,
          next_comprobante: next,
        });
      } catch (e: any) {
        // Si esa báscula ya no tiene disponibles o algo raro,
        // la devolvemos igual con error descriptivo
        results.push({
          id_bascula: basculaId,
          next_comprobante: null,
          error: e.message ?? 'No hay comprobantes disponibles',
        });
      }
    }

    return results;
  }

  /**
   * Listado de comprobantes de báscula (Comprobante) que se han
   * asignado o anulado.
   *
   * - Si se envía id_bascula, se filtran solo los comprobantes
   *   cuyos números caen dentro de alguna serie de esa báscula.
   * - Si se envía status: 'ASIGNADO' | 'ANULADO' | '0' | '1',
   *   se filtra por ese estado.
   */
  async listComprobantesAsignadosYAnulados(
    id_bascula?: number | string,
    status?: string,
    id_comprobseries?: number | string,
    page: number | string = 1,
    limit: number | string = 10,
  ) {
    // Parsear parámetros que pueden venir como string
    const parsedIdBascula = id_bascula
      ? parseInt(String(id_bascula), 10)
      : undefined;
    const parsedIdComprobseries = id_comprobseries
      ? parseInt(String(id_comprobseries), 10)
      : undefined;
    const parsedPage = parseInt(String(page), 10) || 1;
    const parsedLimit = parseInt(String(limit), 10) || 10;

    // Normalizar status recibido por query
    let statusFilter: number | undefined = undefined;

    if (status) {
      const s = String(status).toUpperCase();
      if (s === 'ASIGNADO' || s === 'ASIGNADOS' || s === '0') {
        statusFilter = 0; // 0 = ASIGNADO
      } else if (s === 'ANULADO' || s === 'ANULADOS' || s === '1') {
        statusFilter = 1; // 1 = ANULADO
      }
    }

    let comprobantes: Comprobante[] = [];
    let count = 0;

    // 🔹 Si viene id_comprobseries, filtramos por esa serie específica
    if (parsedIdComprobseries) {
      const serie = await this.serialRepo.findOne({
        where: { id: parsedIdComprobseries },
      });

      if (!serie) {
        return {
          data: [],
          pagination: {
            currentPage: parsedPage,
            pageSize: parsedLimit,
            totalRecords: 0,
            totalPages: 0,
          },
          message: 'No se encontró la serie de comprobantes solicitada.',
        };
      }

      const whereComprobante: any = {
        noComprobante: Between(serie.min_serialnumber, serie.max_serialnumber),
      };

      if (statusFilter !== undefined) {
        whereComprobante.status = statusFilter;
      }

      count = await this.comprobanteRepo.count({
        where: whereComprobante,
      });

      const offset = (parsedPage - 1) * parsedLimit;

      comprobantes = await this.comprobanteRepo.find({
        where: whereComprobante,
        relations: ['serialComprobante'],
        order: { createdAt: 'DESC' },
        skip: offset,
        take: parsedLimit,
      });
    } else if (parsedIdBascula) {
      const series = await this.serialRepo.find({
        where: { id_bascula: parsedIdBascula },
      });

      if (!series.length) {
        return {
          data: [],
          pagination: {
            currentPage: parsedPage,
            pageSize: parsedLimit,
            totalRecords: 0,
            totalPages: 0,
          },
          message: 'No se encontraron comprobantes.',
        };
      }

      const minGlobal = Math.min(...series.map((s) => s.min_serialnumber));
      const maxGlobal = Math.max(...series.map((s) => s.max_serialnumber));

      const whereComprobante: any = {
        noComprobante: Between(minGlobal, maxGlobal),
      };

      if (statusFilter !== undefined) {
        whereComprobante.status = statusFilter;
      }

      count = await this.comprobanteRepo.count({
        where: whereComprobante,
      });

      const offset = (parsedPage - 1) * parsedLimit;

      comprobantes = await this.comprobanteRepo.find({
        where: whereComprobante,
        relations: ['serialComprobante'],
        order: { createdAt: 'DESC' },
        skip: offset,
        take: parsedLimit,
      });

      // Aseguramos que estén dentro de alguna serie exacta
      comprobantes = comprobantes.filter((c) =>
        series.some(
          (s) =>
            c.noComprobante >= s.min_serialnumber &&
            c.noComprobante <= s.max_serialnumber,
        ),
      );
    } else {
      // 🔹 Si NO viene id_bascula → traemos de todas las básculas
      const whereComprobante: any = {};
      if (statusFilter !== undefined) {
        whereComprobante.status = statusFilter;
      }

      count = await this.comprobanteRepo.count({
        where: whereComprobante,
      });

      const offset = (parsedPage - 1) * parsedLimit;

      comprobantes = await this.comprobanteRepo.find({
        where: whereComprobante,
        relations: ['serialComprobante'],
        order: { createdAt: 'DESC' },
        skip: offset,
        take: parsedLimit,
      });
    }

    if (!comprobantes.length) {
      return {
        data: [],
        pagination: {
          currentPage: parsedPage,
          pageSize: parsedLimit,
          totalRecords: count,
          totalPages: Math.ceil(count / parsedLimit),
        },
        message: 'No se encontraron comprobantes.',
      };
    }

    // Cargar Shipments relacionados para sacar code_gen, cliente y producto
    const shipmentIds = Array.from(
      new Set(comprobantes.map((c) => c.idShipment).filter((id) => id != null)),
    );

    const shipments = await this.shipmentsRepo.find({
      where: { id: In(shipmentIds) },
      relations: ['ingenio'], // para nombre del cliente
    });

    const shipmentsById = new Map<number, Shipments>();
    for (const sh of shipments) {
      shipmentsById.set(sh.id, sh);
    }

    // Mapeamos a DTO con NOMBRE de producto
    const data = comprobantes.map((c) => {
      const shipment = shipmentsById.get(c.idShipment);

      const numeroEnvio = shipment?.codeGen ?? null;
      const clienteRaw = shipment?.ingenio?.name ?? null;
      const cliente = clienteRaw ? this.formatName(clienteRaw) : null;

      const productCode = shipment?.product ?? null;
      const productNameRaw = productCode
        ? getProductNameByCode(productCode)
        : null;
      const productName = productNameRaw
        ? this.formatName(productNameRaw)
        : null;

      return {
        // base
        id: c.id,
        id_shipment: c.idShipment,
        no_comprobante: c.noComprobante,
        id_comprobseries: c.serialComprobante?.id ?? null,
        status: c.status,
        statusText: this.getStatusText(c.status),
        impreso: c.impreso,
        fecha_impresion: c.fechaImpresion,
        motivo: c.motivo,
        created_at: c.createdAt,
        cliente, // nombre del cliente
        producto: productName, // nombre del producto
      };
    });

    return {
      data,
      pagination: {
        currentPage: parsedPage,
        pageSize: parsedLimit,
        totalRecords: count,
        totalPages: Math.ceil(count / parsedLimit),
      },
      message: 'Comprobantes encontrados exitosamente.',
    };
  }

  // ---------- Seal Series ----------
  async createSealSeries(dto: CreateSealSeriesDto) {
    if (dto.min_sealnumber > dto.max_sealnumber) {
      throw new BadRequestException(
        'El número inicial no puede ser mayor que el número final del rango.',
      );
    }

    // Validar que la última serie de la báscula con los mismos códigos tenga menos de 100 disponibles
    const ultimaSerie = await this.sealSeriesRepo.findOne({
      where: {
        id_bascula: dto.id_bascula,
        ingenio_code: dto.ingenio_code,
        product_code: dto.product_code,
      },
      order: { created_at: 'DESC' } as any,
    });

    if (ultimaSerie) {
      const minCode = ultimaSerie.min_sealnumber;
      const maxCode = ultimaSerie.max_sealnumber;

      // Traer marchamos dentro del rango
      const marchamos = await this.marchamosRepo.find({
        where: {
          sealCode: Between(minCode, maxCode),
        },
        select: ['sealCode'],
      });

      // Intentar calcular disponibles (solo para rangos numéricos o con prefijo)
      let disponibles: number | null = null;

      // Caso 1: ambos son solo números ("2300" -> "3300")
      if (/^\d+$/.test(minCode) && /^\d+$/.test(maxCode)) {
        const minNum = parseInt(minCode, 10);
        const maxNum = parseInt(maxCode, 10);
        if (minNum <= maxNum) {
          const total = maxNum - minNum + 1;
          const usados = new Set(marchamos.map((m) => m.sealCode)).size;
          disponibles = total - usados;
        }
      }
      // Caso 2: ambos tienen mismo prefijo y números ("SEAL2300" -> "SEAL3300")
      else {
        const matchMin = minCode.match(/^([A-Za-z]+)(\d+)$/);
        const matchMax = maxCode.match(/^([A-Za-z]+)(\d+)$/);

        if (matchMin && matchMax && matchMin[1] === matchMax[1]) {
          const startNum = parseInt(matchMin[2], 10);
          const endNum = parseInt(matchMax[2], 10);

          if (startNum <= endNum) {
            const total = endNum - startNum + 1;
            const usados = new Set(marchamos.map((m) => m.sealCode)).size;
            disponibles = total - usados;
          }
        }
      }

      if (disponibles !== null && disponibles > 100) {
        throw new BadRequestException(
          `No se puede agregar una nueva serie. La última serie de marchamos de la báscula ${dto.id_bascula} con ingenio ${dto.ingenio_code} y producto ${dto.product_code} aún tiene ${disponibles} marchamos disponibles.`,
        );
      }
    }

    // Validar que no existan rangos solapados con series existentes
    const seriesExistentes = await this.sealSeriesRepo.find();

    for (const serie of seriesExistentes) {
      // Para rangos de marchamos (pueden ser alfanuméricos), comparamos como strings
      const hayRangoSolapado =
        (dto.min_sealnumber >= serie.min_sealnumber &&
          dto.min_sealnumber <= serie.max_sealnumber) ||
        (dto.max_sealnumber >= serie.min_sealnumber &&
          dto.max_sealnumber <= serie.max_sealnumber) ||
        (dto.min_sealnumber <= serie.min_sealnumber &&
          dto.max_sealnumber >= serie.max_sealnumber);

      if (hayRangoSolapado) {
        throw new BadRequestException(
          `No se puede crear la serie de marchamos. El rango ${dto.min_sealnumber} a ${dto.max_sealnumber} ya está en uso para la báscula ${serie.id_bascula}.`,
        );
      }
    }

    const entity = this.sealSeriesRepo.create(dto);
    return this.sealSeriesRepo.save(entity);
  }

  /**
   * Eliminar una serie de marchamos
   * Solo se permite si no hay marchamos registrados en esa serie
   */
  async deleteSealSeries(id: number) {
    // Verificar que exista la serie
    const serie = await this.sealSeriesRepo.findOne({ where: { id } });

    if (!serie) {
      throw new BadRequestException(
        `No se encontró la serie de marchamos solicitada.`,
      );
    }

    // Verificar si existen marchamos asociados a esta serie
    const marchamosEnSerie = await this.marchamosRepo.find({
      where: {
        sealSeries: { id } as any,
      },
    });

    if (marchamosEnSerie.length > 0) {
      throw new BadRequestException(
        `No se puede eliminar esta serie porque tiene ${marchamosEnSerie.length} marchamo${marchamosEnSerie.length > 1 ? 's' : ''} registrado${marchamosEnSerie.length > 1 ? 's' : ''}.`,
      );
    }

    // Si no hay marchamos, eliminar la serie
    await this.sealSeriesRepo.remove(serie);

    return {
      message: `Serie de marchamos ${id} eliminada exitosamente.`,
      id,
      rango: `${serie.min_sealnumber}-${serie.max_sealnumber}`,
      bascula: serie.id_bascula,
      ingenio: serie.ingenio_code,
      producto: serie.product_code,
    };
  }

  /**
   * Actualiza una serie de marchamos existente
   * PATCH /weighbridge/marchamo/series/:id
   */
  async updateSealSeries(id: number, dto: UpdateSealSeriesDto) {
    // 1) Verificar que la serie exista
    const serie = await this.sealSeriesRepo.findOne({ where: { id } });

    if (!serie) {
      throw new BadRequestException(
        `No se encontró la serie de marchamos con id ${id}.`,
      );
    }

    // 2) Determinar los nuevos valores
    const newMin = dto.min_sealnumber ?? serie.min_sealnumber;
    const newMax = dto.max_sealnumber ?? serie.max_sealnumber;

    // 3) Validar formato según sea numérico o alfanumérico
    let minNum: number | null = null;
    let maxNum: number | null = null;
    let prefix: string | null = null;

    // Caso 1: Solo números
    if (/^\d+$/.test(newMin) && /^\d+$/.test(newMax)) {
      minNum = parseInt(newMin, 10);
      maxNum = parseInt(newMax, 10);

      if (minNum > maxNum) {
        throw new BadRequestException(
          `El número inicial (${minNum}) no puede ser mayor que el número final (${maxNum}).`,
        );
      }
    }
    // Caso 2: Prefijo + números
    else {
      const matchMin = newMin.match(/^([A-Za-z]+)(\d+)$/);
      const matchMax = newMax.match(/^([A-Za-z]+)(\d+)$/);

      if (!matchMin || !matchMax) {
        throw new BadRequestException(
          `El formato de los códigos debe ser consistente (solo números o prefijo+números).`,
        );
      }

      if (matchMin[1] !== matchMax[1]) {
        throw new BadRequestException(
          `Los prefijos deben ser iguales: "${matchMin[1]}" vs "${matchMax[1]}".`,
        );
      }

      prefix = matchMin[1];
      minNum = parseInt(matchMin[2], 10);
      maxNum = parseInt(matchMax[2], 10);

      if (minNum > maxNum) {
        throw new BadRequestException(
          `El número inicial (${minNum}) no puede ser mayor que el número final (${maxNum}).`,
        );
      }
    }

    // 4) Buscar marchamos ya asignados en esta serie
    const marchamosUsados = await this.marchamosRepo.find({
      where: {
        sealCode: Between(serie.min_sealnumber, serie.max_sealnumber),
      },
      select: ['sealCode'],
    });

    // 5) Si hay marchamos usados, validar restricciones
    if (marchamosUsados.length > 0) {
      // 5a) No permitir cambiar ingenio_code o product_code si hay marchamos usados
      if (
        dto.ingenio_code !== undefined &&
        dto.ingenio_code !== serie.ingenio_code
      ) {
        throw new BadRequestException(
          `No se puede cambiar el código de ingenio porque la serie tiene ${marchamosUsados.length} marchamo${marchamosUsados.length > 1 ? 's' : ''} registrado${marchamosUsados.length > 1 ? 's' : ''}.`,
        );
      }
      if (
        dto.product_code !== undefined &&
        dto.product_code !== serie.product_code
      ) {
        throw new BadRequestException(
          `No se puede cambiar el código de producto porque la serie tiene ${marchamosUsados.length} marchamo${marchamosUsados.length > 1 ? 's' : ''} registrado${marchamosUsados.length > 1 ? 's' : ''}.`,
        );
      }

      // 5b) Si se cambia el rango, validar que todos los marchamos usados estén dentro del nuevo rango
      const codigosUsados = marchamosUsados.map((m) => m.sealCode);

      for (const codigo of codigosUsados) {
        // Comparar según el formato
        if (prefix) {
          // Formato: SEAL2300
          const match = codigo.match(/^([A-Za-z]+)(\d+)$/);
          if (!match || match[1] !== prefix) {
            throw new BadRequestException(
              `El código usado "${codigo}" no es compatible con el nuevo formato.`,
            );
          }
          const num = parseInt(match[2], 10);
          if (num < minNum! || num > maxNum!) {
            throw new BadRequestException(
              `No se puede cambiar el rango porque el marchamo "${codigo}" está fuera del nuevo rango (${newMin} - ${newMax}).`,
            );
          }
        } else {
          // Formato: solo números
          const num = parseInt(codigo, 10);
          if (isNaN(num) || num < minNum! || num > maxNum!) {
            throw new BadRequestException(
              `No se puede cambiar el rango porque el marchamo "${codigo}" está fuera del nuevo rango (${newMin} - ${newMax}).`,
            );
          }
        }
      }
    }

    // 6) Validar que el nuevo rango no se solape con otras series de la misma báscula + ingenio + producto
    if (
      dto.min_sealnumber !== undefined ||
      dto.max_sealnumber !== undefined ||
      dto.ingenio_code !== undefined ||
      dto.product_code !== undefined
    ) {
      // Usar los nuevos valores o los actuales
      const newIngenioCode = dto.ingenio_code ?? serie.ingenio_code;
      const newProductCode = dto.product_code ?? serie.product_code;

      // Buscar series con los mismos parámetros (excluyendo la actual)
      const seriesSimilares = await this.sealSeriesRepo.find({
        where: {
          id_bascula: serie.id_bascula,
          ingenio_code: newIngenioCode,
          product_code: newProductCode,
        },
      });

      for (const otraSerie of seriesSimilares) {
        if (otraSerie.id === id) continue; // Saltar la serie actual

        // Verificar solapamiento
        const solapamiento = this.checkRangeOverlap(
          newMin,
          newMax,
          otraSerie.min_sealnumber,
          otraSerie.max_sealnumber,
        );

        if (solapamiento) {
          throw new BadRequestException(
            `El nuevo rango (${newMin}-${newMax}) se solapa con la serie ${otraSerie.id}: ${otraSerie.min_sealnumber}-${otraSerie.max_sealnumber}`,
          );
        }
      }
    }

    // 7) Aplicar los cambios
    if (dto.min_sealnumber !== undefined) {
      serie.min_sealnumber = dto.min_sealnumber;
    }
    if (dto.max_sealnumber !== undefined) {
      serie.max_sealnumber = dto.max_sealnumber;
    }
    if (dto.ingenio_code !== undefined) {
      serie.ingenio_code = dto.ingenio_code;
    }
    if (dto.product_code !== undefined) {
      serie.product_code = dto.product_code;
    }

    // 8) Guardar cambios
    await this.sealSeriesRepo.save(serie);

    return {
      message: 'Serie de marchamos actualizada exitosamente.',
      serie: {
        id: serie.id,
        id_bascula: serie.id_bascula,
        min_sealnumber: serie.min_sealnumber,
        max_sealnumber: serie.max_sealnumber,
        ingenio_code: serie.ingenio_code,
        product_code: serie.product_code,
        created_at: serie.created_at,
      },
    };
  }

  /**
   * Verifica si dos rangos alfanuméricos se solapan
   */
  private checkRangeOverlap(
    min1: string,
    max1: string,
    min2: string,
    max2: string,
  ): boolean {
    // Caso 1: Solo números
    if (
      /^\d+$/.test(min1) &&
      /^\d+$/.test(max1) &&
      /^\d+$/.test(min2) &&
      /^\d+$/.test(max2)
    ) {
      const minNum1 = parseInt(min1, 10);
      const maxNum1 = parseInt(max1, 10);
      const minNum2 = parseInt(min2, 10);
      const maxNum2 = parseInt(max2, 10);

      return minNum1 <= maxNum2 && maxNum1 >= minNum2;
    }

    // Caso 2: Prefijo + números
    const match1Min = min1.match(/^([A-Za-z]+)(\d+)$/);
    const match1Max = max1.match(/^([A-Za-z]+)(\d+)$/);
    const match2Min = min2.match(/^([A-Za-z]+)(\d+)$/);
    const match2Max = max2.match(/^([A-Za-z]+)(\d+)$/);

    if (match1Min && match1Max && match2Min && match2Max) {
      // Si tienen diferentes prefijos, no se solapan
      if (match1Min[1] !== match2Min[1]) {
        return false;
      }

      const minNum1 = parseInt(match1Min[2], 10);
      const maxNum1 = parseInt(match1Max[2], 10);
      const minNum2 = parseInt(match2Min[2], 10);
      const maxNum2 = parseInt(match2Max[2], 10);

      return minNum1 <= maxNum2 && maxNum1 >= minNum2;
    }

    // Si no podemos determinar, asumimos que no se solapan (safe)
    return false;
  }

  async listSeriesPorBascula(id_bascula: number) {
    return this.sealSeriesRepo.find({ where: { id_bascula } });
  }

  /**
   * Listado de correlativos de marchamos (series) con resumen:
   * - total (según rango)
   * - usados
   * - anulados
   * - disponibles
   * - siguiente marchamo sugerido
   *
   * Soporta rangos:
   *   - solo numéricos:  "2300"  → "3300"
   *   - alfanuméricos:   "A0001" → "A0500"
   */
  async listSealSeriesResumen(
    id_bascula?: number,
    ingenio_code?: string,
    product_code?: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const where: any = {};
    if (id_bascula) where.id_bascula = id_bascula;
    if (ingenio_code) where.ingenio_code = ingenio_code;
    if (product_code) where.product_code = product_code;

    // Contar total de series
    const count = await this.sealSeriesRepo.count({ where });

    // Calcular offset
    const offset = (page - 1) * limit;

    const series = await this.sealSeriesRepo.find({
      where,
      order: { created_at: 'DESC' },
      skip: offset,
      take: limit,
    });

    // Obtener todos los códigos únicos de ingenio para cargar clientes
    const ingenioCodes = Array.from(
      new Set(series.map((s) => s.ingenio_code).filter(Boolean)),
    );

    // Cargar clientes por los códigos de ingenio
    const clients = await this.clientsRepo.find({
      where: ingenioCodes.length > 0 ? { ingenioCode: In(ingenioCodes) } : {},
    });

    // Crear mapa para acceso rápido por código de ingenio
    const clientsByCode = new Map<string, Clients>();
    for (const client of clients) {
      clientsByCode.set(client.ingenioCode, client);
    }

    const result = [];

    // Helper para extraer prefijo y parte numérica de códigos como "A0001"
    const parseAlphaNumeric = (code: string) => {
      const match = code.match(/^([A-Za-z]+)?(\d+)$/);
      if (!match) return null;

      const prefix = match[1] ?? '';
      const numStr = match[2];
      const num = parseInt(numStr, 10);

      if (isNaN(num)) return null;

      return {
        prefix,
        num,
        digits: numStr.length,
      };
    };

    for (const serie of series) {
      const minCode = serie.min_sealnumber;
      const maxCode = serie.max_sealnumber;

      // 1) Traer marchamos dentro del rango (cualquier estado)
      const marchamos = await this.marchamosRepo.find({
        where: {
          sealCode: Between(minCode, maxCode),
        },
        select: ['sealCode', 'status'],
      });

      const usadosSet = new Set(marchamos.map((m) => m.sealCode));
      const usadosCount = usadosSet.size;

      const anuladosCount = marchamos.filter((m) => m.status === 1).length;

      // 2) Intentar entender el rango para calcular total
      let total: number | null = null;

      let startNum: number | null = null;
      let endNum: number | null = null;

      // Caso 1: ambos son solo números ("2300" -> "3300")
      if (/^\d+$/.test(minCode) && /^\d+$/.test(maxCode)) {
        const minNum = parseInt(minCode, 10);
        const maxNum = parseInt(maxCode, 10);

        if (!isNaN(minNum) && !isNaN(maxNum)) {
          startNum = minNum;
          endNum = maxNum;
        }
      } else {
        // Caso 2: ambos son prefijo + número ("A0001" -> "A0500")
        const minInfo = parseAlphaNumeric(minCode);
        const maxInfo = parseAlphaNumeric(maxCode);

        if (minInfo && maxInfo && minInfo.prefix === maxInfo.prefix) {
          startNum = minInfo.num;
          endNum = maxInfo.num;
        }
      }

      // Si pudimos interpretar el rango, calculamos total
      if (startNum !== null && endNum !== null) {
        // Incluir ambos extremos: 92001 a 92102 = 102 elementos (no 101)
        total = endNum - startNum + 1;
      }

      // Obtener el nombre del cliente y del producto
      const cliente = clientsByCode.get(serie.ingenio_code);
      const clienteNombreRaw = cliente?.name ?? null;
      const clienteNombre = clienteNombreRaw
        ? this.formatName(clienteNombreRaw)
        : null;
      const productoNombreRaw = serie.product_code
        ? getProductNameByCode(serie.product_code)
        : null;
      const productoNombre = productoNombreRaw
        ? this.formatName(productoNombreRaw)
        : null;

      result.push({
        id: serie.id,
        id_bascula: serie.id_bascula,
        ingenio_code: serie.ingenio_code,
        cliente: clienteNombre,
        product_code: serie.product_code,
        producto: productoNombre,
        min_sealnumber: serie.min_sealnumber,
        max_sealnumber: serie.max_sealnumber,
        total,
        usados: usadosCount,
        anulados: anuladosCount,
        disponibles: total !== null ? total - usadosCount : null,
        created_at: serie.created_at,
      });
    }

    return {
      data: result,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalRecords: count,
        totalPages: Math.ceil(count / limit),
      },
      message: 'Series de marchamos encontradas exitosamente.',
    };
  }

  // ---------- Marchamos ----------
  async createMarchamo(dto: CreateMarchamoDto) {
    const { idShipment, idBascula, sealCodes } = dto;

    // 0) Validar que no haya códigos duplicados en el input
    const codigosUnicos = new Set(sealCodes);
    if (codigosUnicos.size !== sealCodes.length) {
      throw new BadRequestException(
        `No se permiten códigos de marchamo duplicados.`,
      );
    }

    // 1) Validar que exista el shipment con sus relaciones
    const shipment = await this.shipmentsRepo.findOne({
      where: { id: idShipment },
      relations: ['ingenio'],
    });

    if (!shipment) {
      throw new BadRequestException(`No se encontró el envío solicitado.`);
    }

    // 2) Verificar si el shipment ya tiene marchamos activos (no anulados)
    const marchamosExistentesActivos = await this.marchamosRepo.find({
      where: {
        shipment: { id: idShipment } as any,
        status: 0, // 0 = ASIGNADO
      },
      relations: ['sealSeries'],
    });

    // Si ya tiene marchamos activos
    if (marchamosExistentesActivos.length > 0) {
      const sealCodesExistentes = marchamosExistentesActivos
        .map((m) => m.sealCode)
        .sort();
      const sealCodesNuevos = [...sealCodes].sort();

      // Comparar si son exactamente los mismos códigos
      const sonIguales =
        sealCodesExistentes.length === sealCodesNuevos.length &&
        sealCodesExistentes.every(
          (code, index) => code === sealCodesNuevos[index],
        );

      // Si son los mismos códigos, retornar success
      if (sonIguales) {
        return {
          idShipment,
          idBascula,
          sealCodes: sealCodesExistentes,
          marchamos: marchamosExistentesActivos.map((m) => ({
            id: m.id,
            seal_code: m.sealCode,
            status: m.status,
            statusText: this.getStatusText(m.status),
            id_sealseries: m.sealSeries?.id ?? null,
          })),
          message: 'El envío ya tiene estos marchamos asignados.',
        };
      }

      // Si son diferentes, lanzar error indicando que debe anular primero
      throw new BadRequestException(
        `El envío ya tiene ${marchamosExistentesActivos.length} marchamo(s) asignado(s): [${sealCodesExistentes.join(', ')}]. Debe anularlos antes de asignar nuevos marchamos.`,
      );
    }

    // 3) Verificar que los códigos no estén ya en uso
    const marchamosExistentes = await this.marchamosRepo.find({
      where: {
        sealCode: In(sealCodes),
      },
    });

    if (marchamosExistentes.length > 0) {
      const codigosEnUso = marchamosExistentes
        .map((m) => m.sealCode)
        .join(', ');
      throw new BadRequestException(
        `Los siguientes códigos ya están en uso: ${codigosEnUso}`,
      );
    }

    // 4) Obtener el ingenio_code y product del shipment
    const ingenioCode = shipment.ingenio?.ingenioCode;
    const ingenioNameRaw = shipment.ingenio?.name;
    const ingenioName = this.formatName(ingenioNameRaw);
    const productCode = shipment.product;
    const productNameRaw = getProductNameByCode(productCode);
    const productName = this.formatName(productNameRaw);

    if (!ingenioCode) {
      throw new BadRequestException(
        `El envío ${idShipment} no tiene un ingenio asignado.`,
      );
    }

    if (!productCode) {
      throw new BadRequestException(
        `El envío ${idShipment} no tiene un producto asignado.`,
      );
    }

    // 5) Buscar la serie compatible para cada código
    const aCrear: Marchamos[] = [];
    const codigosNoEncontrados: string[] = [];
    const codigosIngenioIncompatible: Array<{
      code: string;
      serieIngenio: string;
    }> = [];
    const codigosProductoIncompatible: Array<{
      code: string;
      serieProducto: string;
    }> = [];

    for (const code of sealCodes) {
      // Buscar una serie que contenga este código, sea de la báscula correcta,
      // y tenga el mismo ingenio_code y product_code
      const serie = await this.sealSeriesRepo
        .createQueryBuilder('series')
        .where('series.id_bascula = :idBascula', { idBascula })
        .andWhere(
          ':code BETWEEN series.min_sealnumber AND series.max_sealnumber',
          { code },
        )
        .getOne();

      if (!serie) {
        codigosNoEncontrados.push(code);
      } else if (serie.ingenio_code !== ingenioCode) {
        // El marchamo no pertenece al ingenio del envío
        codigosIngenioIncompatible.push({
          code,
          serieIngenio: serie.ingenio_code,
        });
      } else if (serie.product_code !== productCode) {
        // El marchamo no pertenece al producto del envío
        codigosProductoIncompatible.push({
          code,
          serieProducto: serie.product_code,
        });
      } else {
        const entity = this.marchamosRepo.create({
          sealCode: code,
          status: 0, // 0 = ASIGNADO
          shipment: { id: idShipment } as any,
          sealSeries: { id: serie.id } as any,
        });
        aCrear.push(entity);
      }
    }

    // 6) Si hay códigos incompatibles por ingenio, lanzar error
    if (codigosIngenioIncompatible.length > 0) {
      // Obtener el ingenio al que pertenecen los marchamos
      const ingeniosUnicos = [
        ...new Set(codigosIngenioIncompatible.map((x) => x.serieIngenio)),
      ];

      // Si todos pertenecen al mismo ingenio, buscar su nombre
      if (ingeniosUnicos.length === 1) {
        const clienteReal = await this.clientsRepo.findOne({
          where: { ingenioCode: ingeniosUnicos[0] },
        });
        const nombreClienteReal =
          this.formatName(clienteReal?.name) || ingeniosUnicos[0];

        throw new BadRequestException(
          `Los marchamos [${codigosIngenioIncompatible.map((x) => x.code).join(', ')}] pertenecen al cliente ${nombreClienteReal}.`,
        );
      } else {
        throw new BadRequestException(
          `Los marchamos [${codigosIngenioIncompatible.map((x) => x.code).join(', ')}] pertenecen a diferentes clientes.`,
        );
      }
    }

    // 7) Si hay códigos incompatibles por producto, lanzar error
    if (codigosProductoIncompatible.length > 0) {
      // Obtener el producto al que pertenecen y el cliente
      const productosUnicos = [
        ...new Set(codigosProductoIncompatible.map((x) => x.serieProducto)),
      ];

      if (productosUnicos.length === 1) {
        const nombreProductoRealRaw = getProductNameByCode(productosUnicos[0]);
        const nombreProductoReal = this.formatName(nombreProductoRealRaw);

        throw new BadRequestException(
          `Los marchamos [${codigosProductoIncompatible.map((x) => x.code).join(', ')}] pertenecen al producto ${nombreProductoReal} para el cliente ${ingenioName}.`,
        );
      } else {
        throw new BadRequestException(
          `Los marchamos [${codigosProductoIncompatible.map((x) => x.code).join(', ')}] pertenecen a diferentes productos.`,
        );
      }
    }

    // 7) Si hay códigos que no pertenecen a ninguna serie, lanzar error
    if (codigosNoEncontrados.length > 0) {
      throw new BadRequestException(
        `Los siguientes códigos no pertenecen a ninguna serie configurada para la báscula ${idBascula}: ${codigosNoEncontrados.join(', ')}`,
      );
    }

    // 6) Guardar todos los marchamos
    const saved = await this.marchamosRepo.save(aCrear);

    // 7) Verificar stock de cada serie única involucrada
    const seriesChecked = new Set<number>();
    for (const marchamo of saved) {
      const serieId = marchamo.sealSeries?.id;
      if (!serieId || seriesChecked.has(serieId)) continue;
      seriesChecked.add(serieId);

      // Obtener la serie completa
      const serie = await this.sealSeriesRepo.findOne({
        where: { id: serieId },
      });
      if (!serie) continue;

      const minCode = serie.min_sealnumber;
      const maxCode = serie.max_sealnumber;

      // Obtener todos los marchamos en el rango de esta serie
      const marchamos = await this.marchamosRepo.find({
        where: { sealCode: Between(minCode, maxCode) },
        select: ['sealCode'],
      });

      let disponibles: number | null = null;

      // Caso 1: ambos son solo números ("2300" -> "3300")
      if (/^\d+$/.test(minCode) && /^\d+$/.test(maxCode)) {
        const minNum = parseInt(minCode, 10);
        const maxNum = parseInt(maxCode, 10);
        if (minNum <= maxNum) {
          const total = maxNum - minNum + 1;
          const usados = new Set(marchamos.map((m) => m.sealCode)).size;
          disponibles = total - usados;
        }
      }
      // Caso 2: prefijo + números ("SEAL2300" -> "SEAL3300")
      else {
        const matchMin = minCode.match(/^([A-Za-z]+)(\d+)$/);
        const matchMax = maxCode.match(/^([A-Za-z]+)(\d+)$/);

        if (matchMin && matchMax && matchMin[1] === matchMax[1]) {
          const startNum = parseInt(matchMin[2], 10);
          const endNum = parseInt(matchMax[2], 10);

          if (startNum <= endNum) {
            const total = endNum - startNum + 1;
            const usados = new Set(marchamos.map((m) => m.sealCode)).size;
            disponibles = total - usados;
          }
        }
      }

      // Si quedan exactamente en el umbral mínimo, enviar notificación
      const stockMinimo = await this.configService.getNumber(
        'stock_minimo_marchamos',
        100,
      );
      if (disponibles === stockMinimo) {
        const total =
          disponibles + new Set(marchamos.map((m) => m.sealCode)).size;
        // Enviar notificación de forma asíncrona sin bloquear la respuesta
        this.sendLowStockAlert('marchamo', {
          idBascula: serie.id_bascula,
          serieId: serie.id,
          rango: `${minCode} - ${maxCode}`,
          disponibles,
          total,
          stockMinimo,
        }).catch((err) => {
          console.error(
            '[createMarchamo] Error al enviar notificación de stock bajo:',
            err,
          );
        });
      }
    }

    return {
      idShipment,
      idBascula,
      sealCodes,
      marchamos: saved.map((m) => ({
        id: m.id,
        seal_code: m.sealCode,
        status: m.status,
        statusText: this.getStatusText(m.status),
        id_sealseries: m.sealSeries?.id ?? null,
      })),
      message: `Se asignaron ${sealCodes.length} marchamos exitosamente.`,
    };
  }

  async listMarchamosPorShipment(
    idShipment?: number,
    idSealSeries?: number,
    page: number = 1,
    limit: number = 10,
  ) {
    const where: any = {};
    if (idShipment) {
      // filtro por envío si lo mandan
      where.shipment = { id: idShipment } as any;
    }
    if (idSealSeries) {
      // filtro por serie de marchamos
      where.sealSeries = { id: idSealSeries } as any;
    }

    // Contar total de marchamos
    const count = await this.marchamosRepo.count({
      where,
      relations: ['shipment'],
    });

    // Calcular offset
    const offset = (page - 1) * limit;

    const marchamos = await this.marchamosRepo.find({
      where,
      relations: ['shipment', 'sealSeries'],
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    const data = marchamos.map((m) => ({
      id: m.id,
      seal_code: m.sealCode,
      status: m.status,
      statusText: this.getStatusText(m.status),
      motivo: m.motivo,
      shipment_id: m.shipment?.id ?? null,
      shipment_code_gen: m.shipment?.codeGen ?? null,
      id_sealseries: m.sealSeries?.id ?? null,
      created_at: m.createdAt,
    }));

    return {
      data,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalRecords: count,
        totalPages: Math.ceil(count / limit),
      },
      message: 'Marchamos encontrados exitosamente.',
    };
  }

  /**
   * Envía notificación por correo cuando se anula un comprobante o marchamo
   * Busca usuarios con rol 6 (Auditor) o código A0001
   */
  private async sendCancellationNotification(
    type: 'comprobante' | 'seal',
    data: any,
  ): Promise<void> {
    try {
      const templateName =
        type === 'comprobante' ? 'comprobante-cancelled' : 'seal-cancelled';
      const subject =
        type === 'comprobante'
          ? `Comprobante Anulado - ${data.noComprobante}`
          : `Marchamo${data.multiple ? 's' : ''} Anulado${data.multiple ? 's' : ''} - ${data.sealCode || data.idShipment}`;

      await this.emailService.sendNotification({
        templateName,
        mixedTargets: {
          allUsersInRoles: [6],
          specificCodes: ['A0001'],
        },
        subject,
        templateData: data,
        priority: 'high',
      });
    } catch (error) {
      // No fallar la operación si falla el envío de email
    }
  }

  /**
   * Envía notificación por correo cuando el stock de una serie llega exactamente a 100
   * Notifica a usuarios con rol 6 (Auditor) o código A0001
   */
  private async sendLowStockAlert(
    type: 'comprobante' | 'marchamo',
    data: any,
  ): Promise<void> {
    try {
      const subject = `Alerta de inventario minimo - ${type === 'comprobante' ? 'Comprobantes' : 'Marchamos'} Báscula ${data.idBascula}`;

      await this.emailService.sendNotification({
        templateName: 'low-stock-alert',
        mixedTargets: {
          allUsersInRoles: [6],
          specificCodes: ['A0001'],
        },
        subject,
        templateData: {
          ...data,
          tipo: type === 'comprobante' ? 'comprobantes' : 'marchamos',
        },
        priority: 'high',
      });
    } catch (error) {
      // No fallar la operación si falla el envío de email
    }
  }

  /**
   * Anula un marchamo individual.
   * Si el marchamo no existe, lo crea como anulado.
   * Para crear el marchamo anulado, requiere id_sealseries o id_shipment.
   * No permite anular si el shipment tiene currentStatus = 12 y el marchamo está ASIGNADO (status = 0).
   */
  async anularMarchamoPorCodigo(dto: AnularMarchamoDto) {
    const { seal_code, motivo, id_sealseries, id_shipment } = dto;

    // Buscar el marchamo existente
    const marchamo = await this.marchamosRepo.findOne({
      where: { sealCode: seal_code },
      relations: ['sealSeries', 'shipment'],
    });

    // Caso 1: El marchamo existe
    if (marchamo) {
      if (marchamo.status === 1) {
        throw new BadRequestException(
          `El marchamo ${seal_code} ya fue anulado anteriormente.`,
        );
      }

      // Verificar si el shipment tiene currentStatus = 12 y el marchamo está ASIGNADO (status = 0)
      if (marchamo.shipment && marchamo.status === 0) {
        const shipment = await this.shipmentsRepo.findOne({
          where: { id: marchamo.shipment.id },
          select: ['id', 'currentStatus'],
        });

        if (shipment && shipment.currentStatus === 12) {
          throw new BadRequestException(
            `No se puede anular el marchamo porque el envío ya finalizó.`,
          );
        }
      }

      marchamo.status = 1; // 1 = ANULADO
      if (motivo) {
        marchamo.motivo = motivo;
      }
      const saved = await this.marchamosRepo.save(marchamo);

      // Enviar notificación por correo
      await this.sendCancellationNotification('seal', {
        sealCode: saved.sealCode,
        idShipment: saved.shipment?.id,
        codeGen: saved.shipment?.codeGen,
        motivo: saved.motivo,
        multiple: false,
      });

      return {
        id: saved.id,
        seal_code: saved.sealCode,
        status: saved.status,
        statusText: this.getStatusText(saved.status),
        motivo: saved.motivo,
        id_sealseries: saved.sealSeries?.id ?? null,
        created: false,
      };
    }

    // Caso 2: El marchamo NO existe - crear como anulado
    let serieId: number | null = null;
    let shipmentId: number | null = null;

    // Opción A: id_sealseries proporcionado directamente
    if (id_sealseries) {
      const serie = await this.sealSeriesRepo.findOne({
        where: { id: id_sealseries },
      });

      if (!serie) {
        throw new BadRequestException(
          `No se encontró la serie de marchamos con ID ${id_sealseries}.`,
        );
      }

      // Verificar que el código esté dentro del rango de la serie
      const isNumeric = /^\d+$/.test(seal_code);
      const serieMin = serie.min_sealnumber;
      const serieMax = serie.max_sealnumber;

      if (isNumeric && /^\d+$/.test(serieMin) && /^\d+$/.test(serieMax)) {
        const code = parseInt(seal_code, 10);
        const min = parseInt(serieMin, 10);
        const max = parseInt(serieMax, 10);

        if (code < min || code > max) {
          throw new BadRequestException(
            `El código de marchamo ${seal_code} no pertenece al rango de la serie ${serieMin}-${serieMax}.`,
          );
        }
      }

      serieId = id_sealseries;
    }
    // Opción B: id_shipment proporcionado - buscar la serie automáticamente
    else if (id_shipment) {
      const shipment = await this.shipmentsRepo.findOne({
        where: { id: id_shipment },
        relations: ['ingenio'],
      });

      if (!shipment) {
        throw new BadRequestException(
          `No se encontró el envío con ID ${id_shipment}.`,
        );
      }

      const ingenioCode = shipment.ingenio?.ingenioCode;
      const productCode = shipment.product;

      if (!ingenioCode || !productCode) {
        throw new BadRequestException(
          `El envío ${id_shipment} no tiene ingenio o producto asignado.`,
        );
      }

      // Buscar la serie que contiene este código
      const serie = await this.sealSeriesRepo
        .createQueryBuilder('series')
        .where(
          ':code BETWEEN series.min_sealnumber AND series.max_sealnumber',
          { code: seal_code },
        )
        .andWhere('series.ingenio_code = :ingenioCode', { ingenioCode })
        .andWhere('series.product_code = :productCode', { productCode })
        .getOne();

      if (!serie) {
        throw new BadRequestException(
          `No se encontró una serie de marchamos que contenga el código ${seal_code} para el ingenio ${ingenioCode} y producto ${productCode}.`,
        );
      }

      serieId = serie.id;
      shipmentId = id_shipment;
    }
    // Sin id_sealseries ni id_shipment
    else {
      throw new BadRequestException(
        `El marchamo ${seal_code} no existe. Para crearlo como anulado, debe proporcionar 'id_sealseries' o 'id_shipment'.`,
      );
    }

    // Crear el marchamo como anulado
    const newMarchamo = this.marchamosRepo.create({
      sealCode: seal_code,
      status: 1, // 1 = ANULADO
      motivo: motivo || 'Anulado desde creación',
      sealSeries: { id: serieId } as any,
      shipment: shipmentId ? ({ id: shipmentId } as any) : null,
    });

    const saved = await this.marchamosRepo.save(newMarchamo);

    // Enviar notificación por correo
    await this.sendCancellationNotification('seal', {
      sealCode: saved.sealCode,
      idShipment: shipmentId,
      motivo: saved.motivo,
      multiple: false,
    });

    return {
      id: saved.id,
      seal_code: saved.sealCode,
      status: saved.status,
      statusText: this.getStatusText(saved.status),
      motivo: saved.motivo,
      id_sealseries: serieId,
      created: true,
      message: 'Marchamo creado como anulado exitosamente.',
    };
  }

  /**
   * Anula todos los marchamos activos de un shipment.
   * Cambia el status a 1 (ANULADO) para todos los marchamos del envío.
   * No permite anular si el shipment tiene currentStatus = 12.
   */
  async anularMarchamosPorShipment(id_shipment: number, motivo?: string) {
    // Verificar que el shipment exista
    const shipment = await this.shipmentsRepo.findOne({
      where: { id: id_shipment },
    });

    if (!shipment) {
      throw new BadRequestException(`No se encontró el envío solicitado.`);
    }

    // Verificar si el shipment tiene currentStatus = 12
    if (shipment.currentStatus === 12) {
      throw new BadRequestException(
        `No se pueden anular los marchamos porque el envío ya finalizó.`,
      );
    }

    // Buscar todos los marchamos activos del shipment
    const marchamos = await this.marchamosRepo.find({
      where: {
        shipment: { id: id_shipment } as any,
      },
      relations: ['shipment', 'sealSeries'],
    });

    if (!marchamos.length) {
      throw new BadRequestException(
        `No se encontraron marchamos para este envío.`,
      );
    }

    // Filtrar solo los que no están anulados
    const marchamosActivos = marchamos.filter((m) => m.status !== 1);

    if (!marchamosActivos.length) {
      throw new BadRequestException(
        `Todos los marchamos de este envío ya fueron anulados anteriormente.`,
      );
    }

    // Anular todos los marchamos activos
    for (const marchamo of marchamosActivos) {
      marchamo.status = 1; // 1 = ANULADO
      if (motivo) {
        marchamo.motivo = motivo;
      }
    }

    await this.marchamosRepo.save(marchamosActivos);

    // Enviar notificación por correo
    const sealCodesStr = marchamosActivos.map((m) => m.sealCode).join(', ');
    await this.sendCancellationNotification('seal', {
      idShipment: id_shipment,
      codeGen: shipment.codeGen,
      count: marchamosActivos.length,
      sealCodes: sealCodesStr,
      motivo,
      multiple: true,
    });

    return {
      id_shipment,
      anulados: marchamosActivos.length,
      marchamos: marchamosActivos.map((m) => ({
        id: m.id,
        seal_code: m.sealCode,
        status: m.status,
        statusText: this.getStatusText(m.status),
        motivo: m.motivo,
        id_sealseries: m.sealSeries?.id ?? null,
      })),
    };
  }

  /**
   * Obtiene el siguiente comprobante disponible a nivel global,
   * recorriendo todas las series en orden y tomando en cuenta
   * TODOS los comprobantes ya registrados (cualquier status).
   */
  private async getNextComprobanteGlobal(): Promise<number> {
    const series = await this.serialRepo.find();

    if (!series.length) {
      throw new BadRequestException(
        'No hay series de comprobantes registradas.',
      );
    }

    const minGlobal = Math.min(
      ...series.map((s) => Number(s.min_serialnumber)),
    );
    const maxGlobal = Math.max(
      ...series.map((s) => Number(s.max_serialnumber)),
    );

    const usados = await this.comprobanteRepo.find({
      where: { noComprobante: Between(minGlobal, maxGlobal) },
      select: ['noComprobante'],
      order: { noComprobante: 'ASC' } as any,
    });

    const usadosSet = new Set<number>(
      usados.map((c) => Number(c.noComprobante)),
    );

    const seriesOrdenadas = [...series].sort(
      (a, b) => Number(a.min_serialnumber) - Number(b.min_serialnumber),
    );

    for (const s of seriesOrdenadas) {
      const min = Number(s.min_serialnumber);
      const max = Number(s.max_serialnumber);

      for (let n = min; n <= max; n++) {
        if (!usadosSet.has(n)) {
          return n;
        }
      }
    }

    throw new BadRequestException('No hay comprobantes disponibles.');
  }

  private async getNextComprobanteByBascula(
    id_bascula: number,
  ): Promise<number> {
    // Todas las series de ESA báscula ordenadas por fecha de creación (más antigua primero)
    const series = await this.serialRepo.find({
      where: { id_bascula },
      order: { created_at: 'ASC' } as any,
    });

    if (!series.length) {
      throw new BadRequestException(
        `No hay series de comprobantes registradas para la báscula ${id_bascula}.`,
      );
    }

    // Aseguramos que min/max sean numéricos
    const minGlobal = Math.min(
      ...series.map((s) => Number(s.min_serialnumber)),
    );
    const maxGlobal = Math.max(
      ...series.map((s) => Number(s.max_serialnumber)),
    );

    // Comprobantes usados dentro de TODOS los rangos de esa báscula
    const usados = await this.comprobanteRepo.find({
      where: {
        noComprobante: Between(minGlobal, maxGlobal),
      },
      select: ['noComprobante'],
      order: { noComprobante: 'ASC' } as any,
    });

    const usadosSet = new Set<number>(
      usados.map((c) => Number(c.noComprobante)),
    );

    // Recorremos series ordenadas por fecha de creación (más antigua primero)
    // para usar primero las series que se registraron anteriormente
    for (const s of series) {
      const min = Number(s.min_serialnumber);
      const max = Number(s.max_serialnumber);

      for (let n = min; n <= max; n++) {
        if (!usadosSet.has(n)) {
          return n; // primer hueco libre de la serie más antigua
        }
      }
    }

    throw new BadRequestException(
      `No hay comprobantes disponibles para la báscula ${id_bascula}.`,
    );
  }

  /**
   * Asigna un comprobante de báscula a un shipment (por báscula).
   * - Valida que el envío exista.
   * - Valida que el número pertenezca a una serie de ESA báscula.
   * - Valida que no se haya usado antes.
   * - Valida que sea EXACTAMENTE el siguiente disponible de esa báscula.
   * - Lo guarda con status = 0 (asignado).
   */
  async assignComprobante(dto: AssignComprobanteDto) {
    const { id_shipment, id_bascula, no_comprobante } = dto;

    // 1. Validar envío
    const shipment = await this.shipmentsRepo.findOne({
      where: { id: id_shipment },
    });

    if (!shipment) {
      throw new BadRequestException(
        `No se encontró un envío con id_shipment ${id_shipment}.`,
      );
    }

    // 2. Verificar si el shipment ya tiene comprobantes activos (no anulados)
    const comprobanteExistente = await this.comprobanteRepo.findOne({
      where: {
        idShipment: id_shipment,
        status: 0, // activos
      },
      relations: ['serialComprobante'],
    });

    // Si ya tiene un comprobante activo
    if (comprobanteExistente) {
      // Si el comprobante es exactamente el mismo que se está intentando asignar, retornar success
      // Convertir ambos a number para asegurar la comparación correcta
      if (
        Number(comprobanteExistente.noComprobante) === Number(no_comprobante)
      ) {
        return {
          id_shipment,
          id_bascula,
          no_comprobante: comprobanteExistente.noComprobante,
          status: comprobanteExistente.status,
          statusText: this.getStatusText(comprobanteExistente.status),
          id_comprobseries: comprobanteExistente.serialComprobante?.id ?? null,
          message: 'El envío ya tiene este comprobante asignado.',
        };
      }

      // Si es diferente, lanzar error
      throw new BadRequestException(
        `El envío ya tiene el comprobante ${comprobanteExistente.noComprobante} asignado. Debe anularlo antes de asignar el comprobante ${no_comprobante}.`,
      );
    }

    // 3. Validar que el número pertenezca a alguna serie de ESTA báscula
    const serie = await this.serialRepo
      .createQueryBuilder('s')
      .where('s.id_bascula = :id_bascula', { id_bascula })
      .andWhere(':num BETWEEN s.min_serialnumber AND s.max_serialnumber', {
        num: no_comprobante,
      })
      .getOne();

    if (!serie) {
      throw new BadRequestException(
        `El comprobante ${no_comprobante} no pertenece a ninguna serie registrada para la báscula ${id_bascula}.`,
      );
    }

    // 4. Verificar si el número ya existe en otro envío (activo o anulado)
    const existenteOtroEnvio = await this.comprobanteRepo.findOne({
      where: { noComprobante: no_comprobante },
    });

    // Si existe y NO es del mismo envío, es error
    if (existenteOtroEnvio && existenteOtroEnvio.idShipment !== id_shipment) {
      const siguienteReal = await this.getNextComprobanteByBascula(id_bascula);
      throw new BadRequestException(
        `El comprobante ${no_comprobante} ya fue utilizado en otro envío. El siguiente disponible para la báscula ${id_bascula} es: ${siguienteReal}.`,
      );
    }

    // 5. Calcular el siguiente disponible PARA ESA BÁSCULA
    const siguiente = await this.getNextComprobanteByBascula(id_bascula);

    // 6. Obligar a que el número enviado sea EXACTAMENTE el siguiente
    if (no_comprobante !== siguiente) {
      throw new BadRequestException(
        `El comprobante ${no_comprobante} no es el siguiente disponible. El siguiente comprobante para la báscula ${id_bascula} debe ser: ${siguiente}.`,
      );
    }

    // 7. Guardar con la relación a la serie de comprobantes
    const entidad = this.comprobanteRepo.create({
      idShipment: id_shipment,
      noComprobante: no_comprobante,
      status: 0,
      serialComprobante: { id: serie.id } as any,
    });

    const saved = await this.comprobanteRepo.save(entidad);

    // Verificar si después de asignar este comprobante, la serie llegó exactamente a 100 disponibles
    const total = serie.max_serialnumber - serie.min_serialnumber + 1;
    const usados = await this.comprobanteRepo.count({
      where: {
        noComprobante: Between(serie.min_serialnumber, serie.max_serialnumber),
      },
    });
    const disponibles = total - usados;

    // Si quedan exactamente en el umbral mínimo, enviar notificación
    const stockMinimo = await this.configService.getNumber(
      'stock_minimo_comprobantes',
      100,
    );
    if (disponibles === stockMinimo) {
      // Enviar notificación de forma asíncrona sin bloquear la respuesta
      this.sendLowStockAlert('comprobante', {
        idBascula: id_bascula,
        serieId: serie.id,
        rango: `${serie.min_serialnumber} - ${serie.max_serialnumber}`,
        disponibles,
        total,
        stockMinimo,
      }).catch((err) => {
        console.error(
          '[assignComprobante] Error al enviar notificación de stock bajo:',
          err,
        );
      });
    }

    return {
      id_shipment,
      id_bascula,
      no_comprobante: saved.noComprobante,
      status: saved.status,
      statusText: this.getStatusText(saved.status),
      id_comprobseries: serie.id,
      created_at: saved.createdAt,
      message: 'Comprobante asignado exitosamente.',
    };
  }

  /**
   * Anula un comprobante (status = 1) por id_shipment.
   * No libera el número, solo marca que se anuló.
   * No permite anular si el shipment tiene currentStatus = 12.
   */
  async cancelComprobanteByShipmentId(id_shipment: number, motivo?: string) {
    // 1. Verificar que el shipment exista
    const shipment = await this.shipmentsRepo.findOne({
      where: { id: id_shipment },
    });

    if (!shipment) {
      throw new BadRequestException(`No se encontró el envío solicitado.`);
    }

    // Verificar si el shipment tiene currentStatus = 12
    if (shipment.currentStatus === 12) {
      throw new BadRequestException(
        `No se puede anular el comprobante porque el envío ya finalizó.`,
      );
    }

    // 2. Buscar comprobante activo (status 0) para ese shipment
    const comprobante = await this.comprobanteRepo.findOne({
      where: { idShipment: id_shipment, status: 0 },
      relations: ['serialComprobante'],
      order: { createdAt: 'DESC' },
    });

    if (!comprobante) {
      throw new BadRequestException(
        `Este envío no tiene un comprobante activo para anular.`,
      );
    }

    // 3. Marcar como anulado y guardar motivo
    comprobante.status = 1;
    if (motivo) {
      comprobante.motivo = motivo;
    }
    const saved = await this.comprobanteRepo.save(comprobante);

    // 4. Enviar notificación por correo
    await this.sendCancellationNotification('comprobante', {
      noComprobante: saved.noComprobante,
      idShipment: id_shipment,
      codeGen: shipment.codeGen,
      idBascula: saved.serialComprobante?.id_bascula,
      motivo: saved.motivo,
    });

    return {
      id_shipment,
      no_comprobante: saved.noComprobante,
      status: saved.status, // 1 anulado
    };
  }

  /**
   * Anula un comprobante por su número de comprobante (no_comprobante).
   * Si existe: lo marca como anulado
   * Si NO existe: crea el registro directamente como anulado
   */
  async cancelComprobanteByNumero(no_comprobante: number, motivo?: string) {
    // Buscar si el comprobante ya existe (sin importar el status)
    const comprobanteExistente = await this.comprobanteRepo.findOne({
      where: { noComprobante: no_comprobante },
      relations: ['serialComprobante'],
    });

    // Caso 1: El comprobante ya existe
    if (comprobanteExistente) {
      // Si ya está anulado, no hacer nada
      if (comprobanteExistente.status === 1) {
        throw new BadRequestException(
          `El comprobante ${no_comprobante} ya fue anulado anteriormente.`,
        );
      }

      // Obtener información del shipment
      const shipment = await this.shipmentsRepo.findOne({
        where: { id: comprobanteExistente.idShipment },
      });

      // Verificar si el shipment tiene currentStatus = 12 y el comprobante está ASIGNADO
      if (shipment && comprobanteExistente.status === 0) {
        if (shipment.currentStatus === 12) {
          throw new BadRequestException(
            `No se puede anular el comprobante porque el envío ya finalizó.`,
          );
        }
      }

      // Marcar como anulado y guardar motivo
      comprobanteExistente.status = 1;
      if (motivo) {
        comprobanteExistente.motivo = motivo;
      }
      const saved = await this.comprobanteRepo.save(comprobanteExistente);

      // Enviar notificación por correo
      await this.sendCancellationNotification('comprobante', {
        noComprobante: saved.noComprobante,
        idShipment: saved.idShipment,
        codeGen: shipment?.codeGen,
        idBascula: saved.serialComprobante?.id_bascula,
        motivo: saved.motivo,
      });

      return {
        id: saved.id,
        id_shipment: saved.idShipment,
        no_comprobante: saved.noComprobante,
        status: saved.status, // 1 anulado
        motivo: saved.motivo,
        mensaje: 'Comprobante anulado exitosamente.',
      };
    }

    // Caso 2: El comprobante NO existe, hay que crearlo como anulado
    // Buscar la serie a la que pertenece este número
    const series = await this.serialRepo.find();

    let serieEncontrada: SerialComprobante | null = null;
    for (const serie of series) {
      if (
        no_comprobante >= serie.min_serialnumber &&
        no_comprobante <= serie.max_serialnumber
      ) {
        serieEncontrada = serie;
        break;
      }
    }

    if (!serieEncontrada) {
      throw new BadRequestException(
        `El comprobante ${no_comprobante} no pertenece a ninguna serie configurada.`,
      );
    }

    // Crear el comprobante directamente como anulado
    const nuevoComprobante = this.comprobanteRepo.create({
      noComprobante: no_comprobante,
      idShipment: null, // No tiene shipment asociado
      status: 1, // Anulado
      motivo: motivo || 'Anulado sin asignación previa',
      impreso: false,
      fechaImpresion: null,
      serialComprobante: { id: serieEncontrada.id } as any,
    });

    const saved = await this.comprobanteRepo.save(nuevoComprobante);

    // Enviar notificación por correo
    await this.sendCancellationNotification('comprobante', {
      noComprobante: saved.noComprobante,
      idShipment: null,
      codeGen: null,
      idBascula: serieEncontrada.id_bascula,
      motivo: saved.motivo,
    });

    return {
      id: saved.id,
      id_shipment: null,
      no_comprobante: saved.noComprobante,
      status: saved.status, // 1 anulado
      motivo: saved.motivo,
      mensaje: 'Comprobante registrado como anulado exitosamente.',
    };
  }

  /**
   * Registra la impresión de un comprobante.
   * Actualiza el campo impreso a true y guarda la fecha de impresión.
   */
  async registrarImpresionComprobante(
    id_shipment: number,
    fecha_impresion: Date,
  ) {
    // 1. Verificar que el shipment exista
    const shipment = await this.shipmentsRepo.findOne({
      where: { id: id_shipment },
    });

    if (!shipment) {
      throw new BadRequestException(
        `No se encontró un envío con id_shipment ${id_shipment}.`,
      );
    }

    // 2. Buscar comprobante activo (status 0) para ese shipment
    const comprobante = await this.comprobanteRepo.findOne({
      where: { idShipment: id_shipment, status: 0 },
      order: { createdAt: 'DESC' },
    });

    if (!comprobante) {
      throw new BadRequestException(
        `El envío ${id_shipment} no tiene un comprobante activo para registrar impresión.`,
      );
    }

    // 3. Actualizar campos de impresión
    comprobante.impreso = true;
    comprobante.fechaImpresion = fecha_impresion;
    const saved = await this.comprobanteRepo.save(comprobante);

    return {
      id_shipment,
      no_comprobante: saved.noComprobante,
      impreso: saved.impreso,
      fecha_impresion: saved.fechaImpresion,
    };
  }
}

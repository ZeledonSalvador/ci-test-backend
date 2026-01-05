// src/modules/blocks/blocks.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { ProductIngenioBlock } from './entities/product-ingenio-block.entity';
import { BlockDto } from './dto/block.dto';
import { ListQueryDto } from './dto/list-query.dto';

@Injectable()
export class BlocksService {
  constructor(
    @InjectRepository(ProductIngenioBlock)
    private readonly repo: Repository<ProductIngenioBlock>,
  ) { }

  /**
   * Upsert para bloquear/desbloquear por par (ingenioCode, productCode).
   * Si no existe, crea; si existe, actualiza el campo active.
   */
  async upsertPair(dto: BlockDto): Promise<ProductIngenioBlock> {
    const { ingenioCode, productCode } = dto;
    const active = dto.active ?? true; // por defecto bloquear

    // busca existente por par
    let entity = await this.repo.findOne({ where: { ingenioCode, productCode } });
    if (!entity) {
      entity = this.repo.create({ ingenioCode, productCode, active });
    } else {
      entity.active = active;
    }
    return await this.repo.save(entity);
  }

  /**
   * Desbloquear por id (marca active=false, no borra).
   */
  async unblockByPair(ingenioCode: string, productCode: string) {
    let entity = await this.repo.findOne({ where: { ingenioCode, productCode } });

    if (!entity) {
      // Política A: crear explícitamente como desbloqueado (recomendada)
      entity = this.repo.create({ ingenioCode, productCode, active: false });
      return this.repo.save(entity);

      // Política B (si prefieres 404):
      // throw new NotFoundException('Block pair not found');
    }

    if (!entity.active) return entity; // idempotente
    entity.active = false;
    return this.repo.save(entity);
  }


  /**
   * Listado con filtros, orden y paginación.
   */
  async list(q: ListQueryDto) {
    const { ingenioCode, productCode, active, page = 1, pageSize = 50, sort = 'ingenioCode', order = 'asc' } = q;

    const where: FindOptionsWhere<ProductIngenioBlock> = {};
    if (ingenioCode) where.ingenioCode = ingenioCode;
    if (productCode) where.productCode = productCode;
    if (active === 'true') where.active = true;
    if (active === 'false') where.active = false;

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { [sort]: order.toUpperCase() as any },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items,
      pageInfo: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        hasNextPage: page * pageSize < total,
      },
    };
  }

  /**
   * Estado (bloqueado/desbloqueado) de un par. Si no existe, se asume desbloqueado.
   */
  async isBlocked(ingenioCode: string, productCode: string): Promise<boolean> {
    const found = await this.repo.findOne({ where: { ingenioCode, productCode } });
    return found?.active === true;
  }

  /**
   * Lanza BadRequest si está bloqueado.
   */
  async assertNotBlocked(ingenioCode: string, productCode: string): Promise<void> {
    const blocked = await this.isBlocked(ingenioCode, productCode);
    if (blocked) {
      throw new BadRequestException(
        `No es posible crear el envío del producto ${productCode}. Concluye las pruebas para habilitarlo.`,
      );
    }
  }
  // src/modules/blocks/blocks.service.ts (añade este método)
  async stats(ingenioCode?: string) {
    const qb = this.repo.createQueryBuilder('b');
    if (ingenioCode) qb.where('b.ingenioCode = :ingenioCode', { ingenioCode });

    const totalFlags = await qb.getCount();

    const q2 = this.repo.createQueryBuilder('b2');
    if (ingenioCode) q2.where('b2.ingenioCode = :ingenioCode', { ingenioCode });
    const totalBloqueados = await q2.andWhere('b2.active = 1').getCount();
    const totalDesbloqueados = totalFlags - totalBloqueados;

    // porIngenio (solo si no filtras por uno)
    let porIngenio: Array<{ ingenioCode: string; bloqueados: number; desbloqueados: number }> = [];
    if (!ingenioCode) {
      const rows = await this.repo.createQueryBuilder('b3')
        .select('b3.ingenioCode', 'ingenioCode')
        .addSelect('SUM(CASE WHEN b3.active = 1 THEN 1 ELSE 0 END)', 'bloqueados')
        .addSelect('SUM(CASE WHEN b3.active = 1 THEN 0 ELSE 1 END)', 'desbloqueados')
        .groupBy('b3.ingenioCode')
        .getRawMany();
      porIngenio = rows.map(r => ({
        ingenioCode: r.ingenioCode,
        bloqueados: Number(r.bloqueados),
        desbloqueados: Number(r.desbloqueados),
      }));
    }

    return { totalFlags, totalBloqueados, totalDesbloqueados, porIngenio };
  }
}

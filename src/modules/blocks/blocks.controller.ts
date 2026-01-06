// src/modules/blocks/blocks.controller.ts
import {
  Controller,
  Post,
  Patch,
  Delete,
  Get,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { Role } from 'src/modules/auth/enums/roles.enum';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { BlocksService } from './blocks.service';
import { BlockDto } from './dto/block.dto';
import { UnblockDto } from './dto/unblock.dto';

@Controller('shipping/blocks')
@UseGuards(AuthGuard)
export class BlocksController {
  constructor(private readonly blocks: BlocksService) {}

  // Bloquear (o desbloquear si envías active=false) por par
  @Post('product-ingenio/block')
  @Roles(Role.ADMIN, Role.BOT)
  async block(@Body() dto: BlockDto) {
    // Por defecto "active=true" si no viene; esto permite unificar "block/unblock" si quisieras
    if (dto.active === undefined) dto.active = true;
    return this.blocks.upsertPair(dto);
  }

  // Desbloquear por id (marca active=false; no borra)
  @Patch('product-ingenio/unblock')
  @Roles(Role.ADMIN, Role.BOT)
  async unblockByPair(@Body() dto: UnblockDto) {
    return this.blocks.unblockByPair(dto.ingenioCode, dto.productCode);
  }

  @Get('product-ingenio')
  async unified(
    @Query('view') view: 'status' | 'stats' | 'list' = 'list',
    @Query('ingenioCode') ingenioCode?: string,
    @Query('productCode') productCode?: string,
    @Query('active') active?: 'true' | 'false',
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '50',
    @Query('sort')
    sort:
      | 'ingenioCode'
      | 'productCode'
      | 'createdAt'
      | 'active' = 'ingenioCode',
    @Query('order') order: 'asc' | 'desc' = 'asc',
  ) {
    if (view === 'status') {
      if (!ingenioCode || !productCode) {
        return {
          error: 'ingenioCode y productCode son requeridos para view=status',
        };
      }
      const blocked = await this.blocks.isBlocked(ingenioCode, productCode);
      return { ingenioCode, productCode, blocked };
    }

    if (view === 'stats') {
      return this.blocks.stats(ingenioCode); // ver método abajo
    }

    // view === 'list' (por defecto)
    return this.blocks.list({
      ingenioCode,
      productCode,
      active,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 50,
      sort,
      order,
    });
  }
}

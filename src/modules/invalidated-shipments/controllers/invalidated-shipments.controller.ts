import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { InvalidatedShipmentsService } from '../services/invalidated-shipments.service';
import { InvalidatedShipments } from 'src/models/InvalidatedShipments';
import { Shipments } from 'src/models/Shipments';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import { Role } from 'src/modules/auth/enums/roles.enum';
import { PaginationInfo } from 'src/dto/pagination';
import { Response } from 'express';
import { InvalidatedShipmentWithParsedData } from '../types/InvalidatedShipmentWithParsedData';
import AppRebuildRequest from 'src/modules/auth/interface/AppRebuildRequest';

@Controller('invalidated-shipments')
@UseGuards(AuthGuard)
export class InvalidatedShipmentsController {
  constructor(
    private readonly invalidatedShipmentsService: InvalidatedShipmentsService,
  ) {}

  @Delete(':codeGen')
  @Roles(Role.ADMIN, Role.CLIENT, Role.BOT)
  async invalidateShipment(
    @Param('codeGen') codeGen: string,
    @Body('reason') reason: string,
    @CurrentUser() user: any,
  ): Promise<InvalidatedShipments> {
    return this.invalidatedShipmentsService.invalidateShipment(
      codeGen,
      reason,
      user,
    );
  }

  @Post('restore/:codeGen')
  @Roles(Role.ADMIN, Role.BOT)
  async restoreShipment(
    @Param('codeGen') codeGen: string,
    @CurrentUser() user: any,
  ): Promise<Shipments> {
    return this.invalidatedShipmentsService.loadInvalidateShipmenToValide(
      codeGen,
      user,
    );
  }

  @Get()
  @Roles(Role.ADMIN, Role.BOT)
  async getAllInvalidatedShipments(
    @Query('page') page: string,
    @Query('size') size: string,
    @Res() res: Response,
  ): Promise<void> {
    const pageNumber = Number(page) || 1;
    const sizeNumber = Number(size) || 10;

    const { data, pagination } =
      await this.invalidatedShipmentsService.getAllInvalidatedShipments(
        pageNumber,
        sizeNumber,
      );

    res.set(new PaginationInfo(pagination).headers);
    res.status(200).json(data);
  }

  @Get(':codeGen')
  @Roles(Role.ADMIN, Role.BOT)
  async getInvalidatedShipmentByCodeGen(
    @Param('codeGen') codeGen: string,
  ): Promise<InvalidatedShipmentWithParsedData> {
    return await this.invalidatedShipmentsService.getInvalidatedShipmentByCodeGen(
      codeGen,
    );
  }

  @Get('client/:ingenioCode')
  @Roles(Role.ADMIN, Role.BOT, Role.CLIENT)
  async getInvalidatedShipmentsByClient(
    @Param('ingenioCode') ingenioCode: string,
    @Query('page') page: string,
    @Query('size') size: string,
    @Res() res: Response,
    @Req() req: AppRebuildRequest,
  ): Promise<void> {
    const pageNumber = Number(page) || 1;
    const sizeNumber = Number(size) || 10;
    const isClient = req.isClient;

    const { data, pagination } =
      await this.invalidatedShipmentsService.getInvalidatedShipmentsByClient(
        ingenioCode,
        isClient,
        pageNumber,
        sizeNumber,
      );

    res.set(new PaginationInfo(pagination).headers);
    res.status(200).json(data);
  }
}

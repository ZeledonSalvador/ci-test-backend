import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Pagination } from 'src/dto/pagination';
import { InvalidatedShipments } from 'src/models/InvalidatedShipments';
import { Shipments } from 'src/models/Shipments';
import { ShipmentsService } from 'src/modules/shipments/services/shipments.service';
import { Repository } from 'typeorm';
import { InvalidatedShipmentWithParsedData } from '../types/InvalidatedShipmentWithParsedData';
import { IngenioLogsService } from 'src/modules/logs/services/ingenio-logs.service';
import { Role } from 'src/modules/auth/enums/roles.enum';

@Injectable()
export class InvalidatedShipmentsService {
  constructor(
    @InjectRepository(Shipments)
    private readonly shipmentsRepository: Repository<Shipments>,
    @InjectRepository(InvalidatedShipments)
    private readonly invalidatedShipmentsRepository: Repository<InvalidatedShipments>,
    private readonly shipmentsService: ShipmentsService,
    private readonly ingenioLogsService: IngenioLogsService,
  ) {}

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
  private generateUsernameForLog(userFromSession?: any): string {
    if (!userFromSession) return 'UNKNOWN';
    const roles = userFromSession.roles || [];
    if (roles.includes(Role.CLIENT)) {
      return `${userFromSession.username}`;
    }
    return userFromSession.username || 'UNKNOWN';
  }

  async invalidateShipment(
    codeGen: string,
    invalidationReason: string,
    userFromSession?: any,
  ): Promise<InvalidatedShipments | any> {
    const shouldLog = this.shouldLogIngenio(userFromSession);
    const usernameForLog = this.generateUsernameForLog(userFromSession);

    try {
      if (shouldLog) {
        await this.ingenioLogsService.logIngenioSuccess(
          codeGen,
          usernameForLog,
          '200',
          'INVALIDATE_SHIPMENT_START',
          { codeGen, invalidationReason },
        );
      }

      const shipment = await this.shipmentsService.deleteShipment(codeGen);

      const invalidatedShipment = this.invalidatedShipmentsRepository.create({
        jsonData: JSON.stringify(shipment),
        reason: invalidationReason,
        codeGen: shipment.codeGen,
        client: shipment.ingenio,
      });

      const saved =
        await this.invalidatedShipmentsRepository.save(invalidatedShipment);

      if (shouldLog) {
        await this.ingenioLogsService.logIngenioSuccess(
          codeGen,
          usernameForLog,
          '200',
          'INVALIDATE_SHIPMENT_SUCCESS',
          { codeGen, invalidationReason },
          {
            invalidatedId: saved.id,
            client: shipment.ingenio?.ingenioCode ?? null,
            completedAt: new Date().toISOString(),
          },
        );
      }

      return saved;
    } catch (error) {
      if (shouldLog) {
        await this.ingenioLogsService.logIngenioError(
          codeGen,
          usernameForLog,
          '400',
          error.message,
          { codeGen, invalidationReason },
        );
      }
      throw error;
    }
  }

  async loadInvalidateShipmenToValide(
    invalidatedCodeGen: string,
    userFromSession?: any,
  ): Promise<Shipments | any> {
    const shouldLog = this.shouldLogIngenio(userFromSession);
    const usernameForLog = this.generateUsernameForLog(userFromSession);

    try {
      if (shouldLog) {
        await this.ingenioLogsService.logIngenioSuccess(
          invalidatedCodeGen,
          usernameForLog,
          '200',
          'REVALIDATE_SHIPMENT_START',
          { codeGen: invalidatedCodeGen },
        );
      }

      const invalidatedShipment =
        await this.invalidatedShipmentsRepository.findOne({
          where: { codeGen: invalidatedCodeGen },
        });
      if (!invalidatedShipment) {
        const msg = 'No se puede validar un envío que no ha sido invalidado.';
        if (shouldLog) {
          await this.ingenioLogsService.logIngenioError(
            invalidatedCodeGen,
            usernameForLog,
            '404',
            msg,
            { codeGen: invalidatedCodeGen },
          );
        }
        throw new NotFoundException(msg);
      }

      const shipment = await this.shipmentsRepository.findOne({
        where: { codeGen: invalidatedCodeGen },
      });
      if (shipment) {
        const msg = 'No puedes revalidar este envio, ya que ya fue creado';
        if (shouldLog) {
          await this.ingenioLogsService.logIngenioError(
            invalidatedCodeGen,
            usernameForLog,
            '409',
            msg,
            { codeGen: invalidatedCodeGen },
          );
        }
        throw new ConflictException(msg);
      }

      await this.invalidatedShipmentsRepository.delete({
        codeGen: invalidatedCodeGen,
      });

      const restored = await this.shipmentsService.createAllRecord(
        JSON.parse(invalidatedShipment.jsonData),
      );

      if (shouldLog) {
        await this.ingenioLogsService.logIngenioSuccess(
          invalidatedCodeGen,
          usernameForLog,
          '200',
          'REVALIDATE_SHIPMENT_SUCCESS',
          { codeGen: invalidatedCodeGen },
          {
            shipmentId: restored.id,
            client: restored.ingenio?.ingenioCode ?? null,
            completedAt: new Date().toISOString(),
          },
        );
      }

      return restored;
    } catch (error) {
      if (shouldLog) {
        await this.ingenioLogsService.logIngenioError(
          invalidatedCodeGen,
          usernameForLog,
          '400',
          error.message,
          { codeGen: invalidatedCodeGen },
        );
      }
      throw error;
    }
  }

  async getAllInvalidatedShipments(
    page: number = 1,
    size: number = 10,
  ): Promise<{
    data: InvalidatedShipmentWithParsedData[];
    pagination: Pagination;
  }> {
    const offset = (page - 1) * size;

    const [shipments, totalCount] =
      await this.invalidatedShipmentsRepository.findAndCount({
        skip: offset,
        take: size,
      });

    const formattedShipments = shipments.map((shipment) => ({
      ...shipment,
      jsonData: JSON.parse(shipment.jsonData) as Shipments,
    }));

    return {
      data: formattedShipments,
      pagination: {
        count: totalCount,
        limit: size,
        offset,
      },
    };
  }

  async getInvalidatedShipmentByCodeGen(
    codeGen: string,
  ): Promise<InvalidatedShipmentWithParsedData> {
    const invalidatedShipment =
      await this.invalidatedShipmentsRepository.findOne({
        where: { codeGen },
      });

    if (!invalidatedShipment) {
      throw new NotFoundException(
        `No se encontró un envío invalidado con el código ${codeGen}.`,
      );
    }

    return {
      ...invalidatedShipment,
      jsonData: JSON.parse(invalidatedShipment.jsonData) as Shipments,
    };
  }

  async getInvalidatedShipmentsByClient(
    ingenioCode: string,
    forClients: boolean = false,
    page: number = 1,
    size: number = 10,
  ): Promise<{
    data: Partial<InvalidatedShipmentWithParsedData>[];
    pagination: Pagination;
  }> {
    const offset = (page - 1) * size;

    const [shipments, totalCount] =
      await this.invalidatedShipmentsRepository.findAndCount({
        where: { client: { ingenioCode } },
        relations: ['client'],
        skip: offset,
        take: size,
      });

    const config = {
      keysToRemove: {
        root: ['statuses'],
        shipmentAttachments: ['id', 'updatedAt'],
      },
    };

    const formattedShipments = shipments.map((shipment) => {
      const parsedData = JSON.parse(shipment.jsonData) as Shipments;
      const processedData = this.shipmentsService.normalizeShipment(
        parsedData,
        forClients,
        config,
      );

      if (forClients) {
        return {
          reason: shipment.reason,
          createdAt: shipment.createdAt,
          jsonData: processedData,
        };
      }

      return {
        ...shipment,
        jsonData: processedData,
      };
    });

    return {
      data: formattedShipments,
      pagination: {
        count: totalCount,
        limit: size,
        offset,
      },
    };
  }
}

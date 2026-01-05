import {
    Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shipments } from 'src/models/Shipments';
import { Status } from 'src/models/Status';
import { ProductType } from '../enums/productType.enum';
import { getKeyByValueEnum } from 'src/utils/functions.util';

export interface PaginationResponse {
    currentPage: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
}

export interface QueryResponse {
    success: boolean;
    data: ShipmentQueryResult[];
    pagination: PaginationResponse;
    message: string;
}

// Mapeo de códigos de actividad a nombres
const ActivityMap: { [key: string]: string } = {
    '2': 'Recepción de Azúcar y Melaza',
    // Agregar más actividades según sea necesario
};

interface ShipmentQueryResult {
    id: number;
    codeGen: string;
    nameProduct: string;
    activityNumber: string;
    currentStatus: number;
    createdAt: Date;
    entryDate: Date | null;
    driver: any;
    vehicle: any;
    ingenio: any;
    shipmentSeals: any[];
    transporter: string;
    productQuantity: number;
    productQuantityKg: number;
    unitMeasure: string;
    magneticCard: number | null;
    idNavRecord: number | null;
}

@Injectable()
export class ShipmentsQueryService {
    constructor(
        @InjectRepository(Shipments)
        private shipmentsRepository: Repository<Shipments>,
        @InjectRepository(Status)
        private statusRepository: Repository<Status>,
    ) { }

    /**
     * Obtiene envíos por estado con filtros adicionales de actividad y producto
     * Incluye la fecha cuando el envío llegó a status 5
     */
    async getShipmentsByStatusWithFilters(
        statusType: number,
        startDate?: string,
        endDate?: string,
        page: number = 1,
        size: number = 30,
        activity?: string,
        product?: string
    ): Promise<QueryResponse> {
        const relations = [
            "driver",
            "vehicle",
            "ingenio",
            "shipmentSeals",
        ];

        // Construir query con QueryBuilder para mayor flexibilidad
        let queryBuilder = this.shipmentsRepository.createQueryBuilder('shipment');

        // Agregar JOINs
        relations.forEach(relation => {
            queryBuilder = queryBuilder.leftJoinAndSelect(`shipment.${relation}`, relation);
        });

        // Condición principal: status
        queryBuilder = queryBuilder.where('shipment.currentStatus = :statusType', { statusType });

        // Filtro por rango de fechas
        if (startDate && endDate) {
            queryBuilder = queryBuilder.andWhere(
                'shipment.createdAt BETWEEN :startDate AND :endDate',
                { startDate: new Date(startDate), endDate: new Date(endDate) }
            );
        }

        // Filtro por número de actividad
        if (activity) {
            queryBuilder = queryBuilder.andWhere('shipment.activityNumber = :activity', { activity });
        }

        // Filtro por producto
        if (product) {
            queryBuilder = queryBuilder.andWhere('shipment.product = :product', { product });
        }

        // Ordenar por fecha de creación descendente
        queryBuilder = queryBuilder.orderBy('shipment.createdAt', 'DESC');

        // Paginación
        const [shipments, totalCount] = await queryBuilder
            .skip((page - 1) * size)
            .take(size)
            .getManyAndCount();

        const totalPages = Math.ceil(totalCount / size);

        // Si no hay resultados, retornar respuesta vacía
        if (!shipments || shipments.length === 0) {
            return {
                success: true,
                data: [],
                pagination: {
                    currentPage: page,
                    pageSize: size,
                    totalRecords: 0,
                    totalPages: 0
                },
                message: "No se encontraron transacciones."
            };
        }

        // Obtener las fechas de llegada a status 5 para todos los shipments
        const shipmentIds = shipments.map(s => s.id);
        const status5Dates = await this.getStatus5Dates(shipmentIds);

        // Formatear respuesta
        const formattedShipments: ShipmentQueryResult[] = shipments.map(shipment => {
        
            return {
                id: shipment.id,
                codeGen: shipment.codeGen,
                nameProduct: getKeyByValueEnum(shipment.product, ProductType),
                activityNumber: shipment.activityNumber,
                currentStatus: shipment.currentStatus,
                createdAt: shipment.createdAt,
                entryDate: status5Dates.get(shipment.id) || null,
                driver: shipment.driver ? {
                    id: shipment.driver.id,
                    name: shipment.driver.name,
                    license: shipment.driver.license
                } : null,
                vehicle: shipment.vehicle ? {
                    id: shipment.vehicle.id,
                    plate: shipment.vehicle.plate,
                    trailerPlate: shipment.vehicle.trailerPlate,
                    truckType: shipment.vehicle.truckType
                } : null,
                ingenio: shipment.ingenio ? {
                    id: shipment.ingenio.id,
                    ingenioCode: shipment.ingenio.ingenioCode,
                    name: shipment.ingenio.name
                } : null,
                shipmentSeals: shipment.shipmentSeals?.map(seal => ({
                    id: seal.id,
                    sealCode: seal.sealCode,
                    sealDescription: seal.sealDescription
                })) || [],
                transporter: shipment.transporter,
                productQuantity: shipment.productQuantity,
                productQuantityKg: shipment.productQuantityKg,
                unitMeasure: shipment.unitMeasure,
                magneticCard: shipment.magneticCard,
                idNavRecord: shipment.idNavRecord,
            };
        });

        return {
            success: true,
            data: formattedShipments,
            pagination: {
                currentPage: page,
                pageSize: size,
                totalRecords: totalCount,
                totalPages: totalPages
            },
            message: "Transacciones encontradas exitosamente."
        };
    }

    /**
     * Obtiene las fechas cuando los envíos llegaron a status 5
     */
    private async getStatus5Dates(shipmentIds: number[]): Promise<Map<number, Date>> {
        if (shipmentIds.length === 0) {
            return new Map();
        }

        const statusRecords = await this.statusRepository
            .createQueryBuilder('status')
            .innerJoin('status.predefinedStatus', 'predefinedStatus')
            .innerJoin('status.shipment', 'shipment')
            .select([
                'shipment.id as shipmentId',
                'status.createdAt as arrivedAt'
            ])
            .where('shipment.id IN (:...shipmentIds)', { shipmentIds })
            .andWhere('predefinedStatus.id = :statusId', { statusId: 5 })
            .orderBy('status.createdAt', 'ASC')
            .getRawMany();

        const dateMap = new Map<number, Date>();

        // Solo tomar la primera fecha de llegada a status 5 para cada shipment
        statusRecords.forEach(record => {
            const shipmentId = record.shipmentId;
            if (!dateMap.has(shipmentId)) {
                dateMap.set(shipmentId, record.arrivedAt);
            }
        });

        return dateMap;
    }

    /**
     * Obtiene todos los filtros disponibles (productos y actividades)
     */
    async getAvailableFilters(): Promise<{
        products: { code: string; name: string }[];
        activities: { code: string; name: string }[];
    }> {
        // Obtener productos
        const productsResult = await this.shipmentsRepository
            .createQueryBuilder('shipment')
            .select('DISTINCT shipment.product', 'product')
            .getRawMany();

        const products = productsResult
            .map(r => r.product)
            .filter(p => p != null)
            .map(code => ({
                code: code,
                name: getKeyByValueEnum(code, ProductType)
            }));

        // Obtener actividades
        const activitiesResult = await this.shipmentsRepository
            .createQueryBuilder('shipment')
            .select('DISTINCT shipment.activityNumber', 'activityNumber')
            .getRawMany();

        const activities = activitiesResult
            .map(r => r.activityNumber)
            .filter(a => a != null)
            .map(code => ({
                code: code,
                name: ActivityMap[code] || code
            }));

        return {
            products,
            activities
        };
    }
}

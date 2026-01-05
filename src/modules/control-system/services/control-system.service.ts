import { Injectable, RequestMethod } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { HttpManager } from 'src/utils/HttpManager';
import { InvalidatedShipments } from 'src/models/InvalidatedShipments';
import { Shipments } from 'src/models/Shipments';
import { Vehicles } from 'src/models/Vehicles';
import { DiscoveryService, ModuleRef, Reflector } from '@nestjs/core';
import * as os from 'os';

@Injectable()
export class ControlSystemService {
    constructor(
        private readonly httpManager: HttpManager,
        @InjectRepository(Shipments) private readonly shipmentsRepository: Repository<Shipments>,
        @InjectRepository(InvalidatedShipments) private readonly invalidatedShipmentsRepository: Repository<InvalidatedShipments>,
        @InjectRepository(Vehicles) private readonly vehiclesRepository: Repository<Vehicles>,
        private readonly dataSource: DataSource,
        private readonly moduleRef: ModuleRef,
        private readonly reflector: Reflector,
        private readonly discoveryService: DiscoveryService 
    ) { }

    async getSystemControlInformationApiMiddleWare(): Promise<any> {
        try {
            const url = `${process.env.SERVER_MIDDLEWARE_NAME}${process.env.SERVER_MIDDLEWARE_SYSTEM_CONTROL}`;
            return await this.httpManager.get<any>(url);
        } catch (error) {
            console.error('Error al conectar con la API Middleware:', error);
            return 'Error al conectar con la API Middleware al obtener informacion del sistema:' + error;
        }
    }

    async reStartMonitoringSystemInApiMiddlewareControlSystem() {
        try {
            const url = `${process.env.SERVER_MIDDLEWARE_NAME}${process.env.SERVER_MIDDLEWARE_RESTART_MONITORING_SYSTEM}`;
            return await this.httpManager.post<any>(url);
        } catch (error) {
            console.error('Error al conectar con la API Middleware:', error);
            return 'Error al conectar con la API Middleware al reiniciar el sistema de monitoreo: ' + error;
        }
    }

    async startMonitoringSystemInApiMiddlewareControlSystem() {
        try {
            const url = `${process.env.SERVER_MIDDLEWARE_NAME}${process.env.SERVER_MIDDLEWARE_START_MONITORING_SYSTEM}`;
            return await this.httpManager.post<any>(url);
        } catch (error) {
            console.error('Error al conectar con la API Middleware:', error);
            return 'Error al conectar con la API Middleware al iniciar el sistema de monitoreo: ' + error;
        }
    }

    async stopMonitoringSystemInApiMiddlewareControlSystem() {
        try {
            const url = `${process.env.SERVER_MIDDLEWARE_NAME}${process.env.SERVER_MIDDLEWARE_STOP_MONITORING_SYSTEM}`;
            return await this.httpManager.post<any>(url);
        } catch (error) {
            console.error('Error al conectar con la API Middleware:', error);
            return 'Error al conectar con la API Middleware al detener el sistema de monitoreo: ' + error;
        }
    }

    async getDatabaseStats(): Promise<any> {
        try {
            const databaseSizeQuery = `
              SELECT
                DB_NAME() AS database_name,
                SUM(size * 8 / 1024) AS database_size_KB
              FROM sys.master_files
              WHERE database_id = DB_ID()
              GROUP BY database_id`;

            const tableSizeQuery = `
              SELECT
                t.name AS table_name,
                SUM(p.rows) AS row_count,
                SUM(a.total_pages) * 8 / 1024 AS total_size_KB
              FROM sys.tables t
              INNER JOIN sys.indexes i ON t.object_id = i.object_id
              INNER JOIN sys.partitions p ON i.object_id = p.object_id
              INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
              WHERE t.is_ms_shipped = 0 AND i.type <= 1
              GROUP BY t.name`;

            const dbSize = await this.vehiclesRepository.query(databaseSizeQuery);
            const tableSize = await this.vehiclesRepository.query(tableSizeQuery);
            return { dbSize, tableSize };
        } catch (error) {
            console.error('⚠️ Error al obtener estadísticas de base de datos:', error.message);
            return { dbSize: [], tableSize: [], error: error.message };
        }
    }

    async getInvalidShipmentsCount(): Promise<number> {
        try {
            return await this.invalidatedShipmentsRepository.count();
        } catch (error) {
            console.error('⚠️ Error al contar envíos invalidados:', error.message);
            return 0;
        }
    }

    async getAllShipmentsCount(): Promise<number> {
        try {
            return await this.shipmentsRepository.count();
        } catch (error) {
            console.error('⚠️ Error al contar todos los envíos:', error.message);
            return 0;
        }
    }

    async getShipmentsCountByStatus(): Promise<any> {
        const counts = {};

        for (let status = 1; status <= 12; status++) {
            try {
                const count = await this.shipmentsRepository.count({
                    where: { currentStatus: status },
                });
                counts[`status_${status}`] = count;
            } catch (error) {
                console.error(`⚠️ Error al contar envíos con status ${status}:`, error.message);
                counts[`status_${status}`] = 0;
            }
        }

        return counts;
    }

    async getVehicleCountsByTruckType(): Promise<any> {
        try {
            const query = `
              SELECT truck_type, COUNT(*) AS count
              FROM Vehicles
              GROUP BY truck_type
            `;
            const result = await this.vehiclesRepository.query(query);
            const counts = result.reduce((acc, row) => {
                acc[row.truck_type] = row.count;
                return acc;
            }, {});

            return counts;
        } catch (error) {
            console.error('⚠️ Error al contar vehículos por tipo:', error.message);
            return {};
        }
    }

    async getConnectionInfo(): Promise<any> {
        const connectionInfo = {
            system: this.dataSource.options.database,
            isConnected: this.dataSource.isInitialized,
            server: this.getServerInfo(),
            database: this.dataSource.options.database,
            connectionState: this.dataSource.isInitialized ? "Open" : "Closed",
        };
        return connectionInfo;
    }

    private getServerInfo(): string {
        return this.dataSource.options.type === 'mssql' ?
            this.dataSource.options.host : 'Unknown database type';
    }

    private validateSystemIntegrityCheck(
        ApiMainSystemInformation: any,
        ApiMiddleWareSystemInformation: any
    ): any {
        const resumenControlSystem = {
            apiMainToDbConnectionStatus: ApiMainSystemInformation?.connectionInfo?.isConnected ?? false,
            middlewareMonitoringSystemnStatus: ApiMiddleWareSystemInformation?.monitoringSystem?.monitoringStatus?.isServiceRunning ?? false,
            middlewareNavToDbConnectionStatus: ApiMiddleWareSystemInformation?.navSystem?.connectionInfo?.isConnected ?? false,
            middlewareLeveransPretrassacionesToDbConnectionStatus: ApiMiddleWareSystemInformation?.leveransPretrassacionesSystem?.connectionInfo?.isConnected ?? false,
            middlewareToApiMainConnectivity: ApiMiddleWareSystemInformation?.apiMainSystem?.connectivityBool ?? false,
            middlewareToApiMainJwtValidity: ApiMiddleWareSystemInformation?.apiMainSystem?.jwtConnectivityInfo?.valid ?? false,
            systemIntegrityCheck: false
        };

        resumenControlSystem.systemIntegrityCheck = Object.entries(resumenControlSystem)
            .filter(([key]) => key !== 'systemIntegrityCheck')
            .every(([, value]) => value === true);

        return resumenControlSystem;
    }

    // Método que devuelve toda la información del sistema
    async getFullSystemInfo(): Promise<any> {
        const databaseStats = await this.getDatabaseStats();
        const invalidShipmentsCount = await this.getInvalidShipmentsCount();
        const shipmentsCountByStatus = await this.getShipmentsCountByStatus();
        const shipmentsCountAll = await this.getAllShipmentsCount();
        const vehicleCountsByTruckType = await this.getVehicleCountsByTruckType();
        const connectionInfo = await this.getConnectionInfo();
        const osInfo = await this.getSystemOSInfo();
        const nestJsInfo = await this.getNestJSInfo();
        const ApiMainSystemInformation = {
            databaseStats,
            connectionInfo,
            invalidShipmentsCount,
            shipmentsCountAll,
            shipmentsCountByStatus,
            vehicleCountsByTruckType,
            osInfo,
            nestJsInfo
        };
        const ApiMiddleWareSystemInformation =
            await this.getSystemControlInformationApiMiddleWare();

        const SystemIntegrityCheck = this.validateSystemIntegrityCheck(
            ApiMainSystemInformation,
            ApiMiddleWareSystemInformation
        );



        return {
            SystemIntegrityCheck,
            ApiMainSystemInformation,
            ApiMiddleWareSystemInformation
        };
    }

    async getSystemOSInfo(): Promise<any> {
        return {
            platform: os.platform(),
            arch: os.arch(),
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            cpus: os.cpus(),
            uptime: os.uptime(),
            hostname: os.hostname(),
            release: os.release(),
        };
    }

    async getNestJSInfo(): Promise<any> {
        const routes = this.getRoutes();
        const version = process.env.npm_package_version;
        return {
            routes,
            nestjsVersion: version,
        };
    }

    getRoutes() {
        const controllers = this.discoveryService.getControllers();
        const routes = controllers.map((wrapper) => {
            const { instance } = wrapper;
            const prototype = Object.getPrototypeOf(instance);
            const methods = Object.getOwnPropertyNames(prototype).filter(
                (method) => method !== 'constructor'
            );

            return methods.map((method) => {
                const route = this.reflector.get('path', prototype[method]);
                const requestMethod = this.reflector.get('method', prototype[method]);
                const paramsMetadata = this.reflector.get('parameters', prototype[method]) || [];
                const returnType = Reflect.getMetadata('design:returntype', prototype, method);
                const httpMethods = Object.keys(RequestMethod).filter(
                    (key) => isNaN(Number(key))
                );
                const methodText = httpMethods[requestMethod] || 'UNKNOWN';
                const parameters = Object.keys(paramsMetadata).map((key) => {
                    const param = paramsMetadata[key];
                    return {
                        index: key,
                        type: param.type,
                        name: param.data,
                        source: param.param,
                    };
                });

                // Formatear el resultado
                return {
                    controller: instance.constructor.name,
                    method,
                    route,
                    requestMethod: methodText,
                    parameters,
                    returnType: returnType?.name || 'void',
                };
            });
        });

        return routes.flat();
    }



}

import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Shipments } from 'src/models/Shipments';
import { LogSysType } from 'src/modules/logs/enums/typeSysLogs.enum';
import { LogsSystemService } from 'src/modules/logs/services/logs-system.service';
import { PreTransactionsLeveransService } from 'src/modules/pre-transactions-leverans/services/pre-transactions-leverans.service';
import { ShipmentsService } from 'src/modules/shipments/services/shipments.service';
import { StatusService } from 'src/modules/status/services/status.service';
import { HttpManager } from 'src/utils/HttpManager';

@Injectable()
export class NavService {
    constructor(
        private readonly httpManager: HttpManager,

        @Inject(forwardRef(() => ShipmentsService))
        private readonly shipmentsService: ShipmentsService,

        private readonly logsSystemService: LogsSystemService,

        @Inject(forwardRef(() => StatusService))
        private readonly statusService: StatusService,

        private readonly preTransactionsLeveransService: PreTransactionsLeveransService,

    ) { }

    async push(codeGen: string): Promise<Shipments | null | any> {
        console.log("Insertando registro en nav");
        const shipment: Shipments = await this.shipmentsService.findAllRecordByCodeGen(codeGen);
        const response = await this.httpManager.post<ApiResponseNavCreate>(
            this.getCreateShipmentUrl(),
            shipment
        );
        const recordNavId = response.newRecord.id;
        console.log("ID del nuevo registro en nav: ", recordNavId);
        await this.shipmentsService.setIdNavRecord(codeGen, recordNavId);
        return response;
    }


    async updateMagneticCardInNavAndLeveransPretrassacionts(shipment: Shipments) {
        const response = await this.httpManager.post(
            this.getUpdateMagneticCardEndpoint(),
            shipment
        );
        console.log("Este fue la response al actualizar la tarjeta magnetica: ", response);
    }


    async updatePesoClienteNav(shipment: Shipments) {
        const response = await this.httpManager.put(
            this.getUpdatePesoClienteUrl(),
            shipment
        );
        return response;
    }


    async get(
        codeGen: string,
        forClients: boolean,
        getFromPage: 'first' | 'last' = 'first',
        getFromCollection: 'first' | 'last' = 'first'
    ): Promise<any> {

        const shipment = await this.shipmentsService.getShipmentByCodeNullable(codeGen);
        const url = this.getFindRecordsUrl();
        const params = {
            modelName: this.getModelShipmentNav(),
            id: shipment.idNavRecord,
            columnName: 'Id',
            page: 1,
            pageSize: 100
        };

        const response = await this.httpManager.get<ApiResponse>(url, { params });

        let selectedRecord: NavRecord;

        // Selección del registro dependiendo de getFromPage y getFromCollection
        if (getFromPage === 'first') {
            selectedRecord = response.records[0];
        } else if (getFromPage === 'last') {
            selectedRecord = response.records[response.records.length - 1];
        }

        if (getFromCollection === 'first') {
            selectedRecord = response.records[0];
        } else if (getFromCollection === 'last') {
            selectedRecord = response.records[response.records.length - 1];
        }

        // Si forClients es true, realizar el mapeo
        if (forClients) {
            const {
                pesoneto, ticket, pesoin, pesoout, marchamo1, marchamo2, marchamo3, marchamo4
            } = selectedRecord || {};

            const mappedRecord = {
                pesoalmapac: pesoneto ?? null,
                comprobanteBascula: ticket ?? null,
                pesobrutoALMAPAC: pesoin ?? null,
                pesotaraALMAPAC: pesoout ?? null,
                marchamos_almapac: selectedRecord
                    ? [marchamo1, marchamo2, marchamo3, marchamo4].filter(Boolean)
                    : []
            };

            return mappedRecord;
        }

        // Si no, devolver el registro seleccionado tal cual
        return selectedRecord;
    }


    async handleStatusChange(
        idTransaccionNav: string,
        codeGen: string,
        newStatusNav: string,
        changeDate: string
    ): Promise<{ message: string }> {
        const shipment = await this.shipmentsService.getShipmentByCodeNullable(codeGen);

        if (shipment === null) {
            await this.logsSystemService.createLog(
                LogSysType.NAV_UNKNOWN_TRANSACTION_NOTIFICATION,
                `${idTransaccionNav},${codeGen},${newStatusNav},${changeDate}`
            );
            throw new NotFoundException("La transacción no existe en la API principal");
        }

        // Configuración unificada de estados permitidos y prohibidos
        const statusConfig: Record<string, { allowed: number[]; forbidden: number[] }> = {
            "1": { allowed: [6, 7], forbidden: [10, 11, 12] },
            "2": { allowed: [6, 7, 10, 11], forbidden: [12] },
            "3": { allowed: [6, 7, 10, 11, 12], forbidden: [] },
            "0": { allowed: [], forbidden: [6, 7, 10, 11, 12] }
        };

        // Validar si el nuevo estado es válido
        if (!statusConfig.hasOwnProperty(newStatusNav)) {
            await this.logsSystemService.createLog(
                LogSysType.NAV_UNKNOWN_TRANSACTION_NOTIFICATION_STATUS,
                `${idTransaccionNav},${codeGen},${newStatusNav},${changeDate}`
            );
            throw new BadRequestException("Se está tratando de cambiar a un status desconocido");
        }

        const { allowed, forbidden } = statusConfig[newStatusNav];

        // Eliminar estados prohibidos si existen
        await this.removeForbiddenStatuses(codeGen, forbidden);
        const existingStatuses = await this.statusService.getStatusesForShipment(codeGen);
        const statusesToInsert = allowed.filter(status => !existingStatuses.includes(status));
        if (statusesToInsert.length > 0) {
            await this.statusService.updateStatusesForShipment(codeGen, statusesToInsert);
        }
        const leveransStatus = this.getLeveransStatus(newStatusNav);
        await this.preTransactionsLeveransService.updateStatusLeveransRecord(codeGen, leveransStatus);

        return { message: this.getStatusMessage(newStatusNav) };
    }

    // Función para eliminar estados que no deberían existir
    private async removeForbiddenStatuses(codeGen: string, statusesToRemove: number[]) {
        for (const status of statusesToRemove) {
            if (await this.statusService.statusExistsForShipment(codeGen, status)) {
                await this.statusService.removeStatusFromShipmentByPredefined(codeGen, status);
            }
        }
    }

    // Función para obtener el estado de leverans correspondiente
    private getLeveransStatus(status: string): number {
        return {
            "1": 4,
            "2": 4,
            "3": 5,
            "0": 2
        }[status] ?? 2;
    }

    // Función para obtener el mensaje de respuesta
    private getStatusMessage(status: string): string {
        return {
            "1": "Se cambió el estado de la pluma para apertura (entrada).",
            "2": "Se cambió el estado de la pluma para cierre (salida).",
            "3": "La transacción finalizó.",
            "0": "La transacción ha sido reiniciada."
        }[status] ?? "Estado actualizado.";
    }



    /* 
        SERVER_MIDDLEWARE_NAME=http://localhost:5063/api/
        SERVER_MIDDLEWARE_CREATE=shipment/create-shipment/
        SERVER_MIDDLEWARE_GET=model/findRecords
    */

    private getBaseUrl(): string {
        if (process.env.SERVER_MIDDLEWARE_NAME) {
            return process.env.SERVER_MIDDLEWARE_NAME;
        }
        throw new BadRequestException("Lo sentimos, el programa no esta funcionando actualmente.");
    }

    private getCreateShipmentUrl(): string {
        return `${this.getBaseUrl()}${process.env.SERVER_MIDDLEWARE_CREATE || 'shipment/create-shipment/'}`;
    }

    private getFindRecordsUrl(): string {
        return `${this.getBaseUrl()}${process.env.SERVER_MIDDLEWARE_GET || 'model/findRecords'}`;
    }
    // SERVER_MIDDLEWARE_UPDATE_MAGNETIC_CARD

    private getUpdateMagneticCardEndpoint(): string {
        return `${this.getBaseUrl()}${process.env.SERVER_MIDDLEWARE_UPDATE_MAGNETIC_CARD || 'shipment/update-magnetic-card-nav-leverans/'}`;
    }

    private getUpdatePesoClienteUrl(): string {
        return `${this.getBaseUrl()}${process.env.SERVER_MIDDLEWARE_UPDATE_PESO_CLIENTE || 'shipment/update-pesocliente/'}`;
    }


    private getModelShipmentNav(): string {
        return "Almapac3plRegistroInterface";
    }
}

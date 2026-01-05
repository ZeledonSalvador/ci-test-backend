import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Shipments } from 'src/models/Shipments';
import { LogSysType } from 'src/modules/logs/enums/typeSysLogs.enum';
import { LogsSystemService } from 'src/modules/logs/services/logs-system.service';
import { ShipmentsService } from 'src/modules/shipments/services/shipments.service';
import { HttpManager } from 'src/utils/HttpManager';

@Injectable()
export class PreTransactionsLeveransService {


    constructor(
        private readonly httpManager: HttpManager,

        @Inject(forwardRef(() => ShipmentsService))
        private readonly shipmentsService: ShipmentsService,

        private readonly logsSystemService: LogsSystemService

    ) { }

    async push(codeGen: string): Promise<Shipments | null | any> {
        console.log("Insertando registro en Leverans");
        const shipment: Shipments = await this.shipmentsService.findAllRecordByCodeGen(codeGen);
        const response = await this.httpManager.post<LeveransResponse>(
            this.getCreateShipmentUrl(),
            shipment
        );
        const idPreTransaccionLeverans = response.data.pkPreTransaccion;
        await this.shipmentsService.setIdPreTransaccionLeverans(
            shipment.codeGen, idPreTransaccionLeverans
        );
        return response;
    }

    async updateStatusLeveransRecord(codeGen: string, newStatus: number): Promise<boolean> {
        try {
            const shipment = await this.shipmentsService.findAllRecordByCodeGen(codeGen);
            const response = await this.httpManager.put(
                this.getUpdateTrasactionStatusLeverans(),
                {
                    newStatus: newStatus,
                    shipment: shipment
                }
            );

            if (response.status >= 200 && response.status < 300) {
                return true;
            } else {
                await this.logsSystemService.createLog(
                    LogSysType.LEVERANS_ERROR_RECORD_UPDATE_STATUS,
                    `Error en actualización: Código de estado ${response.status}`
                );

                return false;
            }
        } catch (error) {
            await this.logsSystemService.createLog(
                LogSysType.LEVERANS_ERROR_RECORD_UPDATE_STATUS,
                error.response?.data?.message || error.message
            );

            return false;
        }
    }




    private getBaseUrl(): string {
        return process.env.SERVER_MIDDLEWARE_NAME || 'http://localhost:5063/api/';
    }

    getCreateShipmentUrl(): string {
        return `${this.getBaseUrl()}${process.env.SERVER_MIDDLEWARE_CREATE_LEVERANS || 'shipment/save-pre-transaction-leverans/'}`;
    }

    private getUpdateTrasactionStatusLeverans() {
        return `${this.getBaseUrl()}${process.env.SERVER_MIDDLEWARE_UPDATE_STATUS_LEVERANS || 'shipment/update-shipment-status-leverans/'}`;
    }

}

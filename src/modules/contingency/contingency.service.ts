import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { ContingencyTransactions } from 'src/models/ContingencyTransactions';
import { Cron } from '@nestjs/schedule';
import { Shipments } from 'src/models/Shipments';

@Injectable()
export class ContingencyService {
    constructor(
        @InjectRepository(ContingencyTransactions)
        private readonly repo: Repository<ContingencyTransactions>,

        @InjectRepository(Shipments)
        private readonly shipmentRepo: Repository<Shipments>,
    ) {}

    /**
     * Registra una falla en la tabla de contingencias.
     * Usamos la columna 'payload' para guardar el detalle del error.
     */
    async registerFailure(codeGen: string, statusId: number, payload: any, error: string) {
        const messageToSave = error || (payload ? JSON.stringify(payload) : null);

        await this.repo.save({
            codeGen,
            statusId,
            errorMessage: messageToSave ?? null, // se mapea a la columna 'payload'
        });
    }

    async resendPending() {
        const pendings = await this.repo.find({ where: { isResolved: false } });
        if (!pendings.length) {
            return;
        }

        for (const trx of pendings) {
            try {
                const base =
                    process.env.SERVER_EXCALIBUR_NAME || 'http://localhost:5077/api/quickpass';
                const endpoint = `${base.replace(/\/$/, '')}/receipt/${encodeURIComponent(
                    trx.codeGen,
                )}/send`;

                const res = await axios.post(endpoint, null, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 20000, // por ejemplo 20s, puedes ajustarlo
                });

                let documentCode: string | undefined = res.data?.document_code;

                // Fallback: si no viene directo, intentar extraer del wsResponse (SOAP)
                if (!documentCode && typeof res.data?.wsResponse === 'string') {
                    const m = res.data.wsResponse.match(/<return_value>([^<]+)<\/return_value>/i);
                    if (m) documentCode = m[1]?.trim();
                }

                if (res.status >= 200 && res.status < 300 && documentCode) {
                    // 1️⃣ Actualiza shipment con id_excalibur
                    await this.shipmentRepo.update(
                        { codeGen: trx.codeGen },
                        { idExcalibur: documentCode },
                    );

                    // 2️⃣ Marca la contingencia como resuelta
                    await this.repo.update(trx.id, {
                        isResolved: true,
                        retryCount: (trx.retryCount ?? 0) + 1,
                        lastTry: new Date(),
                        errorMessage: null, // limpiamos el error (columna 'payload')
                    });
                } else {
                    // Respuesta no exitosa pero sin lanzar excepción
                    let body = '';
                    try {
                        body = JSON.stringify(res.data);
                    } catch {
                        body = String(res.data);
                    }
                    if (body.length > 500) {
                        body = body.slice(0, 500) + '...';
                    }

                    const details = `Respuesta no exitosa del middleware: status=${res.status} body=${body}`;

                    await this.repo.update(trx.id, {
                        retryCount: (trx.retryCount ?? 0) + 1,
                        lastTry: new Date(),
                        errorMessage: details, // se guarda en 'payload'
                    });
                }
            } catch (e: any) {
                const details = this.formatAxiosError(e);

                await this.repo.update(trx.id, {
                    retryCount: (trx.retryCount ?? 0) + 1,
                    lastTry: new Date(),
                    errorMessage: details, // se guarda en 'payload'
                });
            }
        }
    }

    // ⏰ Ejecución automática cada minuto
    @Cron('* * * * *')
    async handleRetry() {
        try {
            await this.resendPending();
        } catch (error: any) {
            // No lanzamos el error para que el cron continúe ejecutándose
        }
    }

    private formatAxiosError(error: any): string {
        const isAxiosError = !!error?.isAxiosError;

        if (isAxiosError) {
            const status = error?.response?.status;
            const statusText = error?.response?.statusText;
            const data = error?.response?.data;

            const parts: string[] = [];

            // Mensaje base de Axios
            parts.push(error.message || 'Axios error');

            // Status HTTP
            if (status) {
                parts.push(`status=${status}${statusText ? ' ' + statusText : ''}`);
            }

            // Cuerpo de la respuesta
            if (data !== undefined) {
                let body: string;
                if (typeof data === 'string') {
                    body = data;
                } else {
                    try {
                        body = JSON.stringify(data);
                    } catch {
                        body = String(data);
                    }
                }

                if (body.length > 500) {
                    body = body.slice(0, 500) + '...';
                }

                parts.push(`body=${body}`);
            }

            return parts.join(' | ');
        }

        return error?.message || String(error);
    }
}

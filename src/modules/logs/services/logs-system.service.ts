import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SysLogs } from 'src/models/SysLogs';
import { LogSysType } from '../enums/typeSysLogs.enum';

@Injectable()
export class LogsSystemService {
    constructor(
        @InjectRepository(SysLogs)
        private readonly sysLogs: Repository<SysLogs>,
    ) { }

    async createLog(logType: LogSysType, logText: string): Promise<SysLogs> {
        const newLog = this.sysLogs.create({ logType, logText });
        const savedLog = await this.sysLogs.save(newLog);

        console.log(`[${new Date().toLocaleString()}] [${logType}] ${logText}`);

        return savedLog;
    }

    async getAllLogs(): Promise<SysLogs[]> {
        return await this.sysLogs.find();
    }

    async getLogsByType(logType: LogSysType): Promise<SysLogs[]> {
        return await this.sysLogs.find({ where: { logType } });
    }

    async getLogById(id: number): Promise<SysLogs> {
        return await this.sysLogs.findOneOrFail({ where: { id } });
    }

    async updateLog(
        id: number,
        updatedData: Partial<Omit<SysLogs, 'id' | 'createdAt'>>,
    ): Promise<SysLogs> {
        const log = await this.getLogById(id);
        Object.assign(log, updatedData, { updatedAt: new Date() });
        return await this.sysLogs.save(log);
    }

    async deleteLog(id: number): Promise<void> {
        const log = await this.getLogById(id);
        await this.sysLogs.remove(log);
    }

    async countLogsByType(logType: LogSysType): Promise<number> {
        return await this.sysLogs.count({ where: { logType } });
    }

    /**
     * Registra un error no capturado (uncaughtException)
     */
    async logUncaughtException(error: Error): Promise<void> {
        try {
            const logText = JSON.stringify({
                message: error.message,
                stack: error.stack,
                name: error.name,
                timestamp: new Date().toISOString(),
            });

            await this.createLog(LogSysType.UNCAUGHT_EXCEPTION, logText);
        } catch (logError) {
            // Si falla el log en BD, solo mostramos en consola para no crashear
            console.error('❌ Error al guardar uncaughtException en BD:', logError);
        }
    }

    /**
     * Registra una promesa rechazada no manejada (unhandledRejection)
     */
    async logUnhandledRejection(reason: any, promise: Promise<any>): Promise<void> {
        try {
            const logText = JSON.stringify({
                reason: reason instanceof Error ? {
                    message: reason.message,
                    stack: reason.stack,
                    name: reason.name,
                } : String(reason),
                promiseString: String(promise),
                timestamp: new Date().toISOString(),
            });

            await this.createLog(LogSysType.UNHANDLED_REJECTION, logText);
        } catch (logError) {
            // Si falla el log en BD, solo mostramos en consola para no crashear
            console.error('❌ Error al guardar unhandledRejection en BD:', logError);
        }
    }
}

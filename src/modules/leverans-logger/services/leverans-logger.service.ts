import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoggerActionLeverans } from '../enums/LoggerActionsLeverans.enum';
import { Shipments } from 'src/models/Shipments';
import { LeveransUsers } from 'src/models/LeveransUsers';
import { LeveransUserLoginHistory } from 'src/models/LeveransUserLoginHistory';
import { LeveransLogger } from 'src/models/LeveransLogger';
import { PredefinedStatuses } from 'src/models/PredefinedStatuses';

@Injectable()
export class LeveransLoggerService {
    constructor(
        @InjectRepository(LeveransUsers)
        private readonly leveransUsersRepository: Repository<LeveransUsers>,
        @InjectRepository(LeveransUserLoginHistory)
        private readonly leveransUserLoginHistoryRepository: Repository<LeveransUserLoginHistory>,
        @InjectRepository(LeveransLogger)
        private readonly loggerRepository: Repository<LeveransLogger>,
        @InjectRepository(PredefinedStatuses)
        private readonly predefinedStatusesRepository: Repository<PredefinedStatuses>,
        @InjectRepository(Shipments)
        private readonly shipmentsRepository: Repository<Shipments>,
    ) { }


    /**
     * Login function: Creates or retrieves a user and logs their login history.
     * @param leveransUsername - leveransUsername of the user.
     * @param usercode - User code of the user.
     * @param shift - Shift during login.
     */
    async login(
        leveransUsername: string,
        basucula: string,
        shift: string
    ): Promise<LeveransUserLoginHistory> {
        // Check if the user exists
        let user = await this.leveransUsersRepository.findOne(
            { where: { username: leveransUsername } }
        );

        if (!user) {
            // If user does not exist, create it
            user = this.leveransUsersRepository.create({ username: leveransUsername });
            user = await this.leveransUsersRepository.save(user);
        }

        // Create a login history entry
        const loginHistory = this.leveransUserLoginHistoryRepository.create({
            leveransUser: user,
            bascula: basucula,
            shift,
        });

        return await this.leveransUserLoginHistoryRepository.save(loginHistory);
    }

    /**
     * Logger Update Status: Creates a log entry for a user's shipment and status update.
     * @param userId - ID of the user performing the action.
     * @param shipmentId - ID of the shipment.
     * @param statusId - ID of the new status.
     * @param action - Action description (optional).
     */
    async loggerUpdateStatusByUserLeveransId(
        userId: number,
        shipmentId: number,
        statusId: number,
        action: LoggerActionLeverans = LoggerActionLeverans.UPDATE_STATUS,
    ): Promise<LeveransLogger> {
        const user = await this.leveransUsersRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('El Usuario Leverans no fue encontrado');
        }

        const shipment = await this.shipmentsRepository.findOne({ where: { id: shipmentId } });
        if (!shipment) {
            throw new NotFoundException('No se encontró la transacción al registrar en Logger Leverans');
        }

        console.log("El status id es: ", statusId);

        const status = await this.predefinedStatusesRepository.findOne(
            {
                where: { id: statusId }
            }
        );

        console.log("Esto respondio: ", status);
        if (!status) {
            throw new NotFoundException('El estatus no existe');
        }

        // Find the oldest login history for the user
        const loginHistory = await this.leveransUserLoginHistoryRepository.findOne({
            where: { leveransUser: user },
            order: { createdAt: 'ASC' }, // Order by the oldest login
        });
        if (!loginHistory) {
            throw new NotFoundException('No se encontró historial de inicio de sesión para el usuario');
        }

        // Create a log entry
        const logger = this.loggerRepository.create({
            leveransUser: user,
            shipment,
            predefinedStatuses : status,
            action,
            loginHistory, // Add the oldest login history
        });

        return await this.loggerRepository.save(logger);
    }


    async loggerDeleteByLeveransLogger(
        leveransLogger: LeveransLogger,
    ): Promise<void> {
        if (!leveransLogger) {
            throw new BadRequestException('El objeto LeveransLogger no fue proporcionado');
        }

        const existingLogger = await this.loggerRepository.findOne({
            where: { id: leveransLogger.id },
        });
        if (!existingLogger) {
            throw new NotFoundException('El registro LeveransLogger no existe en la base de datos');
        }

        await this.loggerRepository.remove(existingLogger);
    }



    async loggerUpdateStatusByUsernameLeverans(
        username: string,
        shipmentId: number,
        statusId: number,
        action: LoggerActionLeverans = LoggerActionLeverans.UPDATE_STATUS,
    ): Promise<LeveransLogger> {
        const user = await this.leveransUsersRepository.findOne({ where: { username } });
        if (!user) {
            throw new NotFoundException('El Usuario Leverans no fue encontrado por username');
        }

        return await this.loggerUpdateStatusByUserLeveransId(
            user.id, shipmentId, statusId, action
        );
    }

}

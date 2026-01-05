import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { NavService } from '../services/nav.service';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { Role } from 'src/modules/auth/enums/roles.enum';
import { ShipmentsService } from 'src/modules/shipments/services/shipments.service';

@Controller({ path: 'nav', version: '1' })
@UseGuards(AuthGuard)
export class NavController {
  constructor(
    private readonly navService: NavService,
    // 👇 inyectamos ShipmentsService
    private readonly shipmentsService: ShipmentsService,
  ) {}

  @Roles(Role.BOT, Role.ADMIN)
  @Post('status-change')
  async notifyStatusChange(
    @Body()
    payload: {
      idTransaccionNav: string; // ID único de la transacción
      codeGen: string;          // Código de generación
      status: string;           // Nuevo estado (NAV)
      changeDate: string;       // Fecha del cambio
    },
  ): Promise<{ message: string; record?: any; weights?: any }> {
    // 1) Lógica actual: cambio de estado
    const record = await this.navService.handleStatusChange(
      payload.idTransaccionNav,
      payload.codeGen,
      payload.status,
      payload.changeDate,
    );

    // 2) NUEVO: registrar pesos automáticamente
    let weightsResult: any = null;
    try {
      const navStatusNumber = Number(payload.status); // "1", "12" → 1, 12

      if (!Number.isNaN(navStatusNumber)) {
        weightsResult = await this.shipmentsService.registrarPesos(
          payload.codeGen,
          navStatusNumber,
        );
      } else {
        console.warn(
          `[NAV STATUS CHANGE] status no numérico, no se intentó registrar pesos. status = ${payload.status}`,
        );
      }
    } catch (error: any) {
      console.error(
        `[NAV STATUS CHANGE] Error registrando pesos para codeGen ${payload.codeGen}`,
        error?.message ?? error,
      );
    }

    // 3) Respuesta
    return {
      message: 'Cambio de estado recibido correctamente',
      record,
      weights: weightsResult, // opcional, útil para debug
    };
  }
}

import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { Role } from 'src/modules/auth/enums/roles.enum';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';

@Controller('dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /dashboard/resumen-estatus?start=2025-08-01T00:00:00&end=2025-08-26T00:00:00&product=MEL-001&ingenioId=ING-12
   * - Rango [start, end) (end EXCLUSIVO)
   * - Filtros opcionales: product (Shipments.product), ingenioId (Shipments.ingenio_id)
   * - Valida existencia de product/ingenioId; si no existen => 400
   * - Respuesta incluye Producto, Ingenio y Rango
   */
  @Get('resumen-estatus')
  @Roles(Role.ADMIN, Role.BOT)
  async getResumenEstatus(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('product') product?: string,
    @Query('ingenioId') ingenioId?: string,
    @Query('ingenioid') ingenioIdLower?: string, // aceptamos variante en minúsculas
  ) {
    if (!start || !end)
      throw new BadRequestException('start y end son requeridos (ISO).');

    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('start o end inválidos.');
    }
    if (startDate >= endDate) {
      throw new BadRequestException('start debe ser < end (end es exclusivo).');
    }

    // normaliza strings vacíos
    const productNorm = product?.trim() || undefined;
    const ingenioNorm = (ingenioId ?? ingenioIdLower)?.trim() || undefined;

    // validación de formato básico (alfanumérico, punto, guion, guion bajo, 1-64)
    const safe = /^[A-Za-z0-9._-]{1,64}$/;
    if (productNorm && !safe.test(productNorm)) {
      throw new BadRequestException('product contiene caracteres inválidos.');
    }
    if (ingenioNorm && !safe.test(ingenioNorm)) {
      throw new BadRequestException('ingenioId contiene caracteres inválidos.');
    }

    return this.dashboardService.getResumenTodosLosEstatus(
      startDate,
      endDate,
      productNorm,
      ingenioNorm,
    );
  }

  // dashboard.controller.ts
  @Get('resumen-hoy')
  @Roles(Role.ADMIN, Role.BOT)
  async getResumenHoy(
    @Query('product') product?: string,
    @Query('ingenioId') ingenioId?: string,
    @Query('ingenioid') ingenioIdLower?: string,
    @Query('hourFrom') hourFrom?: string, // nuevo: "HH:mm" o "H"
    @Query('hourTo') hourTo?: string, // nuevo: "HH:mm" o "H"
  ) {
    const productNorm = product?.trim() || undefined;
    const ingenioNorm = (ingenioId ?? ingenioIdLower)?.trim() || undefined;

    // normaliza "9" -> "09:00"
    const toHHmm = (s?: string) =>
      s && /^\d{1,2}$/.test(s) ? `${s.padStart(2, '0')}:00` : s;

    return this.dashboardService.getResumenHoyPorHora(
      productNorm,
      ingenioNorm,
      toHHmm(hourFrom),
      toHHmm(hourTo),
    );
  }

  @Get('promedios-atencion')
  @Roles(Role.ADMIN, Role.BOT)
  async getPromediosAtencion(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('product') product?: string,
    @Query('ingenioId') ingenioId?: string,
    @Query('ingenioid') ingenioIdLower?: string, // variante
  ) {
    const productNorm = product?.trim() || undefined;
    const ingenioNorm = (ingenioId ?? ingenioIdLower)?.trim() || undefined;

    // Validación basiquita de formato (opcional)
    const safe = /^[A-Za-z0-9._-]{0,64}$/;
    if (productNorm && !safe.test(productNorm))
      throw new BadRequestException('product contiene caracteres inválidos.');
    if (ingenioNorm && !safe.test(ingenioNorm))
      throw new BadRequestException('ingenioId contiene caracteres inválidos.');

    // Parseo de fechas (todas opcionales)
    const startDate = start ? new Date(start) : undefined;
    const endDate = end ? new Date(end) : undefined;

    if (start && isNaN(startDate!.getTime()))
      throw new BadRequestException('start inválido.');
    if (end && isNaN(endDate!.getTime()))
      throw new BadRequestException('end inválido.');
    if (startDate && endDate && startDate >= endDate) {
      throw new BadRequestException('start debe ser < end (end es exclusivo).');
    }

    return this.dashboardService.getPromediosAtencion(
      startDate,
      endDate,
      productNorm,
      ingenioNorm,
    );
  }

  @Get('promedios-atencion-hoy')
  @Roles(Role.ADMIN, Role.BOT)
  async getPromediosAtencionHoy(
    @Query('product') product?: string,
    @Query('ingenioId') ingenioId?: string,
    @Query('ingenioid') ingenioIdLower?: string,
  ) {
    const productNorm = product?.trim() || undefined;
    const ingenioNorm = (ingenioId ?? ingenioIdLower)?.trim() || undefined;

    const safe = /^[A-Za-z0-9._-]{0,64}$/;
    if (productNorm && !safe.test(productNorm))
      throw new BadRequestException('product contiene caracteres inválidos.');
    if (ingenioNorm && !safe.test(ingenioNorm))
      throw new BadRequestException('ingenioId contiene caracteres inválidos.');

    // ⬇️ Nuevo nombre del método en el service
    return this.dashboardService.getPromediosAtencionDelDia(
      productNorm,
      ingenioNorm,
    );
  }

  @Get('promedio-descarga-historico')
  @Roles(Role.ADMIN, Role.BOT)
  async getPromedioDescargaHistorico(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('product') product?: string, // ShipmentsTimes.operation_type
    @Query('ingenioId') ingenioId?: string, // Shipments.ingenio_id
    @Query('ingenioid') ingenioIdAlt?: string,
  ) {
    const s = start ? new Date(start) : undefined;
    const e = end ? new Date(end) : undefined;
    if (start && isNaN(s!.getTime()))
      throw new BadRequestException('start inválido.');
    if (end && isNaN(e!.getTime()))
      throw new BadRequestException('end inválido.');
    if (s && e && s >= e)
      throw new BadRequestException('start debe ser < end (end es exclusivo).');

    return this.dashboardService.getPromedioDescargaHistorico(
      s,
      e,
      product?.trim() || undefined,
      (ingenioId ?? ingenioIdAlt)?.trim() || undefined,
    );
  }

  @Get('promedio-descarga-hoy')
  @Roles(Role.ADMIN, Role.BOT)
  async getPromedioDescargaHoy(
    @Query('product') product?: string,
    @Query('ingenioId') ingenioId?: string,
    @Query('ingenioid') ingenioIdAlt?: string,
  ) {
    const productNorm = product?.trim() || undefined;
    const ingenioNorm = (ingenioId ?? ingenioIdAlt)?.trim() || undefined;

    // Sanitizado básico opcional
    const safe = /^[A-Za-z0-9._-]{0,64}$/;
    if (productNorm && !safe.test(productNorm))
      throw new BadRequestException('product contiene caracteres inválidos.');
    if (ingenioNorm && !safe.test(ingenioNorm))
      throw new BadRequestException('ingenioId contiene caracteres inválidos.');

    return this.dashboardService.getPromedioDescargaDelDia(
      productNorm,
      ingenioNorm,
    );
  }

  @Get('pesos-por-status')
  @Roles(Role.ADMIN, Role.BOT)
  async getPesosPorStatus(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('product') product?: string,
    @Query('ingenioId') ingenioId?: string,
    @Query('ingenioid') ingenioIdAlt?: string,
    @Query('minStatus') minStatusStr?: string,
  ) {
    const s = start ? new Date(start) : undefined;
    const e = end ? new Date(end) : undefined;
    if (start && isNaN(s!.getTime()))
      throw new BadRequestException('start inválido.');
    if (end && isNaN(e!.getTime()))
      throw new BadRequestException('end inválido.');
    if (s && e && s >= e)
      throw new BadRequestException('start debe ser < end (end es exclusivo).');

    const minStatus = minStatusStr ? parseInt(minStatusStr, 10) : 9;
    if (!Number.isFinite(minStatus) || minStatus < 0) {
      throw new BadRequestException('minStatus debe ser un entero >= 0.');
    }

    return this.dashboardService.getPesosPorStatusPromedioDiario(
      s,
      e,
      product?.trim() || undefined,
      (ingenioId ?? ingenioIdAlt)?.trim() || undefined,
      minStatus,
    );
  }
  @Get('pesos-por-status-hoy')
  @Roles(Role.ADMIN, Role.BOT)
  async getPesosPorStatusHoy(
    @Query('product') product?: string,
    @Query('ingenioId') ingenioId?: string,
    @Query('ingenioid') ingenioIdAlt?: string,
    @Query('minStatus') minStatusStr?: string,

    // NUEVO:
    @Query('date') dateStr?: string, // YYYY-MM-DD (local), opcional
    @Query('hourFrom') hourFrom?: string, // "H" o "HH:mm"
    @Query('hourTo') hourTo?: string, // "H" o "HH:mm" (inclusivo por hora)
  ) {
    const productNorm = product?.trim() || undefined;
    const ingenioNorm = (ingenioId ?? ingenioIdAlt)?.trim() || undefined;

    const minStatus = minStatusStr ? parseInt(minStatusStr, 10) : 9;
    if (!Number.isFinite(minStatus) || minStatus < 0) {
      throw new BadRequestException('minStatus debe ser un entero >= 0.');
    }

    // --- Normalización de horas ---
    const toHHmm = (s?: string) =>
      s && /^\d{1,2}$/.test(s) ? `${s.padStart(2, '0')}:00` : s;
    const hf = toHHmm(hourFrom);
    const ht = toHHmm(hourTo);

    // --- Construcción del rango local ---
    const base = (() => {
      if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
        const [y, m, d] = dateStr.split('-').map(Number);
        const dt = new Date();
        dt.setFullYear(y, m - 1, d);
        dt.setHours(0, 0, 0, 0);
        return dt;
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    })();

    const fromLocal = new Date(base);
    const toLocal = new Date(base);

    // parse "HH:mm" o "H"
    const parseHHmm = (s?: string) => {
      if (!s) return null;
      const m = /^(\d{1,2})(?::([0-5]\d))?$/.exec(s.trim());
      if (!m)
        throw new BadRequestException(
          'hourFrom/hourTo debe ser "H" o "HH:mm".',
        );
      const h = +m[1],
        mm = +(m[2] ?? 0);
      if (h < 0 || h > 23)
        throw new BadRequestException('Hora fuera de rango (0–23).');
      return { h, m: mm };
    };

    const fromParts = parseHHmm(hf);
    const toParts = parseHHmm(ht);

    if (fromParts) fromLocal.setHours(fromParts.h, fromParts.m, 0, 0);

    if (toParts) {
      // hourTo inclusivo por hora → sumamos 1h y usamos ventana [from, to)
      toLocal.setHours(toParts.h, toParts.m, 0, 0);
      toLocal.setTime(toLocal.getTime() + 60 * 60 * 1000);
    } else if (fromParts) {
      // solo desde → ventana de 60 min
      toLocal.setTime(fromLocal.getTime() + 60 * 60 * 1000);
    } else {
      // día completo
      toLocal.setDate(toLocal.getDate() + 1);
    }

    if (fromLocal >= toLocal) {
      throw new BadRequestException('"hourFrom" debe ser menor que "hourTo".');
    }

    // pasamos fechas tal cual (el driver las serializa a UTC correctamente)
    return this.dashboardService.getPesosPorStatusDelDia(
      productNorm,
      ingenioNorm,
      minStatus,
      fromLocal, // <-- NUEVO
      toLocal, // <-- NUEVO
    );
  }

  @Get('tiempos-hoy-detalle')
  @Roles(Role.ADMIN, Role.BOT)
  async getTiemposHoyDetalle(
    @Query('product') product?: string,
    @Query('ingenioId') ingenioId?: string,
    @Query('ingenioid') ingenioIdAlt?: string,
    @Query('hour') hourStr?: string,
    @Query('hStart') hStartStr?: string,
    @Query('hEnd') hEndStr?: string,
  ) {
    const productNorm = product?.trim() || undefined;
    const ingenioNorm = (ingenioId ?? ingenioIdAlt)?.trim() || undefined;

    const safe = /^[A-Za-z0-9._-]{0,64}$/;
    if (productNorm && !safe.test(productNorm)) {
      throw new BadRequestException('product contiene caracteres inválidos.');
    }
    if (ingenioNorm && !safe.test(ingenioNorm)) {
      throw new BadRequestException('ingenioId contiene caracteres inválidos.');
    }

    const toInt = (v?: string) =>
      v == null || v === '' ? undefined : Number(v);
    let hour = toInt(hourStr);
    let hStart = toInt(hStartStr);
    let hEnd = toInt(hEndStr);

    const inRange = (n: number) => Number.isInteger(n) && n >= 0 && n <= 23;

    if (hour != null) {
      if (!inRange(hour))
        throw new BadRequestException('hour debe estar entre 0 y 23.');
      hStart = hour;
      hEnd = hour;
    } else {
      if (hStart == null && hEnd == null) {
        hStart = 0;
        hEnd = 23;
      } else {
        if (hStart == null) hStart = 0;
        if (hEnd == null) hEnd = 23;
        if (!inRange(hStart) || !inRange(hEnd)) {
          throw new BadRequestException(
            'hStart/hEnd deben estar entre 0 y 23.',
          );
        }
        if (hStart > hEnd) {
          throw new BadRequestException('hStart debe ser <= hEnd.');
        }
      }
    }

    return this.dashboardService.getTiemposDelDiaDetallado(
      productNorm,
      ingenioNorm,
      hStart!,
      hEnd!,
    );
  }
}

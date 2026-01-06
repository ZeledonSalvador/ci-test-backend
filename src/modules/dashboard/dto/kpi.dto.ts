export type KpiPorFechaYTipo = {
  fecha: string; // 'YYYY-MM-DD'
  truckType: string | null;
  total: number;
  enTransito: number;
  prechequeado: number;
  autorizado: number;
  enProceso: number;
  finalizado: number;
  pendiente: number;
  anulado: number;
  enEnfriamiento: number;
};

export type KpiHoyPorHora = {
  hourBucket: string; // 'HH:00'
  total: number;
  enTransito: number;
  prechequeado: number;
  autorizado: number;
  enProceso: number;
  finalizado: number;
  pendiente: number;
  anulado: number;
  enEnfriamiento: number;
};

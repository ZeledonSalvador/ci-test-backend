import { DataInconsistency } from 'src/models/DataInconsistency';

export interface SealInfo {
  id: number;
  sealCode: string;
}

// Interface para los seals en el request (solo código + posición dinámica)
export interface SealCodeRequest {
  position: string; // ej. "marchamo1", "marchamo2", ...
  sealCode: string;
}

// Interface para la info de precheck del shipment
export interface ShipmentPrecheckInfo {
  license?: string;
  trailerPlate?: string;
  truckPlate?: string;
}

// Para inconsistencias de precheck: datos reportados vs datos en DB
export interface PrecheckInconsistencyData {
  reportedData: Partial<ShipmentPrecheckInfo>; // Solo los campos enviados
  shipmentData: Partial<ShipmentPrecheckInfo>; // Solo los campos actuales en BD
  reportedAt: string;
  reportedBy: string;
}

// Para inconsistencias de seals: reportados vs almacenados
export interface SealsInconsistencyData {
  reportedSeals: SealCodeRequest[]; // En el orden dinámico asignado
  shipmentSeals: SealInfo[]; // Todos los seals del shipment
  reportedAt: string;
  reportedBy: string;
}

// Estructura principal que se almacena en inconsistency_type como JSON
export interface InconsistencyDataStructure {
  precheck?: PrecheckInconsistencyData;
  seals?: SealsInconsistencyData;
}

// Interface extendida para respuestas con datos formateados
export interface InconsistencyWithFormattedData extends DataInconsistency {
  parsedInconsistencyData?: InconsistencyDataStructure;
  shipmentCodeGen?: string;
  userName?: string;
  inconsistencyTypeEnum?: string; // PRECHECK o SEALS
}

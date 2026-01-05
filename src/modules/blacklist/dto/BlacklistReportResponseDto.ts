import { PenaltyType } from '../enums/PenaltyType.enum';
import { BlacklistStatusHistoryDto } from './BlacklistStatusHistoryDto';

export class BlacklistReportResponseDto {
  id: number;
  driver: {
    license: string;
    name: string;
  };
  // Campos de reporte
  reportDatetime: Date | null;
  eventType: string | null;
  faultType: string | null;
  eventLocation: string | null;
  description: string | null;
  evidenceUrls: string[];
  // Campos de shipment y cliente
  shipment?: {
    id: number;
    codeGen: string;
    product: string;
    transporter: string;
    operationType: string;
    currentStatus: number;
    client: {
      id: number;
      ingenioCode: string;
      ingenioNavCode: string;
      name: string;
    };
    attachments?: {
      id: number;
      shipmentId: number;
      fileUrl: string;
      fileName: string;
      fileType: string | null;
      attachmentType: string;
    }[];
  } | null;
  // Campos de amonestación
  penaltyApplied?: {
    penaltyType: PenaltyType;
    penaltyStartDate: Date;
    penaltyEndDate: Date | null;
    calculatedDays: number | null;
    observation: string;
    isPermanent: boolean;
    isActive: boolean;
  };
  statusBlacklist: number;
  createdAt: Date;
  statusHistory?: BlacklistStatusHistoryDto[];
}
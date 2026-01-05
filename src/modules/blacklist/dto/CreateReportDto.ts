export class CreateReportDto {
  license: string;
  reportDatetime: Date;
  eventType: string;
  faultType: string;
  eventLocation: string;
  description: string;
  shipmentId: number;
  evidenceUrls?: string[];
  reportedBy: string;
}
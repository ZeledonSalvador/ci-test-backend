export class BlacklistStatusHistoryDto {
  id: number;
  blacklistId: number;
  status: number;
  statusText: string;
  changedBy: string;
  changeDateTime: Date;
  changeReason: string | null;
}

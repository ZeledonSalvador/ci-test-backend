import { PenaltyType } from '../enums/PenaltyType.enum';

export class BlacklistDetailsResponseDto {
  message?: string;
  isBanEnded: boolean;
  driver?: {
    license: string;
    name: string;
  };
  blacklistDetails?: {
    observations: string[];
    banStatus: string;
    totalBanDuration: string | number;
    timeRemaining: string | null;
    banStartDate: Date;
    banEndDate: Date | string;
    activeAmonestaciones: {
      penaltyType: PenaltyType;
      penaltyStartDate: Date;
      penaltyEndDate: Date | null;
      calculatedDays: number | null;
      observation: string;
      shipmentCode?: string;
      clientName?: string;
      shipmentProduct?: string; // AGREGAR esta línea
      isPermanent: boolean;
      isActive: boolean;
    }[];
  };
}
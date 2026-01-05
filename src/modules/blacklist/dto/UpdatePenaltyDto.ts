import { PenaltyType } from '../enums/PenaltyType.enum';

export class UpdatePenaltyDto {
  penaltyType?: PenaltyType;
  penaltyStartDate?: Date;
  penaltyEndDate?: Date; // null = permanente
  observation?: string;
  modifiedBy: string;
}
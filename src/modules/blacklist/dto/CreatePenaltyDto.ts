import { PenaltyType } from '../enums/PenaltyType.enum';

export class CreatePenaltyDto {
  license: string;
  penaltyType: PenaltyType;
  penaltyStartDate: Date;
  penaltyEndDate?: Date; // null = permanente
  observation: string;
  reportId: number;
  appliedBy: string;
}

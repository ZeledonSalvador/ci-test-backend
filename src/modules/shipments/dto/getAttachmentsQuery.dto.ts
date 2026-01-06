import { IsEnum, IsOptional } from 'class-validator';
import { AttachmentType } from '../enums/typeFileUpload.enum';

const allowedValues = Object.values(AttachmentType).join(', ');

export class GetAttachmentsQueryDto {
  @IsOptional()
  @IsEnum(AttachmentType, {
    message: `El tipo de adjunto debe ser uno de los siguientes valores permitidos: ${allowedValues}`,
  })
  type?: AttachmentType;
}

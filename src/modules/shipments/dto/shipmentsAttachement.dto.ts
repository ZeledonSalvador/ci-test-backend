import { IsEnum, IsNotEmpty, IsString, IsBoolean } from 'class-validator';
import { AttachmentType } from '../enums/typeFileUpload.enum';

export class UploadFileAttachementShipmentDto {
    @IsNotEmpty({ message: 'El campo urlfileOrbase64file no puede estar vacío.' })
    @IsString({ message: 'El campo urlfileOrbase64file debe ser una cadena.' })
    urlfileOrbase64file: string;

    @IsNotEmpty({ message: 'El campo type no puede estar vacío.' })
    @IsEnum(AttachmentType, { message: 'El campo type debe ser un tipo de archivo válido.' })
    type: AttachmentType;

    @IsBoolean({ message: 'El campo isBase64 debe ser un booleano.' })
    isBase64: boolean;

    @IsNotEmpty({ message: 'El campo codeGen no puede estar vacío.' })
    @IsString({ message: 'El campo codeGen debe ser una cadena.' })
    codeGen: string;
}

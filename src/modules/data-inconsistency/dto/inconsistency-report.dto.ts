import { IsString, IsNumber, IsEnum, IsNotEmpty, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { InconsistencyType } from '../enums/inconsistency-types.enum';

export class SealCodeRequest {
    @IsString({ message: 'La posición del marchamo debe ser una cadena.' })
    @IsNotEmpty({ message: 'La posición del marchamo es requerida.' })
    @Transform(({ value }) => value?.trim())
    position: string; // "marchamo1", "marchamo2", "marchamo3", "marchamo4"

    @IsString({ message: 'El código del marchamo debe ser una cadena.' })
    @IsNotEmpty({ message: 'El código del marchamo es requerido.' })
    @Transform(({ value }) => value?.trim())
    sealCode: string;
}

export class ReportInconsistencyDto {
    @IsString({ message: 'El código de generación es requerido y debe ser una cadena.' })
    @IsNotEmpty({ message: 'El código de generación es un campo requerido.' })
    @Transform(({ value }) => value?.trim())
    codeGen: string;

    @Transform(({ value }) => {
        return InconsistencyType[value as keyof typeof InconsistencyType] || value;
    })
    @IsEnum(InconsistencyType, { 
        message: `El tipo de inconsistencia debe ser uno de los siguientes: ${Object.entries(InconsistencyType).map(([key, value]) => `${value} (${key})`).join(', ')}.` 
    })
    reportType: InconsistencyType;

    @IsString({ message: 'Los comentarios son requeridos y deben ser una cadena.' })
    @IsNotEmpty({ message: 'Los comentarios son un campo obligatorio.' })
    @Transform(({ value }) => value?.trim())
    comments: string;

    @IsNumber({}, { message: 'El ID del usuario debe ser un número.' })
    @IsNotEmpty({ message: 'El ID del usuario es un campo requerido.' })
    userId: number;

    // Campos para prechequeado - solo valores inconsistentes actuales
    @IsOptional()
    @IsString({ message: 'La licencia debe ser una cadena.' })
    @Transform(({ value }) => value?.trim())
    license?: string;

    @IsOptional()
    @IsString({ message: 'La placa del remolque debe ser una cadena.' })
    @Transform(({ value }) => value?.trim())
    trailerPlate?: string;

    @IsOptional()
    @IsString({ message: 'La placa del camión debe ser una cadena.' })
    @Transform(({ value }) => value?.trim())
    truckPlate?: string;

    // Campos para marchamos - array de objetos con códigos de seals
    @IsOptional()
    @IsArray({ message: 'Los marchamos deben ser un arreglo.' })
    @ValidateNested({ each: true })
    @Type(() => SealCodeRequest)
    seals?: SealCodeRequest[];
}

export class GetInconsistenciesQueryDto {
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsNumber({}, { message: 'La página debe ser un número.' })
    page?: number = 1;

    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsNumber({}, { message: 'El tamaño debe ser un número.' })
    size?: number = 20;

    @IsOptional()
    @IsString({ message: 'El filtro de tipo debe ser una cadena.' })
    @Transform(({ value }) => value?.trim())
    reportType?: string;

    @IsOptional()
    @IsString()
    status?: string;

    @IsOptional()
    @IsString({ message: 'El filtro de fecha inicio debe ser una cadena.' })
    @Transform(({ value }) => value?.trim())
    startDate?: string;

    @IsOptional()
    @IsString({ message: 'El filtro de fecha fin debe ser una cadena.' })
    @Transform(({ value }) => value?.trim())
    endDate?: string;
}
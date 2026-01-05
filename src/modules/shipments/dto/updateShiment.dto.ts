import { IsString, IsNumber, IsEnum, IsObject, ValidateIf, ValidateNested, Matches } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { TipoOperacion, TipoOperacionMap } from '../enums/tipoOperacion.enum';
import { TipoCarga, TipoCargaMap } from '../enums/tipoCarga.enum';
import { TipoCamion, TipoCamionMap } from '../enums/tipoCamion.enum';
import { ProductType, typeProductMap } from '../enums/productType.enum';
import { RequiresSweepingMap, RequiresSweepingType } from '../enums/requiresSweepingType.enum';
import { buildMessageEnumsWithCode } from 'src/utils/functions.util';

// DTO para Motorista
export class MotoristaUpdateDto {
    @IsString({ message: 'La licencia del motorista debe ser una cadena.' })
    @Transform(({ value }) => {
        // Remover guiones si vienen
        return value?.replace(/-/g, '').trim();
    }, { toClassOnly: true })
    @Matches(/^\d+$/, { message: 'La licencia debe contener solo números.' })
    @ValidateIf((_, value) => value !== null && value !== undefined)
    licencia?: string;

    @IsString({ message: 'El nombre del motorista debe ser una cadena.' })
    @Transform(({ value }) => value?.trim())
    @ValidateIf((_, value) => value !== null && value !== undefined)
    nombre?: string;
}

// DTO para Vehiculo
export class VehiculoUpdateDto {
    @IsObject()
    @ValidateNested()  // Añadido para validar el objeto anidado
    @Type(() => MotoristaUpdateDto)  // Especificar el tipo del objeto anidado
    @ValidateIf((_, value) => value !== null && value !== undefined)
    motorista?: MotoristaUpdateDto;

    @IsString({ message: 'La placa del vehículo debe ser una cadena.' })
    @Transform(({ value }) => value?.trim())
    @Matches(/^C\d+$/, { message: 'La placa del cabezal debe comenzar con "C" seguido de números, sin espacios.' })
    @ValidateIf((_, value) => value !== null && value !== undefined)
    placa?: string;

    @IsString({ message: 'La placa del remolque debe ser una cadena.' })
    @Transform(({ value }) => value?.trim())
    @Matches(/^RE\d+$/, { message: 'La placa del remolque debe comenzar con "RE" seguido de números, sin espacios.' })
    @ValidateIf((_, value) => value !== null && value !== undefined)
    placa_remolque?: string;

    @Transform(({ value }) => {
        return typeof value === 'string' && value.length === 1
            ? TipoCamionMap[value.toUpperCase()]
            : value;
    })
    @ValidateIf((_, value) => value !== null && value !== undefined)
    @IsEnum(TipoCamion, { message: 'El tipo de camión no es válido.' })
    tipo_camion?: TipoCamion;
}

// DTO para Transportista
export class TransportistaUpdateDto {
    @IsString({ message: 'El nombre del transportista debe ser una cadena.' })
    @ValidateIf((_, value) => value !== null && value !== undefined)
    nombre?: string;
}

export class UpdateShipmentDto {
    @IsString({ message: 'El código de generación debe ser una cadena.' })
    @ValidateIf((_, value) => value !== null && value !== undefined)
    codigo_gen?: string;

    @Transform(({ value }) => {
        return typeof value === 'string'
            ? typeProductMap[value.toUpperCase()]
            : value;
    })
    @IsEnum(ProductType, { message: `El tipo de producto debe ser "${buildMessageEnumsWithCode(typeProductMap)}".` })
    @ValidateIf((_, value) => value !== null && value !== undefined)
    producto?: ProductType;

    @Transform(({ value }) => {
        return typeof value === 'string' && value.length === 1
            ? TipoOperacionMap[value.toUpperCase()]
            : value;
    })
    @ValidateIf((_, value) => value !== null && value !== undefined)
    @IsEnum(TipoOperacion, { message: `El tipo de operación debe ser "${buildMessageEnumsWithCode(TipoOperacionMap)}".` })
    tipo_operacion?: TipoOperacion;

    @Transform(({ value }) => {
        return typeof value === 'string' && value.length === 1
            ? TipoCargaMap[value.toUpperCase()]
            : value;
    })
    @ValidateIf((_, value) => value !== null && value !== undefined)
    @IsEnum(TipoCarga, { message: `El tipo de carga debe ser "${buildMessageEnumsWithCode(TipoCargaMap)}".` })
    tipo_carga?: TipoCarga;

    @IsObject()
    @ValidateNested()  // Añadido para validar el objeto anidado
    @Type(() => VehiculoUpdateDto)  // Especificar el tipo del objeto anidado
    @ValidateIf((_, value) => value !== null && value !== undefined)
    vehiculo?: VehiculoUpdateDto;

    @IsObject()
    @ValidateNested()  // Añadido para validar el objeto anidado
    @Type(() => TransportistaUpdateDto)  // Especificar el tipo del objeto anidado
    @ValidateIf((_, value) => value !== null && value !== undefined)
    transportista?: TransportistaUpdateDto;

    @IsString({ message: 'El código del ingenio debe ser una cadena.' })
    @ValidateIf((_, value) => value !== null && value !== undefined)
    codigo_ingenio?: string;

    @IsNumber({}, { message: 'La cantidad del producto debe ser un número.' })
    @ValidateIf((_, value) => value !== null && value !== undefined)
    cantidad_producto?: number;

    @IsString({ message: 'La unidad de medida debe ser una cadena.' })
    @ValidateIf((_, value) => value !== null && value !== undefined)
    unidad_medida?: string;

    @Transform(({ value }) => {
        return typeof value === 'string' && value.length === 1
            ? RequiresSweepingMap[value.toUpperCase()]
            : value;
    })
    @ValidateIf((_, value) => value !== null && value !== undefined)
    @IsEnum(RequiresSweepingType, { message: `El require_barrido debe ser "${buildMessageEnumsWithCode(RequiresSweepingMap)}".` })
    require_barrido?: RequiresSweepingType;

    @IsString({ each: true, message: 'Cada marchamo debe ser una cadena de texto.' })
    @ValidateIf((_, value) => value !== null && value !== undefined)
    marchamos?: string[];
}

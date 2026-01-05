import { IsString, IsNumber, IsEnum, IsObject, IsDefined, IsArray, ArrayMinSize, IsNotEmpty, IsOptional, ValidateNested, Matches } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { TipoOperacion } from '../enums/tipoOperacion.enum';
import { TipoCarga } from '../enums/tipoCarga.enum';
import { TipoCamion } from '../enums/tipoCamion.enum';
import { ProductType } from '../enums/productType.enum';
import { RequiresSweepingType } from '../enums/requiresSweepingType.enum';

// DTO para Motorista
export class MotoristaDto {
    @IsString({ message: 'La licencia del motorista es requerida y debe ser una cadena.' })
    @IsNotEmpty({ message: 'La licencia es un campo requerido.' })
    @Transform(({ value }) => {
        console.log("Transformando licencia sin guiones: ", value?.replace(/-/g, ''));
        return value?.replace(/-/g, '');
    }, { toClassOnly: true })
    @Matches(/^\d+$/, { message: 'La licencia debe contener solo números.' })
    licencia: string;

    @IsString({ message: 'El nombre del motorista es requerido y debe ser una cadena.' })
    @IsNotEmpty({ message: 'El nombre es un campo requerido.' })
    @Transform(({ value }) => value?.trim())
    nombre: string;
}

// DTO para Vehiculo
export class VehiculoDto {
    @ValidateNested({ each: true })
    @Type(() => MotoristaDto)
    @IsObject()
    @IsNotEmpty({ message: 'El motorista es un campo requerido.' })
    motorista: MotoristaDto;

    @IsString({ message: 'La placa del vehículo es requerida y debe ser una cadena.' })
    @IsNotEmpty({ message: 'La placa del vehículo es un campo requerido.' })
    @Transform(({ value }) => value?.trim())
    @Matches(/^C\d+$/, { message: 'La placa del cabezal debe comenzar con "C" seguido de números, sin espacios.' })
    placa: string;

    @IsString({ message: 'La placa del remolque es requerida y debe ser una cadena.' })
    @IsNotEmpty({ message: 'La placa del remolque es un campo requerido.' })
    @Transform(({ value }) => value?.trim())
    @Matches(/^RE\d+$/, { message: 'La placa del remolque debe comenzar con "RE" seguido de números, sin espacios.' })
    placa_remolque: string;

    @Transform(({ value }) => {
        return TipoCamion[value as keyof typeof TipoCamion] || value;
    })
    @IsEnum(TipoCamion, { message: `El tipo de camión debe ser uno de los siguientes: ${Object.entries(TipoCamion).map(([key, value]) => `${value} (${key})`).join(', ')}.` })
    tipo_camion: TipoCamion;
}

// DTO para Transportista
export class TransportistaDto {
    @IsString({ message: 'El nombre del transportista es requerido y debe ser una cadena.' })
    @IsNotEmpty({ message: 'El nombre del transportista es un campo requerido.' })
    @Transform(({ value }) => value?.trim())
    nombre: string;
}

// DTO para la creación de un envío
export class CreateShipmentDto {
    @IsString({ message: 'El código de generación es requerido y debe ser una cadena.' })
    @IsNotEmpty({ message: 'El código de generación es un campo requerido.' })
    @Transform(({ value }) => value?.trim())
    codigo_gen: string;

    @Transform(({ value }) => {
        return ProductType[value as keyof typeof ProductType] || value;
    })
    @IsEnum(ProductType, { message: `El tipo de producto debe ser uno de los siguientes: ${Object.entries(ProductType).map(([key, value]) => `${value} (${key})`).join(', ')}.` })
    producto: ProductType;

    @Transform(({ value }) => {
        return TipoOperacion[value as keyof typeof TipoOperacion] || value;
    })
    @IsEnum(TipoOperacion, { message: `El tipo de operación debe ser uno de los siguientes: ${Object.entries(TipoOperacion).map(([key, value]) => `${value} (${key})`).join(', ')}.` })
    tipo_operacion: TipoOperacion;

    @Transform(({ value }) => {
        return TipoCarga[value as keyof typeof TipoCarga] || value;
    })
    @IsEnum(TipoCarga, { message: `El tipo de carga debe ser uno de los siguientes: ${Object.entries(TipoCarga).map(([key, value]) => `${value} (${key})`).join(', ')}.` })
    tipo_carga: TipoCarga;

    @ValidateNested({ each: true })
    @Type(() => VehiculoDto)
    @IsObject()
    @IsNotEmpty({ message: 'El vehículo es un campo requerido.' })
    vehiculo: VehiculoDto;

    @ValidateNested({ each: true })
    @Type(() => TransportistaDto)
    @IsObject()
    @IsNotEmpty({ message: 'El transportista es un campo requerido.' })
    transportista: TransportistaDto;

    @IsString({ message: 'El código del ingenio es requerido y debe ser una cadena.' })
    @IsNotEmpty({ message: 'El código del ingenio es un campo requerido.' })
    @Transform(({ value }) => value?.trim())
    codigo_ingenio: string;

    @IsNumber({}, { message: 'La cantidad del producto debe ser un número.' })
    @IsNotEmpty({ message: 'La cantidad del producto es un campo requerido.' })
    cantidad_producto: number;

    @IsString({ message: 'La unidad de medida es requerida y debe ser una cadena.' })
    @IsNotEmpty({ message: 'La unidad de medida es un campo requerido.' })
    @Transform(({ value }) => value?.trim())
    unidad_medida: string;

    @Transform(({ value }) => {
        return RequiresSweepingType[value as keyof typeof RequiresSweepingType] || value;
    })
    @IsOptional()
    @Transform(({ value }) => {
        return RequiresSweepingType[value as keyof typeof RequiresSweepingType] || value;
    })
    @IsEnum(RequiresSweepingType, {
        message: `El require_barrido debe ser uno de los siguientes: ${Object.entries(RequiresSweepingType).map(([key, value]) => `${value} (${key})`).join(', ')}.`
    })
    require_barrido?: RequiresSweepingType;

    @IsDefined({ message: 'La lista de marchamos es obligatoria.' })
    @IsArray({ message: 'Los marchamos deben enviarse como una lista.' })
    @ArrayMinSize(1, { message: 'Agrega al menos un marchamo.' })
    @IsString({ each: true, message: 'Cada marchamo debe ser una cadena de texto.' })
    @IsNotEmpty({ each: true, message: 'Los marchamos no pueden estar vacíos.' })
    @Transform(({ value }) => Array.isArray(value) ? value.map((v: string) => v?.trim()) : value)
    marchamos: string[];

    @IsNumber({}, { message: 'El peso bruto debe ser un dato numérico. No agregues letras ni símbolos (por ejemplo, "kg"). Ej.: 38500 o 38500.75.' })
    @IsNotEmpty({ message: 'El peso bruto es un campo requerido.' })
    peso_bruto: number;

    @IsNumber({}, { message: 'El peso tara debe ser un dato numérico. No agregues letras ni símbolos (por ejemplo, "kg"). Ej.: 38500 o 38500.75.' })
    @IsNotEmpty({ message: 'El peso tara es un campo requerido.' })
    peso_tara: number;

    constructor() {
        this.vehiculo = new VehiculoDto();
        this.vehiculo.motorista = new MotoristaDto();
        this.transportista = new TransportistaDto();
    }
}

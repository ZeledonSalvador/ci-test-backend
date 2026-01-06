import { DataInconsistency } from 'src/models/DataInconsistency';
import { InconsistencyDataStructure } from '../interfaces/inconsistency-data.interface';
import { getProductNameByCode } from '../utils/product.utils';

// TIPOS ESPECÍFICOS PARA EVITAR DEPENDENCIAS CIRCULARES
export interface ShipmentDriverDto {
  license: string;
  name: string;
}

export interface ShipmentVehicleDto {
  plate: string;
  trailerPlate: string;
}

export interface ShipmentIngenioDto {
  ingenioCode: string;
  ingenioNavCode?: string;
  name: string;
}

export interface ShipmentSealDto {
  sealCode: string;
}

export interface ShipmentDataDto {
  transporter: string;
  product: string;
  productQuantity: number;
  productQuantityKg: number;
  unitMeasure: string;
  driver: ShipmentDriverDto;
  vehicle: ShipmentVehicleDto;
  ingenio?: ShipmentIngenioDto;
  shipmentSeals: ShipmentSealDto[];
}

export class InconsistencyResponseDto {
  id: number;
  shipmentId: number;
  shipmentCodeGen: string;
  shipmentData: ShipmentDataDto;
  inconsistencyType: string;
  parsedInconsistencyData?: InconsistencyDataStructure;
  comments: string | null;
  userId: number;
  createdAt: Date;
  updatedAt: Date | null;

  constructor(dataInconsistency: DataInconsistency) {
    this.id = dataInconsistency.id;
    this.shipmentId = dataInconsistency.shipment.id;
    this.shipmentCodeGen = dataInconsistency.shipment.codeGen;

    // CONSTRUIR DATOS USANDO TIPOS ESPECÍFICOS
    this.shipmentData = {
      transporter: dataInconsistency.shipment.transporter,
      product: getProductNameByCode(dataInconsistency.shipment.product),
      productQuantity: dataInconsistency.shipment.productQuantity,
      productQuantityKg: dataInconsistency.shipment.productQuantityKg,
      unitMeasure: dataInconsistency.shipment.unitMeasure,
      driver: {
        license: dataInconsistency.shipment.driver?.license || '',
        name: dataInconsistency.shipment.driver?.name || '',
      },
      vehicle: {
        plate: dataInconsistency.shipment.vehicle?.plate || '',
        trailerPlate: dataInconsistency.shipment.vehicle?.trailerPlate || '',
      },
      ingenio: dataInconsistency.shipment.ingenio
        ? {
            ingenioCode: dataInconsistency.shipment.ingenio.ingenioCode,
            ingenioNavCode: dataInconsistency.shipment.ingenio.ingenioNavCode,
            name: dataInconsistency.shipment.ingenio.name,
          }
        : undefined,
      shipmentSeals:
        dataInconsistency.shipment.shipmentSeals?.map((seal) => ({
          sealCode: seal.sealCode,
        })) || [],
    };

    this.inconsistencyType = dataInconsistency.inconsistencyType;

    try {
      this.parsedInconsistencyData = JSON.parse(
        dataInconsistency.inconsistencyType,
      );
    } catch (error) {
      this.parsedInconsistencyData = undefined;
    }

    this.comments = dataInconsistency.comments;
    this.userId = dataInconsistency.userId;
    this.createdAt = dataInconsistency.createdAt;
    this.updatedAt = dataInconsistency.updatedAt;
  }
}

export class InconsistencyListResponseDto {
  data: InconsistencyResponseDto[];
  total: number;
  page: number;
  size: number;

  constructor(
    data: InconsistencyResponseDto[],
    total: number,
    page: number,
    size: number,
  ) {
    this.data = data;
    this.total = total;
    this.page = page;
    this.size = size;
  }
}

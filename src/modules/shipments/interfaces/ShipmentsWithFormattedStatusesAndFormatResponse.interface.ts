import { Shipments } from "src/models/Shipments";
import { Status } from "src/models/Status";

export default interface ShipmentsWithFormattedStatusesAndFormatResponseAndFormatResponse
    extends Omit<Shipments, 'statuses'> {
    nameProduct?: string;
    truckType?: string;
    statuses?: StatusResponse[] | Status[];
    Temperature?: {
        registro: number;
        temperature: number;
        createdAt: Date;
    }[];
    navRecord?: any;
}
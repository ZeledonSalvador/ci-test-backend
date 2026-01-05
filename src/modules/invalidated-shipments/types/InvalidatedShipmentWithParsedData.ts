import { InvalidatedShipments } from "src/models/InvalidatedShipments";
import { Shipments } from "src/models/Shipments";

export type InvalidatedShipmentWithParsedData = Omit<InvalidatedShipments, 'jsonData'> & {
    jsonData: Shipments;
};

import { BlacklistDrivers } from "src/models/BlacklistDrivers";
import { BlacklistDetailsResponseDto } from "./BlacklistDetailsResponseDto";

export interface BlacklistWithExtraFields extends Partial<BlacklistDrivers> {
    driverPhoto?: string;
    transporterName?: string;
    banDetails : BlacklistDetailsResponseDto;
    blacklistRecords? : any;
}

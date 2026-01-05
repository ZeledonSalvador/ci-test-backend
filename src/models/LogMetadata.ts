import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ShipmentLogs } from "./ShipmentLogs";

@Index("PK__LogMetad__3213E83F38CCD3B8", ["id"], { unique: true })
@Entity("LogMetadata", { schema: "dbo" })
export class LogMetadata {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @Column("nvarchar", { name: "metadata_key", length: 50 })
  metadataKey: string;

  @Column("nvarchar", { name: "metadata_value", length: 255 })
  metadataValue: string;

  @ManyToOne(() => ShipmentLogs, (shipmentLogs) => shipmentLogs.logMetadata, {
    onDelete: "CASCADE",
  })
  @JoinColumn([{ name: "log_id", referencedColumnName: "id" }])
  log: ShipmentLogs;
}

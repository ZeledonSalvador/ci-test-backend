import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { LogMetadata } from "./LogMetadata";
import { Shipments } from "./Shipments";

@Index("PK__Shipment__3213E83F60384187", ["id"], { unique: true })
@Entity("ShipmentLogs", { schema: "dbo" })
export class ShipmentLogs {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @Column("nvarchar", { name: "log_type", length: 50 })
  logType: string;

  @Column("nvarchar", {
    name: "log_text",
    nullable: true,
    length: 255,
    default: () => "NULL",
  })
  logText: string | null;

  @Column("datetime", {
    name: "created_at",
    nullable: true,
    default: () => "getdate()",
  })
  createdAt: Date | null;

  @Column("datetime", {
    name: "updated_at",
    nullable: true,
    default: () => "getdate()",
  })
  updatedAt: Date | null;

  @OneToMany(() => LogMetadata, (logMetadata) => logMetadata.log)
  logMetadata: LogMetadata[];

  @ManyToOne(() => Shipments, (shipments) => shipments.shipmentLogs, {
    onDelete: "CASCADE",
  })
  @JoinColumn([{ name: "shipment_id", referencedColumnName: "id" }])
  shipment: Shipments;
}

import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Shipments } from "./Shipments";

@Index("PK__Shipment__3213E83FF679B0A3", ["id"], { unique: true })
@Entity("ShipmentSeals", { schema: "dbo" })
export class ShipmentSeals {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @Column("nvarchar", { name: "seal_code", length: 50 })
  sealCode: string;

  @Column("nvarchar", { name: "seal_description", nullable: true, length: 100 })
  sealDescription: string | null;

  @Column("datetime", {
    name: "created_at",
    nullable: true,
    default: () => "getdate()",
  })
  createdAt: Date | null;

  @ManyToOne(() => Shipments, (shipments) => shipments.shipmentSeals, {
    onDelete: "CASCADE",
  })
  @JoinColumn([{ name: "shipment_id", referencedColumnName: "id" }])
  shipment: Shipments;
}

import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Shipments } from "./Shipments";

@Index("PK__Shipment__3213E83F8605C2C8", ["id"], { unique: true })
@Entity("ShipmentAttachments", { schema: "dbo" })
export class ShipmentAttachments {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @Column("nvarchar", { name: "file_url" })
  fileUrl: string;

  @Column("nvarchar", { name: "file_name", length: 100 })
  fileName: string;

  @Column("nvarchar", { name: "file_type", nullable: true, length: 50 })
  fileType: string | null;

  @Column("char", { name: "attachment_type", length: 1 })
  attachmentType: string;

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

  @ManyToOne(() => Shipments, (shipments) => shipments.shipmentAttachments, {
    onDelete: "CASCADE",
  })
  @JoinColumn([{ name: "shipment_id", referencedColumnName: "id" }])
  shipment: Shipments;
}

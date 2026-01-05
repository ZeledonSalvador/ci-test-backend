import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Shipments } from "./Shipments";
import { PredefinedStatuses } from "./PredefinedStatuses";

@Index("PK__Status__3213E83F58CB2D26", ["id"], { unique: true })
@Entity("Status", { schema: "dbo" })
export class Status {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

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

  @ManyToOne(() => Shipments, (shipments) => shipments.statuses, {
    onDelete: "CASCADE",
  })
  @JoinColumn([{ name: "shipment_id", referencedColumnName: "id" }])
  shipment: Shipments;

  @ManyToOne(
    () => PredefinedStatuses,
    (predefinedStatuses) => predefinedStatuses.statuses,
    { onDelete: "CASCADE" }
  )
  @JoinColumn([{ name: "predefined_status_id", referencedColumnName: "id" }])
  predefinedStatus: PredefinedStatuses;
}

import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Clients } from "./Clients";

@Index("PK__Invalida__3213E83FB8DE5056", ["id"], { unique: true })
@Entity("Invalidated_Shipments", { schema: "dbo" })
export class InvalidatedShipments {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @Column("nvarchar", { name: "code_gen", length: 50 })
  codeGen: string;

  @Column("nvarchar", { name: "reason", nullable: true })
  reason: string | null;

  @Column("nvarchar", { name: "json_data" })
  jsonData: string;

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

  @ManyToOne(() => Clients, (clients) => clients.invalidatedShipments)
  @JoinColumn([{ name: "client_id", referencedColumnName: "id" }])
  client: Clients;
}

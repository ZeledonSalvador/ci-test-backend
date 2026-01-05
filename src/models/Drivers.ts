import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BlacklistDrivers } from "./BlacklistDrivers";
import { Shipments } from "./Shipments";

@Index("PK__Drivers__3213E83FCB93E037", ["id"], { unique: true })
@Index("UQ__Drivers__A4E54DE46B303A71", ["license"], { unique: true })
@Entity("Drivers", { schema: "dbo" })
export class Drivers {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @Column("nvarchar", { name: "license", unique: true, length: 50 })
  license: string;

  @Column("nvarchar", { name: "name", length: 100 })
  name: string;

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

  @OneToMany(
    () => BlacklistDrivers,
    (blacklistDrivers) => blacklistDrivers.driver
  )
  blacklistDrivers: BlacklistDrivers[];

  @OneToMany(() => Shipments, (shipments) => shipments.driver)
  shipments: Shipments[];
}

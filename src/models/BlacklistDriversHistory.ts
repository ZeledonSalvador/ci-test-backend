import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BlacklistDrivers } from "./BlacklistDrivers";

@Index("IX_StatusHistory_BlacklistId", ["blacklistId"])
@Index("IX_StatusHistory_DateTime", ["changeDateTime"])
@Entity("BlacklistDrivers_History", { schema: "dbo" })
export class BlacklistDriversHistory {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @Column("int", { name: "blacklist_id" })
  blacklistId: number;

  @Column("int", { name: "status" })
  status: number;

  @Column("nvarchar", { name: "changed_by", length: 100 })
  changedBy: string;

  @Column("datetime", { name: "change_datetime" })
  changeDateTime: Date;

  @Column("nvarchar", { name: "change_reason", nullable: true, length: 500 })
  changeReason: string | null;

  // Relación con BlacklistDrivers
  @ManyToOne(() => BlacklistDrivers, { onDelete: "CASCADE" })
  @JoinColumn([{ name: "blacklist_id", referencedColumnName: "id" }])
  blacklistDriver: BlacklistDrivers;
}
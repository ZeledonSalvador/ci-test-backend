import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { LeveransLogger } from "./LeveransLogger";
import { Status } from "./Status";

@Index("PK__Predefin__3213E83F92367CEE", ["id"], { unique: true })
@Entity("PredefinedStatuses", { schema: "dbo" })
export class PredefinedStatuses {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @Column("nvarchar", { name: "name", length: 100 })
  name: string;

  @Column("nvarchar", { name: "description", nullable: true, length: 255 })
  description: string | null;

  @OneToMany(
    () => LeveransLogger,
    (leveransLogger) => leveransLogger.predefinedStatuses
  )
  leveransLoggers: LeveransLogger[];

  @OneToMany(() => Status, (status) => status.predefinedStatus)
  statuses: Status[];
}

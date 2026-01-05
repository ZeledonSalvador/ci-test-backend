import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { LeveransLogger } from "./LeveransLogger";
import { LeveransUserLoginHistory } from "./LeveransUserLoginHistory";

@Index("PK__Leverans__3213E83F5D6D4547", ["id"], { unique: true })
@Entity("LeveransUsers", { schema: "dbo" })
export class LeveransUsers {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @Column("nvarchar", { name: "username", length: 100 })
  username: string;

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
    () => LeveransLogger,
    (leveransLogger) => leveransLogger.leveransUser
  )
  leveransLoggers: LeveransLogger[];

  @OneToMany(
    () => LeveransUserLoginHistory,
    (leveransUserLoginHistory) => leveransUserLoginHistory.leveransUser
  )
  leveransUserLoginHistories: LeveransUserLoginHistory[];
}

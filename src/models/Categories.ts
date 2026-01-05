import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Roles } from "./Roles";

@Index("PK_Categories", ["id"], { unique: true })
@Index("UQ_Categories_Name", ["name"], { unique: true })
@Index("IX_Categories_Active", ["active"])
@Entity("Categories", { schema: "dbo" })
export class Categories {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @Column("nvarchar", { name: "name", unique: true, length: 100 })
  name: string;

  @Column("bit", { name: "active", default: true })
  active: boolean;

  @Column("datetime", {
    name: "created_at",
    default: () => "getdate()",
  })
  createdAt: Date;

  @Column("datetime", {
    name: "updated_at",
    default: () => "getdate()",
  })
  updatedAt: Date;

  @OneToMany(() => Roles, (role) => role.category)
  roles: Roles[];
}

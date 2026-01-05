import {
  Column,
  Entity,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from "typeorm";
import { InternalUsers } from "./InternalUsers";
import { Categories } from "./Categories";

@Index("PK_Roles", ["id"], { unique: true })
@Index("IX_Roles_Category", ["idCategory"])
@Index("IX_Roles_Active", ["active"])
@Entity("Roles", { schema: "dbo" })
export class Roles {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @Column("int", { name: "id_category" })
  idCategory: number;

  @Column("nvarchar", { name: "name", length: 100 })
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

  @ManyToOne(() => Categories, (category) => category.roles)
  @JoinColumn({ name: "id_category" })
  category: Categories;

  @OneToMany(() => InternalUsers, (internalUser) => internalUser.role)
  internalUsers: InternalUsers[];
}
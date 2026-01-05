import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("Menu", { schema: "dbo" })
export class Menu {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @Column("varchar", { name: "url", length: 50 })
  url: string;

  @Column("varchar", { name: "icon", length: 50 })
  icon: string;

  @Column("varchar", { name: "description", length: 50 })
  description: string;

  @Column("datetime", {
    name: "created_at",
    default: () => "getdate()",
  })
  createdAt: Date;
}
import {
  Column,
  Entity,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Permissions } from './Permissions';

@Index('PK_Modules', ['id'], { unique: true })
@Index('UQ_Modules_Name', ['name'], { unique: true })
@Index('IX_Modules_Active', ['active'])
@Index('IX_Modules_OrderIndex', ['orderIndex'])
@Entity('Modules', { schema: 'dbo' })
export class Modules {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('nvarchar', { name: 'name', unique: true, length: 100 })
  name: string;

  @Column('nvarchar', { name: 'display_name', length: 100 })
  displayName: string;

  @Column('nvarchar', { name: 'icon', nullable: true, length: 50 })
  icon: string | null;

  @Column('int', { name: 'parent_id', nullable: true })
  parentId: number | null;

  @Column('int', { name: 'order_index', default: 0 })
  orderIndex: number;

  @Column('bit', { name: 'active', default: true })
  active: boolean;

  @Column('bit', { name: 'is_visible', default: true })
  isVisible: boolean;

  @Column('datetime', {
    name: 'created_at',
    default: () => 'getdate()',
  })
  createdAt: Date;

  @Column('datetime', {
    name: 'updated_at',
    default: () => 'getdate()',
  })
  updatedAt: Date;

  @ManyToOne(() => Modules, (module) => module.children)
  @JoinColumn({ name: 'parent_id' })
  parent: Modules | null;

  @OneToMany(() => Modules, (module) => module.parent)
  children: Modules[];

  @OneToMany(() => Permissions, (permission) => permission.module)
  permissions: Permissions[];
}

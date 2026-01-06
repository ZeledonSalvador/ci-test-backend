import {
  Column,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InternalUsers } from './InternalUsers';
import { Modules } from './Modules';

@Index('PK_Permissions', ['id'], { unique: true })
@Index('UQ_UserModule', ['idUser', 'idModule'], { unique: true })
@Index('IX_Permissions_User', ['idUser'])
@Index('IX_Permissions_Module', ['idModule'])
@Entity('Permissions', { schema: 'dbo' })
export class Permissions {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'id_user' })
  idUser: number;

  @Column('int', { name: 'id_module' })
  idModule: number;

  @Column('nvarchar', { name: 'actions', length: 100 })
  actions: string;

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

  @ManyToOne(() => InternalUsers, (user) => user.permissions)
  @JoinColumn({ name: 'id_user' })
  user: InternalUsers;

  @ManyToOne(() => Modules, (module) => module.permissions)
  @JoinColumn({ name: 'id_module' })
  module: Modules;
}

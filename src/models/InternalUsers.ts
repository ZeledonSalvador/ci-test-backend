import {
  Column,
  Entity,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Roles } from './Roles';
import { Permissions } from './Permissions';
import { UserWeighbridges } from './UserWeighbridges';
import { SessionsLogs } from './SessionsLogs';

@Index('PK_InternalUsers', ['id'], { unique: true })
@Index('UQ_InternalUsers_Username', ['username'], { unique: true })
@Index('IX_InternalUsers_Email', ['email'])
@Index('IX_InternalUsers_Active', ['active'])
@Index('IX_InternalUsers_Role', ['idRole'])
@Entity('InternalUsers', { schema: 'dbo' })
export class InternalUsers {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('nvarchar', { name: 'username', unique: true, length: 50 })
  username: string;

  @Column('nvarchar', { name: 'email', nullable: true, length: 255 })
  email: string | null;

  @Column('nvarchar', { name: 'full_name', nullable: true, length: 100 })
  fullName: string | null;

  @Column('int', { name: 'id_role' })
  idRole: number;

  @Column('varbinary', { name: 'password' })
  password: Buffer;

  @Column('bit', { name: 'active', default: true })
  active: boolean;

  @Column('datetime', { name: 'last_access', nullable: true })
  lastAccess: Date | null;

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

  @ManyToOne(() => Roles, (role) => role.internalUsers)
  @JoinColumn({ name: 'id_role' })
  role: Roles;

  @OneToMany(() => Permissions, (permission) => permission.user)
  permissions: Permissions[];

  @OneToMany(() => UserWeighbridges, (userWeighbridge) => userWeighbridge.user)
  weighbridges: UserWeighbridges[];

  @OneToMany(() => SessionsLogs, (sessionLog) => sessionLog.user)
  sessionsLogs: SessionsLogs[];
}

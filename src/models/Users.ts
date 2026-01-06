import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Clients } from './Clients';
import { DataInconsistency } from './DataInconsistency';

@Index('PK__Users__3213E83FE8C0D520', ['id'], { unique: true })
@Index('UQ__Users__F3DBC5723DEAA9B9', ['username'], { unique: true })
@Entity('Users', { schema: 'dbo' })
export class Users {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('nvarchar', { name: 'username', unique: true, length: 50 })
  username: string;

  @Column('nvarchar', { name: 'password', length: 255 })
  password: string;

  @Column('nvarchar', { name: 'role', length: 20 })
  role: string;

  @Column('datetime', {
    name: 'created_at',
    nullable: true,
    default: () => 'getdate()',
  })
  createdAt: Date | null;

  @Column('datetime', {
    name: 'updated_at',
    nullable: true,
    default: () => 'getdate()',
  })
  updatedAt: Date | null;

  @OneToMany(() => Clients, (clients) => clients.user)
  clients: Clients[];

  @OneToMany(
    () => DataInconsistency,
    (dataInconsistency) => dataInconsistency.user,
  )
  dataInconsistencies: DataInconsistency[];
}

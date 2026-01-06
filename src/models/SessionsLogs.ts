import {
  Column,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InternalUsers } from './InternalUsers';

@Index('PK_SessionsLogs', ['id'], { unique: true })
@Index('IX_SessionsLogs_User', ['codUsuario'])
@Index('IX_SessionsLogs_Username', ['username'])
@Index('IX_SessionsLogs_Bascula', ['codBascula'])
@Index('IX_SessionsLogs_Turno', ['codTurno'])
@Index('IX_SessionsLogs_Success', ['isSuccessful'])
@Index('IX_SessionsLogs_CreatedAt', ['createdAt'])
@Entity('Sessions_Logs', { schema: 'dbo' })
export class SessionsLogs {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'cod_usuario', nullable: true })
  codUsuario: number | null;

  @Column('nvarchar', { name: 'username', length: 50 })
  username: string;

  @Column('nvarchar', { name: 'session_token', length: 500, nullable: true })
  sessionToken: string | null;

  @Column('datetime', { name: 'token_expiration', nullable: true })
  tokenExpiration: Date | null;

  @Column('int', { name: 'cod_bascula', nullable: true })
  codBascula: number | null;

  @Column('int', { name: 'cod_turno', nullable: true })
  codTurno: number | null;

  @Column('bit', { name: 'is_successful', default: true })
  isSuccessful: boolean;

  @Column('nvarchar', { name: 'message', length: 255 })
  message: string;

  @Column('datetime', {
    name: 'created_at',
    default: () => 'getdate()',
  })
  createdAt: Date;

  @ManyToOne(() => InternalUsers, (user) => user.sessionsLogs, {
    nullable: true,
  })
  @JoinColumn({ name: 'cod_usuario' })
  user: InternalUsers | null;
}

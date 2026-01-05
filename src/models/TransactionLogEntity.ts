import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn
} from 'typeorm';

@Entity('Transaction_Logs')
export class TransactionLogEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  code_gen: string;

  @Column({ type: 'nvarchar', length: 'MAX' })
  json_enviado: string;

  @Column({ length: 50 })
  usuario: string;

  @CreateDateColumn({ type: 'datetime', default: () => 'GETDATE()' })
  fecha_creacion: Date;

  @Column({ length: 30 })
  estatus: string;

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  json_modificacion?: string;

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  motivo_invalidacion?: string;
}

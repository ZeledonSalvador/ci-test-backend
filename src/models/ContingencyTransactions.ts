import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ContingencyTransactions')
export class ContingencyTransactions {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'code_gen', type: 'nvarchar', length: 100 })
  codeGen: string;

  @Column({ name: 'status_id', type: 'int' })
  statusId: number;

  // 👇 Aquí usamos la columna 'payload' para guardar el detalle del error
  @Column({ name: 'payload', type: 'nvarchar', nullable: true, length: 'MAX' })
  errorMessage: string | null;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount: number;

  @Column({ name: 'is_resolved', type: 'bit', default: false })
  isResolved: boolean;

  @Column({ name: 'last_try', type: 'datetime2', nullable: true })
  lastTry: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime2' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime2', nullable: true })
  updatedAt: Date;
}

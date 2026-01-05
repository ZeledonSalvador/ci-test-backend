import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('EmailUsers', { schema: "dbo" })
export class EmailUsers {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  username: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 200})
  email: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  codigo: string | null;

  @Column({ type: 'bit', default: true })
  active: boolean;

  @Column({
    type: 'int',
    comment: '1: Administrador, 2: Gerente de Planta, 3: Cliente, 4: Supervisor de Seguridad',
  })
  id_rol: number;

  @CreateDateColumn({ type: 'datetime', default: () => 'GETDATE()' })
  created_at: Date;
}
// src/models/IngenioLogEntity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity({ name: 'Ingenios_Logs' })
export class IngenioLogEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'codigo_generacion', length: 100 })
  codigoGeneracion: string;

  @Column({ name: 'json_enviado', type: 'nvarchar', length: 'MAX' })
  jsonEnviado: string;

  @Column({ length: 50 })
  usuario: string;

  @CreateDateColumn({
    name: 'fecha_creacion',
    type: 'datetime2',
    precision: 3,
    default: () => 'SYSDATETIME()',
  })
  fechaCreacion: Date;

  @Column({ length: 30 })
  estatus: string;

  @Column({
    name: 'json_modificacion',
    type: 'nvarchar',
    length: 'MAX',
    nullable: true,
  })
  jsonModificacion?: string;

  @Column({
    name: 'motivo_invalidacion',
    type: 'nvarchar',
    length: 'MAX',
    nullable: true,
  })
  motivoInvalidacion?: string;
}

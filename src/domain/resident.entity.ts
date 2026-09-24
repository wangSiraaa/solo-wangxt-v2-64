import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FeePeriod } from './fee-period.entity';

@Entity('residents')
export class Resident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({ type: 'varchar', length: 32, name: 'room_no' })
  roomNo: string;

  @CreateDateColumn({ type: 'date', name: 'admission_date' })
  admissionDate: string;

  @OneToMany(() => FeePeriod, (p) => p.resident)
  feePeriods: FeePeriod[];
}

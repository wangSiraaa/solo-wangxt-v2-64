import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CareLevel } from './enums';

/** 示例费率卡：每等级每日单价（机构示例规则，单位：元/天） */
@Entity('fee_rate_cards')
export class FeeRateCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 8, name: 'care_level' })
  careLevel: CareLevel;

  @Column({ type: 'date', name: 'valid_from' })
  validFrom: string;

  @Column({ type: 'date', name: 'valid_to', nullable: true })
  validTo: string | null;

  /** decimal(10,2)：日单价，经 TypeORM 以字符串读出，再交给 decimal.js */
  @Column({ type: 'numeric', precision: 10, scale: 2, name: 'daily_rate' })
  dailyRate: string;
}

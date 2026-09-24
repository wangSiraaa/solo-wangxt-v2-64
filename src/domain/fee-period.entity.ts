import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CareLevel } from './enums';
import { Resident } from './resident.entity';

/**
 * 费用生效区间（闭区间 [valid_from, valid_to]，valid_to=NULL 表示至今）。
 *
 * 同一天不能出现重叠生效等级：由 PostgreSQL EXCLUDE 约束在数据库层兜底
 *   EXCLUDE USING gist (resident_id WITH =, daterange(valid_from, valid_to, '[]') WITH &&)
 * 应用层同时做区间截断：新等级生效日起，旧区间在生效日前一天截止。
 */
@Entity('fee_periods')
export class FeePeriod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => Resident, (r) => r.feePeriods, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resident_id' })
  resident: Resident;

  @Column({ type: 'uuid', name: 'resident_id' })
  residentId: string;

  @Column({ type: 'date', name: 'valid_from' })
  validFrom: string;

  /** null = 开放区间至今 */
  @Column({ type: 'date', name: 'valid_to', nullable: true })
  validTo: string | null;

  @Column({ type: 'varchar', length: 8, name: 'care_level' })
  careLevel: CareLevel;

  @Column({ type: 'uuid', name: 'source_assessment_id', nullable: true })
  sourceAssessmentId: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}

import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GradeCode } from '../common/enums';

/**
 * 机构示例费用规则（独立判断，不与告知送达结果挂钩）：
 * 每个等级一份按生效日期版本化的日费表。费用分段时，
 * 同等级期间内若跨越日费版本切换日，会被切成不同分段。
 */
@Entity('fee_rate_versions')
@Index(['grade', 'effectiveFrom'], { unique: true })
export class FeeRateVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'grade', type: 'varchar', length: 20 })
  grade: GradeCode;

  /** 该日费生效首日 */
  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: string;

  /** 日费（元/天），numeric 避免浮点 */
  @Column({ name: 'daily_rate', type: 'numeric', precision: 12, scale: 2 })
  dailyRate: string;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;
}

import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { NaPolicy } from '../common/enums';
import { ScaleItem } from './scale-item.entity';
import { ScaleOption } from './scale-option.entity';

/** 示例量表版本（虚构量表，仅作行政流程演示，非医疗诊断） */
@Entity('scale_versions')
export class ScaleVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 量表编码，如 DEMO_ADL */
  @Index({ unique: true })
  @Column({ name: 'code', type: 'varchar', length: 64 })
  code: string;

  /** 版本号，如 1.0.0 */
  @Column({ name: 'version', type: 'varchar', length: 32 })
  version: string;

  @Column({ name: 'title', type: 'varchar', length: 200 })
  title: string;

  @Column({ name: 'description', type: 'text' })
  description: string;

  /** 固定声明：虚构量表，不构成医疗诊断或真实护理建议 */
  @Column({ name: 'disclaimer', type: 'text' })
  disclaimer: string;

  /** 不适用项如何影响分母 —— 由量表定义 */
  @Column({
    name: 'na_policy',
    type: 'varchar',
    length: 32,
    default: NaPolicy.EXCLUDE_FROM_DENOMINATOR,
  })
  naPolicy: NaPolicy;

  /** 定级阈值，百分比得分区间，按等级顺序判定 [{grade,minScorePct}] */
  @Column({ name: 'grade_thresholds', type: 'jsonb', default: [] })
  gradeThresholds: { grade: string; minScorePct: number }[];

  @Column({ name: 'published_at', type: 'date' })
  publishedAt: string;

  @OneToMany(() => ScaleItem, (item) => item.scaleVersion, {
    cascade: true,
  })
  items: ScaleItem[];

  @OneToMany(() => ScaleOption, (option) => option.scaleVersion, {
    cascade: true,
  })
  options: ScaleOption[];
}

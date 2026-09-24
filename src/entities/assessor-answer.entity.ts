import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AssessmentCase } from './assessment-case.entity';

/** 单条原始作答：保留评估员选择的原始选项编码、原始分值快照 */
@Entity('assessor_answers')
@Index(['assessmentCase', 'assessorId', 'itemCode'], { unique: true })
export class AssessorAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => AssessmentCase, (c) => c.answers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assessment_case_id' })
  assessmentCase: AssessmentCase;

  /** 评估员序号：1 或 2 */
  @Column({ name: 'assessor_id', type: 'int' })
  assessorId: number;

  @Column({ name: 'item_code', type: 'varchar', length: 64 })
  itemCode: string;

  /** 原始选项编码（含 NA）；缺失项无作答记录 */
  @Column({ name: 'option_code', type: 'varchar', length: 64 })
  optionCode: string;

  /** 分值快照，NA 为 null */
  @Column({ name: 'score', type: 'int', nullable: true })
  score: number | null;

  /** 是否不适用 */
  @Column({ name: 'na', type: 'boolean', default: false })
  na: boolean;
}

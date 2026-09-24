import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CareLevel } from './enums';
import { Assessment } from './assessment.entity';

/**
 * 管理复核意见。
 * 规则：两位评估员等级冲突时进入复核；复核不能简单取较高等级，
 * 必须由复核员给出最终等级、依据条目和书面理由。
 */
@Entity('review_decisions')
export class ReviewDecision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Assessment, (a) => a.review, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assessment_id' })
  assessment: Assessment;

  @Column({ type: 'uuid', name: 'assessment_id' })
  assessmentId: string;

  @Column({ type: 'varchar', length: 64, name: 'reviewer_name' })
  reviewerName: string;

  /** 复核员裁定的最终等级（必须显式给出） */
  @Column({ type: 'varchar', length: 8, name: 'decided_level' })
  decidedLevel: CareLevel;

  /** 裁定依据的条目及说明，例如 { EAT: '结合两次走访录像，以第二次为准' } */
  @Column({ type: 'jsonb', name: 'basis_items' })
  basisItems: Record<string, string>;

  /** 书面理由 */
  @Column({ type: 'text' })
  rationale: string;

  /**
   * 复核员裁定后，服务端用同一份量表定义对裁定依据重算的结果，
   * 用于校验裁定等级是否与重算等级一致（防止“拍脑袋取高等级”）。
   */
  @Column({ type: 'jsonb', name: 'reconciled_score' })
  reconciledScore: import('./assessment.entity').AssessorScore;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AssessmentStatus, CareLevel, ConfirmationKind } from './enums';
import { Resident } from './resident.entity';
import { ReviewDecision } from './review-decision.entity';

export interface AssessorResponse {
  assessorName: string;
  /** itemCode -> 原始选项 key；必填条目缺失会导致整单 INCOMPLETE */
  answers: Record<string, string>;
  /** 服务端按量表定义重算，禁止客户端自报分数/等级 */
  computed?: AssessorScore;
}

export interface ItemScoreDetail {
  itemCode: string;
  required: boolean;
  selectedOption: string | null;
  na: boolean;
  /** 该条目是否计入分母（NA 条目不计入） */
  counted: boolean;
  optionScore: number | null;
  itemMaxScore: number | null;
}

export interface AssessorScore {
  rawScore: number;
  /** 量表自定义 NA 策略下的分母（条目最大分之和） */
  denominator: number;
  /** 分母条目数（计入分母的条目数） */
  countedItems: number;
  naItems: string[];
  percentage: number;
  level: CareLevel;
  details: ItemScoreDetail[];
  /** 未能定级的原因（必填缺失等） */
  reason?: string;
  missingRequired: string[];
}

export interface MissingField {
  assessorName: string;
  itemCode: string;
}

@Entity('assessments')
export class Assessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Resident, { eager: false })
  @JoinColumn({ name: 'resident_id' })
  resident: Resident;

  @Column({ type: 'uuid', name: 'resident_id' })
  residentId: string;

  @Column({ type: 'varchar', length: 32, name: 'scale_code' })
  scaleCode: string;

  /** 家属告知联系方式（确认时据此生成告知记录） */
  @Column({ type: 'jsonb', name: 'family_contact', nullable: true })
  familyContact: { name: string; channel: string; address: string } | null;

  @Column({ type: 'varchar', length: 20 })
  status: AssessmentStatus;

  /** 两位评估员的原始作答（原始选项 key 原样留存，便于解释评分来源） */
  @Column({ type: 'jsonb', name: 'responses' })
  responses: AssessorResponse[];

  /** 服务端按量表版本重算的两份评分明细 */
  @Column({ type: 'jsonb', name: 'score_results', nullable: true })
  scoreResults: AssessorScore[];

  /** 冲突原因等说明 */
  @Column({ type: 'jsonb', name: 'missing_fields', nullable: true })
  missingFields: MissingField[] | null;

  @Column({ type: 'varchar', length: 255, name: 'hold_reason', nullable: true })
  holdReason: string | null;

  /** 无冲突时两位评估员一致的等级；有冲突时为 null，绝不简单取较高等级 */
  @Column({ type: 'varchar', length: 8, name: 'proposed_level', nullable: true })
  proposedLevel: CareLevel | null;

  /** 最终确认等级（确认前为 null） */
  @Column({ type: 'varchar', length: 8, name: 'confirmed_level', nullable: true })
  confirmedLevel: CareLevel | null;

  @Column({ type: 'varchar', length: 16, name: 'confirmation_kind', nullable: true })
  confirmationKind: ConfirmationKind | null;

  @Column({ type: 'date', name: 'effective_date', nullable: true })
  effectiveDate: string | null;

  @Column({ type: 'timestamptz', name: 'confirmed_at', nullable: true })
  confirmedAt: Date | null;

  @OneToOne(() => ReviewDecision, (r) => r.assessment)
  review: ReviewDecision;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}

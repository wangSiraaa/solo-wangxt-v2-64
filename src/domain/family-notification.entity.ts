import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CareLevel, NotificationStatus } from './enums';
import { Resident } from './resident.entity';

/**
 * 家属告知记录。
 * - 等级确认后即生成（与送达状态分开记录）
 * - 尚未确认/尚未送达 -> PENDING
 * - 送达失败     -> DELIVERY_FAILED（保留失败原因，可重试）
 * - 送达与家属签收是两个独立状态：DELIVERED 后仍需 ACKNOWLEDGED
 */
@Entity('family_notifications')
export class FamilyNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => Resident, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resident_id' })
  resident: Resident;

  @Column({ type: 'uuid', name: 'resident_id' })
  residentId: string;

  @Column({ type: 'uuid', name: 'assessment_id' })
  assessmentId: string;

  @Column({ type: 'varchar', length: 64, name: 'contact_name' })
  contactName: string;

  @Column({ type: 'varchar', length: 64, name: 'channel' })
  channel: string;

  @Column({ type: 'varchar', length: 64, name: 'channel_address' })
  channelAddress: string;

  @Column({ type: 'varchar', length: 8, name: 'care_level' })
  careLevel: CareLevel;

  @Column({ type: 'date', name: 'effective_date' })
  effectiveDate: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 20 })
  status: NotificationStatus;

  @Column({ type: 'int', name: 'attempt_count', default: 0 })
  attemptCount: number;

  @Column({ type: 'text', name: 'last_error', nullable: true })
  lastError: string | null;

  @Column({ type: 'timestamptz', name: 'delivered_at', nullable: true })
  deliveredAt: Date | null;

  @Column({ type: 'timestamptz', name: 'acknowledged_at', nullable: true })
  acknowledgedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}

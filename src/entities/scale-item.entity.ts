import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ScaleVersion } from './scale-version.entity';

@Entity('scale_items')
@Index(['scaleVersion', 'code'], { unique: true })
export class ScaleItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ScaleVersion, (sv) => sv.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scale_version_id' })
  scaleVersion: ScaleVersion;

  /** 题目编码，如 BATHING */
  @Column({ name: 'code', type: 'varchar', length: 64 })
  code: string;

  @Column({ name: 'label', type: 'varchar', length: 200 })
  label: string;

  @Column({ name: 'order_index', type: 'int' })
  orderIndex: number;

  /** 是否必填项；必填项缺失不得自动定级 */
  @Column({ name: 'required', type: 'boolean', default: true })
  required: boolean;

  /** 该题是否允许选择“不适用”（NA 是否被量表接纳由此定义） */
  @Column({ name: 'allows_na', type: 'boolean', default: false })
  allowsNa: boolean;
}

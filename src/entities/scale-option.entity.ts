import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ScaleVersion } from './scale-version.entity';
import { ScaleItem } from './scale-item.entity';

/** 量表原始选项（评估答案只引用选项编码，原始选项文本保留在此） */
@Entity('scale_options')
@Index(['scaleVersion', 'item', 'code'], { unique: true })
export class ScaleOption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ScaleVersion, (sv) => sv.options, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scale_version_id' })
  scaleVersion: ScaleVersion;

  @ManyToOne(() => ScaleItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item: ScaleItem;

  /** 选项编码，如 INDEPENDENT / NA */
  @Column({ name: 'code', type: 'varchar', length: 64 })
  code: string;

  @Column({ name: 'label', type: 'varchar', length: 200 })
  label: string;

  /** 原始分值；NA 记 null（不参与分母，由量表 naPolicy 决定） */
  @Column({ name: 'score', type: 'int', nullable: true })
  score: number | null;

  @Column({ name: 'order_index', type: 'int', default: 0 })
  orderIndex: number;
}

import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * 量表版本（示例虚构量表 FCRS：Fictional Care Rating Scale）。
 * 量表定义自行决定：
 *  - 每条原始选项的分值
 *  - 哪些条目必填（必填项缺失 -> INCOMPLETE，绝不自动定级）
 *  - 不适用(NA)如何影响分母：NA 条目从分母（可选条目数）和分子中同时剔除
 *  - 百分比到等级的映射阈值
 */
@Entity('scale_versions')
export class ScaleVersion {
  /** 形如 'FCRS-1.0' */
  @PrimaryColumn({ type: 'varchar', length: 32 })
  code: string;

  @Column({ type: 'varchar', length: 128 })
  title: string;

  /** 量表条目定义，结构见 seed */
  @Column({ type: 'jsonb' })
  items: ScaleItemDef[];

  /** 百分比（0~100，含边界规则）到等级的映射 */
  @Column({ type: 'jsonb' })
  bands: ScaleBand[];

  /** NA 如何影响分母：由量表自定义。这里仅支持一种演示策略 */
  @Column({ type: 'varchar', length: 32, name: 'na_policy' })
  naPolicy: 'EXCLUDE_FROM_DENOMINATOR';
}

export interface ScaleOptionDef {
  key: string;
  label: string;
  score: number;
}

export interface ScaleItemDef {
  code: string;
  label: string;
  /** false 的条目允许 NA；true 的必填条目不允许 NA、也不允许缺失 */
  required: boolean;
  /** 原始选项（分值由量表定义，不由评估员填写） */
  options: ScaleOptionDef[];
}

export interface ScaleBand {
  /** 最低百分比（含） */
  minInclusive: number;
  /** 最高百分比（不含），最后一档可为 100.001 */
  maxExclusive: number;
  level: string;
  label: string;
}

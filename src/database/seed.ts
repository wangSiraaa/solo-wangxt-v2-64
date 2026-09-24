/**
 * 演示数据：虚构量表 DEMO_ADL v1.0.0
 * 仅用于行政流程演示，不构成医疗诊断或真实护理建议。
 */
import { DataSource } from 'typeorm';
import { GradeCode, NaPolicy } from '../common/enums';
import { ScaleVersion } from '../entities/scale-version.entity';
import { ScaleItem } from '../entities/scale-item.entity';
import { ScaleOption } from '../entities/scale-option.entity';
import { FeeRateVersion } from '../entities/fee-rate-version.entity';

const DISCLAIMER =
  '本量表为虚构演示量表，仅用于行政流程（评估-复核-告知-费用）演示，' +
  '不构成医疗诊断、护理分级依据或真实护理建议。';

/** 10 个虚构 ADL 条目，每项 0~3 分（3=完全依赖），部分条目允许 NA */
const ITEM_DEFS: {
  code: string;
  label: string;
  required: boolean;
  allowsNa: boolean;
}[] = [
  { code: 'TRANSFER', label: '床椅转移', required: true, allowsNa: false },
  { code: 'WALKING', label: '室内行走', required: true, allowsNa: false },
  { code: 'BATHING', label: '洗澡', required: true, allowsNa: false },
  { code: 'DRESSING', label: '穿脱衣物', required: true, allowsNa: false },
  { code: 'TOILETING', label: '如厕', required: true, allowsNa: false },
  { code: 'EATING', label: '进食', required: true, allowsNa: false },
  { code: 'CONTINENCE', label: '大小便控制', required: true, allowsNa: false },
  { code: 'GROOMING', label: '个人整洁', required: true, allowsNa: false },
  { code: 'STAIRS', label: '上下楼梯', required: true, allowsNa: true },
  { code: 'OUTDOOR', label: '户外活动', required: false, allowsNa: true },
];

const OPTIONS_COMMON: { code: string; label: string; score: number | null }[] =
  [
    { code: 'INDEPENDENT', label: '独立完成', score: 0 },
    { code: 'SOME_HELP', label: '部分协助', score: 1 },
    { code: 'MUCH_HELP', label: '大量协助', score: 2 },
    { code: 'TOTAL_DEP', label: '完全依赖', score: 3 },
  ];

/** 机构示例日费规则（元/天），按等级 × 版本起始日 */
const FEE_RATES: {
  grade: GradeCode;
  effectiveFrom: string;
  dailyRate: string;
  note: string;
}[] = [
  { grade: GradeCode.LIGHT, effectiveFrom: '2000-01-01', dailyRate: '100.00', note: '基础日费' },
  { grade: GradeCode.MODERATE, effectiveFrom: '2000-01-01', dailyRate: '180.00', note: '基础日费' },
  { grade: GradeCode.SEVERE, effectiveFrom: '2000-01-01', dailyRate: '260.00', note: '基础日费' },
  // 示例调价：2024-01-01 起中度/重度日费上调（用于验证同等级跨版本分段）
  { grade: GradeCode.MODERATE, effectiveFrom: '2024-01-01', dailyRate: '200.00', note: '2024 年度调价' },
  { grade: GradeCode.SEVERE, effectiveFrom: '2024-01-01', dailyRate: '300.00', note: '2024 年度调价' },
];

export async function seedDemoData(dataSource: DataSource): Promise<void> {
  const svRepo = dataSource.getRepository(ScaleVersion);
  const feeRepo = dataSource.getRepository(FeeRateVersion);

  const existing = await svRepo.findOne({ where: { code: 'DEMO_ADL' } });
  if (existing) return; // 幂等

  const scale = new ScaleVersion();
  scale.code = 'DEMO_ADL';
  scale.version = '1.0.0';
  scale.title = '演示性日常生活活动量表（虚构）';
  scale.description =
    '10 项虚构 ADL 条目，0~3 分制；百分比得分 = 实得分 / 有效分母（NA 按量表定义剔除）。';
  scale.disclaimer = DISCLAIMER;
  scale.naPolicy = NaPolicy.EXCLUDE_FROM_DENOMINATOR;
  // 百分比区间（下闭上开，最高档封顶 100%）：
  //   <40% 轻度；[40%,70%) 中度；>=70% 重度
  scale.gradeThresholds = [
    { grade: GradeCode.SEVERE, minScorePct: 70 },
    { grade: GradeCode.MODERATE, minScorePct: 40 },
    { grade: GradeCode.LIGHT, minScorePct: 0 },
  ];
  scale.publishedAt = '2023-01-01';
  scale.items = [];
  scale.options = [];

  ITEM_DEFS.forEach((def, idx) => {
    const item = new ScaleItem();
    item.code = def.code;
    item.label = def.label;
    item.orderIndex = idx;
    item.required = def.required;
    item.allowsNa = def.allowsNa;
    scale.items.push(item);
  });

  for (const def of ITEM_DEFS) {
    const item = scale.items.find((i) => i.code === def.code)!;
    for (const opt of OPTIONS_COMMON) {
      const o = new ScaleOption();
      o.item = item;
      o.code = opt.code;
      o.label = opt.label;
      o.score = opt.score;
      o.orderIndex = opt.score!;
      scale.options.push(o);
    }
    if (def.allowsNa) {
      const na = new ScaleOption();
      na.item = item;
      na.code = 'NA';
      na.label = '不适用';
      na.score = null;
      na.orderIndex = 99;
      scale.options.push(na);
    }
  }

  await svRepo.save(scale);

  for (const r of FEE_RATES) {
    const f = new FeeRateVersion();
    f.grade = r.grade;
    f.effectiveFrom = r.effectiveFrom;
    f.dailyRate = r.dailyRate;
    f.note = r.note;
    await feeRepo.save(f);
  }
}

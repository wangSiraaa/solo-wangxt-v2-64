import { ScaleItemDef } from '../domain/scale-version.entity';
import { AssessorResponse, AssessorScore, ItemScoreDetail, MissingField } from '../domain/assessment.entity';
import { CareLevel } from '../domain/enums';

/**
 * 虚构量表 FCRS 的评分引擎。
 *
 * 关键规则（均由“量表定义”决定，而非评估员或管理端自报）：
 * 1. 必填条目（item.required=true）缺失或被标 NA -> 收集为缺失项，禁止自动定级；
 * 2. 不适用(NA) 如何影响分母：策略 EXCLUDE_FROM_DENOMINATOR ——
 *    NA 条目同时从分子与分母剔除；可选条目未作答视同 NA；
 * 3. 百分比 = 实得分 / 计入分母条目满分之和 × 100，按 bands 映射等级；
 * 4. 等级由服务端依据原始选项 key 重算，客户端无法自报分数或等级。
 */
export function scoreAssessor(
  items: ScaleItemDef[],
  bands: { minInclusive: number; maxExclusive: number; level: string; label: string }[],
  assessor: AssessorResponse,
): { score: AssessorScore; missing: MissingField[] } {
  const answers = assessor.answers ?? {};
  const details: ItemScoreDetail[] = [];
  const missing: MissingField[] = [];
  const naItems: string[] = [];
  let rawScore = 0;
  let denominator = 0;
  let countedItems = 0;

  for (const item of items) {
    const raw = answers[item.code];
    const selected = raw == null ? null : String(raw);
    const option = selected ? item.options.find((o) => o.key === selected) : null;
    const isNa = selected === 'NA';

    // 必填项：缺失或标 NA 都算缺失（NA 只对可选条目有意义）
    if (item.required && (!selected || isNa || !option)) {
      missing.push({ assessorName: assessor.assessorName, itemCode: item.code });
      details.push({
        itemCode: item.code,
        required: true,
        selectedOption: selected,
        na: false,
        counted: false,
        optionScore: null,
        itemMaxScore: itemMax(item),
      });
      continue;
    }

    if (!selected || isNa) {
      // 可选条目未作答 / 明确 NA：按量表 NA 策略剔除出分母
      naItems.push(item.code);
      details.push({
        itemCode: item.code,
        required: false,
        selectedOption: selected,
        na: true,
        counted: false,
        optionScore: null,
        itemMaxScore: itemMax(item),
      });
      continue;
    }

    if (!option) {
      // 选了量表中不存在的原始选项 key，按缺失必填处理（可选项则按缺失但不入分母）
      if (item.required) {
        missing.push({ assessorName: assessor.assessorName, itemCode: item.code });
      }
      details.push({
        itemCode: item.code,
        required: item.required,
        selectedOption: selected,
        na: false,
        counted: false,
        optionScore: null,
        itemMaxScore: itemMax(item),
      });
      continue;
    }

    rawScore += option.score;
    denominator += itemMax(item);
    countedItems += 1;
    details.push({
      itemCode: item.code,
      required: item.required,
      selectedOption: selected,
      na: false,
      counted: true,
      optionScore: option.score,
      itemMaxScore: itemMax(item),
    });
  }

  let level: CareLevel | null = null;
  let reason: string | undefined;
  let percentage: number | null = null;

  if (missing.length > 0) {
    reason = '必填项缺失，按量表规则不得自动定级';
  } else if (denominator === 0) {
    reason = '所有可选条目均不适用且无必填得分项，无法计算分母';
  } else {
    percentage = Math.round((rawScore / denominator) * 10000) / 100;
    const band = bands.find(
      (b) => percentage >= b.minInclusive && percentage < b.maxExclusive,
    );
    if (!band) {
      reason = `百分比 ${percentage}% 未落入量表任何等级区间`;
    } else {
      level = band.level as CareLevel;
    }
  }

  return {
    score: {
      rawScore,
      denominator,
      countedItems,
      naItems,
      percentage,
      level,
      details,
      reason,
      missingRequired: missing.map((m) => m.itemCode),
    },
    missing,
  };
}

/** 条目满分 = 该条目原始选项中的最高分值（分值由量表定义） */
function itemMax(item: ScaleItemDef): number {
  return Math.max(...item.options.map((o) => o.score));
}

export const LEVEL_ORDER: CareLevel[] = [CareLevel.L0, CareLevel.L1, CareLevel.L2, CareLevel.L3];

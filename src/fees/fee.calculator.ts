import Decimal from 'decimal.js';
import { FeeRateCard } from '../domain/fee-rate-card.entity';
import { FeePeriod } from '../domain/fee-period.entity';
import { inclusiveDays, maxDate, minDate, toISODate } from './date.util';

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

export interface FeeSegment {
  /** 分段区间（闭区间） */
  validFrom: string;
  validTo: string;
  days: number;
  careLevel: string;
  dailyRate: string;
  /** 按天小计（四舍五入到分，HALF_UP） */
  amount: string;
  /** 评分/等级来源评估单 */
  sourceAssessmentId: string | null;
}

export interface FeeQuote {
  residentId: string;
  monthStart: string;
  monthEnd: string;
  segments: FeeSegment[];
  /** 各分段小计之和 */
  totalAmount: string;
  currency: string;
  note: string;
}

/**
 * 按天分段计费（机构示例规则）：
 * - 账单月内每一天都必须恰好落在一个生效等级区间内，且当天不允许重叠；
 * - 与生效区间相交的每一天，按该区间生效日的等级对应费率卡取价；
 * - 金额 = 日单价 × 相交天数，decimal.js HALF_UP 到 0.01；
 * - 闰月天数（29 天）通过 UTC 日期差自然得出，不依赖“30 天/月”假设。
 */
export function quoteMonthlyFees(
  residentId: string,
  monthStart: string,
  monthEnd: string,
  periods: FeePeriod[],
  rateCards: FeeRateCard[],
): FeeQuote {
  const sorted = [...periods].sort((a, b) => a.validFrom.localeCompare(b.validFrom));

  // 1) 校验：同一天不能出现重叠生效等级
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const prevTo = prev.validTo ?? '9999-12-31';
    if (cur.validFrom <= prevTo) {
      throw new Error(
        `同一老人 ${residentId} 的费用生效区间在 ${cur.validFrom} 重叠（${prev.careLevel} 与 ${cur.careLevel}）`,
      );
    }
  }

  // 2) 覆盖完整性：账单月每一天都要有等级
  const covering = sorted.filter(
    (p) => (p.validTo ?? '9999-12-31') >= monthStart && p.validFrom <= monthEnd,
  );
  if (covering.length === 0 || covering[0].validFrom > monthStart) {
    throw new Error(`账单区间 ${monthStart}~${monthEnd} 起始处没有生效等级`);
  }
  for (let i = 1; i < covering.length; i++) {
    const prevTo = covering[i - 1].validTo;
    if (!prevTo || addOneISO(prevTo) !== covering[i].validFrom) {
      throw new Error(
        `账单区间在 ${prevTo ?? ''} 之后、${covering[i].validFrom} 之前存在没有等级的空档日`,
      );
    }
  }
  const last = covering[covering.length - 1];
  if (last.validTo && last.validTo < monthEnd) {
    throw new Error(`账单区间 ${last.validTo} 之后没有开放等级区间，无法计费`);
  }

  // 3) 逐区间与账单月求交，按天分段
  const segments: FeeSegment[] = [];
  for (const p of covering) {
    const segFrom = maxDate(p.validFrom, monthStart);
    const segTo = minDate(p.validTo ?? monthEnd, monthEnd);
    if (segFrom > segTo) continue;
    const days = inclusiveDays(segFrom, segTo);
    const rate = pickRate(rateCards, p.careLevel, segFrom);
    if (!rate) {
      throw new Error(`等级 ${p.careLevel} 在 ${segFrom} 没有有效费率卡`);
    }
    const amount = new Decimal(rate.dailyRate).mul(days).toFixed(2);
    segments.push({
      validFrom: segFrom,
      validTo: segTo,
      days,
      careLevel: p.careLevel,
      dailyRate: rate.dailyRate,
      amount,
      sourceAssessmentId: p.sourceAssessmentId,
    });
  }

  const totalAmount = segments
    .reduce((acc, s) => acc.plus(new Decimal(s.amount)), new Decimal(0))
    .toFixed(2);

  return {
    residentId,
    monthStart,
    monthEnd,
    segments,
    totalAmount,
    currency: 'CNY',
    note: '虚构机构示例规则：日单价 × 区间内自然日数，HALF_UP 保留两位小数',
  };
}

/** 取某日生效的费率卡（valid_from <= day 且 valid_to 为空或 >= day） */
function pickRate(
  cards: FeeRateCard[],
  level: string,
  day: string,
): FeeRateCard | undefined {
  return cards
    .filter((c) => c.careLevel === level && c.validFrom <= day && (!c.validTo || c.validTo >= day))
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
}

function addOneISO(s: string): string {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return toISODate(d);
}

export function monthRange(yearMonth: string): { start: string; end: string } {
  const [y, m] = yearMonth.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const end = toISODate(new Date(Date.UTC(y, m, 0))); // UTC 下当月最后一天，闰月自动 29 天
  return { start, end };
}

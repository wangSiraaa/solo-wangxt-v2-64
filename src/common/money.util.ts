import Decimal from 'decimal.js';

// 全部金额计算走 decimal.js，避免浮点误差；统一两位小数 ROUND_HALF_UP（元）
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/** 元（两位小数字符串）-> Decimal */
export function money(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

/** 日费 × 天数 */
export function dailyTimesRate(rate: Decimal.Value, days: number): Decimal {
  return new Decimal(rate).mul(days);
}

/** 规范金额输出（字符串，保留两位小数，避免前端出现 0.30000000004） */
export function moneyText(value: Decimal.Value): string {
  return new Decimal(value).toFixed(2);
}

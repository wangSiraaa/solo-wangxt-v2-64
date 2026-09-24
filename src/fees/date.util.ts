/** 全程按 UTC“日期”运算，避免时区把日期偏移一天 */

export function toISODate(d: Date | string): string {
  if (typeof d === 'string') return d;
  return d.toISOString().slice(0, 10);
}

export function parseDate(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

/** 闭区间 [a, b] 的天数；闰月（如 2024-02 共 29 天）由 UTC 日期差自然得出 */
export function inclusiveDays(from: string, to: string): number {
  const ms = parseDate(to).getTime() - parseDate(from).getTime();
  return Math.round(ms / 86400000) + 1;
}

export function addDays(s: string, days: number): string {
  const d = parseDate(s);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

export function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

export function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

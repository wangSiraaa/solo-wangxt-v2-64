/**
 * 纯日历日工具：所有日期统一用 'YYYY-MM-DD' 字符串处理，
 * 避免 JS Date 时区漂移导致的天数误差（闰月等边界场景尤其重要）。
 */

/** 校验公历日期合法（含闰年 2 月 29 日校验） */
export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > daysInMonth(y, m)) return false;
  return true;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  const dim = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month === 2 && isLeapYear(year) ? 29 : dim[month - 1];
}

function toParts(s: string): [number, number, number] {
  const [y, m, d] = s.split('-').map(Number);
  return [y, m, d];
}

/** 以 UTC 构造一个“纯日期” Date（仅用于大小比较/加减，不做展示） */
function toUtcDate(s: string): Date {
  const [y, m, d] = toParts(s);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(s: string, n: number): string {
  const d = toUtcDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return formatUtc(d);
}

/** 相差天数 a - b */
export function diffDays(a: string, b: string): number {
  const ms = toUtcDate(a).getTime() - toUtcDate(b).getTime();
  return Math.round(ms / 86_400_000);
}

/** 闭区间 [start, end] 的天数（含首尾） */
export function inclusiveDays(start: string, end: string): number {
  return diffDays(end, start) + 1;
}

export function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

export function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

/** 两个闭区间是否重叠（同一天即算重叠） */
export function overlaps(
  aStart: string,
  aEnd: string | null,
  bStart: string,
  bEnd: string | null,
): boolean {
  const ae = aEnd ?? '9999-12-31';
  const be = bEnd ?? '9999-12-31';
  return aStart <= be && bStart <= ae;
}

/** 求两个闭区间交集；无交集返回 null */
export function intersect(
  aStart: string,
  aEnd: string | null,
  bStart: string,
  bEnd: string | null,
): { start: string; end: string } | null {
  const ae = aEnd ?? '9999-12-31';
  const be = bEnd ?? '9999-12-31';
  const s = maxDate(aStart, bStart);
  const e = minDate(ae, be);
  if (s > e) return null;
  return { start: s, end: e };
}

function formatUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

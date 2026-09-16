// 日付は常にローカル時刻の YYYY-MM-DD 文字列で扱う。
// 計算時は UTC の 0 時として解釈し、タイムゾーンや夏時間のずれを避ける。

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayString(now: Date = new Date()): string {
  return toDateString(now);
}

export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** YYYY-MM-DD を UTC 0 時のエポックミリ秒に変換（グラフの X 軸用） */
export function dateToTime(value: string): number {
  const [y, m, d] = value.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function timeToDate(time: number): string {
  const d = new Date(time);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(value: string, days: number): string {
  return timeToDate(dateToTime(value) + days * DAY_MS);
}

/** to - from の日数 */
export function diffDays(from: string, to: string): number {
  return Math.round((dateToTime(to) - dateToTime(from)) / DAY_MS);
}

/** 9/14(月) */
export function formatShort(value: string): string {
  const d = new Date(dateToTime(value));
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEKDAYS[d.getUTCDay()]})`;
}

/** 2026年9月14日(月) */
export function formatLong(value: string): string {
  const d = new Date(dateToTime(value));
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日(${WEEKDAYS[d.getUTCDay()]})`;
}

/** 9/14 */
export function formatMonthDay(time: number): string {
  const d = new Date(time);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

/** ISO 日時をローカル時刻で 2026/9/14 08:30 形式にする */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export { DAY_MS };

// 日期鍵一律是本地時間的 'YYYY-MM-DD' 字串。
// 「日切換時間」讓凌晨的宵夜算前一天：cutoffHour=4 時，03:59 仍屬前一天。

export type DateKey = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function dateKeyOf(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 依日切換時間算出某個時刻屬於哪一天 */
export function toDateKey(ts: number | Date, cutoffHour = 0): DateKey {
  const d = new Date(typeof ts === 'number' ? ts : ts.getTime());
  if (d.getHours() < cutoffHour) d.setDate(d.getDate() - 1);
  return dateKeyOf(d);
}

export function todayKey(cutoffHour = 0, now: number = Date.now()): DateKey {
  return toDateKey(now, cutoffHour);
}

export function parseDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function isDateKey(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return dateKeyOf(parseDateKey(s)) === s;
}

export function addDays(key: DateKey, n: number): DateKey {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + n);
  return dateKeyOf(d);
}

/** b − a 的天數（以日曆日計，不受夏令時間影響） */
export function diffDays(a: DateKey, b: DateKey): number {
  const ua = Date.UTC(...ymd(a));
  const ub = Date.UTC(...ymd(b));
  return Math.round((ub - ua) / 86_400_000);
}

function ymd(key: DateKey): [number, number, number] {
  const [y, m, d] = key.split('-').map(Number);
  return [y ?? 1970, (m ?? 1) - 1, d ?? 1];
}

/** weekStart：0=週日、1=週一 */
export function startOfWeek(key: DateKey, weekStart = 1): DateKey {
  const dow = parseDateKey(key).getDay();
  const back = (dow - weekStart + 7) % 7;
  return addDays(key, -back);
}

/** 含頭含尾的日期清單 */
export function rangeKeys(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  const n = diffDays(from, to);
  for (let i = 0; i <= n; i++) out.push(addDays(from, i));
  return out;
}

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];

export function weekdayLabel(key: DateKey): string {
  return `週${WEEKDAY[parseDateKey(key).getDay()]}`;
}

/** 例如「10/24（週五）」 */
export function shortDateLabel(key: DateKey): string {
  const d = parseDateKey(key);
  return `${d.getMonth() + 1}/${d.getDate()}（${weekdayLabel(key)}）`;
}

export function relativeDayLabel(key: DateKey, today: DateKey): string {
  const n = diffDays(key, today);
  if (n === 0) return '今天';
  if (n === 1) return '昨天';
  if (n === 2) return '前天';
  if (n > 0 && n < 7) return `${n} 天前`;
  return shortDateLabel(key);
}

export function ageFromBirthYear(birthYear: number, today: DateKey): number {
  return parseDateKey(today).getFullYear() - birthYear;
}

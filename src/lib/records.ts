import type { BodyRecord } from '../types';
import { METRIC_ORDER } from './metrics';

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function sortRecords(records: BodyRecord[]): BodyRecord[] {
  return [...records].sort((a, b) => a.date.localeCompare(b.date));
}

export function findByDate(records: BodyRecord[], date: string): BodyRecord | undefined {
  return records.find((r) => r.date === date);
}

/**
 * 記録を保存する。
 * - 同じ id があれば置き換える（編集）
 * - 別の記録が同じ日付を持っていれば、その記録は取り除く（上書き。呼び出し側で確認済みの前提）
 * 結果は日付の昇順。
 */
export function upsertRecord(records: BodyRecord[], record: BodyRecord): BodyRecord[] {
  const rest = records.filter((r) => r.id !== record.id && r.date !== record.date);
  return sortRecords([...rest, record]);
}

export function removeRecord(records: BodyRecord[], id: string): BodyRecord[] {
  return records.filter((r) => r.id !== id);
}

/** 日付と測定値がすべて同じか（id は見ない） */
export function sameMeasurements(a: BodyRecord, b: BodyRecord): boolean {
  return a.date === b.date && METRIC_ORDER.every((key) => a[key] === b[key]);
}

/**
 * 全体を置き換える操作（復元・全削除など）を取り消した結果の記録。
 * 取り消せるあいだに別の画面が加えた変更（追加・更新・削除）は、巻き戻さずに残す。
 *
 * @param base    操作前の記録（戻したい内容）
 * @param applied 操作が書き込んだ記録
 * @param current いま保存されている記録
 * @returns records 戻した結果 / kept 残した（操作のあとの）変更の件数
 */
export function undoReplaceRecords(
  base: BodyRecord[],
  applied: BodyRecord[],
  current: BodyRecord[],
): { records: BodyRecord[]; kept: number } {
  const appliedByDate = new Map(applied.map((r) => [r.date, r]));
  const currentDates = new Set(current.map((r) => r.date));
  const byDate = new Map(base.map((r) => [r.date, r]));
  let kept = 0;

  // 操作のあとに別の画面が削除した記録（操作が書き込んだのに、いまはない日付）は復活させない
  for (const record of applied) {
    if (!currentDates.has(record.date) && byDate.delete(record.date)) kept++;
  }

  for (const record of current) {
    const written = appliedByDate.get(record.date);
    // 操作が書き込んだままの記録は、元の内容に戻す
    if (written && sameMeasurements(written, record)) continue;
    byDate.set(record.date, record);
    kept++;
  }

  return { records: sortRecords([...byDate.values()]), kept };
}

/** 指定日より前で最も新しい記録 */
export function previousRecord(records: BodyRecord[], date: string): BodyRecord | undefined {
  let prev: BodyRecord | undefined;
  for (const r of sortRecords(records)) {
    if (r.date < date) prev = r;
    else break;
  }
  return prev;
}

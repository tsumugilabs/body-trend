import type { BodyRecord } from '../types';

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

/** 指定日より前で最も新しい記録 */
export function previousRecord(records: BodyRecord[], date: string): BodyRecord | undefined {
  let prev: BodyRecord | undefined;
  for (const r of sortRecords(records)) {
    if (r.date < date) prev = r;
    else break;
  }
  return prev;
}

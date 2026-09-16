import { describe, expect, it } from 'vitest';
import type { BodyRecord, GoalSettings } from '../types';
import { backupFileName, createBackup, isBackupDue, parseBackup } from './backup';

const records: BodyRecord[] = [
  { id: 'a', date: '2026-09-01', weight: 72.1, bodyFat: 26 },
  { id: 'b', date: '2026-09-02', weight: 71.8 },
];
const goal: GoalSettings = { startDate: '2026-09-01', targetDate: '2026-12-01', targetWeight: 65 };

describe('backup', () => {
  it('書き出したバックアップをそのまま読み込める', () => {
    const text = createBackup(records, goal, new Date('2026-09-14T01:00:00Z'));
    const result = parseBackup(text);
    expect(result).toEqual({
      ok: true,
      data: { records, goal, exportedAt: '2026-09-14T01:00:00.000Z', skipped: 0 },
    });
    expect(backupFileName('2026-09-14')).toBe('body-trend-backup-2026-09-14.json');
  });

  it('形式が違うファイルはエラーにする', () => {
    expect(parseBackup('not json').ok).toBe(false);
    expect(parseBackup('[]').ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'other', version: 1, records: [] })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'body-trend', version: 99, records })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'body-trend', version: 1, records: [], goal: null })).ok).toBe(false);
  });

  it('壊れた記録は除外して件数を返す', () => {
    const result = parseBackup(
      JSON.stringify({
        app: 'body-trend',
        version: 1,
        records: [...records, { id: 'x', date: 'bad', weight: 70 }, null],
        goal: { startDate: '2026-09-01' },
      }),
    );
    if (!result.ok) throw new Error('should parse');
    expect(result.data.records).toHaveLength(2);
    expect(result.data.skipped).toBe(2);
    expect(result.data.goal).toBeNull();
  });

  it('記録が一定数あり、30日以上バックアップしていなければ促す', () => {
    const now = Date.parse('2026-09-14T00:00:00Z');
    expect(isBackupDue(3, undefined, now)).toBe(false);
    expect(isBackupDue(7, undefined, now)).toBe(true);
    expect(isBackupDue(7, '2026-09-01T00:00:00Z', now)).toBe(false);
    expect(isBackupDue(7, '2026-08-01T00:00:00Z', now)).toBe(true);
  });
});

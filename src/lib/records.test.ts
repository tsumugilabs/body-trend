import { describe, expect, it } from 'vitest';
import type { BodyRecord } from '../types';
import { sameMeasurements, undoReplaceRecords } from './records';

const record = (date: string, weight: number, over: Partial<BodyRecord> = {}): BodyRecord => ({
  id: date,
  date,
  weight,
  ...over,
});

describe('sameMeasurements', () => {
  it('日付と測定値が同じなら id が違っても同じとみなす', () => {
    expect(sameMeasurements(record('2026-09-01', 70), { ...record('2026-09-01', 70), id: 'x' })).toBe(true);
    expect(sameMeasurements(record('2026-09-01', 70), record('2026-09-01', 70.1))).toBe(false);
    expect(sameMeasurements(record('2026-09-01', 70), record('2026-09-02', 70))).toBe(false);
    expect(sameMeasurements(record('2026-09-01', 70), record('2026-09-01', 70, { waist: 82 }))).toBe(false);
  });
});

describe('undoReplaceRecords', () => {
  const before = [record('2026-09-01', 70), record('2026-09-02', 69.8)];

  it('置き換えをそのまま取り消す', () => {
    const applied: BodyRecord[] = [];
    const result = undoReplaceRecords(before, applied, applied);
    expect(result.records).toEqual(before);
    expect(result.kept).toBe(0);
  });

  it('取り消すまでのあいだに別の画面が追加した記録は残す', () => {
    const applied: BodyRecord[] = [];
    const current = [record('2026-09-03', 69.5)];
    const result = undoReplaceRecords(before, applied, current);
    expect(result.records).toEqual([...before, record('2026-09-03', 69.5)]);
    expect(result.kept).toBe(1);
  });

  it('同じ日付が更新されていれば、その新しい内容を残す', () => {
    const applied = [record('2026-09-05', 68)];
    const current = [record('2026-09-05', 67.4)];
    const result = undoReplaceRecords(before, applied, current);
    expect(result.records).toEqual([...before, record('2026-09-05', 67.4)]);
    expect(result.kept).toBe(1);
  });

  it('操作が書き込んだままの記録は元に戻す', () => {
    const applied = [record('2026-09-05', 68)];
    const result = undoReplaceRecords(before, applied, applied);
    expect(result.records).toEqual(before);
    expect(result.kept).toBe(0);
  });
});

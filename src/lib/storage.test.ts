import { afterEach, describe, expect, it, vi } from 'vitest';
import { GOAL_KEY, RECORDS_KEY, loadGoal, loadRecords, saveGoal, saveRecords } from './storage';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('storage', () => {
  it('保存したデータを読み戻せる（日付順に並ぶ）', () => {
    saveRecords([
      { id: 'b', date: '2026-09-02', weight: 70.1, bodyFat: 25 },
      { id: 'a', date: '2026-09-01', weight: 70.5 },
    ]);
    saveGoal({ startDate: '2026-09-01', targetDate: '2026-12-01', targetWeight: 65 });
    expect(loadRecords()).toEqual({
      data: [
        { id: 'a', date: '2026-09-01', weight: 70.5 },
        { id: 'b', date: '2026-09-02', weight: 70.1, bodyFat: 25 },
      ],
      problem: false,
    });
    expect(loadGoal().data?.targetWeight).toBe(65);
  });

  it('何も保存されていなければ空で始まる', () => {
    expect(loadRecords()).toEqual({ data: [], problem: false });
    expect(loadGoal()).toEqual({ data: null, problem: false });
  });

  it('壊れた JSON でもクラッシュしない', () => {
    localStorage.setItem(RECORDS_KEY, '{not json');
    localStorage.setItem(GOAL_KEY, '[]');
    expect(loadRecords()).toEqual({ data: [], problem: true });
    expect(loadGoal()).toEqual({ data: null, problem: true });
  });

  it('不正な記録だけを除外する', () => {
    localStorage.setItem(
      RECORDS_KEY,
      JSON.stringify([
        { id: 'ok', date: '2026-09-01', weight: 70 },
        { id: 'bad-date', date: '2026/09/02', weight: 70 },
        { id: 'bad-weight', date: '2026-09-03', weight: '70' },
        null,
        { id: 'null-optional', date: '2026-09-04', weight: 69.8, bodyFat: null },
      ]),
    );
    const result = loadRecords();
    expect(result.problem).toBe(true);
    expect(result.data.map((r) => r.id)).toEqual(['ok', 'null-optional']);
    expect(result.data[1]).not.toHaveProperty('bodyFat');
  });

  it('localStorage が使えなくても例外を投げない', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(loadRecords()).toEqual({ data: [], problem: true });
    expect(saveRecords([])).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import type { BodyRecord, GoalSettings } from '../types';
import { dateToTime } from './date';
import { upsertRecord, removeRecord } from './records';
import { buildChartModel, computeYDomain, metricChange, summarize } from './stats';
import { changeTone, formatSigned } from './metrics';

const goal: GoalSettings = {
  startDate: '2026-09-01',
  targetDate: '2026-12-01',
  targetWeight: 65,
  targetBodyFat: 20,
};

const records: BodyRecord[] = [
  { id: '1', date: '2026-08-30', weight: 72.0, bodyFat: 27 },
  { id: '2', date: '2026-09-05', weight: 71.2 },
  { id: '3', date: '2026-09-14', weight: 70.4, bodyFat: 25.5, skeletalMuscle: 30.2 },
];

describe('summarize', () => {
  it('現在値・残り日数・開始からの変化・目標までを計算する', () => {
    const s = summarize(records, goal, '2026-09-14');
    expect(s.latest?.weight).toBe(70.4);
    expect(s.latestBodyFat).toEqual({ value: 25.5, date: '2026-09-14' });
    expect(s.latestSkeletalMuscle).toEqual({ value: 30.2, date: '2026-09-14' });
    expect(s.daysLeft).toBe(78);
    // 開始日以前の最新記録（8/30）が基準
    expect(s.weightChange).toBeCloseTo(-1.6);
    expect(s.weightToGoal).toBeCloseTo(5.4);
  });

  it('記録がなくても落ちない', () => {
    const s = summarize([], goal, '2026-09-14');
    expect(s.latest).toBeUndefined();
    expect(s.weightChange).toBeUndefined();
    expect(s.latestBodyFat).toBeUndefined();
  });

  it('指標ごとの変化は値のある記録だけで計算する', () => {
    expect(metricChange(records, 'bodyFat', goal.startDate)).toBeCloseTo(-1.5);
    expect(metricChange(records, 'skeletalMuscle', goal.startDate)).toBeUndefined();
  });
});

describe('buildChartModel', () => {
  it('期間で絞り込み、目標線を含むよう Y 軸を広げる', () => {
    const m = buildChartModel(records, goal, 'weight', '7', '2026-09-14');
    expect(m.points.map((p) => p.date)).toEqual(['2026-09-14']);
    expect(m.xDomain).toEqual([dateToTime('2026-09-08'), dateToTime('2026-09-14')]);
    expect(m.goalValue).toBe(65);
    expect(m.yDomain[0]).toBeLessThanOrEqual(65);
    expect(m.yDomain[1]).toBeGreaterThanOrEqual(70.4);
    expect(m.targetTime).toBeUndefined();
  });

  it('全期間では目標日まで表示する', () => {
    const m = buildChartModel(records, goal, 'weight', 'all', '2026-09-14');
    expect(m.points).toHaveLength(3);
    expect(m.xDomain[1]).toBe(dateToTime('2026-12-01'));
    expect(m.targetTime).toBe(dateToTime('2026-12-01'));
  });

  it('値のない指標は点に含めず、目標未設定なら目標線なし', () => {
    const m = buildChartModel(records, goal, 'skeletalMuscle', 'all', '2026-09-14');
    expect(m.points).toHaveLength(1);
    expect(m.goalValue).toBeUndefined();
  });

  it('記録が1件でも Y 軸に最小幅を持たせる', () => {
    const [lo, hi] = computeYDomain([70], 2);
    expect(hi - lo).toBeGreaterThanOrEqual(2);
    expect(lo).toBeLessThan(70);
    expect(hi).toBeGreaterThan(70);
  });
});

describe('records', () => {
  it('同じ日付は上書きし、日付順を保つ', () => {
    const next = upsertRecord(records, { id: 'new', date: '2026-09-05', weight: 71.0 });
    expect(next).toHaveLength(3);
    expect(next[1]).toEqual({ id: 'new', date: '2026-09-05', weight: 71.0 });
    const edited = upsertRecord(next, { id: '1', date: '2026-09-20', weight: 70 });
    expect(edited.map((r) => r.id)).toEqual(['new', '3', '1']);
    expect(removeRecord(edited, '3').map((r) => r.id)).toEqual(['new', '1']);
  });
});

describe('metrics', () => {
  it('変化の符号と色分けを決める', () => {
    expect(formatSigned(-1.25)).toBe('−1.3');
    expect(formatSigned(0.04)).toBe('±0.0');
    expect(changeTone('weight', -0.5)).toBe('good');
    expect(changeTone('weight', 0.5)).toBe('neutral');
    expect(changeTone('skeletalMuscle', 0.3)).toBe('good');
  });
});

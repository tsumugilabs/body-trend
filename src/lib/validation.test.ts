import { describe, expect, it } from 'vitest';
import type { BodyRecord } from '../types';
import { parseDecimal, validateGoal, validateRecord } from './validation';

const today = '2026-09-14';
const input = (over: Partial<Record<'date' | 'weight' | 'bodyFat' | 'skeletalMuscle', string>> = {}) => ({
  date: today,
  weight: '70.5',
  bodyFat: '',
  skeletalMuscle: '',
  ...over,
});

describe('parseDecimal', () => {
  it('小数点第1位までの数値を受け付ける', () => {
    expect(parseDecimal('70.5')).toEqual({ ok: true, value: 70.5 });
    expect(parseDecimal('70')).toEqual({ ok: true, value: 70 });
    expect(parseDecimal(' ７０，５ ')).toEqual({ ok: true, value: 70.5 });
    expect(parseDecimal('')).toEqual({ ok: true, value: undefined });
  });

  it('不正な形式や小数点第2位以降はエラー', () => {
    expect(parseDecimal('70.55').ok).toBe(false);
    expect(parseDecimal('abc').ok).toBe(false);
    expect(parseDecimal('-3').ok).toBe(false);
    expect(parseDecimal('1.2.3').ok).toBe(false);
  });
});

describe('validateRecord', () => {
  it('体重だけで保存できる', () => {
    const r = validateRecord(input(), { today, records: [] });
    expect(r.errors).toEqual({});
    expect(r.warnings).toEqual([]);
    expect(r.values).toEqual({ date: today, weight: 70.5 });
  });

  it('体重は必須', () => {
    const r = validateRecord(input({ weight: '' }), { today, records: [] });
    expect(r.errors.weight).toBe('体重を入力してください');
    expect(r.values).toBeUndefined();
  });

  it('明らかな入力ミスはエラー、珍しい値は確認', () => {
    expect(validateRecord(input({ weight: '705' }), { today, records: [] }).errors.weight).toMatch(/範囲/);
    expect(validateRecord(input({ bodyFat: '80' }), { today, records: [] }).errors.bodyFat).toMatch(/範囲/);
    const soft = validateRecord(input({ weight: '210' }), { today, records: [] });
    expect(soft.values).toBeDefined();
    expect(soft.warnings[0]).toMatch(/一般的な範囲/);
  });

  it('未来の日付はエラー', () => {
    expect(validateRecord(input({ date: '2026-09-15' }), { today, records: [] }).errors.date).toBeDefined();
  });

  it('前回から急に変化していたら確認する（編集中の自分自身は比較しない）', () => {
    const records: BodyRecord[] = [
      { id: 'a', date: '2026-09-10', weight: 70 },
      { id: 'b', date: '2026-09-14', weight: 64 },
    ];
    expect(validateRecord(input({ weight: '64.0' }), { today, records }).warnings[0]).toMatch(/前回/);
    expect(validateRecord(input({ weight: '70.2' }), { today, records, editingId: 'b' }).warnings).toEqual([]);
  });
});

describe('validateGoal', () => {
  const goal = {
    startDate: '2026-09-01',
    targetDate: '2026-12-31',
    targetWeight: '65',
    targetBodyFat: '',
    targetSkeletalMuscle: '',
  };

  it('正しい目標を受け付ける（任意項目は省略可）', () => {
    const r = validateGoal(goal, { today });
    expect(r.values).toEqual({ startDate: '2026-09-01', targetDate: '2026-12-31', targetWeight: 65 });
  });

  it('目標日は開始日より後でなければならない', () => {
    expect(validateGoal({ ...goal, targetDate: '2026-09-01' }).errors.targetDate).toMatch(/開始日より後/);
    expect(validateGoal({ ...goal, targetDate: '2026-08-01' }).errors.targetDate).toBeDefined();
  });

  it('目標体重は必須で、範囲外はエラー', () => {
    expect(validateGoal({ ...goal, targetWeight: '' }).errors.targetWeight).toBeDefined();
    expect(validateGoal({ ...goal, targetSkeletalMuscle: '90' }).errors.targetSkeletalMuscle).toMatch(/目標骨格筋率/);
  });

  it('目標日が過去なら確認する', () => {
    const r = validateGoal({ ...goal, startDate: '2026-01-01', targetDate: '2026-06-01' }, { today });
    expect(r.values).toBeDefined();
    expect(r.warnings).toHaveLength(1);
  });
});

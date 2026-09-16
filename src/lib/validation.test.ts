import { describe, expect, it } from 'vitest';
import type { BodyRecord } from '../types';
import {
  parseDecimal,
  validateExercise,
  validateGoal,
  validateRecord,
  validateTraining,
  type GoalInput,
  type RecordInput,
  type TrainingInput,
} from './validation';
import type { Exercise } from '../types';

const today = '2026-09-14';
const input = (over: Partial<RecordInput> = {}): RecordInput => ({
  date: today,
  weight: '70.5',
  bodyFat: '',
  skeletalMuscle: '',
  waist: '',
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
    expect(validateRecord(input({ waist: '250' }), { today, records: [] }).errors.waist).toMatch(/範囲/);
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
  const goal: GoalInput = {
    startDate: '2026-09-01',
    targetDate: '2026-12-31',
    targetWeight: '65',
    targetBodyFat: '',
    targetSkeletalMuscle: '',
    targetWaist: '',
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

describe('validateTraining', () => {
  const exercises: Exercise[] = [
    { id: 'e1', name: 'ベンチプレス', kind: 'strength' },
    { id: 'e2', name: 'ランニング', kind: 'cardio' },
  ];
  const input = (over: Partial<TrainingInput> = {}): TrainingInput => ({
    date: today,
    exerciseId: 'e1',
    weight: '',
    reps: '',
    sets: '',
    minutes: '',
    distance: '',
    memo: '',
    ...over,
  });

  it('種類に応じた項目を取り込み、種目名と種類も一緒に保存する', () => {
    const r = validateTraining(input({ weight: '60', reps: '10', sets: '3', memo: ' 調子よし ' }), {
      today,
      exercises,
    });
    expect(r.errors).toEqual({});
    expect(r.values).toEqual({
      date: today,
      exerciseId: 'e1',
      exerciseName: 'ベンチプレス',
      kind: 'strength',
      weight: 60,
      reps: 10,
      sets: 3,
      memo: '調子よし',
    });
  });

  it('種類で使わない項目は取り込まない', () => {
    const r = validateTraining(input({ exerciseId: 'e2', minutes: '30', distance: '5', weight: '60' }), {
      today,
      exercises,
    });
    expect(r.values).toEqual({
      date: today,
      exerciseId: 'e2',
      exerciseName: 'ランニング',
      kind: 'cardio',
      minutes: 30,
      distance: 5,
    });
  });

  it('種目が未選択ならエラー', () => {
    expect(validateTraining(input({ exerciseId: '' }), { today, exercises }).errors.exerciseId).toBe(
      '種目を選んでください',
    );
  });

  it('内容が空ならエラー', () => {
    expect(validateTraining(input(), { today, exercises }).errors.weight).toBe('内容を1つ以上入力してください');
  });

  it('回数とセット数は整数、範囲外はエラー、珍しい値は確認', () => {
    expect(validateTraining(input({ reps: '10.5' }), { today, exercises }).errors.reps).toMatch(/整数/);
    expect(validateTraining(input({ weight: '600' }), { today, exercises }).errors.weight).toMatch(/範囲/);
    const soft = validateTraining(input({ weight: '300' }), { today, exercises });
    expect(soft.values).toBeDefined();
    expect(soft.warnings[0]).toMatch(/一般的な範囲/);
  });

  it('未来の日付は記録できない', () => {
    expect(
      validateTraining(input({ date: '2026-09-15', weight: '60' }), { today, exercises }).errors.date,
    ).toBeDefined();
  });
});

describe('validateExercise', () => {
  const exercises: Exercise[] = [{ id: 'e1', name: 'ベンチプレス', kind: 'strength' }];

  it('名前は必須で、同じ名前は登録できない', () => {
    expect(validateExercise({ name: '  ', kind: 'strength' }, { exercises }).error).toMatch(/種目名/);
    expect(validateExercise({ name: 'ベンチプレス', kind: 'cardio' }, { exercises }).error).toMatch(/同じ名前/);
    expect(validateExercise({ name: 'ベンチプレス', kind: 'cardio' }, { exercises, editingId: 'e1' }).values).toEqual({
      name: 'ベンチプレス',
      kind: 'cardio',
    });
  });

  it('前後の空白は落とす', () => {
    expect(validateExercise({ name: ' 懸垂 ', kind: 'strength' }, { exercises }).values).toEqual({
      name: '懸垂',
      kind: 'strength',
    });
  });
});

import { describe, expect, it } from 'vitest';
import type { Exercise, TrainingRecord } from '../types';
import {
  findExerciseByName,
  groupTrainingsByDate,
  lastTrainingFor,
  removeExercise,
  undoReplaceTrainings,
  upsertExercise,
  upsertTraining,
} from './trainings';

const bench: Exercise = { id: 'e1', name: 'ベンチプレス', kind: 'strength' };
const run: Exercise = { id: 'e2', name: 'ランニング', kind: 'cardio' };

const training = (id: string, date: string, over: Partial<TrainingRecord> = {}): TrainingRecord => ({
  id,
  date,
  exerciseId: bench.id,
  exerciseName: bench.name,
  kind: 'strength',
  weight: 60,
  reps: 10,
  sets: 3,
  ...over,
});

describe('trainings', () => {
  it('同じ日に何件でも記録でき、日付の昇順になる', () => {
    const a = training('a', '2026-09-02');
    const b = training('b', '2026-09-01');
    const c = training('c', '2026-09-02', { weight: 65 });
    const list = upsertTraining(upsertTraining(upsertTraining([], a), b), c);
    expect(list.map((t) => t.id)).toEqual(['b', 'a', 'c']);
  });

  it('同じ id は置き換える', () => {
    const list = upsertTraining([training('a', '2026-09-02')], training('a', '2026-09-02', { weight: 70 }));
    expect(list).toHaveLength(1);
    expect(list[0].weight).toBe(70);
  });

  it('日付ごとに新しい順でまとめる', () => {
    const list = [training('a', '2026-09-01'), training('b', '2026-09-02'), training('c', '2026-09-02')];
    expect(groupTrainingsByDate(list)).toEqual([
      { date: '2026-09-02', items: [list[1], list[2]] },
      { date: '2026-09-01', items: [list[0]] },
    ]);
  });

  it('前回の値のもとになる、その種目の最新の記録を返す', () => {
    const list = [
      training('a', '2026-09-01'),
      training('b', '2026-09-02', { exerciseId: run.id, kind: 'cardio' }),
      training('c', '2026-09-03', { weight: 65 }),
    ];
    expect(lastTrainingFor(list, bench.id)?.id).toBe('c');
    expect(lastTrainingFor(list, bench.id, 'c')?.id).toBe('a');
    expect(lastTrainingFor(list, 'none')).toBeUndefined();
  });

  it('取り消しても、そのあいだに別の画面が加えた変更は残す', () => {
    const base = [training('a', '2026-09-01')];
    const applied: TrainingRecord[] = [];
    const current = [training('z', '2026-09-03')];
    const result = undoReplaceTrainings(base, applied, current);
    expect(result.trainings.map((t) => t.id)).toEqual(['a', 'z']);
    expect(result.kept).toBe(1);
  });

  it('取り消すまでのあいだに削除された記録は復活させない', () => {
    const base = [training('a', '2026-09-01'), training('b', '2026-09-02')];
    const applied = [training('a', '2026-09-01')];
    const result = undoReplaceTrainings(base, applied, []);
    expect(result.trainings.map((t) => t.id)).toEqual(['b']);
    expect(result.kept).toBe(1);
  });

  it('マイメニューは登録した順に並び、同じ名前は大文字小文字と空白を無視して探せる', () => {
    const list = upsertExercise(upsertExercise([], bench), run);
    expect(list.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(findExerciseByName(list, ' ランニング ')?.id).toBe('e2');
    expect(findExerciseByName(list, '水泳')).toBeUndefined();
    expect(removeExercise(list, 'e1').map((e) => e.id)).toEqual(['e2']);
  });
});

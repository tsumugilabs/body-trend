import { describe, expect, it } from 'vitest';
import type { BodyRecord, Exercise, GoalSettings, TrainingRecord } from '../types';
import {
  backupFileName,
  createBackup,
  isBackupDue,
  parseBackup,
  recordsLostByRestore,
  trainingsLostByRestore,
} from './backup';

const records: BodyRecord[] = [
  { id: 'a', date: '2026-09-01', weight: 72.1, bodyFat: 26 },
  { id: 'b', date: '2026-09-02', weight: 71.8 },
];
const goal: GoalSettings = { startDate: '2026-09-01', targetDate: '2026-12-01', targetWeight: 65 };
const exercises: Exercise[] = [{ id: 'e1', name: 'ベンチプレス', kind: 'strength' }];
const trainings: TrainingRecord[] = [
  {
    id: 't1',
    date: '2026-09-02',
    exerciseId: 'e1',
    exerciseName: 'ベンチプレス',
    kind: 'strength',
    weight: 60,
    reps: 10,
    sets: 3,
  },
];

describe('backup', () => {
  it('書き出したバックアップをそのまま読み込める', () => {
    const text = createBackup({ records, goal, trainings, exercises }, new Date('2026-09-14T01:00:00Z'));
    const result = parseBackup(text);
    expect(result).toEqual({
      ok: true,
      data: {
        records,
        goal,
        trainings,
        exercises,
        exportedAt: '2026-09-14T01:00:00.000Z',
        skipped: 0,
        skippedTrainings: 0,
      },
    });
    expect(backupFileName('2026-09-14')).toBe('body-trend-backup-2026-09-14.json');
  });

  it('古いアプリでも読めるよう、書き出す version は上げない', () => {
    const text = createBackup({ records, goal, trainings, exercises });
    const raw = JSON.parse(text) as Record<string, unknown>;
    // version を上げると、上限が 1 の古いアプリがファイルごと読めなくなる
    expect(raw.version).toBe(1);
    expect(raw.trainings).toHaveLength(1);
    expect(raw.exercises).toHaveLength(1);
  });

  it('この先キーが増えた version 2 のファイルも読み込める', () => {
    const result = parseBackup(
      JSON.stringify({ app: 'body-trend', version: 2, records, goal, trainings, exercises }),
    );
    expect(result.ok).toBe(true);
    expect(parseBackup(JSON.stringify({ app: 'body-trend', version: 3, records })).ok).toBe(false);
  });

  it('トレーニングがない古いバックアップ（version 1）も読み込める', () => {
    const result = parseBackup(JSON.stringify({ app: 'body-trend', version: 1, records, goal }));
    if (!result.ok) throw new Error('should parse');
    expect(result.data.records).toEqual(records);
    expect(result.data.trainings).toEqual([]);
    expect(result.data.exercises).toEqual([]);
  });

  it('記録がなくてもトレーニングがあれば読み込める', () => {
    const result = parseBackup(
      JSON.stringify({ app: 'body-trend', version: 2, records: [], goal: null, trainings, exercises }),
    );
    if (!result.ok) throw new Error('should parse');
    expect(result.data.trainings).toEqual(trainings);
  });

  it('壊れたトレーニングは除外して件数を返す', () => {
    const result = parseBackup(
      JSON.stringify({
        app: 'body-trend',
        version: 2,
        records,
        goal,
        trainings: [
          ...trainings,
          { id: 'x', date: '2026-09-02', exerciseId: 'e1' },
          // 種類で使う項目の値がなく、中身が空になる記録
          { id: 'z', date: '2026-09-02', exerciseId: 'e1', exerciseName: 'ベンチプレス', kind: 'strength' },
        ],
        exercises: [...exercises, { id: 'y', name: '', kind: 'strength' }],
      }),
    );
    if (!result.ok) throw new Error('should parse');
    expect(result.data.trainings).toEqual(trainings);
    expect(result.data.exercises).toEqual(exercises);
    expect(result.data.skippedTrainings).toBe(3);
  });

  it('復元で消えるトレーニングを id で見つける', () => {
    const other: TrainingRecord = { ...trainings[0], id: 't2' };
    expect(trainingsLostByRestore(trainings, [other])).toEqual(trainings);
    expect(trainingsLostByRestore(trainings, [...trainings, other])).toEqual([]);
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

  it('復元で消える記録を日付で見つける（件数では判断しない）', () => {
    const backup: BodyRecord[] = [
      { id: 'c', date: '2026-09-03', weight: 71 },
      { id: 'd', date: '2026-09-04', weight: 70.9 },
    ];
    // 件数は同じでも、現在の記録の日付がバックアップにないものは消える
    expect(recordsLostByRestore(records, backup)).toEqual(records);
    expect(recordsLostByRestore(records, [...records, ...backup])).toEqual([]);
    expect(recordsLostByRestore(records, [records[0]])).toEqual([records[1]]);
  });

  it('記録が一定数あり、30日以上バックアップしていなければ促す', () => {
    const now = Date.parse('2026-09-14T00:00:00Z');
    expect(isBackupDue(3, undefined, now)).toBe(false);
    expect(isBackupDue(7, undefined, now)).toBe(true);
    expect(isBackupDue(7, '2026-09-01T00:00:00Z', now)).toBe(false);
    expect(isBackupDue(7, '2026-08-01T00:00:00Z', now)).toBe(true);
  });
});

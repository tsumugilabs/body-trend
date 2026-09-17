import type { BodyRecord, Exercise, TrainingRecord } from '../types';
import type { AppContents } from '../hooks/useAppData';
import { addDays } from './date';

const SAMPLE_EXERCISES: Exercise[] = [
  { id: 'sample-ex-bench', name: 'ベンチプレス', kind: 'strength' },
  { id: 'sample-ex-squat', name: 'スクワット', kind: 'strength' },
  { id: 'sample-ex-run', name: 'ランニング', kind: 'cardio' },
  { id: 'sample-ex-swim', name: '水泳', kind: 'sport' },
];

/**
 * 開発時の動作確認用サンプルデータ。
 * 設定画面の「サンプルデータを読み込む」（開発サーバーでのみ表示）から使う。
 */
export function createSampleData(today: string): AppContents {
  const days = 75;
  const startDate = addDays(today, -days);
  const records: BodyRecord[] = [];
  // 疑似乱数（毎回同じ形になるよう固定シード）
  let seed = 42;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647 - 0.5;
  };
  for (let i = 0; i <= days; i++) {
    const r = rand();
    // ときどき記録しない日がある
    if (i > 0 && i < days && r > 0.32) continue;
    const progress = i / days;
    const weight = 78.4 - 5.2 * progress + rand() * 0.8;
    const bodyFat = 27.8 - 3.6 * progress + rand() * 0.6;
    const muscle = 29.6 + 1.4 * progress + rand() * 0.4;
    const waist = 88.5 - 6.0 * progress + rand() * 0.8;
    const record: BodyRecord = {
      id: `sample-${i}`,
      date: addDays(startDate, i),
      weight: Math.round(weight * 10) / 10,
    };
    // 体組成は測れない日もある
    if (i % 5 !== 3) {
      record.bodyFat = Math.round(bodyFat * 10) / 10;
      record.skeletalMuscle = Math.round(muscle * 10) / 10;
    }
    // 腹囲は週に1回ほど測る
    if (i % 7 === 0) record.waist = Math.round(waist * 10) / 10;
    records.push(record);
  }
  // トレーニングは数日おきに、筋トレと有酸素を交互に
  const trainings: TrainingRecord[] = [];
  for (let i = 2; i <= days; i += 3) {
    const date = addDays(startDate, i);
    const progress = i / days;
    if (i % 2 === 0) {
      trainings.push({
        id: `sample-tr-${i}-a`,
        date,
        exerciseId: 'sample-ex-bench',
        exerciseName: 'ベンチプレス',
        kind: 'strength',
        weight: Math.round((50 + 10 * progress) * 2) / 2,
        reps: 10,
        sets: 3,
      });
      trainings.push({
        id: `sample-tr-${i}-b`,
        date,
        exerciseId: 'sample-ex-squat',
        exerciseName: 'スクワット',
        kind: 'strength',
        weight: Math.round((60 + 15 * progress) * 2) / 2,
        reps: 8,
        sets: 3,
      });
    } else {
      trainings.push({
        id: `sample-tr-${i}-a`,
        date,
        exerciseId: 'sample-ex-run',
        exerciseName: 'ランニング',
        kind: 'cardio',
        minutes: 30,
        distance: Math.round((4 + 2 * progress) * 10) / 10,
        memo: i % 5 === 0 ? '調子よく走れた' : undefined,
      });
    }
  }

  return {
    records,
    trainings,
    exercises: SAMPLE_EXERCISES,
    goal: {
      startDate,
      targetDate: addDays(today, 60),
      targetWeight: 70,
      targetBodyFat: 22,
      targetSkeletalMuscle: 32,
      targetWaist: 82,
    },
  };
}

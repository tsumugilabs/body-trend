import type { Exercise, TrainingRecord } from '../types';
import { sortTrainings, TRAINING_FIELD_ORDER } from './training';
import { undoReplaceItems } from './undo';

export function sameTraining(a: TrainingRecord, b: TrainingRecord): boolean {
  return (
    a.date === b.date &&
    a.exerciseId === b.exerciseId &&
    a.exerciseName === b.exerciseName &&
    a.kind === b.kind &&
    a.memo === b.memo &&
    TRAINING_FIELD_ORDER.every((key) => a[key] === b[key])
  );
}

export function sameExercise(a: Exercise, b: Exercise): boolean {
  return a.name === b.name && a.kind === b.kind;
}

/** 同じ id があれば置き換え、なければ追加する。結果は日付の昇順。 */
export function upsertTraining(trainings: TrainingRecord[], training: TrainingRecord): TrainingRecord[] {
  const index = trainings.findIndex((t) => t.id === training.id);
  const next = [...trainings];
  if (index >= 0) next[index] = training;
  else next.push(training);
  return sortTrainings(next);
}

export function removeTraining(trainings: TrainingRecord[], id: string): TrainingRecord[] {
  return trainings.filter((t) => t.id !== id);
}

/** マイメニュー。同じ id があれば置き換え、なければ末尾に追加する（登録した順に並べる）。 */
export function upsertExercise(exercises: Exercise[], exercise: Exercise): Exercise[] {
  const index = exercises.findIndex((e) => e.id === exercise.id);
  if (index < 0) return [...exercises, exercise];
  const next = [...exercises];
  next[index] = exercise;
  return next;
}

export function removeExercise(exercises: Exercise[], id: string): Exercise[] {
  return exercises.filter((e) => e.id !== id);
}

/** 同じ名前の種目がすでにあるか（大文字小文字と前後の空白は無視） */
export function findExerciseByName(exercises: Exercise[], name: string): Exercise | undefined {
  const key = name.trim().toLowerCase();
  return exercises.find((e) => e.name.trim().toLowerCase() === key);
}

export function trainingsOn(trainings: TrainingRecord[], date: string): TrainingRecord[] {
  return trainings.filter((t) => t.date === date);
}

/** 新しい日付が先に来るグループ */
export function groupTrainingsByDate(trainings: TrainingRecord[]): { date: string; items: TrainingRecord[] }[] {
  const byDate = new Map<string, TrainingRecord[]>();
  for (const training of trainings) {
    const list = byDate.get(training.date);
    if (list) list.push(training);
    else byDate.set(training.date, [training]);
  }
  return [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({ date, items }));
}

/** 指定した種目の最新の記録（入力の目安として前回の値を出すため） */
export function lastTrainingFor(
  trainings: TrainingRecord[],
  exerciseId: string,
  excludeId?: string,
): TrainingRecord | undefined {
  for (let i = trainings.length - 1; i >= 0; i--) {
    const training = trainings[i];
    if (training.exerciseId === exerciseId && training.id !== excludeId) return training;
  }
  return undefined;
}

export function undoReplaceTrainings(
  base: TrainingRecord[],
  applied: TrainingRecord[],
  current: TrainingRecord[],
): { trainings: TrainingRecord[]; kept: number } {
  const { items, kept } = undoReplaceItems(base, applied, current, (t) => t.id, sameTraining);
  return { trainings: sortTrainings(items), kept };
}

export function undoReplaceExercises(
  base: Exercise[],
  applied: Exercise[],
  current: Exercise[],
): { exercises: Exercise[]; kept: number } {
  const { items, kept } = undoReplaceItems(base, applied, current, (e) => e.id, sameExercise);
  return { exercises: items, kept };
}

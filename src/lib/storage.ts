import type { BodyRecord, Exercise, ExerciseKind, GoalSettings, TrainingRecord } from '../types';
import { isValidDateString } from './date';
import {
  EXERCISE_NAME_MAX,
  KINDS,
  MEMO_MAX,
  sortTrainings,
  TRAINING_FIELDS,
  TRAINING_FIELD_ORDER,
} from './training';

export const RECORDS_KEY = 'metabolic.records.v1';
export const GOAL_KEY = 'metabolic.goal.v1';
export const META_KEY = 'metabolic.meta.v1';
export const TRAININGS_KEY = 'metabolic.trainings.v1';
export const EXERCISES_KEY = 'metabolic.exercises.v1';
/** 読み込めなかった元データの退避先（キー名にこの接尾辞を付ける） */
export const BROKEN_SUFFIX = '.broken';

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isOptionalNumber = (v: unknown) => v === undefined || v === null || isFiniteNumber(v);

export function isBodyRecord(value: unknown): value is BodyRecord {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    r.id.length > 0 &&
    isValidDateString(r.date) &&
    isFiniteNumber(r.weight) &&
    r.weight > 0 &&
    isOptionalNumber(r.bodyFat) &&
    isOptionalNumber(r.skeletalMuscle) &&
    isOptionalNumber(r.waist)
  );
}

export function isGoalSettings(value: unknown): value is GoalSettings {
  if (typeof value !== 'object' || value === null) return false;
  const g = value as Record<string, unknown>;
  return (
    isValidDateString(g.startDate) &&
    isValidDateString(g.targetDate) &&
    g.targetDate > g.startDate &&
    isFiniteNumber(g.targetWeight) &&
    g.targetWeight > 0 &&
    isOptionalNumber(g.targetBodyFat) &&
    isOptionalNumber(g.targetSkeletalMuscle) &&
    isOptionalNumber(g.targetWaist)
  );
}

export function normalizeRecord(r: BodyRecord): BodyRecord {
  const out: BodyRecord = { id: r.id, date: r.date, weight: r.weight };
  if (isFiniteNumber(r.bodyFat)) out.bodyFat = r.bodyFat;
  if (isFiniteNumber(r.skeletalMuscle)) out.skeletalMuscle = r.skeletalMuscle;
  if (isFiniteNumber(r.waist)) out.waist = r.waist;
  return out;
}

export function normalizeGoal(g: GoalSettings): GoalSettings {
  const out: GoalSettings = {
    startDate: g.startDate,
    targetDate: g.targetDate,
    targetWeight: g.targetWeight,
  };
  if (isFiniteNumber(g.targetBodyFat)) out.targetBodyFat = g.targetBodyFat;
  if (isFiniteNumber(g.targetSkeletalMuscle)) out.targetSkeletalMuscle = g.targetSkeletalMuscle;
  if (isFiniteNumber(g.targetWaist)) out.targetWaist = g.targetWaist;
  return out;
}

const isKind = (v: unknown): v is ExerciseKind => typeof v === 'string' && v in KINDS;

export function isExercise(value: unknown): value is Exercise {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    e.id.length > 0 &&
    typeof e.name === 'string' &&
    e.name.trim().length > 0 &&
    e.name.length <= EXERCISE_NAME_MAX &&
    isKind(e.kind)
  );
}

export function normalizeExercise(e: Exercise): Exercise {
  return { id: e.id, name: e.name.trim(), kind: e.kind };
}

export function isTrainingRecord(value: unknown): value is TrainingRecord {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as Record<string, unknown>;
  if (
    typeof t.id !== 'string' ||
    t.id.length === 0 ||
    !isValidDateString(t.date) ||
    typeof t.exerciseId !== 'string' ||
    typeof t.exerciseName !== 'string' ||
    t.exerciseName.trim().length === 0 ||
    !isKind(t.kind)
  ) {
    return false;
  }
  if (t.memo !== undefined && t.memo !== null && typeof t.memo !== 'string') return false;
  // 数値の項目は、あれば正しい範囲で持つ
  const inRange = TRAINING_FIELD_ORDER.every((key) => {
    const value = t[key];
    if (value === undefined || value === null) return true;
    if (!isFiniteNumber(value)) return false;
    const field = TRAINING_FIELDS[key];
    return value >= field.hardMin && value <= field.hardMax;
  });
  if (!inRange) return false;
  // その種類で使う項目の値が1つもなければ、中身のない記録として読み飛ばす
  // （normalizeTraining が使わない項目を落とすため、空の記録が残ってしまう）
  return KINDS[t.kind].fields.some((key) => isFiniteNumber(t[key]));
}

export function normalizeTraining(t: TrainingRecord): TrainingRecord {
  const out: TrainingRecord = {
    id: t.id,
    date: t.date,
    exerciseId: t.exerciseId,
    exerciseName: t.exerciseName.trim(),
    kind: t.kind,
  };
  for (const key of KINDS[t.kind].fields) {
    const value = t[key];
    if (isFiniteNumber(value)) out[key] = value;
  }
  const memo = typeof t.memo === 'string' ? t.memo.trim().slice(0, MEMO_MAX) : '';
  if (memo) out.memo = memo;
  return out;
}

/** 目標の内容が同じか */
export function sameGoal(a: GoalSettings | null, b: GoalSettings | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.startDate === b.startDate &&
    a.targetDate === b.targetDate &&
    a.targetWeight === b.targetWeight &&
    a.targetBodyFat === b.targetBodyFat &&
    a.targetSkeletalMuscle === b.targetSkeletalMuscle &&
    a.targetWaist === b.targetWaist
  );
}

/**
 * 記録の配列を検証して取り込む。壊れた要素は除外し、同じ日付は後に出てきたものを採用する。
 */
export function sanitizeRecords(items: unknown[]): { records: BodyRecord[]; skipped: number } {
  const byDate = new Map<string, BodyRecord>();
  let skipped = 0;
  for (const item of items) {
    if (isBodyRecord(item)) {
      if (byDate.has(item.date)) skipped++;
      byDate.set(item.date, normalizeRecord(item));
    } else skipped++;
  }
  const records = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { records, skipped };
}

/** id ごとに1件にして取り込む。壊れた要素は除外する。 */
function sanitizeById<T extends { id: string }>(
  items: unknown[],
  isValid: (v: unknown) => v is T,
  normalize: (v: T) => T,
): { items: T[]; skipped: number } {
  const byId = new Map<string, T>();
  let skipped = 0;
  for (const item of items) {
    if (isValid(item)) {
      if (byId.has(item.id)) skipped++;
      byId.set(item.id, normalize(item));
    } else skipped++;
  }
  return { items: [...byId.values()], skipped };
}

/** トレーニング記録を検証して取り込む。1日に何件でも記録できるので、日付ではなく id で1件にする。 */
export function sanitizeTrainings(items: unknown[]): { trainings: TrainingRecord[]; skipped: number } {
  const { items: trainings, skipped } = sanitizeById(items, isTrainingRecord, normalizeTraining);
  // 同じ日の中では登録した順のまま、日付の昇順に並べる
  return { trainings: sortTrainings(trainings), skipped };
}

export function sanitizeExercises(items: unknown[]): { exercises: Exercise[]; skipped: number } {
  const { items: exercises, skipped } = sanitizeById(items, isExercise, normalizeExercise);
  return { exercises, skipped };
}

export type LoadResult<T> = { data: T; problem: boolean };

function safeGetItem(key: string): { raw: string | null; problem: boolean } {
  try {
    return { raw: window.localStorage.getItem(key), problem: false };
  } catch {
    return { raw: null, problem: true };
  }
}

/** 読み込めなかった元データを別キーに退避し、次の保存で上書きされても失われないようにする */
function preserveBroken(key: string, raw: string) {
  try {
    const brokenKey = key + BROKEN_SUFFIX;
    if (window.localStorage.getItem(brokenKey) === null) {
      window.localStorage.setItem(brokenKey, raw);
    }
  } catch {
    // 退避できなくてもアプリは続行する
  }
}

/** 記録を読み込む。壊れたデータは読み飛ばし、アプリは落とさない。 */
export function loadRecords(): LoadResult<BodyRecord[]> {
  const { raw, problem } = safeGetItem(RECORDS_KEY);
  if (raw === null) return { data: [], problem };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      preserveBroken(RECORDS_KEY, raw);
      return { data: [], problem: true };
    }
    const { records } = sanitizeRecords(parsed);
    const dropped = parsed.some((item) => !isBodyRecord(item));
    if (dropped) preserveBroken(RECORDS_KEY, raw);
    return { data: records, problem: dropped };
  } catch {
    preserveBroken(RECORDS_KEY, raw);
    return { data: [], problem: true };
  }
}

export function loadGoal(): LoadResult<GoalSettings | null> {
  const { raw, problem } = safeGetItem(GOAL_KEY);
  if (raw === null) return { data: null, problem };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isGoalSettings(parsed)) return { data: normalizeGoal(parsed), problem: false };
  } catch {
    // 下で退避する
  }
  preserveBroken(GOAL_KEY, raw);
  return { data: null, problem: true };
}

/** 配列で保存しているデータを読み込む。壊れたデータは読み飛ばし、元データは退避する。 */
function loadList<T>(key: string, sanitize: (items: unknown[]) => { items: T[]; skipped: number }): LoadResult<T[]> {
  const { raw, problem } = safeGetItem(key);
  if (raw === null) return { data: [], problem };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      preserveBroken(key, raw);
      return { data: [], problem: true };
    }
    const { items, skipped } = sanitize(parsed);
    if (skipped > 0) preserveBroken(key, raw);
    return { data: items, problem: skipped > 0 };
  } catch {
    preserveBroken(key, raw);
    return { data: [], problem: true };
  }
}

export function loadTrainings(): LoadResult<TrainingRecord[]> {
  return loadList(TRAININGS_KEY, (items) => {
    const { trainings, skipped } = sanitizeTrainings(items);
    return { items: trainings, skipped };
  });
}

export function loadExercises(): LoadResult<Exercise[]> {
  return loadList(EXERCISES_KEY, (items) => {
    const { exercises, skipped } = sanitizeExercises(items);
    return { items: exercises, skipped };
  });
}

function safeSetItem(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function saveRecords(records: BodyRecord[]): boolean {
  return safeSetItem(RECORDS_KEY, JSON.stringify(records));
}

export function saveGoal(goal: GoalSettings | null): boolean {
  if (goal === null) {
    try {
      window.localStorage.removeItem(GOAL_KEY);
      return true;
    } catch {
      return false;
    }
  }
  return safeSetItem(GOAL_KEY, JSON.stringify(goal));
}

export function saveTrainings(trainings: TrainingRecord[]): boolean {
  return safeSetItem(TRAININGS_KEY, JSON.stringify(trainings));
}

export function saveExercises(exercises: Exercise[]): boolean {
  return safeSetItem(EXERCISES_KEY, JSON.stringify(exercises));
}

export type AppMeta = { lastBackupAt?: string };

export function loadMeta(): AppMeta {
  const { raw } = safeGetItem(META_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    const last = parsed?.lastBackupAt;
    return typeof last === 'string' && !Number.isNaN(Date.parse(last)) ? { lastBackupAt: last } : {};
  } catch {
    return {};
  }
}

export function saveMeta(meta: AppMeta): boolean {
  return safeSetItem(META_KEY, JSON.stringify(meta));
}

import type { BodyRecord, GoalSettings } from '../types';
import { isValidDateString } from './date';

export const RECORDS_KEY = 'metabolic.records.v1';
export const GOAL_KEY = 'metabolic.goal.v1';
export const META_KEY = 'metabolic.meta.v1';
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
    isOptionalNumber(r.skeletalMuscle)
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
    isOptionalNumber(g.targetSkeletalMuscle)
  );
}

export function normalizeRecord(r: BodyRecord): BodyRecord {
  const out: BodyRecord = { id: r.id, date: r.date, weight: r.weight };
  if (isFiniteNumber(r.bodyFat)) out.bodyFat = r.bodyFat;
  if (isFiniteNumber(r.skeletalMuscle)) out.skeletalMuscle = r.skeletalMuscle;
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
  return out;
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

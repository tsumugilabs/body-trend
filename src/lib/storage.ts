import type { BodyRecord, GoalSettings } from '../types';
import { isValidDateString } from './date';

export const RECORDS_KEY = 'metabolic.records.v1';
export const GOAL_KEY = 'metabolic.goal.v1';

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

function normalizeRecord(r: BodyRecord): BodyRecord {
  const out: BodyRecord = { id: r.id, date: r.date, weight: r.weight };
  if (isFiniteNumber(r.bodyFat)) out.bodyFat = r.bodyFat;
  if (isFiniteNumber(r.skeletalMuscle)) out.skeletalMuscle = r.skeletalMuscle;
  return out;
}

function normalizeGoal(g: GoalSettings): GoalSettings {
  const out: GoalSettings = {
    startDate: g.startDate,
    targetDate: g.targetDate,
    targetWeight: g.targetWeight,
  };
  if (isFiniteNumber(g.targetBodyFat)) out.targetBodyFat = g.targetBodyFat;
  if (isFiniteNumber(g.targetSkeletalMuscle)) out.targetSkeletalMuscle = g.targetSkeletalMuscle;
  return out;
}

export type LoadResult<T> = { data: T; problem: boolean };

function safeGetItem(key: string): { raw: string | null; problem: boolean } {
  try {
    return { raw: window.localStorage.getItem(key), problem: false };
  } catch {
    return { raw: null, problem: true };
  }
}

/**
 * 記録を読み込む。壊れたデータは読み飛ばし、アプリは落とさない。
 * 同じ日付が複数ある場合は後に出てきたものを採用する。
 */
export function loadRecords(): LoadResult<BodyRecord[]> {
  const { raw, problem } = safeGetItem(RECORDS_KEY);
  if (raw === null) return { data: [], problem };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { data: [], problem: true };
    const byDate = new Map<string, BodyRecord>();
    let dropped = false;
    for (const item of parsed) {
      if (isBodyRecord(item)) byDate.set(item.date, normalizeRecord(item));
      else dropped = true;
    }
    const data = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    return { data, problem: dropped };
  } catch {
    return { data: [], problem: true };
  }
}

export function loadGoal(): LoadResult<GoalSettings | null> {
  const { raw, problem } = safeGetItem(GOAL_KEY);
  if (raw === null) return { data: null, problem };
  try {
    const parsed: unknown = JSON.parse(raw);
    return isGoalSettings(parsed)
      ? { data: normalizeGoal(parsed), problem: false }
      : { data: null, problem: true };
  } catch {
    return { data: null, problem: true };
  }
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

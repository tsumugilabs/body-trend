import type { BodyRecord, Exercise, GoalSettings, TrainingRecord } from '../types';
import {
  isGoalSettings,
  normalizeGoal,
  sanitizeExercises,
  sanitizeRecords,
  sanitizeTrainings,
} from './storage';

export const BACKUP_APP = 'body-trend';
/** 2: トレーニング記録とマイメニューを追加（1 のファイルもそのまま読み込める） */
export const BACKUP_VERSION = 2;

/** この件数以上データがあり、前回バックアップから一定日数たつとバックアップを促す */
export const BACKUP_REMIND_MIN_RECORDS = 7;
export const BACKUP_REMIND_DAYS = 30;

export type BackupContents = {
  records: BodyRecord[];
  goal: GoalSettings | null;
  trainings: TrainingRecord[];
  exercises: Exercise[];
};

export type BackupData = BackupContents & {
  exportedAt?: string;
  /** 読み込めずに除外した記録の件数 */
  skipped: number;
  /** 読み込めずに除外したトレーニング記録とマイメニューの件数 */
  skippedTrainings: number;
};

export function createBackup(contents: BackupContents, now: Date = new Date()): string {
  return JSON.stringify(
    {
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exportedAt: now.toISOString(),
      records: contents.records,
      goal: contents.goal,
      trainings: contents.trainings,
      exercises: contents.exercises,
    },
    null,
    2,
  );
}

export function backupFileName(today: string): string {
  return `body-trend-backup-${today}.json`;
}

export type ParseBackupResult = { ok: true; data: BackupData } | { ok: false; error: string };

export function parseBackup(text: string): ParseBackupResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'バックアップファイルを読み込めませんでした（形式が正しくありません）' };
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: 'このアプリのバックアップファイルではありません' };
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.app !== BACKUP_APP || !Array.isArray(obj.records)) {
    return { ok: false, error: 'このアプリのバックアップファイルではありません' };
  }
  if (typeof obj.version !== 'number' || obj.version > BACKUP_VERSION) {
    return { ok: false, error: '新しいバージョンのアプリで作られたバックアップのため読み込めません' };
  }

  const { records, skipped } = sanitizeRecords(obj.records);
  const goal = isGoalSettings(obj.goal) ? normalizeGoal(obj.goal) : null;
  // トレーニングは version 2 から。古いバックアップには入っていない
  const training = sanitizeTrainings(Array.isArray(obj.trainings) ? obj.trainings : []);
  const exercise = sanitizeExercises(Array.isArray(obj.exercises) ? obj.exercises : []);
  if (records.length === 0 && goal === null && training.trainings.length === 0) {
    return { ok: false, error: 'バックアップに読み込める記録がありません' };
  }
  const exportedAt =
    typeof obj.exportedAt === 'string' && !Number.isNaN(Date.parse(obj.exportedAt)) ? obj.exportedAt : undefined;

  return {
    ok: true,
    data: {
      records,
      goal,
      trainings: training.trainings,
      exercises: exercise.exercises,
      exportedAt,
      skipped,
      skippedTrainings: training.skipped + exercise.skipped,
    },
  };
}

/** 復元で置き換えたときに消えるもの（復元後に同じ手がかりのものがない） */
function lostByRestore<T>(current: T[], next: T[], keyOf: (item: T) => string): T[] {
  const keys = new Set(next.map(keyOf));
  return current.filter((item) => !keys.has(keyOf(item)));
}

/** 記録は日付ごとに1件なので、復元後の記録に同じ日付がないものが消える */
export function recordsLostByRestore(current: BodyRecord[], next: BodyRecord[]): BodyRecord[] {
  return lostByRestore(current, next, (r) => r.date);
}

/** トレーニングは1日に何件でも記録できるので、id で見る */
export function trainingsLostByRestore(
  current: TrainingRecord[],
  next: TrainingRecord[],
): TrainingRecord[] {
  return lostByRestore(current, next, (t) => t.id);
}

/** itemCount: 記録とトレーニング記録を合わせた件数 */
export function isBackupDue(itemCount: number, lastBackupAt: string | undefined, now: number): boolean {
  if (itemCount < BACKUP_REMIND_MIN_RECORDS) return false;
  if (!lastBackupAt) return true;
  const last = Date.parse(lastBackupAt);
  if (Number.isNaN(last)) return true;
  return now - last >= BACKUP_REMIND_DAYS * 24 * 60 * 60 * 1000;
}

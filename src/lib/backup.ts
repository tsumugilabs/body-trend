import type { BodyRecord, GoalSettings } from '../types';
import { isGoalSettings, normalizeGoal, sanitizeRecords } from './storage';

export const BACKUP_APP = 'body-trend';
export const BACKUP_VERSION = 1;

/** この件数以上記録があり、前回バックアップから一定日数たつとバックアップを促す */
export const BACKUP_REMIND_MIN_RECORDS = 7;
export const BACKUP_REMIND_DAYS = 30;

export type BackupData = {
  records: BodyRecord[];
  goal: GoalSettings | null;
  exportedAt?: string;
  /** 読み込めずに除外した記録の件数 */
  skipped: number;
};

export function createBackup(
  records: BodyRecord[],
  goal: GoalSettings | null,
  now: Date = new Date(),
): string {
  return JSON.stringify(
    { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), records, goal },
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
  if (records.length === 0 && goal === null) {
    return { ok: false, error: 'バックアップに読み込める記録がありません' };
  }
  const exportedAt =
    typeof obj.exportedAt === 'string' && !Number.isNaN(Date.parse(obj.exportedAt)) ? obj.exportedAt : undefined;

  return { ok: true, data: { records, goal, exportedAt, skipped } };
}

export function isBackupDue(recordCount: number, lastBackupAt: string | undefined, now: number): boolean {
  if (recordCount < BACKUP_REMIND_MIN_RECORDS) return false;
  if (!lastBackupAt) return true;
  const last = Date.parse(lastBackupAt);
  if (Number.isNaN(last)) return true;
  return now - last >= BACKUP_REMIND_DAYS * 24 * 60 * 60 * 1000;
}

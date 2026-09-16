import { useCallback, useEffect, useRef, useState } from 'react';
import type { BodyRecord, GoalSettings } from '../types';
import {
  GOAL_KEY,
  META_KEY,
  RECORDS_KEY,
  loadGoal,
  loadMeta,
  loadRecords,
  sameGoal,
  saveGoal,
  saveMeta,
  saveRecords,
} from '../lib/storage';
import { removeRecord, undoReplaceRecords, upsertRecord } from '../lib/records';

/** 全体を置き換える操作の前後を覚えておくための控え */
export type DataSnapshot = {
  records: BodyRecord[];
  goal: GoalSettings | null;
  lastBackupAt?: string;
};

/**
 * 記録と目標の状態を持ち、変更のたびに localStorage へ書き込む。
 * 書き込みに失敗しても画面上の状態は更新し、戻り値 false で呼び出し側に知らせる。
 */
export function useAppData() {
  const [initial] = useState(() => ({ records: loadRecords(), goal: loadGoal() }));
  const [records, setRecords] = useState<BodyRecord[]>(initial.records.data);
  const [goal, setGoal] = useState<GoalSettings | null>(initial.goal.data);
  const [lastBackupAt, setLastBackupAt] = useState<string | undefined>(() => loadMeta().lastBackupAt);
  const recordsRef = useRef(records);
  recordsRef.current = records;
  const loadProblem = initial.records.problem || initial.goal.problem;

  // 別のタブやウィンドウ（ブラウザとホーム画面のアプリなど）での変更を取り込む
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === RECORDS_KEY) setRecords(loadRecords().data);
      if (e.key === null || e.key === GOAL_KEY) setGoal(loadGoal().data);
      if (e.key === null || e.key === META_KEY) setLastBackupAt(loadMeta().lastBackupAt);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /**
   * 書き込み直前に保存済みの最新データを読み直す。
   * 開きっぱなしの古い画面の状態で、別の画面が保存した記録を上書きしないため。
   */
  const latestRecords = useCallback((): BodyRecord[] => {
    const fresh = loadRecords();
    if (fresh.problem && fresh.data.length === 0) return recordsRef.current;
    return fresh.data;
  }, []);

  const commitRecords = useCallback((next: BodyRecord[]): boolean => {
    recordsRef.current = next;
    setRecords(next);
    return saveRecords(next);
  }, []);

  const saveRecord = useCallback(
    (record: BodyRecord): boolean => commitRecords(upsertRecord(latestRecords(), record)),
    [commitRecords, latestRecords],
  );

  const deleteRecord = useCallback(
    (id: string): boolean => commitRecords(removeRecord(latestRecords(), id)),
    [commitRecords, latestRecords],
  );

  const updateGoal = useCallback((next: GoalSettings): boolean => {
    setGoal(next);
    return saveGoal(next);
  }, []);

  const writeBackupMark = useCallback((iso: string | undefined): boolean => {
    setLastBackupAt(iso);
    const meta = { ...loadMeta() };
    if (iso === undefined) delete meta.lastBackupAt;
    else meta.lastBackupAt = iso;
    return saveMeta(meta);
  }, []);

  const snapshot = useCallback(
    (): DataSnapshot => ({ records, goal, lastBackupAt }),
    [records, goal, lastBackupAt],
  );

  /**
   * 記録と目標をまとめて置き換える（復元・全削除・サンプル読み込み）。
   * clearBackupMark: 最終バックアップ日時も消す（残っていると、別のデータのバックアップを最新として扱ってしまうため）
   */
  const replaceAll = useCallback(
    (
      nextRecords: BodyRecord[],
      nextGoal: GoalSettings | null,
      options: { clearBackupMark?: boolean } = {},
    ): boolean => {
      const okRecords = commitRecords(nextRecords);
      setGoal(nextGoal);
      const okGoal = saveGoal(nextGoal);
      const okMark = options.clearBackupMark ? writeBackupMark(undefined) : true;
      return okRecords && okGoal && okMark;
    },
    [commitRecords, writeBackupMark],
  );

  /**
   * replaceAll を取り消す。取り消せるあいだに別の画面が加えた変更は巻き戻さずに残す。
   * @returns kept 残した（この操作のあとの）変更の件数
   */
  const undoReplaceAll = useCallback(
    (before: DataSnapshot, applied: DataSnapshot): { ok: boolean; kept: number } => {
      const { records: merged, kept } = undoReplaceRecords(
        before.records,
        applied.records,
        latestRecords(),
      );
      const okRecords = commitRecords(merged);

      const currentGoal = loadGoal().data;
      const nextGoal = sameGoal(currentGoal, applied.goal) ? before.goal : currentGoal;
      setGoal(nextGoal);
      const okGoal = saveGoal(nextGoal);

      // 取り消せるあいだにバックアップを保存していたら、その日時を残す
      const currentMark = loadMeta().lastBackupAt;
      const okMark = currentMark === applied.lastBackupAt ? writeBackupMark(before.lastBackupAt) : true;

      return { ok: okRecords && okGoal && okMark, kept };
    },
    [commitRecords, latestRecords, writeBackupMark],
  );

  const markBackedUp = useCallback(
    (iso: string): boolean => writeBackupMark(iso),
    [writeBackupMark],
  );

  return {
    records,
    goal,
    lastBackupAt,
    loadProblem,
    saveRecord,
    deleteRecord,
    updateGoal,
    snapshot,
    replaceAll,
    undoReplaceAll,
    markBackedUp,
  };
}

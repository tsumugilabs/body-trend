import { useCallback, useEffect, useRef, useState } from 'react';
import type { BodyRecord, GoalSettings } from '../types';
import {
  GOAL_KEY,
  META_KEY,
  RECORDS_KEY,
  loadGoal,
  loadMeta,
  loadRecords,
  saveGoal,
  saveMeta,
  saveRecords,
} from '../lib/storage';
import { removeRecord, upsertRecord } from '../lib/records';

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

  const replaceAll = useCallback(
    (nextRecords: BodyRecord[], nextGoal: GoalSettings | null): boolean => {
      const a = commitRecords(nextRecords);
      setGoal(nextGoal);
      const b = saveGoal(nextGoal);
      return a && b;
    },
    [commitRecords],
  );

  const markBackedUp = useCallback((iso: string): boolean => {
    setLastBackupAt(iso);
    return saveMeta({ ...loadMeta(), lastBackupAt: iso });
  }, []);

  return {
    records,
    goal,
    lastBackupAt,
    loadProblem,
    saveRecord,
    deleteRecord,
    updateGoal,
    replaceAll,
    markBackedUp,
  };
}

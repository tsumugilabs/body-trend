import { useCallback, useState } from 'react';
import type { BodyRecord, GoalSettings } from '../types';
import { loadGoal, loadRecords, saveGoal, saveRecords } from '../lib/storage';
import { removeRecord, upsertRecord } from '../lib/records';

/**
 * 記録と目標の状態を持ち、変更のたびに localStorage へ書き込む。
 * 書き込みに失敗しても画面上の状態は更新し、戻り値 false で呼び出し側に知らせる。
 */
export function useAppData() {
  const [initial] = useState(() => ({ records: loadRecords(), goal: loadGoal() }));
  const [records, setRecords] = useState<BodyRecord[]>(initial.records.data);
  const [goal, setGoal] = useState<GoalSettings | null>(initial.goal.data);
  const loadProblem = initial.records.problem || initial.goal.problem;

  const saveRecord = useCallback(
    (record: BodyRecord): boolean => {
      const next = upsertRecord(records, record);
      setRecords(next);
      return saveRecords(next);
    },
    [records],
  );

  const deleteRecord = useCallback(
    (id: string): boolean => {
      const next = removeRecord(records, id);
      setRecords(next);
      return saveRecords(next);
    },
    [records],
  );

  const updateGoal = useCallback((next: GoalSettings): boolean => {
    setGoal(next);
    return saveGoal(next);
  }, []);

  const replaceAll = useCallback((nextRecords: BodyRecord[], nextGoal: GoalSettings | null): boolean => {
    setRecords(nextRecords);
    setGoal(nextGoal);
    const a = saveRecords(nextRecords);
    const b = saveGoal(nextGoal);
    return a && b;
  }, []);

  return { records, goal, loadProblem, saveRecord, deleteRecord, updateGoal, replaceAll };
}

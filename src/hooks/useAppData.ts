import { useCallback, useEffect, useRef, useState } from 'react';
import type { BodyRecord, Exercise, GoalSettings, TrainingRecord } from '../types';
import {
  EXERCISES_KEY,
  GOAL_KEY,
  META_KEY,
  RECORDS_KEY,
  TRAININGS_KEY,
  loadExercises,
  loadGoal,
  loadMeta,
  loadRecords,
  loadTrainings,
  sameGoal,
  saveExercises,
  saveGoal,
  saveMeta,
  saveRecords,
  saveTrainings,
} from '../lib/storage';
import { removeRecord, undoReplaceRecords, upsertRecord } from '../lib/records';
import {
  removeExercise,
  removeTraining,
  undoReplaceExercises,
  undoReplaceTrainings,
  upsertExercise,
  upsertTraining,
} from '../lib/trainings';

/** 全体を置き換える操作で、まとめて入れ替える中身 */
export type AppContents = {
  records: BodyRecord[];
  goal: GoalSettings | null;
  trainings: TrainingRecord[];
  exercises: Exercise[];
};

/** 全体を置き換える操作の前後を覚えておくための控え */
export type DataSnapshot = AppContents & { lastBackupAt?: string };

/**
 * 記録・目標・トレーニングの状態を持ち、変更のたびに localStorage へ書き込む。
 * 書き込みに失敗しても画面上の状態は更新し、戻り値 false で呼び出し側に知らせる。
 */
export function useAppData() {
  const [initial] = useState(() => ({
    records: loadRecords(),
    goal: loadGoal(),
    trainings: loadTrainings(),
    exercises: loadExercises(),
  }));
  const [records, setRecords] = useState<BodyRecord[]>(initial.records.data);
  const [goal, setGoal] = useState<GoalSettings | null>(initial.goal.data);
  const [trainings, setTrainings] = useState<TrainingRecord[]>(initial.trainings.data);
  const [exercises, setExercises] = useState<Exercise[]>(initial.exercises.data);
  const [lastBackupAt, setLastBackupAt] = useState<string | undefined>(() => loadMeta().lastBackupAt);
  const recordsRef = useRef(records);
  recordsRef.current = records;
  const trainingsRef = useRef(trainings);
  trainingsRef.current = trainings;
  const exercisesRef = useRef(exercises);
  exercisesRef.current = exercises;
  const loadProblem =
    initial.records.problem ||
    initial.goal.problem ||
    initial.trainings.problem ||
    initial.exercises.problem;

  // 別のタブやウィンドウ（ブラウザとホーム画面のアプリなど）での変更を取り込む
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === RECORDS_KEY) setRecords(loadRecords().data);
      if (e.key === null || e.key === GOAL_KEY) setGoal(loadGoal().data);
      if (e.key === null || e.key === TRAININGS_KEY) setTrainings(loadTrainings().data);
      if (e.key === null || e.key === EXERCISES_KEY) setExercises(loadExercises().data);
      if (e.key === null || e.key === META_KEY) setLastBackupAt(loadMeta().lastBackupAt);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /**
   * 書き込み直前に保存済みの最新データを読み直す。
   * 開きっぱなしの古い画面の状態で、別の画面が保存した内容を上書きしないため。
   */
  const latestRecords = useCallback((): BodyRecord[] => {
    const fresh = loadRecords();
    if (fresh.problem && fresh.data.length === 0) return recordsRef.current;
    return fresh.data;
  }, []);

  const latestTrainings = useCallback((): TrainingRecord[] => {
    const fresh = loadTrainings();
    if (fresh.problem && fresh.data.length === 0) return trainingsRef.current;
    return fresh.data;
  }, []);

  const latestExercises = useCallback((): Exercise[] => {
    const fresh = loadExercises();
    if (fresh.problem && fresh.data.length === 0) return exercisesRef.current;
    return fresh.data;
  }, []);

  const commitRecords = useCallback((next: BodyRecord[]): boolean => {
    recordsRef.current = next;
    setRecords(next);
    return saveRecords(next);
  }, []);

  const commitTrainings = useCallback((next: TrainingRecord[]): boolean => {
    trainingsRef.current = next;
    setTrainings(next);
    return saveTrainings(next);
  }, []);

  const commitExercises = useCallback((next: Exercise[]): boolean => {
    exercisesRef.current = next;
    setExercises(next);
    return saveExercises(next);
  }, []);

  const saveRecord = useCallback(
    (record: BodyRecord): boolean => commitRecords(upsertRecord(latestRecords(), record)),
    [commitRecords, latestRecords],
  );

  const deleteRecord = useCallback(
    (id: string): boolean => commitRecords(removeRecord(latestRecords(), id)),
    [commitRecords, latestRecords],
  );

  const saveTraining = useCallback(
    (training: TrainingRecord): boolean => commitTrainings(upsertTraining(latestTrainings(), training)),
    [commitTrainings, latestTrainings],
  );

  const deleteTraining = useCallback(
    (id: string): boolean => commitTrainings(removeTraining(latestTrainings(), id)),
    [commitTrainings, latestTrainings],
  );

  const saveExercise = useCallback(
    (exercise: Exercise): boolean => commitExercises(upsertExercise(latestExercises(), exercise)),
    [commitExercises, latestExercises],
  );

  /** マイメニューから種目を消す。記録は種目名を持っているので、履歴はそのまま残る。 */
  const deleteExercise = useCallback(
    (id: string): boolean => commitExercises(removeExercise(latestExercises(), id)),
    [commitExercises, latestExercises],
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
    (): DataSnapshot => ({ records, goal, trainings, exercises, lastBackupAt }),
    [records, goal, trainings, exercises, lastBackupAt],
  );

  /**
   * 記録・目標・トレーニングをまとめて置き換える（復元・全削除・サンプル読み込み）。
   * clearBackupMark: 最終バックアップ日時も消す（残っていると、別のデータのバックアップを最新として扱ってしまうため）
   */
  const replaceAll = useCallback(
    (next: AppContents, options: { clearBackupMark?: boolean } = {}): boolean => {
      const okRecords = commitRecords(next.records);
      setGoal(next.goal);
      const okGoal = saveGoal(next.goal);
      const okTrainings = commitTrainings(next.trainings);
      const okExercises = commitExercises(next.exercises);
      const okMark = options.clearBackupMark ? writeBackupMark(undefined) : true;
      return okRecords && okGoal && okTrainings && okExercises && okMark;
    },
    [commitRecords, commitTrainings, commitExercises, writeBackupMark],
  );

  /**
   * replaceAll を取り消す。取り消せるあいだに別の画面が加えた変更は巻き戻さずに残す。
   * @returns kept 残した（この操作のあとの）変更の件数
   */
  const undoReplaceAll = useCallback(
    (before: DataSnapshot, applied: DataSnapshot): { ok: boolean; kept: number } => {
      const mergedRecords = undoReplaceRecords(before.records, applied.records, latestRecords());
      const okRecords = commitRecords(mergedRecords.records);

      const mergedTrainings = undoReplaceTrainings(
        before.trainings,
        applied.trainings,
        latestTrainings(),
      );
      const okTrainings = commitTrainings(mergedTrainings.trainings);

      const mergedExercises = undoReplaceExercises(
        before.exercises,
        applied.exercises,
        latestExercises(),
      );
      const okExercises = commitExercises(mergedExercises.exercises);

      const currentGoal = loadGoal().data;
      const nextGoal = sameGoal(currentGoal, applied.goal) ? before.goal : currentGoal;
      setGoal(nextGoal);
      const okGoal = saveGoal(nextGoal);

      // 取り消せるあいだにバックアップを保存していたら、その日時を残す
      const currentMark = loadMeta().lastBackupAt;
      const okMark = currentMark === applied.lastBackupAt ? writeBackupMark(before.lastBackupAt) : true;

      return {
        ok: okRecords && okGoal && okTrainings && okExercises && okMark,
        kept: mergedRecords.kept + mergedTrainings.kept + mergedExercises.kept,
      };
    },
    [
      commitRecords,
      commitTrainings,
      commitExercises,
      latestRecords,
      latestTrainings,
      latestExercises,
      writeBackupMark,
    ],
  );

  const markBackedUp = useCallback(
    (iso: string): boolean => writeBackupMark(iso),
    [writeBackupMark],
  );

  return {
    records,
    goal,
    trainings,
    exercises,
    lastBackupAt,
    loadProblem,
    saveRecord,
    deleteRecord,
    saveTraining,
    deleteTraining,
    saveExercise,
    deleteExercise,
    updateGoal,
    snapshot,
    replaceAll,
    undoReplaceAll,
    markBackedUp,
  };
}

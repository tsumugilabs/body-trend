export type BodyRecord = {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  weight: number;
  bodyFat?: number;
  skeletalMuscle?: number;
  /** 腹囲（cm） */
  waist?: number;
};

export type GoalSettings = {
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  targetDate: string;
  targetWeight: number;
  targetBodyFat?: number;
  targetSkeletalMuscle?: number;
  targetWaist?: number;
};

export type MetricKey = 'weight' | 'bodyFat' | 'skeletalMuscle' | 'waist';

export type PeriodKey = '7' | '30' | '90' | 'all';

export type ExerciseKind = 'strength' | 'cardio' | 'sport';

/** マイメニュー（よく行う種目の登録） */
export type Exercise = {
  id: string;
  name: string;
  kind: ExerciseKind;
};

export type TrainingRecord = {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** 登録した種目の id（マイメニューから消えても履歴が読めるよう、名前と種類も持つ） */
  exerciseId: string;
  exerciseName: string;
  kind: ExerciseKind;
  /** 重量（kg） */
  weight?: number;
  /** 回数 */
  reps?: number;
  /** セット数 */
  sets?: number;
  /** 時間（分） */
  minutes?: number;
  /** 距離（km） */
  distance?: number;
  memo?: string;
};

export type TabKey = 'home' | 'record' | 'training' | 'history' | 'settings';

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

export type TabKey = 'home' | 'record' | 'history' | 'settings';

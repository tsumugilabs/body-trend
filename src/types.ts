export type BodyRecord = {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  weight: number;
  bodyFat?: number;
  skeletalMuscle?: number;
};

export type GoalSettings = {
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  targetDate: string;
  targetWeight: number;
  targetBodyFat?: number;
  targetSkeletalMuscle?: number;
};

export type MetricKey = 'weight' | 'bodyFat' | 'skeletalMuscle';

export type PeriodKey = '7' | '30' | '90' | 'all';

export type TabKey = 'home' | 'record' | 'history' | 'settings';

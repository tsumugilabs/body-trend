import type { BodyRecord, GoalSettings, MetricKey } from '../types';

export type MetricDef = {
  key: MetricKey;
  label: string;
  unit: string;
  /** 増減を表す単位（% の差は「pt」で表す） */
  diffUnit: string;
  /** 減ると望ましい方向か */
  goodDirection: 'down' | 'up';
  /** 記録が少ないときの Y 軸の最小幅 */
  minSpan: number;
  goalKey: 'targetWeight' | 'targetBodyFat' | 'targetSkeletalMuscle' | 'targetWaist';
};

export const METRICS: Record<MetricKey, MetricDef> = {
  weight: {
    key: 'weight',
    label: '体重',
    unit: 'kg',
    diffUnit: 'kg',
    goodDirection: 'down',
    minSpan: 2,
    goalKey: 'targetWeight',
  },
  bodyFat: {
    key: 'bodyFat',
    label: '体脂肪率',
    unit: '%',
    diffUnit: 'pt',
    goodDirection: 'down',
    minSpan: 2,
    goalKey: 'targetBodyFat',
  },
  skeletalMuscle: {
    key: 'skeletalMuscle',
    label: '骨格筋率',
    unit: '%',
    diffUnit: 'pt',
    goodDirection: 'up',
    minSpan: 2,
    goalKey: 'targetSkeletalMuscle',
  },
  waist: {
    key: 'waist',
    label: '腹囲',
    unit: 'cm',
    diffUnit: 'cm',
    goodDirection: 'down',
    minSpan: 2,
    goalKey: 'targetWaist',
  },
};

export const METRIC_ORDER: MetricKey[] = ['weight', 'bodyFat', 'skeletalMuscle', 'waist'];

export function metricValue(record: BodyRecord, key: MetricKey): number | undefined {
  return record[key];
}

export function goalValue(goal: GoalSettings | null, key: MetricKey): number | undefined {
  if (!goal) return undefined;
  return goal[METRICS[key].goalKey];
}

export function formatNumber(value: number | undefined): string {
  return value === undefined || Number.isNaN(value) ? '—' : value.toFixed(1);
}

/** 小数点第1位で四捨五入（負の値も絶対値で丸める） */
export function round1(value: number): number {
  return (Math.sign(value) * Math.round(Math.abs(value) * 10 + 1e-9)) / 10;
}

/** 符号付き（+1.2 / −0.5 / ±0.0） */
export function formatSigned(value: number): string {
  const rounded = round1(value);
  if (rounded === 0) return '±0.0';
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(1)}`;
}

export type Tone = 'good' | 'neutral';

/** 望ましい方向の変化なら good。それ以外は強調しない neutral。 */
export function changeTone(key: MetricKey, diff: number): Tone {
  const rounded = round1(diff);
  if (rounded === 0) return 'neutral';
  const dir = METRICS[key].goodDirection;
  return (dir === 'down' && rounded < 0) || (dir === 'up' && rounded > 0) ? 'good' : 'neutral';
}

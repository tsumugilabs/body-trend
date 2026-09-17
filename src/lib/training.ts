import type { ExerciseKind, TrainingRecord } from '../types';


export type TrainingFieldKey = 'weight' | 'reps' | 'sets' | 'minutes' | 'distance';

export type TrainingFieldDef = {
  key: TrainingFieldKey;
  label: string;
  unit: string;
  /** 整数だけ受け付けるか */
  integer: boolean;
  /** この範囲外は明らかな入力ミスとしてエラー */
  hardMin: number;
  hardMax: number;
  /** これを超えると珍しい値として確認する */
  softMax: number;
  placeholder: string;
};

export const TRAINING_FIELDS: Record<TrainingFieldKey, TrainingFieldDef> = {
  weight: {
    key: 'weight',
    label: '重量',
    unit: 'kg',
    integer: false,
    hardMin: 0.5,
    hardMax: 500,
    softMax: 250,
    placeholder: '例 60.0',
  },
  reps: {
    key: 'reps',
    label: '回数',
    unit: '回',
    integer: true,
    hardMin: 1,
    hardMax: 1000,
    softMax: 100,
    placeholder: '例 10',
  },
  sets: {
    key: 'sets',
    label: 'セット数',
    unit: 'セット',
    integer: true,
    hardMin: 1,
    hardMax: 100,
    softMax: 20,
    placeholder: '例 3',
  },
  minutes: {
    key: 'minutes',
    label: '時間',
    unit: '分',
    integer: true,
    hardMin: 1,
    hardMax: 1440,
    softMax: 360,
    placeholder: '例 30',
  },
  distance: {
    key: 'distance',
    label: '距離',
    unit: 'km',
    integer: false,
    hardMin: 0.1,
    hardMax: 1000,
    softMax: 100,
    placeholder: '例 5.0',
  },
};

export const TRAINING_FIELD_ORDER: TrainingFieldKey[] = ['weight', 'reps', 'sets', 'minutes', 'distance'];

export type KindDef = {
  key: ExerciseKind;
  label: string;
  /** この種類で入力する項目（すべて任意。ただし1つ以上は必要） */
  fields: TrainingFieldKey[];
  examples: string[];
};

export const KINDS: Record<ExerciseKind, KindDef> = {
  strength: {
    key: 'strength',
    label: '筋トレ',
    fields: ['weight', 'reps', 'sets'],
    examples: ['ベンチプレス', 'スクワット', 'デッドリフト', '懸垂', '腕立て伏せ', '腹筋'],
  },
  cardio: {
    key: 'cardio',
    label: '有酸素',
    fields: ['minutes', 'distance'],
    examples: ['ランニング', 'ウォーキング', 'サイクリング', 'エアロバイク', '縄跳び'],
  },
  sport: {
    key: 'sport',
    label: 'スポーツ',
    fields: ['minutes', 'distance'],
    examples: ['水泳', 'テニス', 'ゴルフ', 'サッカー', 'バスケ', '登山'],
  },
};

export const KIND_ORDER: ExerciseKind[] = ['strength', 'cardio', 'sport'];

export const MEMO_MAX = 100;
export const EXERCISE_NAME_MAX = 20;

/** 日付の昇順（同じ日は元の順のまま） */
export function sortTrainings(trainings: TrainingRecord[]): TrainingRecord[] {
  return [...trainings].sort((a, b) => a.date.localeCompare(b.date));
}

export function formatTrainingValue(key: TrainingFieldKey, value: number): string {
  const { integer, unit } = TRAINING_FIELDS[key];
  return `${integer ? String(value) : value.toFixed(1)}${unit}`;
}

/** 「60.0kg × 10回 × 3セット」「30分 ・ 5.0km」のような1行の要約 */
export function summarizeTraining(training: TrainingRecord): string {
  const separator = training.kind === 'strength' ? ' × ' : ' ・ ';
  const parts = TRAINING_FIELD_ORDER.filter((key) => training[key] !== undefined).map((key) =>
    formatTrainingValue(key, training[key] as number),
  );
  return parts.join(separator);
}

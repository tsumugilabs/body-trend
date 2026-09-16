import type { BodyRecord, Exercise, ExerciseKind, GoalSettings, MetricKey, TrainingRecord } from '../types';
import { isValidDateString } from './date';
import { previousRecord } from './records';
import { METRICS, METRIC_ORDER, type MetricDef } from './metrics';
import {
  EXERCISE_NAME_MAX,
  KINDS,
  MEMO_MAX,
  TRAINING_FIELDS,
  type TrainingFieldKey,
} from './training';
import { findExerciseByName } from './trainings';

/**
 * hard: この範囲外は明らかな入力ミスとしてエラー
 * soft: この範囲外は珍しい値として確認を出す
 */
type Range = { hardMin: number; hardMax: number; softMin: number; softMax: number };

export const RANGES: Record<MetricKey, Range> = {
  weight: { hardMin: 20, hardMax: 300, softMin: 30, softMax: 200 },
  bodyFat: { hardMin: 1, hardMax: 75, softMin: 3, softMax: 60 },
  skeletalMuscle: { hardMin: 5, hardMax: 70, softMin: 15, softMax: 60 },
  waist: { hardMin: 30, hardMax: 200, softMin: 50, softMax: 150 },
};

/** 前回の記録からこれ以上変化していたら確認する */
export const SUDDEN_CHANGE: Record<MetricKey, number> = {
  weight: 5,
  bodyFat: 8,
  skeletalMuscle: 8,
  waist: 10,
};

export type ParseResult =
  | { ok: true; value: number | undefined }
  | { ok: false; error: string };

/** 数値入力を解析する。全角数字や「,」の小数点も受け付ける。空欄は undefined。 */
export function parseDecimal(input: string): ParseResult {
  const normalized = input
    .trim()
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[，,．。]/g, '.');
  if (normalized === '') return { ok: true, value: undefined };
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(normalized)) {
    return { ok: false, error: '数値で入力してください' };
  }
  const [, decimals = ''] = normalized.split('.');
  if (decimals.length > 1) {
    return { ok: false, error: '小数点第1位まで入力してください' };
  }
  return { ok: true, value: Number(normalized) };
}

function checkRange(key: MetricKey, value: number): { error?: string; warning?: string } {
  const range = RANGES[key];
  const { label, unit } = METRICS[key];
  if (value < range.hardMin || value > range.hardMax) {
    return { error: `${label}は ${range.hardMin}〜${range.hardMax}${unit} の範囲で入力してください` };
  }
  if (value < range.softMin || value > range.softMax) {
    return { warning: `${label} ${value.toFixed(1)}${unit} は一般的な範囲から外れています` };
  }
  return {};
}

export type RecordInput = {
  date: string;
  weight: string;
  bodyFat: string;
  skeletalMuscle: string;
  waist: string;
};

export type FieldErrors = Partial<Record<keyof RecordInput, string>>;

export type RecordValidation = {
  errors: FieldErrors;
  /** 保存前に確認を求める内容 */
  warnings: string[];
  values?: Omit<BodyRecord, 'id'>;
};

export function validateRecord(
  input: RecordInput,
  options: { today: string; records: BodyRecord[]; editingId?: string },
): RecordValidation {
  const errors: FieldErrors = {};
  const warnings: string[] = [];

  if (!input.date) errors.date = '日付を入力してください';
  else if (!isValidDateString(input.date)) errors.date = '日付の形式が正しくありません';
  else if (input.date > options.today) errors.date = '未来の日付は記録できません';

  const parsed: Partial<Record<MetricKey, number>> = {};
  METRIC_ORDER.forEach((key) => {
    const result = parseDecimal(input[key]);
    if (!result.ok) {
      errors[key] = result.error;
      return;
    }
    if (result.value === undefined) {
      if (key === 'weight') errors.weight = '体重を入力してください';
      return;
    }
    const range = checkRange(key, result.value);
    if (range.error) errors[key] = range.error;
    else {
      if (range.warning) warnings.push(range.warning);
      parsed[key] = result.value;
    }
  });

  if (Object.keys(errors).length > 0) return { errors, warnings: [] };

  // 前回の記録と比べて急な変化がないか
  const others = options.records.filter((r) => r.id !== options.editingId);
  const prev = previousRecord(others, input.date);
  if (prev) {
    METRIC_ORDER.forEach((key) => {
      const now = parsed[key];
      const before = prev[key];
      if (now === undefined || before === undefined) return;
      const diff = Math.abs(now - before);
      if (diff >= SUDDEN_CHANGE[key]) {
        const { label, diffUnit } = METRICS[key];
        warnings.push(
          `${label}が前回（${prev.date}）から ${diff.toFixed(1)}${diffUnit} 変化しています`,
        );
      }
    });
  }

  const values: Omit<BodyRecord, 'id'> = { date: input.date, weight: parsed.weight as number };
  if (parsed.bodyFat !== undefined) values.bodyFat = parsed.bodyFat;
  if (parsed.skeletalMuscle !== undefined) values.skeletalMuscle = parsed.skeletalMuscle;
  if (parsed.waist !== undefined) values.waist = parsed.waist;

  return { errors, warnings, values };
}

export type GoalInput = {
  startDate: string;
  targetDate: string;
  targetWeight: string;
  targetBodyFat: string;
  targetSkeletalMuscle: string;
  targetWaist: string;
};

export type GoalErrors = Partial<Record<keyof GoalInput, string>>;

export type GoalValidation = {
  errors: GoalErrors;
  warnings: string[];
  values?: GoalSettings;
};

export function validateGoal(input: GoalInput, options: { today?: string } = {}): GoalValidation {
  const errors: GoalErrors = {};
  const warnings: string[] = [];

  if (!input.startDate) errors.startDate = '開始日を入力してください';
  else if (!isValidDateString(input.startDate)) errors.startDate = '日付の形式が正しくありません';

  if (!input.targetDate) errors.targetDate = '目標日を入力してください';
  else if (!isValidDateString(input.targetDate)) errors.targetDate = '日付の形式が正しくありません';
  else if (!errors.startDate && input.targetDate <= input.startDate) {
    errors.targetDate = '目標日は開始日より後の日付にしてください';
  }

  const fields = METRIC_ORDER.map((metric) => [METRICS[metric].goalKey, metric] as const);
  const parsed: Partial<Record<MetricDef['goalKey'], number>> = {};
  for (const [field, metric] of fields) {
    const result = parseDecimal(input[field]);
    if (!result.ok) {
      errors[field] = result.error;
      continue;
    }
    if (result.value === undefined) {
      if (field === 'targetWeight') errors.targetWeight = '目標体重を入力してください';
      continue;
    }
    const range = checkRange(metric, result.value);
    if (range.error) errors[field] = range.error.replace(METRICS[metric].label, `目標${METRICS[metric].label}`);
    else {
      if (range.warning) warnings.push(`目標${range.warning}`);
      parsed[field] = result.value;
    }
  }

  if (Object.keys(errors).length > 0) return { errors, warnings: [] };

  if (options.today && input.targetDate < options.today) {
    warnings.push('目標日が今日より前の日付になっています');
  }

  const values: GoalSettings = {
    startDate: input.startDate,
    targetDate: input.targetDate,
    targetWeight: parsed.targetWeight as number,
  };
  if (parsed.targetBodyFat !== undefined) values.targetBodyFat = parsed.targetBodyFat;
  if (parsed.targetSkeletalMuscle !== undefined) values.targetSkeletalMuscle = parsed.targetSkeletalMuscle;
  if (parsed.targetWaist !== undefined) values.targetWaist = parsed.targetWaist;
  return { errors, warnings, values };
}

export type TrainingInput = {
  date: string;
  exerciseId: string;
  memo: string;
} & Record<TrainingFieldKey, string>;

export type TrainingErrors = Partial<Record<keyof TrainingInput, string>>;

export type TrainingValidation = {
  errors: TrainingErrors;
  warnings: string[];
  values?: Omit<TrainingRecord, 'id'>;
};

/** 種類ごとに使う項目だけを検証する。項目はすべて任意だが、1つ以上は入力が必要。 */
export function validateTraining(
  input: TrainingInput,
  options: { today: string; exercises: Exercise[] },
): TrainingValidation {
  const errors: TrainingErrors = {};
  const warnings: string[] = [];

  if (!input.date) errors.date = '日付を入力してください';
  else if (!isValidDateString(input.date)) errors.date = '日付の形式が正しくありません';
  else if (input.date > options.today) errors.date = '未来の日付は記録できません';

  const exercise = options.exercises.find((e) => e.id === input.exerciseId);
  if (!exercise) errors.exerciseId = '種目を選んでください';

  const memo = input.memo.trim();
  if (memo.length > MEMO_MAX) errors.memo = `メモは${MEMO_MAX}文字までです`;

  const parsed: Partial<Record<TrainingFieldKey, number>> = {};
  const fields = exercise ? KINDS[exercise.kind].fields : [];
  for (const key of fields) {
    const field = TRAINING_FIELDS[key];
    const result = parseDecimal(input[key]);
    if (!result.ok) {
      errors[key] = result.error;
      continue;
    }
    if (result.value === undefined) continue;
    if (field.integer && !Number.isInteger(result.value)) {
      errors[key] = `${field.label}は整数で入力してください`;
      continue;
    }
    if (result.value < field.hardMin || result.value > field.hardMax) {
      errors[key] = `${field.label}は ${field.hardMin}〜${field.hardMax}${field.unit} の範囲で入力してください`;
      continue;
    }
    if (result.value > field.softMax) {
      warnings.push(`${field.label} ${formatTrainingInput(key, result.value)} は一般的な範囲から外れています`);
    }
    parsed[key] = result.value;
  }

  if (exercise && fields.length > 0 && fields.every((key) => parsed[key] === undefined) && !errors[fields[0]]) {
    errors[fields[0]] = '内容を1つ以上入力してください';
  }

  if (Object.keys(errors).length > 0 || !exercise) return { errors, warnings: [] };

  const values: Omit<TrainingRecord, 'id'> = {
    date: input.date,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    kind: exercise.kind,
  };
  for (const key of fields) {
    const value = parsed[key];
    if (value !== undefined) values[key] = value;
  }
  if (memo) values.memo = memo;

  return { errors, warnings, values };
}

function formatTrainingInput(key: TrainingFieldKey, value: number): string {
  const { integer, unit } = TRAINING_FIELDS[key];
  return `${integer ? String(value) : value.toFixed(1)}${unit}`;
}

export type ExerciseInput = { name: string; kind: ExerciseKind };

export type ExerciseValidation = { error?: string; values?: Omit<Exercise, 'id'> };

export function validateExercise(
  input: ExerciseInput,
  options: { exercises: Exercise[]; editingId?: string },
): ExerciseValidation {
  const name = input.name.trim();
  if (!name) return { error: '種目名を入力してください' };
  if (name.length > EXERCISE_NAME_MAX) return { error: `種目名は${EXERCISE_NAME_MAX}文字までです` };
  const others = options.exercises.filter((e) => e.id !== options.editingId);
  if (findExerciseByName(others, name)) return { error: '同じ名前の種目がすでにあります' };
  return { values: { name, kind: input.kind } };
}

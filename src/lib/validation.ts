import type { BodyRecord, GoalSettings, MetricKey } from '../types';
import { isValidDateString } from './date';
import { previousRecord } from './records';
import { METRICS } from './metrics';

/**
 * hard: この範囲外は明らかな入力ミスとしてエラー
 * soft: この範囲外は珍しい値として確認を出す
 */
type Range = { hardMin: number; hardMax: number; softMin: number; softMax: number };

export const RANGES: Record<MetricKey, Range> = {
  weight: { hardMin: 20, hardMax: 300, softMin: 30, softMax: 200 },
  bodyFat: { hardMin: 1, hardMax: 75, softMin: 3, softMax: 60 },
  skeletalMuscle: { hardMin: 5, hardMax: 70, softMin: 15, softMax: 60 },
};

/** 前回の記録からこれ以上変化していたら確認する */
export const SUDDEN_CHANGE: Record<MetricKey, number> = {
  weight: 5,
  bodyFat: 8,
  skeletalMuscle: 8,
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
  (['weight', 'bodyFat', 'skeletalMuscle'] as const).forEach((key) => {
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
    (['weight', 'bodyFat', 'skeletalMuscle'] as const).forEach((key) => {
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

  return { errors, warnings, values };
}

export type GoalInput = {
  startDate: string;
  targetDate: string;
  targetWeight: string;
  targetBodyFat: string;
  targetSkeletalMuscle: string;
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

  const fields = [
    ['targetWeight', 'weight'],
    ['targetBodyFat', 'bodyFat'],
    ['targetSkeletalMuscle', 'skeletalMuscle'],
  ] as const;
  const parsed: Partial<Record<(typeof fields)[number][0], number>> = {};
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
  return { errors, warnings, values };
}

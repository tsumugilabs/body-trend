import type { BodyRecord, GoalSettings, MetricKey, PeriodKey } from '../types';
import { addDays, dateToTime, diffDays } from './date';
import { METRICS, goalValue } from './metrics';

export type LatestValue = { value: number; date: string } | undefined;

export type DashboardSummary = {
  latest?: BodyRecord;
  latestBodyFat: LatestValue;
  latestSkeletalMuscle: LatestValue;
  latestWaist: LatestValue;
  /** 目標日までの残り日数（過ぎていれば負） */
  daysLeft?: number;
  /** 基準にした開始時の記録 */
  baseline?: BodyRecord;
  /** 開始時からの体重変化 */
  weightChange?: number;
  /** 現在体重 − 目標体重（0以下なら達成） */
  weightToGoal?: number;
};

function latestWith(records: BodyRecord[], key: MetricKey): LatestValue {
  for (let i = records.length - 1; i >= 0; i--) {
    const v = records[i][key];
    if (v !== undefined) return { value: v, date: records[i].date };
  }
  return undefined;
}

/**
 * 開始時の記録。開始日以前の最新記録があればそれ、なければ開始日以降で最も古い記録。
 */
export function findBaseline(records: BodyRecord[], startDate?: string): BodyRecord | undefined {
  if (records.length === 0) return undefined;
  if (!startDate) return records[0];
  const before = records.filter((r) => r.date <= startDate);
  if (before.length > 0) return before[before.length - 1];
  return records[0];
}

/** records は日付昇順を前提とする */
export function summarize(
  records: BodyRecord[],
  goal: GoalSettings | null,
  today: string,
): DashboardSummary {
  const latest = records[records.length - 1];
  const summary: DashboardSummary = {
    latest,
    latestBodyFat: latestWith(records, 'bodyFat'),
    latestSkeletalMuscle: latestWith(records, 'skeletalMuscle'),
    latestWaist: latestWith(records, 'waist'),
  };
  if (goal) summary.daysLeft = diffDays(today, goal.targetDate);
  if (latest) {
    const baseline = findBaseline(records, goal?.startDate);
    summary.baseline = baseline;
    if (baseline) summary.weightChange = latest.weight - baseline.weight;
    if (goal) summary.weightToGoal = latest.weight - goal.targetWeight;
  }
  return summary;
}

/** 指定した指標の、開始時からの変化 */
export function metricChange(
  records: BodyRecord[],
  key: MetricKey,
  startDate?: string,
): number | undefined {
  const withValue = records.filter((r) => r[key] !== undefined);
  if (withValue.length < 2) return undefined;
  const base = findBaseline(withValue, startDate);
  const last = withValue[withValue.length - 1];
  if (!base || base.id === last.id) return undefined;
  return (last[key] as number) - (base[key] as number);
}

export type ChartPoint = { time: number; date: string; value: number };

export type ChartModel = {
  points: ChartPoint[];
  xDomain: [number, number];
  yDomain: [number, number];
  goalValue?: number;
  /** 目標日が X 軸の範囲内にあるときだけ入る */
  targetTime?: number;
  ticks: number[];
};

export const PERIOD_DAYS: Record<Exclude<PeriodKey, 'all'>, number> = {
  '7': 7,
  '30': 30,
  '90': 90,
};

const niceStep = (span: number) => {
  if (span <= 3) return 0.5;
  if (span <= 8) return 1;
  if (span <= 20) return 2;
  if (span <= 50) return 5;
  return 10;
};

export function computeYDomain(values: number[], minSpan: number): [number, number] {
  if (values.length === 0) return [0, minSpan];
  let min = Math.min(...values);
  let max = Math.max(...values);
  const span = max - min;
  if (span < minSpan) {
    const mid = (min + max) / 2;
    min = mid - minSpan / 2;
    max = mid + minSpan / 2;
  } else {
    const pad = span * 0.12;
    min -= pad;
    max += pad;
  }
  const step = niceStep(max - min);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  return [Math.max(0, round1(lo)), round1(hi)];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function buildTicks(start: number, end: number, count: number): number[] {
  if (end <= start) return [start];
  const DAY = 24 * 60 * 60 * 1000;
  const totalDays = Math.round((end - start) / DAY);
  const stepDays = Math.max(1, Math.ceil(totalDays / (count - 1)));
  const ticks: number[] = [];
  for (let t = start; t <= end; t += stepDays * DAY) ticks.push(t);
  return ticks;
}

export function buildChartModel(
  records: BodyRecord[],
  goal: GoalSettings | null,
  metric: MetricKey,
  period: PeriodKey,
  today: string,
): ChartModel {
  const all: ChartPoint[] = records
    .filter((r) => r[metric] !== undefined)
    .map((r) => ({ time: dateToTime(r.date), date: r.date, value: r[metric] as number }));

  const target = goalValue(goal, metric);
  const lastDate = records.length > 0 ? records[records.length - 1].date : today;
  const endDate = lastDate > today ? lastDate : today;

  let startDate: string;
  let domainEndDate = endDate;
  if (period === 'all') {
    const firstDate = all.length > 0 ? all[0].date : endDate;
    const candidates = [firstDate];
    if (goal) candidates.push(goal.startDate);
    startDate = candidates.sort()[0];
    // 全期間では目標日まで表示して、ゴールまでの距離感を見せる
    if (goal && goal.targetDate > domainEndDate) domainEndDate = goal.targetDate;
    // 範囲が短すぎると点が端に寄るので最低7日分は確保
    if (diffDays(startDate, domainEndDate) < 6) startDate = addDays(domainEndDate, -6);
  } else {
    startDate = addDays(endDate, -(PERIOD_DAYS[period] - 1));
  }

  const xDomain: [number, number] = [dateToTime(startDate), dateToTime(domainEndDate)];
  const points = all.filter((p) => p.time >= xDomain[0] && p.time <= xDomain[1]);

  const yValues = points.map((p) => p.value);
  if (target !== undefined) yValues.push(target);
  const yDomain = computeYDomain(yValues, METRICS[metric].minSpan);

  const model: ChartModel = {
    points,
    xDomain,
    yDomain,
    ticks: buildTicks(xDomain[0], xDomain[1], period === '7' ? 7 : 5),
  };
  if (target !== undefined) model.goalValue = target;
  if (goal) {
    const t = dateToTime(goal.targetDate);
    if (t >= xDomain[0] && t <= xDomain[1]) model.targetTime = t;
  }
  return model;
}

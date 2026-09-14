import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BodyRecord, GoalSettings, MetricKey, PeriodKey } from '../types';
import { METRICS, METRIC_ORDER, formatNumber } from '../lib/metrics';
import { buildChartModel, type ChartPoint } from '../lib/stats';
import { diffDays, formatMonthDay, formatShort } from '../lib/date';

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: '7', label: '7日' },
  { key: '30', label: '30日' },
  { key: '90', label: '90日' },
  { key: 'all', label: '全期間' },
];

export const METRIC_COLORS: Record<MetricKey, string> = {
  weight: '#0f8f86',
  bodyFat: '#2a9d8f',
  skeletalMuscle: '#2f6fd6',
};

type Props = {
  records: BodyRecord[];
  goal: GoalSettings | null;
  today: string;
  onRecord: () => void;
};

export function TrendChart({ records, goal, today, onRecord }: Props) {
  const [metric, setMetric] = useState<MetricKey>('weight');
  const [period, setPeriod] = useState<PeriodKey>('30');
  const def = METRICS[metric];
  const color = METRIC_COLORS[metric];

  const model = useMemo(
    () => buildChartModel(records, goal, metric, period, today),
    [records, goal, metric, period, today],
  );
  const hasAnyForMetric = records.some((r) => r[metric] !== undefined);

  let empty: React.ReactNode = null;
  if (records.length === 0) {
    empty = (
      <>
        <p>まだ記録がありません</p>
        <button type="button" className="btn btn-primary btn-small" onClick={onRecord}>
          最初の記録をする
        </button>
      </>
    );
  } else if (!hasAnyForMetric) {
    empty = <p>{def.label}の記録はまだありません。記録画面で入力できます（任意）</p>;
  } else if (model.points.length === 0) {
    empty = (
      <>
        <p>この期間の{def.label}の記録はありません</p>
        <button type="button" className="btn btn-secondary btn-small" onClick={() => setPeriod('all')}>
          全期間を表示
        </button>
      </>
    );
  }

  return (
    <section className="card chart-card" aria-label="推移グラフ">
      <div className="segmented" role="group" aria-label="表示する項目">
        {METRIC_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={metric === key}
            className={metric === key ? 'is-active' : ''}
            onClick={() => setMetric(key)}
          >
            {METRICS[key].label}
          </button>
        ))}
      </div>

      <div className="chart-area">
        {empty ? (
          <div className="chart-empty">{empty}</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={model.points} margin={{ top: 20, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid vertical={false} stroke="#edf2f2" />
              <XAxis
                dataKey="time"
                type="number"
                domain={model.xDomain}
                ticks={model.ticks}
                tickFormatter={(t: number) => formatMonthDay(t)}
                tick={{ fontSize: 12, fill: '#6b7c7b' }}
                tickLine={false}
                axisLine={{ stroke: '#dfe7e6' }}
                allowDataOverflow
                padding={{ left: 16, right: 16 }}
                interval="preserveStartEnd"
                minTickGap={8}
              />
              <YAxis
                domain={model.yDomain}
                width={42}
                tick={{ fontSize: 12, fill: '#6b7c7b' }}
                tickLine={false}
                axisLine={false}
                tickCount={5}
                allowDecimals
                allowDataOverflow
                tickFormatter={(v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))}
              />
              {model.goalValue !== undefined && (
                <ReferenceLine
                  y={model.goalValue}
                  stroke={color}
                  strokeDasharray="6 4"
                  strokeOpacity={0.7}
                  label={{
                    value: `目標 ${model.goalValue.toFixed(1)}`,
                    position: 'insideTopRight',
                    fill: color,
                    fontSize: 12,
                  }}
                />
              )}
              {model.targetTime !== undefined && (
                <ReferenceLine
                  x={model.targetTime}
                  stroke="#8a9a99"
                  strokeDasharray="3 3"
                  label={{ value: '目標日', position: 'insideTopLeft', fill: '#5f706f', fontSize: 12 }}
                />
              )}
              <Tooltip
                // スマートフォンでは「タップ」で確実に表示されるようにクリックで出す
                trigger="click"
                cursor={{ stroke: '#c9d6d5', strokeWidth: 1 }}
                isAnimationActive={false}
                content={({ active, payload }) => {
                  const point = active && payload && payload[0] ? (payload[0].payload as ChartPoint) : null;
                  if (!point) return null;
                  return (
                    <div className="chart-tooltip">
                      <div className="chart-tooltip-date">{formatShort(point.date)}</div>
                      <div className="chart-tooltip-value" style={{ color }}>
                        {point.value.toFixed(1)}
                        <small>{def.unit}</small>
                      </div>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2.5}
                dot={model.points.length <= 45 ? { r: 3.5, fill: '#fff', strokeWidth: 2 } : false}
                activeDot={{ r: 6, fill: color, stroke: '#fff', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="segmented segmented-small" role="group" aria-label="表示期間">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={period === p.key}
            className={period === p.key ? 'is-active' : ''}
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <ul className="chart-legend">
        <li>
          <span className="legend-dash" style={{ borderColor: color }} aria-hidden />
          {model.goalValue !== undefined
            ? `目標${def.label} ${formatNumber(model.goalValue)}${def.unit}`
            : `目標${def.label}は未設定`}
        </li>
        {goal && (
          <li>
            <span className="legend-dash legend-dash-vertical" aria-hidden />
            目標日 {formatShort(goal.targetDate)}
            {model.targetTime === undefined && diffDays(today, goal.targetDate) > 0 && '（全期間で表示）'}
          </li>
        )}
      </ul>
      {model.points.length === 1 && !empty && (
        <p className="chart-note">記録が2件以上になると推移の線が表示されます</p>
      )}
      {!empty && <p className="chart-note">グラフの点をタップすると日付と数値を確認できます</p>}
    </section>
  );
}

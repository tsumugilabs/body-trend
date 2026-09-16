import type { BodyRecord, GoalSettings, MetricKey } from '../types';
import { formatLong, formatShort } from '../lib/date';
import { METRICS, changeTone, formatNumber, formatSigned } from '../lib/metrics';
import { metricChange, summarize, type LatestValue } from '../lib/stats';
import { TrendChart } from './TrendChart';

type Props = {
  records: BodyRecord[];
  goal: GoalSettings | null;
  today: string;
  onRecord: () => void;
  /** バックアップを促すか */
  backupDue?: boolean;
  lastBackupAt?: string;
  onOpenBackup?: () => void;
};

function daysLeftText(daysLeft: number | undefined) {
  if (daysLeft === undefined) return null;
  if (daysLeft > 0)
    return (
      <>
        目標日まで あと <strong>{daysLeft}</strong> 日
      </>
    );
  if (daysLeft === 0) return <>今日が目標日です</>;
  return <>目標日から {-daysLeft} 日経過</>;
}

export function Dashboard({
  records,
  goal,
  today,
  onRecord,
  backupDue,
  lastBackupAt,
  onOpenBackup,
}: Props) {
  const s = summarize(records, goal, today);
  const recordedToday = s.latest?.date === today;

  return (
    <div className="screen">
      <header className="dash-header">
        <p className="dash-date">{formatLong(today)}</p>
        {goal && <p className="days-left">{daysLeftText(s.daysLeft)}</p>}
      </header>

      <section className="card hero" aria-label="現在の体重">
        <div className="hero-top">
          <span className="stat-label">現在の体重</span>
          {s.latest && (
            <span className="stat-date">{recordedToday ? '今日' : formatShort(s.latest.date)}</span>
          )}
        </div>
        <p className="hero-value">
          {formatNumber(s.latest?.weight)}
          <span className="unit">kg</span>
        </p>
        <div className="hero-sub">
          <div>
            <span className="sub-label">開始から</span>
            <span
              className={`sub-value tone-${s.weightChange !== undefined ? changeTone('weight', s.weightChange) : 'neutral'}`}
            >
              {s.weightChange !== undefined ? `${formatSigned(s.weightChange)} kg` : '—'}
            </span>
          </div>
          <div>
            <span className="sub-label">目標まで</span>
            <span className="sub-value">
              {s.weightToGoal === undefined ? (
                '—'
              ) : s.weightToGoal <= 0 ? (
                <span className="tone-good">目標達成</span>
              ) : (
                `あと ${s.weightToGoal.toFixed(1)} kg`
              )}
            </span>
          </div>
        </div>
        {!recordedToday && (
          <button type="button" className="btn btn-primary btn-block hero-cta" onClick={onRecord}>
            今日の記録をする
          </button>
        )}
      </section>

      <div className="stat-grid">
        <MiniStat metric="bodyFat" latest={s.latestBodyFat} records={records} goal={goal} />
        <MiniStat metric="skeletalMuscle" latest={s.latestSkeletalMuscle} records={records} goal={goal} />
        <MiniStat metric="waist" latest={s.latestWaist} records={records} goal={goal} />
      </div>

      <TrendChart records={records} goal={goal} today={today} onRecord={onRecord} />

      {backupDue && onOpenBackup && (
        <section className="card notice" aria-label="バックアップのお知らせ">
          <p>
            {lastBackupAt
              ? '前回のバックアップから30日以上たちました。'
              : '記録のバックアップがまだありません。'}
            機種変更やデータ消去に備えて保存しておくと安心です。
          </p>
          <button type="button" className="btn btn-secondary btn-small" onClick={onOpenBackup}>
            バックアップへ
          </button>
        </section>
      )}
    </div>
  );
}

function MiniStat({
  metric,
  latest,
  records,
  goal,
}: {
  metric: MetricKey;
  latest: LatestValue;
  records: BodyRecord[];
  goal: GoalSettings | null;
}) {
  const def = METRICS[metric];
  const change = metricChange(records, metric, goal?.startDate);
  const lastRecordDate = records[records.length - 1]?.date;
  return (
    <section className="card mini-stat" aria-label={`現在の${def.label}`}>
      <span className="stat-label">{def.label}</span>
      <p className="mini-value">
        {formatNumber(latest?.value)}
        <span className="unit">{def.unit}</span>
      </p>
      <p className="mini-sub">
        {change !== undefined ? (
          <>
            開始から{' '}
            <span className={`tone-${changeTone(metric, change)}${metric === 'skeletalMuscle' ? '-blue' : ''}`}>
              {formatSigned(change)}
              {def.diffUnit}
            </span>
          </>
        ) : (
          <span className="muted">{latest ? '変化は2件目から' : '未記録'}</span>
        )}
      </p>
      {latest && latest.date !== lastRecordDate && (
        <p className="mini-date">{formatShort(latest.date)}時点</p>
      )}
    </section>
  );
}

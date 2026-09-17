import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { BodyRecord, Exercise, GoalSettings, TrainingRecord } from '../types';
import {
  backupFileName,
  createBackup,
  exercisesLostByRestore,
  parseBackup,
  recordsLostByRestore,
  trainingsLostByRestore,
  type BackupData,
} from '../lib/backup';
import { formatDateTime, formatShort } from '../lib/date';
import { readTextFile, saveTextFile } from '../lib/fileSave';
import {
  getProtectionStatus,
  requestPersistence,
  type ProtectionStatus,
} from '../lib/storageProtection';
import { useConfirm } from '../components/ConfirmDialog';
import type { Notify } from '../components/Toast';

type RestoreProps = {
  records: BodyRecord[];
  goal: GoalSettings | null;
  trainings: TrainingRecord[];
  exercises: Exercise[];
  notify: Notify;
  onRestore: (data: BackupData) => void;
  label?: string;
  className?: string;
};

/** バックアップファイルを選んで、確認のうえ復元するボタン */
export function RestoreButton({
  records,
  goal,
  trainings,
  exercises,
  notify,
  onRestore,
  label = 'バックアップから復元',
  className = 'btn btn-secondary btn-block',
}: RestoreProps) {
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    let text: string;
    try {
      text = await readTextFile(file);
    } catch {
      notify('ファイルを読み込めませんでした', { tone: 'error' });
      return;
    }
    const result = parseBackup(text);
    if (!result.ok) {
      notify(result.error, { tone: 'error' });
      return;
    }

    const data = result.data;
    const hasCurrent = records.length > 0 || trainings.length > 0 || exercises.length > 0;
    // 件数ではなく、置き換えで実際に消えるもの（バックアップに同じ日付・id がないもの）で判断する
    const lost = recordsLostByRestore(records, data.records);
    const lostTrainings = trainingsLostByRestore(trainings, data.trainings);
    const lostExercises = exercisesLostByRestore(exercises, data.exercises);
    const lostRange =
      lost.length === 0
        ? ''
        : lost.length === 1
          ? formatShort(lost[0].date)
          : `${formatShort(lost[0].date)}〜${formatShort(lost[lost.length - 1].date)}`;
    const ok = await confirm({
      title: 'バックアップから復元しますか？',
      message: (
        <>
          <dl className="compare">
            <dt>バックアップ</dt>
            <dd>
              {data.exportedAt ? `${formatDateTime(data.exportedAt)} 作成` : '作成日時不明'} ・ 記録 {data.records.length}件
            </dd>
            {hasCurrent && (
              <>
                <dt>現在の記録（置き換えられます）</dt>
                <dd>
                  記録 {records.length}件 ・ トレーニング {trainings.length}件 ・ マイメニュー {exercises.length}件
                </dd>
              </>
            )}
            <dt>目標</dt>
            <dd>{data.goal ? 'バックアップの目標にする' : goal ? '現在の目標をそのまま使う' : '未設定'}</dd>
          </dl>
          {lost.length > 0 && (
            <p className="dialog-warning">
              現在の記録のうち {lost.length}件（{lostRange}）はバックアップに含まれないため消えます。
            </p>
          )}
          {lostTrainings.length > 0 && (
            <p className="dialog-warning">
              現在のトレーニング記録のうち {lostTrainings.length}件 はバックアップに含まれないため消えます。
            </p>
          )}
          {lostExercises.length > 0 && (
            <p className="dialog-warning">
              マイメニューの {lostExercises.length}件（{lostExercises.map((e) => e.name).join('・')}）はバックアップに含まれないため消えます。
            </p>
          )}
          {data.skipped > 0 && <p>読み込めない記録 {data.skipped}件 は除外されます。</p>}
          {data.skippedTrainings > 0 && (
            <p>読み込めないトレーニング関連のデータ {data.skippedTrainings}件 は除外されます。</p>
          )}
        </>
      ),
      confirmLabel: '復元する',
      danger: hasCurrent,
      requireText:
        lost.length > 0 || lostTrainings.length > 0 || lostExercises.length > 0 ? '復元' : undefined,
    });
    if (ok) onRestore(data);
  };

  return (
    <>
      <button type="button" className={className} onClick={() => inputRef.current?.click()}>
        {label}
      </button>
      {/* iPhone では accept を指定すると .json を選べない場合があるため指定しない（中身で検証する） */}
      <input
        ref={inputRef}
        type="file"
        className="visually-hidden"
        aria-label="バックアップファイルを選択"
        tabIndex={-1}
        onChange={handleFile}
      />
    </>
  );
}

type Props = {
  records: BodyRecord[];
  goal: GoalSettings | null;
  trainings: TrainingRecord[];
  exercises: Exercise[];
  today: string;
  lastBackupAt?: string;
  notify: Notify;
  onBackedUp: (iso: string) => void;
  onRestore: (data: BackupData) => void;
};

const INSTALL_HINT: Record<ProtectionStatus['platform'], string> = {
  ios: 'Safari の共有ボタンから「ホーム画面に追加」して、そのアイコンから開いてください。Safari のタブで使っていると、しばらく開かなかったときに記録が消える場合があります。',
  android:
    'Chrome のメニューから「アプリをインストール」（または「ホーム画面に追加」）して、そのアイコンから開くと記録が消えにくくなります。',
  other: 'ブラウザのメニューからアプリとしてインストールすると、記録が消えにくくなります。',
};

export function DataProtection({
  records,
  goal,
  trainings,
  exercises,
  today,
  lastBackupAt,
  notify,
  onBackedUp,
  onRestore,
}: Props) {
  const [status, setStatus] = useState<ProtectionStatus | null>(null);

  useEffect(() => {
    let alive = true;
    void getProtectionStatus().then((s) => {
      if (alive) setStatus(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  const handleBackup = async () => {
    if (records.length === 0 && trainings.length === 0 && !goal) {
      notify('保存するデータがありません');
      return;
    }
    const outcome = await saveTextFile(
      createBackup({ records, goal, trainings, exercises }),
      backupFileName(today),
    );
    if (outcome === 'cancelled') return;
    onBackedUp(new Date().toISOString());
    notify(
      outcome === 'shared'
        ? 'バックアップを書き出しました。「ファイルに保存」などで保管してください'
        : 'バックアップファイルを保存しました',
    );
  };

  const handlePersist = async () => {
    const ok = await requestPersistence();
    setStatus(await getProtectionStatus());
    notify(
      ok
        ? '保存データの保護を有効にしました'
        : 'ブラウザが保護を許可しませんでした。ホーム画面に追加してから再度お試しください',
      { tone: ok ? 'info' : 'error' },
    );
  };

  return (
    <div className="card settings-data">
      <ul className="protect-list">
        <li>
          <span>保存データの保護</span>
          <strong className={status?.persisted ? 'status-ok' : 'status-warn'}>
            {status === null ? '確認中' : status.persisted ? '有効' : status.supported ? '未許可' : '非対応'}
          </strong>
        </li>
        <li>
          <span>起動方法</span>
          <strong className={status?.standalone ? 'status-ok' : 'status-warn'}>
            {status === null ? '確認中' : status.standalone ? 'ホーム画面のアプリ' : 'ブラウザ'}
          </strong>
        </li>
        <li>
          <span>最終バックアップ</span>
          <strong className={lastBackupAt ? '' : 'status-warn'}>
            {lastBackupAt ? formatDateTime(lastBackupAt) : 'まだありません'}
          </strong>
        </li>
      </ul>

      {status && !status.standalone && <p className="hint-box">{INSTALL_HINT[status.platform]}</p>}
      {status?.supported && !status.persisted && (
        <button type="button" className="btn btn-secondary btn-block" onClick={handlePersist}>
          保存データの保護を有効にする
        </button>
      )}

      <p className="muted">
        記録はこの端末の中にだけ保存されます（記録 {records.length}件・トレーニング {trainings.length}件）。機種変更やブラウザのデータ消去に備えて、ときどきバックアップファイルを保存してください。
      </p>
      <button type="button" className="btn btn-primary btn-block" onClick={handleBackup}>
        バックアップを保存
      </button>
      <RestoreButton
        records={records}
        goal={goal}
        trainings={trainings}
        exercises={exercises}
        notify={notify}
        onRestore={onRestore}
      />
    </div>
  );
}

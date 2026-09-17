import type { BodyRecord, Exercise, GoalSettings, TrainingRecord } from '../types';
import type { BackupData } from '../lib/backup';
import { formatDateTime } from '../lib/date';
import { useConfirm } from '../components/ConfirmDialog';
import type { Notify } from '../components/Toast';
import { GoalForm } from './GoalForm';
import { DataProtection } from './DataProtection';

type Props = {
  goal: GoalSettings | null;
  records: BodyRecord[];
  trainings: TrainingRecord[];
  exercises: Exercise[];
  today: string;
  lastBackupAt?: string;
  notify: Notify;
  onSaveGoal: (goal: GoalSettings) => void;
  onBackedUp: (iso: string) => void;
  onRestore: (data: BackupData) => void;
  onClearAll: () => void;
  onLoadSample?: () => void;
};

export function Settings({
  goal,
  records,
  trainings,
  exercises,
  today,
  lastBackupAt,
  notify,
  onSaveGoal,
  onBackedUp,
  onRestore,
  onClearAll,
  onLoadSample,
}: Props) {
  const confirm = useConfirm();

  const handleClear = async () => {
    const ok = await confirm({
      title: 'すべてのデータを削除しますか？',
      message: (
        <>
          <p>
            記録 {records.length}件、トレーニング {trainings.length}件、マイメニュー {exercises.length}件 と目標設定を、この端末から削除します。
          </p>
          <p className="dialog-warning">
            {lastBackupAt
              ? `最終バックアップは ${formatDateTime(lastBackupAt)} です。`
              : 'バックアップがまだ保存されていません。'}
            削除する前に「バックアップを保存」しておくことをおすすめします。
          </p>
        </>
      ),
      confirmLabel: '削除する',
      danger: true,
      requireText: '削除',
    });
    if (ok) onClearAll();
  };

  const handleSample = async () => {
    if (!onLoadSample) return;
    const ok = await confirm({
      title: 'サンプルデータを読み込みますか？',
      message: <p>現在の記録と目標は置き換えられます（開発用の機能です）。</p>,
      confirmLabel: '読み込む',
      danger: true,
    });
    if (ok) onLoadSample();
  };

  return (
    <div className="screen">
      <h1 className="screen-title">目標設定</h1>
      {/* key で目標が外部から変わったときにフォームを初期化する */}
      <GoalForm
        key={goal ? JSON.stringify(goal) : 'empty'}
        initial={goal}
        today={today}
        submitLabel="目標を保存する"
        onSubmit={onSaveGoal}
      />

      <h2 className="section-title">データの保護</h2>
      <DataProtection
        records={records}
        goal={goal}
        trainings={trainings}
        exercises={exercises}
        today={today}
        lastBackupAt={lastBackupAt}
        notify={notify}
        onBackedUp={onBackedUp}
        onRestore={onRestore}
      />

      <h2 className="section-title">データの削除</h2>
      <div className="card settings-data">
        <p className="muted">削除した記録は、直後に表示される「元に戻す」以外では取り戻せません。</p>
        {onLoadSample && (
          <button type="button" className="btn btn-secondary btn-block" onClick={handleSample}>
            サンプルデータを読み込む（開発用）
          </button>
        )}
        <button type="button" className="btn btn-danger-outline btn-block" onClick={handleClear}>
          すべてのデータを削除
        </button>
      </div>
    </div>
  );
}

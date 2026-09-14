import type { BodyRecord, GoalSettings } from '../types';
import { useConfirm } from '../components/ConfirmDialog';
import { GoalForm } from './GoalForm';

type Props = {
  goal: GoalSettings | null;
  records: BodyRecord[];
  today: string;
  onSaveGoal: (goal: GoalSettings) => void;
  onClearAll: () => void;
  onLoadSample?: () => void;
};

export function Settings({ goal, records, today, onSaveGoal, onClearAll, onLoadSample }: Props) {
  const confirm = useConfirm();

  const handleClear = async () => {
    const ok = await confirm({
      title: 'すべてのデータを削除しますか？',
      message: <p>{records.length}件の記録と目標設定を削除します。この操作は元に戻せません。</p>,
      confirmLabel: '削除する',
      danger: true,
    });
    if (ok) onClearAll();
  };

  const handleSample = async () => {
    if (!onLoadSample) return;
    const ok = await confirm({
      title: 'サンプルデータを読み込みますか？',
      message: <p>現在の記録と目標は置き換えられます（開発用の機能です）。</p>,
      confirmLabel: '読み込む',
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

      <h2 className="section-title">データ</h2>
      <div className="card settings-data">
        <p className="muted">
          記録はこの端末のブラウザ内にだけ保存されます（{records.length}件）。ブラウザのデータを消去すると記録も消えます。
        </p>
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

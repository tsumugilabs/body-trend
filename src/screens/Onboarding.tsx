import type { GoalSettings } from '../types';
import { GoalForm } from './GoalForm';

type Props = {
  today: string;
  onSubmit: (goal: GoalSettings) => void;
  onLoadSample?: () => void;
};

export function Onboarding({ today, onSubmit, onLoadSample }: Props) {
  return (
    <div className="screen onboarding">
      <header className="onboarding-header">
        <img src="./icon.svg" alt="" width={56} height={56} />
        <h1>からだ記録へようこそ</h1>
        <p>まずは目標を決めましょう。あとから設定画面で変更できます。</p>
      </header>
      <GoalForm initial={null} today={today} submitLabel="この目標ではじめる" onSubmit={onSubmit} />
      {onLoadSample && (
        <button type="button" className="btn btn-link" onClick={onLoadSample}>
          サンプルデータで試す（開発用）
        </button>
      )}
    </div>
  );
}

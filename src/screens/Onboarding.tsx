import type { BodyRecord, GoalSettings } from '../types';
import type { BackupData } from '../lib/backup';
import type { Notify } from '../components/Toast';
import { GoalForm } from './GoalForm';
import { RestoreButton } from './DataProtection';

type Props = {
  today: string;
  records: BodyRecord[];
  notify: Notify;
  onSubmit: (goal: GoalSettings) => void;
  onRestore: (data: BackupData) => void;
  onLoadSample?: () => void;
};

export function Onboarding({ today, records, notify, onSubmit, onRestore, onLoadSample }: Props) {
  return (
    <div className="screen onboarding">
      <header className="onboarding-header">
        <img src="./icon.svg" alt="" width={56} height={56} />
        <h1>からだ記録へようこそ</h1>
        <p>まずは目標を決めましょう。あとから設定画面で変更できます。</p>
      </header>
      <GoalForm initial={null} today={today} submitLabel="この目標ではじめる" onSubmit={onSubmit} />
      <div className="onboarding-restore">
        <p className="muted">以前のバックアップファイルがある場合</p>
        <RestoreButton
          records={records}
          goal={null}
          notify={notify}
          onRestore={onRestore}
          label="バックアップから復元する"
        />
      </div>
      {onLoadSample && (
        <button type="button" className="btn btn-link" onClick={onLoadSample}>
          サンプルデータで試す（開発用）
        </button>
      )}
    </div>
  );
}

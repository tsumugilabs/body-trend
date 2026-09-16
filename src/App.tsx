import { useCallback, useEffect, useState } from 'react';
import type { BodyRecord, GoalSettings, TabKey } from './types';
import { useAppData } from './hooks/useAppData';
import { useToday } from './hooks/useToday';
import { createSampleData } from './lib/sampleData';
import { isBackupDue, type BackupData } from './lib/backup';
import { formatShort } from './lib/date';
import { requestPersistence } from './lib/storageProtection';
import { ConfirmProvider } from './components/ConfirmDialog';
import { BottomNav } from './components/BottomNav';
import { Toast, type Notify, type ToastAction, type ToastMessage } from './components/Toast';
import { Dashboard } from './screens/Dashboard';
import { RecordForm } from './screens/RecordForm';
import { History } from './screens/History';
import { Settings } from './screens/Settings';
import { Onboarding } from './screens/Onboarding';

type AppProps = {
  /** サンプルデータ機能を出すか（既定: 開発サーバーのときだけ） */
  enableSample?: boolean;
};

export default function App({ enableSample = import.meta.env.DEV }: AppProps) {
  return (
    <ConfirmProvider>
      <AppInner enableSample={enableSample} />
    </ConfirmProvider>
  );
}

const SAVE_FAILED = '端末への保存に失敗しました。ブラウザの設定や空き容量を確認してください';

function AppInner({ enableSample }: { enableSample: boolean }) {
  const data = useAppData();
  const today = useToday();
  const [tab, setTab] = useState<TabKey>('home');
  const [editing, setEditing] = useState<BodyRecord | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [showLoadProblem, setShowLoadProblem] = useState(data.loadProblem);

  const notify = useCallback<Notify>((text, options) => {
    setToast({ id: Date.now(), text, tone: options?.tone, action: options?.action });
  }, []);
  const clearToast = useCallback(() => setToast(null), []);

  // データができたら、ブラウザに保存データを自動削除しないよう依頼する
  const hasData = data.records.length > 0 || data.goal !== null;
  useEffect(() => {
    if (hasData) void requestPersistence();
  }, [hasData]);

  const navigate = (next: TabKey) => {
    setTab(next);
    if (next !== 'record') setEditing(null);
    setFormKey((k) => k + 1);
    window.scrollTo({ top: 0 });
  };

  /** 全体を置き換える操作を取り消すための「元に戻す」 */
  const undoReplace = (prevRecords: BodyRecord[], prevGoal: GoalSettings | null): ToastAction => ({
    label: '元に戻す',
    onClick: () => {
      const ok = data.replaceAll(prevRecords, prevGoal);
      notify(ok ? '元に戻しました' : SAVE_FAILED, { tone: ok ? 'info' : 'error' });
    },
  });

  const handleSaveRecord = (record: BodyRecord, mode: 'created' | 'updated') => {
    const ok = data.saveRecord(record);
    const wasEditing = editing !== null;
    navigate(wasEditing ? 'history' : 'home');
    if (!ok) notify(SAVE_FAILED, { tone: 'error' });
    else notify(mode === 'updated' ? '記録を更新しました' : '記録しました');
  };

  const handleDeleteRecord = (record: BodyRecord) => {
    const ok = data.deleteRecord(record.id);
    if (!ok) {
      notify(SAVE_FAILED, { tone: 'error' });
      return;
    }
    notify(`${formatShort(record.date)}の記録を削除しました`, {
      action: {
        label: '元に戻す',
        onClick: () => {
          const restored = data.saveRecord(record);
          notify(restored ? '削除を取り消しました' : SAVE_FAILED, { tone: restored ? 'info' : 'error' });
        },
      },
    });
  };

  const handleSaveGoal = (goal: GoalSettings, fromOnboarding = false) => {
    const ok = data.updateGoal(goal);
    if (!ok) notify(SAVE_FAILED, { tone: 'error' });
    else notify(fromOnboarding ? '目標を設定しました' : '目標を保存しました');
    if (fromOnboarding) navigate('home');
  };

  const handleRestore = (backup: BackupData) => {
    const prevRecords = data.records;
    const prevGoal = data.goal;
    const ok = data.replaceAll(backup.records, backup.goal ?? prevGoal);
    navigate('home');
    if (!ok) notify(SAVE_FAILED, { tone: 'error' });
    else
      notify(`バックアップから復元しました（${backup.records.length}件）`, {
        action: prevRecords.length > 0 || prevGoal ? undoReplace(prevRecords, prevGoal) : undefined,
      });
  };

  const handleClearAll = () => {
    const prevRecords = data.records;
    const prevGoal = data.goal;
    const ok = data.replaceAll([], null);
    navigate('home');
    if (!ok) notify(SAVE_FAILED, { tone: 'error' });
    else notify('すべてのデータを削除しました', { action: undoReplace(prevRecords, prevGoal) });
  };

  const loadSample = enableSample
    ? () => {
        const prevRecords = data.records;
        const prevGoal = data.goal;
        const sample = createSampleData(today);
        data.replaceAll(sample.records, sample.goal);
        navigate('home');
        notify('サンプルデータを読み込みました', {
          action: prevRecords.length > 0 ? undoReplace(prevRecords, prevGoal) : undefined,
        });
      }
    : undefined;

  const loadBanner = showLoadProblem && (
    <div className="banner" role="alert">
      <p>保存データの一部を読み込めませんでした。読み込めた記録だけを表示しています（元のデータは端末内に退避しています）。</p>
      <button type="button" className="btn btn-link" onClick={() => setShowLoadProblem(false)}>
        閉じる
      </button>
    </div>
  );

  if (!data.goal) {
    return (
      <div className="app">
        <main className="main main-no-nav">
          {loadBanner}
          <Onboarding
            today={today}
            records={data.records}
            notify={notify}
            onSubmit={(g) => handleSaveGoal(g, true)}
            onRestore={handleRestore}
            onLoadSample={loadSample}
          />
        </main>
        <Toast toast={toast} onDone={clearToast} />
      </div>
    );
  }

  return (
    <div className="app">
      <main className="main">
        {loadBanner}
        {tab === 'home' && (
          <Dashboard
            records={data.records}
            goal={data.goal}
            today={today}
            onRecord={() => navigate('record')}
            backupDue={isBackupDue(data.records.length, data.lastBackupAt, Date.now())}
            lastBackupAt={data.lastBackupAt}
            onOpenBackup={() => navigate('settings')}
          />
        )}
        {tab === 'record' && (
          <RecordForm
            key={editing ? `edit-${editing.id}` : `new-${formKey}`}
            records={data.records}
            today={today}
            editing={editing}
            onSave={handleSaveRecord}
            onCancel={() => navigate('history')}
          />
        )}
        {tab === 'history' && (
          <History
            records={data.records}
            today={today}
            onEdit={(r) => {
              setEditing(r);
              setTab('record');
              window.scrollTo({ top: 0 });
            }}
            onDelete={handleDeleteRecord}
            onRecord={() => navigate('record')}
          />
        )}
        {tab === 'settings' && (
          <Settings
            goal={data.goal}
            records={data.records}
            today={today}
            lastBackupAt={data.lastBackupAt}
            notify={notify}
            onSaveGoal={(g) => handleSaveGoal(g)}
            onBackedUp={data.markBackedUp}
            onRestore={handleRestore}
            onClearAll={handleClearAll}
            onLoadSample={loadSample}
          />
        )}
      </main>
      <Toast toast={toast} onDone={clearToast} />
      <BottomNav current={tab} onChange={navigate} />
    </div>
  );
}

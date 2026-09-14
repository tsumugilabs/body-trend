import { useCallback, useState } from 'react';
import type { BodyRecord, GoalSettings, TabKey } from './types';
import { useAppData } from './hooks/useAppData';
import { useToday } from './hooks/useToday';
import { createSampleData } from './lib/sampleData';
import { ConfirmProvider } from './components/ConfirmDialog';
import { BottomNav } from './components/BottomNav';
import { Toast, type ToastMessage } from './components/Toast';
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

  const notify = useCallback((text: string, tone: ToastMessage['tone'] = 'info') => {
    setToast({ id: Date.now(), text, tone });
  }, []);
  const clearToast = useCallback(() => setToast(null), []);

  const navigate = (next: TabKey) => {
    setTab(next);
    if (next !== 'record') setEditing(null);
    setFormKey((k) => k + 1);
    window.scrollTo({ top: 0 });
  };

  const handleSaveRecord = (record: BodyRecord, mode: 'created' | 'updated') => {
    const ok = data.saveRecord(record);
    const wasEditing = editing !== null;
    navigate(wasEditing ? 'history' : 'home');
    if (!ok) notify(SAVE_FAILED, 'error');
    else notify(mode === 'updated' ? '記録を更新しました' : '記録しました');
  };

  const handleSaveGoal = (goal: GoalSettings, fromOnboarding = false) => {
    const ok = data.updateGoal(goal);
    if (!ok) notify(SAVE_FAILED, 'error');
    else notify(fromOnboarding ? '目標を設定しました' : '目標を保存しました');
    if (fromOnboarding) navigate('home');
  };

  const loadSample = enableSample
    ? () => {
        const sample = createSampleData(today);
        data.replaceAll(sample.records, sample.goal);
        navigate('home');
        notify('サンプルデータを読み込みました');
      }
    : undefined;

  const loadBanner = showLoadProblem && (
    <div className="banner" role="alert">
      <p>保存データの一部を読み込めませんでした。読み込めた記録だけを表示しています。</p>
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
          <Onboarding today={today} onSubmit={(g) => handleSaveGoal(g, true)} onLoadSample={loadSample} />
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
          <Dashboard records={data.records} goal={data.goal} today={today} onRecord={() => navigate('record')} />
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
            onDelete={(r) => {
              const ok = data.deleteRecord(r.id);
              notify(ok ? '削除しました' : SAVE_FAILED, ok ? 'info' : 'error');
            }}
            onRecord={() => navigate('record')}
          />
        )}
        {tab === 'settings' && (
          <Settings
            goal={data.goal}
            records={data.records}
            today={today}
            onSaveGoal={(g) => handleSaveGoal(g)}
            onClearAll={() => {
              data.replaceAll([], null);
              navigate('home');
              notify('すべてのデータを削除しました');
            }}
            onLoadSample={loadSample}
          />
        )}
      </main>
      <Toast toast={toast} onDone={clearToast} />
      <BottomNav current={tab} onChange={navigate} />
    </div>
  );
}

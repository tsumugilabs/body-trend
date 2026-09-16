import { useCallback, useEffect, useState } from 'react';
import type { BodyRecord, Exercise, TrainingRecord, GoalSettings, TabKey } from './types';
import { useAppData, type AppContents, type DataSnapshot } from './hooks/useAppData';
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
import { Training } from './screens/Training';
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
  const [trainingKey, setTrainingKey] = useState(0);
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
    if (next === 'training') setTrainingKey((k) => k + 1);
    setFormKey((k) => k + 1);
    window.scrollTo({ top: 0 });
  };

  /** 全体を置き換える操作を取り消すための「元に戻す」 */
  const undoReplace = (before: DataSnapshot, applied: DataSnapshot): ToastAction => ({
    label: '元に戻す',
    onClick: () => {
      const { ok, kept } = data.undoReplaceAll(before, applied);
      if (!ok) {
        notify(SAVE_FAILED, { tone: 'error' });
        return;
      }
      notify(kept > 0 ? `元に戻しました（そのあとの変更 ${kept}件 は残しています）` : '元に戻しました', {
        tone: 'info',
      });
    },
  });

  /**
   * 記録と目標をまとめて置き換え、取り消し用の「元に戻す」を用意する。
   * hadData: 置き換える前にデータがあったか（なければ取り消しは不要）
   */
  const replaceAll = (
    next: AppContents,
    options: { clearBackupMark?: boolean } = {},
  ): { ok: boolean; undo: ToastAction; hadData: boolean } => {
    const before = data.snapshot();
    const ok = data.replaceAll(next, options);
    const applied: DataSnapshot = {
      ...next,
      lastBackupAt: options.clearBackupMark ? undefined : before.lastBackupAt,
    };
    return {
      ok,
      undo: undoReplace(before, applied),
      hadData: before.records.length > 0 || before.goal !== null || before.trainings.length > 0,
    };
  };

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

  const handleSaveTraining = (training: TrainingRecord, mode: 'created' | 'updated') => {
    const ok = data.saveTraining(training);
    if (!ok) notify(SAVE_FAILED, { tone: 'error' });
    else notify(mode === 'updated' ? 'トレーニングを更新しました' : 'トレーニングを記録しました');
    window.scrollTo({ top: 0 });
  };

  const handleDeleteTraining = (training: TrainingRecord) => {
    const ok = data.deleteTraining(training.id);
    if (!ok) {
      notify(SAVE_FAILED, { tone: 'error' });
      return;
    }
    notify(`「${training.exerciseName}」の記録を削除しました`, {
      action: {
        label: '元に戻す',
        onClick: () => {
          const restored = data.saveTraining(training);
          notify(restored ? '削除を取り消しました' : SAVE_FAILED, { tone: restored ? 'info' : 'error' });
        },
      },
    });
  };

  const handleSaveExercise = (exercise: Exercise, mode: 'created' | 'updated') => {
    const ok = data.saveExercise(exercise);
    if (!ok) notify(SAVE_FAILED, { tone: 'error' });
    else if (mode === 'updated') notify(`「${exercise.name}」を更新しました`);
  };

  const handleDeleteExercise = (exercise: Exercise) => {
    const ok = data.deleteExercise(exercise.id);
    if (!ok) {
      notify(SAVE_FAILED, { tone: 'error' });
      return;
    }
    notify(`「${exercise.name}」をマイメニューから消しました`, {
      action: {
        label: '元に戻す',
        onClick: () => {
          const restored = data.saveExercise(exercise);
          notify(restored ? '元に戻しました' : SAVE_FAILED, { tone: restored ? 'info' : 'error' });
        },
      },
    });
  };

  const handleRestore = (backup: BackupData) => {
    const { ok, undo, hadData } = replaceAll({
      records: backup.records,
      goal: backup.goal ?? data.goal,
      trainings: backup.trainings,
      exercises: backup.exercises,
    });
    navigate('home');
    if (!ok) notify(SAVE_FAILED, { tone: 'error' });
    else
      notify(`バックアップから復元しました（${backup.records.length}件）`, {
        action: hadData ? undo : undefined,
      });
  };

  const handleClearAll = () => {
    // 最終バックアップ日時も消す（残すと、消したデータのバックアップを最新として扱ってしまう）
    const { ok, undo } = replaceAll(
      { records: [], goal: null, trainings: [], exercises: [] },
      { clearBackupMark: true },
    );
    navigate('home');
    if (!ok) notify(SAVE_FAILED, { tone: 'error' });
    else notify('すべてのデータを削除しました', { action: undo });
  };

  const loadSample = enableSample
    ? () => {
        const sample = createSampleData(today);
        const { undo, hadData } = replaceAll(sample);
        navigate('home');
        notify('サンプルデータを読み込みました', { action: hadData ? undo : undefined });
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
            trainings={data.trainings}
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
            trainings={data.trainings}
            onTraining={() => navigate('training')}
            backupDue={isBackupDue(
              data.records.length + data.trainings.length,
              data.lastBackupAt,
              Date.now(),
            )}
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
        {tab === 'training' && (
          <Training
            key={trainingKey}
            trainings={data.trainings}
            exercises={data.exercises}
            today={today}
            notify={notify}
            onSaveTraining={handleSaveTraining}
            onDeleteTraining={handleDeleteTraining}
            onSaveExercise={handleSaveExercise}
            onDeleteExercise={handleDeleteExercise}
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
            trainings={data.trainings}
            exercises={data.exercises}
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

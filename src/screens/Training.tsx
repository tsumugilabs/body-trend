import { useState } from 'react';
import type { Exercise, TrainingRecord } from '../types';
import { formatShort } from '../lib/date';
import { KINDS, summarizeTraining } from '../lib/training';
import { groupTrainingsByDate } from '../lib/trainings';
import { useConfirm } from '../components/ConfirmDialog';
import { EditIcon, TrashIcon } from '../components/Icons';
import type { Notify } from '../components/Toast';
import { TrainingForm } from './TrainingForm';
import { ExerciseMenu } from './ExerciseMenu';

type Props = {
  trainings: TrainingRecord[];
  exercises: Exercise[];
  today: string;
  notify: Notify;
  onSaveTraining: (training: TrainingRecord, mode: 'created' | 'updated') => void;
  onDeleteTraining: (training: TrainingRecord) => void;
  onSaveExercise: (exercise: Exercise, mode: 'created' | 'updated') => void;
  onDeleteExercise: (exercise: Exercise) => void;
};

type View = 'log' | 'menu';

export function Training({
  trainings,
  exercises,
  today,
  notify,
  onSaveTraining,
  onDeleteTraining,
  onSaveExercise,
  onDeleteExercise,
}: Props) {
  const confirm = useConfirm();
  const [view, setView] = useState<View>('log');
  const [form, setForm] = useState<{ editing: TrainingRecord | null } | null>(null);

  const closeForm = () => setForm(null);
  const openMenu = () => {
    closeForm();
    setView('menu');
    window.scrollTo({ top: 0 });
  };

  const handleSave = (training: TrainingRecord, mode: 'created' | 'updated') => {
    onSaveTraining(training, mode);
    closeForm();
  };

  const handleDelete = async (training: TrainingRecord) => {
    const ok = await confirm({
      title: `${formatShort(training.date)}の「${training.exerciseName}」を削除しますか？`,
      message: (
        <>
          <dl className="compare">
            <dt>削除する記録</dt>
            <dd>
              {training.exerciseName}
              {summarizeTraining(training) && ` ・ ${summarizeTraining(training)}`}
              {training.memo && ` ・ ${training.memo}`}
            </dd>
          </dl>
          <p>削除した直後に表示される「元に戻す」で取り消せます。</p>
        </>
      ),
      confirmLabel: '削除する',
      danger: true,
    });
    if (ok) onDeleteTraining(training);
  };

  const groups = groupTrainingsByDate(trainings);
  const thisYear = today.slice(0, 4);

  return (
    <div className="screen">
      <h1 className="screen-title">トレーニング</h1>

      <div className="segmented" role="group" aria-label="表示する内容">
        {(
          [
            ['log', '記録'],
            ['menu', 'マイメニュー'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={view === key}
            className={view === key ? 'is-active' : ''}
            onClick={() => {
              setView(key);
              closeForm();
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'menu' ? (
        <ExerciseMenu
          exercises={exercises}
          trainings={trainings}
          notify={notify}
          onSave={onSaveExercise}
          onDelete={onDeleteExercise}
        />
      ) : form ? (
        <TrainingForm
          key={form.editing ? `edit-${form.editing.id}` : 'new'}
          exercises={exercises}
          trainings={trainings}
          today={today}
          editing={form.editing}
          onSave={handleSave}
          onCancel={closeForm}
          onOpenMenu={openMenu}
        />
      ) : (
        <>
          <button
            type="button"
            className="btn btn-primary btn-block btn-large"
            onClick={() => setForm({ editing: null })}
          >
            トレーニングを追加
          </button>

          {groups.length === 0 ? (
            <div className="card empty">
              <p>まだトレーニングの記録がありません</p>
              <p className="muted">
                よく行う種目を「マイメニュー」に登録しておくと、記録するときに選ぶだけで済みます。
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.date} className="training-day">
                <h2 className="training-date">
                  {group.date.slice(0, 4) !== thisYear && (
                    <span className="history-year">{group.date.slice(0, 4)}年 </span>
                  )}
                  {formatShort(group.date)}
                  <span className="title-count">{group.items.length}種目</span>
                </h2>
                <ul className="history-list">
                  {group.items.map((training) => (
                    <li key={training.id} className="card history-item">
                      <div className="history-main">
                        <p className="exercise-name">
                          {training.exerciseName}
                          <span className={`kind-badge kind-${training.kind}`}>
                            {KINDS[training.kind].label}
                          </span>
                        </p>
                        <p className="training-summary">{summarizeTraining(training)}</p>
                        {training.memo && <p className="training-memo">{training.memo}</p>}
                      </div>
                      <div className="history-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`${formatShort(training.date)}の${training.exerciseName}を編集`}
                          onClick={() => {
                            setForm({ editing: training });
                            window.scrollTo({ top: 0 });
                          }}
                        >
                          <EditIcon />
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          aria-label={`${formatShort(training.date)}の${training.exerciseName}を削除`}
                          onClick={() => handleDelete(training)}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}

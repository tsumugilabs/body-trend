import { useState, type FormEvent } from 'react';
import type { Exercise, ExerciseKind, TrainingRecord } from '../types';
import { createId } from '../lib/records';
import { EXERCISE_NAME_MAX, KINDS, KIND_ORDER, TRAINING_FIELDS } from '../lib/training';
import { findExerciseByName } from '../lib/trainings';
import { validateExercise } from '../lib/validation';
import { useConfirm } from '../components/ConfirmDialog';
import { TextField } from '../components/NumberField';
import { EditIcon, TrashIcon } from '../components/Icons';
import type { Notify } from '../components/Toast';

type Props = {
  exercises: Exercise[];
  trainings: TrainingRecord[];
  notify: Notify;
  onSave: (exercise: Exercise, mode: 'created' | 'updated') => void;
  onDelete: (exercise: Exercise) => void;
};

export function ExerciseMenu({ exercises, trainings, notify, onSave, onDelete }: Props) {
  const confirm = useConfirm();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ExerciseKind>('strength');
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [error, setError] = useState<string | undefined>();

  const reset = () => {
    setName('');
    setEditing(null);
    setError(undefined);
  };

  const submit = (nextName: string, nextKind: ExerciseKind) => {
    const result = validateExercise(
      { name: nextName, kind: nextKind },
      { exercises, editingId: editing?.id },
    );
    if (!result.values) {
      setError(result.error);
      return;
    }
    onSave({ id: editing?.id ?? createId(), ...result.values }, editing ? 'updated' : 'created');
    reset();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(name, kind);
  };

  const handleDelete = async (exercise: Exercise) => {
    const used = trainings.filter((t) => t.exerciseId === exercise.id).length;
    const ok = await confirm({
      title: `「${exercise.name}」をマイメニューから消しますか？`,
      message: (
        <>
          <p>
            {used > 0
              ? `この種目の記録 ${used}件 はそのまま残ります（記録し直すときは登録し直してください）。`
              : 'この種目の記録はまだありません。'}
          </p>
          <p>削除した直後に表示される「元に戻す」で取り消せます。</p>
        </>
      ),
      confirmLabel: '消す',
      danger: true,
    });
    if (ok) onDelete(exercise);
  };

  // まだ登録していない候補だけを「よく使う種目」として出す
  const suggestions = KINDS[kind].examples.filter((example) => !findExerciseByName(exercises, example));

  return (
    <>
      <form className="card form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <span className="field-label" id="exercise-kind-label">
            種類
          </span>
          <div className="segmented" role="group" aria-labelledby="exercise-kind-label">
            {KIND_ORDER.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={kind === key}
                className={kind === key ? 'is-active' : ''}
                onClick={() => setKind(key)}
              >
                {KINDS[key].label}
              </button>
            ))}
          </div>
          <p className="field-hint">
            入力する項目: {KINDS[kind].fields.map((field) => TRAINING_FIELDS[field].label).join('・')}
          </p>
        </div>

        <TextField
          id="exercise-name"
          label="種目名"
          required
          value={name}
          onChange={(value) => {
            setName(value);
            if (error) setError(undefined);
          }}
          error={error}
          maxLength={EXERCISE_NAME_MAX}
          placeholder={`例 ${KINDS[kind].examples[0]}`}
        />

        <button type="submit" className="btn btn-primary btn-block">
          {editing ? '変更を保存する' : 'マイメニューに追加'}
        </button>
        {editing && (
          <button type="button" className="btn btn-secondary btn-block" onClick={reset}>
            キャンセル
          </button>
        )}
      </form>

      {!editing && suggestions.length > 0 && (
        <div className="card">
          <p className="muted">よく使う種目（タップで追加）</p>
          <ul className="chip-list">
            {suggestions.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  className="chip"
                  onClick={() => {
                    submit(suggestion, kind);
                    notify(`「${suggestion}」を追加しました`);
                  }}
                >
                  ＋ {suggestion}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="section-title">
        登録した種目 <span className="title-count">{exercises.length}件</span>
      </h2>
      {exercises.length === 0 ? (
        <div className="card empty">
          <p>まだ種目がありません。上のフォームから追加してください</p>
        </div>
      ) : (
        <ul className="history-list">
          {exercises.map((exercise) => (
            <li key={exercise.id} className="card history-item">
              <div className="history-main">
                <p className="exercise-name">{exercise.name}</p>
                <p className="history-sub">
                  <span className={`kind-badge kind-${exercise.kind}`}>{KINDS[exercise.kind].label}</span>
                  <span>記録 {trainings.filter((t) => t.exerciseId === exercise.id).length}件</span>
                </p>
              </div>
              <div className="history-actions">
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`${exercise.name}を編集`}
                  onClick={() => {
                    setEditing(exercise);
                    setName(exercise.name);
                    setKind(exercise.kind);
                    setError(undefined);
                    window.scrollTo({ top: 0 });
                  }}
                >
                  <EditIcon />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn-danger"
                  aria-label={`${exercise.name}をマイメニューから消す`}
                  onClick={() => handleDelete(exercise)}
                >
                  <TrashIcon />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

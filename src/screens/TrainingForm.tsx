import { useState, type FormEvent } from 'react';
import type { Exercise, TrainingRecord } from '../types';
import { createId } from '../lib/records';
import { KINDS, TRAINING_FIELDS, formatTrainingValue } from '../lib/training';
import { lastTrainingFor } from '../lib/trainings';
import { validateTraining, type TrainingErrors, type TrainingInput } from '../lib/validation';
import { useConfirm } from '../components/ConfirmDialog';
import { DateField, NumberField, TextField } from '../components/NumberField';

type Props = {
  exercises: Exercise[];
  trainings: TrainingRecord[];
  today: string;
  /** 指定があれば編集モード */
  editing?: TrainingRecord | null;
  onSave: (training: TrainingRecord, mode: 'created' | 'updated') => void;
  onCancel: () => void;
  /** マイメニューに種目がないときの案内先 */
  onOpenMenu: () => void;
};

const toInput = (value: number | undefined, integer: boolean) =>
  value === undefined ? '' : integer ? String(value) : value.toFixed(1);

const emptyInput = (date: string): TrainingInput => ({
  date,
  exerciseId: '',
  weight: '',
  reps: '',
  sets: '',
  minutes: '',
  distance: '',
  memo: '',
});

export function TrainingForm({
  exercises,
  trainings,
  today,
  editing,
  onSave,
  onCancel,
  onOpenMenu,
}: Props) {
  const confirm = useConfirm();
  const [input, setInput] = useState<TrainingInput>(() => {
    if (!editing) return { ...emptyInput(today), exerciseId: exercises[0]?.id ?? '' };
    return {
      date: editing.date,
      exerciseId: editing.exerciseId,
      weight: toInput(editing.weight, false),
      reps: toInput(editing.reps, true),
      sets: toInput(editing.sets, true),
      minutes: toInput(editing.minutes, true),
      distance: toInput(editing.distance, false),
      memo: editing.memo ?? '',
    };
  });
  const [errors, setErrors] = useState<TrainingErrors>({});
  const [busy, setBusy] = useState(false);

  const update = (key: keyof TrainingInput) => (value: string) => {
    setInput((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  if (exercises.length === 0) {
    return (
      <div className="card empty">
        <p>先にマイメニューへ種目を登録してください</p>
        <button type="button" className="btn btn-primary" onClick={onOpenMenu}>
          マイメニューを開く
        </button>
        <button type="button" className="btn btn-link" onClick={onCancel}>
          キャンセル
        </button>
      </div>
    );
  }

  const exercise = exercises.find((e) => e.id === input.exerciseId);
  const fields = exercise ? KINDS[exercise.kind].fields : [];
  const previous = exercise ? lastTrainingFor(trainings, exercise.id, editing?.id) : undefined;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const result = validateTraining(input, { today, exercises });
    setErrors(result.errors);
    if (!result.values) {
      const firstKey = Object.keys(result.errors)[0];
      if (firstKey) document.getElementById(`training-${firstKey}`)?.focus();
      return;
    }
    const values = result.values;
    setBusy(true);
    try {
      if (result.warnings.length > 0) {
        const ok = await confirm({
          title: 'この内容で保存しますか？',
          message: (
            <ul className="warning-list">
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ),
          confirmLabel: '保存する',
          cancelLabel: '見直す',
        });
        if (!ok) return;
      }
      onSave({ id: editing?.id ?? createId(), ...values }, editing ? 'updated' : 'created');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      <DateField
        id="training-date"
        label="日付"
        value={input.date}
        max={today}
        onChange={update('date')}
        error={errors.date}
      />

      <div className="field">
        <label htmlFor="training-exerciseId" className="field-label">
          種目
          <span className="badge-required">必須</span>
        </label>
        <select
          id="training-exerciseId"
          className={`select-input ${errors.exerciseId ? 'has-error' : ''}`}
          value={input.exerciseId}
          aria-invalid={errors.exerciseId ? true : undefined}
          onChange={(e) => update('exerciseId')(e.target.value)}
        >
          <option value="">選んでください</option>
          {Object.values(KINDS).map((kind) => {
            const items = exercises.filter((item) => item.kind === kind.key);
            if (items.length === 0) return null;
            return (
              <optgroup key={kind.key} label={kind.label}>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
        {errors.exerciseId ? (
          <p className="field-error">{errors.exerciseId}</p>
        ) : (
          <p className="field-hint">
            {exercise ? `${KINDS[exercise.kind].label}の項目を入力します` : 'マイメニューから選びます'}
          </p>
        )}
      </div>

      {fields.map((key) => {
        const field = TRAINING_FIELDS[key];
        const before = previous?.[key];
        return (
          <NumberField
            key={key}
            id={`training-${key}`}
            label={field.label}
            unit={field.unit}
            value={input[key]}
            onChange={update(key)}
            error={errors[key]}
            placeholder={
              before !== undefined && !editing
                ? `前回 ${formatTrainingValue(key, before)}`
                : field.placeholder
            }
          />
        );
      })}

      <TextField
        id="training-memo"
        label="メモ"
        value={input.memo}
        onChange={update('memo')}
        error={errors.memo}
        maxLength={100}
        placeholder="調子や内容のメモ"
      />

      <button type="submit" className="btn btn-primary btn-block btn-large" disabled={busy}>
        {editing ? '変更を保存する' : '保存する'}
      </button>
      <button type="button" className="btn btn-secondary btn-block" onClick={onCancel}>
        キャンセル
      </button>
    </form>
  );
}

import { useState, type FormEvent } from 'react';
import type { GoalSettings } from '../types';
import { addDays, isValidDateString } from '../lib/date';
import { validateGoal, type GoalErrors, type GoalInput } from '../lib/validation';
import { useConfirm } from '../components/ConfirmDialog';
import { DateField, NumberField } from '../components/NumberField';

type Props = {
  initial: GoalSettings | null;
  today: string;
  submitLabel: string;
  onSubmit: (goal: GoalSettings) => void;
};

const toInput = (n: number | undefined) => (n === undefined ? '' : n.toFixed(1));

export function GoalForm({ initial, today, submitLabel, onSubmit }: Props) {
  const confirm = useConfirm();
  const [input, setInput] = useState<GoalInput>(() => ({
    startDate: initial?.startDate ?? today,
    targetDate: initial?.targetDate ?? addDays(today, 90),
    targetWeight: toInput(initial?.targetWeight),
    targetBodyFat: toInput(initial?.targetBodyFat),
    targetSkeletalMuscle: toInput(initial?.targetSkeletalMuscle),
  }));
  const [errors, setErrors] = useState<GoalErrors>({});

  const update = (key: keyof GoalInput) => (value: string) => {
    setInput((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const result = validateGoal(input, { today });
    setErrors(result.errors);
    if (!result.values) {
      const firstKey = Object.keys(result.errors)[0];
      if (firstKey) document.getElementById(`goal-${firstKey}`)?.focus();
      return;
    }
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
    onSubmit(result.values);
  };

  const minTarget = isValidDateString(input.startDate) ? addDays(input.startDate, 1) : undefined;

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      <div className="field-row">
        <DateField
          id="goal-startDate"
          label="開始日"
          value={input.startDate}
          onChange={update('startDate')}
          error={errors.startDate}
        />
        <DateField
          id="goal-targetDate"
          label="目標日"
          value={input.targetDate}
          min={minTarget}
          onChange={update('targetDate')}
          error={errors.targetDate}
        />
      </div>
      <NumberField
        id="goal-targetWeight"
        label="目標体重"
        unit="kg"
        required
        value={input.targetWeight}
        onChange={update('targetWeight')}
        error={errors.targetWeight}
        placeholder="例 65.0"
      />
      <NumberField
        id="goal-targetBodyFat"
        label="目標体脂肪率"
        unit="%"
        value={input.targetBodyFat}
        onChange={update('targetBodyFat')}
        error={errors.targetBodyFat}
        placeholder="例 20.0"
      />
      <NumberField
        id="goal-targetSkeletalMuscle"
        label="目標骨格筋率"
        unit="%"
        value={input.targetSkeletalMuscle}
        onChange={update('targetSkeletalMuscle')}
        error={errors.targetSkeletalMuscle}
        placeholder="例 32.0"
      />
      <button type="submit" className="btn btn-primary btn-block btn-large">
        {submitLabel}
      </button>
    </form>
  );
}

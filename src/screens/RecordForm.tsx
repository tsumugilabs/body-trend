import { useState, type FormEvent } from 'react';
import type { BodyRecord } from '../types';
import { formatShort } from '../lib/date';
import { formatNumber } from '../lib/metrics';
import { createId, findByDate } from '../lib/records';
import { validateRecord, type FieldErrors, type RecordInput } from '../lib/validation';
import { useConfirm } from '../components/ConfirmDialog';
import { DateField, NumberField } from '../components/NumberField';

type Props = {
  records: BodyRecord[];
  today: string;
  /** 指定があれば編集モード */
  editing?: BodyRecord | null;
  onSave: (record: BodyRecord, mode: 'created' | 'updated') => void;
  onCancel?: () => void;
};

const toInput = (n: number | undefined) => (n === undefined ? '' : n.toFixed(1));

const describe = (r: Pick<BodyRecord, 'weight' | 'bodyFat' | 'skeletalMuscle' | 'waist'>) =>
  `体重 ${formatNumber(r.weight)}kg / 体脂肪率 ${formatNumber(r.bodyFat)}% / 骨格筋率 ${formatNumber(r.skeletalMuscle)}% / 腹囲 ${formatNumber(r.waist)}cm`;

export function RecordForm({ records, today, editing, onSave, onCancel }: Props) {
  const confirm = useConfirm();
  const [input, setInput] = useState<RecordInput>(() => ({
    date: editing?.date ?? today,
    weight: toInput(editing?.weight),
    bodyFat: toInput(editing?.bodyFat),
    skeletalMuscle: toInput(editing?.skeletalMuscle),
    waist: toInput(editing?.waist),
  }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const latest = records[records.length - 1];
  const sameDate = findByDate(records, input.date);
  const duplicateHint =
    sameDate && sameDate.id !== editing?.id
      ? `この日付の記録があります（${formatNumber(sameDate.weight)}kg）。保存すると更新の確認をします`
      : undefined;

  const update = (key: keyof RecordInput) => (value: string) => {
    setInput((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const result = validateRecord(input, { today, records, editingId: editing?.id });
    setErrors(result.errors);
    if (!result.values) {
      const firstKey = Object.keys(result.errors)[0];
      if (firstKey) document.getElementById(`record-${firstKey}`)?.focus();
      return;
    }
    const values = result.values;
    setBusy(true);
    try {
      if (result.warnings.length > 0) {
        const ok = await confirm({
          title: 'この値で保存しますか？',
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

      const existing = findByDate(records, values.date);
      if (existing && existing.id !== editing?.id) {
        const ok = await confirm({
          title: `${formatShort(values.date)}の記録を更新しますか？`,
          message: (
            <dl className="compare">
              <dt>現在の記録</dt>
              <dd>{describe(existing)}</dd>
              <dt>新しい値</dt>
              <dd>{describe(values)}</dd>
            </dl>
          ),
          confirmLabel: '更新する',
        });
        if (!ok) return;
      }

      const id = editing?.id ?? existing?.id ?? createId();
      onSave({ id, ...values }, editing || existing ? 'updated' : 'created');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <h1 className="screen-title">{editing ? '記録を編集' : '今日の記録'}</h1>
      <form className="card form" onSubmit={handleSubmit} noValidate>
        <DateField
          id="record-date"
          label="日付"
          value={input.date}
          max={today}
          onChange={update('date')}
          error={errors.date}
          hint={duplicateHint}
        />
        <NumberField
          id="record-weight"
          label="体重"
          unit="kg"
          required
          value={input.weight}
          onChange={update('weight')}
          error={errors.weight}
          placeholder={latest && !editing ? `前回 ${latest.weight.toFixed(1)}` : '例 65.0'}
        />
        <NumberField
          id="record-bodyFat"
          label="体脂肪率"
          unit="%"
          value={input.bodyFat}
          onChange={update('bodyFat')}
          error={errors.bodyFat}
          placeholder="例 22.5"
        />
        <NumberField
          id="record-skeletalMuscle"
          label="骨格筋率"
          unit="%"
          value={input.skeletalMuscle}
          onChange={update('skeletalMuscle')}
          error={errors.skeletalMuscle}
          placeholder="例 30.0"
        />
        <NumberField
          id="record-waist"
          label="腹囲"
          unit="cm"
          value={input.waist}
          onChange={update('waist')}
          error={errors.waist}
          placeholder="例 82.0"
        />
        <button type="submit" className="btn btn-primary btn-block btn-large" disabled={busy}>
          {editing ? '変更を保存する' : '保存する'}
        </button>
        {editing && onCancel && (
          <button type="button" className="btn btn-secondary btn-block" onClick={onCancel}>
            キャンセル
          </button>
        )}
      </form>
    </div>
  );
}

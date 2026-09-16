import type { BodyRecord } from '../types';
import { formatShort } from '../lib/date';
import { formatNumber } from '../lib/metrics';
import { useConfirm } from '../components/ConfirmDialog';
import { EditIcon, TrashIcon } from '../components/Icons';

type Props = {
  records: BodyRecord[];
  today: string;
  onEdit: (record: BodyRecord) => void;
  onDelete: (record: BodyRecord) => void;
  onRecord: () => void;
};

export function History({ records, today, onEdit, onDelete, onRecord }: Props) {
  const confirm = useConfirm();
  const sorted = [...records].reverse();
  const thisYear = today.slice(0, 4);

  const handleDelete = async (record: BodyRecord) => {
    const ok = await confirm({
      title: `${formatShort(record.date)}の記録を削除しますか？`,
      message: (
        <>
          <dl className="compare">
            <dt>削除する記録</dt>
            <dd>
              {formatShort(record.date)} ・ 体重 {formatNumber(record.weight)}kg ・ 体脂肪率{' '}
              {formatNumber(record.bodyFat)}% ・ 骨格筋率 {formatNumber(record.skeletalMuscle)}% ・ 腹囲{' '}
              {formatNumber(record.waist)}cm
            </dd>
          </dl>
          <p>削除した直後に表示される「元に戻す」で取り消せます。</p>
        </>
      ),
      confirmLabel: '削除する',
      danger: true,
    });
    if (ok) onDelete(record);
  };

  return (
    <div className="screen">
      <h1 className="screen-title">
        履歴 <span className="title-count">{records.length}件</span>
      </h1>
      {sorted.length === 0 ? (
        <div className="card empty">
          <p>まだ記録がありません</p>
          <button type="button" className="btn btn-primary" onClick={onRecord}>
            記録する
          </button>
        </div>
      ) : (
        <ul className="history-list">
          {sorted.map((r) => {
            const year = r.date.slice(0, 4);
            return (
              <li key={r.id} className="card history-item">
                <div className="history-main">
                  <p className="history-date">
                    {year !== thisYear && <span className="history-year">{year}年 </span>}
                    {formatShort(r.date)}
                  </p>
                  <p className="history-weight">
                    {formatNumber(r.weight)}
                    <span className="unit">kg</span>
                  </p>
                  <p className="history-sub">
                    <span>体脂肪 {formatNumber(r.bodyFat)}{r.bodyFat !== undefined && '%'}</span>
                    <span>骨格筋 {formatNumber(r.skeletalMuscle)}{r.skeletalMuscle !== undefined && '%'}</span>
                    <span>腹囲 {formatNumber(r.waist)}{r.waist !== undefined && 'cm'}</span>
                  </p>
                </div>
                <div className="history-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`${formatShort(r.date)}の記録を編集`}
                    onClick={() => onEdit(r)}
                  >
                    <EditIcon />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn-danger"
                    aria-label={`${formatShort(r.date)}の記録を削除`}
                    onClick={() => handleDelete(r)}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

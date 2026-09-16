import type { TabKey } from '../types';
import { DumbbellIcon, HomeIcon, ListIcon, PlusIcon, SettingsIcon } from './Icons';

const ITEMS: { key: TabKey; label: string; Icon: () => React.JSX.Element }[] = [
  { key: 'home', label: 'ホーム', Icon: HomeIcon },
  { key: 'record', label: '記録する', Icon: PlusIcon },
  { key: 'training', label: 'トレーニング', Icon: DumbbellIcon },
  { key: 'history', label: '履歴', Icon: ListIcon },
  { key: 'settings', label: '設定', Icon: SettingsIcon },
];

type Props = { current: TabKey; onChange: (tab: TabKey) => void };

export function BottomNav({ current, onChange }: Props) {
  return (
    <nav className="bottom-nav" aria-label="メインメニュー">
      {ITEMS.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          className={`nav-item ${current === key ? 'is-active' : ''}`}
          aria-current={current === key ? 'page' : undefined}
          onClick={() => onChange(key)}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

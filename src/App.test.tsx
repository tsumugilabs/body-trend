import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { GOAL_KEY, META_KEY, RECORDS_KEY } from './lib/storage';
import { addDays, todayString } from './lib/date';
import { readTextFile } from './lib/fileSave';

const today = todayString();
const yesterday = addDays(today, -1);

function seedGoal() {
  localStorage.setItem(
    GOAL_KEY,
    JSON.stringify({ startDate: addDays(today, -10), targetDate: addDays(today, 30), targetWeight: 65 }),
  );
}

const storedRecords = () => JSON.parse(localStorage.getItem(RECORDS_KEY) ?? '[]') as unknown[];
const storedMeta = () => JSON.parse(localStorage.getItem(META_KEY) ?? '{}') as { lastBackupAt?: string };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App', () => {
  it('初回は目標設定を表示し、設定後にダッシュボードへ移動する', async () => {
    const user = userEvent.setup();
    render(<App enableSample={false} />);

    expect(screen.getByRole('heading', { name: 'からだ記録へようこそ' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

    // 目標体重なしではエラー
    await user.click(screen.getByRole('button', { name: 'この目標ではじめる' }));
    expect(screen.getByText('目標体重を入力してください')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/目標体重/), '65');
    await user.click(screen.getByRole('button', { name: 'この目標ではじめる' }));

    expect(screen.getByText(/目標日まで/)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'メインメニュー' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(GOAL_KEY)!).targetWeight).toBe(65);
  });

  it('記録するとダッシュボードと localStorage に反映される', async () => {
    const user = userEvent.setup();
    seedGoal();
    render(<App enableSample={false} />);

    await user.click(screen.getByRole('button', { name: '記録する' }));
    await user.type(screen.getByLabelText(/^体重/), '70.4');
    await user.type(screen.getByLabelText(/体脂肪率/), '24.5');
    await user.click(screen.getByRole('button', { name: '保存する' }));

    expect(await screen.findByText('記録しました')).toBeInTheDocument();
    const hero = screen.getByRole('region', { name: '現在の体重' });
    expect(within(hero).getByText('70.4')).toBeInTheDocument();
    expect(within(hero).getByText('あと 5.4 kg')).toBeInTheDocument();
    expect(storedRecords()).toMatchObject([{ date: today, weight: 70.4, bodyFat: 24.5 }]);
  });

  it('同じ日付の記録は確認してから更新する', async () => {
    const user = userEvent.setup();
    seedGoal();
    localStorage.setItem(RECORDS_KEY, JSON.stringify([{ id: 'x', date: today, weight: 70 }]));
    render(<App enableSample={false} />);

    await user.click(screen.getByRole('button', { name: '記録する' }));
    await user.type(screen.getByLabelText(/^体重/), '69.8');
    await user.click(screen.getByRole('button', { name: '保存する' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/記録を更新しますか/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '更新する' }));

    expect(await screen.findByText('記録を更新しました')).toBeInTheDocument();
    expect(storedRecords()).toEqual([{ id: 'x', date: today, weight: 69.8 }]);
  });

  it('不正な値はエラーを表示して保存しない', async () => {
    const user = userEvent.setup();
    seedGoal();
    render(<App enableSample={false} />);

    await user.click(screen.getByRole('button', { name: '記録する' }));
    await user.type(screen.getByLabelText(/^体重/), '70.45');
    await user.click(screen.getByRole('button', { name: '保存する' }));
    expect(screen.getByText('小数点第1位まで入力してください')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('日付'), { target: { value: addDays(today, 1) } });
    await user.click(screen.getByRole('button', { name: '保存する' }));
    expect(screen.getByText('未来の日付は記録できません')).toBeInTheDocument();
    expect(localStorage.getItem(RECORDS_KEY)).toBeNull();
  });

  it('履歴から削除するときは内容を見せて確認し、削除後に元に戻せる', async () => {
    const user = userEvent.setup();
    seedGoal();
    localStorage.setItem(
      RECORDS_KEY,
      JSON.stringify([
        { id: 'a', date: yesterday, weight: 71 },
        { id: 'b', date: today, weight: 70.5, bodyFat: 24.1 },
      ]),
    );
    render(<App enableSample={false} />);
    await user.click(screen.getByRole('button', { name: '履歴' }));

    const items = screen.getAllByRole('listitem');
    // 新しい日付が先頭
    expect(within(items[0]).getByText('70.5')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /の記録を削除/ })[0]);
    let dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/体重 70.5kg ・ 体脂肪率 24.1%/)).toBeInTheDocument();
    // 危険な操作では「キャンセル」が初期フォーカス
    expect(within(dialog).getByRole('button', { name: 'キャンセル' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'キャンセル' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);

    await user.click(screen.getAllByRole('button', { name: /の記録を削除/ })[0]);
    dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: '削除する' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(storedRecords()).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: '元に戻す' }));
    expect(await screen.findByText('削除を取り消しました')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(storedRecords()).toHaveLength(2);
  });

  it('履歴から編集できる', async () => {
    const user = userEvent.setup();
    seedGoal();
    localStorage.setItem(RECORDS_KEY, JSON.stringify([{ id: 'a', date: yesterday, weight: 71 }]));
    render(<App enableSample={false} />);
    await user.click(screen.getByRole('button', { name: '履歴' }));

    await user.click(screen.getByRole('button', { name: /の記録を編集/ }));
    const weight = screen.getByLabelText(/^体重/);
    expect(weight).toHaveValue('71.0');
    await user.clear(weight);
    await user.type(weight, '70.8');
    await user.click(screen.getByRole('button', { name: '変更を保存する' }));

    expect(await screen.findByText('記録を更新しました')).toBeInTheDocument();
    expect(storedRecords()).toEqual([{ id: 'a', date: yesterday, weight: 70.8 }]);
  });

  it('すべて削除は「削除」と入力するまで実行できず、削除後に元に戻せる', async () => {
    const user = userEvent.setup();
    seedGoal();
    localStorage.setItem(RECORDS_KEY, JSON.stringify([{ id: 'a', date: yesterday, weight: 71 }]));
    render(<App enableSample={false} />);
    await user.click(screen.getByRole('button', { name: '設定' }));
    await user.click(screen.getByRole('button', { name: 'すべてのデータを削除' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/バックアップがまだ保存されていません/)).toBeInTheDocument();
    const deleteButton = within(dialog).getByRole('button', { name: '削除する' });
    expect(deleteButton).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/確認のため/), 'さくじょ');
    expect(deleteButton).toBeDisabled();
    await user.clear(within(dialog).getByLabelText(/確認のため/));
    await user.type(within(dialog).getByLabelText(/確認のため/), '削除');
    expect(deleteButton).toBeEnabled();
    await user.click(deleteButton);

    expect(screen.getByRole('heading', { name: 'からだ記録へようこそ' })).toBeInTheDocument();
    expect(storedRecords()).toEqual([]);
    expect(localStorage.getItem(GOAL_KEY)).toBeNull();

    await user.click(screen.getByRole('button', { name: '元に戻す' }));
    expect(await screen.findByText('元に戻しました')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'メインメニュー' })).toBeInTheDocument();
    expect(storedRecords()).toHaveLength(1);
    expect(localStorage.getItem(GOAL_KEY)).not.toBeNull();
  });

  it('すべて削除で最終バックアップ日時も消し、元に戻すと戻る', async () => {
    const user = userEvent.setup();
    seedGoal();
    localStorage.setItem(RECORDS_KEY, JSON.stringify([{ id: 'a', date: yesterday, weight: 71 }]));
    localStorage.setItem(META_KEY, JSON.stringify({ lastBackupAt: '2026-09-01T00:00:00.000Z' }));
    render(<App enableSample={false} />);
    await user.click(screen.getByRole('button', { name: '設定' }));
    await user.click(screen.getByRole('button', { name: 'すべてのデータを削除' }));

    const dialog = await screen.findByRole('alertdialog');
    await user.type(within(dialog).getByLabelText(/確認のため/), '削除');
    await user.click(within(dialog).getByRole('button', { name: '削除する' }));

    // 消したデータのバックアップを「最新」として扱わないよう、日時も消す
    expect(storedMeta().lastBackupAt).toBeUndefined();

    await user.click(screen.getByRole('button', { name: '元に戻す' }));
    expect(await screen.findByText('元に戻しました')).toBeInTheDocument();
    expect(storedMeta().lastBackupAt).toBe('2026-09-01T00:00:00.000Z');
  });

  it('元に戻すまでのあいだに別の画面が加えた記録は消さない', async () => {
    const user = userEvent.setup();
    seedGoal();
    localStorage.setItem(RECORDS_KEY, JSON.stringify([{ id: 'a', date: yesterday, weight: 71 }]));
    render(<App enableSample={false} />);
    await user.click(screen.getByRole('button', { name: '設定' }));
    await user.click(screen.getByRole('button', { name: 'すべてのデータを削除' }));

    const dialog = await screen.findByRole('alertdialog');
    await user.type(within(dialog).getByLabelText(/確認のため/), '削除');
    await user.click(within(dialog).getByRole('button', { name: '削除する' }));
    expect(storedRecords()).toEqual([]);

    // 取り消せるあいだに、別のタブ（または PWA）で今日の記録が追加された
    localStorage.setItem(RECORDS_KEY, JSON.stringify([{ id: 'other', date: today, weight: 70.2 }]));

    await user.click(screen.getByRole('button', { name: '元に戻す' }));
    expect(await screen.findByText(/元に戻しました（そのあとの変更 1件 は残しています）/)).toBeInTheDocument();
    expect(storedRecords()).toMatchObject([
      { id: 'a', date: yesterday, weight: 71 },
      { id: 'other', date: today, weight: 70.2 },
    ]);
  });

  it('別の画面で保存された記録を、開いたままの古い画面が上書きしない', async () => {
    const user = userEvent.setup();
    seedGoal();
    render(<App enableSample={false} />);

    // 画面を開いた後に、別のタブ（または PWA）で記録が追加された
    localStorage.setItem(RECORDS_KEY, JSON.stringify([{ id: 'other', date: yesterday, weight: 71.2 }]));

    await user.click(screen.getByRole('button', { name: '記録する' }));
    await user.type(screen.getByLabelText(/^体重/), '70.9');
    await user.click(screen.getByRole('button', { name: '保存する' }));

    expect(await screen.findByText('記録しました')).toBeInTheDocument();
    expect(storedRecords()).toMatchObject([
      { id: 'other', date: yesterday, weight: 71.2 },
      { date: today, weight: 70.9 },
    ]);
  });

  it('バックアップを保存し、初回画面からそのファイルで復元できる', async () => {
    const user = userEvent.setup();
    seedGoal();
    localStorage.setItem(RECORDS_KEY, JSON.stringify([{ id: 'a', date: yesterday, weight: 70 }]));

    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:backup';
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const { unmount } = render(<App enableSample={false} />);
    await user.click(screen.getByRole('button', { name: '設定' }));
    await user.click(screen.getByRole('button', { name: 'バックアップを保存' }));
    expect(await screen.findByText('バックアップファイルを保存しました')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(META_KEY)!).lastBackupAt).toBeTruthy();
    expect(blobs).toHaveLength(1);
    const backupText = await readTextFile(blobs[0]);

    // 機種変更などで空になった状態を想定
    unmount();
    localStorage.clear();
    render(<App enableSample={false} />);
    expect(screen.getByRole('heading', { name: 'からだ記録へようこそ' })).toBeInTheDocument();

    const file = new File([backupText], 'body-trend-backup.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText('バックアップファイルを選択'), file);
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/記録 1件/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '復元する' }));

    expect(await screen.findByText('バックアップから復元しました（1件）')).toBeInTheDocument();
    const hero = screen.getByRole('region', { name: '現在の体重' });
    expect(within(hero).getByText('70.0')).toBeInTheDocument();
    expect(storedRecords()).toEqual([{ id: 'a', date: yesterday, weight: 70 }]);
  });

  it('記録が減る復元は「復元」と入力しないと実行できない', async () => {
    const user = userEvent.setup();
    seedGoal();
    localStorage.setItem(
      RECORDS_KEY,
      JSON.stringify([
        { id: 'a', date: yesterday, weight: 71 },
        { id: 'b', date: today, weight: 70.5 },
      ]),
    );
    render(<App enableSample={false} />);
    await user.click(screen.getByRole('button', { name: '設定' }));

    const backup = JSON.stringify({
      app: 'body-trend',
      version: 1,
      records: [{ id: 'a', date: yesterday, weight: 71 }],
      goal: null,
    });
    await user.upload(screen.getByLabelText('バックアップファイルを選択'), new File([backup], 'b.json'));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/1件（.+）はバックアップに含まれない/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '復元する' })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'キャンセル' }));
    expect(storedRecords()).toHaveLength(2);
  });

  it('件数が同じでも日付が違う復元は、消える記録を示して「復元」の入力を求める', async () => {
    const user = userEvent.setup();
    seedGoal();
    localStorage.setItem(
      RECORDS_KEY,
      JSON.stringify([
        { id: 'a', date: yesterday, weight: 71 },
        { id: 'b', date: today, weight: 70.5 },
      ]),
    );
    render(<App enableSample={false} />);
    await user.click(screen.getByRole('button', { name: '設定' }));

    // 件数は同じだが、どちらの日付も現在の記録にはない
    const backup = JSON.stringify({
      app: 'body-trend',
      version: 1,
      records: [
        { id: 'c', date: addDays(today, -30), weight: 74 },
        { id: 'd', date: addDays(today, -29), weight: 73.8 },
      ],
      goal: null,
    });
    await user.upload(screen.getByLabelText('バックアップファイルを選択'), new File([backup], 'b.json'));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/2件（.+）はバックアップに含まれない/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '復元する' })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'キャンセル' }));
    expect(storedRecords()).toHaveLength(2);
  });

  it('保存データが壊れていてもアプリを表示する', () => {
    localStorage.setItem(RECORDS_KEY, 'broken');
    localStorage.setItem(GOAL_KEY, '{"startDate":1}');
    render(<App enableSample={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('読み込めませんでした');
    expect(screen.getByRole('heading', { name: 'からだ記録へようこそ' })).toBeInTheDocument();
  });
});

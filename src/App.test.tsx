import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { GOAL_KEY, RECORDS_KEY } from './lib/storage';
import { addDays, todayString } from './lib/date';

const today = todayString();

function seedGoal() {
  localStorage.setItem(
    GOAL_KEY,
    JSON.stringify({ startDate: addDays(today, -10), targetDate: addDays(today, 30), targetWeight: 65 }),
  );
}

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
    expect(JSON.parse(localStorage.getItem(RECORDS_KEY)!)).toMatchObject([
      { date: today, weight: 70.4, bodyFat: 24.5 },
    ]);
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
    const saved = JSON.parse(localStorage.getItem(RECORDS_KEY)!);
    expect(saved).toEqual([{ id: 'x', date: today, weight: 69.8 }]);
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

  it('履歴から編集・削除（確認あり）ができる', async () => {
    const user = userEvent.setup();
    seedGoal();
    const yesterday = addDays(today, -1);
    localStorage.setItem(
      RECORDS_KEY,
      JSON.stringify([
        { id: 'a', date: yesterday, weight: 71 },
        { id: 'b', date: today, weight: 70.5 },
      ]),
    );
    render(<App enableSample={false} />);
    await user.click(screen.getByRole('button', { name: '履歴' }));

    const items = screen.getAllByRole('listitem');
    // 新しい日付が先頭
    expect(within(items[0]).getByText('70.5')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /の記録を削除/ })[0]);
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'キャンセル' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);

    await user.click(screen.getAllByRole('button', { name: /の記録を削除/ })[0]);
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '削除する' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /の記録を編集/ }));
    const weight = screen.getByLabelText(/^体重/);
    expect(weight).toHaveValue('71.0');
    await user.clear(weight);
    await user.type(weight, '70.8');
    await user.click(screen.getByRole('button', { name: '変更を保存する' }));

    expect(await screen.findByText('記録を更新しました')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(RECORDS_KEY)!)).toEqual([{ id: 'a', date: yesterday, weight: 70.8 }]);
  });

  it('保存データが壊れていてもアプリを表示する', () => {
    localStorage.setItem(RECORDS_KEY, 'broken');
    localStorage.setItem(GOAL_KEY, '{"startDate":1}');
    render(<App enableSample={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('読み込めませんでした');
    expect(screen.getByRole('heading', { name: 'からだ記録へようこそ' })).toBeInTheDocument();
  });
});

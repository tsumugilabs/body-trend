/**
 * 全体を置き換える操作（復元・全削除など）を取り消した結果を作る。
 * 取り消せるあいだに別の画面が加えた変更（追加・更新・削除）は、巻き戻さずに残す。
 *
 * @param base    操作前の内容（戻したいもの）
 * @param applied 操作が書き込んだ内容
 * @param current いま保存されている内容
 * @param keyOf   同じものと見なす手がかり（記録なら日付、トレーニングなら id）
 * @param same    内容が同じか
 * @returns items 戻した結果 / kept 残した（操作のあとの）変更の件数
 */
export function undoReplaceItems<T>(
  base: T[],
  applied: T[],
  current: T[],
  keyOf: (item: T) => string,
  same: (a: T, b: T) => boolean,
): { items: T[]; kept: number } {
  const appliedByKey = new Map(applied.map((item) => [keyOf(item), item]));
  const currentKeys = new Set(current.map(keyOf));
  const byKey = new Map(base.map((item) => [keyOf(item), item]));
  let kept = 0;

  // 操作のあとに別の画面が削除したもの（操作が書き込んだのに、いまはない）は復活させない
  for (const item of applied) {
    if (!currentKeys.has(keyOf(item)) && byKey.delete(keyOf(item))) kept++;
  }

  for (const item of current) {
    const written = appliedByKey.get(keyOf(item));
    // 操作が書き込んだままのものは、元の内容に戻す
    if (written && same(written, item)) continue;
    byKey.set(keyOf(item), item);
    kept++;
  }

  return { items: [...byKey.values()], kept };
}

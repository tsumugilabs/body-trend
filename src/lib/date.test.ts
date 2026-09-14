import { describe, expect, it } from 'vitest';
import { addDays, diffDays, formatShort, isValidDateString, toDateString } from './date';

describe('date', () => {
  it('YYYY-MM-DD の妥当性を判定する', () => {
    expect(isValidDateString('2026-09-14')).toBe(true);
    expect(isValidDateString('2024-02-29')).toBe(true);
    expect(isValidDateString('2026-02-29')).toBe(false);
    expect(isValidDateString('2026-9-14')).toBe(false);
    expect(isValidDateString('')).toBe(false);
    expect(isValidDateString(20260914)).toBe(false);
  });

  it('日付の加算と差分を計算する（月・年またぎ）', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2026-09-14', '2026-12-31')).toBe(108);
    expect(diffDays('2026-09-14', '2026-09-10')).toBe(-4);
  });

  it('ローカル日付で文字列化する', () => {
    expect(toDateString(new Date(2026, 8, 5, 23, 59))).toBe('2026-09-05');
  });

  it('曜日付きで表示する', () => {
    expect(formatShort('2026-09-14')).toBe('9/14(月)');
  });
});

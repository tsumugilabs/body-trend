import { useEffect, useState } from 'react';
import { todayString } from '../lib/date';

/** 日付が変わったとき（アプリを開いたままでも、復帰時でも）に更新される「今日」 */
export function useToday(): string {
  const [today, setToday] = useState(todayString);
  useEffect(() => {
    const update = () => setToday(todayString());
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    const timer = window.setInterval(update, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
      window.clearInterval(timer);
    };
  }, []);
  return today;
}

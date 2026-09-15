import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { catalogSchema, dailySchema } from '@sidequest/contracts';
import { getBeijingDate } from '@sidequest/domain';
import { useLocation } from 'react-router';
import { LocalDatabase } from '../data/database';
import { getOrCreateLocalProfile } from '../data/local-profile';
import { QuestService } from '../services/quests';

export const db = new LocalDatabase('sidequest-local', {
  onBlocked: () => window.dispatchEvent(new Event('sidequest-storage-blocked')),
  onVersionChange: () => window.dispatchEvent(new Event('sidequest-storage-changed')),
});
const Context = createContext<{
  service: QuestService;
  refresh: () => Promise<void>;
  network: string;
  now: number;
} | null>(null);
export function useRuntime() {
  const value = useContext(Context);
  if (!value) throw new Error('Storage not ready');
  return value;
}
const visitId = crypto.randomUUID();
export function usePageEvent(name: 'home_view' | 'profile_view' | 'daily_quest_view') {
  const { service } = useRuntime();
  const { key } = useLocation();
  useEffect(() => {
    void service.recordView(name, `${visitId}:${key}:${name}`).catch(() => {
      /* Statistics never block navigation. */
    });
  }, [service, key, name]);
}
export function RuntimeProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<string>();
  const profile = useLiveQuery(() => db.profiles.get('local'));
  const [error, setError] = useState('');
  const [network, setNetwork] = useState('正在获取任务…');
  const [now, setNow] = useState(() => Date.now());
  const service = useMemo(
    () => (identity ? new QuestService(db, identity) : undefined),
    [identity],
  );
  useEffect(() => {
    getOrCreateLocalProfile(db)
      .then((value) => setIdentity(value.id))
      .catch((cause: Error) => setError(cause.message));
    const changed = () => setError('数据库版本已更新，请保存尚未提交的内容并刷新。');
    const blocked = () => setError('数据库升级被旧页面阻塞，请关闭其他人生支线页面后刷新。');
    window.addEventListener('sidequest-storage-changed', changed);
    window.addEventListener('sidequest-storage-blocked', blocked);
    return () => {
      window.removeEventListener('sidequest-storage-changed', changed);
      window.removeEventListener('sidequest-storage-blocked', blocked);
    };
  }, []);
  useEffect(() => {
    if (profile && identity && profile.id !== identity)
      setError('本地数据已重置，请刷新页面后继续。');
  }, [profile, identity]);
  async function refresh() {
    if (!service) return;
    const root =
      (import.meta.env.VITE_PUBLIC_API_URL as string | undefined)?.replace(/\/$/, '') ??
      'http://127.0.0.1:3000';
    try {
      const response = await fetch(`${root}/api/public/catalog`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('任务服务暂不可用');
      const catalog = catalogSchema.parse(await response.json());
      // A daily endpoint outage must not prevent a fresh safety withdrawal from being applied.
      await service.cache(catalog);
      const dailyResponse = await fetch(`${root}/api/public/daily`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });
      if (dailyResponse.ok)
        await service.cache(catalog, dailySchema.parse(await dailyResponse.json()));
      setNetwork(
        dailyResponse.ok ? '内容已同步；个人记录仅保存在本机' : '任务已同步，今日排期暂不可用',
      );
    } catch {
      setNetwork('暂未连接内容服务；仅可使用有效缓存，已有存档仍可查看。');
    }
  }
  useEffect(() => {
    if (!service) return;
    const reconcile = () =>
      void service.reconcile().catch((cause: Error) => setError(cause.message));
    const resume = () => {
      reconcile();
      void refresh();
    };
    const visibility = () => {
      if (document.visibilityState === 'visible') resume();
    };
    resume();
    let previousDate = getBeijingDate(new Date());
    const timer = window.setInterval(() => {
      setNow(Date.now());
      reconcile();
      const date = getBeijingDate(new Date());
      if (date !== previousDate) {
        previousDate = date;
        void refresh();
      }
    }, 1000);
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', visibility);
    };
    // Service changes only when the persisted identity changes.
  }, [service]);
  if (error)
    return (
      <section className="intro">
        <h1>本地存储需要处理</h1>
        <p role="alert">{error}</p>
        <p>不会自动清除你的记录。</p>
        <button onClick={() => location.reload()}>重试／刷新</button>
      </section>
    );
  if (!service) return <p role="status">正在打开本地存档…</p>;
  return <Context.Provider value={{ service, refresh, network, now }}>{children}</Context.Provider>;
}

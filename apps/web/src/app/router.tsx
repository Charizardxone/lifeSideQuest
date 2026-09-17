import { createBrowserRouter, Link, NavLink, Outlet, useLocation } from 'react-router';
import { useEffect, useRef } from 'react';
import { RuntimeProvider } from './runtime';
import { PwaUpdate } from './pwa';
import { StatisticsPage } from './statistics';
import {
  ArchiveDetail,
  ArchivePage,
  DailyPage,
  Empty,
  ExecutionPage,
  HomePage,
  LibraryPage,
  MyQuests,
  ProfilePage,
  QuestDetail,
  SettingsPage,
} from './pages';

function AppLayout() {
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current !== pathname) {
      main.current?.focus();
      previousPath.current = pathname;
    }
  }, [pathname]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        跳至主要内容
      </a>
      <header className="site-header">
        <Link className="brand" to="/" aria-label="人生支线首页">
          人生支线 <span>SideQuest</span>
        </Link>
        <nav aria-label="主导航">
          <NavLink to="/" end>
            发现
          </NavLink>
          <NavLink to="/quests">我的支线</NavLink>
          <NavLink to="/profile">角色卡</NavLink>
          <NavLink to="/settings">设置</NavLink>
        </nav>
      </header>
      <main id="main" ref={main} tabIndex={-1}>
        <PwaUpdate />
        <RuntimeProvider>
          <Outlet />
        </RuntimeProvider>
      </main>
      <footer>一件小事，也可以成为值得记住的一天。</footer>
    </div>
  );
}
export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: (
      <section className="intro">
        <h1>页面暂时无法打开</h1>
        <p>请重试，不会自动删除本地记录。</p>
        <button onClick={() => location.reload()}>刷新</button>
      </section>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'library', element: <LibraryPage /> },
      { path: 'quests', element: <MyQuests /> },
      { path: 'quests/:questId', element: <QuestDetail /> },
      { path: 'executions/:id', element: <ExecutionPage /> },
      { path: 'archive', element: <ArchivePage /> },
      { path: 'archive/:completionId', element: <ArchiveDetail /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'daily', element: <DailyPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'stats', element: <StatisticsPage /> },
      { path: '*', element: <Empty title="这一页不在地图上" /> },
    ],
  },
]);

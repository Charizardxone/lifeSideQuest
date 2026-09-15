import { useRegisterSW } from 'virtual:pwa-register/react';
export function PwaUpdate() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh && !offlineReady) return null;
  return (
    <aside className="notice" role="status">
      <p>
        {needRefresh
          ? '新版本已准备好。请先保存未提交的记录，再刷新。'
          : '应用外壳已可离线使用；任务仍受缓存有效期限制。'}
      </p>
      {needRefresh && (
        <button onClick={() => void updateServiceWorker(true)}>已保存，刷新版本</button>
      )}
      <button
        className="secondary"
        onClick={() => {
          setNeedRefresh(false);
          setOfflineReady(false);
        }}
      >
        稍后
      </button>
    </aside>
  );
}

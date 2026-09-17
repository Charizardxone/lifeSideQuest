import { useEffect, useState } from 'react';
import { db, useRuntime } from './runtime';
import { useAction } from './components';
import { importArchive, previewArchive, readArchive } from '../services/import';
import type { ImportPreview, PreparedArchive } from '../services/import';

const resultKey = 'sidequest-import-success';
export function ArchiveImport() {
  const { service } = useRuntime();
  const action = useAction();
  const [prepared, setPrepared] = useState<PreparedArchive>();
  const [preview, setPreview] = useState<ImportPreview>();
  const [confirmed, setConfirmed] = useState(false);
  const [success, setSuccess] = useState(() => {
    try {
      return sessionStorage.getItem(resultKey) === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.removeItem(resultKey);
    } catch {
      /* Optional success notice only. */
    }
  }, []);
  const [filename, setFilename] = useState('');
  const [inputKey, setInputKey] = useState(0);
  return (
    <section aria-label="导入私人存档">
      <h2>导入私人存档</h2>
      <p>选择此前导出的 ZIP 备份（最多 64MB）。文件只在本机读取，不会上传。</p>
      <p className="muted">
        导入会替换当前全部个人记录。请先导出需要保留的数据；不在备份里的任务、存档和照片将被删除。
      </p>
      <label>
        选择人生支线 ZIP 备份
        <input
          key={inputKey}
          type="file"
          accept=".zip,application/zip"
          disabled={action.busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            setPrepared(undefined);
            setPreview(undefined);
            setSuccess(false);
            setConfirmed(false);
            setFilename(file?.name ?? '');
            if (file)
              void action.run(async () => {
                const archive = await readArchive(file);
                const summary = await previewArchive(db, archive, service.profileId);
                setPrepared(archive);
                setPreview(summary);
              });
          }}
        />
      </label>
      {action.busy && <p role="status">正在校验或保存备份，请稍候…</p>}
      {prepared && preview && (
        <div className="import-preview">
          <h3>导入预览</h3>
          <p className="record-note">{filename}</p>
          <p>导出时间：{new Date(prepared.exportedAt).toLocaleString('zh-CN')}</p>
          <p>
            当前将被替换：{preview.current.quests} 条任务、{preview.current.completions}{' '}
            条完成存档、{preview.current.photos} 张照片、{preview.current.favorites} 条想做，
            {preview.current.xp} XP。
          </p>
          <p>
            备份将恢复：{preview.backup.quests} 条任务、{preview.backup.completions} 条完成存档、
            {preview.backup.photos} 张照片、{preview.backup.favorites} 条想做，{preview.backup.xp}{' '}
            XP。
          </p>
          <p className="muted">
            奖励按备份恢复，不叠加发奖。过期的今日支线自动归入已放弃；已知安全下架任务不会恢复为进行中。公共任务缓存保留。
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={action.busy}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            我确认用此备份替换全部个人记录，已导出需要保留的数据
          </label>
          <button
            className="danger"
            disabled={action.busy || !confirmed}
            onClick={() =>
              void action.run(async () => {
                await importArchive(db, prepared, service.profileId, preview);
                // Rotate the local identity so old tabs cannot write into the restored archive.
                try {
                  sessionStorage.setItem(resultKey, '1');
                } catch {
                  /* Restore is already committed. */
                }
                location.reload();
              })
            }
          >
            确认替换并导入
          </button>
          <button
            className="secondary"
            disabled={action.busy}
            onClick={() => {
              setPrepared(undefined);
              setPreview(undefined);
              setConfirmed(false);
              setFilename('');
              setInputKey((key) => key + 1);
            }}
          >
            取消导入
          </button>
        </div>
      )}
      {success && <p role="status">导入成功，个人记录已按备份恢复。公共任务缓存已保留。</p>}
      {action.error && (
        <p role="alert">{action.error} 此次导入未更改个人记录，可重新选择备份或重试。</p>
      )}
    </section>
  );
}

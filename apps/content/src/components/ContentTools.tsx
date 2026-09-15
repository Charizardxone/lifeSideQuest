'use client';

import { useState } from 'react';

export function ContentTools() {
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  async function validateOrImport(dryRun: boolean) {
    setBusy(true);
    setMessage('');
    try {
      const input = JSON.parse(text);
      const response = await fetch('/api/ops/quests/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, dryRun }),
      });
      const result = await response.json();
      if (!response.ok) {
        setChecked(false);
        setMessage(JSON.stringify(result, null, 2));
        return;
      }
      setChecked(dryRun);
      setMessage(
        dryRun
          ? `校验通过，共 ${result.count} 条。确认后只会创建草稿，不会发布。`
          : `已创建 ${result.ids.length} 条草稿，请进入任务库复核。`,
      );
      if (!dryRun) setText('');
    } catch {
      setChecked(false);
      setMessage('读取或请求失败，请检查 JSON 格式后重试。');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      style={{
        margin: '24px 0',
        padding: 24,
        border: '1px solid var(--theme-elevation-200)',
        borderRadius: 8,
      }}
    >
      <h2>任务内容工具</h2>
      <p>
        先建立草稿，再完成安全和体验复核，最后发布。JSON 导入最大 1MB / 500 条，不接受指定
        ID，不覆盖已有任务。
      </p>
      <p>
        <a href="/api/ops/quests/template" target="_blank" rel="noreferrer">
          查看导入模板
        </a>{' '}
        · <a href="/api/ops/quests/export">导出任务内容 JSON</a>
      </p>
      <label>
        选择 JSON 文件{' '}
        <input
          type="file"
          accept="application/json,.json"
          disabled={busy}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            setChecked(false);
            if (!file) return;
            if (file.size > 1024 * 1024) {
              setMessage('文件最多 1MB');
              return;
            }
            setText(await file.text());
          }}
        />
      </label>
      <p>
        <button type="button" disabled={!text || busy} onClick={() => void validateOrImport(true)}>
          校验文件
        </button>{' '}
        <button
          type="button"
          disabled={!checked || busy}
          onClick={() => void validateOrImport(false)}
        >
          确认导入为新草稿
        </button>
      </p>
      {message && (
        <pre role="status" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {message}
        </pre>
      )}
    </section>
  );
}

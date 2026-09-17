import { useState } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ATTRIBUTES, ATTRIBUTE_LABELS } from '@sidequest/contracts';
import type { UserQuest } from '../data/models';
import { db, useRuntime } from './runtime';
import { QuestCard, RecordForm, useAction } from './components';

export function Avatar() {
  return <span className="avatar" role="img" aria-label="背着背包的像素冒险者" />;
}
export function Adventurer() {
  const { service } = useRuntime();
  const growth = useLiveQuery(() => service.growth(), [service]);
  return (
    <div className="adventurer">
      <Avatar />
      <div>
        <span className="eyebrow">生活冒险者</span>
        <strong className="level">Lv. {growth?.level ?? 1}</strong>
        <progress aria-label="等级经验" max={1} value={growth?.progress ?? 0} />
        <small>
          {growth?.totalXp ?? 0} XP · 下一等级还需 {growth?.xpToNextLevel ?? 50} XP
        </small>
      </div>
      <Link className="quiet-link" to="/settings" aria-label="打开设置">
        设置
      </Link>
    </div>
  );
}
export function CompletionPanel({ id, next }: { id: string; next?: () => void }) {
  const { service } = useRuntime();
  const record = useLiveQuery(() => db.completions.get(id), [id]);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  if (!record) return <p role="status">正在读取已保存的奖励…</p>;
  return (
    <section className="completion-panel" aria-label="完成反馈">
      <p className="eyebrow">QUEST COMPLETE / 经历已存档</p>
      <h2>支线完成，带一点收获回家。</h2>
      <p className="reward-total" role="status">
        已完成 · +{record.reward.xp} XP
      </p>
      <p>
        {ATTRIBUTES.filter((a) => record.reward.attributes[a] > 0)
          .map((a) => `${ATTRIBUTE_LABELS[a]} +${record.reward.attributes[a]}`)
          .join(' · ')}
      </p>
      <p className="muted">奖励已保存。记录可以晚点写，完成后不可撤销。</p>
      <div className="actions">
        <button className="secondary" onClick={() => setEditing(!editing)} aria-expanded={editing}>
          记一句 / 添加照片
        </button>
        {next ? (
          <button onClick={next}>发现下一条</button>
        ) : (
          <Link className="button" to="/">
            发现下一条
          </Link>
        )}
        <Link className="quiet-link" to={`/archive/${id}`}>
          查看存档
        </Link>
      </div>
      {editing && (
        <RecordForm
          key={record.id}
          initialNote={record.note}
          initialCity={record.city}
          {...(record.photoId ? { existingPhotoId: record.photoId } : {})}
          submitLabel="保存记录"
          submit={async (note, city, photo) => {
            setSaved(false);
            await service.saveRecord(id, note, city, photo);
            setSaved(true);
          }}
        />
      )}
      {saved && <p role="status">记录已保存，奖励保持不变。</p>}
    </section>
  );
}
export function ActivePanel({
  quest,
  onComplete,
  compact = false,
}: {
  quest: UserQuest;
  onComplete?: (id: string) => void;
  compact?: boolean;
}) {
  const { service } = useRuntime();
  const action = useAction();
  const [operationId] = useState(() => crypto.randomUUID());
  return (
    <div className="active-panel">
      {!compact && <QuestCard quest={quest.snapshot} detail />}
      <div className="task-controls">
        <button
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              const id = await service.complete(quest.id, operationId, { note: '', city: '' });
              onComplete?.(id);
            })
          }
        >
          {action.busy ? '正在保存…' : '我完成了'}
        </button>
        <button
          className="quiet"
          disabled={action.busy}
          onClick={() => {
            if (window.confirm('放弃这次支线？不会扣除已有奖励。'))
              void action.run(() => service.abandon(quest.id, crypto.randomUUID()));
          }}
        >
          放弃这次支线
        </button>
      </div>
      <p className="muted completion-rule">完成即保存奖励，不可撤销；文字和照片可在完成后补充。</p>
      {action.error && <p role="alert">{action.error} 未保存成功，请重试。</p>}
    </div>
  );
}

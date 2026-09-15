import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ATTRIBUTE_LABELS,
  ATTRIBUTES,
  QUEST_CATEGORY_LABELS,
  noteLength,
} from '@sidequest/contracts';
import type { QuestSnapshot } from '@sidequest/contracts';
import type { Photo } from '../data/models';
import { preparePhoto } from '../services/photos';
import { db, useRuntime } from './runtime';

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(work: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败，请重试。');
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}
export function QuestCard({ quest, detail = false }: { quest: QuestSnapshot; detail?: boolean }) {
  const { service } = useRuntime();
  const favorite = useLiveQuery(() => db.favorites.get(quest.questId), [quest.questId]);
  const action = useAction();
  return (
    <article className="card">
      <p className="eyebrow">
        {QUEST_CATEGORY_LABELS[quest.category]} · {'★'.repeat(quest.rewards.difficulty)}
      </p>
      <h2>
        {detail ? (
          quest.title
        ) : (
          <Link to={`/quests/${encodeURIComponent(quest.questId)}`}>{quest.title}</Link>
        )}
      </h2>
      <p>{quest.subtitle}</p>
      <ul className="tags">
        {[quest.duration, quest.budget, quest.people, quest.indoorOutdoor].map((tag, i) => (
          <li key={i}>{tag}</li>
        ))}
      </ul>
      <p className="safety">安全提醒：{quest.safetyNotes}</p>
      <p>
        基础奖励：{quest.rewards.xp} XP ·{' '}
        {ATTRIBUTES.filter((a) => quest.rewards.attributes[a] > 0)
          .map((a) => `${ATTRIBUTE_LABELS[a]} +${quest.rewards.attributes[a]}`)
          .join(' / ')}
      </p>
      {detail && (
        <>
          <p>{quest.description}</p>
          <ol>
            {quest.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <p>
            时段：{quest.timeOfDay} · 环境：{quest.environment}
          </p>
          <p>准备：{quest.preparation || '无需额外准备'}</p>
          <p>重复完成奖励递减至基础值的 50%、25%、10%；经验与正属性最低 1。</p>
        </>
      )}
      <button
        className="secondary"
        disabled={action.busy}
        onClick={() => void action.run(() => service.favorite(quest.questId, !favorite))}
      >
        {favorite ? '移除想做' : '加入想做'}
      </button>
      {action.error && <p role="alert">{action.error}</p>}
    </article>
  );
}
export function PhotoView({ photoId }: { photoId: string }) {
  const photo = useLiveQuery(() => db.photos.get(photoId), [photoId]);
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!photo) return;
    const value = URL.createObjectURL(photo.blob);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [photo]);
  return url ? (
    <img className="record-photo" src={url} alt="这次经历的私人照片" loading="lazy" />
  ) : null;
}
export function RecordForm({
  initialNote = '',
  initialCity = '',
  existingPhotoId,
  submit,
  submitLabel,
}: {
  initialNote?: string;
  initialCity?: string;
  existingPhotoId?: string;
  submit: (note: string, city: string, photo: Photo | null | undefined) => Promise<unknown>;
  submitLabel: string;
}) {
  const [note, setNote] = useState(initialNote);
  const [city, setCity] = useState(initialCity);
  const [photo, setPhoto] = useState<Photo | null>();
  const action = useAction();
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void action.run(async () => {
          await submit(note, city, photo);
          setPhoto(undefined);
          setDirty(false);
        });
      }}
    >
      <label>
        一句记录（可跳过）
        <textarea
          rows={4}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setDirty(true);
          }}
        />
      </label>
      <p aria-live="polite">{noteLength(note)} / 300 个可见字符</p>
      <label>
        城市（可跳过，不获取定位）
        <input
          value={city}
          onChange={(e) => {
            setCity(e.target.value);
            setDirty(true);
          }}
        />
      </label>
      <label>
        照片（可跳过，仅保存在本机）
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={action.busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file)
              void action.run(async () => {
                setPhoto(await preparePhoto(file));
                setDirty(true);
              });
          }}
        />
      </label>
      <p>一张照片；JPEG / PNG / WebP，原图最多 10MB。</p>
      {photo ? (
        <p>已准备照片，{Math.ceil(photo.size / 1024)} KB</p>
      ) : photo === undefined && existingPhotoId ? (
        <PhotoView photoId={existingPhotoId} />
      ) : null}
      {(photo || existingPhotoId) && (
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setPhoto(null);
            setDirty(true);
          }}
        >
          移除照片
        </button>
      )}
      {action.error && <p role="alert">{action.error}</p>}
      <button disabled={action.busy || noteLength(note) > 300}>
        {action.busy ? '正在保存…' : submitLabel}
      </button>
    </form>
  );
}

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ATTRIBUTES,
  ATTRIBUTE_LABELS,
  QUEST_CATEGORIES,
  QUEST_CATEGORY_LABELS,
  dailyHistorySchema,
} from '@sidequest/contracts';
import type { QuestSnapshot } from '@sidequest/contracts';
import { getBeijingDate } from '@sidequest/domain';
import { db, usePageEvent, useRuntime } from './runtime';
import { PhotoView, QuestCard, RecordForm, useAction } from './components';
import { recommend, restartRecommendations } from '../services/recommendations';
import { deletePersonalData, exportArchive } from '../services/export';

const formatDate = (value: string) => new Date(value).toLocaleString('zh-CN');
const statusLabels = { in_progress: '进行中', completed: '已完成', abandoned: '已放弃' };
export function HomePage() {
  const { network, refresh, service } = useRuntime();
  usePageEvent('home_view');
  const action = useAction();
  const catalog = useLiveQuery(() => db.catalog.get('catalog'));
  const active = useLiveQuery(() => db.quests.where('status').equals('in_progress').toArray());
  const [selected, setSelected] = useState<QuestSnapshot>();
  const [exhausted, setExhausted] = useState(false);
  const [category, setCategory] = useState('');
  const valid = catalog && Date.parse(catalog.expiresAt) > Date.now();
  return (
    <section className="page">
      <div className="hero">
        {active?.map((quest) => (
          <p className="notice" key={quest.id}>
            正在进行：<Link to={`/executions/${quest.id}`}>{quest.snapshot.title}</Link>（
            {quest.source.kind === 'daily' ? '今日' : '普通'}支线）
          </p>
        ))}
        <p className="eyebrow">日常之外，还有支线</p>
        <h1>
          给今天留一点
          <br />
          意料之外。
        </h1>
        <p className="description">发现一件现实中的小事，去体验，再记下属于你的故事。</p>
        <div className="actions">
          <button
            disabled={!valid || !catalog.tasks.length}
            onClick={() =>
              void action.run(async () => {
                if (!catalog || Date.parse(catalog.expiresAt) <= Date.now())
                  throw new Error('任务缓存已过期，请刷新。');
                const requestId = crypto.randomUUID();
                void service.recordView('recommend_request', requestId).catch(() => {});
                if (selected)
                  void service
                    .recordView('quest_reroll', `${requestId}:reroll`, selected.questId)
                    .catch(() => {});
                const quest = recommend(catalog.tasks, sessionStorage);
                if (quest)
                  void service
                    .recordView('quest_impression', `${requestId}:impression`, quest.questId)
                    .catch(() => {});
                setSelected(quest ?? undefined);
                setExhausted(!quest);
              })
            }
          >
            {selected ? '换一个' : '随机一条支线'}
          </button>
          <Link className="button secondary" to="/daily">
            看看今日支线
          </Link>
        </div>
        <p className="muted" role="status">
          {network}
        </p>
        <button
          className="secondary"
          disabled={action.busy}
          onClick={() => void action.run(refresh)}
        >
          刷新任务库
        </button>
        {!valid && <p className="notice">暂无有效任务缓存，请联网刷新。已有支线和存档仍可使用。</p>}
        {valid && !catalog.tasks.length && <p>暂无已发布内容，请先在运营后台审核发布任务。</p>}
        {action.error && <p role="alert">{action.error}</p>}
        {exhausted && (
          <div className="notice">
            <p>这一轮已经全部看过了。</p>
            <button
              onClick={() => {
                restartRecommendations(sessionStorage);
                setExhausted(false);
              }}
            >
              开启新一轮
            </button>
          </div>
        )}
      </div>
      {selected && valid && catalog.tasks.some((task) => task.versionId === selected.versionId) && (
        <QuestCard quest={selected} />
      )}
      <h2>按兴趣逛逛</h2>
      <div className="actions">
        <button className="secondary" aria-pressed={!category} onClick={() => setCategory('')}>
          全部
        </button>
        {QUEST_CATEGORIES.map((item) => (
          <button
            className="secondary"
            aria-pressed={category === item}
            key={item}
            onClick={() => setCategory(item)}
          >
            {QUEST_CATEGORY_LABELS[item]}
          </button>
        ))}
      </div>
      <div className="grid">
        {valid &&
          catalog.tasks
            .filter((task) => !category || task.category === category)
            .map((task) => <QuestCard key={task.questId} quest={task} />)}
      </div>
    </section>
  );
}
export function QuestDetail() {
  const { questId = '' } = useParams();
  const { service } = useRuntime();
  const navigate = useNavigate();
  const action = useAction();
  const task = useLiveQuery(
    async () => (await db.catalog.get('catalog'))?.tasks.find((quest) => quest.questId === questId),
    [questId],
  );
  if (!task) return <Empty title="任务暂不可用" />;
  return (
    <section className="page">
      <QuestCard quest={task} detail />
      <button
        disabled={action.busy}
        onClick={() =>
          void action.run(async () => {
            const id = await service.accept(questId, { kind: 'ordinary' }, crypto.randomUUID());
            void navigate(`/executions/${id}`);
          })
        }
      >
        接取普通支线
      </button>
      {action.error && <p role="alert">{action.error}</p>}
    </section>
  );
}
export function MyQuests() {
  const [tab, setTab] = useState('in_progress');
  const quests = useLiveQuery(() => db.quests.orderBy('acceptedAt').reverse().toArray());
  const favorites = useLiveQuery(() => db.favorites.orderBy('createdAt').reverse().toArray());
  return (
    <section className="page">
      <h1>我的支线</h1>
      <p>普通支线最多一条进行中；今日支线独立，不占普通名额。</p>
      <div className="actions">
        {[...Object.entries(statusLabels), ['favorites', '想做']].map(([key, label]) => (
          <button
            key={key}
            className="secondary"
            aria-pressed={tab === key}
            onClick={() => setTab(key ?? '')}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'favorites' ? (
        <div className="grid">
          {favorites?.map((item) => (
            <QuestCard key={item.questId} quest={item.snapshot} />
          ))}
          {!favorites?.length && <p>还没有想做的支线。</p>}
        </div>
      ) : (
        <div className="grid">
          {quests
            ?.filter((quest) => quest.status === tab)
            .map((quest) => (
              <article className="card" key={quest.id}>
                <p>
                  {quest.source.kind === 'daily' ? '今日支线' : '普通支线'} ·{' '}
                  {statusLabels[quest.status]}
                </p>
                <h2>
                  <Link to={`/executions/${quest.id}`}>{quest.snapshot.title}</Link>
                </h2>
                <p>接取于 {formatDate(quest.acceptedAt)}</p>
                {quest.endReason === 'expired' && <p>已过期，自动放弃</p>}
                {quest.endReason === 'safety' && <p>因安全原因下架，自动放弃</p>}
              </article>
            ))}
          {!quests?.some((quest) => quest.status === tab) && (
            <p>
              这里还没有记录。<Link to="/">去发现一条支线</Link>
            </p>
          )}
        </div>
      )}
      <Link className="text-link" to="/archive">
        查看人生存档
      </Link>
    </section>
  );
}
export function ExecutionPage() {
  const { id = '' } = useParams();
  const { service } = useRuntime();
  const navigate = useNavigate();
  const action = useAction();
  const quest = useLiveQuery(() => db.quests.get(id), [id]);
  const completion = useLiveQuery(
    () => db.completions.where('userQuestId').equals(id).first(),
    [id],
  );
  const [operationId] = useState(() => crypto.randomUUID());
  if (!quest) return <Empty title="执行记录不存在" />;
  return (
    <section className="page">
      <h1>{quest.snapshot.title}</h1>
      <p>
        {quest.source.kind === 'daily'
          ? `今日支线 · ${quest.source.businessDate} 当天有效`
          : '普通支线'}{' '}
        · {statusLabels[quest.status]}
      </p>
      <QuestCard quest={quest.snapshot} detail />
      {quest.status === 'in_progress' ? (
        <>
          <h2>记下这次经历</h2>
          <p>文字和图片均可跳过。完成后不可撤销。</p>
          <RecordForm
            submitLabel="确认完成（不可撤销）"
            submit={async (note, city, photo) => {
              const completionId = await service.complete(id, operationId, {
                note,
                city,
                ...(photo ? { photo } : {}),
              });
              void navigate(`/archive/${completionId}`);
            }}
          />
          <button
            className="secondary"
            disabled={action.busy}
            onClick={() => {
              if (window.confirm('放弃这次支线？不会扣除已有奖励。'))
                void action.run(() => service.abandon(id, crypto.randomUUID()));
            }}
          >
            放弃这次支线
          </button>
        </>
      ) : (
        <p>
          {quest.endReason === 'expired'
            ? '今日支线已过期，自动放弃；没有发奖或增加完成次数。'
            : quest.endReason === 'safety'
              ? '任务因安全原因被下架，已自动放弃。'
              : '这次执行已经结束，可以重新接取新的一次体验。'}
        </p>
      )}
      {completion && (
        <Link className="button" to={`/archive/${completion.id}`}>
          查看完成存档
        </Link>
      )}
      {action.error && <p role="alert">{action.error}</p>}
    </section>
  );
}
export function ArchivePage() {
  const records = useLiveQuery(async () =>
    Promise.all(
      (await db.completions.orderBy('completedAt').reverse().toArray()).map(async (record) => ({
        record,
        quest: await db.quests.get(record.userQuestId),
      })),
    ),
  );
  const [category, setCategory] = useState('');
  const [month, setMonth] = useState('');
  return (
    <section className="page">
      <h1>人生存档</h1>
      <div className="actions">
        <label>
          类别
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">全部</option>
            {QUEST_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {QUEST_CATEGORY_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label>
          完成月份
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
      </div>
      <div className="grid">
        {records
          ?.filter(
            ({ quest, record }) =>
              (!category || quest?.snapshot.category === category) &&
              (!month || getBeijingDate(new Date(record.completedAt)).startsWith(month)),
          )
          .map(({ record, quest }) => (
            <article className="card" key={record.id}>
              <h2>
                <Link to={`/archive/${record.id}`}>{quest?.snapshot.title ?? '支线存档'}</Link>
              </h2>
              <p>
                {formatDate(record.completedAt)} · +{record.reward.xp} XP
              </p>
              <p className="record-note">{record.note || '这次经历，即使没有文字也值得记住。'}</p>
              {record.photoId && <PhotoView photoId={record.photoId} />}
            </article>
          ))}
      </div>
      {!records?.length && <p>完成第一条支线后，会在这里留下你的经历。</p>}
    </section>
  );
}
export function ArchiveDetail() {
  const { completionId = '' } = useParams();
  const { service } = useRuntime();
  const [saved, setSaved] = useState(false);
  const record = useLiveQuery(() => db.completions.get(completionId), [completionId]);
  const quest = useLiveQuery(
    async () => (record ? db.quests.get(record.userQuestId) : undefined),
    [record?.userQuestId],
  );
  if (!record || !quest) return <Empty title="存档不存在" />;
  return (
    <section className="page">
      <h1>{quest.snapshot.title}</h1>
      <p className="success">
        已完成 · +{record.reward.xp} XP · 第 {record.reward.previousCompletionCount + 1}{' '}
        次完成此任务
      </p>
      <p>{formatDate(record.completedAt)}</p>
      <p>
        {ATTRIBUTES.filter((attribute) => record.reward.attributes[attribute] > 0)
          .map(
            (attribute) => `${ATTRIBUTE_LABELS[attribute]} +${record.reward.attributes[attribute]}`,
          )
          .join(' · ')}
      </p>
      <h2>补充你的记录</h2>
      <p>编辑不会更改完成时间或重新发奖。</p>
      <RecordForm
        key={record.id}
        initialNote={record.note}
        initialCity={record.city}
        {...(record.photoId ? { existingPhotoId: record.photoId } : {})}
        submitLabel="保存记录"
        submit={async (note, city, photo) => {
          await service.saveRecord(record.id, note, city, photo);
          setSaved(true);
        }}
      />
      {saved && <p role="status">记录已保存。</p>}
      <details>
        <summary>查看当时任务快照</summary>
        <QuestCard quest={quest.snapshot} detail />
      </details>
      <Link className="text-link" to="/profile">
        查看成长
      </Link>
    </section>
  );
}
export function ProfilePage() {
  usePageEvent('profile_view');
  const { service } = useRuntime();
  const growth = useLiveQuery(() => service.growth(), [service]);
  if (!growth) return <p>读取成长记录…</p>;
  const max = Math.max(1, ...Object.values(growth.attributes));
  const point = (index: number, ratio: number) => {
    const angle = (index * Math.PI) / 3 - Math.PI / 2;
    return `${150 + Math.cos(angle) * 100 * ratio},${150 + Math.sin(angle) * 100 * ratio}`;
  };
  return (
    <section className="page">
      <h1>六边形角色卡</h1>
      <p className="stat">
        Lv. {growth.level}{' '}
        <span>
          {growth.totalXp} XP · {growth.completed} 次完成
        </span>
      </p>
      <progress max={1} value={growth.progress} />
      <p>距离下一级还需 {growth.xpToNextLevel} XP</p>
      <svg
        className="radar"
        viewBox="0 0 300 300"
        role="img"
        aria-label="六维经历相对分布，具体数值见下方列表"
      >
        <polygon
          points={ATTRIBUTES.map((_, i) => point(i, 1)).join(' ')}
          fill="none"
          stroke="#8c9c75"
        />
        <polygon
          points={ATTRIBUTES.map((attribute, i) =>
            point(i, growth.attributes[attribute] / max),
          ).join(' ')}
          fill="#8c9c7580"
          stroke="#243e35"
        />
        {ATTRIBUTES.map((attribute, i) => {
          const [x, y] = point(i, 1.27).split(',');
          return (
            <text
              key={attribute}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="12"
            >
              {ATTRIBUTE_LABELS[attribute]}
            </text>
          );
        })}
      </svg>
      <dl className="attribute-list">
        {ATTRIBUTES.map((attribute) => (
          <div key={attribute}>
            <dt>{ATTRIBUTE_LABELS[attribute]}</dt>
            <dd>{growth.attributes[attribute]}</dd>
          </div>
        ))}
      </dl>
      <p>
        {growth.completed < 3 ? '数据形成中，先去体验几件小事。' : '图形展示各项经历的相对分布。'}{' '}
        属性仅代表经历倾向，不是人格、智力、健康或能力评价。
      </p>
      <Link className="text-link" to="/archive">
        查看所有存档
      </Link>
    </section>
  );
}
export function DailyPage() {
  usePageEvent('daily_quest_view');
  const { service, refresh } = useRuntime();
  const navigate = useNavigate();
  const action = useAction();
  const daily = useLiveQuery(() => db.daily.get('daily'));
  const today = getBeijingDate(new Date());
  const claim = useLiveQuery(() => db.claims.get(today), [today]);
  const [history, setHistory] = useState<Array<{ businessDate: string; snapshot: QuestSnapshot }>>(
    [],
  );
  const [historyPage, setHistoryPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  return (
    <section className="page">
      <h1>今日支线</h1>
      <p>{today} · 北京时间 · 仅当天可完成，过期自动放弃</p>
      <p>不占普通支线名额；同一任务共用递减次数，每天最多领取一次今日奖励。</p>
      {daily?.businessDate === today && daily.snapshot ? (
        <>
          <QuestCard quest={daily.snapshot} detail />
          <button
            disabled={action.busy || Boolean(claim)}
            onClick={() =>
              void action.run(async () => {
                if (!daily.snapshot) return;
                const id = await service.accept(
                  daily.snapshot.questId,
                  { kind: 'daily', businessDate: today, dailyId: daily.dailyId },
                  crypto.randomUUID(),
                );
                void navigate(`/executions/${id}`);
              })
            }
          >
            {claim ? '今日奖励已领取' : '接取今日支线'}
          </button>
        </>
      ) : (
        <p>暂无有效的今日任务，请联网刷新；不会自动用旧任务代替。</p>
      )}
      <button className="secondary" onClick={() => void action.run(refresh)} disabled={action.busy}>
        刷新今日任务
      </button>
      {action.error && <p role="alert">{action.error}</p>}
      <h2>往日支线</h2>
      <p>仅回顾，不补领过去的今日奖励。已完成的私人记录仍在“人生存档”中。</p>
      {history.map((entry) => (
        <div key={entry.businessDate}>
          <h3>{entry.businessDate}</h3>
          <QuestCard quest={entry.snapshot} detail />
        </div>
      ))}
      {hasMore && (
        <button
          className="secondary"
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              const root =
                (import.meta.env.VITE_PUBLIC_API_URL as string | undefined)?.replace(/\/$/, '') ??
                'http://127.0.0.1:3000';
              const response = await fetch(`${root}/api/public/daily/history?page=${historyPage}`, {
                cache: 'no-store',
                signal: AbortSignal.timeout(10000),
              });
              if (!response.ok) throw new Error('历史排期暂不可用，请稍后重试。');
              const result = dailyHistorySchema.parse(await response.json());
              setHistory((old) => [...old, ...result.entries]);
              setHistoryPage(historyPage + 1);
              setHasMore(result.hasNextPage);
            })
          }
        >
          加载往日支线
        </button>
      )}
    </section>
  );
}
export function SettingsPage() {
  const { service } = useRuntime();
  const action = useAction();
  const [confirmation, setConfirmation] = useState(false);
  return (
    <section className="page">
      <h1>设置</h1>
      <p>个人记录和照片仅保存在当前浏览器。清理本站数据会丢失记录，暂不支持云备份或跨设备恢复。</p>
      <h2>导出私人存档</h2>
      <p>ZIP 包含 JSON 数据和照片，含私密信息，请妥善保管；当前不支持导入恢复。</p>
      <button
        disabled={action.busy}
        onClick={() =>
          void action.run(async () => {
            const blob = await exportArchive(db);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `sidequest-${getBeijingDate(new Date())}.zip`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
          })
        }
      >
        导出全部记录
      </button>
      <h2>清除本地个人数据</h2>
      <p>
        删除存档、照片、任务、奖励及本地待发统计事件，重建匿名身份；公共内容缓存保留。删除不可恢复。
      </p>
      <label className="check">
        <input
          type="checkbox"
          checked={confirmation}
          onChange={(e) => setConfirmation(e.target.checked)}
        />
        我理解删除不可恢复，已妥善导出需要的记录
      </label>
      <button
        className="danger"
        disabled={!confirmation || action.busy}
        onClick={() =>
          void action.run(async () => {
            await deletePersonalData(db, service.profileId);
            sessionStorage.removeItem('sidequest-recommendations-v1');
            location.reload();
          })
        }
      >
        确认删除个人数据
      </button>
      <h2>隐私与统计</h2>
      <p>
        首版不上传任何个人统计事件、记录正文、照片或精确位置。统计仅保存在当前浏览器，随个人数据一起导出或删除。
      </p>
      <Link className="text-link" to="/stats">
        查看本地统计
      </Link>
      {action.error && <p role="alert">{action.error}</p>}
    </section>
  );
}
export function Empty({ title }: { title: string }) {
  return (
    <section className="intro">
      <h1>{title}</h1>
      <Link className="text-link" to="/">
        回到发现
      </Link>
    </section>
  );
}

import { useEffect, useState } from 'react';
import { ArchiveImport } from './archive-import';
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
import { restartRecommendations } from '../services/recommendations';
import { deletePersonalData, exportArchive } from '../services/export';
import { ActivePanel, Adventurer, Avatar, CompletionPanel } from './journey';
import {
  currentRecommendation,
  chooseRecommendation,
  clearRecommendation,
} from '../services/recommendations';

const formatDate = (value: string) => new Date(value).toLocaleString('zh-CN');
const statusLabels = { in_progress: '进行中', completed: '已完成', abandoned: '已放弃' };
export function HomePage() {
  const { network, refresh, service, now } = useRuntime();
  usePageEvent('home_view');
  const action = useAction();
  const catalog = useLiveQuery(() => db.catalog.get('catalog'));
  const active = useLiveQuery(() => db.quests.where('status').equals('in_progress').toArray());
  const [selected, setSelected] = useState<string | null>();
  const [activeId, setActiveId] = useState('');
  const [completedId, setCompletedId] = useState('');
  const valid = Boolean(catalog && Date.parse(catalog.expiresAt) > now);
  const current =
    active?.find((q) => q.id === activeId) ??
    active?.find((q) => q.source.kind === 'ordinary') ??
    active?.[0];
  const task = catalog?.tasks.find((q) => q.questId === selected);
  useEffect(() => {
    if (
      !valid ||
      !catalog ||
      active === undefined ||
      current ||
      completedId ||
      selected !== undefined
    )
      return;
    void action.run(async () => {
      const choice = currentRecommendation(catalog.tasks, sessionStorage);
      setSelected(choice?.questId ?? null);
      if (choice) {
        const requestId = crypto.randomUUID();
        void service.recordView('recommend_request', requestId).catch(() => {});
        void service
          .recordView('quest_impression', `${requestId}:impression`, choice.questId)
          .catch(() => {});
      }
    });
  }, [catalog, valid, selected, active, current, completedId]);
  async function pick() {
    if (!catalog || !valid) throw new Error('任务缓存已过期，请联网重试。');
    const requestId = crypto.randomUUID();
    const choice = chooseRecommendation(catalog.tasks, sessionStorage);
    setSelected(choice?.questId ?? null);
    void service.recordView('recommend_request', requestId).catch(() => {});
    if (task)
      void service.recordView('quest_reroll', `${requestId}:reroll`, task.questId).catch(() => {});
    if (choice)
      void service
        .recordView('quest_impression', `${requestId}:impression`, choice.questId)
        .catch(() => {});
  }
  return (
    <section className="page home-page">
      <Adventurer />
      <div className="home-layout">
        <div>
          <div className="section-heading">
            <div>
              <p className="eyebrow">SIDEQUEST / 日常之外</p>
              <h1>
                {completedId ? '今天，多了一段故事' : current ? '进行中的支线' : '你的下一段小冒险'}
              </h1>
            </div>
            <span className="status-tag">
              {completedId ? '已完成' : current ? '进行中' : '推荐中'}
            </span>
          </div>
          <div className="quest-panel">
            <img
              className="town-banner"
              src="/art/town-dusk.png"
              alt="黄昏小镇，书店亮起窗灯，背包旅人正准备出发"
            />
            {completedId ? (
              <CompletionPanel
                key={completedId}
                id={completedId}
                next={() => {
                  setCompletedId('');
                  clearRecommendation(sessionStorage);
                  setSelected(undefined);
                }}
              />
            ) : current ? (
              <>
                <div className="active-switch actions" aria-label="进行中的支线切换">
                  {active?.map((q) => (
                    <button
                      className="secondary"
                      aria-pressed={q.id === current.id}
                      key={q.id}
                      onClick={() => setActiveId(q.id)}
                    >
                      {q.source.kind === 'ordinary' ? '普通支线' : '今日支线'} · {q.snapshot.title}
                    </button>
                  ))}
                </div>
                <ActivePanel key={current.id} quest={current} onComplete={setCompletedId} />
              </>
            ) : valid && task ? (
              <>
                <QuestCard quest={task} detail />
                <div className="task-controls">
                  <button
                    disabled={action.busy}
                    onClick={() =>
                      void action.run(async () => {
                        if (!valid) throw new Error('缓存已过期，请重试同步。');
                        await service.accept(
                          task.questId,
                          { kind: 'ordinary' },
                          crypto.randomUUID(),
                        );
                      })
                    }
                  >
                    接取支线
                  </button>
                  <button
                    className="secondary"
                    disabled={action.busy}
                    onClick={() => void action.run(pick)}
                  >
                    换一条
                  </button>
                </div>
              </>
            ) : (
              <div className="panel-empty">
                <h2>
                  {valid && selected === null && catalog?.tasks.length
                    ? '这一轮已经全部看过了。'
                    : valid && selected
                      ? '这条支线已更新或下架'
                      : '小镇正在准备新的支线'}
                </h2>
                <p>
                  {valid
                    ? '可以浏览任务库，或开启下一轮探索。'
                    : '暂无有效任务缓存，请联网同步。已有支线和存档仍可使用。'}
                </p>
                {valid && Boolean(catalog?.tasks.length) ? (
                  <button
                    disabled={action.busy}
                    onClick={() =>
                      void action.run(async () => {
                        restartRecommendations(sessionStorage);
                        await pick();
                      })
                    }
                  >
                    开启新一轮
                  </button>
                ) : (
                  <button disabled={action.busy} onClick={() => void action.run(refresh)}>
                    重试内容同步
                  </button>
                )}
              </div>
            )}
            {action.error && (
              <p className="panel-error" role="alert">
                {action.error}
              </p>
            )}
          </div>
          <div className="discovery-links">
            <Link to="/daily">
              <span>今日支线</span>
              <small>今天限定的一次小体验</small>
              <b aria-hidden="true">↗</b>
            </Link>
            <Link to="/library">
              <span>浏览任务库</span>
              <small>按兴趣，慢慢逛一逛</small>
              <b aria-hidden="true">↗</b>
            </Link>
          </div>
        </div>
        <aside className="home-aside">
          <p className="eyebrow">TRAVEL NOTES</p>
          <h2>小事，也值得出发。</h2>
          <p>不用做得多么了不起。走一条新路，留意一种颜色，就能为今天添一段故事。</p>
          <div className="aside-line" />
          <Link to="/quests">打开我的任务日志 →</Link>
          <Link to="/profile">看看冒险者档案 →</Link>
          <p className="muted">按自己的节奏，体验真实的生活。</p>
        </aside>
      </div>
      {!valid && (
        <p className="muted" role="status">
          {network}
        </p>
      )}
    </section>
  );
}
export function LibraryPage() {
  const { now } = useRuntime();
  const catalog = useLiveQuery(() => db.catalog.get('catalog'));
  const [category, setCategory] = useState('');
  const valid = catalog && Date.parse(catalog.expiresAt) > now;
  return (
    <section className="page">
      <p className="eyebrow">TOWN NOTICEBOARD</p>
      <h1>任务库</h1>
      <p>挑一件适合此刻的小事。</p>
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
      {(!valid || !catalog.tasks.length) && <Empty title="暂时没有可浏览的任务" />}
      <Link className="text-link" to="/settings">
        内容同步与设置
      </Link>
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
  const [completedId, setCompletedId] = useState('');
  const [tab, setTab] = useState('in_progress');
  const quests = useLiveQuery(() => db.quests.orderBy('acceptedAt').reverse().toArray());
  const favorites = useLiveQuery(() => db.favorites.orderBy('createdAt').reverse().toArray());
  return (
    <section className="page">
      <p className="eyebrow">QUEST JOURNAL</p>
      <h1>我的支线</h1>
      {completedId && <CompletionPanel key={completedId} id={completedId} />}
      <p>普通支线最多一条进行中；今日支线独立，不占普通名额。</p>
      <div className="actions journal-tabs">
        {[
          ['in_progress', '进行中'],
          ['completed', '已完成'],
          ['favorites', '想做'],
          ['abandoned', '历史 · 已放弃'],
        ].map(([key, label]) => (
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
          {!favorites?.length && <Empty title="还没有想做的支线" />}
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
                <p className="muted">接取于 {formatDate(quest.acceptedAt)}</p>
                {quest.status === 'in_progress' && (
                  <ActivePanel quest={quest} compact onComplete={setCompletedId} />
                )}
                {quest.endReason === 'expired' && <p>已过期，自动放弃</p>}
                {quest.endReason === 'safety' && <p>因安全原因下架，自动放弃</p>}
              </article>
            ))}
          {!quests?.some((quest) => quest.status === tab) && <Empty title="这里还没有记录" />}
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
  const quest = useLiveQuery(() => db.quests.get(id), [id]);
  const completion = useLiveQuery(
    () => db.completions.where('userQuestId').equals(id).first(),
    [id],
  );
  const [completedId, setCompletedId] = useState('');
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
      {completedId ? (
        <CompletionPanel id={completedId} />
      ) : quest.status === 'in_progress' ? (
        <ActivePanel key={quest.id} quest={quest} onComplete={setCompletedId} />
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
      {!records?.length && <Empty title="完成第一条支线，留下你的经历" />}
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
          setSaved(false);
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
  const recent = useLiveQuery(() =>
    db.completions.orderBy('completedAt').reverse().limit(3).toArray(),
  );
  if (!growth) return <p>读取成长记录…</p>;
  const max = Math.max(1, ...Object.values(growth.attributes));
  const point = (index: number, ratio: number) => {
    const angle = (index * Math.PI) / 3 - Math.PI / 2;
    return `${150 + Math.cos(angle) * 100 * ratio},${150 + Math.sin(angle) * 100 * ratio}`;
  };
  return (
    <section className="page">
      <p className="eyebrow">ADVENTURER PROFILE</p>
      <h1>冒险者档案</h1>
      <div className="profile-panel">
        <div className="profile-identity">
          <Avatar />
          <h2>生活冒险者</h2>
          <p>每一段经历，都在这里留下形状。</p>
          <p className="stat">
            Lv. {growth.level}{' '}
            <span>
              {growth.totalXp} XP · {growth.completed} 次完成
            </span>
          </p>
          <progress max={1} value={growth.progress} />
          <p>距离下一级还需 {growth.xpToNextLevel} XP</p>
        </div>
        <div className="profile-chart">
          <h2>六维经历</h2>
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
        </div>
      </div>
      <p>
        {growth.completed < 3 ? '数据形成中，先去体验几件小事。' : '图形展示各项经历的相对分布。'}{' '}
        属性仅代表经历倾向，不是人格、智力、健康或能力评价。
      </p>
      <h2>最近经历</h2>
      <div className="recent-list">
        {recent?.map((record) => (
          <Link key={record.id} to={`/archive/${record.id}`}>
            <span>{formatDate(record.completedAt)}</span>
            <span>{record.note || '一次值得记住的小冒险'}</span>
            <b>+{record.reward.xp} XP</b>
          </Link>
        ))}
        {!recent?.length && <Empty title="故事从第一条支线开始" />}
      </div>
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
  const { service, refresh, network } = useRuntime();
  const action = useAction();
  const [confirmation, setConfirmation] = useState(false);
  return (
    <section className="page">
      <h1>设置</h1>
      <div className="settings-panel">
        <h2>外观</h2>
        <p>温暖像素小镇</p>
        <p className="muted">黄昏小镇与背包，走进生活的小冒险。</p>
      </div>
      <div className="settings-panel">
        <h2>个人数据</h2>
        <p>
          个人记录和照片仅保存在当前浏览器。清理本站数据会丢失记录，请定期导出 ZIP
          备份；可在本机或其他浏览器手动导入，不提供云备份或自动同步。
        </p>
        <h2>导出私人存档</h2>
        <p>ZIP 包含任务、存档、奖励和照片，含私密信息，请妥善保管；可通过下方入口导入恢复。</p>
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
        <ArchiveImport />
        <h2>清除本地个人数据</h2>
        <p>
          删除存档、照片、任务、奖励及本地待发统计事件，重建匿名身份；公共内容缓存保留。删除无法撤销，仅可从事先导出的备份恢复。
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={confirmation}
            onChange={(e) => setConfirmation(e.target.checked)}
          />
          我理解删除无法撤销，已妥善导出需要的记录
        </label>
        <button
          className="danger"
          disabled={!confirmation || action.busy}
          onClick={() =>
            void action.run(async () => {
              await deletePersonalData(db, service.profileId);
              sessionStorage.removeItem('sidequest-recommendations-v1');
              clearRecommendation(sessionStorage);
              location.reload();
            })
          }
        >
          确认删除个人数据
        </button>
      </div>
      <div className="settings-panel">
        <h2>隐私与统计</h2>
        <p>
          首版不上传任何个人统计事件、记录正文、照片或精确位置。统计仅保存在当前浏览器，随个人数据一起导出或删除。
        </p>
        <Link className="text-link" to="/stats">
          查看本地统计
        </Link>
      </div>
      <div className="settings-panel">
        <h2>公共内容</h2>
        <p role="status">{network}</p>
        <button
          className="secondary"
          disabled={action.busy}
          onClick={() => void action.run(refresh)}
        >
          刷新任务库
        </button>
        <p className="muted">启动、回到前台与恢复网络时自动同步；个人记录始终留在本机。</p>
      </div>
      {action.error && <p role="alert">{action.error}</p>}
    </section>
  );
}
export function Empty({ title }: { title: string }) {
  return (
    <section className="intro empty-state">
      <Avatar />
      <h2>{title}</h2>
      <Link className="text-link" to="/">
        发现一条支线
      </Link>
    </section>
  );
}

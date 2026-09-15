import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getBeijingDate } from '@sidequest/domain';
import { db } from './runtime';

export function StatisticsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [questId, setQuestId] = useState('');
  const records = useLiveQuery(() =>
    db.transaction('r', [db.quests, db.completions, db.outbox], async () => ({
      quests: await db.quests.toArray(),
      completions: await db.completions.toArray(),
      events: await db.outbox.toArray(),
    })),
  );
  if (!records) return <p>读取本地统计…</p>;
  const range = (timestamp: string) => {
    const date = getBeijingDate(new Date(timestamp));
    return (!from || date >= from) && (!to || date <= to);
  };
  const events = records.events.filter(
    (event) => range(event.occurredAt) && (!questId || event.questId === questId),
  );
  const accepted = records.quests.filter(
    (quest) => range(quest.acceptedAt) && (!questId || quest.questId === questId),
  );
  const completed = records.completions.filter(
    (record) => range(record.completedAt) && (!questId || record.questId === questId),
  );
  const completionIds = new Set(records.completions.map((record) => record.userQuestId));
  const cohortCompleted = accepted.filter((quest) => completionIds.has(quest.id));
  const count = (name: string) => events.filter((event) => event.name === name).length;
  const rate = (value: number, total: number) =>
    total ? `${Math.round((value / total) * 100)}%` : '—';
  const options = [
    ...new Map(records.quests.map((quest) => [quest.questId, quest.snapshot.title])).entries(),
  ];
  return (
    <section className="page">
      <h1>本地统计</h1>
      <p>仅统计当前浏览器，不上报服务器，不代表其他用户或真实人数。清除个人数据时一并删除。</p>
      <div className="actions">
        <label>
          起始日期（北京时间）
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          结束日期
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label>
          任务
          <select value={questId} onChange={(e) => setQuestId(e.target.value)}>
            <option value="">全部</option>
            {options.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {from && to && from > to && <p role="alert">起始日期不能晚于结束日期。</p>}
      <dl className="attribute-list">
        {[
          ['推荐请求', count('recommend_request')],
          ['推荐结果展示', count('quest_impression')],
          ['换出', count('quest_reroll')],
          ['接取', accepted.length],
          ['期间完成', completed.length],
          ['期间放弃', count('quest_abandon')],
          ['接取队列完成率', rate(cohortCompleted.length, accepted.length)],
          [
            '完成时存档补充率',
            rate(
              completed.filter(
                (record) => record.hasNoteAtCompletion || record.hasImageAtCompletion,
              ).length,
              completed.length,
            ),
          ],
          ['有效推荐率', rate(count('quest_impression'), count('recommend_request'))],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p>
        接取队列完成率以所选时间内接取的执行记录为分母，检查它们之后是否完成；不是用期间完成数除以期间接取数。存档补充率只记录完成当时是否有文字或图片，后续编辑不改变。展示计数指随机主结果，不包含分类列表；零分母显示“—”。
      </p>
    </section>
  );
}

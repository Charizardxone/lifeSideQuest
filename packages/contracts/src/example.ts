import type { QuestContent } from './quests';

/** Draft/template only; never auto-published or injected as production catalog content. */
export const EXAMPLE_QUEST: QuestContent = {
  title: '在窗边发现三种颜色',
  subtitle: '给熟悉的风景一点新的注意。',
  description: '在安全的室内，从窗边观察三种平时没有注意的颜色。无需拍摄他人或离开安全区域。',
  category: 'exploration',
  steps: [
    '选择安全的室内位置，不攀爬窗台。',
    '找到三种不同的颜色，留意它们的形状。',
    '回想哪一种颜色最让你意外。',
  ],
  duration: '5–10 分钟',
  budget: '0 元',
  people: '独自或与熟人一起',
  indoorOutdoor: '室内',
  timeOfDay: '光线充足时',
  environment: '无需特定城市或天气；可坐着完成',
  preparation: '无需准备',
  safetyNotes: '保持在安全室内，不攀爬，不拍摄他人隐私。任何不适都可以停止。',
  tags: ['观察', '低预算'],
  rewards: {
    ruleVersion: 'mvp-v1',
    difficulty: 1,
    xp: 10,
    attributes: {
      exploration: 1,
      courage: 0,
      creativity: 1,
      connection: 0,
      growth: 0,
      vitality: 0,
    },
  },
};

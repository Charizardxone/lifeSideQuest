import {
  ATTRIBUTES,
  BASE_REWARDS,
  questContentSchema,
  type Attribute,
  type Difficulty,
  type QuestCategory,
  type QuestContent,
} from '@sidequest/contracts';

/** Editorial inspiration, not copied activity text or endorsements. */
export const SOURCES = {
  nature: 'https://www.nps.gov/teachers/classrooms/nature-journaling.htm',
  sound: 'https://www.nps.gov/subjects/sound/explore.htm',
  leave: 'https://www.nps.gov/natt/learn/leave-no-trace.htm',
  art: 'https://npg.si.edu/blog/what-slow-art-day',
  object:
    'https://americanindian.si.edu/nk360/informational/learning-to-look-and-object-investigation',
  history:
    'https://www.loc.gov/programs/teachers/getting-started-with-primary-sources/guides/?reload=no',
  personal: 'https://www.loc.gov/classroom-materials/primary-sources-and-personal-artifacts/',
  reading: 'https://readingagency.org.uk/2018_quick_reads_titles_announced/',
  kindness: 'https://www.randomactsofkindness.org/',
  connection: 'https://actionforhappiness.org/',
  clouds: 'https://svs.gsfc.nasa.gov/13149',
} as const;

type Options = {
  difficulty?: Difficulty;
  attributes: [Attribute, Attribute] | [Attribute, Attribute, Attribute];
  duration?: string;
  outdoor?: boolean;
  people?: string;
  preparation?: string;
  environment?: string;
  safety: string;
  tags?: string[];
  sources?: (keyof typeof SOURCES)[];
};

function quest(
  key: string,
  category: QuestCategory,
  title: string,
  subtitle: string,
  description: string,
  steps: string[],
  options: Options,
): { key: string; sources: (keyof typeof SOURCES)[]; content: QuestContent } {
  const difficulty = options.difficulty ?? 1;
  const total = BASE_REWARDS[difficulty].attributePoints;
  const attributes = Object.fromEntries(ATTRIBUTES.map((axis) => [axis, 0]));
  // Distribute integer points evenly; shared schema enforces totals and the 70% cap.
  options.attributes.forEach((axis, index) => {
    attributes[axis] =
      Math.floor(total / options.attributes.length) +
      (index < total % options.attributes.length ? 1 : 0);
  });
  return {
    key,
    sources: options.sources ?? [],
    content: questContentSchema.parse({
      title,
      subtitle,
      description,
      category,
      steps,
      duration: options.duration ?? '10–15 分钟',
      budget: '0 元（使用已有物品，不要求消费）',
      people: options.people ?? '独自或与熟人一起',
      indoorOutdoor: options.outdoor ? '户外；条件不适合可择日进行' : '室内',
      timeOfDay: options.outdoor ? '白天、天气适宜时' : '方便且不打扰他人时',
      environment:
        options.environment ??
        (options.outdoor ? '熟悉、开放且允许停留的公共区域' : '安全安静的室内，可坐着完成'),
      preparation: options.preparation ?? '无需额外购买；如想留下记录，可使用已有纸笔',
      safetyNotes: `${options.safety} 不适或条件不允许时可停止、放弃，不必勉强完成。`,
      tags: [options.outdoor ? '户外体验' : '室内可做', '低预算', ...(options.tags ?? [])],
      rewards: { ruleVersion: 'mvp-v1', difficulty, xp: BASE_REWARDS[difficulty].xp, attributes },
    }),
  };
}

export const STARTER_QUESTS = [
  quest(
    '01',
    'exploration',
    '画一张身边的声音地图',
    '让耳朵带你重新认识一个地方。',
    '在熟悉的公共区域停留片刻，用方向和符号记下声音的位置，留下一张不依赖照片的现场小地图。',
    [
      '在不挡路的安全座位停下，保持睁眼。',
      '辨认三个不同方向的声音，用符号画在纸上。',
      '选出最容易被忽略的一种声音，为它写一句描述。',
    ],
    {
      attributes: ['exploration', 'creativity'],
      outdoor: true,
      sources: ['sound'],
      safety: '不戴隔音耳机，不录制私人谈话，不为追寻声音进入车道或偏僻区域。',
    },
  ),
  quest(
    '02',
    'exploration',
    '寻找一条路上的三种纹理',
    '熟悉的街角，也有细节展览。',
    '沿日常通行的一小段路，观察三种不同材质的表面，只看不触碰，比较它们给你的感觉。',
    [
      '选择有连续人行道的熟悉短路线。',
      '停在安全处观察砖、木、金属等表面中的三种。',
      '分别用一个形容词记住它们，按原路返回。',
    ],
    {
      attributes: ['exploration', 'vitality'],
      outdoor: true,
      duration: '15–20 分钟',
      safety: '遵守交通规则，不边走边看手机，不触碰锈蚀、尖锐或未知表面。',
    },
  ),
  quest(
    '03',
    'exploration',
    '给一棵树画张观察卡',
    '不必知道名字，也能认真认识它。',
    '选一棵公共步道旁的树，以树冠、树干和周围环境为线索，完成自己的观察卡，不要求辨认品种。',
    [
      '从步道上选择能安全观察的树。',
      '画出树冠轮廓，记下树皮外观和一处特别细节。',
      '写下一个下次还想观察的问题。',
    ],
    {
      attributes: ['exploration', 'growth'],
      outdoor: true,
      sources: ['nature'],
      safety: '不攀爬、不摘取、不触摸未知植物，不离开开放步道。',
    },
  ),
  quest(
    '04',
    'exploration',
    '给今天的云起个名字',
    '天空的展览不需要门票。',
    '观察一小片天空，把云的轮廓和变化转成自己的比喻；没有云时，也可以描述天空的色层。',
    [
      '在地面安全位置站定或坐好，避开太阳方向。',
      '观察一片云或天空色层两分钟。',
      '为看到的形状命名，并描述一次变化或没有变化。',
    ],
    {
      attributes: ['exploration', 'creativity'],
      outdoor: true,
      sources: ['clouds'],
      duration: '5–10 分钟',
      safety: '不直视太阳，不使用望远设备对准太阳，不登高；雷雨或酷热时不进行。',
    },
  ),
  quest(
    '05',
    'exploration',
    '发现公共空间里的无障碍细节',
    '换一个角度读懂日常路线。',
    '在熟悉的公共空间里，寻找坡道、扶手或导向标识，思考一项设计如何帮助不同的人通行。',
    [
      '选择日常经过的开放公共空间。',
      '从正常通行位置观察两项无障碍设施。',
      '描述其中一项设计的用途，以及自己以前没注意到的细节。',
    ],
    {
      attributes: ['exploration', 'connection'],
      outdoor: true,
      safety: '不占用坡道、盲道或无障碍设备，不模拟危险行动，不拍摄使用设施的人。',
    },
  ),
  quest(
    '06',
    'exploration',
    '在一件展品前多停留五分钟',
    '先看自己的发现，再看说明。',
    '在可免费进入的展览里挑一件展品；没有合适场馆时，可用官方公开的展品图片完成一次慢观察。',
    [
      '确认场馆开放与免费条件，或打开官方展品图片。',
      '先观察五分钟，找出三个细节，再阅读说明。',
      '写下说明改变了你的哪一个猜想。',
    ],
    {
      difficulty: 2,
      attributes: ['exploration', 'growth'],
      duration: '20–30 分钟（不含路程）',
      sources: ['art'],
      environment: '免费开放的展厅，或可查看官方展品图片的室内',
      safety: '遵守场馆规则，不触碰展品、不使用闪光灯、不占用通道；无需购买门票。',
    },
  ),
  quest(
    '07',
    'exploration',
    '在图书馆找到一个陌生书架',
    '让分类号带你走出惯性。',
    '在当地免费开放的图书馆，访问一个平时不会停留的分类书架，只需浏览，不要求借书。',
    [
      '先确认开放时间与入馆要求，选择可免费进入的图书馆。',
      '找一个陌生分类，浏览三本书的书名与目录。',
      '选一个新主题，记住你为什么想继续了解。',
    ],
    {
      difficulty: 2,
      attributes: ['exploration', 'growth'],
      duration: '20–30 分钟（不含路程）',
      sources: ['reading'],
      environment: '可免费入内的公共图书馆',
      safety: '保持安静，不拍摄读者，不勉强办理会员或消费；按馆方规则放回书籍。',
    },
  ),
  quest(
    '08',
    'exploration',
    '收集三处光影，不带走任何东西',
    '把普通的一面墙看成画面。',
    '在家里或熟悉的室内，找到三处光影变化，用简单线条记录它们的位置和形状。',
    [
      '选择远离窗台边缘的安全位置。',
      '寻找墙面、桌面或地面上的三处光影。',
      '画出最喜欢的一处，给画面写一个标题。',
    ],
    {
      attributes: ['exploration', 'creativity'],
      safety: '不攀爬、不挪动重物、不直视太阳或强光源，不使用明火制造光影。',
    },
  ),
  quest(
    '09',
    'exploration',
    '读懂一块身边的公共说明牌',
    '把经过变成一次发现。',
    '找到公园或公共文化空间里的一块说明牌，读完后用自己的话讲出一件刚知道的事。',
    [
      '选择允许停留且不影响通行的说明牌。',
      '读出主题、一个具体细节和落款单位。',
      '用一句自己的话总结，不确定的内容标成待核实。',
    ],
    {
      attributes: ['exploration', 'growth'],
      outdoor: true,
      safety: '不进入围挡或封闭区域，不扫描来源不明二维码，不把宣传内容直接当作已核实事实。',
    },
  ),
  quest(
    '10',
    'exploration',
    '在步道上做一次不采集的寻宝',
    '发现可以留下，植物不用带走。',
    '把自然寻宝变成观察游戏：寻找弯曲的线、重复的形状和一种自然颜色，完成后让现场保持原样。',
    [
      '选一段熟悉的开放步道，事先确定返回点。',
      '从步道上观察三种线索，不拿取任何物品。',
      '用三个词记录发现，沿安全路线返回。',
    ],
    {
      difficulty: 2,
      attributes: ['exploration', 'vitality'],
      outdoor: true,
      duration: '20–30 分钟',
      sources: ['leave'],
      safety: '不采摘、不翻石、不喂动物，不靠近水边或离开步道；天气恶劣时取消。',
    },
  ),
  quest(
    '11',
    'exploration',
    '画出通勤路上的一个小地标',
    '把自动驾驶的日常按下暂停。',
    '回想或观察日常路线上一个非私人地标，用不求准确的简笔画留下它的轮廓。',
    [
      '选一处你熟悉的公共建筑或街角标识。',
      '在安全座位上观察，或回到室内凭记忆画轮廓。',
      '补上一个让它容易辨认的细节。',
    ],
    {
      attributes: ['exploration', 'creativity'],
      safety: '不在驾驶或骑行时观察记录，不画出个人住址、门禁或敏感设施细节。',
    },
  ),
  quest(
    '12',
    'exploration',
    '用一张自然笔记比较两片叶子',
    '相似之中，找出不同。',
    '观察两片仍在植物上的叶子，比较轮廓、排列和色泽，不要求触摸或鉴定植物。',
    [
      '从安全步道上选两片可见的叶子。',
      '分别画出大致轮廓，记下两个不同点。',
      '再写出一个共同点，保持植物原状离开。',
    ],
    {
      attributes: ['exploration', 'growth'],
      outdoor: true,
      sources: ['nature'],
      safety: '不采摘、不尝食、不触碰未知植物，避免靠近蜂巢和陡坡。',
    },
  ),

  quest(
    '13',
    'encounter',
    '把一句谢谢说具体',
    '让对方知道，哪件小事被你记住了。',
    '选一位你熟悉且愿意联系的人，感谢一件具体的小事，不要求对方回应。',
    [
      '想起对方曾做过的一件让你受益的小事。',
      '用自己的话表达事件和你的感谢，可当面说或发简短消息。',
      '送达后结束，不追问对方为何没有回复。',
    ],
    {
      attributes: ['connection', 'courage'],
      sources: ['kindness'],
      people: '自己与一位愿意联系的熟人',
      safety: '不联系明确拒绝接触的人，不公开私人往事，不以感谢要求回报。',
    },
  ),
  quest(
    '14',
    'encounter',
    '认真听完一个三分钟的小故事',
    '这一次，不急着接过话题。',
    '邀请一位熟人分享最近的一件普通小事，你负责倾听，再用一句话确认自己理解了什么。',
    [
      '询问对方现在是否愿意聊三分钟，拒绝就另选时间或放弃。',
      '听完一件小事，不追问隐私，不急于给建议。',
      '用自己的话复述重点，问一句“我理解得对吗”。',
    ],
    {
      difficulty: 2,
      attributes: ['connection', 'growth'],
      sources: ['connection'],
      people: '与一位自愿参与的熟人',
      safety: '不录音、不套取隐私，不要求谈论痛苦经历；对方想结束就停止。',
    },
  ),
  quest(
    '15',
    'encounter',
    '交换一个让生活方便的小技巧',
    '互相学一招，不需要当专家。',
    '和熟人各分享一个无危险、无消费要求的日常小技巧，例如整理书签或打包文件的方法。',
    [
      '邀请对方进行一次简短技巧交换。',
      '示范一个自己熟悉的安全小技巧，再听对方分享。',
      '实际试用其中一招，感谢对方。',
    ],
    {
      difficulty: 2,
      attributes: ['connection', 'growth'],
      people: '与一位自愿参与的熟人',
      safety: '避开医疗、投资、电器拆修和危险工具操作，不提供账户密码或私密文件。',
    },
  ),
  quest(
    '16',
    'encounter',
    '和熟人轮流介绍一件普通物品',
    '一支笔也可以有自己的故事。',
    '两人各选一件自己的普通物品，讲讲如何得到它或为什么仍在使用，只讲愿意分享的部分。',
    [
      '先征得同意，各选一件安全的小物品。',
      '轮流介绍一分钟，另一人问一个不涉及隐私的问题。',
      '说出这次新认识到的一个细节。',
    ],
    {
      attributes: ['connection', 'exploration'],
      sources: ['personal'],
      people: '与一位自愿参与的熟人',
      safety: '不展示证件、药物、贵重物品或他人的私人物品，不录制对话。',
    },
  ),
  quest(
    '17',
    'encounter',
    '邀请熟人一起走一小段平路',
    '让聊天有一个轻松的场景。',
    '在双方都方便时，沿熟悉的平坦路线走一小段；行动不便时可以改为坐着聊同样的时间。',
    [
      '询问对方意愿，共同选择安全地点与十分钟时长。',
      '按双方舒服的节奏走或坐聊，不设置速度目标。',
      '在约定时间结束，说出一个开心的小话题。',
    ],
    {
      difficulty: 2,
      attributes: ['connection', 'vitality'],
      outdoor: true,
      people: '与一位自愿参与的熟人',
      safety: '不催促步速，不走偏僻或临水路线；恶劣天气改室内，不把运动当作治疗建议。',
    },
  ),
  quest(
    '18',
    'encounter',
    '给熟人的一项努力一个具体肯定',
    '看见过程，而不只是结果。',
    '选择亲眼见过的一项努力，以真诚简短的话表达肯定，避开外貌评价和比较。',
    [
      '回想对方最近投入精力的一件事。',
      '说清楚你注意到了哪个行动，而非夸大结果。',
      '表达后留出空间，不要求回应。',
    ],
    {
      attributes: ['connection', 'courage'],
      sources: ['kindness'],
      people: '自己与一位熟人',
      safety: '不评价身体外貌、不涉及绩效隐私，不对不愿交流的人持续搭话。',
    },
  ),
  quest(
    '19',
    'encounter',
    '和熟人互荐一段短阅读',
    '借别人的书页，看见一个新主题。',
    '各推荐一篇可合法免费阅读的短文或一本已有书中的章节，选一小段实际读完再交流。',
    [
      '先约好只选双方都能合法获取的短内容。',
      '各读对方推荐内容中的一小段。',
      '分享一个新发现，不要求意见一致。',
    ],
    {
      difficulty: 2,
      attributes: ['connection', 'growth'],
      duration: '20–30 分钟',
      sources: ['reading'],
      people: '与一位自愿参与的熟人',
      safety: '不发送盗版文件、付费账号或敏感私人文章，不把交流变成争辩。',
    },
  ),
  quest(
    '20',
    'encounter',
    '征得同意后帮一个很小的忙',
    '帮助从询问开始。',
    '向熟人提出一个自己能安全完成的小帮助，例如整理共同使用的桌面，不替对方做决定。',
    [
      '提出一项具体、十分钟内可完成的小帮助。',
      '得到明确同意后，按对方希望的方式完成。',
      '归还使用的物品，确认没有增加对方负担。',
    ],
    {
      difficulty: 2,
      attributes: ['connection', 'courage'],
      sources: ['kindness'],
      people: '自己与一位同意接受帮助的熟人',
      safety: '拒绝即停止；不搬重物、不操作对方账户、不涉及钱款、照护或危险维修。',
    },
  ),

  quest(
    '21',
    'learning',
    '用自己的话解释一个陌生词',
    '学会，不只是复制定义。',
    '从今天读到的非专业高风险内容里选一个不熟悉的词，查阅可靠词典并写出自己的例句。',
    [
      '选一个感兴趣的普通词语。',
      '查词典或出版机构的解释，区分词义与个人猜想。',
      '不照抄释义，写一句自己的例句并复述词义。',
    ],
    {
      attributes: ['growth', 'exploration'],
      safety: '不要用一次查词代替医疗、法律或金融专业判断，不访问可疑下载链接。',
    },
  ),
  quest(
    '22',
    'learning',
    '给一张老照片提出三个问题',
    '先观察，再猜测。',
    '选择公共文化机构公开展示的一张历史照片，把确实看见的细节与自己的推测分开。',
    [
      '打开图书馆或博物馆的一张公开历史照片。',
      '记下三个可直接看见的细节。',
      '提出三个问题，再看机构说明能回答哪一个。',
    ],
    {
      difficulty: 2,
      attributes: ['growth', 'exploration'],
      sources: ['history'],
      safety: '仅用公开材料，不识别或传播私人身份；未经证实的推测不要当史实转发。',
    },
  ),
  quest(
    '23',
    'learning',
    '读完一篇短文并留下一句话',
    '不追求读多少，只保留一点收获。',
    '选择合法可读的一篇短文，读完后合上页面，用一句自己的话记住最想带走的内容。',
    [
      '选择长度适合十五分钟内读完的短文。',
      '关闭无关页面，按自己的节奏读完。',
      '合上原文，写一句总结，再核对有没有误解。',
    ],
    {
      attributes: ['growth', 'creativity'],
      sources: ['reading'],
      safety: '不转录大段受版权保护内容；疲劳时休息，不要求购买或注册服务。',
    },
  ),
  quest(
    '24',
    'learning',
    '读懂一张本地公共空间导览图',
    '把地图变成能说清楚的路线。',
    '使用已公开的公园或文化场馆导览图，练习识别图例、入口和公共设施，不需要实际出行。',
    [
      '选择官方公开的导览图。',
      '找出一个入口、图例和一项公共设施。',
      '用自己的话描述一条短路线，并标注需到场确认的开放信息。',
    ],
    {
      difficulty: 2,
      attributes: ['growth', 'exploration'],
      safety: '不以旧地图保证路线实时可通行，不标注私人住址或敏感位置。',
    },
  ),
  quest(
    '25',
    'learning',
    '向一件日用品追问材料来源',
    '把“它是什么做的”问清楚一点。',
    '选一件无危险的日用品，查看可见标识，再寻找生产者公开说明，区分确定信息和未知信息。',
    [
      '选自己的纸本、布袋或收纳盒等普通物品。',
      '阅读可见材质标识，不拆开物品。',
      '核对一项官方说明，写下一个确认事实和一个仍不确定的问题。',
    ],
    {
      difficulty: 2,
      attributes: ['growth', 'exploration'],
      sources: ['object'],
      safety: '不燃烧、尝食或用化学品测试材料，不拆电器、电池和密封容器。',
    },
  ),
  quest(
    '26',
    'learning',
    '试着用三个图标解释一件事',
    '让知识换一种表达方式。',
    '选一件自己熟悉的低风险小事，例如整理书桌，把过程简化为三个图标，检查能否看懂。',
    [
      '选择不涉及危险操作的日常小流程。',
      '画三个图标分别表示开始、过程和结束。',
      '隔一分钟回看，给最不清楚的图标补一个词。',
    ],
    {
      attributes: ['growth', 'creativity'],
      safety: '不用图标简化医疗、应急或安全操作指南，不要求别人照图执行高风险动作。',
    },
  ),
  quest(
    '27',
    'learning',
    '核对一条日常冷知识的出处',
    '从“听说”走到“有依据”。',
    '挑一条不涉及个人隐私或专业决策的日常知识，寻找原始机构说明，练习保留不确定性。',
    [
      '把想核对的说法写成一句明确的话。',
      '找原始机构或作者的公开资料，核对日期和适用条件。',
      '标为有支持、部分支持或暂未找到依据，留下来源标题。',
    ],
    {
      difficulty: 2,
      attributes: ['growth', 'courage'],
      duration: '20–30 分钟',
      sources: ['history'],
      safety: '不调查个人、不传播谣言，不把搜索不到当作事实为假；避开医疗法律投资建议。',
    },
  ),
  quest(
    '28',
    'learning',
    '学一个已有软件的实用快捷操作',
    '给每天使用的工具补一小块知识。',
    '从你已安装的常用软件中挑一个低风险操作，阅读官方帮助后在空白测试内容里练习。',
    [
      '选择撤回输入、查找文字或切换视图等基础操作。',
      '查阅软件内帮助或官方说明。',
      '在空白测试文档中成功操作三次，不改真实重要文件。',
    ],
    {
      attributes: ['growth', 'exploration'],
      safety: '不运行陌生命令、不安装扩展、不操作付款或删除功能，不在敏感文件上练习。',
    },
  ),
  quest(
    '29',
    'learning',
    '听一段纯音乐，辨认两层声音',
    '不懂乐理，也能听见结构。',
    '用自己已有或合法免费的纯音乐做一次专注聆听，尝试分辨两种音色，不要求知道乐器名称。',
    [
      '选择一段三到五分钟的合法音源，调到舒适音量。',
      '第一次听整体，第二次寻找两层不同声音。',
      '用轻重、远近或明暗描述它们。',
    ],
    {
      attributes: ['growth', 'creativity'],
      safety: '不在驾驶、骑行或过马路时进行，不提高音量追求效果，不上传受版权保护音频。',
    },
  ),
  quest(
    '30',
    'learning',
    '为一个好问题做十五分钟小研究',
    '允许答案暂时不完整。',
    '从身边的物品或文化现象提出一个普通问题，限定时间查找资料，最后列出下一步线索。',
    [
      '选一个可公开查证、与专业风险无关的问题。',
      '用十五分钟查阅两份可靠材料并记下出处。',
      '写出一个已知答案和一个仍待追问的地方。',
    ],
    {
      difficulty: 3,
      attributes: ['growth', 'exploration', 'creativity'],
      duration: '25–35 分钟',
      sources: ['history'],
      safety: '不绕过付费墙，不搜集他人隐私；涉及医疗、法律或金融判断时另选问题。',
    },
  ),

  quest(
    '31',
    'creation',
    '把普通杯子画成三种角色',
    '同一个轮廓，可以住进不同故事。',
    '观察自己的杯子，先画一个简单轮廓，再用表情和配件把它变成三个虚构角色。',
    [
      '选一个空杯，放在稳固桌面上。',
      '画三次轮廓，各加不同的表情或虚构配件。',
      '为三个角色分别取名，选出最出乎意料的一个。',
    ],
    {
      difficulty: 2,
      attributes: ['creativity', 'exploration'],
      sources: ['object'],
      safety: '只在纸上创作，不在食品接触面涂画，不使用热水或易碎道具做实验。',
    },
  ),
  quest(
    '32',
    'creation',
    '用三个日常物件摆一幅静物',
    '把桌面临时变成小展厅。',
    '用三件自己拥有、安全且干净的小物件探索排列关系，只通过移动位置创造一个画面。',
    [
      '挑选三件不尖锐、不贵重的小物件。',
      '尝试紧凑、疏散和对角线三种排列。',
      '为最喜欢的排列命名，结束后物归原位。',
    ],
    {
      attributes: ['creativity', 'exploration'],
      safety: '不用药品、刀具、火源或食物浪费做道具，不在桌沿堆叠物品。',
    },
  ),
  quest(
    '33',
    'creation',
    '画一张不存在的小店招牌',
    '给想象中的街角留个位置。',
    '设计一家只存在于想象中的小店，想好它提供什么，再用纸笔做一张原创招牌。',
    [
      '写出一个虚构店名和一句服务描述。',
      '用两种颜色或两种线条设计招牌。',
      '补一个有趣的小细节，说明它为什么属于这家店。',
    ],
    {
      difficulty: 2,
      attributes: ['creativity', 'courage'],
      safety: '不仿冒真实商标，不张贴到公共墙面，不提供真实电话和住址。',
    },
  ),
  quest(
    '34',
    'creation',
    '写一个只有六句话的小故事',
    '故事可以很短，变化要看得见。',
    '以一件普通物品为主角，用六句话写出一次小小的出发、意外和回归，不需要公开作品。',
    [
      '选一个无生命的小物件作为主角。',
      '写两句开头、两句变化和两句结尾。',
      '删掉一个多余词，给故事取标题。',
    ],
    {
      difficulty: 2,
      attributes: ['creativity', 'growth'],
      safety: '使用虚构人物与情节，不写入真实他人的隐私或未经许可的私人故事。',
    },
  ),
  quest(
    '35',
    'creation',
    '做一张只属于今天的色卡',
    '用颜色留下当天的气氛。',
    '从自己的衣物、书本或室内物品中观察三种颜色，在纸上或已有绘图工具里组成小色卡。',
    [
      '找到三种让你联想到今天的颜色。',
      '画三个色块；没有彩笔可写颜色名称代替。',
      '给每个色块配一个原创词，再为整张卡命名。',
    ],
    {
      attributes: ['creativity', 'exploration'],
      safety: '只使用现成安全文具，不混合清洁剂或未知颜料，不拍摄他人私人物品。',
    },
  ),
  quest(
    '36',
    'creation',
    '把一张废纸变成原创书签',
    '留下一个下次阅读的入口。',
    '用自己可支配的干净废纸折一张简单书签，写上自创的一句提醒，不需要复杂裁剪。',
    [
      '挑一张没有隐私内容的干净纸。',
      '折成长条，用线条或图案装饰。',
      '写一句自己的阅读提醒，放进已有的书里试用。',
    ],
    {
      attributes: ['creativity', 'growth'],
      safety: '优先折叠，不使用刀具；不用他人文件、证件复印件或需要归档的纸张。',
    },
  ),
  quest(
    '37',
    'creation',
    '用一条连续线画一个小物件',
    '暂时放下画得像的要求。',
    '看着自己的普通物件，让笔尽量不断线地走完整个轮廓，接受不准确的结果。',
    [
      '选一个安全小物件，准备纸笔。',
      '慢慢画轮廓，尽量不抬笔，卡住也可以继续。',
      '圈出画里最有趣的一处，并写下它像什么。',
    ],
    {
      attributes: ['creativity', 'courage'],
      sources: ['object'],
      safety: '不闭眼移动或使用尖锐工具，不长时间保持不舒服的姿势。',
    },
  ),
  quest(
    '38',
    'creation',
    '给日常动作配一段轻声节奏',
    '桌边也能有小小的创作。',
    '用轻拍手掌或桌面的方式创作一段短节奏，重点是找到变化，不是追求音量或表演效果。',
    [
      '确认环境允许轻微声音，选择稳固桌面或轻拍手掌。',
      '编一个四拍模式，再改变其中一拍。',
      '连续演奏两遍，用简单符号记下节奏。',
    ],
    {
      attributes: ['creativity', 'vitality'],
      safety: '不敲击玻璃、电器或他人物品，不制造扰民声音；手部不适时停止。',
    },
  ),
  quest(
    '39',
    'creation',
    '为一件旧物设计一张展签',
    '你的收藏也值得被认真介绍。',
    '选一件属于自己的普通旧物，写出名称、用途和你愿意保留的一段记忆，做一次私人小策展。',
    [
      '选一件安全且不涉及他人隐私的旧物。',
      '写出物品名称、可确认的时间与一段自己的记忆。',
      '摆在桌上配好展签，欣赏后收回。',
    ],
    {
      difficulty: 2,
      attributes: ['creativity', 'growth'],
      sources: ['personal'],
      safety: '不展出证件、贵重品或他人私人物件；记不清的年代标为大约，不虚构事实。',
    },
  ),
  quest(
    '40',
    'creation',
    '用四格画记下一次普通小插曲',
    '给平凡的一刻一个叙事位置。',
    '选择今天一件轻松的小事，把它画成四格，人物可用符号代替，作品只需自己看懂。',
    [
      '选一个不涉及隐私的日常小插曲。',
      '分成开始、尝试、变化和结尾四格。',
      '为每格写一句短说明，完成一个自洽的小故事。',
    ],
    {
      difficulty: 3,
      attributes: ['creativity', 'growth', 'courage'],
      duration: '25–35 分钟',
      safety: '不用真实他人的敏感经历做素材，不要求拍照取证或公开发布。',
    },
  ),

  quest(
    '41',
    'random',
    '抽一个形状，去室内找三个例子',
    '让一个小规则带来新发现。',
    '把圆形、三角形和长方形写成三个选项，随机选一个，在安全室内寻找它的三个实例。',
    [
      '在三张小纸上写下三种形状，混合后抽一张。',
      '不搬动重物，观察选中形状的三个例子。',
      '选出最不典型的一个，说出它哪里接近这个形状。',
    ],
    {
      attributes: ['exploration', 'creativity'],
      safety: '只找目视可见物品，不攀爬、不翻动他人抽屉，不让抽签决定危险行动。',
    },
  ),
  quest(
    '42',
    'random',
    '让书架上的第三本书给你一个词',
    '偶然只负责开头，故事由你来写。',
    '从自己可使用的书中取第三本，不足三本就选任意一本，找一个普通词语作为创作起点。',
    [
      '在稳妥可及的书架上选第三本书，或任选一本已有书。',
      '从目录或正文选一个不涉及隐私的普通词。',
      '用这个词写三句原创小片段，不复制原文。',
    ],
    {
      attributes: ['creativity', 'growth'],
      safety: '不登高拿书，不用他人日记或保密资料，不传播原书大段文字。',
    },
  ),
  quest(
    '43',
    'random',
    '给熟悉的桌面换一个观察角度',
    '改变视角，不必改变生活。',
    '在正常坐姿下从不同方向看桌面，发现同一件物品在形状和遮挡关系上的变化。',
    [
      '选一张稳固桌子，清出可正常就坐的位置。',
      '换一个安全座位观察同一件物品。',
      '比较两个角度，画下更陌生的那个轮廓。',
    ],
    {
      attributes: ['exploration', 'creativity'],
      safety: '不爬桌、不倒立、不钻入狭小区域，不移动重家具或插电设备。',
    },
  ),
  quest(
    '44',
    'random',
    '从三个安全小选项中抽一个十分钟',
    '给选择困难一个温和的出口。',
    '在观察窗外、画普通物品、读一页已有书三个低风险选项中抽签，专注完成抽中的一项。',
    [
      '确认三个选项都适合当前环境，再分别写到纸上。',
      '随机抽一个，以舒服的方式进行十分钟。',
      '用一句话记录这次偶然选择带来的发现。',
    ],
    {
      attributes: ['exploration', 'growth'],
      safety: '不适合的选项先移除再抽；不靠近窗台边缘，不让随机结果压过安全判断。',
    },
  ),
  quest(
    '45',
    'random',
    '用今天看见的一个字开始联想',
    '一个字，也能打开三扇门。',
    '从自己的书本或包装上选一个普通汉字，围绕它联想三个不同场景，再挑一个画成简图。',
    [
      '选一个可见且不涉及个人信息的汉字。',
      '写出它让你想到的三个场景。',
      '选择最意外的场景，画三笔或写三句描述。',
    ],
    {
      attributes: ['creativity', 'exploration'],
      safety: '不抄录快递单、票据上的地址电话，不拆封他人物品。',
    },
  ),
  quest(
    '46',
    'random',
    '为普通物品设计一个虚构新用途',
    '想象可以大胆，执行保持安全。',
    '任选一件自己的普通物品，在纸上设计三个虚构用途，明确它们只是创意而非实际使用建议。',
    [
      '选一件不尖锐、不通电的小物件。',
      '写三个想象中的新用途，不实际改装。',
      '画出最有趣的一个，并标注“想象设计”。',
    ],
    {
      difficulty: 2,
      attributes: ['creativity', 'courage'],
      safety: '不实际改装、加热、吞食或承重测试，不把创意用于儿童玩具或安全设备。',
    },
  ),

  quest(
    '47',
    'special',
    '为未来一个月后的自己写张便笺',
    '把此刻的一点心情好好放下。',
    '写一张只给自己看的便笺，记下一件正在期待的小事和一个温和的提醒，今天封存就算完成。',
    [
      '找一张不含隐私的纸，写下今天的日期。',
      '写一件小期待和一句不苛责自己的提醒。',
      '折好放在安全私密处，标注一个月后的阅读日期；不要求到期再领奖。',
    ],
    {
      difficulty: 2,
      attributes: ['growth', 'creativity'],
      safety: '不记录密码、身份证号或财务凭证，不要求回忆痛苦经历，不寄送个人地址。',
    },
  ),
  quest(
    '48',
    'special',
    '给自己的一个小进步办场微型展览',
    '没有观众，也值得留下证据。',
    '选择一件已经做过的普通小事，用标题、三句话和一个符号做一张私人纪念卡。',
    [
      '回想一件确实完成过的小事，不与别人比较。',
      '写出做了什么、哪里不容易、下次想保留什么。',
      '画一个纪念符号，给卡片写日期并收好。',
    ],
    {
      difficulty: 2,
      attributes: ['growth', 'courage'],
      safety: '不把任务当心理治疗，不强迫自我揭露；避免用消费、外貌或极端表现衡量价值。',
    },
  ),
  quest(
    '49',
    'special',
    '策划一次二十分钟的桌边小展',
    '让观察、选择和讲述汇合一次。',
    '围绕“圆”“旧”或“蓝”等自选主题，用三件自己的普通物品和原创展签完成一次私人策展。',
    [
      '选一个主题，找三件安全、可支配的小物品。',
      '写三张简短展签，说明它们与主题的关系。',
      '安排一个观看顺序，自己走读一遍后收回物品。',
    ],
    {
      difficulty: 3,
      attributes: ['creativity', 'exploration', 'growth'],
      duration: '25–35 分钟',
      sources: ['personal'],
      safety: '不展出贵重物、证件或他人隐私，不使用明火，不在公共场所擅自布展。',
    },
  ),
  quest(
    '50',
    'special',
    '完成一场不购买的生活灵感采集',
    '今天只发现，不把发现变成账单。',
    '在家中从颜色、排列和用途三个角度寻找灵感，做一页自己的点子清单，不下单也不改造危险物品。',
    [
      '观察已有物品，分别找出一种喜欢的颜色、一种整齐排列和一种方便设计。',
      '写下三个可用已有资源尝试的小点子。',
      '选一个仅需纸笔的小点子画草图，今天到此结束。',
    ],
    {
      difficulty: 2,
      attributes: ['creativity', 'growth'],
      duration: '20–30 分钟',
      safety: '不购买材料、不拆修电器、不改变承重结构，不擅自整理他人物品。',
    },
  ),
];

export const STARTER_BATCH_KEY = 'content-seed:2026-09-15:starter-50:v1';

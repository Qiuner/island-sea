export interface DialogLine {
  speaker: string;
  text: string;
  avatarId?: string;
}

export interface StoryPhaseData {
  title: string;
  dialogs: DialogLine[];
}

export interface LevelStory {
  pre: StoryPhaseData;
  postWin: StoryPhaseData;
  postLose: StoryPhaseData;
}

export const STORY_DATA: Record<number, LevelStory> = {
  0: {
    pre: {
      title: "序幕：奥秘星球",
      dialogs: [
        { speaker: "球球", text: "这里是哪里？我记得我还在蓝星吃着小饼干呢..." },
        { speaker: "广播", text: "欢迎来到奥秘星球！星际派对竞技大赛即将开始！" },
        { speaker: "球球", text: "什么大赛？看来只能先去那些传送门看看了！" }
      ]
    },
    postWin: { title: "", dialogs: [] },
    postLose: { title: "", dialogs: [] }
  },
  1: {
    pre: {
      title: "第一关：宇宙赛道冲刺",
      dialogs: [
        { speaker: "外星紫球", text: "嘿！新来的，别挡道！第一关的冠军可是我的！" },
        { speaker: "球球", text: "竞速是吧？我跑起来可是很快的！" }
      ]
    },
    postWin: {
      title: "第一章：胜利",
      dialogs: [
        { speaker: "球球", text: "呼，跑得好累，但我竟然是第一名！" },
        { speaker: "外星紫球", text: "可恶... 下一关我一定会让你好看！" },
        { speaker: "广播", text: "恭喜晋级！前方是危险的消失星台，请准备。" }
      ]
    },
    postLose: {
      title: "第一章：落败",
      dialogs: [
        { speaker: "外星紫球", text: "哈哈哈！就这速度还想争夺宇宙核心能量？" },
        { speaker: "球球", text: "哎呀，差一点点，好不甘心！" }
      ]
    }
  },
  2: {
    pre: {
      title: "第二章：消失星台大逃杀",
      dialogs: [
        { speaker: "球球", text: "这些平台怎么在闪烁？看起来不太结实啊。" },
        { speaker: "外星红球", text: "只要把你推下去，我就能少一个竞争对手！" },
        { speaker: "球球", text: "喂喂，大家不要这么暴力嘛！" }
      ]
    },
    postWin: {
      title: "第二章：胜利",
      dialogs: [
        { speaker: "球球", text: "太惊险了！差点就掉进无尽深渊了。" },
        { speaker: "广播", text: "惊人的生存能力！你离宇宙核心能量越来越近了。" },
        { speaker: "外星红球", text: "算你狠... 我会在台下看着你的。" }
      ]
    },
    postLose: {
      title: "第二章：落败",
      dialogs: [
        { speaker: "外星红球", text: "拜拜了您嘞！深渊的风景不错吧？" },
        { speaker: "球球", text: "啊啊啊啊——救命！" }
      ]
    }
  },
  3: {
    pre: {
      title: "第三章：捉迷藏大作战",
      dialogs: [
        { speaker: "广播", text: "最终试炼：躲避追捕者的搜寻，坚持到最后吧！" },
        { speaker: "追捕者X", text: "锁定目标... 蓝星生物，你逃不掉的。" },
        { speaker: "球球", text: "这机器人看起来好凶！我得赶紧找个地方躲起来！" }
      ]
    },
    postWin: {
      title: "大结局：宇宙核心",
      dialogs: [
        { speaker: "追捕者X", text: "目标丢失... 系统错误..." },
        { speaker: "球球", text: "太棒了！我撑过来了！" },
        { speaker: "广播", text: "试炼完成！你证明了蓝星生物的勇气。宇宙核心能量属于你！" },
        { speaker: "球球", text: "带着这个，回去可以买好多好多小饼干了吧！(全剧终)" }
      ]
    },
    postLose: {
      title: "最终章：被捕获",
      dialogs: [
        { speaker: "追捕者X", text: "目标捕获。试炼失败。" },
        { speaker: "球球", text: "呜呜呜，明明就差一点点了！" }
      ]
    }
  },
  4: {
    pre: {
      title: "核心掠夺",
      dialogs: [
        { speaker: "球球", text: "接到匿名情报，废弃的奥米茄空间站里有很多未被回收的能量储存箱！" },
        { speaker: "广播", text: "警告：此处曾是黑市交易点，因能量泄漏被遗弃，且游荡着变异的机械守卫。" },
        { speaker: "球球", text: "为了获得决赛的资格，我必须拿到足够的能量！(门槛15万，背包装满需返回一楼撤离)" }
      ]
    },
    postWin: {
      title: "真相大白",
      dialogs: [
        { speaker: "球球", text: "呼，终于安全撤离了！等等，这些能量箱上的标记...和大赛主办方的一模一样？" },
        { speaker: "广播", text: "你发现了被隐藏的真相：主办方正在利用参赛者收集散落的危险核心能量。" },
        { speaker: "球球", text: "看来这个派对不仅仅是比赛这么简单。我要去决赛一探究竟！" }
      ]
    },
    postLose: {
      title: "被捕获",
      dialogs: [
        { speaker: "广播", text: "警报！检测到入侵者生命体征归零... 正在呼叫清道夫机器人..." },
        { speaker: "球球", text: "糟糕，被守卫抓住了！等救援部队把我捞出去，我一定要再试一次！" }
      ]
    }
  },
  5: {
    pre: {
      title: "第五关：超然竞技场",
      dialogs: [
        { speaker: "广播", text: "最终试炼：超然竞技场！四支队伍将在这里进行终极对决。" },
        { speaker: "球球", text: "组队战吗？好在有你在，粉球！" },
        { speaker: "粉球", text: "放心吧，球球！我会用治愈光环和加速祝福支援你的！" },
        { speaker: "黑球", text: "哼，胜利只会属于暗影... 准备好被淘汰吧。" }
      ]
    },
    postWin: {
      title: "大结局：派对冠军",
      dialogs: [
        { speaker: "广播", text: "不可思议！蓝星生物和他的队友赢得了最终的胜利！" },
        { speaker: "球球", text: "太棒了！我们赢了！" },
        { speaker: "粉球", text: "不仅赢了比赛，还揭开了他们的阴谋，宇宙核心安全了。" },
        { speaker: "球球", text: "终于可以回家吃小饼干了！(全剧终)" }
      ]
    },
    postLose: {
      title: "被淘汰",
      dialogs: [
        { speaker: "黑球", text: "弱者只配退场。" },
        { speaker: "球球", text: "呜呜，5局全输了，就差一点点..." }
      ]
    }
  }
};
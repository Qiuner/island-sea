// 岛屿数据 —— 加一个孩子 = 在这里加一条，不改场景代码。
// 注意：解锁状态不存在这里（它是"每个访客自己的"，存 localStorage）；
// projects 为空 = 迷雾岛（孩子的项目还没做完）。

export interface ProjectRef {
  id: string
  name: string
  url: string
}

export interface IslandDef {
  id: string
  name: string // 岛名（也可以直接用孩子名）
  builder: string // 造岛人（孩子名，占位）
  position: [number, number] // 海面坐标 [x, z]
  theme: 'forest' | 'volcano' | 'snow'
  projects: ProjectRef[]
}

const demo = (title: string, emoji: string, hue: number) =>
  `demo.html?title=${encodeURIComponent(title)}&emoji=${encodeURIComponent(emoji)}&hue=${hue}`

// —— 孩子名册：一个孩子 = 数组里一条 ——
// 加一个孩子 = 往下面 push 一个对象（不用理解取模规则，也不会名字/作品错位）。
// 没写 project 即迷雾岛（作品还没做完）；位置由 genIslands 用向日葵螺旋自动排布。
interface Child {
  name: string // 岛名
  builder: string // 造岛人（孩子名）
  theme: IslandDef['theme']
  project?: { title: string; emoji: string; hue: number } // 作品；不写 = 迷雾岛
}

const CHILDREN: Child[] = [
  { name: "明澈屿", builder: "小鱼", theme: "forest", project: { title: "会游泳的锦鲤池", emoji: "🐟", hue: 195 } },
  { name: "熔金岛", builder: "石头", theme: "volcano", project: { title: "森林跑酷大冒险", emoji: "🏃", hue: 25 } },
  { name: "雪鲸岛", builder: "朵朵", theme: "snow" },
  { name: "苔环礁", builder: "阿澄", theme: "forest", project: { title: "像素画板", emoji: "🎨", hue: 285 } },
  { name: "曦光岛", builder: "糖糖", theme: "volcano", project: { title: "星空音乐盒", emoji: "🎵", hue: 250 } },
  { name: "黑曜屿", builder: "大壮", theme: "snow" },
  { name: "雾隐洲", builder: "小南", theme: "forest", project: { title: "会说话的小树", emoji: "🌳", hue: 110 } },
  { name: "眠月沙洲", builder: "一一", theme: "volcano", project: { title: "太空跳跳球", emoji: "🚀", hue: 265 } },
  { name: "未名之岛", builder: "康康", theme: "snow" },
  { name: "芽芽岛", builder: "芽芽", theme: "forest", project: { title: "打字忍者", emoji: "⌨️", hue: 205 } },
  { name: "珊瑚屿", builder: "豆豆", theme: "volcano", project: { title: "天气预报员", emoji: "☀️", hue: 45 } },
  { name: "潮汐礁", builder: "可乐", theme: "snow" },
  { name: "星砂洲", builder: "团团", theme: "forest", project: { title: "节奏鼓手", emoji: "🥁", hue: 15 } },
  { name: "蓝羽岛", builder: "西西", theme: "volcano", project: { title: "故事接龙", emoji: "📖", hue: 235 } },
  { name: "松风屿", builder: "牛牛", theme: "snow" },
  { name: "拾光岛", builder: "乐乐", theme: "forest", project: { title: "弹球物理台", emoji: "🎱", hue: 155 } },
  { name: "鹿鸣洲", builder: "妞妞", theme: "volcano", project: { title: "记忆翻翻乐", emoji: "🃏", hue: 300 } },
  { name: "归帆岛", builder: "阿布", theme: "snow" },
  { name: "听涛礁", builder: "毛毛", theme: "forest", project: { title: "声音画笔", emoji: "🎙️", hue: 275 } },
  { name: "晚霞屿", builder: "果果", theme: "volcano", project: { title: "星座连线", emoji: "✨", hue: 225 } },
  { name: "萤火洲", builder: "多多", theme: "snow" },
  { name: "海雾岛", builder: "安安", theme: "forest", project: { title: "森林跑酷大冒险", emoji: "🏃", hue: 25 } },
  { name: "贝壳礁", builder: "桃子", theme: "volcano", project: { title: "词根星球", emoji: "🪐", hue: 215 } },
  { name: "栖梦岛", builder: "囡囡", theme: "snow" },
  { name: "椰影屿", builder: "嘟嘟", theme: "forest", project: { title: "星空音乐盒", emoji: "🎵", hue: 250 } },
  { name: "碧波洲", builder: "小满", theme: "volcano", project: { title: "口算大作战", emoji: "🧮", hue: 140 } },
  { name: "风铃岛", builder: "阿宝", theme: "snow" },
  { name: "初见礁", builder: "花卷", theme: "forest", project: { title: "太空跳跳球", emoji: "🚀", hue: 265 } },
  { name: "远航屿", builder: "布丁", theme: "volcano", project: { title: "颜色魔法师", emoji: "🌈", hue: 320 } },
  { name: "银浪岛", builder: "年糕", theme: "snow" },
]

// 确定性随机（16807 LCG）：让布局可复现、可逐帧调试
function lcg(seed: number): () => number {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

// 把名册排布成海面上的岛：向日葵螺旋定位，其余字段直接来自 CHILDREN[i]。
function genIslands(): IslandDef[] {
  const rng = lcg(20260713)
  const N = CHILDREN.length
  const GOLDEN = Math.PI * (3 - Math.sqrt(5)) // 向日葵角，铺得最均匀
  return CHILDREN.map((c, i): IslandDef => {
    // 向日葵螺旋 + 抖动：由内向外均匀铺满一大片海（岛放大后间距同步加大，避免叠岛）
    const rr = 55 + Math.sqrt(i / N) * 560 // 半径 55→615
    const a = i * GOLDEN + (rng() - 0.5) * 0.45
    const jitter = (rng() - 0.5) * 44
    const x = Math.round(Math.cos(a) * rr + jitter)
    const z = Math.round(Math.sin(a) * rr + (rng() - 0.5) * 44)
    return {
      id: `isle-${i}`,
      name: c.name,
      builder: c.builder,
      position: [x, z],
      theme: c.theme,
      projects: c.project ? [{ id: `p-${i}`, name: c.project.title, url: demo(c.project.title, c.project.emoji, c.project.hue) }] : [],
    }
  })
}

/** 30 座岛铺在一片更大的海上；镜头跟随船，边开边现新岛。 */
export const ISLANDS: IslandDef[] = genIslands()

/** 世界软边界半径（超出后雾变浓、船被温柔拽回；绕原点） */
export const WORLD_RADIUS = 640
/** 出生点（海中心开阔水域，四周被群岛环绕，朝任意方向探索） */
export const SPAWN: [number, number] = [0, 0]

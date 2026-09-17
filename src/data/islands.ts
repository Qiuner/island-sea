export interface ProjectRef {
  id: string
  name: string
  url: string
  cover?: string
}

export interface IslandPhotoRef {
  id: string
  url: string
  caption?: string
  alt: string
}

export interface IslandSource {
  id: string
  name: string
  builder: string
  description?: string
  theme: 'forest' | 'volcano' | 'snow'
  projects: ProjectRef[]
  photos: IslandPhotoRef[]
}

export interface IslandDef extends IslandSource {
  position: [number, number]
}

function localPhoto(
  islandId: string,
  index: number,
  fileName: string,
  builder: string,
): IslandPhotoRef {
  return {
    id: `${islandId}-photo-${String(index).padStart(2, '0')}`,
    url: `./camp-photos/${fileName}`,
    caption: `训练营现场 ${index}`,
    alt: `${builder}在未来造物局训练营的活动照片`,
  }
}

const PROJECT_PREVIEWS: Record<string, string> = {
  '/planet-party/': './work-previews/planet-party.webp',
  '/scenic-map/': './work-previews/scenic-map.webp',
  '/idea-pilot/': './work-previews/idea-pilot.webp',
  '/oriental-pearl/': './work-previews/oriental-pearl.webp',
  '/suminagashi-demo/': './works/suminagashi-demo/preview.webp',
  '/measured-demo/': './works/measured-demo/preview.webp',
}

export function projectPreviewFor(url: string): string | undefined {
  const match = Object.entries(PROJECT_PREVIEWS).find(([path]) => url.includes(path))
  return match?.[1]
}

// 2026-08-02 线上公开接口快照：本地后端不可用时仍能完整预览已发布岛屿。
const PUBLISHED_ISLAND_SNAPSHOT: IslandSource[] = [
  {
    id: 'island-10001',
    name: '奥秘星球',
    builder: '杨空聆',
    description: '驾驶圆滚小生物球球，参加五种玩法组成的星际派对竞技大赛。',
    theme: 'volcano',
    projects: [
      {
        id: 'project-10001',
        name: '星球派对：圆滚冒险',
        url: 'https://fmlab.vip/island/works/planet-party/',
        cover: projectPreviewFor('https://fmlab.vip/island/works/planet-party/'),
      },
    ],
    photos: [
      localPhoto('island-10001', 1, 'yang-kongling-01.jpg', '杨空聆'),
      localPhoto('island-10001', 2, 'yang-kongling-02.jpg', '杨空聆'),
      localPhoto('island-10001', 3, 'yang-kongling-03.jpg', '杨空聆'),
      localPhoto('island-10001', 4, 'yang-kongling-04.jpg', '杨空聆'),
    ],
  },
  {
    id: 'island-10002',
    name: '神州漫游岛',
    builder: '钟昊恩',
    description: '在全国地图上探索 5A 景区，随机发现城市与景点。',
    theme: 'forest',
    projects: [
      {
        id: 'project-10002',
        name: '全国 5A 景区探索地图',
        url: 'https://fmlab.vip/island/works/scenic-map/',
        cover: projectPreviewFor('https://fmlab.vip/island/works/scenic-map/'),
      },
    ],
    photos: [
      localPhoto('island-10002', 1, 'zhong-haoen-01.jpg', '钟昊恩'),
      localPhoto('island-10002', 2, 'zhong-haoen-02.jpg', '钟昊恩'),
      localPhoto('island-10002', 3, 'zhong-haoen-03.jpg', '钟昊恩'),
    ],
  },
  {
    id: 'island-10003',
    name: '思辨启航岛',
    builder: '王惠诚',
    description: '用严肃的逐步诊断，把模糊项目想法收敛成可验证的 MVP 和开发提示词。',
    theme: 'snow',
    projects: [
      {
        id: 'project-10003',
        name: 'IdeaPilot 想法明确工具',
        url: 'https://fmlab.vip/island/works/idea-pilot/',
        cover: projectPreviewFor('https://fmlab.vip/island/works/idea-pilot/'),
      },
    ],
    photos: [
      localPhoto('island-10003', 1, 'wang-huicheng-01.jpg', '王惠诚'),
      localPhoto('island-10003', 2, 'wang-huicheng-02.jpg', '王惠诚'),
      localPhoto('island-10003', 3, 'wang-huicheng-03.jpg', '王惠诚'),
      localPhoto('island-10003', 4, 'wang-huicheng-04.jpg', '王惠诚'),
      localPhoto('island-10003', 5, 'wang-huicheng-05.jpg', '王惠诚'),
    ],
  },
  {
    id: 'island-10004',
    name: '东方明珠岛',
    builder: '陈岂帆',
    description: '操控小旅人在 3D 陆家嘴自由行走，探索东方明珠、上海中心等地标并切换昼夜景观。',
    theme: 'snow',
    projects: [
      {
        id: 'project-10004',
        name: '云游·东方明珠',
        url: 'https://fmlab.vip/island/works/oriental-pearl/',
        cover: projectPreviewFor('https://fmlab.vip/island/works/oriental-pearl/'),
      },
    ],
    photos: [
      localPhoto('island-10004', 1, 'chen-qifan-01.jpg', '陈岂帆'),
      localPhoto('island-10004', 2, 'chen-qifan-02.jpg', '陈岂帆'),
      localPhoto('island-10004', 3, 'chen-qifan-03.jpg', '陈岂帆'),
      localPhoto('island-10004', 4, 'chen-qifan-04.jpg', '陈岂帆'),
    ],
  },
]

const DEMO_ISLANDS: IslandSource[] = [
  {
    id: 'demo-island-yang-kongling',
    name: '墨流岛',
    builder: '陈宇泽',
    description: '以墨流视觉实验作为作品入口，展示流动纹理与色彩扩散的节奏感。',
    theme: 'forest',
    projects: [
      {
        id: 'demo-project-suminagashi',
        name: '墨流 Suminagashi',
        url: 'https://island.fmlab.vip/works/suminagashi-demo/',
        cover: projectPreviewFor('https://island.fmlab.vip/works/suminagashi-demo/'),
      },
    ],
    photos: [],
  },
  {
    id: 'demo-island-zhong-haoen',
    name: '测量岛',
    builder: '林伟宸',
    description: '聚焦视觉构图与版式测量，让页面结构和留白关系一眼可见。',
    theme: 'snow',
    projects: [
      {
        id: 'demo-project-measured',
        name: 'Measured 视觉首页',
        url: 'https://island.fmlab.vip/works/measured-demo/',
        cover: projectPreviewFor('https://island.fmlab.vip/works/measured-demo/'),
      },
    ],
    photos: [],
  },
]

const FUTURE_ISLAND_COUNT = 12
const THEMES: IslandSource['theme'][] = ['forest', 'volcano', 'snow']
const FUTURE_ISLANDS: IslandSource[] = Array.from({ length: FUTURE_ISLAND_COUNT }, (_, index) => ({
  id: `future-island-${String(index + 1).padStart(2, '0')}`,
  name: `二期待启航岛 ${String(index + 1).padStart(2, '0')}`,
  builder: '未来造物局',
  description: '等待未来造物局二期开班',
  theme: THEMES[index % THEMES.length],
  projects: [],
  photos: [],
}))

function lcg(seed: number): () => number {
  let state = seed % 2147483647
  if (state <= 0) state += 2147483646
  return () => (state = (state * 16807) % 2147483647) / 2147483647
}

function sourceSeed(source: IslandSource): number {
  let hash = 2166136261
  for (const char of source.id) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash) || 20260713
}

export function layoutIslands(sources: IslandSource[]): IslandDef[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))

  return sources.map((source, index) => {
    const rng = lcg(sourceSeed(source))
    // 半径只依赖排序位置，抖动只依赖稳定 ID。末尾新增岛屿时，已有岛不会整体漂移。
    const radius = Math.min(570, 55 + Math.sqrt(index) * 95)
    const angle = index * goldenAngle + (rng() - 0.5) * 0.45
    const jitter = (rng() - 0.5) * 44
    const x = Math.round(Math.cos(angle) * radius + jitter)
    const z = Math.round(Math.sin(angle) * radius + (rng() - 0.5) * 44)
    return { ...source, position: [x, z] }
  })
}

export function layoutIslandWorld(publishedSources: IslandSource[]): IslandDef[] {
  const activeSources = [...publishedSources, ...DEMO_ISLANDS]
  const activeIds = new Set(activeSources.map(source => source.id))
  const futureSources = FUTURE_ISLANDS.filter(source => !activeIds.has(source.id))
  return layoutIslands([...activeSources, ...futureSources])
}

export const LOCAL_FALLBACK_ISLANDS = layoutIslandWorld(PUBLISHED_ISLAND_SNAPSHOT)
export const WORLD_RADIUS = 640
export const SPAWN: [number, number] = [0, 0]

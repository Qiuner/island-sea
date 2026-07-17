export interface ProjectRef {
  id: string
  name: string
  url: string
}

export interface IslandSource {
  id: string
  name: string
  builder: string
  description?: string
  theme: 'forest' | 'volcano' | 'snow'
  projects: ProjectRef[]
}

export interface IslandDef extends IslandSource {
  position: [number, number]
}

const DEMO_SOURCES: IslandSource[] = [
  { id: 'demo-1', name: '明澈屿', builder: '小鱼', theme: 'forest', projects: [] },
  { id: 'demo-2', name: '熔金岛', builder: '石头', theme: 'volcano', projects: [] },
  { id: 'demo-3', name: '雪鲸岛', builder: '朵朵', theme: 'snow', projects: [] },
]

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

export const DEMO_ISLANDS = layoutIslands(DEMO_SOURCES)
export const WORLD_RADIUS = 640
export const SPAWN: [number, number] = [0, 0]

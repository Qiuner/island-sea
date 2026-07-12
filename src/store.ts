import { reactive, computed } from 'vue'
import { ISLANDS, type IslandDef } from './data/islands'

// 界面与 3D 世界共享的状态。解锁进度存 localStorage（"每个访客自己的"），
// 岛数据本身不带状态 —— foggy 由 projects 是否为空派生，visited 由本地进度派生。

const LS_VISITED = 'island-sea:visited'
const LS_KNOWN = 'island-sea:known-projects'
const LS_THEME = 'island-sea:theme'

export type Mode = 'sailing' | 'docked' | 'landed'

function loadVisited(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LS_VISITED) ?? '[]')
  } catch {
    return []
  }
}

export const store = reactive({
  visited: new Set<string>(loadVisited()),
  /** ?unlock=all 等演示钩子只改内存，不落盘 */
  ephemeral: false,
  theme: (localStorage.getItem(LS_THEME) === 'night' ? 'night' : 'day') as 'day' | 'night',
  /** 当前时段名（白天/黄昏/夜晚/黎明）—— 由 World 随全天流转写入，供 Hud 显示 */
  todLabel: '白天',
  mode: 'sailing' as Mode,
  dockedId: null as string | null,
  targetId: null as string | null,
  /** 等待播放生长动画的岛（播完前对外仍视为迷雾） */
  pendingGrow: new Set<string>(),
  toast: '',
  toastKey: 0,
  debug: false,
})

export function islandById(id: string): IslandDef | undefined {
  return ISLANDS.find(i => i.id === id)
}

export function statusOf(def: IslandDef): 'foggy' | 'locked' | 'visited' {
  if (def.projects.length === 0 || store.pendingGrow.has(def.id)) return 'foggy'
  return store.visited.has(def.id) ? 'visited' : 'locked'
}

export const discoverableCount = computed(
  () => ISLANDS.filter(i => i.projects.length > 0 && !store.pendingGrow.has(i.id)).length,
)
export const foundCount = computed(
  () => ISLANDS.filter(i => i.projects.length > 0 && store.visited.has(i.id)).length,
)

export function markVisited(id: string): void {
  store.visited.add(id)
  if (!store.ephemeral) {
    localStorage.setItem(LS_VISITED, JSON.stringify([...store.visited]))
  }
}

export function setTheme(t: 'day' | 'night'): void {
  store.theme = t
  localStorage.setItem(LS_THEME, t)
}

export function showToast(msg: string): void {
  store.toast = msg
  store.toastKey++
}

/**
 * 生长检测：上次来时还是迷雾岛（记录过 projects=0）、这次有项目了 → 排队播生长动画。
 * 首次访问不播（没有"上次"可对比）。返回要播的岛 id 列表（按数据顺序）。
 */
export function detectGrowth(): string[] {
  let known: Record<string, number> = {}
  try {
    known = JSON.parse(localStorage.getItem(LS_KNOWN) ?? 'null') ?? {}
  } catch {
    known = {}
  }
  const firstRun = Object.keys(known).length === 0
  const grew: string[] = []
  for (const isl of ISLANDS) {
    if (!firstRun && isl.projects.length > 0 && known[isl.id] === 0) grew.push(isl.id)
  }
  const next: Record<string, number> = {}
  for (const isl of ISLANDS) next[isl.id] = isl.projects.length
  // 演示钩子(?unlock=all 等)只改内存不落盘，避免污染真实进度
  if (!store.ephemeral) localStorage.setItem(LS_KNOWN, JSON.stringify(next))
  return grew
}

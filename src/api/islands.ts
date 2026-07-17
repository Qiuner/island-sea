import { DEMO_ISLANDS, layoutIslands, type IslandDef, type IslandSource } from '../data/islands'

interface ApiResponse<T> {
  code: number
  msg?: string
  data: T
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

function isTheme(value: unknown): value is IslandSource['theme'] {
  return value === 'forest' || value === 'volcano' || value === 'snow'
}

function normalizeSources(value: unknown): IslandSource[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): IslandSource[] => {
    if (!item || typeof item !== 'object') return []
    const source = item as Record<string, unknown>
    if (
      typeof source.id !== 'string' ||
      typeof source.name !== 'string' ||
      typeof source.builder !== 'string' ||
      !isTheme(source.theme)
    ) {
      return []
    }
    const projects = Array.isArray(source.projects)
      ? source.projects.flatMap((project): IslandSource['projects'] => {
          if (!project || typeof project !== 'object') return []
          const entry = project as Record<string, unknown>
          if (
            typeof entry.id !== 'string' ||
            typeof entry.name !== 'string' ||
            typeof entry.url !== 'string'
          ) {
            return []
          }
          return [{ id: entry.id, name: entry.name, url: entry.url }]
        })
      : []
    return [{
      id: source.id,
      name: source.name,
      builder: source.builder,
      description: typeof source.description === 'string' ? source.description : undefined,
      theme: source.theme,
      projects,
    }]
  })
}

export async function fetchPublishedIslands(): Promise<IslandDef[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/open/islands`, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const body = await response.json() as ApiResponse<unknown>
    if (body.code !== 200) throw new Error(body.msg || '官网岛屿接口返回失败')
    return layoutIslands(normalizeSources(body.data))
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[island-sea] 后端不可用，开发环境使用演示岛屿。', error)
      return DEMO_ISLANDS
    }
    throw error
  }
}

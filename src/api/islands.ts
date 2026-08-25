import {
  LOCAL_FALLBACK_ISLANDS,
  layoutIslandWorld,
  projectPreviewFor,
  type IslandDef,
  type IslandSource,
} from '../data/islands'

interface ApiResponse<T> {
  code: number
  msg?: string
  data: T
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

function isTheme(value: unknown): value is IslandSource['theme'] {
  return value === 'forest' || value === 'volcano' || value === 'snow'
}

function normalizeMediaUrl(value: string): string {
  const url = value.trim()
  if (url.startsWith('/island/camp-photos/')) return url.replace(/^\/island/, '')
  return url.startsWith('/profile/') ? `${API_BASE_URL}${url}` : url
}

function normalizeProjectUrl(value: string): string {
  const url = value.trim()
  if (url.startsWith('https://fmlab.vip/island/works/')) {
    return url.replace('https://fmlab.vip/island/works/', 'https://island.fmlab.vip/works/')
  }
  if (url.startsWith('https://island.fmlab.vip/island/works/')) {
    return url.replace('https://island.fmlab.vip/island/works/', 'https://island.fmlab.vip/works/')
  }
  if (url.startsWith('/island/works/')) return url.replace(/^\/island/, '')
  return url
}

function withDevelopmentPhotos(islands: IslandDef[]): IslandDef[] {
  if (!import.meta.env.DEV) return islands

  const localById = new Map(LOCAL_FALLBACK_ISLANDS.map(item => [item.id, item]))
  return islands.map(island => {
    const local = localById.get(island.id)
    if (!local || local.projects.length === 0) return island
    return {
      ...island,
      builder: local.builder,
      photos: island.photos.length ? island.photos : local.photos,
    }
  })
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
          const projectUrl = normalizeProjectUrl(entry.url)
          return [{
            id: entry.id,
            name: entry.name,
            url: projectUrl,
            cover: typeof entry.cover === 'string' ? normalizeMediaUrl(entry.cover) : projectPreviewFor(projectUrl),
          }]
        })
      : []
    const photos = Array.isArray(source.photos)
      ? source.photos.flatMap((photo): IslandSource['photos'] => {
          if (!photo || typeof photo !== 'object') return []
          const entry = photo as Record<string, unknown>
          if (
            typeof entry.id !== 'string' ||
            typeof entry.url !== 'string' ||
            typeof entry.alt !== 'string' ||
            !entry.url.trim() ||
            !entry.alt.trim()
          ) {
            return []
          }
          return [{
            id: entry.id,
            url: normalizeMediaUrl(entry.url),
            caption: typeof entry.caption === 'string' ? entry.caption : undefined,
            alt: entry.alt,
          }]
        })
      : []
    return [{
      id: source.id,
      name: source.name,
      builder: source.builder,
      description: typeof source.description === 'string' ? source.description : undefined,
      theme: source.theme,
      projects,
      photos,
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
    return withDevelopmentPhotos(layoutIslandWorld(normalizeSources(body.data)))
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[island-sea] 后端不可用，开发环境使用演示岛屿。', error)
      return withDevelopmentPhotos(LOCAL_FALLBACK_ISLANDS)
    }
    throw error
  }
}

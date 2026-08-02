import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

async function loadIslandModule() {
  const source = await fs.readFile(new URL('../src/data/islands.ts', import.meta.url), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2021,
    },
  }).outputText
  const encoded = Buffer.from(output).toString('base64')
  return import(`data:text/javascript;base64,${encoded}`)
}

const SOURCES = [
  { id: 'island-1', name: '一号岛', builder: '甲', theme: 'forest', projects: [], photos: [] },
  { id: 'island-2', name: '二号岛', builder: '乙', theme: 'volcano', projects: [], photos: [] },
  { id: 'island-3', name: '三号岛', builder: '丙', theme: 'snow', projects: [], photos: [] },
]

test('layout is deterministic for the same ordered sources', async () => {
  const { layoutIslands } = await loadIslandModule()
  assert.deepEqual(layoutIslands(SOURCES), layoutIslands(SOURCES))
})

test('appending an island preserves existing island positions', async () => {
  const { layoutIslands } = await loadIslandModule()
  const before = layoutIslands(SOURCES)
  const after = layoutIslands([
    ...SOURCES,
    { id: 'island-4', name: '四号岛', builder: '丁', theme: 'forest', projects: [], photos: [] },
  ])

  assert.deepEqual(
    after.slice(0, before.length).map(island => island.position),
    before.map(island => island.position),
  )
})

test('local fallback contains the four published islands and future inactive islands', async () => {
  const { LOCAL_FALLBACK_ISLANDS } = await loadIslandModule()
  const active = LOCAL_FALLBACK_ISLANDS.filter(island => island.projects.length > 0)
  const inactive = LOCAL_FALLBACK_ISLANDS.filter(island => island.projects.length === 0)

  assert.deepEqual(
    active.map(island => island.name),
    ['奥秘星球', '神州漫游岛', '思辨启航岛', '东方明珠岛'],
  )
  assert.deepEqual(
    active.map(island => [island.builder, island.photos.length]),
    [
      ['杨空聆', 4],
      ['钟昊恩', 3],
      ['王惠诚', 5],
      ['陈岂帆', 4],
    ],
  )
  assert.equal(inactive.length, 12)
  assert.ok(inactive.every(island => island.name.startsWith('二期待启航岛')))
})

test('future inactive islands are appended to API-provided islands too', async () => {
  const { layoutIslandWorld } = await loadIslandModule()
  const world = layoutIslandWorld([{
    id: 'published-island',
    name: '已发布岛',
    builder: '学员',
    theme: 'forest',
    projects: [{ id: 'work', name: '作品', url: 'https://example.com' }],
    photos: [],
  }])

  assert.equal(world.filter(island => island.projects.length > 0).length, 1)
  assert.equal(world.filter(island => island.projects.length === 0).length, 12)
})

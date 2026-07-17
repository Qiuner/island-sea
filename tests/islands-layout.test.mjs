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
  { id: 'island-1', name: '一号岛', builder: '甲', theme: 'forest', projects: [] },
  { id: 'island-2', name: '二号岛', builder: '乙', theme: 'volcano', projects: [] },
  { id: 'island-3', name: '三号岛', builder: '丙', theme: 'snow', projects: [] },
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
    { id: 'island-4', name: '四号岛', builder: '丁', theme: 'forest', projects: [] },
  ])

  assert.deepEqual(
    after.slice(0, before.length).map(island => island.position),
    before.map(island => island.position),
  )
})

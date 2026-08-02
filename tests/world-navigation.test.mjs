import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

async function loadNavigation(store) {
  globalThis.__navigationTestStore = store
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../src/three/world-navigation.ts', import.meta.url))],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    plugins: [{
      name: 'navigation-store-stub',
      setup(builder) {
        builder.onResolve({ filter: /^\.\.\/store$/ }, () => ({
          path: 'store-stub',
          namespace: 'navigation-test',
        }))
        builder.onLoad({ filter: /.*/, namespace: 'navigation-test' }, () => ({
          contents: `
            export const store = globalThis.__navigationTestStore
            export const foundCount = { value: 1 }
            export const discoverableCount = { value: 1 }
            export const islandById = id => store.islands.find(island => island.id === id)
            export const statusOf = def => store.visited.has(def.id) ? 'visited' : 'locked'
            export const markVisited = id => store.visited.add(id)
            export const showToast = () => {}
          `,
          loader: 'js',
        }))
      },
    }],
  })
  const source = Buffer.from(result.outputFiles[0].text).toString('base64')
  return import(`data:text/javascript;base64,${source}`)
}

test('reaching a discoverable island lands and focuses it immediately', async () => {
  const island = {
    id: 'island-1',
    name: '测试岛',
    builder: '测试学员',
    theme: 'forest',
    projects: [{ id: 'work-1', name: '作品', url: '/works/1' }],
    position: [10, 20],
  }
  const store = {
    islands: [island],
    visited: new Set([island.id]),
    mode: 'sailing',
    dockedId: null,
    targetId: island.id,
  }
  const ship = {
    pos: { x: 10, z: 48 },
    heading: 0,
    speed: 2.6,
  }
  let focused = false
  let landAnchor = null
  const islandObject = {
    radius: 20,
    group: { position: { x: 10, z: 20 } },
    setFocused(value) {
      focused = value
    },
  }
  const { WorldNavigation } = await loadNavigation(store)
  const navigation = new WorldNavigation({
    getSimTime: () => 3,
    clearControls: () => {},
    getShipState: () => ship,
    getIslandObject: id => id === island.id ? islandObject : undefined,
    spawnUnlockRing: () => {},
    setLandAnchor: (sim, angle) => {
      landAnchor = { sim, angle }
    },
  })

  navigation.tryDockCandidate(island, islandObject, 28, 3)

  assert.equal(store.mode, 'landed')
  assert.equal(store.dockedId, island.id)
  assert.equal(ship.speed, 0)
  assert.equal(focused, true)
  assert.deepEqual(landAnchor, { sim: 3, angle: 0 })
})

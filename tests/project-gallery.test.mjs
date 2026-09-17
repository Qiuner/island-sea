import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const mainSource = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8')
const gallerySource = await readFile(new URL('../src/pages/ProjectGallery.vue', import.meta.url), 'utf8')
const loadingSource = await readFile(new URL('../src/loading-screen.ts', import.meta.url), 'utf8')
const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8')

test('project archive is available without loading the 3D world', () => {
  assert.match(mainSource, /\/projects/)
  assert.match(mainSource, /import\('\.\/pages\/ProjectGallery\.vue'\)/)
  assert.match(mainSource, /import\('\.\/App\.vue'\)/)
  assert.doesNotMatch(mainSource, /import App from '\.\/App\.vue'/)
})

test('project archive skips the interactive world bootstrap and global stylesheet', () => {
  assert.match(mainSource, /Promise\.all\(\[/)
  assert.match(mainSource, /import\('\.\/style\.css'\)/)
  assert.doesNotMatch(mainSource, /^import '\.\/style\.css'/m)
  assert.match(loadingSource, /if \(!isProjectGallery\)/)
  assert.match(loadingSource, /import\('\.\/loading-scene'\)/)
  assert.doesNotMatch(loadingSource, /^import \{ initLoadingScene \}/m)
  assert.match(indexSource, /project-gallery-route/)
  assert.match(indexSource, /html\.project-gallery-route #loading \{ display: none; \}/)
})

test('project archive flattens island projects and keeps island as presentation metadata', () => {
  assert.match(gallerySource, /islands\.flatMap\(island => island\.projects\.map/)
  assert.match(gallerySource, /islandName: island\.name/)
  assert.match(gallerySource, /photos: island\.photos/)
  assert.match(gallerySource, /小岛介绍/)
  assert.match(gallerySource, /造物时刻/)
  assert.match(gallerySource, /v-for="photo in selected\.photos"/)
  assert.match(gallerySource, /进入小岛/)
  assert.match(gallerySource, /打开项目/)
  assert.match(gallerySource, /image\?\.startsWith\('\.\/'\)/)
})

test('project archive provides compact and immersive responsive views', () => {
  assert.match(gallerySource, /view === 'grid'/)
  assert.match(gallerySource, /view === 'focus'/)
  assert.match(gallerySource, /project-gallery\.is-focus/)
  assert.match(gallerySource, /loading="lazy"/)
  assert.match(gallerySource, /fetchpriority="index === 0 \? 'high' : 'auto'"/)
  assert.match(gallerySource, /project-gallery-skeleton/)
  assert.match(gallerySource, /content-visibility: auto/)
  assert.match(gallerySource, /@media \(max-width: 680px\)/)
  assert.match(gallerySource, /<h1>项目集<\/h1>/)
  assert.doesNotMatch(gallerySource, /从项目开始，看见每一座小岛/)
  assert.doesNotMatch(gallerySource, /查看项目介绍/)
})

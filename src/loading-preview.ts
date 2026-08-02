import { initLoadingScene } from './loading-scene'

const canvas = document.getElementById('scene') as HTMLCanvasElement | null

if (!canvas) {
  throw new Error('loading preview canvas not found')
}
initLoadingScene(canvas)

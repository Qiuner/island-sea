import { initLoadingScene } from './loading-scene'

const canvas = document.getElementById('loading-scene') as HTMLCanvasElement | null

if (canvas) {
  const dispose = initLoadingScene(canvas)
  const loading = document.getElementById('loading')
  if (loading) {
    const observer = new MutationObserver(() => {
      if (!loading.isConnected) {
        observer.disconnect()
        dispose()
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  }
}

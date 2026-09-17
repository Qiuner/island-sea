const isProjectGallery = /^\/projects\/?$/.test(window.location.pathname)

if (!isProjectGallery) {
  const canvas = document.getElementById('loading-scene') as HTMLCanvasElement | null

  if (canvas) {
    import('./loading-scene').then(({ initLoadingScene }) => {
      if (!canvas.isConnected) return

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
    })
  }
}

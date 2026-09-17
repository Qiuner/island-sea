import { createApp } from 'vue'

const isProjectGallery = /^\/projects\/?$/.test(window.location.pathname)

if (isProjectGallery) {
  document.documentElement.classList.add('project-gallery-route')
  document.getElementById('loading')?.remove()
  import('./pages/ProjectGallery.vue').then(({ default: ProjectGallery }) => {
    createApp(ProjectGallery).mount('#app')
  })
} else {
  Promise.all([
    import('./style.css'),
    import('./App.vue'),
  ]).then(([, { default: App }]) => {
    createApp(App).mount('#app')
  })
}

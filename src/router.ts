import { createRouter, createWebHashHistory } from 'vue-router'
import ProjectView from './views/ProjectView.vue'

// hash 路由：静态托管到任意子路径 / 双击本地打开都能跑
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: { render: () => null } },
    { path: '/p/:islandId/:projectId', component: ProjectView },
    { path: '/:rest(.*)', redirect: '/' },
  ],
})

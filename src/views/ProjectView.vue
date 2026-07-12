<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { islandById } from '../store'
import { getWorld } from '../three/world'

// 项目详情：iframe 全屏嵌入。打开时暂停 3D 渲染（把 GPU 让给孩子的作品），
// 键盘也交还给 iframe（world.setPaused 会停掉船的按键响应）。

const route = useRoute()
const router = useRouter()

const island = computed(() => islandById(String(route.params.islandId)))
const project = computed(() =>
  island.value?.projects.find(p => p.id === String(route.params.projectId)),
)

function back() {
  router.push('/')
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') back()
}

onMounted(() => {
  getWorld()?.setPaused(true)
  window.addEventListener('keydown', onKey)
  if (!island.value || !project.value) back()
})
onUnmounted(() => {
  getWorld()?.setPaused(false)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div v-if="island && project" class="project-view">
    <header class="project-bar">
      <button class="back-sea" @click="back">↩ 回到岛上</button>
      <div class="title">🏝 {{ island.name }} · 《{{ project.name }}》<span class="by">{{ island.builder }} 造</span></div>
      <a class="open-new" :href="project.url" target="_blank" rel="noreferrer">新窗口打开 ↗</a>
    </header>
    <iframe
      :src="project.url"
      :title="project.name"
      allow="fullscreen; gamepad; xr-spatial-tracking"
      sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups allow-downloads"
    ></iframe>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { createWorld } from './three/world'
import { fetchPublishedIslands } from './api/islands'
import Hud from './components/Hud.vue'
import Minimap from './components/Minimap.vue'
import IslandList from './components/IslandList.vue'
import IslandPanel from './components/IslandPanel.vue'
import MobileControls from './components/MobileControls.vue'
import { islandById, setIslands, store } from './store'

const glCanvas = ref<HTMLCanvasElement | null>(null)
const failed = ref(false)
const empty = ref(false)

onMounted(async () => {
  if (!glCanvas.value) return
  try {
    const islands = await fetchPublishedIslands()
    setIslands(islands)
    empty.value = islands.length === 0
    const world = createWorld(glCanvas.value, islands)
    world.onOpenProject = (islandId, projectId) => {
      const project = islandById(islandId)?.projects.find(item => item.id === projectId)
      if (project) window.open(project.url, '_blank', 'noopener,noreferrer')
    }
  } catch (e) {
    failed.value = true
    // 兜底：#loading 遮罩在 #app 之外，只有首帧渲染成功才会淡出移除。
    // 若初始化在渲染器建好之后抛错（shader 编译/建岛/纹理等），首帧永不到来，
    // 这里把 loading 卡面切到失败文案，但保留整套首屏视觉。
    const el = document.getElementById('loading')
    if (el && !el.dataset.failed) {
      el.dataset.failed = '1'
      el.querySelector('[data-role="status"]')!.textContent = '这片海暂时起雾了'
      el.querySelector('[data-role="subtitle"]')!.textContent = '海岛暂时没能升起来，刷新一下或换台设备再试试。'
    }
    console.error('[island-sea] 世界初始化失败：', e)
  }
})
</script>

<template>
  <div class="stage">
    <canvas ref="glCanvas" class="gl"></canvas>
    <template v-if="!failed">
      <Hud />
      <IslandList v-if="store.mode !== 'landed'" />
      <Minimap v-if="store.mode !== 'landed'" />
      <MobileControls v-if="store.mode !== 'landed'" />
      <IslandPanel v-if="store.mode === 'landed'" />
      <div v-if="empty" class="empty-world">海面正在等待第一座岛</div>
    </template>
  </div>
</template>

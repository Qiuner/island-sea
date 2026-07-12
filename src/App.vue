<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createWorld } from './three/world'
import Hud from './components/Hud.vue'
import Minimap from './components/Minimap.vue'
import IslandList from './components/IslandList.vue'
import IslandPanel from './components/IslandPanel.vue'
import { store } from './store'

const glCanvas = ref<HTMLCanvasElement | null>(null)
const failed = ref(false)
const router = useRouter()

onMounted(() => {
  if (!glCanvas.value) return
  try {
    const world = createWorld(glCanvas.value)
    // 点击岛上宝箱 → 打开对应作品（world 不直接依赖 router，由这里注入）
    world.onOpenProject = (islandId, projectId) => router.push(`/p/${islandId}/${projectId}`)
  } catch {
    failed.value = true
  }
})
</script>

<template>
  <div class="stage">
    <canvas ref="glCanvas" class="gl"></canvas>
    <template v-if="!failed">
      <Hud />
      <IslandList />
      <Minimap />
      <IslandPanel v-if="store.mode === 'landed'" />
      <router-view />
    </template>
  </div>
</template>

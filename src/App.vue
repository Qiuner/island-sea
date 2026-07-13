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
  } catch (e) {
    failed.value = true
    // 兜底：#loading 遮罩在 #app 之外，只有首帧渲染成功才会淡出移除。
    // 若初始化在渲染器建好之后抛错（shader 编译/建岛/纹理等），首帧永不到来，
    // 遮罩会永远停在“正在扬帆”的假加载 —— 这里主动把它转成失败文案。
    const el = document.getElementById('loading')
    if (el && !el.dataset.failed) {
      el.innerHTML = '<p style="letter-spacing:0.1em">海岛暂时没能升起来，刷新一下或换台设备再试试 🌊</p>'
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
      <Minimap />
      <IslandPanel v-if="store.mode === 'landed'" />
      <router-view />
    </template>
  </div>
</template>

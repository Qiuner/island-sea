<script setup lang="ts">
import { computed } from 'vue'
import { store, islandById } from '../store'
import { getWorld } from '../three/world'

const island = computed(() => (store.dockedId ? islandById(store.dockedId) : undefined))

// 键盘/触屏可达的作品入口：不再只依赖点中 3D 漂浮宝箱
function open(projectId: string) {
  const project = island.value?.projects.find(item => item.id === projectId)
  if (project) window.open(project.url, '_blank', 'noopener,noreferrer')
}
function back() {
  getWorld()?.leave()
}
</script>

<template>
  <div v-if="island" class="island-panel">
    <div class="panel-card">
      <p class="builder">{{ island.builder }} 的岛</p>
      <h2>{{ island.name }}</h2>
      <p v-if="island.description" class="island-description">{{ island.description }}</p>

      <!-- 作品可点列表：原生 button，Tab 可聚焦、Enter/Space 可打开；也是点不中 3D 宝箱时的兜底入口 -->
      <div v-if="island.projects.length" class="projects">
        <button
          v-for="p in island.projects"
          :key="p.id"
          class="chest"
          @click="open(p.id)"
        >
          <span class="chest-icon">🧰</span>
          <span class="chest-name">{{ p.name }}</span>
          <span class="chest-open">新窗口打开 →</span>
        </button>
      </div>
      <p v-else class="focus-hint">这座岛的作品还在建造中 🌱</p>

      <p v-if="island.projects.length" class="focus-hint">
        也可以点击岛上漂浮的<b>🧰 宝箱</b>打开
      </p>

      <button class="back" @click="back">↩ 返回海面 <kbd>Esc</kbd></button>
    </div>
  </div>
</template>

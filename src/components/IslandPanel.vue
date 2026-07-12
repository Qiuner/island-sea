<script setup lang="ts">
import { computed } from 'vue'
import { store, islandById } from '../store'
import { getWorld } from '../three/world'

const island = computed(() => (store.dockedId ? islandById(store.dockedId) : undefined))

function back() {
  getWorld()?.leave()
}
</script>

<template>
  <div v-if="island" class="island-panel">
    <div class="panel-card">
      <p class="builder">{{ island.builder }} 的岛</p>
      <h2>{{ island.name }}</h2>
      <p class="focus-hint">
        点击岛上漂浮的<b>🧰 宝箱</b>，打开{{ island.builder }}的作品
      </p>
      <button class="back" @click="back">↩ 返回海面 <kbd>Esc</kbd></button>
    </div>
  </div>
</template>

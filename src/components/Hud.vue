<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { store, foundCount, discoverableCount, islandById } from '../store'
import { getWorld } from '../three/world'

const TOD_ICON: Record<string, string> = { 白天: '☀️', 黄昏: '🌇', 夜晚: '🌙', 黎明: '🌅' }
const todIcon = computed(() => TOD_ICON[store.todLabel] ?? '☀️')

const dockedName = computed(() => (store.dockedId ? islandById(store.dockedId)?.name ?? '' : ''))

const toastVisible = ref(false)
const adminUrl = import.meta.env.VITE_ADMIN_URL || 'http://localhost'
let toastTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => store.toastKey,
  () => {
    toastVisible.value = true
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toastVisible.value = false), 4200)
  },
)

function skipTime() {
  getWorld()?.skipTimeOfDay()
}
function doLand() {
  getWorld()?.land()
}
function openAdmin() {
  window.location.href = adminUrl
}
</script>

<template>
  <div class="hud">
    <!-- 顶部 -->
    <div class="hud-top">
      <div class="chip progress">🏝 已寻获 <b>{{ foundCount }}</b> / {{ discoverableCount }} 座岛</div>
      <div class="wordmark">造物群岛<span>每个孩子都是一座岛</span></div>
      <div class="hud-actions">
        <button class="chip btn" @click="skipTime" title="时间随现实自然流转 · 点击跳到下一个时段">
          {{ todIcon }} {{ store.todLabel }}
        </button>
        <button class="chip btn admin-entry" @click="openAdmin">管理登录</button>
      </div>
    </div>

    <!-- toast -->
    <transition name="toast">
      <div v-if="toastVisible" class="toast" :key="store.toastKey">{{ store.toast }}</div>
    </transition>

    <!-- 底部提示 / 登岛按钮 -->
    <div class="hud-bottom">
      <button v-if="store.mode === 'docked'" class="land-btn" @click="doLand">
        🏝 点击「{{ dockedName }}」登岛 <kbd>Enter</kbd>
      </button>
      <div v-else-if="store.mode === 'sailing'" class="chip hint">
        <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / 方向键 开船 · 点岛屿或小地图即可快速前往
      </div>
    </div>
  </div>
</template>

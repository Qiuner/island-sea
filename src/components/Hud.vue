<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { store, foundCount, discoverableCount } from '../store'
import { getWorld } from '../three/world'

const toastVisible = ref(false)
const adminUrl = import.meta.env.VITE_ADMIN_URL || 'https://fmlab.vip/login'
const paddedFoundCount = computed(() => String(foundCount.value).padStart(2, '0'))
const paddedDiscoverableCount = computed(() => String(discoverableCount.value).padStart(2, '0'))
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
function openAdmin() {
  window.location.href = adminUrl
}
</script>

<template>
  <div class="hud">
    <!-- 顶部 -->
    <div class="hud-top">
      <div class="hud-card progress-card">
        <span class="card-kicker">航线记录</span>
        <span class="card-value"><b>{{ paddedFoundCount }}</b> / {{ paddedDiscoverableCount }}</span>
      </div>
      <div class="wordmark">造物群岛<span>每个孩子都是一座岛</span></div>
      <div class="hud-actions">
        <button class="hud-card hud-button time-card" @click="skipTime" title="时间随现实自然流转 · 点击跳到下一个时段">
          <span class="card-kicker">当前天色</span>
          <span class="card-row">
            <strong>{{ store.todLabel }}</strong>
            <em>切换</em>
          </span>
        </button>
        <button class="hud-card hud-button admin-entry" @click="openAdmin">
          <span class="card-kicker">管理入口</span>
          <span class="card-row"><strong>登录</strong></span>
        </button>
      </div>
    </div>

    <!-- toast -->
    <transition name="toast">
      <div v-if="toastVisible" class="toast" :key="store.toastKey">{{ store.toast }}</div>
    </transition>

    <!-- 底部航行提示 -->
    <div class="hud-bottom">
      <div v-if="store.mode === 'sailing'" class="chip hint">
        <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / 方向键 开船 · 点岛屿或小地图即可快速前往
      </div>
    </div>
  </div>
</template>

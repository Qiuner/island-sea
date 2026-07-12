<script setup lang="ts">
import { ref, computed } from 'vue'
import { ISLANDS } from '../data/islands'
import { statusOf } from '../store'
import { getWorld } from '../three/world'

// 岛屿名录：按孩子名/岛名搜索，点一下即快速前往那座岛（解决 30 个无标签圆点难找人的问题）。
const open = ref(false)
const q = ref('')

const STATUS_DOT: Record<string, string> = { foggy: '#9aa6b4', locked: '#e0a53a', visited: '#5aa86a' }
const STATUS_TXT: Record<string, string> = { foggy: '迷雾中', locked: '待寻获', visited: '已寻获' }

const list = computed(() => {
  const kw = q.value.trim()
  return ISLANDS.map((i) => ({ id: i.id, name: i.name, builder: i.builder, status: statusOf(i) })).filter(
    (i) => !kw || i.name.includes(kw) || i.builder.includes(kw),
  )
})

function go(id: string, status: string) {
  if (status === 'foggy') return
  getWorld()?.fastTravelTo(id)
  open.value = false
}
</script>

<template>
  <div class="island-list">
    <button class="chip btn finder-btn" @click="open = !open">🔎 找岛</button>
    <transition name="toast">
      <div v-if="open" class="list-panel">
        <input v-model="q" class="list-search" placeholder="搜孩子名 / 岛名…" />
        <div class="list-scroll">
          <button
            v-for="it in list"
            :key="it.id"
            class="list-row"
            :class="{ 'is-foggy': it.status === 'foggy' }"
            @click="go(it.id, it.status)"
          >
            <span class="dot" :style="{ background: STATUS_DOT[it.status] }"></span>
            <span class="nm">{{ it.name }}</span>
            <span class="by">{{ it.builder }}</span>
            <span class="st">{{ STATUS_TXT[it.status] }}</span>
          </button>
          <div v-if="!list.length" class="empty">没找到这个孩子的岛</div>
        </div>
      </div>
    </transition>
  </div>
</template>

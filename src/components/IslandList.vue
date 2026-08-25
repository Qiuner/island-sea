<script setup lang="ts">
import { ref, computed } from 'vue'
import { statusOf, store } from '../store'
import { getWorld } from '../three/world'

// 岛屿名录：按孩子名/岛名搜索，点一下直接打开对应作品入口。
const open = ref(true)
const q = ref('')

const STATUS_DOT: Record<string, string> = { foggy: '#9aa6b4', locked: '#e0a53a', visited: '#5aa86a' }
const STATUS_TXT: Record<string, string> = { foggy: '待开放', locked: '打开', visited: '打开' }

const list = computed(() => {
  const kw = q.value.trim().toLowerCase()
  return store.islands.map((i) => ({
    id: i.id,
    name: i.name,
    builder: i.builder,
    status: statusOf(i),
    projectUrl: i.projects[0]?.url,
    projectNames: i.projects.map(project => project.name).join(' '),
  })).filter((i) => {
    if (!kw) return true
    return [i.name, i.builder, i.projectNames, i.id].some(text => text.toLowerCase().includes(kw))
  })
})

function go(id: string, status: string) {
  const island = list.value.find(item => item.id === id)
  if (status !== 'foggy' && island?.projectUrl) {
    window.open(island.projectUrl, '_blank', 'noopener,noreferrer')
    return
  }
  getWorld()?.fastTravelTo(id)
}
</script>

<template>
  <div class="island-list">
    <button class="hud-card hud-button finder-btn" @click="open = !open">
      <span class="nav-mark" aria-hidden="true"></span>
      <span>
        <span class="card-kicker">航海图</span>
        <strong>找岛</strong>
      </span>
    </button>
    <transition name="toast">
      <div v-if="open" class="list-panel">
        <label class="list-search-wrap">
          <span>搜索</span>
          <input v-model="q" class="list-search" placeholder="岛名 / 作者 / 作品…" />
        </label>
        <div class="list-scroll">
          <button
            v-for="it in list"
            :key="it.id"
            class="list-row"
            :class="{ 'is-foggy': it.status === 'foggy' }"
            @click="go(it.id, it.status)"
          >
            <span class="dot" :style="{ background: STATUS_DOT[it.status] }"></span>
            <span class="list-main">
              <span class="nm">{{ it.name }}</span>
              <span class="by">{{ it.builder }}</span>
            </span>
            <span class="st">{{ STATUS_TXT[it.status] }}</span>
          </button>
          <div v-if="!list.length" class="empty">没找到这个孩子的岛</div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import {
  ArrowLeft,
  ArrowUpRight,
  GalleryHorizontal,
  Grid3X3,
  Image as ImageIcon,
  Map,
  Search,
  X,
} from '@lucide/vue'
import { fetchPublishedIslands } from '../api/islands'
import type { IslandDef, IslandPhotoRef, ProjectRef } from '../data/islands'

interface GalleryProject extends ProjectRef {
  islandId: string
  islandName: string
  builder: string
  description: string
  photos: IslandPhotoRef[]
}

const loading = ref(true)
const failed = ref(false)
const query = ref('')
const view = ref<'grid' | 'focus'>('grid')
const selected = ref<GalleryProject | null>(null)
const projects = ref<GalleryProject[]>([])
const gallery = ref<HTMLElement | null>(null)

const filteredProjects = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase('zh-CN')
  if (!keyword) return projects.value
  return projects.value.filter(project => (
    `${project.name} ${project.builder} ${project.islandName} ${project.description}`
      .toLocaleLowerCase('zh-CN')
      .includes(keyword)
  ))
})

function flattenProjects(islands: IslandDef[]): GalleryProject[] {
  return islands.flatMap(island => island.projects.map(project => ({
    ...project,
    islandId: island.id,
    islandName: island.name,
    builder: island.builder,
    description: island.description || `${island.builder}在造物群岛中的创作项目。`,
    photos: island.photos,
  })))
}

function imageUrl(image?: string): string | undefined {
  return image?.startsWith('./') ? `/${image.slice(2)}` : image
}

function projectImage(project: GalleryProject): string | undefined {
  return imageUrl(project.cover || project.photos[0]?.url)
}

function openProject(project: GalleryProject) {
  window.open(project.url, '_blank', 'noopener,noreferrer')
}

function openIsland(project: GalleryProject) {
  window.location.href = `/?island=${encodeURIComponent(project.islandId)}`
}

async function setView(nextView: 'grid' | 'focus') {
  view.value = nextView
  await nextTick()
  gallery.value?.querySelector<HTMLElement>('.project-card')?.focus()
}

onMounted(async () => {
  document.title = '项目总览 · 造物群岛'
  try {
    projects.value = flattenProjects(await fetchPublishedIslands())
  } catch (error) {
    failed.value = true
    console.error('[island-sea] 项目总览加载失败：', error)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="project-page">
    <header class="project-header">
      <a class="back-link" href="/" aria-label="返回互动世界">
        <ArrowLeft :size="18" />
        <span>造物群岛</span>
      </a>
      <button class="world-link" type="button" @click="window.location.href = '/'">
        <Map :size="17" />
        <span>进入世界</span>
      </button>
    </header>

    <section class="project-intro">
      <h1>项目集</h1>
      <p>{{ projects.length }}</p>
    </section>

    <section class="project-toolbar" aria-label="项目浏览工具">
      <label class="project-search">
        <Search :size="18" />
        <span class="sr-only">搜索项目</span>
        <input v-model="query" type="search" placeholder="搜索项目、作者或小岛" />
      </label>
      <div class="view-switch" aria-label="视图模式">
        <button type="button" :aria-pressed="view === 'grid'" title="紧凑网格" @click="setView('grid')">
          <Grid3X3 :size="18" />
          <span>网格</span>
        </button>
        <button type="button" :aria-pressed="view === 'focus'" title="沉浸浏览" @click="setView('focus')">
          <GalleryHorizontal :size="19" />
          <span>沉浸</span>
        </button>
      </div>
    </section>

    <section v-if="loading" class="project-state">正在整理项目档案...</section>
    <section v-else-if="failed" class="project-state">
      <strong>项目档案暂时没有加载成功</strong>
      <a href="/projects">重新加载</a>
    </section>
    <section v-else-if="filteredProjects.length === 0" class="project-state">
      <strong>没有找到匹配的项目</strong>
      <button type="button" @click="query = ''">清除搜索</button>
    </section>

    <section
      v-else
      ref="gallery"
      class="project-gallery"
      :class="`is-${view}`"
      :aria-label="view === 'grid' ? '项目网格' : '项目沉浸浏览'"
    >
      <article
        v-for="(project, index) in filteredProjects"
        :key="`${project.islandId}-${project.id}`"
        class="project-card"
        tabindex="0"
        @click="selected = project"
        @keydown.enter="selected = project"
        @keydown.space.prevent="selected = project"
      >
        <div class="project-media">
          <img
            v-if="projectImage(project)"
            :src="projectImage(project)"
            :alt="`${project.name}项目画面`"
            loading="lazy"
            decoding="async"
          />
          <div v-else class="project-placeholder"><ImageIcon :size="34" /></div>
          <span class="project-index">{{ String(index + 1).padStart(2, '0') }}</span>
        </div>
        <div class="project-card-copy">
          <h2>{{ project.name }}</h2>
          <p>{{ project.builder }}</p>
        </div>
      </article>
    </section>

    <Transition name="detail">
      <div v-if="selected" class="detail-layer" @click.self="selected = null">
        <article class="project-detail" role="dialog" aria-modal="true" :aria-label="selected.name">
          <button class="detail-close" type="button" title="关闭" @click="selected = null">
            <X :size="20" />
          </button>
          <div class="detail-media">
            <img v-if="projectImage(selected)" :src="projectImage(selected)" :alt="`${selected.name}项目画面`" />
            <div v-else class="project-placeholder"><ImageIcon :size="42" /></div>
          </div>
          <div class="detail-copy">
            <p class="eyebrow">{{ selected.builder }} · {{ selected.islandName }}</p>
            <h2>{{ selected.name }}</h2>
            <section class="island-intro" aria-labelledby="island-intro-title">
              <h3 id="island-intro-title">小岛介绍</h3>
              <p>{{ selected.description }}</p>
            </section>
            <section v-if="selected.photos.length" class="island-moments" aria-labelledby="island-moments-title">
              <div class="detail-section-heading">
                <h3 id="island-moments-title">造物时刻</h3>
                <span>{{ selected.photos.length }}</span>
              </div>
              <div class="moment-strip">
                <figure v-for="photo in selected.photos" :key="photo.id">
                  <img :src="imageUrl(photo.url)" :alt="photo.alt" loading="lazy" decoding="async" />
                  <figcaption v-if="photo.caption">{{ photo.caption }}</figcaption>
                </figure>
              </div>
            </section>
            <div class="detail-actions">
              <button class="primary-action" type="button" @click="openProject(selected)">
                打开项目 <ArrowUpRight :size="17" />
              </button>
              <button type="button" @click="openIsland(selected)">
                进入小岛 <Map :size="17" />
              </button>
            </div>
          </div>
        </article>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.project-page {
  --paper: #fafbf9;
  --ink: #191d1b;
  --muted: #737a76;
  --line: #e5e8e5;
  --accent: #176b52;
  position: fixed;
  inset: 0;
  overflow: auto;
  background: var(--paper);
  color: var(--ink);
  font-family: "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
}

button,
input { font: inherit; }

button,
a { -webkit-tap-highlight-color: transparent; }

.project-header {
  position: sticky;
  top: 0;
  z-index: 10;
  min-height: 56px;
  padding: 0 clamp(18px, 4vw, 64px);
  border-bottom: 1px solid rgba(220, 226, 222, 0.92);
  background: rgba(246, 248, 245, 0.92);
  backdrop-filter: blur(16px);
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
}

.back-link,
.world-link {
  color: var(--ink);
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  text-decoration: none;
}

.back-link { justify-self: start; font-weight: 700; }

.world-link {
  justify-self: end;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-weight: 700;
}

.project-intro {
  width: min(1360px, calc(100% - 40px));
  margin: 0 auto;
  padding: clamp(32px, 6vh, 58px) 0 22px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 20px;
}

.eyebrow {
  margin: 0 0 12px;
  color: var(--accent);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}

.project-intro h1 {
  margin: 0;
  font-family: "Songti SC", "Noto Serif SC", serif;
  font-size: clamp(30px, 4vw, 46px);
  font-weight: 700;
  line-height: 1;
}

.project-intro > p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.project-toolbar {
  width: min(1360px, calc(100% - 40px));
  margin: 0 auto 22px;
  padding: 12px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto;
  align-items: center;
  gap: 18px;
}

.project-search {
  width: min(100%, 380px);
  min-height: 38px;
  padding: 0 13px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: #fff;
  display: flex;
  align-items: center;
  gap: 9px;
}

.project-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ink);
  font-size: 13px;
}

.view-switch {
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #e9eeeb;
  display: flex;
}

.view-switch button {
  min-height: 30px;
  padding: 0 12px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
}

.view-switch button[aria-pressed="true"] {
  background: #fff;
  color: var(--ink);
  box-shadow: 0 1px 4px rgba(23, 32, 29, 0.12);
}

.project-gallery {
  width: min(1360px, calc(100% - 40px));
  margin: 0 auto;
  padding-bottom: 72px;
}

.project-gallery.is-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 28px 18px;
}

.project-gallery.is-focus {
  width: 100%;
  padding: 18px max(20px, calc((100vw - 1160px) / 2)) 72px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: min(68vw, 820px);
  gap: 24px;
}

.project-card {
  min-width: 0;
  border: 0;
  outline: 0;
  cursor: pointer;
}

.project-card:focus-visible .project-media {
  outline: 3px solid rgba(8, 127, 91, 0.28);
  outline-offset: 4px;
}

.project-media {
  position: relative;
  aspect-ratio: 4 / 3;
  border-radius: 5px;
  overflow: hidden;
  background: #e2e8e4;
}

.is-focus .project-card { scroll-snap-align: center; }
.is-focus .project-media { aspect-ratio: 16 / 9; }

.project-media img,
.detail-media img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  transition: transform 0.35s ease;
}

.project-card:hover .project-media img { transform: scale(1.025); }

.project-placeholder {
  width: 100%;
  height: 100%;
  color: #8c9993;
  background: linear-gradient(145deg, #e5ebe7, #d5dfda);
  display: grid;
  place-items: center;
}

.project-index {
  position: absolute;
  top: 12px;
  left: 12px;
  min-width: 28px;
  height: 22px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.86);
  color: var(--ink);
  font-size: 11px;
  font-weight: 900;
  display: grid;
  place-items: center;
}

.project-card-copy { padding: 11px 1px 0; }

.project-card-copy p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 11px;
}

.project-card-copy h2 {
  margin: 0;
  font-size: 15px;
  line-height: 1.35;
}

.is-focus .project-card-copy h2 { font-size: 19px; }

.project-state {
  min-height: 320px;
  color: var(--muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.project-state button,
.project-state a { color: var(--accent); }

.detail-layer {
  position: fixed;
  inset: 0;
  z-index: 30;
  padding: 24px;
  background: rgba(16, 25, 22, 0.58);
  backdrop-filter: blur(9px);
  display: grid;
  place-items: center;
}

.project-detail {
  position: relative;
  width: min(980px, 100%);
  max-height: min(680px, calc(100vh - 48px));
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 30px 90px rgba(9, 30, 23, 0.25);
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(310px, 0.8fr);
}

.detail-close {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 2;
  width: 38px;
  height: 38px;
  padding: 0;
  border: 1px solid rgba(23, 32, 29, 0.14);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  color: var(--ink);
  cursor: pointer;
  display: grid;
  place-items: center;
}

.detail-media { min-height: 430px; background: #e2e8e4; }

.detail-copy {
  padding: 68px 38px 38px;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.detail-copy h2 {
  margin: 0 0 20px;
  font-family: "Songti SC", "Noto Serif SC", serif;
  font-size: 34px;
  line-height: 1.2;
}

.island-intro h3,
.detail-section-heading h3 {
  margin: 0;
  color: var(--ink);
  font-size: 11px;
  font-weight: 900;
}

.island-intro p {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.9;
}

.island-intro h3 { margin-bottom: 8px; }

.island-moments {
  margin-top: 24px;
}

.detail-section-heading {
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.detail-section-heading span {
  color: var(--muted);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.moment-strip {
  margin-right: -38px;
  padding-right: 38px;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scroll-snap-type: x proximity;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 116px;
  gap: 8px;
}

.moment-strip figure {
  margin: 0;
  min-width: 0;
  scroll-snap-align: start;
}

.moment-strip img {
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 4px;
  object-fit: cover;
  display: block;
}

.moment-strip figcaption {
  margin-top: 6px;
  overflow: hidden;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-actions {
  margin-top: 30px;
  display: flex;
  gap: 10px;
}

.detail-actions button {
  min-height: 42px;
  padding: 0 16px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  color: var(--ink);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-weight: 800;
}

.detail-actions .primary-action {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}

.detail-enter-active,
.detail-leave-active { transition: opacity 0.2s ease; }
.detail-enter-active .project-detail,
.detail-leave-active .project-detail { transition: transform 0.25s ease; }
.detail-enter-from,
.detail-leave-to { opacity: 0; }
.detail-enter-from .project-detail,
.detail-leave-to .project-detail { transform: translateY(16px); }

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 980px) {
  .project-gallery.is-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .project-detail { grid-template-columns: 1fr 1fr; }
  .detail-media { min-height: 380px; }
}

@media (max-width: 680px) {
  .project-header {
    min-height: 56px;
    padding: 0 16px;
  }
  .back-link span,
  .world-link span { font-size: 12px; }
  .project-intro {
    width: calc(100% - 32px);
    padding: 28px 0 18px;
  }
  .project-intro h1 { font-size: 31px; }
  .project-toolbar {
    width: calc(100% - 32px);
    grid-template-columns: 1fr auto;
    gap: 10px;
  }
  .view-switch button { width: 38px; padding: 0; justify-content: center; }
  .view-switch button span { display: none; }
  .project-gallery { width: calc(100% - 32px); }
  .project-gallery.is-grid {
    grid-template-columns: 1fr;
    gap: 26px;
  }
  .project-gallery.is-grid .project-media { aspect-ratio: 16 / 10; }
  .project-gallery.is-focus {
    width: 100%;
    padding-inline: 16px;
    grid-auto-columns: calc(100vw - 46px);
    gap: 14px;
  }
  .project-card-copy h2,
  .is-focus .project-card-copy h2 { font-size: 16px; }
  .detail-layer { padding: 12px; align-items: end; }
  .project-detail {
    max-height: calc(100vh - 24px);
    overflow-y: auto;
    grid-template-columns: 1fr;
  }
  .detail-media { min-height: 0; aspect-ratio: 16 / 10; }
  .detail-copy {
    padding: 28px 22px 24px;
    overflow: visible;
  }
  .detail-copy h2 { padding-right: 36px; font-size: 27px; }
  .moment-strip {
    margin-right: -22px;
    padding-right: 22px;
    grid-auto-columns: min(42vw, 150px);
  }
  .detail-actions { flex-direction: column; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
</style>

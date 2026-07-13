import * as THREE from 'three'
import { ISLANDS, WORLD_RADIUS, SPAWN } from '../data/islands'
import { store, statusOf, markVisited, islandById, showToast, detectGrowth, foundCount, discoverableCount } from '../store'
import { createSky } from './sky'
import { createOcean, OCEAN_NEAR } from './ocean'
import { IslandObject, type IslandStatus } from './island'
import { Ship } from './ship'
import { NIGHT } from './themes'
import { ringTexture } from './sprites'
import { mulberry32 } from './rng'
import { createFireflies, createPlankton, createJellies } from './nightmagic'
import { createSplash } from './shipfx'
import { smoothstep, easeOutCubic, wrapAngle } from './ease'
import { ISO_DIR, ISO_DIST, FRUSTUM, SHIP_SCALE } from './config'
import { CreatureManager } from './creatures'
import { TimeOfDay } from './timeofday'
import { PostFX } from './postfx'

// 世界主控：three 管 3D，Vue 管界面，两层只靠 store 和这里的公开方法对接。
// 渲染路线（Bruno Simon / Madbox 式）：直渲无后期、Lambert 扁平材质、MSAA 抗锯齿——
// 全场景开销压到核显/老笔记本都能满帧的水平。
// 验证钩子：?ship=x,z ?heading=deg ?unlock=all ?island=id ?grow=id ?theme=dusk ?t=N ?snap ?debug


class RingFX {
  private items: { mesh: THREE.Mesh; t0: number }[] = []
  constructor(scene: THREE.Scene) {
    const tex = ringTexture()
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.MeshBasicMaterial({
          map: tex,
          color: '#ffd98a',
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      mesh.rotation.x = -Math.PI / 2
      mesh.position.y = 0.7
      scene.add(mesh)
      this.items.push({ mesh, t0: -99 })
    }
  }
  spawn(x: number, z: number, sim: number, color = '#ffd98a'): void {
    const slot = this.items.find(i => sim - i.t0 > 1.8) ?? this.items[0]
    slot.t0 = sim
    slot.mesh.position.set(x, 0.7, z)
    ;(slot.mesh.material as THREE.MeshBasicMaterial).color.set(color)
  }
  update(sim: number): void {
    for (const it of this.items) {
      const k = (sim - it.t0) / 1.7
      const m = it.mesh.material as THREE.MeshBasicMaterial
      if (k < 0 || k > 1) {
        m.opacity = 0
        continue
      }
      const s = THREE.MathUtils.lerp(6, 70, easeOutCubic(k))
      it.mesh.scale.setScalar(s)
      m.opacity = 0.85 * (1 - k)
    }
  }
}

export class World {
  renderer!: THREE.WebGLRenderer
  scene = new THREE.Scene()
  camera: THREE.OrthographicCamera
  private postfx!: PostFX
  private sky = createSky()
  private ocean = createOcean()
  private oceanNearD = new Float32Array(OCEAN_NEAR) // 每帧筛“离船最近 N 座岛”的距离平方，预分配免 GC
  private islands = new Map<string, IslandObject>()
  ship = new Ship()
  private sun = new THREE.DirectionalLight(NIGHT.sunColor, NIGHT.sunIntensity)
  private fill = new THREE.DirectionalLight(NIGHT.fillColor, NIGHT.fillIntensity) // 背阳面补光：暗部有色相不死黑
  private hemi = new THREE.HemisphereLight(NIGHT.hemiSky, NIGHT.hemiGround, NIGHT.hemiIntensity)
  private clouds: THREE.Group[] = []
  private cloudMat!: THREE.MeshLambertMaterial
  private creatures!: CreatureManager
  private fireflies = createFireflies()
  private plankton = createPlankton()
  private jellies = createJellies()
  private splash = createSplash()
  private stars!: THREE.Points
  private rings!: RingFX
  private tod!: TimeOfDay // 全天时段系统（相位/主题/夜色/调色/缓动过渡/URL钩子）
  simTime = 0
  private paused = false
  private keys = new Set<string>()
  private camPos = new THREE.Vector3()
  private camLook = new THREE.Vector3()
  private camZoom = 1
  private landStart = 0
  private landBaseAngle = 0
  private noDockUntil = -1
  private autoLandAt = -1
  private manualTargetId: string | null = null
  private foggyToasted = new Set<string>()
  private growthQueue: string[] = []
  private nextGrowAt = 2.5
  private raycaster = new THREE.Raycaster()
  private pointerNdc = new THREE.Vector2()
  private focusK = 0 // 聚焦程度（0 海面 .. 1 登岛特写）
  /** 点击作品宝箱时由 App 注入（内含 vue-router 跳转） */
  onOpenProject: ((islandId: string, projectId: string) => void) | null = null
  private snapMode = false // ?snap：相机不做平滑过渡（机器截图定帧用）
  private bootDone = false
  private disposed = false
  private lastClock = performance.now()
  fps = 0

  constructor(canvas: HTMLCanvasElement) {
    try {
      // 直渲无后期 → MSAA 抗锯齿开着也便宜
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    } catch (e) {
      const el = document.getElementById('loading')
      if (el) {
        el.dataset.failed = '1' // 标记已给出精确文案，App.vue 的兜底不再覆盖
        el.innerHTML = '<p style="letter-spacing:0.1em">这台设备暂时打不开 3D 海洋，请换一台电脑试试 🥲</p>'
      }
      throw e
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = NIGHT.exposure
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    // 实时软阴影：低多边形场景的体积感来源（?noshadow 关闭，弱机逃生口）
    if (!new URLSearchParams(location.search).has('noshadow')) {
      this.renderer.shadowMap.enabled = true
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
      this.sun.castShadow = true
      this.sun.shadow.mapSize.set(2048, 2048)
      const sc = this.sun.shadow.camera
      sc.left = -210
      sc.right = 210
      sc.top = 210
      sc.bottom = -210
      sc.near = 120
      sc.far = 640
      this.sun.shadow.bias = -0.0003
      this.sun.shadow.normalBias = 0.5 // 太大人会吃掉树这类小物件的影子
    }
    this.scene.add(this.sun.target)

    const aspect0 = window.innerWidth / Math.max(window.innerHeight, 1)
    this.camera = new THREE.OrthographicCamera(-FRUSTUM * aspect0, FRUSTUM * aspect0, FRUSTUM, -FRUSTUM, 60, 1200)
    this.scene.fog = new THREE.Fog(NIGHT.fogColor.clone(), NIGHT.fogNear, NIGHT.fogFar)
    this.scene.background = new THREE.Color().copy(NIGHT.fogColor)

    // 后期管线（Bloom/移轴/OutputPass/调色）整体内聚到 PostFX
    this.postfx = new PostFX(this.renderer, this.scene, this.camera)

    this.scene.add(this.sky, this.ocean, this.ship.group, this.ship.wake, this.sun, this.fill, this.hemi)
    this.scene.add(this.fireflies.points, this.plankton.points, this.jellies.group) // 夜晚魔法
    this.scene.add(this.splash.points) // 船头溅水
    this.ship.group.scale.setScalar(SHIP_SCALE)
    this.sun.position.copy(NIGHT.sunDir).multiplyScalar(500)

    for (const def of ISLANDS) {
      const obj = new IslandObject(def)
      obj.group.userData.islandId = def.id // 供点击拾取识别是哪座岛
      this.islands.set(def.id, obj)
      this.scene.add(obj.group)
    }

    // 立体棉花云：几团低多边形球叠出来的胖云，绕世界缓慢漂
    this.cloudMat = new THREE.MeshLambertMaterial({
      color: '#ffffff',
      emissive: '#ffffff',
      emissiveIntensity: 0.22,
      flatShading: true,
    })
    // 低空棉花云飘在海盘上方，castShadow 让云影每十几秒缓缓扫过海面（"云影呼吸"）
    const crng = mulberry32(20260712)
    for (let i = 0; i < 4; i++) {
      const cloud = new THREE.Group()
      const nb = 3 + Math.floor(crng() * 2)
      for (let b = 0; b < nb; b++) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), this.cloudMat)
        puff.position.set((crng() - 0.5) * 9, (crng() - 0.5) * 1.6, (crng() - 0.5) * 5)
        puff.scale.set(3 + crng() * 3, 1.6 + crng() * 1, 2.6 + crng() * 2.4)
        puff.castShadow = true
        cloud.add(puff)
      }
      const a = crng() * Math.PI * 2
      const r = 24 + crng() * 66
      cloud.position.set(Math.cos(a) * r, 44 + crng() * 20, Math.sin(a) * r)
      cloud.userData.drift = { a, r, speed: 0.006 + crng() * 0.006, y: cloud.position.y }
      this.clouds.push(cloud)
      this.scene.add(cloud)
    }

    // 海洋生物（海鸥/海豚/鲸/鱼群）整体内聚到 CreatureManager
    this.creatures = new CreatureManager(this.scene)

    // 星（黄昏淡淡可见，晨光隐去）
    {
      const n = 260
      const pos = new Float32Array(n * 3)
      const srng = mulberry32(77)
      for (let i = 0; i < n; i++) {
        const a = srng() * Math.PI * 2
        const y = 0.25 + srng() * 0.7
        const rr = Math.sqrt(Math.max(1 - y * y, 0))
        pos[i * 3] = Math.cos(a) * rr * 1100
        pos[i * 3 + 1] = y * 1100
        pos[i * 3 + 2] = Math.sin(a) * rr * 1100
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      const m = new THREE.PointsMaterial({
        color: '#ffe9c9',
        size: 2 * Math.min(window.devicePixelRatio, 2),
        sizeAttenuation: false,
        transparent: true,
        opacity: NIGHT.starOpacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      this.stars = new THREE.Points(g, m)
      this.stars.frustumCulled = false
      this.scene.add(this.stars)
    }

    this.rings = new RingFX(this.scene)

    const q = new URLSearchParams(location.search)
    this.updateSizes()

    // 出生点与朝向
    this.ship.pos.set(SPAWN[0], 0, SPAWN[1])
    this.camPos.set(SPAWN[0], 8, SPAWN[1] + 16)
    this.camLook.set(SPAWN[0], 2, SPAWN[1] - 10)

    // ---- 验证钩子 ----
    if (q.has('t')) this.simTime = parseFloat(q.get('t')!) || 0
    this.tod = new TimeOfDay(q) // 时段钩子 ?tod / ?daycycle / ?theme 都在其构造里解析
    if (q.get('unlock') === 'all') {
      store.ephemeral = true
      for (const isl of ISLANDS) if (isl.projects.length > 0) store.visited.add(isl.id)
    }
    const shipQ = q.get('ship')
    if (shipQ) {
      const [x, z] = shipQ.split(',').map(Number)
      if (Number.isFinite(x) && Number.isFinite(z)) this.ship.pos.set(x, 0, z)
    }
    if (q.has('heading')) this.ship.heading = ((parseFloat(q.get('heading')!) || 0) * Math.PI) / 180
    const growQ = q.get('grow')
    if (growQ && islandById(growQ)) {
      store.ephemeral = true
      store.visited.delete(growQ)
      store.pendingGrow.add(growQ)
      this.growthQueue = [growQ]
    } else {
      this.growthQueue = detectGrowth()
      for (const id of this.growthQueue) store.pendingGrow.add(id)
    }
    const islandQ = q.get('island')
    if (islandQ) {
      const def = islandById(islandQ)
      const obj = this.islands.get(islandQ)
      if (def && obj) {
        // 把船放到岛边（朝出生点方向的一侧），走真实到达→解锁→登岛路径
        const dir = new THREE.Vector3(SPAWN[0] - def.position[0], 0, SPAWN[1] - def.position[1]).normalize()
        this.ship.pos.set(def.position[0] + dir.x * (obj.radius + 6), 0, def.position[1] + dir.z * (obj.radius + 6))
        this.ship.heading = Math.atan2(-dir.x, -dir.z)
        this.autoLandAt = this.simTime + 0.6
      }
    }
    if (q.has('debug')) store.debug = true
    this.snapMode = q.has('snap')
    ;(window as any).__seek = (t: number) => (this.simTime = t)
    ;(window as any).__world = this
    ;(window as any).__store = store

    // 相机初始就位（避免第一帧从原点飞过来）
    this.snapCamera()

    window.addEventListener('resize', this.updateSizes)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    this.renderer.domElement.addEventListener('click', this.onCanvasClick)
    window.addEventListener('blur', this.onBlur)
    document.addEventListener('visibilitychange', this.onVisibility)

    this.loop()
  }

  // ------------------------------------------------------------------
  private updateSizes = (): void => {
    const w = window.innerWidth
    const h = window.innerHeight
    if (w === 0 || h === 0) return // 隐藏标签页 0 尺寸防御
    const aspect = w / h
    this.camera.left = -FRUSTUM * aspect
    this.camera.right = FRUSTUM * aspect
    this.camera.top = FRUSTUM
    this.camera.bottom = -FRUSTUM
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.postfx.setSize(w, h, Math.min(window.devicePixelRatio, 2))
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault()
    this.keys.add(e.key.toLowerCase())
    if (this.paused) return // 项目 iframe 打开时不抢键盘
    if (e.key === 'Enter' && store.mode === 'docked') this.land()
    if (e.key === 'Escape' && store.mode === 'landed') this.leave()
  }
  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase())
  }
  // 失焦/切后台时清空按键：否则丢失的 keyup 会让 W/A/D 永久残留、回来船失控
  private onBlur = (): void => this.keys.clear()
  private onVisibility = (): void => {
    if (document.hidden) this.keys.clear()
  }

  // 点击拾取：登岛特写时点宝箱开作品；泊岸时点岛屿即登岛（岛飘起来聚焦）
  private onCanvasClick = (e: MouseEvent): void => {
    if (this.paused) return
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointerNdc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(this.pointerNdc, this.camera)
    // 登岛特写：点作品宝箱 → 打开作品
    if (store.mode === 'landed' && store.dockedId) {
      const obj = this.islands.get(store.dockedId)
      const hit = obj && this.raycaster.intersectObjects(obj.chests, false)[0]
      if (hit) {
        const pid = hit.object.userData.projectId as string | undefined
        if (pid) this.onOpenProject?.(store.dockedId, pid)
      }
      return
    }
    // 海面：点岛 → 已泊在这座岛则登岛，否则快速跳转过去
    const groups = [...this.islands.values()].map(o => o.group)
    const hit = this.raycaster.intersectObjects(groups, true)[0]
    if (!hit) return
    let o: THREE.Object3D | null = hit.object
    while (o && o.userData.islandId === undefined) o = o.parent
    const id = o?.userData.islandId as string | undefined
    if (!id) return
    if (store.mode === 'docked' && store.dockedId === id) this.land()
    else this.fastTravelTo(id)
  }

  /** 快速跳转：点岛即抵达该岛边泊岸（不必手动划过去）；相机平滑追上 */
  fastTravelTo(id: string): void {
    const def = islandById(id)
    if (!def || store.mode === 'landed') return
    if (statusOf(def) === 'foggy') {
      showToast(`「${def.name}」还睡在迷雾里，${def.builder}的作品完成后它才会醒来`)
      return
    }
    const obj = this.islands.get(id)!
    let dx = this.ship.pos.x - def.position[0]
    let dz = this.ship.pos.z - def.position[1]
    const dl = Math.hypot(dx, dz) || 1
    dx /= dl
    dz /= dl
    this.ship.pos.set(def.position[0] + dx * (obj.radius + 6), 0, def.position[1] + dz * (obj.radius + 6))
    this.ship.heading = Math.atan2(-dx, -dz)
    this.ship.speed = 0
    this.keys.clear()
    store.mode = 'docked'
    store.dockedId = id
    this.manualTargetId = null
    this.noDockUntil = this.simTime + 1.5
    if (statusOf(def) === 'locked') {
      markVisited(id)
      obj.playUnlock(this.simTime)
      this.rings.spawn(def.position[0], def.position[1], this.simTime)
      showToast(`✨ 寻获「${def.name}」！已寻获 ${foundCount.value} / ${discoverableCount.value} 座岛`)
    } else {
      showToast(`⛵ 已抵达「${def.name}」·点岛登岛`)
    }
  }

  setPaused(p: boolean): void {
    this.paused = p
    this.keys.clear()
  }

  /** Hud 点击：平滑过渡到下一个时段（委托给 TimeOfDay） */
  skipTimeOfDay(): void {
    this.tod.skip()
  }

  /** 给海豚随机安排下一次跃水的地点/朝向/弧高 */
  /** 小地图点击设目标（软引导：可指任何岛，迷雾岛给提示） */
  setManualTarget(id: string): void {
    const def = islandById(id)
    if (!def) return
    if (statusOf(def) === 'foggy') {
      showToast(`「${def.name}」还睡在迷雾里，${def.builder}的作品完成后它才会醒来`)
      return
    }
    this.manualTargetId = id
    store.targetId = id
    showToast(`🧭 目标已设为「${def.name}」`)
  }

  land(): void {
    if (!store.dockedId) return
    const def = islandById(store.dockedId)
    const obj = this.islands.get(store.dockedId)
    if (!def || !obj) return
    store.mode = 'landed'
    this.landStart = this.simTime
    const c = obj.group.position
    this.landBaseAngle = Math.atan2(this.ship.pos.x - c.x, this.ship.pos.z - c.z)
    obj.setFocused(true) // 岛飘起来
  }

  leave(): void {
    if (store.mode !== 'landed') return
    if (store.dockedId) this.islands.get(store.dockedId)?.setFocused(false) // 岛落回海面
    store.mode = 'docked'
  }

  minimapData() {
    return ISLANDS.map(def => {
      const obj = this.islands.get(def.id)!
      return {
        id: def.id,
        name: def.name,
        x: def.position[0],
        z: def.position[1],
        r: obj.radius,
        theme: def.theme,
        status: statusOf(def),
      }
    })
  }

  private applyTheme(b: number): void {
    const cur = this.tod.theme
    const skyU = (this.sky.material as THREE.ShaderMaterial).uniforms
    skyU.uTop.value.copy(cur.skyTop)
    skyU.uMid.value.copy(cur.skyMid)
    skyU.uHorizon.value.copy(cur.skyHorizon)
    skyU.uAurora.value = THREE.MathUtils.clamp((this.tod.nightK - 0.5) * 2.2, 0, 1) // 只在最深的夜显现
    skyU.uTime.value = this.simTime
    const oceanU = (this.ocean.material as THREE.ShaderMaterial).uniforms
    oceanU.uSeaA.value.copy(cur.seaA)
    oceanU.uSeaB.value.copy(cur.seaB)
    oceanU.uSeaShallow.value.copy(cur.seaShallow)
    oceanU.uSunDir.value.copy(cur.sunDir)
    oceanU.uSunColor.value.copy(cur.sunColor)
    oceanU.uFoamK.value = 1 - 0.55 * this.tod.nightK // 夜里白泡沫收敛
    this.sun.color.copy(cur.sunColor)
    this.sun.intensity = cur.sunIntensity
    // 阴影相机跟着船走（吸附到 4 单位网格防阴影抖动）
    const sx = Math.round(this.ship.pos.x / 4) * 4
    const sz = Math.round(this.ship.pos.z / 4) * 4
    this.sun.position.set(sx + cur.sunDir.x * 450, cur.sunDir.y * 450, sz + cur.sunDir.z * 450)
    this.sun.target.position.set(sx, 0, sz)
    this.fill.color.copy(cur.fillColor)
    this.fill.intensity = cur.fillIntensity
    this.fill.position.set(-cur.sunDir.x, 0.5, -cur.sunDir.z).normalize().multiplyScalar(500)
    this.hemi.color.copy(cur.hemiSky)
    this.hemi.groundColor.copy(cur.hemiGround)
    this.hemi.intensity = cur.hemiIntensity
    const fog = this.scene.fog as THREE.Fog
    fog.color.copy(cur.fogColor)
    // 机位远（ISO_DIST 大），fog 起点相应后移，只柔化最远处，近景保持通透
    fog.near = (cur.fogNear + 470) * (1 - 0.4 * b)
    fog.far = (cur.fogFar + 280) * (1 - 0.4 * b)
    ;(this.scene.background as THREE.Color).copy(cur.fogColor)
    this.cloudMat.color.copy(cur.cloudTint)
    this.cloudMat.emissiveIntensity = 0.22 - 0.18 * this.tod.nightK // 夜里云不自发光
    ;(this.stars.material as THREE.PointsMaterial).opacity = cur.starOpacity
    this.renderer.toneMappingExposure = cur.exposure
  }

  private snapCamera(): void {
    this.camLook.copy(this.ship.pos).setY(1.0)
    this.camZoom = 1
    this.camPos.copy(this.camLook).addScaledVector(ISO_DIR, ISO_DIST)
    this.camera.position.copy(this.camPos)
    this.camera.zoom = this.camZoom
    this.camera.updateProjectionMatrix()
    this.camera.lookAt(this.camLook)
  }

  private pickAutoTarget(): void {
    // 目标锁定防抖：手动目标到手前不换；自动目标只在失效时重选
    if (this.manualTargetId) {
      const def = islandById(this.manualTargetId)
      if (!def || statusOf(def) === 'foggy') this.manualTargetId = null
      else {
        store.targetId = this.manualTargetId
        return
      }
    }
    const curDef = store.targetId ? islandById(store.targetId) : undefined
    if (curDef && statusOf(curDef) === 'locked') return
    let best: string | null = null
    let bestD = Infinity
    for (const def of ISLANDS) {
      if (statusOf(def) !== 'locked') continue
      const d = Math.hypot(def.position[0] - this.ship.pos.x, def.position[1] - this.ship.pos.z)
      if (d < bestD) {
        bestD = d
        best = def.id
      }
    }
    store.targetId = best
  }

  // ------------------------------------------------------------------
  private loop = (): void => {
    if (this.disposed) return
    requestAnimationFrame(this.loop)
    const now = performance.now()
    let dt = (now - this.lastClock) / 1000
    this.lastClock = now
    dt = Math.min(dt, 0.05)
    this.fps = this.fps * 0.95 + (1 / Math.max(dt, 1e-4)) * 0.05
    if (this.paused) return
    this.simTime += dt
    const sim = this.simTime

    this.tod.update(dt) // 时段推进（缓动过渡/自然流转）+ 采样主题·夜色·调色

    // 世界软边界
    const distFromCenter = Math.hypot(this.ship.pos.x, this.ship.pos.z)
    const b = smoothstep(WORLD_RADIUS - 60, WORLD_RADIUS + 40, distFromCenter)
    this.applyTheme(b)

    // ---- 操控 ----
    const k = this.keys
    let throttle = 0
    let steer = 0
    if (store.mode !== 'landed') {
      if (k.has('w') || k.has('arrowup')) throttle += 1
      if (k.has('s') || k.has('arrowdown')) throttle -= 0.6
      if (k.has('a') || k.has('arrowleft')) steer += 1
      if (k.has('d') || k.has('arrowright')) steer -= 1
    }
    if (store.mode === 'docked' && (throttle !== 0 || steer !== 0)) {
      store.mode = 'sailing'
      store.dockedId = null
      this.noDockUntil = sim + 2.5
    }

    // ---- 泊岸减速与到达 ----
    let speedCap = Infinity
    let nearId: string | null = null
    let nearD = Infinity
    if (store.mode === 'sailing') {
      for (const def of ISLANDS) {
        const obj = this.islands.get(def.id)!
        const dx = this.ship.pos.x - def.position[0]
        const dz = this.ship.pos.z - def.position[1]
        const d = Math.hypot(dx, dz)
        const st = statusOf(def)
        // 硬碰撞：不穿模
        const hardR = obj.radius * 0.9 + 2.5
        if (d < hardR) {
          const push = (hardR - d) / Math.max(d, 0.01)
          this.ship.pos.x += dx * push
          this.ship.pos.z += dz * push
          this.ship.speed *= 0.4
        }
        if (st === 'foggy') {
          if (d < obj.radius + 10 && !this.foggyToasted.has(def.id)) {
            this.foggyToasted.add(def.id)
            showToast(`「${def.name}」还睡在迷雾里……等${def.builder}的作品完成，它会醒来`)
          }
          continue
        }
        // 靠近范围内 → 记为高亮候选
        if (d < obj.radius + 30 && d < nearD) {
          nearD = d
          nearId = def.id
        }
        // 软减速泊岸：只在"驶向该岛"时减速；离开时不夹速度（离岛手感顺畅）
        if (d < obj.radius + 30) {
          const tox = (def.position[0] - this.ship.pos.x) / Math.max(d, 0.01)
          const toz = (def.position[1] - this.ship.pos.z) / Math.max(d, 0.01)
          const fwd = this.ship.forward
          if (fwd.x * tox + fwd.z * toz > 0.1) {
            speedCap = Math.min(speedCap, Math.max(2.6, (d - (obj.radius + 5)) * 0.6))
          }
        }
        if (d < obj.radius + 8.5 && sim > this.noDockUntil) {
          store.mode = 'docked'
          store.dockedId = def.id
          this.ship.speed = 0
          if (st === 'locked') {
            markVisited(def.id)
            obj.playUnlock(sim)
            this.rings.spawn(def.position[0], def.position[1], sim)
            if (this.manualTargetId === def.id) this.manualTargetId = null
            showToast(`✨ 寻获「${def.name}」！已寻获 ${foundCount.value} / ${discoverableCount.value} 座岛`)
          }
        }
      }
      // 软边界：雾变浓 + 把船头温柔拽回岛群
      if (b > 0.01) {
        const toCenter = Math.atan2(-this.ship.pos.x, -this.ship.pos.z)
        this.ship.heading += wrapAngle(toCenter - this.ship.heading) * Math.min(b * 1.1, 1) * dt * 1.2
      }
    }

    const sailing = store.mode === 'sailing'
    this.ship.update(dt, sim, sailing ? throttle : 0, sailing ? steer : 0, speedCap)

    // ?island=id 自动登岛
    if (this.autoLandAt >= 0 && store.mode === 'docked' && sim >= this.autoLandAt) {
      this.autoLandAt = -1
      this.land()
    }

    // ---- 宝箱指引 ----
    this.pickAutoTarget()
    const targetDef = store.targetId ? islandById(store.targetId) : undefined
    this.ship.pointArrowAt(
      targetDef && store.mode === 'sailing'
        ? new THREE.Vector3(targetDef.position[0], 0, targetDef.position[1])
        : null,
      sim,
      dt,
    )

    // ---- 生长动画调度 ----
    if (this.growthQueue.length > 0 && sim >= this.nextGrowAt) {
      const anyGrowing = [...this.islands.values()].some(o => o.growing)
      if (!anyGrowing) {
        const id = this.growthQueue.shift()!
        const def = islandById(id)!
        const obj = this.islands.get(id)!
        obj.grow(sim)
        this.rings.spawn(def.position[0], def.position[1], sim, '#bfeee2')
        showToast(`🌱 「${def.name}」正在从迷雾中升起——${def.builder}的作品完成了！`)
        obj.onGrown = () => {
          store.pendingGrow.delete(id)
        }
        this.nextGrowAt = sim + 6
      }
    }

    // ---- 场景更新（离屏门控：只逐帧更新可见/生长/登岛的岛，其余 25+ 座跳过全套装饰动画）----
    const highlightId = store.mode === 'landed' ? null : store.dockedId ?? nearId
    const shipX = this.ship.pos.x
    const shipZ = this.ship.pos.z
    const CULL2 = 300 * 300 // 超出此半径且非生长/登岛的岛，屏外看不见 → 跳过更新
    for (const def of ISLANDS) {
      const obj = this.islands.get(def.id)!
      const st = statusOf(def) as IslandStatus // 每帧每岛只取一次 reactive
      obj.setHighlight(def.id === highlightId)
      const dx = def.position[0] - shipX
      const dz = def.position[1] - shipZ
      if (dx * dx + dz * dz < CULL2 || store.pendingGrow.has(def.id) || store.dockedId === def.id) {
        // 登岛特写时隐掉这座岛的空中岛名（面板里已有，避免撞顶部 UI）
        const suppress = store.mode === 'landed' && store.dockedId === def.id
        obj.update(sim, dt, st, suppress, this.tod.nightK)
      }
    }
    for (const cl of this.clouds) {
      const dr = cl.userData.drift
      dr.a += dr.speed * dt
      cl.position.set(Math.cos(dr.a) * dr.r, dr.y, Math.sin(dr.a) * dr.r)
    }
    this.creatures.update(sim, dt, this.ship.pos.x, this.ship.pos.z)
    this.rings.update(sim)
    // 夜晚魔法：萤火虫 / 船尾荧光拖尾 / 发光水母（都随 nightK 渐显）
    {
      const dpr = Math.min(window.devicePixelRatio, 2)
      this.fireflies.update(sim, this.tod.nightK, dpr)
      const sternX = this.ship.pos.x - this.ship.forward.x * 5
      const sternZ = this.ship.pos.z - this.ship.forward.z * 5
      this.plankton.update(dt, this.tod.nightK, dpr, sternX, sternZ, this.ship.speed > 2)
      this.jellies.update(sim, dt, this.tod.nightK, this.ship.pos.x, this.ship.pos.z)
      const fwd = this.ship.forward
      this.splash.update(dt, dpr, this.ship.pos.x + fwd.x * 5, this.ship.pos.z + fwd.z * 5, fwd.x, fwd.z, this.ship.speed)
    }
    const oceanU = (this.ocean.material as THREE.ShaderMaterial).uniforms
    oceanU.uTime.value = sim
    // 贴岸泡沫/浅滩：只把离船最近的 OCEAN_NEAR 座“已浮现”的岛喂给水面
    // （远岛在正交视野外或被 fog 柔化，看不到浅滩；片元循环因此从 O(全岛数) 压到 O(N)）。
    const islandVecs = oceanU.uIslands.value as THREE.Vector3[]
    const oceanD = this.oceanNearD
    for (let k = 0; k < OCEAN_NEAR; k++) { oceanD[k] = Infinity; islandVecs[k].set(0, 0, 0) }
    const sx = this.ship.pos.x, sz = this.ship.pos.z
    for (let i = 0; i < ISLANDS.length; i++) {
      const def = ISLANDS[i]
      const r = this.islands.get(def.id)!.foamRadius
      if (r < 0.5) continue // 迷雾岛没有浅滩
      const dx = def.position[0] - sx, dz = def.position[1] - sz
      const d = dx * dx + dz * dz
      // 保留最近 N：找当前最远的槽，比它近就替换（定长扫描，无排序、无分配）
      let worst = 0
      for (let k = 1; k < OCEAN_NEAR; k++) if (oceanD[k] > oceanD[worst]) worst = k
      if (d < oceanD[worst]) {
        oceanD[worst] = d
        islandVecs[worst].set(def.position[0], def.position[1], r)
      }
    }
    this.ocean.position.set(this.ship.pos.x, 0, this.ship.pos.z) // 海盘几何跟着船，始终铺满视野

    // ---- 相机：世界锁死等距角度，只平移不转向；登岛用 zoom 推近 ----
    const look = new THREE.Vector3()
    let zoom = 1
    if (store.mode === 'landed' && store.dockedId) {
      const obj = this.islands.get(store.dockedId)!
      const c = obj.group.position
      // 视线跟着升起的岛抬高（c.y 已含升起量）
      look.set(c.x, c.y + obj.topY * 0.34 + 2, c.z)
      // 推近：让这座岛占画面约 62%（正交靠 zoom 放大，不改角度）
      zoom = THREE.MathUtils.clamp((FRUSTUM * 0.62) / (obj.radius + 6), 1.5, 4.5)
    } else {
      // 跟随船：视线锁在船上（略微提前一点点朝航向），场景随航行不断挪动
      const fwd = this.ship.forward
      look.set(this.ship.pos.x + fwd.x * 10, 1.0, this.ship.pos.z + fwd.z * 10)
    }
    const camDamp = this.snapMode ? 1 : 1 - Math.exp(-3.0 * dt)
    this.camLook.lerp(look, camDamp)
    this.camZoom += (zoom - this.camZoom) * camDamp
    this.camPos.copy(this.camLook).addScaledVector(ISO_DIR, ISO_DIST)
    this.camera.position.copy(this.camPos)
    this.camera.zoom = this.camZoom
    this.camera.updateProjectionMatrix()
    this.camera.lookAt(this.camLook)

    // 聚焦程度：登岛时外围压暗虚化（喂给调色 pass）
    this.focusK += ((store.mode === 'landed' ? 1 : 0) - this.focusK) * (this.snapMode ? 1 : 1 - Math.exp(-3.0 * dt))
    this.postfx.render({
      focusK: this.focusK,
      time: sim,
      nightK: this.tod.nightK,
      tint: this.tod.tint,
      tintAmt: this.tod.tintAmt,
    })
    if (!this.bootDone) {
      this.bootDone = true
      const el = document.getElementById('loading')
      if (el) {
        el.style.opacity = '0'
        setTimeout(() => el.remove(), 1000)
      }
    }
  }

  dispose(): void {
    this.disposed = true
    window.removeEventListener('resize', this.updateSizes)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.renderer.domElement.removeEventListener('click', this.onCanvasClick)
    window.removeEventListener('blur', this.onBlur)
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.renderer.dispose()
  }
}

let world: World | null = null
export function createWorld(canvas: HTMLCanvasElement): World {
  world = new World(canvas)
  return world
}
export function getWorld(): World | null {
  return world
}

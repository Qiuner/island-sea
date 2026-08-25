import * as THREE from 'three'
import { WORLD_RADIUS, SPAWN, type IslandDef } from '../data/islands'
import { store, statusOf, islandById, showToast, detectGrowth } from '../store'
import { createSky } from './sky'
import { createOcean, OCEAN_NEAR } from './ocean'
import { IslandObject } from './island'
import type { IslandStatus } from './island-types'
import { Ship } from './ship'
import { NIGHT } from './themes'
import { ringTexture } from './sprites'
import { mulberry32 } from './rng'
import { createFireflies, createPlankton, createJellies } from './nightmagic'
import { createSplash } from './shipfx'
import { smoothstep, easeOutCubic } from './ease'
import { FRUSTUM, SHIP_SCALE } from './config'
import { CreatureManager } from './creatures'
import { TimeOfDay } from './timeofday'
import { PostFX } from './postfx'
import { WorldControls } from './world-controls'
import { WorldNavigation } from './world-navigation'
import { updateSailing } from './world-sailing'
import { WorldCameraRig } from './world-camera'

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
  private islandDefs: IslandDef[]
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
  private fireflies: ReturnType<typeof createFireflies>
  private plankton = createPlankton()
  private jellies = createJellies()
  private splash = createSplash()
  private stars!: THREE.Points
  private rings!: RingFX
  private tod!: TimeOfDay // 全天时段系统（相位/主题/夜色/调色/缓动过渡/URL钩子）
  simTime = 0
  private paused = false
  private landStart = 0
  private landBaseAngle = 0
  private growthQueue: string[] = []
  private nextGrowAt = 2.5
  /** 点击作品宝箱时由 App 注入，默认在新窗口打开后台配置的作品链接 */
  onOpenProject: ((islandId: string, projectId: string) => void) | null = null
  private snapMode = false // ?snap：相机不做平滑过渡（机器截图定帧用）
  private bootDone = false
  private disposed = false
  private lastClock = performance.now()
  private controls!: WorldControls
  private navigation!: WorldNavigation
  private cameraRig!: WorldCameraRig
  fps = 0

  constructor(canvas: HTMLCanvasElement, islandDefs: IslandDef[]) {
    this.islandDefs = islandDefs
    this.fireflies = createFireflies(islandDefs)
    try {
      // 直渲无后期 → MSAA 抗锯齿开着也便宜
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    } catch (e) {
      const el = document.getElementById('loading')
      if (el) {
        el.dataset.failed = '1' // 标记已给出精确文案，App.vue 的兜底不再覆盖
        el.querySelector('[data-role="status"]')!.textContent = '这台设备暂时打不开这片海'
        el.querySelector('[data-role="subtitle"]')!.textContent = '可以刷新重试，或换一台图形性能更好的设备再来看看。'
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
    this.cameraRig = new WorldCameraRig(this.camera)

    this.scene.add(this.sky, this.ocean, this.ship.group, this.ship.wake, this.sun, this.fill, this.hemi)
    this.scene.add(this.fireflies.points, this.plankton.points, this.jellies.group) // 夜晚魔法
    this.scene.add(this.splash.points) // 船头溅水
    this.ship.group.scale.setScalar(SHIP_SCALE)
    this.sun.position.copy(NIGHT.sunDir).multiplyScalar(500)

    for (const def of this.islandDefs) {
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
    this.cameraRig.seedSpawn(SPAWN[0], SPAWN[1])

    // ---- 验证钩子 ----
    if (q.has('t')) this.simTime = parseFloat(q.get('t')!) || 0
    this.tod = new TimeOfDay(q) // 时段钩子 ?tod / ?daycycle / ?theme 都在其构造里解析
    if (q.get('unlock') === 'all') {
      store.ephemeral = true
      for (const isl of this.islandDefs) if (isl.projects.length > 0) store.visited.add(isl.id)
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
    if (q.has('debug')) store.debug = true
    this.snapMode = q.has('snap')
    ;(window as any).__seek = (t: number) => (this.simTime = t)
    ;(window as any).__world = this
    ;(window as any).__store = store

    // 相机初始就位（避免第一帧从原点飞过来）
    this.cameraRig.snapToShip(this.ship.pos)

    this.controls = new WorldControls({
      canvas: this.renderer.domElement,
      camera: this.camera,
      getPaused: () => this.paused,
      land: () => this.navigation.land(),
      leave: () => this.navigation.leave(),
      fastTravelTo: (id) => this.navigation.fastTravelTo(id),
      findDockedChestHit: (raycaster) => {
        if (!store.dockedId) return undefined
        const obj = this.islands.get(store.dockedId)
        return obj ? raycaster.intersectObjects(obj.chests, false)[0] : undefined
      },
      findIslandHit: (raycaster) => raycaster.intersectObjects([...this.islands.values()].map(o => o.group), true)[0],
      resolveIslandId: (object) => object?.userData.islandId as string | undefined,
      openProject: (projectId) => {
        if (store.dockedId) this.onOpenProject?.(store.dockedId, projectId)
      },
    })
    this.navigation = new WorldNavigation({
      getSimTime: () => this.simTime,
      clearControls: () => this.controls.clearKeys(),
      getShipState: () => this.ship,
      getIslandObject: (id) => this.islands.get(id),
      spawnUnlockRing: (x, z, sim, color) => this.rings.spawn(x, z, sim, color),
      setLandAnchor: (sim, baseAngle) => {
        this.landStart = sim
        this.landBaseAngle = baseAngle
      },
    })

    const islandQ = q.get('island')
    if (islandQ) {
      const def = islandById(islandQ)
      const obj = this.islands.get(islandQ)
      if (def && obj) {
        // 把船放到岛边（朝出生点方向的一侧），走真实到达→解锁→登岛路径
        const dir = new THREE.Vector3(SPAWN[0] - def.position[0], 0, SPAWN[1] - def.position[1]).normalize()
        this.ship.pos.set(def.position[0] + dir.x * (obj.radius + 6), 0, def.position[1] + dir.z * (obj.radius + 6))
        this.ship.heading = Math.atan2(-dir.x, -dir.z)
        this.cameraRig.snapToShip(this.ship.pos)
        this.navigation.queueAutoLandAt(this.simTime + 0.6)
      }
    }

    window.addEventListener('resize', this.updateSizes)
    this.controls.attach()

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

  setPaused(p: boolean): void {
    this.paused = p
    this.controls.clearKeys()
  }

  setTouchMovement(throttle: number, steer: number, sprint = false): void {
    this.controls.setTouchMovement(throttle, steer, sprint)
  }

  /** Hud 点击：平滑过渡到下一个时段（委托给 TimeOfDay） */
  skipTimeOfDay(): void {
    this.tod.skip()
  }

  /** 给海豚随机安排下一次跃水的地点/朝向/弧高 */
  /** 小地图点击设目标（软引导：可指任何岛，迷雾岛给提示） */
  setManualTarget(id: string): void {
    this.navigation.setManualTarget(id)
  }

  minimapData() {
    return this.islandDefs.map(def => {
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
    const { throttle, steer, sprint } = this.controls.movement(store.mode !== 'landed')
    if (store.mode === 'docked' && (throttle !== 0 || steer !== 0)) {
      store.mode = 'sailing'
      store.dockedId = null
      this.navigation.markNoDockUntil(sim + 2.5)
    }

    // ---- 泊岸减速与到达 ----
    const { speedCap, nearId } = updateSailing({
      sim,
      dt,
      boundaryK: b,
      ship: this.ship,
      islandDefs: this.islandDefs,
      getIslandObject: (id) => this.islands.get(id),
      navigation: this.navigation,
    })

    const sailing = store.mode === 'sailing'
    this.ship.update(dt, sim, sailing ? throttle : 0, sailing ? steer : 0, sailing ? sprint : false, speedCap)

    // ?island=id 自动登岛
    if (this.navigation.getAutoLandAt() >= 0 && store.mode === 'docked' && sim >= this.navigation.getAutoLandAt()) {
      this.navigation.clearAutoLand()
      this.navigation.land()
    }

    // ---- 宝箱指引 ----
    this.navigation.pickAutoTarget(this.islandDefs, this.ship.pos)
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
        showToast(`「${def.name}」正在从迷雾中升起——${def.builder}的作品完成了！`)
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
    for (const def of this.islandDefs) {
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
    for (let i = 0; i < this.islandDefs.length; i++) {
      const def = this.islandDefs[i]
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

    const focusK = this.cameraRig.update({
      dt,
      snapMode: this.snapMode,
      ship: this.ship,
      getDockedIslandObject: () => (store.dockedId ? this.islands.get(store.dockedId) : undefined),
    })
    this.postfx.render({
      focusK,
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
    this.controls.detach()
    this.renderer.dispose()
  }
}

let world: World | null = null
export function createWorld(canvas: HTMLCanvasElement, islands: IslandDef[]): World {
  world = new World(canvas, islands)
  return world
}
export function getWorld(): World | null {
  return world
}

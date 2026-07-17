import * as THREE from 'three'
import type { IslandDef } from '../data/islands'
import { mulberry32, hashString, hash3 } from './rng'
import { glowTexture } from './sprites'
import { easeOutCubic } from './ease'
import {
  createBeacon,
  createChestDisplay,
  createFogSprites,
  createLabel,
  createPierLantern,
  type IslandFogSprite,
} from './island-overlays'
import { ISLAND_PROPS, type PropUpdate } from './island-props'
import { buildIslandGeometry } from './island-geometry'
import {
  updateBeacon,
  updateChestDisplay,
  updateFogSprites,
  updateHighlight,
  updateLabel,
  updateLantern,
  updateSmoke,
  type SmokeParticle,
  type SmokeSource,
} from './island-animation'
import type { IslandStatus } from './island-types'

// 程序化 Madbox 风小岛：同一主题也有多种轮廓（圆丘/双丘/三层蛋糕/蘑菇石柱/雪塔…），
// 形态由确定性种子决定——同一座岛永远长一个样，但整片海没有两座重样的岛。
// 三种状态外观：迷雾（灰蒙下沉裹雾）/ 待解锁（金色微光）/ 已解锁（点亮灯笼 + 浮出名字）。

const GRAY = new THREE.Color('#7c8798')
const GRAY_NIGHT = new THREE.Color('#38324e') // 夜里的迷雾岛剪影灰
const NIGHT_TINT = new THREE.Color('#6a5aa8') // 紫夜滤镜：白天色 → 夜色的统一染色
const _themed = new THREE.Color()
const _gray = new THREE.Color()

let _glowTex: THREE.CanvasTexture | null = null
function glowTex() { return (_glowTex ??= glowTexture('#ffffff')) }

const easeOutBack = (t: number) => {
  const c = 1.70158
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)
}

function jitter(geo: THREE.BufferGeometry, amp: number, salt: number): void {
  const pos = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    // 按位置取哈希：共享/重合顶点位移一致，不撕面
    const hx = hash3(Math.round(x * 7) + salt, Math.round(y * 7), Math.round(z * 7))
    const hz = hash3(Math.round(x * 7), Math.round(y * 7) + salt, Math.round(z * 7))
    const hy = hash3(Math.round(x * 7), Math.round(y * 7), Math.round(z * 7) + salt)
    pos.setXYZ(i, x + (hx - 0.5) * amp, y + (hy - 0.5) * amp * 0.5, z + (hz - 0.5) * amp)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
}

/** 手绘 AO：按高度写灰度顶点色（山脚深、山顶亮），乘在材质色上，mood/夜染不受影响 */
function applyGrad(mesh: THREE.Mesh, dark = 0.78, light = 1.12): void {
  const geo = mesh.geometry
  geo.computeBoundingBox()
  const y0 = geo.boundingBox!.min.y
  const y1 = geo.boundingBox!.max.y
  const pos = geo.attributes.position as THREE.BufferAttribute
  const col = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getY(i) - y0) / Math.max(y1 - y0, 1e-4), 0, 1)
    const v = dark + (light - dark) * (t * t * (3 - 2 * t))
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = v
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  ;(mesh.material as THREE.MeshLambertMaterial).vertexColors = true
}

interface TrackedMat {
  mat: THREE.MeshLambertMaterial
  base: THREE.Color // 白天基色
  nightBase: THREE.Color // 紫夜染色（由 base 推导）
  baseEmissive: number
}

export class IslandObject {
  group = new THREE.Group()
  def: IslandDef
  radius: number
  topY: number
  private mats: TrackedMat[] = []
  private beacon!: THREE.Sprite
  private beaconPhase: number
  private fogSprites: IslandFogSprite[] = []
  private label!: THREE.Sprite
  private lanternHead!: THREE.Mesh
  private lanternGlow!: THREE.Sprite
  private lanternOn = 0
  private labelW = 1
  private labelShown = 0
  private growStart = -1
  private unlockStart = -1
  private lastMoodK = 0
  onGrown: (() => void) | null = null
  // 聚焦升起 + 作品宝箱
  private lifted = false
  private liftK = 0
  chests: THREE.Mesh[] = [] // 可点击的作品宝箱网格（供射线拾取）
  private chestGroup = new THREE.Group()
  // 靠近高亮光环
  private highlighted = false
  private highlightK = 0
  private highlightRing!: THREE.Mesh
  // 地标与动态装饰
  private smoke: SmokeParticle[] = []
  private smokeSrc: SmokeSource[] = []
  private propUpdate: PropUpdate | null = null // 选中地标的逐帧动画

  constructor(def: IslandDef) {
    this.def = def
    const rng = mulberry32(hashString(def.id))
    const salt = hashString(def.id) % 977
    this.radius = (13 + rng() * 7) * 1.15 // 岛放大：~15–23 半径
    this.beaconPhase = rng() * Math.PI * 2
    const r = this.radius
    this.group.position.set(def.position[0], 0, def.position[1])

    // Lambert：最便宜的受光材质，扁平玩具感正好
    const mk = (hex: string, emissiveHex = '#000000', emissiveIntensity = 0): THREE.MeshLambertMaterial => {
      const mat = new THREE.MeshLambertMaterial({
        color: hex,
        flatShading: true,
        emissive: emissiveHex,
        emissiveIntensity,
      })
      const base = new THREE.Color(hex)
      const nightBase = base.clone().lerp(NIGHT_TINT, 0.42).multiplyScalar(0.6)
      this.mats.push({ mat, base, nightBase, baseEmissive: emissiveIntensity })
      return mat
    }

    // ---- 圆润阔叶树 / 松树 ----
    const GREENS = ['#4db35e', '#63c46c', '#83d47f']
    const mkTree = (x: number, z: number, y: number, s: number): void => {
      const autumn = rng() < 0.1
      if (rng() < 0.65) {
        // 阔叶树：树干 + 圆冠（Madbox 的西兰花树）
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 1.1 * s, 5), mk('#7a4f30'))
        trunk.position.set(x, y + 0.55 * s, z)
        const crownGeo = new THREE.IcosahedronGeometry(1.15 * s, 1)
        jitter(crownGeo, 0.28 * s, salt + Math.round(x * 13) + Math.round(z * 7))
        const crown = new THREE.Mesh(crownGeo, mk(autumn ? '#ffa94f' : GREENS[Math.floor(rng() * 3)]))
        crown.position.set(x, y + (1.1 + 0.85) * s, z)
        this.group.add(trunk, crown)
      } else {
        // 松树：双层锥
        const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.95 * s, 1.9 * s, 6), mk(autumn ? '#f0964a' : '#3d9c5d'))
        c1.position.set(x, y + 1.15 * s, z)
        const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.65 * s, 1.4 * s, 6), mk(autumn ? '#ffab5e' : '#4fae68'))
        c2.position.set(x, y + 2.1 * s, z)
        this.group.add(c1, c2)
      }
    }

    // 沙滩基座（所有形态共用：岛都泊在一圈沙洲上）
    const baseGeo = new THREE.CylinderGeometry(r * 1.0, r * 1.3, 2.4, 12)
    jitter(baseGeo, 1.4, salt)
    const base = new THREE.Mesh(baseGeo, mk('#f4dca4'))
    applyGrad(base, 0.8, 1.08)
    base.position.y = 0.1
    this.group.add(base)
    // 湿沙水线：贴着水面一圈深色沙，把"岛泡在水里"的接触感做实
    const wetGeo = new THREE.CylinderGeometry(r * 1.17, r * 1.26, 0.55, 12)
    jitter(wetGeo, 0.9, salt + 11)
    const wet = new THREE.Mesh(wetGeo, mk('#d2ab77'))
    wet.position.y = 0.14
    this.group.add(wet)

    // ---- 形态档案（Madbox 式：轮廓各不相同）----
    const topY = buildIslandGeometry({
      def,
      group: this.group,
      radius: r,
      salt,
      rng,
      mk,
      mkTree,
      jitter,
      applyGrad,
    })
    this.topY = topY
    const chestDisplay = createChestDisplay(this.group, this.def, this.radius, this.topY)
    this.chestGroup = chestDisplay.chestGroup
    this.chests = chestDisplay.chests
    this.highlightRing = chestDisplay.highlightRing
    this.decorate(rng, salt)
    const lantern = createPierLantern(this.group, this.radius, rng)
    this.lanternHead = lantern.lanternHead
    this.lanternGlow = lantern.lanternGlow
    this.beacon = createBeacon(this.group, topY)
    const label = createLabel(this.group, def.name, topY)
    this.label = label.label
    this.labelW = label.aspect
    this.fogSprites = createFogSprites(this.group, r, rng)

    // 全体 Lambert 网格投影+受影（低多边形体积感的来源；发光 sprite 不参与）
    this.group.traverse(o => {
      const m = o as THREE.Mesh
      if (m.isMesh && (m.material as THREE.Material).type === 'MeshLambertMaterial') {
        m.castShadow = true
        m.receiveShadow = true
      }
    })

    // 迷雾岛预置"沉底+灰化"静息态：离屏门控可能从未 update 过它，
    // 否则会以满色亮岛、未下沉、还带泡沫环的样子闯入画面（超宽视口下可见）。
    if (this.def.projects.length === 0) {
      this.applyMood(1, 0) // lastMoodK=1 → foamRadius 返回 0、颜色转灰、缩小
      this.group.position.y = -3.2
    }
  }

  /** 给水面 shader 用的泡沫半径：迷雾沉底时为 0（生长时泡沫随岛浮现） */
  get foamRadius(): number {
    if (this.lastMoodK > 0.65) return 0
    const s = 0.9 + 0.1 * (1 - this.lastMoodK)
    return this.radius * 1.06 * s
  }

  /** k: 1=完全迷雾态（灰、下沉、缩小），0=正常；nightK: 0=白天 1=紫夜 */
  private applyMood(k: number, nightK: number): void {
    this.lastMoodK = k
    _gray.lerpColors(GRAY, GRAY_NIGHT, nightK)
    for (const t of this.mats) {
      _themed.lerpColors(t.base, t.nightBase, nightK)
      t.mat.color.lerpColors(_themed, _gray, k * 0.88)
      // 夜里发光体更亮（火山口/雪峰微光是夜景的点睛）
      t.mat.emissiveIntensity = t.baseEmissive * (1 - k) * (1 + 0.7 * nightK)
    }
    // 竖直下沉/升起并入 update() 里唯一那次 position.y 计算（此处若写会被其覆盖）
    const s = 0.9 + 0.1 * (1 - k)
    this.group.scale.setScalar(s)
  }

  /** 生长动画：从迷雾中升起（营期王牌时刻） */
  grow(sim: number): void {
    if (this.growStart < 0) this.growStart = sim
  }

  playUnlock(sim: number): void {
    this.unlockStart = sim
  }

  get growing(): boolean {
    return this.growStart >= 0
  }

  /** 聚焦时把岛托起来、浮现作品宝箱 */
  setFocused(v: boolean): void {
    this.lifted = v
  }

  /** 靠近时高亮这座岛（提示可登岛） */
  setHighlight(v: boolean): void {
    this.highlighted = v
  }

  /** 地标与动态装饰：火山冒烟 + 按种子在滩上放一个地标（灯塔/风车/篝火/旗帜） */
  private decorate(rng: () => number, salt: number): void {
    if (this.def.projects.length === 0) return // 迷雾岛（未开发）不加装饰
    const r = this.radius
    if (this.def.theme === 'volcano') {
      this.smokeSrc.push({ x: 0, y: this.topY + 0.5, z: 0, every: 0.55, next: 0, color: '#5b5b66' })
    }
    // 按种子从注册表选一个地标，搭在滩上
    const ang = rng() * Math.PI * 2
    const px = Math.cos(ang) * r * 0.82
    const pz = Math.sin(ang) * r * 0.82
    const g = new THREE.Group()
    g.position.set(px, 1.7, pz)
    this.group.add(g)
    const prop = ISLAND_PROPS[salt % ISLAND_PROPS.length]
    this.propUpdate = prop(g, {
      ang,
      rng,
      px,
      pz,
      addSmoke: (x, y, z, every, color) => this.smokeSrc.push({ x, y, z, every, next: 0, color }),
    })
  }

  update(sim: number, dt: number, status: IslandStatus, suppressLabel = false, nightK = 0): void {
    // ---- 生长动画时间线 ----
    let moodK = status === 'foggy' ? 1 : 0
    let fogOpacity = status === 'foggy' ? 0.55 : 0
    if (this.growStart >= 0) {
      const k = Math.min((sim - this.growStart) / 3.5, 1)
      moodK = 1 - easeOutCubic(k)
      fogOpacity = 0.55 * (1 - easeOutCubic(Math.min(k * 1.4, 1)))
      if (k >= 1) {
        this.growStart = -1
        this.unlockStart = sim // 借解锁闪光作收尾
        this.onGrown?.()
      }
    }
    // 已点亮的岛在夜里保留一半本色（读作"被自己的灯照暖"，而非纯剪影）
    const effNight = status === 'visited' ? nightK * 0.5 : nightK
    this.applyMood(moodK, effNight)

    // 聚焦升起动画 + 浮出海面的轻晃
    this.liftK += ((this.lifted ? 1 : 0) - this.liftK) * (1 - Math.exp(-3.2 * dt))
    const LIFT = 10
    if (this.growStart < 0 && status !== 'foggy') {
      const t = sim * 0.6 + this.beaconPhase
      const bob = Math.sin(t) * 0.35 + Math.sin(t * 0.53 + 1.7) * 0.14
      this.group.position.y = bob + this.liftK * LIFT - 3.2 * moodK
      this.group.rotation.z = Math.sin(t * 0.7 + 0.6) * 0.012 * (1 - this.liftK)
      this.group.rotation.x = Math.cos(t * 0.62) * 0.012 * (1 - this.liftK)
    } else {
      // 迷雾岛下沉、生长时从水下缓缓升起（moodK 1→0）
      this.group.position.y = this.liftK * LIFT - 3.2 * moodK
    }
    // 作品宝箱：升起时由小放大浮现、上下浮动、缓缓自转
    updateChestDisplay(this.chestGroup, this.liftK, sim)

    // 靠近高亮光环：淡入淡出 + 呼吸脉动（升起聚焦时不显示）
    this.highlightK = updateHighlight(
      this.highlightRing,
      this.highlighted,
      this.liftK,
      this.highlightK,
      sim,
      dt,
    )

    // 地标动态（风车转/灯塔扫光/篝火明灭/旗帜飘）由选中的注册表条目自己更新
    this.propUpdate?.(sim, nightK)
    // 冒烟：从火山口/篝火升起，上升扩散淡出（对象池复用）
    updateSmoke(this.group, this.smoke, this.smokeSrc, sim, dt, glowTex())

    // ---- 解锁灯笼 ----
    this.lanternOn = updateLantern(
      this.lanternHead,
      this.lanternGlow,
      this.lanternOn,
      status,
      sim,
      dt,
      nightK,
    )

    // ---- 雾团漂移 ----
    updateFogSprites(this.fogSprites, sim, dt, fogOpacity)

    // ---- 信标 ----
    this.unlockStart = updateBeacon(
      this.beacon,
      status,
      sim,
      dt,
      this.beaconPhase,
      this.growStart,
      this.unlockStart,
    )

    // ---- 岛名标签 ----
    this.labelShown = updateLabel(
      this.label,
      this.labelW,
      this.labelShown,
      status,
      suppressLabel,
      this.unlockStart,
      sim,
      dt,
      easeOutBack,
    )
  }
}

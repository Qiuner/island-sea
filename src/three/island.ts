import * as THREE from 'three'
import type { IslandDef } from '../data/islands'
import { mulberry32, hashString, hash3 } from './rng'
import { glowTexture, fogTexture, labelTexture } from './sprites'

// 程序化 Madbox 风小岛：同一主题也有多种轮廓（圆丘/双丘/三层蛋糕/蘑菇石柱/雪塔…），
// 形态由确定性种子决定——同一座岛永远长一个样，但整片海没有两座重样的岛。
// 三种状态外观：迷雾（灰蒙下沉裹雾）/ 待解锁（金色微光）/ 已解锁（点亮灯笼 + 浮出名字）。

export type IslandStatus = 'foggy' | 'locked' | 'visited'

const GRAY = new THREE.Color('#7c8798')
const GRAY_NIGHT = new THREE.Color('#38324e') // 夜里的迷雾岛剪影灰
const NIGHT_TINT = new THREE.Color('#6a5aa8') // 紫夜滤镜：白天色 → 夜色的统一染色
const _themed = new THREE.Color()
const _gray = new THREE.Color()

let _glowTex: THREE.CanvasTexture | null = null
let _fogTex: THREE.CanvasTexture | null = null
function glowTex() { return (_glowTex ??= glowTexture('#ffffff')) }
function fogTex() { return (_fogTex ??= fogTexture()) }

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
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

// —— 岛上地标注册表 —— 每个地标 = 一条 build(g, ctx)：往 group 里搭好，返回逐帧 update。
// 加一种地标 = 往 ISLAND_PROPS 加一条；decorate() 按 salt 选一个（去掉了原来的 salt%4 if/else）。
type PropUpdate = (sim: number, nightK: number) => void
interface PropCtx {
  ang: number
  rng: () => number
  px: number
  pz: number
  addSmoke: (x: number, y: number, z: number, every: number, color: string) => void
}
const ISLAND_PROPS: ((g: THREE.Group, ctx: PropCtx) => PropUpdate)[] = [
  // 灯塔：白红塔身 + 灯室 + 横扫光束（白天几乎隐形、夜里才亮成探照灯）
  (g) => {
    const white = new THREE.MeshLambertMaterial({ color: '#f3f0e8', flatShading: true })
    const red = new THREE.MeshLambertMaterial({ color: '#e0604a', flatShading: true })
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 6, 10), white)
    tower.position.y = 3
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.02, 1.4, 10), red)
    stripe.position.y = 3.1
    const room = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.9, 1.2, 10), new THREE.MeshLambertMaterial({ color: '#39485a', flatShading: true }))
    room.position.y = 6.4
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.1, 10), red)
    roof.position.y = 7.5
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff2c0' }))
    lamp.position.y = 6.4
    const beamMat = new THREE.MeshBasicMaterial({ color: '#fff0b0', transparent: true, opacity: 0.13, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    const beamMesh = new THREE.Mesh(new THREE.ConeGeometry(2.2, 15, 14, 1, true), beamMat)
    beamMesh.rotation.z = Math.PI / 2
    beamMesh.position.x = 7.5
    const beam = new THREE.Group()
    beam.add(beamMesh)
    beam.position.y = 6.4
    g.add(tower, stripe, room, roof, lamp, beam)
    return (sim, nightK) => {
      beam.rotation.y = sim * 0.7
      beamMat.opacity = 0.04 + nightK * 0.22
    }
  },
  // 风车：塔身 + 四片持续转动的扇叶
  (g, ctx) => {
    g.rotation.y = -ctx.ang
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.4, 5, 8), new THREE.MeshLambertMaterial({ color: '#e8dcc0', flatShading: true }))
    body.position.y = 2.5
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.6, 8), new THREE.MeshLambertMaterial({ color: '#9a5a3a', flatShading: true }))
    roof.position.y = 5.6
    const blades = new THREE.Group()
    const bladeMat = new THREE.MeshLambertMaterial({ color: '#f2ede0', flatShading: true, side: THREE.DoubleSide })
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.42, 3.2, 0.08), bladeMat)
      blade.position.y = 1.7
      const arm = new THREE.Group()
      arm.add(blade)
      arm.rotation.z = (i * Math.PI) / 2
      blades.add(arm)
    }
    blades.position.set(0, 4.4, 1.55)
    g.add(body, roof, blades)
    return (sim) => {
      blades.rotation.z = sim * 0.8
    }
  },
  // 篝火：木柴 + 火苗 + 暖光晕明灭（夜里更旺）+ 炊烟
  (g, ctx) => {
    const logMat = new THREE.MeshLambertMaterial({ color: '#5a3a22', flatShading: true })
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.9, 6), logMat)
      log.rotation.set(Math.PI / 2.3, (i * Math.PI) / 2, 0)
      log.position.y = 0.3
      g.add(log)
    }
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.4, 7), new THREE.MeshBasicMaterial({ color: '#ff8a3a' }))
    fire.position.y = 0.95
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#ffffff'), color: '#ff9a4a', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }))
    glow.scale.setScalar(5)
    glow.position.y = 1
    g.add(fire, glow)
    ctx.addSmoke(ctx.px, 3.0, ctx.pz, 0.7, '#8a8a90')
    return (sim, nightK) => {
      const f = 0.55 + 0.25 * Math.sin(sim * 8) + 0.15 * Math.sin(sim * 13.7)
      ;(glow.material as THREE.SpriteMaterial).opacity = 0.4 + 0.25 * f + nightK * 0.35
      glow.scale.setScalar(4.5 + f * 1.3)
    }
  },
  // 旗帜：旗杆 + 双色三角旗随风摆动
  (g, ctx) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 5, 6), new THREE.MeshLambertMaterial({ color: '#8a6a44' }))
    pole.position.y = 2.5
    g.add(pole)
    const cols = ['#e0604a', '#4aa0d0', '#f4c561', '#6dc07e']
    const flags: THREE.Mesh[] = []
    for (let i = 0; i < 2; i++) {
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(1.7, 0.95),
        new THREE.MeshLambertMaterial({ color: cols[Math.floor(ctx.rng() * cols.length)], side: THREE.DoubleSide, flatShading: true }),
      )
      flag.position.set(0.9, 4.2 - i * 1.25, 0)
      flags.push(flag)
      g.add(flag)
    }
    return (sim) => {
      for (let i = 0; i < flags.length; i++) {
        const fl = flags[i]
        fl.rotation.y = Math.sin(sim * 3 + i) * 0.32
        fl.scale.x = 1 + Math.sin(sim * 4 + i) * 0.08
      }
    }
  },
]

export class IslandObject {
  group = new THREE.Group()
  def: IslandDef
  radius: number
  topY: number
  private mats: TrackedMat[] = []
  private beacon!: THREE.Sprite
  private beaconPhase: number
  private fogSprites: THREE.Sprite[] = []
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
  private smoke: { spr: THREE.Sprite; life: number; sx: number; sy: number; sz: number; drift: number }[] = []
  private smokeSrc: { x: number; y: number; z: number; every: number; next: number; color: string }[] = []
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
    let topY = 6
    if (def.theme === 'forest') {
      const roll = rng()
      if (roll < 0.3) {
        // 圆丘岛：半球草丘
        const dh = r * 0.55
        const R0 = r * 0.88
        const domeGeo = new THREE.SphereGeometry(R0, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)
        domeGeo.scale(1, dh / R0, 1)
        jitter(domeGeo, 1.1, salt + 1)
        const dome = new THREE.Mesh(domeGeo, mk('#66c06d'))
        applyGrad(dome, 0.74, 1.14)
        dome.position.y = 1.0
        this.group.add(dome)
        const n = 6 + Math.floor(rng() * 4)
        for (let i = 0; i < n; i++) {
          const a = rng() * Math.PI * 2
          const rr = (0.15 + rng() * 0.5) * R0
          const gy = 1.0 + dh * Math.sqrt(Math.max(0, 1 - (rr / R0) * (rr / R0))) * 0.96
          mkTree(Math.cos(a) * rr, Math.sin(a) * rr, gy - 0.3, 1.1 + rng() * 0.9)
        }
        // 草丘上撒几簇小花
        const flowerCols = ['#ff8fb3', '#ffd166', '#fff5f0']
        for (let i = 0; i < 6; i++) {
          const a = rng() * Math.PI * 2
          const rr = (0.3 + rng() * 0.55) * R0
          const gy = 1.0 + dh * Math.sqrt(Math.max(0, 1 - (rr / R0) * (rr / R0))) * 0.96
          const flower = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.2 + rng() * 0.12, 0),
            mk(flowerCols[Math.floor(rng() * 3)]),
          )
          flower.position.set(Math.cos(a) * rr, gy + 0.1, Math.sin(a) * rr)
          this.group.add(flower)
        }
        topY = dh + 5
      } else if (roll < 0.55) {
        // 双丘岛：一大一小两座草丘
        const spots: [number, number, number, number][] = [
          [-r * 0.28, r * 0.14, r * 0.52, r * 0.42],
          [r * 0.34, -r * 0.18, r * 0.38, r * 0.28],
        ]
        for (const [ox, oz, R0, dh] of spots) {
          const g = new THREE.SphereGeometry(R0, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2)
          g.scale(1, dh / R0, 1)
          jitter(g, 1.0, salt + Math.round(ox))
          const dome = new THREE.Mesh(g, mk('#6abf6e'))
          applyGrad(dome, 0.76, 1.12)
          dome.position.set(ox, 1.0, oz)
          this.group.add(dome)
          mkTree(ox + R0 * 0.1, oz - R0 * 0.1, 1 + dh * 0.9, 1.2 + rng() * 0.7)
          mkTree(ox - R0 * 0.35, oz + R0 * 0.3, 1 + dh * 0.55, 0.9 + rng() * 0.6)
        }
        topY = r * 0.42 + 5
      } else if (roll < 0.8) {
        // 三层蛋糕岛：岩壁 + 草顶逐层收分
        const tiers: [number, number][] = [
          [r * 0.86, r * 0.3],
          [r * 0.6, r * 0.26],
          [r * 0.36, r * 0.24],
        ]
        let yCursor = 1.0
        for (const [tr, th] of tiers) {
          const rockGeo = new THREE.CylinderGeometry(tr * 0.94, tr, th, 10)
          jitter(rockGeo, 0.8, salt + Math.round(tr))
          const rock = new THREE.Mesh(rockGeo, mk('#b09a7e'))
          applyGrad(rock, 0.72, 1.1)
          rock.position.y = yCursor + th / 2
          const cap = new THREE.Mesh(new THREE.CylinderGeometry(tr * 0.96, tr * 0.9, 0.5, 10), mk('#6fc571'))
          cap.position.y = yCursor + th + 0.22
          this.group.add(rock, cap)
          yCursor += th + 0.42
        }
        mkTree(0, 0, yCursor, 1.3 + rng() * 0.6)
        mkTree(r * 0.3, r * 0.16, tiers[0][1] + 1.5, 0.9)
        mkTree(-r * 0.36, -r * 0.1, tiers[0][1] + tiers[1][1] + 1.9, 0.85)
        topY = yCursor + 4.5
      } else {
        // 蘑菇石柱岛：细腰岩柱顶着一块草台
        const colH = r * 0.95
        const colGeo = new THREE.CylinderGeometry(r * 0.38, r * 0.52, colH, 9)
        jitter(colGeo, 1.1, salt + 5)
        const col = new THREE.Mesh(colGeo, mk('#a08a72'))
        applyGrad(col, 0.68, 1.12)
        col.position.y = 1.0 + colH / 2
        const capH = r * 0.22
        const capGeo = new THREE.CylinderGeometry(r * 0.72, r * 0.56, capH, 10)
        jitter(capGeo, 0.7, salt + 6)
        const cap = new THREE.Mesh(capGeo, mk('#68c26e'))
        cap.position.y = 1.0 + colH + capH / 2
        this.group.add(col, cap)
        const capTop = 1.0 + colH + capH
        const n = 3 + Math.floor(rng() * 3)
        for (let i = 0; i < n; i++) {
          const a = rng() * Math.PI * 2
          const rr = rng() * r * 0.42
          mkTree(Math.cos(a) * rr, Math.sin(a) * rr, capTop - 0.2, 0.9 + rng() * 0.7)
        }
        topY = capTop + 4.5
      }
    } else if (def.theme === 'volcano') {
      const mh = r * 1.1
      const coneGeo = new THREE.ConeGeometry(r * 0.85, mh, 9)
      jitter(coneGeo, 1.8, salt + 2)
      const cone = new THREE.Mesh(coneGeo, mk('#6b6474'))
      applyGrad(cone, 0.7, 1.16)
      cone.position.y = mh / 2 + 0.8
      this.group.add(cone)
      // 火山口余温：小面积发光体
      const crater = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.14, r * 0.2, 0.8, 8),
        mk('#2a2028', '#ff6a2a', 1.5),
      )
      crater.position.y = mh * 0.96
      this.group.add(crater)
      // 熔岩纹：从火山口淌下的两三道发光细流
      for (let i = 0; i < 3; i++) {
        const a = rng() * Math.PI * 2
        const from = new THREE.Vector3(Math.cos(a) * r * 0.13, mh * 0.92, Math.sin(a) * r * 0.13)
        const to = new THREE.Vector3(Math.cos(a) * r * (0.5 + rng() * 0.25), mh * 0.3, Math.sin(a) * r * (0.5 + rng() * 0.25))
        const dir = to.clone().sub(from)
        const streak = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, dir.length()), mk('#3a2a30', '#ff5a22', 1.3))
        streak.position.copy(from).addScaledVector(dir, 0.5)
        streak.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize())
        this.group.add(streak)
      }
      for (let i = 0; i < 5; i++) {
        const a = rng() * Math.PI * 2
        const rockGeo = new THREE.IcosahedronGeometry(1.1 + rng() * 1.5, 0)
        const rock = new THREE.Mesh(rockGeo, mk('#8d8598'))
        rock.position.set(Math.cos(a) * r * (0.75 + rng() * 0.2), 1.5, Math.sin(a) * r * 0.8)
        rock.rotation.set(rng() * 3, rng() * 3, rng() * 3)
        this.group.add(rock)
      }
      topY = mh + 1.5
    } else {
      // snow：双峰 或 冰塔尖
      if (rng() < 0.5) {
        const bh = r * 0.42
        const baseMoundGeo = new THREE.ConeGeometry(r * 0.92, bh, 9)
        jitter(baseMoundGeo, 1.4, salt + 3)
        const baseMound = new THREE.Mesh(baseMoundGeo, mk('#a8bfd0'))
        applyGrad(baseMound, 0.8, 1.1)
        baseMound.position.y = bh / 2 + 1.0
        this.group.add(baseMound)
        const ph = r * 1.15
        const peakGeo = new THREE.ConeGeometry(r * 0.52, ph, 8)
        jitter(peakGeo, 1.2, salt + 4)
        const peak = new THREE.Mesh(peakGeo, mk('#f4f9fc', '#b8cfe4', 0.1))
        applyGrad(peak, 0.82, 1.12)
        peak.position.set(r * 0.08, ph / 2 + bh * 0.7, -r * 0.06)
        this.group.add(peak)
        const p2h = r * 0.7
        const peak2 = new THREE.Mesh(new THREE.ConeGeometry(r * 0.34, p2h, 7), mk('#e8f1f8', '#a9c3da', 0.08))
        peak2.position.set(-r * 0.38, p2h / 2 + bh * 0.75, r * 0.3)
        this.group.add(peak2)
        topY = ph + bh + 1
      } else {
        // 冰塔尖：一根高塔 + 一圈小冰锥
        const sh = r * 1.5
        const spireGeo = new THREE.ConeGeometry(r * 0.4, sh, 7)
        jitter(spireGeo, 1.0, salt + 7)
        const spire = new THREE.Mesh(spireGeo, mk('#eef6fb', '#b8cfe4', 0.12))
        applyGrad(spire, 0.8, 1.14)
        spire.position.y = sh / 2 + 1.0
        this.group.add(spire)
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + rng() * 0.5
          const ch = r * (0.25 + rng() * 0.3)
          const shard = new THREE.Mesh(new THREE.ConeGeometry(ch * 0.32, ch, 5), mk('#d6e8f4', '#9fc0da', 0.08))
          shard.position.set(Math.cos(a) * r * 0.62, ch / 2 + 1.2, Math.sin(a) * r * 0.62)
          shard.rotation.z = (rng() - 0.5) * 0.25
          this.group.add(shard)
        }
        topY = sh + 1.5
      }
      // 雪岛通用：滩上立两三枚微光冰晶
      for (let i = 0; i < 3; i++) {
        const a = rng() * Math.PI * 2
        const crystal = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.5 + rng() * 0.45, 0),
          mk('#bfe6ff', '#8fd0f0', 0.4),
        )
        crystal.position.set(Math.cos(a) * r * 0.55, 1.9, Math.sin(a) * r * 0.55)
        crystal.rotation.set(rng() * 3, rng() * 3, rng() * 3)
        this.group.add(crystal)
      }
    }
    this.topY = topY
    this.buildChests()
    this.decorate(rng, salt)

    // 木栈桥：从沙滩伸进海里，尽头立解锁灯笼——船正好泊在桥边，
    // "作品完成 = 桥头的灯亮了"，泊岸这件事有了叙事落点
    {
      const la = rng() * Math.PI * 2
      const pier = new THREE.Group()
      const plankA = mk('#a06a3e')
      const plankB = mk('#8f5d35')
      const legMat = mk('#6e4a2a')
      const nP = 6
      const z0 = r * 0.92
      const z1 = r * 1.52
      const step = (z1 - z0) / nP
      for (let i = 0; i < nP; i++) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.22, step * 0.8), i % 2 ? plankA : plankB)
        plank.position.set(0, 1.66, z0 + step * (i + 0.5))
        plank.rotation.y = (rng() - 0.5) * 0.06
        pier.add(plank)
      }
      for (const [lx, lz] of [
        [-0.8, z0 + step * 1.2],
        [0.8, z0 + step * 1.6],
        [-0.8, z1 - step * 0.9],
        [0.8, z1 - step * 0.5],
      ] as [number, number][]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 2.4, 5), legMat)
        leg.position.set(lx, 0.5, lz)
        pier.add(leg)
      }
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 1.1, 5), legMat)
      post.position.set(0.85, 2.1, z1 - 0.4)
      pier.add(post)
      // 灯笼在桥头
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.15, 2.1, 6),
        new THREE.MeshLambertMaterial({ color: '#3a3248', flatShading: true }),
      )
      pole.position.set(-0.6, 2.7, z1 - 0.45)
      this.lanternHead = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.55, 0),
        new THREE.MeshLambertMaterial({ color: '#2a2438', emissive: '#ffb84d', emissiveIntensity: 0 }),
      )
      this.lanternHead.position.set(-0.6, 4.0, z1 - 0.45)
      this.lanternGlow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTex(),
          color: '#ffb04a',
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      this.lanternGlow.position.set(-0.6, 4.0, z1 - 0.45)
      this.lanternGlow.scale.setScalar(6.5)
      pier.add(pole, this.lanternHead, this.lanternGlow)
      pier.rotation.y = Math.PI / 2 - la
      this.group.add(pier)
    }

    // 微光信标（待解锁=金色脉动）
    const beaconMat = new THREE.SpriteMaterial({
      map: glowTex(),
      color: '#ffd27a',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.beacon = new THREE.Sprite(beaconMat)
    this.beacon.position.y = topY + 4
    this.beacon.scale.setScalar(9)
    this.group.add(this.beacon)

    // 岛名标签（解锁后浮出）
    const { tex, aspect } = labelTexture(def.name)
    const labelMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
    this.label = new THREE.Sprite(labelMat)
    this.labelW = aspect
    this.label.position.y = topY + 9.5
    this.label.scale.set(0, 0, 1)
    this.group.add(this.label)

    // 雾团（迷雾岛专用）：放在岛缘一圈，避免被山体挡住
    for (let i = 0; i < 5; i++) {
      const fm = new THREE.SpriteMaterial({
        map: fogTex(),
        color: '#a7b2c4',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
      const fs = new THREE.Sprite(fm)
      const a = (i / 5) * Math.PI * 2 + rng()
      fs.position.set(Math.cos(a) * r * 0.85, 2.5 + rng() * 3.5, Math.sin(a) * r * 0.85)
      fs.scale.setScalar(r * (1.1 + rng() * 0.5))
      fs.userData.orbit = { a, r: r * 0.85, speed: 0.05 + rng() * 0.05, y: fs.position.y }
      this.fogSprites.push(fs)
      this.group.add(fs)
    }

    // 全体 Lambert 网格投影+受影（低多边形体积感的来源；发光 sprite 不参与）
    this.group.traverse(o => {
      const m = o as THREE.Mesh
      if (m.isMesh && (m.material as THREE.Material).type === 'MeshLambertMaterial') {
        m.castShadow = true
        m.receiveShadow = true
      }
    })
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

  /** 作品做成岛顶上方漂浮的宝箱（可点击打开）；迷雾岛无项目则无宝箱 */
  private buildChests(): void {
    this.chestGroup.visible = false
    const projs = this.def.projects
    projs.forEach((p, idx) => {
      const c = new THREE.Group()
      const wood = new THREE.MeshLambertMaterial({ color: '#8a5a30', emissive: '#3a2410', emissiveIntensity: 0.4, flatShading: true })
      const gold = new THREE.MeshLambertMaterial({ color: '#f4c561', emissive: '#e8a838', emissiveIntensity: 0.9, flatShading: true })
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.5, 1.9), wood)
      body.position.y = 0.75
      const lid = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.7, 2.0), wood)
      lid.position.set(0, 1.65, -0.2)
      lid.rotation.x = -0.55
      const band = new THREE.Mesh(new THREE.BoxGeometry(2.72, 0.26, 2.03), gold)
      band.position.y = 1.5
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.22), gold)
      lock.position.set(0, 0.95, 1.0)
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: glowTexture('#ffffff'), color: '#ffdf9a', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
      )
      halo.scale.setScalar(7)
      halo.position.y = 1.0
      c.add(halo, body, lid, band, lock)
      const ang = projs.length > 1 ? (idx / projs.length) * Math.PI * 2 : 0
      const rad = projs.length > 1 ? this.radius * 0.55 : 0
      const baseY = this.topY + 6
      c.position.set(Math.cos(ang) * rad, baseY, Math.sin(ang) * rad)
      c.userData.baseY = baseY
      c.userData.bob = idx * 1.7
      c.scale.setScalar(0.001)
      this.chestGroup.add(c)
      for (const m of [body, lid, band, lock]) {
        m.userData.projectId = p.id
        this.chests.push(m)
      }
    })
    this.group.add(this.chestGroup)

    // 靠近高亮：贴水面的金色光环
    const ringGeo = new THREE.RingGeometry(this.radius * 1.12, this.radius * 1.4, 44)
    ringGeo.rotateX(-Math.PI / 2)
    this.highlightRing = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: '#ffe0a0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    )
    this.highlightRing.position.y = 1.85
    this.group.add(this.highlightRing)
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
    this.chestGroup.visible = this.liftK > 0.02
    if (this.chestGroup.visible) {
      const sc = Math.min(this.liftK, 1)
      for (const c of this.chestGroup.children) {
        c.scale.setScalar(1.3 * sc)
        c.position.y = c.userData.baseY + Math.sin(sim * 1.6 + c.userData.bob) * 0.7
        c.rotation.y = sim * 0.5 + c.userData.bob
      }
    }

    // 靠近高亮光环：淡入淡出 + 呼吸脉动（升起聚焦时不显示）
    const wantH = this.highlighted && this.liftK < 0.1 ? 1 : 0
    this.highlightK += (wantH - this.highlightK) * (1 - Math.exp(-5 * dt))
    const hm = this.highlightRing.material as THREE.MeshBasicMaterial
    hm.opacity = this.highlightK * (0.45 + 0.28 * Math.sin(sim * 3.2))
    const hs = 1 + 0.05 * Math.sin(sim * 3.2)
    this.highlightRing.scale.set(hs, 1, hs)

    // 地标动态（风车转/灯塔扫光/篝火明灭/旗帜飘）由选中的注册表条目自己更新
    this.propUpdate?.(sim, nightK)
    // 冒烟：从火山口/篝火升起，上升扩散淡出（对象池复用）
    for (const src of this.smokeSrc) {
      if (sim >= src.next) {
        src.next = sim + src.every
        let p = this.smoke.find(s => s.life <= 0)
        if (!p) {
          const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#ffffff'), color: src.color, transparent: true, opacity: 0, depthWrite: false }))
          this.group.add(spr)
          p = { spr, life: 0, sx: 0, sy: 0, sz: 0, drift: 0 }
          this.smoke.push(p)
        }
        p.life = 1
        p.sx = src.x
        p.sy = src.y
        p.sz = src.z
        p.drift = (Math.random() - 0.5) * 0.7
        ;(p.spr.material as THREE.SpriteMaterial).color.set(src.color)
      }
    }
    for (const p of this.smoke) {
      if (p.life <= 0) {
        p.spr.visible = false
        continue
      }
      p.life -= dt * 0.26
      const age = 1 - p.life
      p.spr.visible = p.life > 0
      p.spr.position.set(p.sx + p.drift * age * 6, p.sy + age * 11, p.sz + p.drift * age * 4)
      p.spr.scale.setScalar(1.6 + age * 5.5)
      ;(p.spr.material as THREE.SpriteMaterial).opacity = Math.min(p.life * 1.4, 0.6)
    }

    // ---- 解锁灯笼 ----
    const wantLantern = status === 'visited' ? 1 : 0
    this.lanternOn += (wantLantern - this.lanternOn) * (1 - Math.exp(-3 * dt))
    const flicker = 1 + 0.06 * Math.sin(sim * 7.3) + 0.04 * Math.sin(sim * 2.9)
    ;(this.lanternHead.material as THREE.MeshLambertMaterial).emissiveIntensity =
      this.lanternOn * flicker * (0.9 + 0.9 * nightK)
    ;(this.lanternGlow.material as THREE.SpriteMaterial).opacity =
      this.lanternOn * flicker * (0.35 + 0.5 * nightK)

    // ---- 雾团漂移 ----
    for (const fs of this.fogSprites) {
      const o = fs.userData.orbit
      o.a += o.speed * dt
      fs.position.set(Math.cos(o.a) * o.r, o.y + Math.sin(sim * 0.5 + o.a) * 0.8, Math.sin(o.a) * o.r)
      const m = fs.material as THREE.SpriteMaterial
      m.opacity += (fogOpacity - m.opacity) * (1 - Math.exp(-2.5 * dt))
    }

    // ---- 信标 ----
    const bm = this.beacon.material as THREE.SpriteMaterial
    let targetOp = 0
    if (status === 'locked' && this.growStart < 0) {
      bm.color.set('#ffd27a')
      targetOp = 0.5 + 0.3 * Math.sin(sim * 2.1 + this.beaconPhase)
      this.beacon.scale.setScalar(9 + Math.sin(sim * 2.1 + this.beaconPhase) * 1.5)
    } else if (status === 'visited') {
      // 灯笼接管"已点亮"的表达，信标只留一点余韵
      bm.color.set('#bfeee2')
      targetOp = 0.12 + 0.04 * Math.sin(sim * 1.3 + this.beaconPhase)
      this.beacon.scale.setScalar(7)
    }
    // 解锁/生长收尾的闪光
    if (this.unlockStart >= 0) {
      const u = (sim - this.unlockStart) / 1.8
      if (u < 1) targetOp += (1 - u) * 1.1
      else this.unlockStart = -1
    }
    bm.opacity += (targetOp - bm.opacity) * (1 - Math.exp(-6 * dt))

    // ---- 岛名标签 ----
    const wantLabel = status === 'visited' && !suppressLabel ? 1 : 0
    if (wantLabel > this.labelShown && this.unlockStart >= 0) {
      // 解锁瞬间带回弹浮出
      const u = Math.min((sim - this.unlockStart) / 1.0, 1)
      this.labelShown = easeOutBack(u) * (u > 0 ? 1 : 0)
      if (u >= 1) this.labelShown = 1
    } else {
      this.labelShown += (wantLabel - this.labelShown) * (1 - Math.exp(-4 * dt))
    }
    const ls = Math.max(this.labelShown, 0)
    this.label.scale.set(5.5 * this.labelW * ls, 5.5 * ls, 1)
  }
}

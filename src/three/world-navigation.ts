import * as THREE from 'three'
import { store, statusOf, markVisited, islandById, showToast, foundCount, discoverableCount } from '../store'
import type { IslandDef } from '../data/islands'
import type { IslandObject } from './island'

interface WorldNavigationDeps {
  getSimTime: () => number
  clearControls: () => void
  getShipState: () => { pos: THREE.Vector3; heading: number; speed: number }
  getIslandObject: (id: string) => IslandObject | undefined
  spawnUnlockRing: (x: number, z: number, sim: number, color?: string) => void
  setLandAnchor: (sim: number, baseAngle: number) => void
}

export class WorldNavigation {
  private readonly getSimTime: () => number
  private readonly clearControls: () => void
  private readonly getShipState: () => { pos: THREE.Vector3; heading: number; speed: number }
  private readonly getIslandObject: (id: string) => IslandObject | undefined
  private readonly spawnUnlockRing: (x: number, z: number, sim: number, color?: string) => void
  private readonly setLandAnchor: (sim: number, baseAngle: number) => void

  private manualTargetId: string | null = null
  private foggyToasted = new Set<string>()
  private noDockUntil = -1
  private autoLandAt = -1

  constructor(deps: WorldNavigationDeps) {
    this.getSimTime = deps.getSimTime
    this.clearControls = deps.clearControls
    this.getShipState = deps.getShipState
    this.getIslandObject = deps.getIslandObject
    this.spawnUnlockRing = deps.spawnUnlockRing
    this.setLandAnchor = deps.setLandAnchor
  }

  getAutoLandAt(): number {
    return this.autoLandAt
  }

  clearAutoLand(): void {
    this.autoLandAt = -1
  }

  markNoDockUntil(sim: number): void {
    this.noDockUntil = sim
  }

  queueAutoLandAt(sim: number): void {
    this.autoLandAt = sim
  }

  private faceAwayFromIsland(def: IslandDef): void {
    const ship = this.getShipState()
    const dx = ship.pos.x - def.position[0]
    const dz = ship.pos.z - def.position[1]
    const d = Math.hypot(dx, dz) || 1
    ship.heading = Math.atan2(dx / d, dz / d)
  }

  fastTravelTo(id: string): void {
    const def = islandById(id)
    if (!def || store.mode === 'landed') return
    if (statusOf(def) === 'foggy') {
      showToast(`「${def.name}」还睡在迷雾里，${def.builder}的作品完成后它才会醒来`)
      return
    }
    const obj = this.getIslandObject(id)
    if (!obj) return
    const ship = this.getShipState()
    let dx = ship.pos.x - def.position[0]
    let dz = ship.pos.z - def.position[1]
    const dl = Math.hypot(dx, dz) || 1
    dx /= dl
    dz /= dl
    ship.pos.set(def.position[0] + dx * (obj.radius + 6), 0, def.position[1] + dz * (obj.radius + 6))
    ship.heading = Math.atan2(dx, dz)
    ship.speed = 0
    this.clearControls()
    store.mode = 'docked'
    store.dockedId = id
    this.manualTargetId = null
    this.noDockUntil = this.getSimTime() + 1.5
    if (statusOf(def) === 'locked') {
      this.unlockIsland(def, this.getSimTime())
    } else {
      showToast(`⛵ 已抵达「${def.name}」`)
    }
    this.land()
  }

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

  pickAutoTarget(islandDefs: IslandDef[], shipPos: THREE.Vector3): void {
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
    for (const def of islandDefs) {
      if (statusOf(def) !== 'locked') continue
      const d = Math.hypot(def.position[0] - shipPos.x, def.position[1] - shipPos.z)
      if (d < bestD) {
        bestD = d
        best = def.id
      }
    }
    store.targetId = best
  }

  tryDockCandidate(def: IslandDef, obj: IslandObject, d: number, sim: number): void {
    const st = statusOf(def)
    if (st === 'foggy') {
      if (d < obj.radius + 10 && !this.foggyToasted.has(def.id)) {
        this.foggyToasted.add(def.id)
        showToast(`「${def.name}」还睡在迷雾里……等${def.builder}的作品完成，它会醒来`)
      }
      return
    }
    if (d >= obj.radius + 8.5 || sim <= this.noDockUntil) {
      return
    }
    const ship = this.getShipState()
    store.mode = 'docked'
    store.dockedId = def.id
    ship.speed = 0
    this.faceAwayFromIsland(def)
    if (st === 'locked') {
      this.manualTargetId = this.manualTargetId === def.id ? null : this.manualTargetId
      this.unlockIsland(def, sim)
    }
    this.land()
  }

  land(): void {
    if (!store.dockedId) return
    const def = islandById(store.dockedId)
    const obj = this.getIslandObject(store.dockedId)
    if (!def || !obj) return
    const ship = this.getShipState()
    store.mode = 'landed'
    const c = obj.group.position
    const baseAngle = Math.atan2(ship.pos.x - c.x, ship.pos.z - c.z)
    this.setLandAnchor(this.getSimTime(), baseAngle)
    obj.setFocused(true)
  }

  leave(): void {
    if (store.mode !== 'landed') return
    if (store.dockedId) this.getIslandObject(store.dockedId)?.setFocused(false)
    store.mode = 'docked'
  }

  private unlockIsland(def: IslandDef, sim: number): void {
    const obj = this.getIslandObject(def.id)
    if (!obj) return
    markVisited(def.id)
    obj.playUnlock(sim)
    this.spawnUnlockRing(def.position[0], def.position[1], sim)
    showToast(`✨ 寻获「${def.name}」！已寻获 ${foundCount.value} / ${discoverableCount.value} 座岛`)
  }
}

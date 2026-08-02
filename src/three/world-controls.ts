import * as THREE from 'three'
import { store } from '../store'

interface WorldControlsDeps {
  canvas: HTMLCanvasElement
  camera: THREE.Camera
  getPaused: () => boolean
  land: () => void
  leave: () => void
  fastTravelTo: (id: string) => void
  findDockedChestHit: (raycaster: THREE.Raycaster) => THREE.Intersection<THREE.Object3D> | undefined
  findIslandHit: (raycaster: THREE.Raycaster) => THREE.Intersection<THREE.Object3D> | undefined
  resolveIslandId: (object: THREE.Object3D | null) => string | undefined
  openProject: (projectId: string) => void
}

export class WorldControls {
  private readonly canvas: HTMLCanvasElement
  private readonly camera: THREE.Camera
  private readonly getPaused: () => boolean
  private readonly land: () => void
  private readonly leave: () => void
  private readonly fastTravelTo: (id: string) => void
  private readonly findDockedChestHit: (raycaster: THREE.Raycaster) => THREE.Intersection<THREE.Object3D> | undefined
  private readonly findIslandHit: (raycaster: THREE.Raycaster) => THREE.Intersection<THREE.Object3D> | undefined
  private readonly resolveIslandId: (object: THREE.Object3D | null) => string | undefined
  private readonly openProject: (projectId: string) => void
  private readonly keys = new Set<string>()
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointerNdc = new THREE.Vector2()

  constructor(deps: WorldControlsDeps) {
    this.canvas = deps.canvas
    this.camera = deps.camera
    this.getPaused = deps.getPaused
    this.land = deps.land
    this.leave = deps.leave
    this.fastTravelTo = deps.fastTravelTo
    this.findDockedChestHit = deps.findDockedChestHit
    this.findIslandHit = deps.findIslandHit
    this.resolveIslandId = deps.resolveIslandId
    this.openProject = deps.openProject
  }

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    this.canvas.addEventListener('click', this.onCanvasClick)
    window.addEventListener('blur', this.onBlur)
    document.addEventListener('visibilitychange', this.onVisibility)
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.canvas.removeEventListener('click', this.onCanvasClick)
    window.removeEventListener('blur', this.onBlur)
    document.removeEventListener('visibilitychange', this.onVisibility)
  }

  clearKeys(): void {
    this.keys.clear()
  }

  movement(canSail: boolean): { throttle: number; steer: number; sprint: boolean } {
    if (!canSail) {
      return { throttle: 0, steer: 0, sprint: false }
    }
    let throttle = 0
    let steer = 0
    if (this.keys.has('w') || this.keys.has('arrowup')) throttle += 1
    if (this.keys.has('s') || this.keys.has('arrowdown')) throttle -= 0.6
    if (this.keys.has('a') || this.keys.has('arrowleft')) steer += 1
    if (this.keys.has('d') || this.keys.has('arrowright')) steer -= 1
    return { throttle, steer, sprint: this.keys.has('shift') }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault()
    this.keys.add(e.key.toLowerCase())
    if (this.getPaused()) return
    if (e.key === 'Enter' && store.mode === 'docked') this.land()
    if (e.key === 'Escape' && store.mode === 'landed') this.leave()
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase())
  }

  private onBlur = (): void => {
    this.keys.clear()
  }

  private onVisibility = (): void => {
    if (document.hidden) this.keys.clear()
  }

  private onCanvasClick = (e: MouseEvent): void => {
    if (this.getPaused()) return
    const rect = this.canvas.getBoundingClientRect()
    this.pointerNdc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(this.pointerNdc, this.camera)
    if (store.mode === 'landed' && store.dockedId) {
      const hit = this.findDockedChestHit(this.raycaster)
      const projectId = hit?.object.userData.projectId as string | undefined
      if (projectId) this.openProject(projectId)
      return
    }
    const hit = this.findIslandHit(this.raycaster)
    if (!hit) return
    let object: THREE.Object3D | null = hit.object
    while (object && object.userData.islandId === undefined) object = object.parent
    const islandId = this.resolveIslandId(object)
    if (!islandId) return
    if (store.mode === 'docked' && store.dockedId === islandId) this.land()
    else this.fastTravelTo(islandId)
  }
}

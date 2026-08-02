import * as THREE from 'three'
import { createSky } from './three/sky'
import { createOcean } from './three/ocean'
import { IslandObject } from './three/island'
import { Ship } from './three/ship'
import { DAY } from './three/themes'
import type { IslandDef } from './data/islands'
import { SHIP_SCALE } from './three/config'

export function initLoadingScene(canvas: HTMLCanvasElement): () => void {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = DAY.exposure

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(DAY.fogColor.clone(), 120, 560)
  scene.background = new THREE.Color().copy(DAY.skyTop)

  const camera = new THREE.PerspectiveCamera(34, window.innerWidth / Math.max(window.innerHeight, 1), 0.1, 1600)
  camera.position.set(-68, 54, 110)
  camera.lookAt(38, 6, 0)

  const sky = createSky()
  const skyUniforms = (sky.material as THREE.ShaderMaterial).uniforms
  skyUniforms.uTop.value.copy(DAY.skyTop)
  skyUniforms.uMid.value.copy(DAY.skyMid)
  skyUniforms.uHorizon.value.copy(DAY.skyHorizon)
  scene.add(sky)

  const ocean = createOcean()
  scene.add(ocean)

  const sun = new THREE.DirectionalLight(DAY.sunColor, DAY.sunIntensity)
  sun.position.copy(DAY.sunDir).multiplyScalar(240)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -90
  sun.shadow.camera.right = 90
  sun.shadow.camera.top = 90
  sun.shadow.camera.bottom = -90
  sun.shadow.camera.near = 40
  sun.shadow.camera.far = 480
  sun.shadow.bias = -0.0003
  sun.shadow.normalBias = 0.45
  scene.add(sun, sun.target)

  const fill = new THREE.DirectionalLight(DAY.fillColor, DAY.fillIntensity * 1.2)
  fill.position.set(-DAY.sunDir.x, 0.5, -DAY.sunDir.z).normalize().multiplyScalar(220)
  const hemi = new THREE.HemisphereLight(DAY.hemiSky, DAY.hemiGround, DAY.hemiIntensity)
  scene.add(fill, hemi)

  const islandDef: IslandDef = {
    id: 'loading-preview-island',
    name: '启航屿',
    builder: 'Preview',
    description: 'Loading preview scene',
    theme: 'forest',
    position: [36, 0],
    projects: [{ id: 'preview', name: 'preview', url: '#' }],
  }

  const island = new IslandObject(islandDef)
  scene.add(island.group)

  const ship = new Ship()
  ship.group.scale.setScalar(SHIP_SCALE)
  ship.pos.set(9, 0, 19)
  ship.heading = Math.atan2(islandDef.position[0] - ship.pos.x, islandDef.position[1] - ship.pos.z) + 0.46
  ship.update(0.016, 0, 0, 0, false, Infinity)
  scene.add(ship.group)

  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.isMesh && (mesh.material as THREE.Material).type === 'MeshLambertMaterial') {
      mesh.castShadow = true
      mesh.receiveShadow = true
    }
  })

  const oceanUniforms = (ocean.material as THREE.ShaderMaterial).uniforms
  const islandVecs = oceanUniforms.uIslands.value as THREE.Vector3[]
  islandVecs[0].set(islandDef.position[0], islandDef.position[1], island.foamRadius)
  for (let i = 1; i < islandVecs.length; i++) islandVecs[i].set(0, 0, 0)
  oceanUniforms.uSeaA.value.copy(DAY.seaA)
  oceanUniforms.uSeaB.value.copy(DAY.seaB)
  oceanUniforms.uSeaShallow.value.copy(DAY.seaShallow)
  oceanUniforms.uSunDir.value.copy(DAY.sunDir)
  oceanUniforms.uSunColor.value.copy(DAY.sunColor)

  const clock = new THREE.Clock()
  let raf = 0
  let disposed = false

  const resize = (): void => {
    const w = window.innerWidth
    const h = window.innerHeight
    if (w === 0 || h === 0 || disposed) return
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }

  const animate = (): void => {
    if (disposed || !canvas.isConnected) return
    raf = requestAnimationFrame(animate)
    const elapsed = clock.getElapsedTime()
    const dt = Math.min(clock.getDelta(), 0.05)

    skyUniforms.uTime.value = elapsed
    oceanUniforms.uTime.value = elapsed

    island.update(elapsed, dt, 'visited', true, 0)
    ship.update(dt, elapsed, 0, 0, false, Infinity)
    ship.group.rotation.y += Math.sin(elapsed * 0.35) * 0.0009

    ocean.position.set(ship.pos.x + 18, 0, ship.pos.z + 4)

    const drift = Math.sin(elapsed * 0.22) * 1.4
    camera.position.set(-68 + drift, 54 + Math.sin(elapsed * 0.18) * 1.1, 110 - drift * 0.5)
    camera.lookAt(38, 6.5, 0)
    renderer.render(scene, camera)
  }

  window.addEventListener('resize', resize)
  animate()

  return () => {
    disposed = true
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
    renderer.dispose()
  }
}

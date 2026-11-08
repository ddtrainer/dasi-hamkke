import { useMemo } from 'react'
import * as THREE from 'three'
import { MARKET, terrainHeight } from './terrain'
import { goToDestination } from './actions'

const FONT = '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif'
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return t
}
const marketSign = () => canvasTex(640, 210, (g) => {
  g.fillStyle = '#c99a5b'; g.fillRect(0, 0, 640, 210)
  g.fillStyle = '#b3834a'; for (let y = 0; y < 210; y += 22) g.fillRect(0, y, 640, 2)
  g.strokeStyle = '#7a5530'; g.lineWidth = 10; g.strokeRect(5, 5, 630, 200)
  g.fillStyle = '#fff6df'; g.beginPath(); g.arc(70, 78, 34, 0, 7); g.fill()
  g.fillStyle = '#c9843d'; g.font = '44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🐾', 70, 80)
  g.fillStyle = '#4a2f18'; g.font = `700 62px ${FONT}`; g.fillText('댕냥 메모리 마켓', 365, 76)
  g.font = `32px ${FONT}`; g.fillStyle = '#6b4526'; g.fillText('반려동물 의류 · 간식 · 굿즈', 330, 156)
})
const chalk = () => canvasTex(256, 340, (g) => {
  g.fillStyle = '#2f3a34'; g.fillRect(0, 0, 256, 340)
  g.strokeStyle = '#e7d6b0'; g.lineWidth = 8; g.strokeRect(6, 6, 244, 328)
  g.fillStyle = '#fffbe9'; g.textAlign = 'center'; g.font = `700 36px ${FONT}`; g.fillText('오늘의 간식', 128, 70)
  g.font = '110px sans-serif'; g.fillText('🦴', 128, 190); g.font = `24px ${FONT}`; g.fillText('댕냥 메모리 마켓', 128, 290)
})

const WOOD = '#e0b07a', BEAM = '#7a5232', ROOF = '#8b94a3'
const box = (w: number, h: number, d: number, color: string, pos: [number, number, number], extra?: { rot?: [number, number, number]; emissive?: string; ei?: number; shadow?: boolean }) => (
  <mesh position={pos} rotation={extra?.rot} castShadow={extra?.shadow !== false}>
    <boxGeometry args={[w, h, d]} />
    <meshStandardMaterial color={color} roughness={0.9} emissive={extra?.emissive ?? '#000'} emissiveIntensity={extra?.ei ?? 0} />
  </mesh>
)

/** 댕냥 메모리 마켓 — a cosy shop selling clothes, snacks and goods. Local +z is the shop front. */
export function Market() {
  const y = terrainHeight(MARKET.x, MARKET.z)
  const sign = useMemo(marketSign, [])
  const board = useMemo(chalk, [])
  const stripes = useMemo(() => Array.from({ length: 7 }, (_, i) => -3 + i), [])
  const hangers = ['#ff8fa8', '#8fd0ff', '#ffe066', '#b9e08a', '#c9a0ff']
  return (
    <group position={[MARKET.x, y, MARKET.z]} rotation-y={MARKET.ry}
      onClick={(e) => { e.stopPropagation(); goToDestination('market') }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
      {/* wooden deck */}
      {box(9.4, 0.16, 7.4, '#ead9b6', [0, 0.05, 1.0], { shadow: false })}
      {/* body + timber frame */}
      {box(6.4, 3.2, 4.2, WOOD, [0, 1.7, -0.8])}
      {[-3.2, 3.2].map((x) => box(0.22, 3.3, 0.22, BEAM, [x, 1.7, 1.32]))}
      {box(6.8, 0.2, 0.24, BEAM, [0, 3.25, 1.32])}
      {box(6.8, 0.18, 0.24, BEAM, [0, 0.2, 1.32])}
      {/* shop window (warm glow) and door */}
      <mesh position={[-0.9, 1.65, 1.33]}><planeGeometry args={[3.6, 1.7]} /><meshStandardMaterial color="#ffd98a" emissive="#ffb84a" emissiveIntensity={0.85} /></mesh>
      {box(3.9, 0.12, 0.1, BEAM, [-0.9, 2.55, 1.36])}
      {box(3.9, 0.12, 0.1, BEAM, [-0.9, 0.75, 1.36])}
      {box(0.1, 1.9, 0.1, BEAM, [-0.9, 1.65, 1.36])}
      {box(1.1, 2.2, 0.12, '#a8693a', [2.3, 1.2, 1.34])}
      <mesh position={[2.3, 1.2, 1.41]}><sphereGeometry args={[0.06, 8, 8]} /><meshStandardMaterial color="#ffd98a" /></mesh>
      {/* gable roof + chimney */}
      {box(7.4, 0.2, 3.5, ROOF, [0, 4.15, 0.35], { rot: [0.5, 0, 0] })}
      {box(7.4, 0.2, 3.5, ROOF, [0, 4.15, -1.95], { rot: [-0.5, 0, 0] })}
      {box(7.4, 0.25, 0.3, '#6f7886', [0, 4.9, -0.8])}
      {box(0.7, 1.6, 0.7, '#a99b8e', [-2.0, 4.8, -1.8])}
      {/* striped awning */}
      {stripes.map((x, i) => box(1.0, 0.08, 1.7, i % 2 ? '#fffaf2' : '#ff9fb8', [x, 2.7, 2.1], { rot: [0.32, 0, 0] }))}
      {/* sign board on two posts */}
      {box(0.14, 1.7, 0.14, BEAM, [-1.9, 3.5, 2.75])}
      {box(0.14, 1.7, 0.14, BEAM, [1.9, 3.5, 2.75])}
      <mesh position={[0, 4.0, 2.8]}><planeGeometry args={[4.4, 1.45]} /><meshBasicMaterial map={sign} toneMapped={false} /></mesh>
      <mesh position={[0, 4.0, 2.7]} rotation-y={Math.PI}><planeGeometry args={[4.4, 1.45]} /><meshBasicMaterial map={sign} toneMapped={false} /></mesh>
      {/* counter with goods */}
      {box(5.4, 0.95, 0.6, '#b98552', [-0.2, 0.6, 1.75])}
      {['#ff8fa8', '#8fd0ff', '#ffe066', '#c9a0ff', '#b9e08a', '#ffb3c7', '#9ad0c0'].map((c, i) => (
        <mesh key={i} position={[-2.4 + i * 0.75, 1.22, 1.75]}><boxGeometry args={[0.38, 0.32, 0.3]} /><meshStandardMaterial color={c} /></mesh>
      ))}
      {/* shelves left & right */}
      {[-3.9, 3.9].map((x, k) => (
        <group key={x} position={[x, 0, 1.9]}>
          {box(1.1, 2.0, 0.5, '#9b6a3f', [0, 1.05, 0])}
          {[0.45, 1.0, 1.55].map((h, r) => (
            <group key={h}>
              {box(1.0, 0.06, 0.46, '#c99a5b', [0, h, 0.02], { shadow: false })}
              {[-0.3, 0, 0.3].map((dx, c) => (
                <mesh key={c} position={[dx, h + 0.17, 0.06]}><boxGeometry args={[0.22, 0.28, 0.2]} /><meshStandardMaterial color={['#fff2c9', '#ffc9a8', '#cfe8ff', '#e6d3ff'][(r + c + k) % 4]} /></mesh>
              ))}
            </group>
          ))}
        </group>
      ))}
      {/* clothes rack */}
      <group position={[-4.8, 0, 3.2]}>
        {[-0.8, 0.8].map((x) => box(0.08, 1.7, 0.08, BEAM, [x, 0.85, 0]))}
        {box(1.8, 0.07, 0.07, BEAM, [0, 1.68, 0])}
        {hangers.map((c, i) => (
          <group key={i} position={[-0.65 + i * 0.32, 1.25, 0]}>
            <mesh><boxGeometry args={[0.26, 0.7, 0.05]} /><meshStandardMaterial color={c} /></mesh>
            <mesh position={[0, 0.3, 0]}><boxGeometry args={[0.34, 0.12, 0.06]} /><meshStandardMaterial color={c} /></mesh>
          </group>
        ))}
      </group>
      {/* chalkboard */}
      <group position={[3.0, 0, 3.6]} rotation-y={-0.2}>
        {box(0.08, 1.2, 0.08, BEAM, [-0.4, 0.6, -0.15], { rot: [0.2, 0, 0.15] })}
        {box(0.08, 1.2, 0.08, BEAM, [0.4, 0.6, -0.15], { rot: [0.2, 0, -0.15] })}
        <mesh position={[0, 0.78, 0]} rotation-x={-0.12}><planeGeometry args={[0.85, 1.12]} /><meshBasicMaterial map={board} toneMapped={false} /></mesh>
      </group>
      {/* umbrella + table + chairs */}
      <group position={[5.2, 0, 4.4]}>
        <mesh position={[0, 1.2, 0]}><cylinderGeometry args={[0.04, 0.04, 2.4, 6]} /><meshStandardMaterial color="#e8e0d0" /></mesh>
        <mesh position={[0, 2.45, 0]} castShadow><coneGeometry args={[1.6, 0.55, 14]} /><meshStandardMaterial color="#ffc2d6" /></mesh>
        <mesh position={[0, 0.72, 0]}><cylinderGeometry args={[0.6, 0.6, 0.06, 18]} /><meshStandardMaterial color="#c99a5b" /></mesh>
        <mesh position={[0, 0.36, 0]}><cylinderGeometry args={[0.07, 0.07, 0.72, 6]} /><meshStandardMaterial color={BEAM} /></mesh>
        {[[-0.95, 0], [0.95, 0]].map(([cx], i) => (
          <group key={i} position={[cx, 0, 0]}>{box(0.5, 0.06, 0.5, '#b98552', [0, 0.45, 0])}{box(0.5, 0.5, 0.06, '#b98552', [0, 0.72, i ? 0.22 : -0.22])}{box(0.06, 0.45, 0.06, BEAM, [0, 0.22, 0])}</group>
        ))}
      </group>
      {/* street lamp */}
      <group position={[-2.2, 0, 4.0]}>
        <mesh position={[0, 1.4, 0]}><cylinderGeometry args={[0.05, 0.07, 2.8, 6]} /><meshStandardMaterial color="#3d3228" /></mesh>
        <mesh position={[0, 2.95, 0]}><boxGeometry args={[0.34, 0.45, 0.34]} /><meshStandardMaterial color="#ffd98a" emissive="#ffb84a" emissiveIntensity={1.3} /></mesh>
        <mesh position={[0, 3.25, 0]}><coneGeometry args={[0.3, 0.25, 4]} /><meshStandardMaterial color="#3d3228" /></mesh>
      </group>
      {/* flower pots by the door */}
      {[[3.2, 2.7], [1.5, 2.7]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.24, 0.18, 0.4, 10]} /><meshStandardMaterial color="#d98c5f" /></mesh>
          {['#ff9ec4', '#fff', '#ffe066', '#c9a0ff'].map((c, j) => (<mesh key={j} position={[Math.cos(j * 1.6) * 0.12, 0.5 + (j % 2) * 0.06, Math.sin(j * 1.6) * 0.12]}><icosahedronGeometry args={[0.1, 0]} /><meshStandardMaterial color={c} flatShading /></mesh>))}
        </group>
      ))}
    </group>
  )
}

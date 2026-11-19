import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, MeshTransmissionMaterial, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useInView } from '../../hooks/useInView';

/**
 * Procedural 3D "NXT" logotype built from box geometry — no font files to
 * load, so it renders instantly and offline. Letters are assembled from
 * strokes, bevelled by scaling, and lit with a lime key + cyan rim.
 */

function LetterN() {
  return (
    <group>
      {/* left stem */}
      <mesh position={[-0.62, 0, 0]} castShadow>
        <boxGeometry args={[0.3, 2.2, 0.34]} />
        <meshStandardMaterial color="#ededed" roughness={0.28} metalness={0.15} />
      </mesh>
      {/* right stem */}
      <mesh position={[0.62, 0, 0]} castShadow>
        <boxGeometry args={[0.3, 2.2, 0.34]} />
        <meshStandardMaterial color="#ededed" roughness={0.28} metalness={0.15} />
      </mesh>
      {/* diagonal */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, 0.48]} castShadow>
        <boxGeometry args={[0.3, 1.72, 0.34]} />
        <meshStandardMaterial color="#ededed" roughness={0.28} metalness={0.15} />
      </mesh>
    </group>
  );
}

function LetterX() {
  return (
    <group>
      <mesh rotation={[0, 0, 0.52]} castShadow>
        <boxGeometry args={[0.3, 2.1, 0.34]} />
        <meshStandardMaterial color="#ededed" roughness={0.28} metalness={0.15} />
      </mesh>
      <mesh rotation={[0, 0, -0.52]} castShadow>
        <boxGeometry args={[0.3, 2.1, 0.34]} />
        <meshStandardMaterial color="#ededed" roughness={0.28} metalness={0.15} />
      </mesh>
    </group>
  );
}

function LetterT() {
  return (
    <group>
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[1.55, 0.3, 0.34]} />
        <meshStandardMaterial color="#ededed" roughness={0.28} metalness={0.15} />
      </mesh>
      <mesh position={[0, -0.1, 0]} castShadow>
        <boxGeometry args={[0.3, 2.2, 0.34]} />
        <meshStandardMaterial color="#ededed" roughness={0.28} metalness={0.15} />
      </mesh>
    </group>
  );
}

function Logotype({ reduced, coarse }: { reduced: boolean; coarse: boolean }) {
  const group = useRef<THREE.Group>(null);
  const width = useThree((s) => s.size.width);

  // The HTML headline is gone — the logotype owns the full hero. Narrow
  // containers just get a smaller scale so the letters stay in frame.
  const compact = width < 700;
  const baseScale = compact ? 0.5 : width < 980 ? 0.85 : 1;

  const current = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    if (!group.current) return;

    // Touch devices: no pointer parallax (scrolling would tilt the letters).
    const px = coarse ? 0 : state.pointer.x;
    const py = coarse ? 0 : state.pointer.y;

    if (reduced) {
      group.current.rotation.set(0, -0.18, 0);
      return;
    }

    // Ease toward pointer for a weighty, parallax feel.
    current.current.x += (py * 0.2 - current.current.x) * Math.min(1, delta * 3);
    current.current.y += (px * 0.32 - current.current.y) * Math.min(1, delta * 3);

    const t = state.clock.elapsedTime;
    group.current.rotation.x = current.current.x + Math.sin(t * 0.4) * 0.05;
    group.current.rotation.y = current.current.y - 0.15 + Math.cos(t * 0.32) * 0.08;
    group.current.position.x = Math.sin(t * 0.25) * 0.06;
    group.current.position.y = Math.sin(t * 0.6) * 0.1;
  });

  const spacing = compact ? 2.1 : width < 980 ? 2.25 : 2.35;

  return (
    <group ref={group} scale={baseScale}>
      <group position={[-spacing, 0, 0]}>
        <LetterN />
      </group>
      <group position={[0, 0, 0]}>
        <LetterX />
      </group>
      <group position={[spacing, 0, 0]}>
        <LetterT />
      </group>
    </group>
  );
}

/** Floating accent shards that catch the lime light. */
function Shards({ reduced }: { reduced: boolean }) {
  const width = useThree((s) => s.size.width);
  const compact = width < 700;

  const items = useMemo(() => {
    const count = compact ? 4 : 7;
    const spreadX = compact ? 4.5 : 11;
    const spreadY = compact ? 5 : 5.5;
    return Array.from({ length: count }, (_, i) => ({
      pos: [
        (Math.random() - 0.5) * spreadX,
        (Math.random() - 0.5) * spreadY,
        (Math.random() - 0.5) * 4 - 1,
      ] as [number, number, number],
      rot: [Math.random() * Math.PI, Math.random() * Math.PI, 0] as [number, number, number],
      scale: (0.16 + Math.random() * 0.34) * (compact ? 0.75 : 1),
      speed: 0.3 + Math.random() * 0.6,
      i,
    }));
  }, [compact]);

  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current || reduced) return;
    const t = state.clock.elapsedTime;
    group.current.children.forEach((child, i) => {
      child.rotation.x += 0.003 + i * 0.0004;
      child.rotation.y += 0.004;
      child.position.y += Math.sin(t * items[i].speed + i) * 0.0016;
    });
  });

  return (
    <group ref={group}>
      {items.map((it) => (
        <mesh key={it.i} position={it.pos} rotation={it.rot} scale={it.scale}>
          <octahedronGeometry args={[1, 0]} />
          {it.i % 3 === 0 && !compact ? (
            <MeshTransmissionMaterial
              samples={4}
              resolution={128}
              thickness={0.4}
              roughness={0.15}
              anisotropy={0.3}
              color="#d7ff3e"
              background={new THREE.Color('#08090a')}
            />
          ) : (
            <meshStandardMaterial
              color={it.i % 2 === 0 ? '#d7ff3e' : '#4de8ff'}
              emissive={it.i % 2 === 0 ? '#d7ff3e' : '#4de8ff'}
              emissiveIntensity={0.45}
              roughness={0.35}
              metalness={0.5}
            />
          )}
        </mesh>
      ))}
    </group>
  );
}

function Rig({ coarse }: { coarse: boolean }) {
  const { camera } = useThree();
  useFrame((state, delta) => {
    if (coarse) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Gentle parallax only — enough to feel alive without panning the
    // logotype out of its panel.
    camera.position.x += (state.pointer.x * 0.3 - camera.position.x) * Math.min(1, delta * 1.6);
    camera.position.y += (state.pointer.y * 0.18 - camera.position.y) * Math.min(1, delta * 1.6);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/**
 * Hero canvas — giant procedural NXT, floating shards, sparkles.
 * `dpr` is clamped and the frameloop pauses when off-screen for perf.
 */
export function TypeScene({ className = '' }: { className?: string }) {
  const reduced = useReducedMotion();
  const compact = useMediaQuery('(max-width: 699px)');
  const coarse = useMediaQuery('(pointer: coarse)');
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef);

  return (
    <div ref={rootRef} className={`absolute inset-0 ${className}`} aria-hidden="true">
      <Canvas
        dpr={compact ? [1, 1.5] : [1, 1.75]}
        camera={{ position: [0, 0, 9.5], fov: 42 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        frameloop={reduced || !inView ? 'demand' : 'always'}
      >
        <color attach="background" args={['#08090a']} />
        <fog attach="fog" args={['#08090a', 12, 26]} />

        <ambientLight intensity={0.35} />
        <directionalLight position={[6, 8, 6]} intensity={1.5} color="#ffffff" />
        <pointLight position={[-6, -3, 4]} intensity={40} color="#d7ff3e" distance={20} />
        <pointLight position={[7, 2, -3]} intensity={26} color="#4de8ff" distance={18} />
        <spotLight
          position={[0, 6, 5]}
          angle={0.5}
          penumbra={1}
          intensity={30}
          color="#ffffff"
        />

        <Float speed={reduced ? 0 : 1.1} rotationIntensity={0} floatIntensity={0.4}>
          <Logotype reduced={reduced} coarse={coarse} />
        </Float>

        <Shards reduced={reduced} />

        <Sparkles
          count={reduced ? 20 : compact ? 48 : 90}
          scale={[16, 8, 6]}
          size={2.2}
          speed={reduced ? 0 : 0.35}
          opacity={0.5}
          color="#d7ff3e"
        />

        <Rig coarse={coarse} />
      </Canvas>
    </div>
  );
}

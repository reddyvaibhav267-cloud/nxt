import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useInView } from '../../hooks/useInView';

/**
 * Particle sphere whose turbulence maps to a 0-100 trend score.
 * The sphere "breathes" harder as the score climbs — a live-data orb for
 * the dashboard hero.
 */

interface Props {
  score?: number;
  className?: string;
}

function ParticleSphere({
  score,
  reduced,
  count,
}: {
  score: number;
  reduced: boolean;
  count: number;
}) {
  const points = useRef<THREE.Points>(null);
  const material = useRef<THREE.PointsMaterial>(null);

  const { positions, seeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const phi = Math.PI * (3 - Math.sqrt(5)); // golden angle spiral

    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = phi * i;
      positions[i * 3] = Math.cos(theta) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(theta) * radius;
      seeds[i] = Math.random() * Math.PI * 2;
    }
    return { positions, seeds };
  }, [count]);

  const baseColor = useMemo(() => new THREE.Color('#d7ff3e'), []);
  const hotColor = useMemo(() => new THREE.Color('#ff4d2e'), []);

  useFrame((state) => {
    if (!points.current || !material.current) return;
    const t = reduced ? 0 : state.clock.elapsedTime;
    const intensity = THREE.MathUtils.clamp(score / 100, 0, 1);

    // Turbulence amplitude grows with score.
    const amp = 0.06 + intensity * 0.3;
    const posAttr = points.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const seed = seeds[i];
      const x = positions[ix];
      const y = positions[ix + 1];
      const z = positions[ix + 2];

      const wave =
        Math.sin(t * (0.6 + intensity * 1.4) + seed) * amp +
        Math.cos(t * 0.5 + y * 4 + seed) * amp * 0.5;

      const r = 1 + wave;
      arr[ix] = x * r;
      arr[ix + 1] = y * r;
      arr[ix + 2] = z * r;
    }
    posAttr.needsUpdate = true;

    points.current.rotation.y = t * 0.12;
    points.current.rotation.x = Math.sin(t * 0.2) * 0.14;

    material.current.size = 0.028 + intensity * 0.022;
    material.current.color.copy(baseColor).lerp(hotColor, intensity * 0.75);
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={material}
        size={0.03}
        color="#d7ff3e"
        transparent
        opacity={0.9}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/** Thin wireframe cage around the particle sphere. */
function Cage({ reduced }: { reduced: boolean }) {
  const ref = useRef<THREE.LineSegments>(null);
  useFrame((state) => {
    if (!ref.current || reduced) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = -t * 0.05;
    ref.current.rotation.z = t * 0.02;
  });

  return (
    <lineSegments ref={ref}>
      <edgesGeometry args={[new THREE.IcosahedronGeometry(1.42, 1)]} />
      <lineBasicMaterial color="#2c3238" transparent opacity={0.55} />
    </lineSegments>
  );
}

export function TrendOrb({ score = 72, className = '' }: Props) {
  const reduced = useReducedMotion();
  const compact = useMediaQuery('(max-width: 699px)');
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef);
  const count = compact ? 1400 : 2400;

  return (
    <div ref={rootRef} className={className} aria-hidden="true">
      <Canvas
        dpr={compact ? [1, 1.5] : [1, 1.6]}
        camera={{ position: [0, 0, 3.4], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        frameloop={reduced || !inView ? 'demand' : 'always'}
      >
        <ambientLight intensity={0.4} />
        <ParticleSphere score={score} reduced={reduced} count={count} />
        <Cage reduced={reduced} />
      </Canvas>
    </div>
  );
}

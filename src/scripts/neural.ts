import * as THREE from 'three';
import { nodesVertex, nodesFragment, edgesVertex, edgesFragment } from './shaders/neural';

// Puntos distribuidos de forma uniforme sobre una esfera (espiral de Fibonacci).
function fibonacciSphere(count: number, radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const jitter = 1 + (Math.random() - 0.5) * 0.12;
    points.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r).multiplyScalar(radius * jitter));
  }
  return points;
}

function nearest(from: THREE.Vector3, pool: THREE.Vector3[], k: number): number[] {
  return pool
    .map((p, i) => ({ i, d: p === from ? Infinity : p.distanceToSquared(from) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, k)
    .map((e) => e.i);
}

export function createNeuralCore(options: { isSmall: boolean; pixelRatio: number }) {
  const group = new THREE.Group();

  // Dos capas de neuronas: externa e interna.
  const outer = fibonacciSphere(options.isSmall ? 70 : 110, 2.0);
  const inner = fibonacciSphere(options.isSmall ? 24 : 36, 1.15);
  const nodes = [...outer, ...inner];

  // Conexiones: vecinos cercanos dentro de cada capa y enlaces entre capas.
  const edges = new Set<string>();
  const link = (a: number, b: number) => edges.add(a < b ? `${a}-${b}` : `${b}-${a}`);
  outer.forEach((p, i) => nearest(p, outer, 3).forEach((j) => link(i, j)));
  inner.forEach((p, i) => {
    nearest(p, inner, 2).forEach((j) => link(outer.length + i, outer.length + j));
    nearest(p, outer, 3).forEach((j) => link(outer.length + i, j));
  });

  // ---- Nodos ----
  const nodeGeometry = new THREE.BufferGeometry().setFromPoints(nodes);
  nodeGeometry.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(nodes.length).map(Math.random), 1));
  const nodeUniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: options.pixelRatio },
    uSize: { value: options.isSmall ? 140 : 180 },
    uColorIdle: { value: new THREE.Color('#6d5bd0') },
    uColorActive: { value: new THREE.Color('#67e8f9') },
  };
  group.add(
    new THREE.Points(
      nodeGeometry,
      new THREE.ShaderMaterial({
        vertexShader: nodesVertex,
        fragmentShader: nodesFragment,
        uniforms: nodeUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );

  // ---- Conexiones con pulsos ----
  // Cada arista se subdivide para que el pulso se interpole suavemente a lo largo de ella.
  const SEGMENTS = 12;
  const positions: number[] = [];
  const ts: number[] = [];
  const seeds: number[] = [];
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  edges.forEach((key) => {
    const [a, b] = key.split('-').map(Number);
    // Dirección aleatoria para que las señales no viajen todas hacia el mismo lado.
    const [from, to] = Math.random() < 0.5 ? [nodes[a], nodes[b]] : [nodes[b], nodes[a]];
    const seed = Math.random();
    for (let s = 0; s < SEGMENTS; s++) {
      const t0 = s / SEGMENTS;
      const t1 = (s + 1) / SEGMENTS;
      tmpA.lerpVectors(from, to, t0);
      tmpB.lerpVectors(from, to, t1);
      positions.push(tmpA.x, tmpA.y, tmpA.z, tmpB.x, tmpB.y, tmpB.z);
      ts.push(t0, t1);
      seeds.push(seed, seed);
    }
  });
  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  edgeGeometry.setAttribute('aT', new THREE.Float32BufferAttribute(ts, 1));
  edgeGeometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  const edgeUniforms = {
    uTime: { value: 0 },
    uColorLine: { value: new THREE.Color('#7c6cf0') },
    uColorPulse: { value: new THREE.Color('#22d3ee') },
  };
  group.add(
    new THREE.LineSegments(
      edgeGeometry,
      new THREE.ShaderMaterial({
        vertexShader: edgesVertex,
        fragmentShader: edgesFragment,
        uniforms: edgeUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );

  return {
    group,
    update(time: number) {
      nodeUniforms.uTime.value = time;
      edgeUniforms.uTime.value = time;
    },
    setPixelRatio(ratio: number) {
      nodeUniforms.uPixelRatio.value = ratio;
    },
  };
}

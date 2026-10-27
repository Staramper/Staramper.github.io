import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { particlesVertex, particlesFragment } from './shaders/particles';
import { blobVertex, blobFragment } from './shaders/blob';
import { createNeuralCore } from './neural';

const PALETTE = {
  cyan: new THREE.Color('#22d3ee'),
  violet: new THREE.Color('#a855f7'),
  pink: new THREE.Color('#f472b6'),
  deep: new THREE.Color('#1e1b4b'),
};

const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

// ---------- Generadores de formas para el morph de partículas ----------

// 1. Nube de datos
function sphereShape(count: number, radius: number): Float32Array {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1;
    const phi = Math.random() * Math.PI * 2;
    const r = radius * (0.92 + Math.random() * 0.16);
    const s = Math.sqrt(1 - u * u);
    out.set([Math.cos(phi) * s * r, u * r, Math.sin(phi) * s * r], i * 3);
  }
  return out;
}

// 2. Red neuronal por capas (perceptrón multicapa)
function networkShape(count: number): Float32Array {
  const out = new Float32Array(count * 3);
  const layers = [5, 8, 8, 6, 3];
  const spacing = 1.7;
  const neurons = layers.map((n, l) =>
    Array.from({ length: n }, (_, k) => new THREE.Vector3((l - (layers.length - 1) / 2) * spacing, (k - (n - 1) / 2) * 0.62, 0)),
  );
  const tmp = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const l = Math.floor(Math.random() * layers.length);
    const a = neurons[l][Math.floor(Math.random() * neurons[l].length)];
    if (Math.random() < 0.45 || l === layers.length - 1) {
      // Partícula agrupada alrededor de una neurona.
      tmp.set(gauss(), gauss(), gauss()).multiplyScalar(0.11).add(a);
    } else {
      // Partícula sobre la conexión con una neurona de la capa siguiente.
      const b = neurons[l + 1][Math.floor(Math.random() * neurons[l + 1].length)];
      tmp.lerpVectors(a, b, Math.random()).add(new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(0.015));
    }
    out.set([tmp.x, tmp.y, tmp.z], i * 3);
  }
  return out;
}

// 3. Loop de automatización (lemniscata / símbolo de infinito)
function flowShape(count: number, scale: number): Float32Array {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const t = Math.random() * Math.PI * 2;
    const d = 1 + Math.sin(t) ** 2;
    const x = (Math.cos(t) / d) * scale;
    const y = ((Math.sin(t) * Math.cos(t)) / d) * scale;
    const z = Math.sin(t * 2) * 0.35 * scale * 0.3;
    const spread = 0.12 + Math.random() * 0.08;
    out.set([x + gauss() * spread, y + gauss() * spread, z + gauss() * spread], i * 3);
  }
  return out;
}

// 4. Chip con pistas de circuito
function chipShape(count: number): Float32Array {
  const out = new Float32Array(count * 3);
  const half = 0.9;
  const traces: THREE.Vector2[][] = [];
  for (let side = 0; side < 4; side++) {
    for (let k = 0; k < 7; k++) {
      const along = (k / 6 - 0.5) * half * 1.7;
      const out1 = 0.5 + Math.random() * 1.2;
      const jog = (Math.random() - 0.5) * 1.6;
      const out2 = out1 + 0.4 + Math.random() * 1.0;
      // Trazo en forma de "L" desde el borde del chip hacia fuera.
      const path = [new THREE.Vector2(along, half), new THREE.Vector2(along, half + out1), new THREE.Vector2(along + jog, half + out2)];
      const rot = (side * Math.PI) / 2;
      traces.push(path.map((p) => p.clone().rotateAround(new THREE.Vector2(), rot)));
    }
  }
  const tilt = -0.55;
  const p = new THREE.Vector2();
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    if (r < 0.3) {
      // Cuerpo del chip con un patrón de rejilla.
      const gx = Math.round((Math.random() * 2 - 1) * 6) / 6;
      const gy = (Math.random() * 2 - 1);
      p.set(gx, gy).multiplyScalar(half * 0.92);
      if (Math.random() < 0.5) p.set(p.y, p.x);
    } else {
      const path = traces[Math.floor(Math.random() * traces.length)];
      if (r > 0.93) {
        // Pad al final de la pista.
        p.copy(path[2]).add(new THREE.Vector2(gauss(), gauss()).multiplyScalar(0.05));
      } else {
        const seg = Math.random() < 0.5 ? 0 : 1;
        p.lerpVectors(path[seg], path[seg + 1], Math.random());
      }
    }
    const z = gauss() * 0.02;
    out.set([p.x, p.y * Math.cos(tilt) - z * Math.sin(tilt), p.y * Math.sin(tilt) + z * Math.cos(tilt)], i * 3);
  }
  return out;
}

// ---------- Escena ----------

export function initScene(canvas: HTMLCanvasElement) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isSmall = window.innerWidth < 768;
  const COUNT = isSmall ? 9000 : 18000;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  // En pantallas verticales la cámara se aleja para que la escena no tape el texto.
  const baseZ = () => (camera.aspect < 1 ? 14 : 9);
  camera.position.set(0, 0, baseZ());

  const root = new THREE.Group();
  scene.add(root);

  // Partículas
  const geometry = new THREE.BufferGeometry();
  const sphere = sphereShape(COUNT, 3.5);
  geometry.setAttribute('position', new THREE.BufferAttribute(sphere, 3));
  geometry.setAttribute('aSphere', new THREE.BufferAttribute(sphere, 3));
  geometry.setAttribute('aNetwork', new THREE.BufferAttribute(networkShape(COUNT), 3));
  geometry.setAttribute('aFlow', new THREE.BufferAttribute(flowShape(COUNT, 3.6), 3));
  geometry.setAttribute('aChip', new THREE.BufferAttribute(chipShape(COUNT), 3));
  const randoms = new Float32Array(COUNT).map(() => Math.random());
  geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

  const particleUniforms = {
    uTime: { value: 0 },
    uMorph: { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uSize: { value: isSmall ? 34 : 46 },
    uMouse: { value: new THREE.Vector3(999, 999, 999) },
    uColorA: { value: PALETTE.cyan },
    uColorB: { value: PALETTE.violet },
    uColorC: { value: PALETTE.pink },
    uFogFar: { value: baseZ() + 5 },
  };
  const particles = new THREE.Points(
    geometry,
    new THREE.ShaderMaterial({
      vertexShader: particlesVertex,
      fragmentShader: particlesFragment,
      uniforms: particleUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  root.add(particles);

  // Núcleo: red neuronal con un "cerebro" de energía en el centro.
  const core = new THREE.Group();
  root.add(core);

  const neural = createNeuralCore({ isSmall, pixelRatio: renderer.getPixelRatio() });
  core.add(neural.group);

  const blobUniforms = {
    uTime: { value: 0 },
    uIntensity: { value: 0.35 },
    uColorA: { value: PALETTE.deep },
    uColorB: { value: PALETTE.violet },
  };
  const blob = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, isSmall ? 48 : 96),
    new THREE.ShaderMaterial({
      vertexShader: blobVertex,
      fragmentShader: blobFragment,
      uniforms: blobUniforms,
      transparent: true,
    }),
  );
  blob.scale.setScalar(0.62);
  core.add(blob);

  // Anillos orbitales
  const rings = new THREE.Group();
  [3.4, 3.9, 4.6].forEach((r, i) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.006, 8, 256),
      new THREE.MeshBasicMaterial({ color: i === 1 ? PALETTE.pink : PALETTE.cyan, transparent: true, opacity: 0.3 }),
    );
    ring.rotation.set(Math.PI / 2 + (i - 1) * 0.35, i * 0.6, 0);
    rings.add(ring);
  });
  root.add(rings);

  // Post-procesado
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.75, 0.6, 0.2);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------- Interacción ----------

  const pointer = new THREE.Vector2(0, 0);
  const pointerSmooth = new THREE.Vector2(0, 0);
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const mouseWorld = new THREE.Vector3();
  let pointerActive = false;

  window.addEventListener('pointermove', (e) => {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    pointerActive = true;
  });
  document.addEventListener('pointerleave', () => (pointerActive = false));

  let scrollTarget = 0;
  let scrollSmooth = 0;
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollTarget = max > 0 ? window.scrollY / max : 0;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    particleUniforms.uPixelRatio.value = renderer.getPixelRatio();
    particleUniforms.uFogFar.value = baseZ() + 5;
    neural.setPixelRatio(renderer.getPixelRatio());
    onScroll();
  };
  window.addEventListener('resize', onResize);

  // ---------- Bucle ----------

  const clock = new THREE.Clock();
  let running = true;
  const timeScale = reducedMotion ? 0.25 : 1;
  // Sólo en desarrollo: ?morph=0..3 simula la posición del scroll para ajustar las formas sin hacer scroll.
  const morphParam = import.meta.env.DEV ? new URLSearchParams(location.search).get('morph') : null;
  const debugMorph = morphParam !== null ? Number(morphParam) : null;
  let elapsed = 0;

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) {
      clock.getDelta();
      renderer.setAnimationLoop(tick);
    } else {
      renderer.setAnimationLoop(null);
    }
  });

  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05) * timeScale;
    elapsed += dt;

    scrollSmooth += (scrollTarget - scrollSmooth) * 0.06;
    if (debugMorph !== null) scrollSmooth = debugMorph / 3;
    pointerSmooth.lerp(pointer, 0.05);

    // Morph: nube de datos → red neuronal → loop de automatización → chip.
    particleUniforms.uMorph.value = scrollSmooth * 3;
    particleUniforms.uTime.value = elapsed;
    blobUniforms.uTime.value = elapsed;
    blobUniforms.uIntensity.value = 0.3 + Math.sin(elapsed * 0.5) * 0.08 + scrollSmooth * 0.25;
    neural.update(elapsed);

    // El núcleo se encoge al hacer scroll para dejar protagonismo a las partículas.
    const coreScale = THREE.MathUtils.lerp(1, 0.35, Math.min(scrollSmooth * 3, 1));
    core.scale.setScalar(coreScale);
    core.rotation.y = elapsed * 0.12;
    core.rotation.z = Math.sin(elapsed * 0.1) * 0.15;

    // Las formas con lectura frontal (red, chip) se ven mejor sin tanto giro.
    const spin = elapsed * 0.06 * (1 - Math.min(scrollSmooth * 4, 0.8));
    root.rotation.y = spin + pointerSmooth.x * 0.35 + Math.sin(scrollSmooth * Math.PI * 3) * 0.25;
    root.rotation.x = -pointerSmooth.y * 0.2 + Math.sin(elapsed * 0.2) * 0.05;
    // En escritorio la escena arranca a la derecha (texto del hero a la izquierda) y oscila con el scroll.
    root.position.x = isSmall ? 0 : Math.cos(scrollSmooth * Math.PI * 2) * 2.6;

    rings.rotation.z = elapsed * 0.1;
    rings.rotation.x = Math.sin(elapsed * 0.15) * 0.2;
    rings.children.forEach((ring, i) => (ring.rotation.y += dt * (0.1 + i * 0.05)));

    camera.position.z = baseZ() - Math.sin(scrollSmooth * Math.PI) * 1.5;

    if (pointerActive) {
      raycaster.setFromCamera(pointer, camera);
      raycaster.ray.intersectPlane(plane, mouseWorld);
      particleUniforms.uMouse.value.copy(mouseWorld);
    } else {
      particleUniforms.uMouse.value.set(999, 999, 999);
    }

    composer.render();
  }

  renderer.setAnimationLoop(tick);
}

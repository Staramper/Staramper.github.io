import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { particlesVertex, particlesFragment } from './shaders/particles';
import { blobVertex, blobFragment } from './shaders/blob';

const PALETTE = {
  cyan: new THREE.Color('#22d3ee'),
  violet: new THREE.Color('#a855f7'),
  pink: new THREE.Color('#f472b6'),
  deep: new THREE.Color('#1e1b4b'),
};

// ---------- Generadores de formas para el morph de partículas ----------

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

function torusKnotShape(count: number, scale: number, p = 2, q = 3): Float32Array {
  const out = new Float32Array(count * 3);
  const point = (t: number) => {
    const r = 2 + Math.cos(q * t);
    return new THREE.Vector3(r * Math.cos(p * t), r * Math.sin(p * t), Math.sin(q * t)).multiplyScalar(scale);
  };
  for (let i = 0; i < count; i++) {
    const t = Math.random() * Math.PI * 2;
    const c = point(t);
    const tangent = point(t + 0.001).sub(c).normalize();
    const normal = new THREE.Vector3(0, 0, 1).cross(tangent).normalize();
    const binormal = tangent.clone().cross(normal);
    const a = Math.random() * Math.PI * 2;
    const tube = 0.35 * scale * Math.sqrt(Math.random());
    c.addScaledVector(normal, Math.cos(a) * tube).addScaledVector(binormal, Math.sin(a) * tube);
    out.set([c.x, c.y, c.z], i * 3);
  }
  return out;
}

function galaxyShape(count: number, radius: number, arms = 4): Float32Array {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = Math.pow(Math.random(), 1.6) * radius;
    const arm = ((i % arms) / arms) * Math.PI * 2;
    const spin = r * 1.1;
    const spread = (1 - r / radius) * 0.15 + 0.12;
    const rnd = () => Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * r * spread * 3;
    const x = Math.cos(arm + spin) * r + rnd();
    const y = rnd() * 0.5;
    const z = Math.sin(arm + spin) * r + rnd();
    // Inclinada hacia la cámara.
    const tilt = 0.9;
    out.set([x, y * Math.cos(tilt) - z * Math.sin(tilt), y * Math.sin(tilt) + z * Math.cos(tilt)], i * 3);
  }
  return out;
}

function cubeShape(count: number, size: number): Float32Array {
  const out = new Float32Array(count * 3);
  const h = size / 2;
  for (let i = 0; i < count; i++) {
    const face = Math.floor(Math.random() * 6);
    const a = (Math.random() * 2 - 1) * h;
    const b = (Math.random() * 2 - 1) * h;
    const s = face % 2 === 0 ? h : -h;
    const v = face < 2 ? [s, a, b] : face < 4 ? [a, s, b] : [a, b, s];
    out.set(v, i * 3);
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
  const sphere = sphereShape(COUNT, 2.6);
  geometry.setAttribute('position', new THREE.BufferAttribute(sphere, 3));
  geometry.setAttribute('aSphere', new THREE.BufferAttribute(sphere, 3));
  geometry.setAttribute('aKnot', new THREE.BufferAttribute(torusKnotShape(COUNT, 0.85), 3));
  geometry.setAttribute('aGalaxy', new THREE.BufferAttribute(galaxyShape(COUNT, 5), 3));
  geometry.setAttribute('aCube', new THREE.BufferAttribute(cubeShape(COUNT, 3.6), 3));
  const randoms = new Float32Array(COUNT).map(() => Math.random());
  geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

  const particleUniforms = {
    uTime: { value: 0 },
    uMorph: { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uSize: { value: isSmall ? 40 : 55 },
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

  // Blob central
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
  blob.scale.setScalar(1.25);
  root.add(blob);

  // Anillos orbitales
  const rings = new THREE.Group();
  [3.4, 3.9, 4.6].forEach((r, i) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.006, 8, 256),
      new THREE.MeshBasicMaterial({ color: i === 1 ? PALETTE.pink : PALETTE.cyan, transparent: true, opacity: 0.35 }),
    );
    ring.rotation.set(Math.PI / 2 + (i - 1) * 0.35, i * 0.6, 0);
    rings.add(ring);
  });
  root.add(rings);

  // Post-procesado
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.7, 0.6, 0.2);
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
    onScroll();
  };
  window.addEventListener('resize', onResize);

  // ---------- Bucle ----------

  const clock = new THREE.Clock();
  let running = true;
  const timeScale = reducedMotion ? 0.25 : 1;
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
    pointerSmooth.lerp(pointer, 0.05);

    // Morph: esfera → nudo → galaxia → cubo a lo largo de la página.
    particleUniforms.uMorph.value = scrollSmooth * 3;
    particleUniforms.uTime.value = elapsed;
    blobUniforms.uTime.value = elapsed;
    blobUniforms.uIntensity.value = 0.3 + Math.sin(elapsed * 0.5) * 0.08 + scrollSmooth * 0.25;

    // El blob se encoge y se desplaza al hacer scroll para dejar espacio al contenido.
    const blobScale = THREE.MathUtils.lerp(1.25, 0.55, Math.min(scrollSmooth * 3, 1));
    blob.scale.setScalar(blobScale);

    root.rotation.y = elapsed * 0.06 + pointerSmooth.x * 0.35 + scrollSmooth * Math.PI;
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

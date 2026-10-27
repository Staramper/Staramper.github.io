import { simplexNoise } from './noise.glsl';

// Las partículas interpolan entre 4 formas según uMorph (0 → 3),
// que se controla con el scroll de la página.
export const particlesVertex = /* glsl */ `
uniform float uTime;
uniform float uMorph;
uniform float uPixelRatio;
uniform float uSize;
uniform vec3 uMouse;

attribute vec3 aSphere;
attribute vec3 aKnot;
attribute vec3 aGalaxy;
attribute vec3 aCube;
attribute float aRandom;

varying float vRandom;
varying float vDepth;

${simplexNoise}

vec3 shapeAt(float m) {
  if (m < 1.0) return mix(aSphere, aKnot, smoothstep(0.0, 1.0, m));
  if (m < 2.0) return mix(aKnot, aGalaxy, smoothstep(0.0, 1.0, m - 1.0));
  return mix(aGalaxy, aCube, smoothstep(0.0, 1.0, m - 2.0));
}

void main() {
  // Cada partícula llega con un pequeño retraso para que el morph se vea orgánico.
  float m = clamp(uMorph - aRandom * 0.25 + 0.125, 0.0, 3.0);
  vec3 pos = shapeAt(m);

  // Turbulencia con ruido simplex.
  float t = uTime * 0.25;
  vec3 n = vec3(
    snoise(pos * 0.6 + vec3(t, 0.0, 0.0)),
    snoise(pos * 0.6 + vec3(0.0, t, 10.0)),
    snoise(pos * 0.6 + vec3(20.0, 0.0, t))
  );
  pos += n * 0.18;

  // Repulsión del cursor (en espacio de mundo).
  vec4 world = modelMatrix * vec4(pos, 1.0);
  vec3 toMouse = world.xyz - uMouse;
  float dist = length(toMouse);
  float push = smoothstep(1.6, 0.0, dist);
  world.xyz += normalize(toMouse + 0.0001) * push * 0.9;

  vec4 mv = viewMatrix * world;
  gl_Position = projectionMatrix * mv;

  float size = uSize * (0.4 + aRandom * 0.9);
  gl_PointSize = size * uPixelRatio * (1.0 / -mv.z);

  vRandom = aRandom;
  vDepth = -mv.z;
}
`;

export const particlesFragment = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform float uFogFar;

varying float vRandom;
varying float vDepth;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float alpha = smoothstep(0.5, 0.0, d);
  alpha *= alpha;

  vec3 color = mix(uColorA, uColorB, vRandom);
  color = mix(color, uColorC, smoothstep(0.85, 1.0, vRandom));

  // Atenuación con la profundidad para dar sensación de niebla.
  float fog = smoothstep(uFogFar, uFogFar - 10.0, vDepth);
  gl_FragColor = vec4(color, alpha * fog * 0.7);
}
`;

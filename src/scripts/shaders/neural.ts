// Red neuronal: nodos que "se activan" en ondas y conexiones con pulsos de señal.

export const nodesVertex = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
uniform float uSize;

attribute float aSeed;

varying float vActivation;

void main() {
  // Onda de activación que barre la red de abajo hacia arriba.
  float wave = sin(uTime * 1.6 - position.y * 2.2 + aSeed * 3.0);
  vActivation = smoothstep(0.55, 1.0, wave);

  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.7 + aSeed * 0.5 + vActivation * 0.9) * uPixelRatio / -mv.z;
}
`;

export const nodesFragment = /* glsl */ `
uniform vec3 uColorIdle;
uniform vec3 uColorActive;

varying float vActivation;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float core = smoothstep(0.18, 0.0, d);
  float halo = smoothstep(0.5, 0.0, d) * 0.35;
  vec3 color = mix(uColorIdle, uColorActive, vActivation);
  gl_FragColor = vec4(color * (core * 1.6 + halo), core + halo);
}
`;

export const edgesVertex = /* glsl */ `
attribute float aT;
attribute float aSeed;

varying float vT;
varying float vSeed;

void main() {
  vT = aT;
  vSeed = aSeed;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const edgesFragment = /* glsl */ `
uniform float uTime;
uniform vec3 uColorLine;
uniform vec3 uColorPulse;

varying float vT;
varying float vSeed;

void main() {
  // Sólo una parte de las conexiones transmite señal en cada momento.
  float cycle = uTime * (0.35 + vSeed * 0.5) + vSeed * 10.0;
  float firing = step(0.45, fract(sin(floor(cycle) * 91.7 + vSeed * 47.3) * 43758.5));
  float head = fract(cycle);
  float pulse = exp(-pow((vT - head) * 9.0, 2.0)) * firing;

  vec3 color = uColorLine * 0.5 + uColorPulse * pulse * 2.2;
  gl_FragColor = vec4(color, 0.28 + pulse * 0.9);
}
`;

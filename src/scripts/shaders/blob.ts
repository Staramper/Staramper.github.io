import { simplexNoise } from './noise.glsl';

// Esfera deformada con ruido y brillo fresnel iridiscente.
export const blobVertex = /* glsl */ `
uniform float uTime;
uniform float uIntensity;

varying vec3 vNormal;
varying vec3 vViewDir;
varying float vNoise;

${simplexNoise}

float displacement(vec3 p) {
  float t = uTime * 0.35;
  float n = snoise(p * 1.4 + t) * 0.6;
  n += snoise(p * 3.0 - t * 1.3) * 0.2;
  return n * uIntensity;
}

void main() {
  vec3 p = position + normal * displacement(position);

  // Normal recalculada con diferencias finitas sobre la superficie deformada.
  float eps = 0.01;
  vec3 tangent = normalize(cross(normal, vec3(0.0, 1.0, 0.0)) + vec3(0.0001));
  vec3 bitangent = normalize(cross(normal, tangent));
  vec3 pt = position + tangent * eps;
  vec3 pb = position + bitangent * eps;
  pt += normalize(pt) * displacement(pt);
  pb += normalize(pb) * displacement(pb);
  vec3 n = normalize(cross(pt - p, pb - p));

  vec4 world = modelMatrix * vec4(p, 1.0);
  vNormal = normalize(mat3(modelMatrix) * n);
  vViewDir = normalize(cameraPosition - world.xyz);
  vNoise = displacement(position);

  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const blobFragment = /* glsl */ `
uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;

varying vec3 vNormal;
varying vec3 vViewDir;
varying float vNoise;

void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  float fresnel = pow(1.0 - max(dot(n, vViewDir), 0.0), 2.5);

  // Paleta iridiscente tipo coseno (Iñigo Quílez).
  vec3 iri = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + vNoise * 0.8 + fresnel * 0.6 + uTime * 0.05));

  vec3 base = mix(uColorA, uColorB, smoothstep(-0.4, 0.4, vNoise));
  vec3 color = base * 0.25 + iri * fresnel * 1.3;
  color += vec3(1.0) * pow(fresnel, 6.0) * 0.6;

  gl_FragColor = vec4(color, 0.55 + fresnel * 0.45);
}
`;

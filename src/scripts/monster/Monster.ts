import * as THREE from 'three';
import { simplexNoise } from '../shaders/noise.glsl';
import { EXPRESSIONS, lerpExpression, type Expression, type Mood } from './expressions';

const bodyVertex = /* glsl */ `
uniform float uTime;
uniform float uWobble;
uniform float uJiggle;

varying vec3 vNormal;
varying vec3 vPos;
varying vec3 vView;

${simplexNoise}

void main() {
  vec3 p = position;
  float n = snoise(p * 1.8 + vec3(0.0, uTime * 0.5, 0.0));
  // Ondas de gelatina cuando recibe un golpe o un toque.
  float j = sin(p.y * 7.0 - uTime * 22.0) * uJiggle;
  p += normal * (n * 0.035 * uWobble + j * 0.06);

  vec4 world = modelMatrix * vec4(p, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vPos = position;
  vView = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const bodyFragment = /* glsl */ `
uniform vec3 uColorTop;
uniform vec3 uColorBottom;
uniform vec3 uTint;
uniform float uTintAmount;
uniform vec3 uLightDir;

varying vec3 vNormal;
varying vec3 vPos;
varying vec3 vView;

${simplexNoise}

void main() {
  vec3 n = normalize(vNormal);
  vec3 base = mix(uColorBottom, uColorTop, smoothstep(-0.9, 0.9, vPos.y));

  // Manchitas de monstruo
  float spots = smoothstep(0.42, 0.5, snoise(vPos * 2.4 + 3.0));
  base = mix(base, base * 0.7, spots * 0.55);

  // Pancita más clara
  float belly = smoothstep(0.55, 0.95, vPos.z) * smoothstep(0.35, -0.5, vPos.y);
  base = mix(base, vec3(0.98, 0.86, 0.96), belly * 0.45);

  base = mix(base, uTint, uTintAmount);

  vec3 l = normalize(uLightDir);
  float diff = max(dot(n, l), 0.0) * 0.55 + 0.45;
  float rim = pow(1.0 - max(dot(n, vView), 0.0), 3.0);
  float spec = pow(max(dot(reflect(-l, n), vView), 0.0), 28.0);

  vec3 color = base * diff + rim * vec3(0.8, 0.65, 1.0) * 0.55 + spec * 0.3;
  gl_FragColor = vec4(color, 1.0);
}
`;

const COLORS = {
  top: new THREE.Color('#b794ff'),
  bottom: new THREE.Color('#6d28d9'),
  angry: new THREE.Color('#e11d48'),
  horn: new THREE.Color('#fde68a'),
  mouth: new THREE.Color('#2a0a1e'),
  tongue: new THREE.Color('#fb7185'),
};

// Coloca un objeto sobre la superficie de la esfera, orientado hacia fuera.
function onSurface(obj: THREE.Object3D, dir: THREE.Vector3, radius: number, axis = new THREE.Vector3(0, 0, 1)) {
  const d = dir.clone().normalize();
  obj.position.copy(d).multiplyScalar(radius);
  obj.quaternion.setFromUnitVectors(axis, d);
}

interface Eye {
  side: number;
  center: THREE.Vector3;
  pivot: THREE.Group;
  pupil: THREE.Mesh;
  lidTopHolder: THREE.Group;
  lidTop: THREE.Mesh;
  lidBottom: THREE.Mesh;
}

export class Monster {
  /** Punto de apoyo (los pies). Lo mueve la física. */
  readonly root = new THREE.Group();
  /** Pivote en la base para el squash & stretch. */
  private readonly squashPivot = new THREE.Group();
  /** Cabeza/cuerpo: gira para mirar y para darte la espalda. */
  readonly head = new THREE.Group();

  readonly bodyMesh: THREE.Mesh;
  private readonly bodyUniforms;
  private readonly lidMaterial: THREE.MeshStandardMaterial;
  private readonly eyes: Eye[] = [];
  private readonly mouth = new THREE.Group();
  private mouthShape: THREE.Mesh;
  private readonly tongue: THREE.Mesh;
  private readonly fangs: THREE.Mesh[] = [];
  private readonly cheeks: THREE.Mesh[] = [];
  private readonly arms: { pivot: THREE.Group; side: number }[] = [];
  private antennaTube: THREE.Mesh;
  private readonly antennaBall: THREE.Mesh;
  private readonly antennaMaterial = new THREE.MeshStandardMaterial({ color: '#7c3aed', roughness: 0.6 });

  readonly expr: Expression = { ...EXPRESSIONS.neutral };
  target: Expression = EXPRESSIONS.neutral;

  /** Punto del mundo al que miran los ojos. */
  readonly lookTarget = new THREE.Vector3(0, 1, 5);
  dizzy = 0;
  chewing = 0;
  turnAway = 0;
  danceAmount = 0;

  private squash = 1;
  private squashVel = 0;
  private jiggle = 0;
  private blink = 0;
  private nextBlink = 2;
  private antennaOffset = new THREE.Vector3();
  private antennaVel = new THREE.Vector3();
  private lastMouthKey = '';
  private readonly ballColor = new THREE.Color('#a5f3fc');
  private readonly ballTarget = new THREE.Color('#a5f3fc');

  constructor() {
    this.root.add(this.squashPivot);
    this.squashPivot.add(this.head);
    this.head.position.y = 1;

    // ---- Cuerpo ----
    this.bodyUniforms = {
      uTime: { value: 0 },
      uWobble: { value: 1 },
      uJiggle: { value: 0 },
      uColorTop: { value: COLORS.top.clone() },
      uColorBottom: { value: COLORS.bottom.clone() },
      uTint: { value: COLORS.angry },
      uTintAmount: { value: 0 },
      uLightDir: { value: new THREE.Vector3(0.5, 1, 0.8) },
    };
    this.bodyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 128, 96),
      new THREE.ShaderMaterial({ vertexShader: bodyVertex, fragmentShader: bodyFragment, uniforms: this.bodyUniforms }),
    );
    this.head.add(this.bodyMesh);

    // ---- Ojos ----
    this.lidMaterial = new THREE.MeshStandardMaterial({ color: '#9b6dff', roughness: 0.55, side: THREE.DoubleSide });
    const white = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.25 });
    const iris = new THREE.MeshStandardMaterial({ color: '#22d3ee', roughness: 0.3 });
    const black = new THREE.MeshBasicMaterial({ color: '#0b0712' });
    const shine = new THREE.MeshBasicMaterial({ color: '#ffffff' });

    for (const side of [-1, 1]) {
      const center = new THREE.Vector3(side * 0.36, 0.3, 0.86).normalize().multiplyScalar(0.93);
      const eye = new THREE.Group();
      eye.position.copy(center);
      this.head.add(eye);

      eye.add(new THREE.Mesh(new THREE.SphereGeometry(0.27, 32, 24), white));

      const pivot = new THREE.Group();
      eye.add(pivot);
      const irisMesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 32, 16), iris);
      irisMesh.scale.z = 0.35;
      irisMesh.position.z = 0.215;
      pivot.add(irisMesh);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.08, 24, 12), black);
      pupil.scale.z = 0.3;
      pupil.position.z = 0.262;
      pivot.add(pupil);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 8), shine);
      glint.position.set(0.05, 0.05, 0.272);
      pivot.add(glint);

      // Párpados: hemisferios que giran para cerrarse.
      const lidTopHolder = new THREE.Group();
      eye.add(lidTopHolder);
      const lidTop = new THREE.Mesh(new THREE.SphereGeometry(0.285, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), this.lidMaterial);
      lidTopHolder.add(lidTop);
      const lidBottom = new THREE.Mesh(
        new THREE.SphereGeometry(0.283, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
        this.lidMaterial,
      );
      eye.add(lidBottom);

      this.eyes.push({ side, center, pivot, pupil, lidTopHolder, lidTop, lidBottom });
    }

    // ---- Boca ----
    onSurface(this.mouth, new THREE.Vector3(0, -0.22, 1), 1.03);
    this.head.add(this.mouth);
    this.mouthShape = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: COLORS.mouth }));
    this.mouth.add(this.mouthShape);
    this.tongue = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: COLORS.tongue }));
    this.tongue.position.z = 0.002;
    this.mouth.add(this.tongue);
    const fangShape = new THREE.Shape([new THREE.Vector2(-0.035, 0), new THREE.Vector2(0.035, 0), new THREE.Vector2(0, -0.075)]);
    for (let i = 0; i < 2; i++) {
      const fang = new THREE.Mesh(new THREE.ShapeGeometry(fangShape), new THREE.MeshBasicMaterial({ color: '#fffaf0' }));
      fang.position.z = 0.004;
      this.mouth.add(fang);
      this.fangs.push(fang);
    }

    // ---- Cachetes ----
    for (const side of [-1, 1]) {
      const cheek = new THREE.Mesh(
        new THREE.CircleGeometry(0.13, 24),
        new THREE.MeshBasicMaterial({ color: '#ff7eb6', transparent: true, opacity: 0, depthWrite: false }),
      );
      onSurface(cheek, new THREE.Vector3(side * 0.62, -0.08, 0.78), 1.012);
      this.head.add(cheek);
      this.cheeks.push(cheek);
    }

    // ---- Cuernos ----
    const hornMat = new THREE.MeshStandardMaterial({ color: COLORS.horn, roughness: 0.4 });
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.45, 20), hornMat);
      horn.geometry.translate(0, 0.225, 0);
      onSurface(horn, new THREE.Vector3(side * 0.5, 0.85, 0.05), 0.93, new THREE.Vector3(0, 1, 0));
      horn.rotateZ(-side * 0.25);
      this.head.add(horn);
    }

    // ---- Brazos ----
    const armMat = new THREE.MeshStandardMaterial({ color: '#8b5cf6', roughness: 0.5 });
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.9, -0.15, 0.15);
      const arm = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), armMat);
      arm.scale.set(0.17, 0.3, 0.17);
      arm.position.set(side * 0.12, -0.2, 0);
      pivot.add(arm);
      this.head.add(pivot);
      this.arms.push({ pivot, side });
    }

    // ---- Pies ----
    const footMat = new THREE.MeshStandardMaterial({ color: '#5b21b6', roughness: 0.6 });
    for (const side of [-1, 1]) {
      const foot = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), footMat);
      foot.scale.set(0.28, 0.13, 0.34);
      foot.position.set(side * 0.42, -0.92, 0.22);
      this.head.add(foot);
    }

    // ---- Antena con resorte ----
    this.antennaTube = new THREE.Mesh(new THREE.BufferGeometry(), this.antennaMaterial);
    this.head.add(this.antennaTube);
    this.antennaBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 20, 14),
      new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: this.ballColor, emissiveIntensity: 1.4 }),
    );
    this.head.add(this.antennaBall);
  }

  setMood(mood: Mood, color: string) {
    this.target = EXPRESSIONS[mood];
    this.ballTarget.set(color);
  }

  /** Impulso de aplastamiento (negativo) o estiramiento (positivo). */
  bump(amount: number, jiggle = 0.6) {
    this.squashVel += amount;
    this.jiggle = Math.max(this.jiggle, jiggle);
  }

  getMouthWorld(out: THREE.Vector3) {
    return this.mouth.getWorldPosition(out);
  }

  getHeadTopWorld(out: THREE.Vector3) {
    return this.head.localToWorld(out.set(0, 1.55, 0));
  }

  /** ¿El rayo toca al monstruo? (aproximado con su esfera). */
  hitTest(ray: THREE.Ray) {
    const c = this.head.getWorldPosition(new THREE.Vector3());
    return ray.distanceSqToPoint(c) < 1.15 * 1.15;
  }

  update(dt: number, time: number, accel: THREE.Vector3, stretch: number) {
    lerpExpression(this.expr, this.target, 1 - Math.exp(-dt * 9));
    const e = this.expr;

    // Parpadeo
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blink = 1;
      this.nextBlink = 1.8 + Math.random() * 3.5;
    }
    this.blink = Math.max(0, this.blink - dt * 7);
    const blinkShape = Math.sin(this.blink * Math.PI);

    // Squash & stretch con resorte (volumen aproximadamente constante)
    const breathing = Math.sin(time * 2.2) * 0.015 * (e.lidTop > 0.9 ? 2.2 : 1);
    const dance = this.danceAmount * Math.abs(Math.sin(time * 7)) * 0.12;
    const restTarget = 1 + breathing + stretch + dance;
    this.squashVel += (-(this.squash - restTarget) * 180 - this.squashVel * 9) * dt;
    this.squash += this.squashVel * dt;
    const s = THREE.MathUtils.clamp(this.squash, 0.55, 1.6);
    const side = 1 / Math.sqrt(s);
    this.squashPivot.scale.set(side, s, side);

    this.jiggle = Math.max(0, this.jiggle - dt * 1.4);
    this.bodyUniforms.uTime.value = time;
    this.bodyUniforms.uJiggle.value = this.jiggle;
    this.bodyUniforms.uWobble.value = 1 + this.dizzy * 1.5;
    this.bodyUniforms.uTintAmount.value = e.tint;
    this.lidMaterial.color.set('#9b6dff').lerp(COLORS.angry, e.tint * 0.8);

    // La cabeza se orienta hacia lo que mira; si está enojado te da la espalda.
    const local = this.squashPivot.worldToLocal(this.lookTarget.clone()).sub(this.head.position);
    const yawTarget = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -0.6, 0.6) * 0.45 + this.turnAway * 2.7;
    const pitchTarget = THREE.MathUtils.clamp(-Math.atan2(local.y, Math.hypot(local.x, local.z)), -0.5, 0.5) * 0.35;
    const danceYaw = this.danceAmount * Math.sin(time * 3.5) * 0.5;
    const k = 1 - Math.exp(-dt * 6);
    this.head.rotation.y += (yawTarget + danceYaw - this.head.rotation.y) * k;
    this.head.rotation.x += (pitchTarget - this.head.rotation.x) * k;
    this.head.rotation.z += (Math.sin(time * 1.3) * 0.04 + this.dizzy * Math.sin(time * 5) * 0.18 - this.head.rotation.z) * k;

    // Ojos
    for (const eye of this.eyes) {
      const dir = this.head.worldToLocal(this.lookTarget.clone()).sub(eye.center);
      let yaw = THREE.MathUtils.clamp(Math.atan2(dir.x, dir.z), -0.7, 0.7);
      let pitch = THREE.MathUtils.clamp(-Math.atan2(dir.y, Math.hypot(dir.x, dir.z)), -0.6, 0.6);
      if (this.dizzy > 0.01) {
        // Ojos dando vueltas, cada uno para su lado.
        yaw = THREE.MathUtils.lerp(yaw, Math.sin(time * 9 * eye.side) * 0.5, this.dizzy);
        pitch = THREE.MathUtils.lerp(pitch, Math.cos(time * 9 * eye.side) * 0.5, this.dizzy);
      }
      eye.pivot.rotation.set(pitch, yaw, 0);
      eye.pupil.scale.set(e.pupil, e.pupil, 0.3);

      const closed = Math.max(e.lidTop, blinkShape);
      eye.lidTop.rotation.x = THREE.MathUtils.lerp(-1.45, 1.6, closed);
      eye.lidTopHolder.rotation.z = eye.side * e.lidTilt;
      eye.lidBottom.rotation.x = THREE.MathUtils.lerp(1.45, -0.45, Math.max(e.lidBottom, blinkShape * 0.35));
    }

    // Boca (se reconstruye sólo si cambió)
    const open = THREE.MathUtils.clamp(e.mouthOpen + (this.chewing > 0 ? Math.abs(Math.sin(time * 14)) * 0.35 * this.chewing : 0), 0, 1);
    this.updateMouth(e.mouthWidth, open, e.mouthCurve + this.dizzy * Math.sin(time * 6) * 0.3);

    for (const cheek of this.cheeks) {
      (cheek.material as THREE.MeshBasicMaterial).opacity = e.blush * 0.65;
    }

    // Brazos
    for (const arm of this.arms) {
      const wave = e.armWave * (0.9 + Math.sin(time * 12 + arm.side) * 0.6);
      arm.pivot.rotation.z = arm.side * (0.25 + wave) + Math.sin(time * 2 + arm.side) * 0.06;
      arm.pivot.rotation.x = this.danceAmount * Math.sin(time * 7 + arm.side * 1.5) * 0.6;
    }

    // Antena: resorte que reacciona a la aceleración del cuerpo.
    const force = accel.clone().multiplyScalar(-0.012);
    this.antennaVel.add(force).addScaledVector(this.antennaOffset, -dt * 90).multiplyScalar(Math.exp(-dt * 4));
    this.antennaOffset.addScaledVector(this.antennaVel, dt);
    this.antennaOffset.clampLength(0, 0.35);
    this.updateAntenna(time);

    this.ballColor.lerp(this.ballTarget, 1 - Math.exp(-dt * 5));
    (this.antennaBall.material as THREE.MeshStandardMaterial).emissive.copy(this.ballColor);
    (this.antennaBall.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2 + Math.sin(time * 4) * 0.3;
  }

  private updateMouth(width: number, open: number, curve: number) {
    const key = `${width.toFixed(3)}|${open.toFixed(3)}|${curve.toFixed(3)}`;
    if (key === this.lastMouthKey) return;
    this.lastMouthKey = key;

    const N = 18;
    const half = width / 2;
    const upper = (t: number) => -curve * 0.07 * (1 - t * t);
    const lower = (t: number) => upper(t) - (0.018 + open * 0.27) * Math.pow(1 - t * t, 0.7);

    const shape = new THREE.Shape();
    for (let i = 0; i <= N; i++) {
      const t = -1 + (2 * i) / N;
      if (i === 0) shape.moveTo(t * half, upper(t));
      else shape.lineTo(t * half, upper(t));
    }
    for (let i = N; i >= 0; i--) {
      const t = -1 + (2 * i) / N;
      shape.lineTo(t * half, lower(t));
    }
    this.mouthShape.geometry.dispose();
    this.mouthShape.geometry = new THREE.ShapeGeometry(shape);

    const depth = upper(0) - lower(0);
    this.tongue.visible = open > 0.15;
    this.tongue.scale.set(half * 0.55, depth * 0.3, 1);
    this.tongue.position.y = lower(0) + depth * 0.28;

    this.fangs.forEach((fang, i) => {
      const t = i === 0 ? -0.42 : 0.42;
      fang.position.x = t * half;
      fang.position.y = upper(t) + 0.004;
      fang.scale.setScalar(0.7 + width);
    });
  }

  private updateAntenna(time: number) {
    const base = new THREE.Vector3(0, 0.97, -0.08);
    const sway = new THREE.Vector3(Math.sin(time * 1.7) * 0.05, 0, Math.cos(time * 1.3) * 0.04);
    const tip = base.clone().add(new THREE.Vector3(0, 0.62, 0)).add(this.antennaOffset).add(sway);
    const ctrl = base.clone().add(new THREE.Vector3(0, 0.38, 0)).addScaledVector(this.antennaOffset, 0.3);
    const curve = new THREE.QuadraticBezierCurve3(base, ctrl, tip);
    this.antennaTube.geometry.dispose();
    this.antennaTube.geometry = new THREE.TubeGeometry(curve, 12, 0.028, 8);
    this.antennaBall.position.copy(tip);
  }
}

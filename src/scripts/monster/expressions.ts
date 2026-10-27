export type Mood =
  | 'neutral'
  | 'happy'
  | 'curious'
  | 'surprised'
  | 'annoyed'
  | 'angry'
  | 'sad'
  | 'sleepy'
  | 'sleeping'
  | 'dizzy'
  | 'eager'
  | 'eating'
  | 'love';

export interface Expression {
  lidTop: number; // 0 abierto · 1 cerrado
  lidBottom: number; // 0 abierto · 1 ojos sonrientes (^^)
  lidTilt: number; // + enojado · - triste
  pupil: number; // escala de la pupila
  mouthOpen: number; // 0..1
  mouthCurve: number; // -1 triste · 1 sonrisa
  mouthWidth: number;
  armWave: number; // 0..1
  tint: number; // 0 normal · 1 rojo de coraje
  blush: number; // 0..1
}

const base: Expression = {
  lidTop: 0.12,
  lidBottom: 0,
  lidTilt: 0,
  pupil: 1,
  mouthOpen: 0.05,
  mouthCurve: 0.35,
  mouthWidth: 0.42,
  armWave: 0,
  tint: 0,
  blush: 0.15,
};

export const EXPRESSIONS: Record<Mood, Expression> = {
  neutral: base,
  happy: { ...base, lidTop: 0.05, lidBottom: 0.55, lidTilt: -0.1, pupil: 1.15, mouthOpen: 0.45, mouthCurve: 1, mouthWidth: 0.5, armWave: 0.8, blush: 0.7 },
  curious: { ...base, lidTop: 0, lidTilt: -0.15, pupil: 1.35, mouthOpen: 0.12, mouthCurve: 0.1, mouthWidth: 0.26, blush: 0.2 },
  surprised: { ...base, lidTop: 0, lidTilt: -0.3, pupil: 0.7, mouthOpen: 0.85, mouthCurve: 0, mouthWidth: 0.26, blush: 0.1 },
  annoyed: { ...base, lidTop: 0.4, lidBottom: 0.1, lidTilt: 0.35, pupil: 0.9, mouthCurve: -0.5, mouthWidth: 0.36, tint: 0.25, blush: 0 },
  angry: { ...base, lidTop: 0.38, lidBottom: 0.15, lidTilt: 0.6, pupil: 0.65, mouthOpen: 0.35, mouthCurve: -1, mouthWidth: 0.5, tint: 0.75, blush: 0 },
  sad: { ...base, lidTop: 0.3, lidTilt: -0.45, pupil: 1.25, mouthCurve: -0.7, mouthWidth: 0.3, blush: 0 },
  sleepy: { ...base, lidTop: 0.62, lidBottom: 0.1, lidTilt: -0.15, mouthOpen: 0.08, mouthCurve: 0, mouthWidth: 0.3, blush: 0.1 },
  sleeping: { ...base, lidTop: 1, lidBottom: 0.2, mouthOpen: 0.12, mouthCurve: 0.2, mouthWidth: 0.22, blush: 0.2 },
  dizzy: { ...base, lidTop: 0.25, lidBottom: 0.1, lidTilt: -0.2, pupil: 0.8, mouthOpen: 0.3, mouthCurve: -0.2, mouthWidth: 0.44, blush: 0.3 },
  eager: { ...base, lidTop: 0, pupil: 1.45, mouthOpen: 1, mouthCurve: 0.4, mouthWidth: 0.4, blush: 0.3 },
  eating: { ...base, lidTop: 0.2, lidBottom: 0.45, pupil: 1.1, mouthOpen: 0.3, mouthCurve: 0.6, mouthWidth: 0.44, blush: 0.4 },
  love: { ...base, lidTop: 0.1, lidBottom: 0.5, pupil: 1.5, mouthOpen: 0.3, mouthCurve: 1, mouthWidth: 0.45, armWave: 0.3, blush: 1 },
};

export const MOOD_LABEL: Record<Mood, string> = {
  neutral: '😐 Tranquilo',
  happy: '😄 Feliz',
  curious: '🤔 Curioso',
  surprised: '😮 Sorprendido',
  annoyed: '😒 Molesto',
  angry: '😡 Enojado',
  sad: '😢 Triste',
  sleepy: '🥱 Con sueño',
  sleeping: '😴 Dormido',
  dizzy: '😵 Mareado',
  eager: '🤤 Antojado',
  eating: '😋 Comiendo',
  love: '🥰 Enamorado',
};

// Color de la bolita de la antena según el ánimo.
export const MOOD_COLOR: Record<Mood, string> = {
  neutral: '#a5f3fc',
  happy: '#fde047',
  curious: '#67e8f9',
  surprised: '#ffffff',
  annoyed: '#fb923c',
  angry: '#ef4444',
  sad: '#60a5fa',
  sleepy: '#a78bfa',
  sleeping: '#6366f1',
  dizzy: '#4ade80',
  eager: '#f9a8d4',
  eating: '#f472b6',
  love: '#fb7185',
};

export function lerpExpression(out: Expression, target: Expression, t: number) {
  for (const k of Object.keys(out) as (keyof Expression)[]) {
    out[k] += (target[k] - out[k]) * t;
  }
}

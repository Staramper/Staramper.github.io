// Efectos de sonido sintetizados con Web Audio (sin archivos de audio).

let ctx: AudioContext | null = null;
let muted = false;

try {
  muted = localStorage.getItem('blobi-muted') === '1';
} catch {
  // Sin almacenamiento disponible: se queda con sonido.
}

/** Debe llamarse dentro de un gesto del usuario (los navegadores bloquean el audio antes). */
export function unlockAudio() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
}

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem('blobi-muted', value ? '1' : '0');
  } catch {
    // Ignorar
  }
}

function ready() {
  return ctx && !muted && ctx.state === 'running' ? ctx : null;
}

interface ToneOptions {
  type?: OscillatorType;
  from: number;
  to: number;
  dur: number;
  vol?: number;
  delay?: number;
  vibrato?: number;
}

function tone({ type = 'sine', from, to, dur, vol = 0.15, delay = 0, vibrato = 0 }: ToneOptions) {
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (vibrato) {
    const lfo = ac.createOscillator();
    const lfoGain = ac.createGain();
    lfo.frequency.value = 18;
    lfoGain.gain.value = vibrato;
    lfo.connect(lfoGain).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + dur);
  }
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise({ dur, freq, q = 1, vol = 0.2, type = 'bandpass' as BiquadFilterType, delay = 0 }) {
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t);
}

export const sfx = {
  squeak: () => tone({ from: 700, to: 1400, dur: 0.12, vol: 0.12 }),
  giggle: () => [0, 0.09, 0.18].forEach((d, i) => tone({ from: 800 + i * 160, to: 1300 + i * 200, dur: 0.08, delay: d, vol: 0.1 })),
  boing: () => tone({ from: 420, to: 110, dur: 0.4, vol: 0.18, vibrato: 30 }),
  thud: () => tone({ from: 160, to: 45, dur: 0.25, vol: 0.3 }),
  chomp: () => noise({ dur: 0.09, freq: 700, q: 2, vol: 0.35 }),
  grr: () => tone({ type: 'sawtooth', from: 95, to: 70, dur: 0.6, vol: 0.12, vibrato: 25 }),
  burp: () => tone({ type: 'sawtooth', from: 130, to: 60, dur: 0.45, vol: 0.12, vibrato: 40 }),
  snore: () => noise({ dur: 1.1, freq: 260, q: 0.8, vol: 0.08, type: 'lowpass' }),
  whee: () => tone({ type: 'triangle', from: 400, to: 1600, dur: 0.5, vol: 0.1 }),
  sad: () => tone({ type: 'triangle', from: 520, to: 260, dur: 0.6, vol: 0.1, vibrato: 8 }),
  love: () => [0, 0.12, 0.24].forEach((d, i) => tone({ type: 'triangle', from: [523, 659, 784][i], to: [523, 659, 784][i], dur: 0.2, delay: d, vol: 0.1 })),
  note: (i: number) => {
    const scale = [392, 440, 523, 587, 659, 784];
    const f = scale[i % scale.length];
    tone({ type: 'triangle', from: f, to: f, dur: 0.18, vol: 0.08 });
  },
};

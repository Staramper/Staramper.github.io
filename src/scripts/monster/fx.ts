// Efectos en DOM sobre el canvas: globo de diálogo, emojis flotantes y letras-comida.

interface Particle {
  el: HTMLElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  spin: number;
  rot: number;
}

interface Food {
  el: HTMLElement;
  sx: number;
  sy: number;
  t: number;
  dur: number;
  arc: number;
  char: string;
}

export class Fx {
  private particles: Particle[] = [];
  private foods: Food[] = [];
  private bubbleTimer = 0;

  constructor(
    private layer: HTMLElement,
    private bubble: HTMLElement,
  ) {}

  get foodInFlight() {
    return this.foods.length;
  }

  say(text: string, seconds = 2.6) {
    this.bubble.textContent = text;
    this.bubble.classList.remove('pop');
    void this.bubble.offsetWidth; // reinicia la animación
    this.bubble.classList.add('pop');
    this.bubble.style.opacity = '1';
    this.bubbleTimer = seconds;
    this.placeBubble();
  }

  private head = { x: 0, y: 0 };

  private placeBubble() {
    const bw = this.bubble.offsetWidth;
    const bh = this.bubble.offsetHeight;
    const bx = Math.min(Math.max(this.head.x, bw / 2 + 12), window.innerWidth - bw / 2 - 12);
    const by = Math.max(this.head.y, bh + 16);
    this.bubble.style.transform = `translate(${bx - bw / 2}px, ${by - bh - 10}px)`;
  }

  emit(emoji: string, x: number, y: number, count = 1, spread = 1) {
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.className = 'fx-particle';
      el.textContent = emoji;
      el.style.fontSize = `${18 + Math.random() * 18}px`;
      this.layer.appendChild(el);
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6 * spread;
      const speed = 80 + Math.random() * 140 * spread;
      const life = 1.2 + Math.random() * 0.8;
      this.particles.push({
        el,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        spin: (Math.random() - 0.5) * 200,
        rot: 0,
      });
    }
  }

  ripple(x: number, y: number) {
    const el = document.createElement('span');
    el.className = 'fx-ripple';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.layer.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  /** Lanza una letra hacia la boca. Devuelve cuando la letra llega mediante onArrive en update. */
  throwFood(char: string, sx: number, sy: number) {
    const el = document.createElement('span');
    el.className = 'fx-food';
    el.textContent = char;
    this.layer.appendChild(el);
    this.foods.push({ el, sx, sy, t: 0, dur: 0.75 + Math.random() * 0.25, arc: 120 + Math.random() * 120, char });
  }

  update(dt: number, mouth: { x: number; y: number }, head: { x: number; y: number }, onArrive: (char: string) => void) {
    // Globo de diálogo sobre la cabeza
    if (this.bubbleTimer > 0) {
      this.bubbleTimer -= dt;
      if (this.bubbleTimer <= 0) this.bubble.style.opacity = '0';
    }
    this.head = head;
    this.placeBubble();

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.el.remove();
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= 20 * dt; // flotan hacia arriba
      p.vx *= 0.98;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      const k = p.life / p.maxLife;
      p.el.style.opacity = String(Math.min(1, k * 2));
      p.el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg) scale(${0.6 + (1 - k) * 0.6})`;
    }

    for (let i = this.foods.length - 1; i >= 0; i--) {
      const f = this.foods[i];
      f.t += dt / f.dur;
      if (f.t >= 1) {
        f.el.remove();
        this.foods.splice(i, 1);
        onArrive(f.char);
        continue;
      }
      // Curva en arco hacia la boca, que se va encogiendo al entrar.
      const t = f.t * f.t * (3 - 2 * f.t);
      const x = f.sx + (mouth.x - f.sx) * t;
      const y = f.sy + (mouth.y - f.sy) * t - Math.sin(Math.PI * t) * f.arc;
      f.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${t * 540}deg) scale(${1.4 - t * 0.9})`;
    }
  }
}

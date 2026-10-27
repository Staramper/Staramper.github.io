import * as THREE from 'three';
import { Monster } from './Monster';
import { Fx } from './fx';
import { sfx, unlockAudio, isMuted, setMuted } from './audio';
import { MOOD_COLOR, MOOD_LABEL, type Mood } from './expressions';

// Un ánimo sólo puede interrumpir a otro de prioridad igual o menor (salvo que expire).
const PRIORITY: Record<Mood, number> = {
  neutral: 0,
  curious: 1,
  sleepy: 2,
  sad: 2,
  sleeping: 2,
  happy: 3,
  eager: 3,
  eating: 4,
  surprised: 4,
  love: 5,
  annoyed: 5,
  dizzy: 6,
  angry: 7,
};

const PHRASES = {
  hello: ['¡Hola! Soy Blobi 👾'],
  tips: [
    'Haz clic, arrástrame o escríbeme algo ✨',
    '¿Me das una letra? Tengo hambre de abecedario 🔤',
    'Prueba escribir «baila» 🕺',
    'Arrástrame y lánzame… si te atreves 😏',
    'Acaríciame pasando el mouse despacito 💜',
    'Escribe «hola», «salta» o «duerme»',
  ],
  giggle: ['¡Jiji!', '¡Cosquillas! 😆', '¡Ay, jaja!', '¡Otra vez!'],
  annoyed: ['Oye…', 'Ya, ya…', 'Mmm, suficiente 😒', '¿Me estás picando?'],
  angry: ['¡¡YA BASTA!! 😡', '¡GRRR!', '¡No te hablo! 😤', '¡Hmpf!'],
  pet: ['Mmm, qué rico 💜', 'Ronroneo de monstruo… 🥰', 'Sigue, sigue…', 'Me encanta 😌'],
  grab: ['¡Wiii!', '¡Bájame! 😱', '¡Estoy volando!', '¿A dónde vamos?'],
  throw: ['¡Aaaah!', '¡Wooo!', '¡Ahí voy!'],
  ouch: ['¡Auch! 😵', 'Veo estrellitas…', '¡Pum!'],
  dizzy: ['Me estás mareando… 😵‍💫', 'Todo da vueltas…', 'Para, paraaa…'],
  eh: ['¿Eh?', '¿Qué fue eso?', '👀'],
  hungry: ['Tengo hambre… escribe algo 🍪', 'Mi pancita ruge… 🔤', '¿Una letrita? ¿Porfa?'],
  yawn: ['*bostezo* 🥱', 'Qué sueño…'],
  sleep: ['Zzz…', 'Cinco minutitos más…'],
  wake: ['¡¿Eh?! ¡No estaba dormido!', '¡Despierto! 😳', '¿Qué pasó?'],
  grumpy: ['Déjame dormir… 😪', 'Shhh…'],
  back: ['¡Volviste! Te extrañé 💜', '¡Hola de nuevo! 🎉'],
  leave: ['¿A dónde vas? 👀', '¡No te vayas! 🥺'],
  return: ['¡Ahí estás! 👋', '¡Volviste!'],
  full: ['Ya no puedo más… 🫃', 'Estoy llenito…'],
  love: ['¡Te quiero! 💖', '🥰🥰🥰', '¡Eres mi humano favorito!'],
};

type PhraseKey = keyof typeof PHRASES;

interface Elements {
  canvas: HTMLCanvasElement;
  layer: HTMLElement;
  bubble: HTMLElement;
  moodLabel: HTMLElement;
  bars: { happy: HTMLElement; hunger: HTMLElement; energy: HTMLElement };
  muteBtn: HTMLButtonElement;
  feedInput: HTMLInputElement;
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ]/g, '');

export function initMonster(els: Elements) {
  // ---------- Escena ----------
  const renderer = new THREE.WebGLRenderer({ canvas: els.canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
  const lookAtPoint = new THREE.Vector3(0, 1.3, 0);
  const placeCamera = () => {
    // En pantallas verticales la cámara se aleja para que el monstruo quepa.
    camera.position.set(0, 1.9, camera.aspect < 1 ? 13 : 9.5);
    camera.lookAt(lookAtPoint);
  };
  placeCamera();

  scene.add(new THREE.HemisphereLight('#efe4ff', '#2e1065', 1.6));
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  sun.position.set(3, 5, 4);
  scene.add(sun);

  const radialTexture = (inner: string, outer: string) => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, inner);
    grad.addColorStop(1, outer);
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(5, 64),
    new THREE.MeshBasicMaterial({ map: radialTexture('rgba(167,139,250,0.35)', 'rgba(167,139,250,0)'), transparent: true, depthWrite: false }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshBasicMaterial({ map: radialTexture('rgba(10,0,30,0.6)', 'rgba(10,0,30,0)'), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  scene.add(shadow);

  const monster = new Monster();
  scene.add(monster.root);

  const fx = new Fx(els.layer, els.bubble);

  // ---------- Estado ----------
  const clock = new THREE.Clock();
  let time = 0;

  const pos = new THREE.Vector3();
  const vel = new THREE.Vector3();
  const prevVel = new THREE.Vector3();
  const accel = new THREE.Vector3();
  let grounded = true;

  const ndc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const lookPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -3);
  const dragPoint = new THREE.Vector3();
  const grabOffset = new THREE.Vector3();
  const pointerPx = { x: 0, y: 0 };
  let pointerInside = false;
  let pointerSpeed = 0;
  let lastMove = { x: 0, y: 0, t: 0 };
  let pressed = false;
  let pressOnMonster = false;
  let pressStart = { x: 0, y: 0 };
  let dragging = false;

  let mood: Mood = 'neutral';
  let moodUntil = 0;
  let lastInput = 0;
  let sleeping = false;
  let saidYawn = false;
  let shake = 0;
  let pet = 0;
  let hoverTime = 0;
  let pokes: number[] = [];
  let turnAwayUntil = 0;
  let danceUntil = 0;
  let nextDanceHop = 0;
  let danceNote = 0;
  let nextZ = 0;
  let nextSnore = 0;
  let nextIdleAction = 6;
  let nextHungerComplaint = 25;
  let nextLeaveLine = 0;
  let leftAt = 0;
  let hiddenAt = 0;
  let overfed = 0;
  let typed = '';
  let tipIndex = 0;
  let lastPhrase = '';
  const wander = new THREE.Vector3(0, 1.3, 6);
  const stats = { happy: 0.6, hunger: 0.35, energy: 0.9 };

  const tmp = new THREE.Vector3();
  const toScreen = (v: THREE.Vector3) => {
    tmp.copy(v).project(camera);
    return { x: (tmp.x * 0.5 + 0.5) * window.innerWidth, y: (-tmp.y * 0.5 + 0.5) * window.innerHeight };
  };
  const headScreen = () => toScreen(monster.getHeadTopWorld(new THREE.Vector3()));
  const mouthScreen = () => toScreen(monster.getMouthWorld(new THREE.Vector3()));

  // ---------- Comportamiento ----------

  function say(key: PhraseKey | string, seconds?: number) {
    const options = key in PHRASES ? PHRASES[key as PhraseKey] : [key];
    let text = options[Math.floor(Math.random() * options.length)];
    if (options.length > 1 && text === lastPhrase) text = options[(options.indexOf(text) + 1) % options.length];
    lastPhrase = text;
    fx.say(text, seconds);
  }

  function setMood(m: Mood, duration: number, force = false) {
    if (!force && time < moodUntil && PRIORITY[m] < PRIORITY[mood]) return false;
    mood = m;
    moodUntil = time + duration;
    monster.setMood(m, MOOD_COLOR[m]);
    els.moodLabel.textContent = MOOD_LABEL[m];
    return true;
  }

  function baselineMood(): Mood {
    if (sleeping) return 'sleeping';
    if (time - lastInput > 9) return 'sleepy';
    if (stats.hunger > 0.8) return 'sad';
    return 'neutral';
  }

  function jump(power: number) {
    if (!grounded || dragging) return;
    vel.y = power;
    grounded = false;
    monster.bump(-0.4, 0.3);
  }

  function hop(dir: number, power = 6) {
    if (!grounded || dragging) return;
    vel.x = dir;
    jump(power);
  }

  function emitAtHead(emoji: string, count: number, spread = 1) {
    const h = headScreen();
    fx.emit(emoji, h.x, h.y + 60, count, spread);
  }

  function wakeUp(grumpy: boolean) {
    sleeping = false;
    saidYawn = false;
    if (grumpy) {
      setMood('annoyed', 2, true);
      say('grumpy');
    } else {
      setMood('surprised', 1.2, true);
      say('wake');
      jump(6);
      sfx.squeak();
    }
  }

  function fallAsleep() {
    if (sleeping) return;
    sleeping = true;
    danceUntil = 0;
    setMood('sleeping', 1, true);
    say('sleep');
  }

  /** Cualquier interacción: reinicia el contador de inactividad y despierta. */
  function noteInput(strong = true) {
    lastInput = time;
    if (sleeping && strong) wakeUp(false);
  }

  function poke(x: number, y: number) {
    pokes = pokes.filter((t) => time - t < 3);
    pokes.push(time);
    const n = pokes.length;

    if (mood === 'angry') {
      moodUntil = time + 2;
      turnAwayUntil = time + 2;
      say('angry');
      sfx.grr();
      monster.bump(-0.3, 1);
      return;
    }
    if (n >= 7) {
      setMood('angry', 3.5, true);
      turnAwayUntil = time + 3.5;
      say('angry');
      sfx.grr();
      monster.bump(-0.45, 1);
      stats.happy -= 0.15;
      pokes = [];
    } else if (n >= 4) {
      setMood('annoyed', 1.8);
      say('annoyed');
      monster.bump(-0.25, 0.6);
      stats.happy -= 0.04;
    } else {
      setMood('happy', 1.6);
      say('giggle', 1.4);
      sfx.giggle();
      fx.emit(Math.random() < 0.5 ? '✨' : '💜', x, y, 3);
      monster.bump(-0.32, 0.8);
      stats.happy += 0.05;
    }
  }

  function love() {
    setMood('love', 3, true);
    say('love');
    sfx.love();
    emitAtHead('💖', 8, 1.6);
    stats.happy += 0.1;
    jump(5);
  }

  function feed(char: string) {
    noteInput();
    const start = pointerInside
      ? pointerPx
      : { x: window.innerWidth * (0.15 + Math.random() * 0.7), y: window.innerHeight - 50 };
    fx.throwFood(char, start.x, start.y);

    typed = (typed + char).slice(-30);
    checkWords();
  }

  function eat(char: string) {
    setMood('eating', 0.9, mood === 'eager');
    monster.chewing = 1;
    monster.bump(-0.2, 0.4);
    sfx.chomp();
    stats.happy += 0.015;

    if (stats.hunger <= 0.02) {
      overfed++;
      if (overfed === 3) say('full');
      if (overfed >= 7) {
        overfed = 0;
        say('*BURP* 💨 …perdón', 2.2);
        sfx.burp();
        emitAtHead('💨', 3);
        monster.bump(0.4, 1);
      }
    } else if (Math.random() < 0.3) {
      if (/[0-9]/.test(char)) say('¡Números crujientes! 🔢', 1.6);
      else if (/[a-zñáéíóú]/i.test(char)) say(`¡Ñam! Sabe a «${char.toUpperCase()}» 😋`, 1.6);
      else say('¿Eso se come? 🤔', 1.6);
    }
    stats.hunger = Math.max(0, stats.hunger - 0.05);
  }

  const WORDS: { words: string[]; run: () => void }[] = [
    {
      words: ['hola', 'hi', 'hello'],
      run: () => {
        setMood('happy', 2.5, true);
        say('¡Hola, humano! 👋');
        sfx.squeak();
      },
    },
    {
      words: ['adios', 'bye', 'chao'],
      run: () => {
        setMood('sad', 3, true);
        say('¿Ya te vas? 😢');
        sfx.sad();
      },
    },
    { words: ['tequiero', 'teamo', 'teadoro'], run: love },
    {
      words: ['feo', 'tonto', 'malo'],
      run: () => {
        setMood('sad', 3, true);
        say('Eso dolió… 💔');
        sfx.sad();
        stats.happy -= 0.15;
      },
    },
    {
      words: ['baila', 'dance', 'fiesta'],
      run: () => {
        danceUntil = time + 6;
        say('¡A bailar! 🎶');
      },
    },
    { words: ['duerme', 'dormir', 'sleep'], run: () => (lastInput = time - 30) },
    {
      words: ['salta', 'jump', 'brinca'],
      run: () => {
        jump(13);
        say('¡Hop!', 1.2);
        sfx.whee();
      },
    },
    {
      words: ['abraham', 'staramper'],
      run: () => {
        love();
        say('¡Mi creador! 🥹');
      },
    },
    {
      words: ['comida', 'hambre', 'galleta'],
      run: () => {
        setMood('eager', 2, true);
        say('¡Sí! ¡Dame más letras! 🤤');
      },
    },
  ];

  function checkWords() {
    const clean = normalize(typed);
    for (const entry of WORDS) {
      if (entry.words.some((w) => clean.endsWith(w))) {
        typed = '';
        // Se ejecuta cuando la última letra ya fue tragada.
        setTimeout(entry.run, 800);
        return;
      }
    }
  }

  function idleAction() {
    const r = Math.random();
    if (r < 0.35) {
      say(PHRASES.tips[tipIndex++ % PHRASES.tips.length], 3.2);
    } else if (r < 0.6) {
      hop((Math.random() - 0.5) * 3, 5);
    } else {
      wander.set((Math.random() - 0.5) * 8, 0.5 + Math.random() * 3, 6);
    }
  }

  // ---------- Entradas ----------

  function updatePointer(e: PointerEvent) {
    pointerPx.x = e.clientX;
    pointerPx.y = e.clientY;
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  }

  window.addEventListener('pointermove', (e) => {
    updatePointer(e);
    const now = performance.now() / 1000;
    const dtMove = Math.max(now - lastMove.t, 1 / 240);
    const inst = Math.hypot(e.clientX - lastMove.x, e.clientY - lastMove.y) / dtMove;
    pointerSpeed += (Math.min(inst, 8000) - pointerSpeed) * 0.3;
    lastMove = { x: e.clientX, y: e.clientY, t: now };

    if (!pointerInside) {
      pointerInside = true;
      if (leftAt && time - leftAt > 2 && !sleeping) {
        setMood('curious', 1.5);
        say('return');
      }
    }
    noteInput(false);

    if (pressed && pressOnMonster && !dragging && Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > 8) {
      dragging = true;
      grounded = false;
      if (sleeping) sleeping = false;
      setMood('surprised', 999, true);
      say('grab');
      sfx.whee();
    }
  });

  els.canvas.addEventListener('pointerdown', (e) => {
    unlockAudio();
    updatePointer(e);
    els.canvas.setPointerCapture(e.pointerId);
    pressed = true;
    pressStart = { x: e.clientX, y: e.clientY };
    pressOnMonster = monster.hitTest(raycaster.ray);
    if (pressOnMonster) {
      raycaster.ray.intersectPlane(dragPlane, dragPoint);
      grabOffset.copy(dragPoint).sub(pos);
    }
  });

  els.canvas.addEventListener('pointerup', (e) => {
    if (!pressed) return;
    pressed = false;
    if (dragging) {
      dragging = false;
      vel.clampLength(0, 22);
      moodUntil = time + 0.8;
      if (vel.length() > 8) {
        say('throw', 1.4);
        sfx.boing();
      }
      noteInput();
      return;
    }
    if (pressOnMonster) {
      if (sleeping) {
        noteInput();
        return;
      }
      noteInput();
      poke(e.clientX, e.clientY);
    } else {
      noteInput();
      fx.ripple(e.clientX, e.clientY);
      raycaster.ray.intersectPlane(lookPlane, wander);
      if (setMood('surprised', 0.7)) {
        if (Math.random() < 0.4) say('eh', 1.2);
        jump(3.5);
      }
    }
  });

  els.canvas.addEventListener('dblclick', (e) => {
    updatePointer(e as unknown as PointerEvent);
    if (monster.hitTest(raycaster.ray)) love();
  });

  document.addEventListener('pointerout', (e) => {
    if (e.relatedTarget) return;
    pointerInside = false;
    leftAt = time;
    if (!sleeping && time > nextLeaveLine) {
      nextLeaveLine = time + 10;
      if (setMood('sad', 1.5)) say('leave');
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.target === els.feedInput || e.metaKey || e.ctrlKey || e.altKey) return;
    unlockAudio();
    if (e.key === ' ') {
      e.preventDefault();
      noteInput();
      jump(10);
      sfx.whee();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      noteInput();
      hop(e.key === 'ArrowLeft' ? -4.5 : 4.5);
      sfx.squeak();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      noteInput();
      jump(13);
      sfx.whee();
    } else if (e.key.length === 1) {
      feed(e.key);
    }
  });

  // Campo de texto (necesario para teclados móviles).
  els.feedInput.addEventListener('input', () => {
    unlockAudio();
    for (const ch of els.feedInput.value) if (ch.trim()) feed(ch);
    els.feedInput.value = '';
  });

  els.muteBtn.addEventListener('click', () => {
    unlockAudio();
    setMuted(!isMuted());
    els.muteBtn.textContent = isMuted() ? '🔇' : '🔊';
  });
  els.muteBtn.textContent = isMuted() ? '🔇' : '🔊';

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = performance.now();
    } else if (performance.now() - hiddenAt > 3000) {
      clock.getDelta();
      noteInput();
      setMood('happy', 2.5, true);
      say('back');
      jump(8);
      sfx.giggle();
    }
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    placeCamera();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Sólo en desarrollo: acceso desde la consola para depurar.
  if (import.meta.env.DEV) Object.assign(window, { __blobi: { monster, headScreen, mouthScreen, pos } });

  // Saludo inicial
  setTimeout(() => {
    setMood('happy', 2, true);
    say('hello');
    jump(7);
  }, 700);
  setTimeout(() => say(PHRASES.tips[tipIndex++], 3.5), 4200);

  // ---------- Bucle ----------

  let hudTimer = 0;

  function tick() {
    const dt = THREE.MathUtils.clamp(clock.getDelta(), 1 / 1000, 1 / 30);
    time += dt;

    // Límites visibles en el plano z = 0.
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const limX = Math.max(halfH * camera.aspect - 1.2, 1.5);
    const limY = camera.position.y + halfH - 2.6;

    // ---- Física ----
    prevVel.copy(vel);
    if (dragging) {
      raycaster.ray.intersectPlane(dragPlane, dragPoint);
      const target = dragPoint.clone().sub(grabOffset);
      target.y = Math.max(target.y, 0);
      const next = pos.clone().lerp(target, 1 - Math.exp(-dt * 18));
      vel.lerp(next.clone().sub(pos).divideScalar(dt), 0.35);
      pos.copy(next);
      monster.root.rotation.z += (THREE.MathUtils.clamp(-vel.x * 0.04, -0.6, 0.6) - monster.root.rotation.z) * 0.2;
    } else {
      if (!grounded) vel.y -= 24 * dt;
      pos.addScaledVector(vel, dt);

      if (pos.y <= 0 && vel.y <= 0 && !grounded) {
        const impact = -vel.y;
        pos.y = 0;
        if (impact > 3) monster.bump(-impact * 0.055, Math.min(1, impact * 0.07));
        if (impact > 8) sfx.thud();
        if (impact > 15 && mood !== 'dizzy') {
          setMood('dizzy', 3, true);
          say('ouch');
          emitAtHead('⭐', 5, 1.3);
        }
        vel.x *= 0.7;
        if (impact > 4.5) {
          vel.y = impact * 0.38;
        } else {
          vel.y = 0;
          grounded = true;
        }
      }
      if (grounded) vel.x *= Math.exp(-dt * 6);

      if (Math.abs(pos.x) > limX) {
        const impact = Math.abs(vel.x);
        pos.x = Math.sign(pos.x) * limX;
        vel.x = -Math.sign(pos.x) * impact * 0.55;
        if (impact > 6) {
          monster.bump(-0.3, 0.9);
          sfx.thud();
          say('¡Pum! 💥', 1.2);
        }
      }
      if (pos.y > limY) {
        pos.y = limY;
        vel.y = -Math.abs(vel.y) * 0.4;
      }

      // Da vueltas en el aire; al aterrizar se endereza.
      const rz = monster.root.rotation.z;
      if (!grounded) monster.root.rotation.z -= vel.x * dt * 0.5;
      else monster.root.rotation.z = Math.atan2(Math.sin(rz), Math.cos(rz)) * Math.exp(-dt * 10);
    }
    accel.copy(vel).sub(prevVel).divideScalar(dt);
    monster.root.position.copy(pos);

    const height = pos.y;
    shadow.position.x = pos.x;
    shadow.scale.setScalar(1.25 * (1 - Math.min(height / 7, 0.6)));
    (shadow.material as THREE.MeshBasicMaterial).opacity = 1 - Math.min(height / 6, 0.75);

    // ---- Mirada ----
    if (dragging) {
      monster.lookTarget.lerp(camera.position, 0.2);
    } else if (pointerInside && !sleeping) {
      const hit = raycaster.ray.intersectPlane(lookPlane, tmp);
      if (hit) monster.lookTarget.lerp(hit, 0.25);
    } else {
      monster.lookTarget.lerp(wander, 0.05);
    }

    // ---- Caricias, curiosidad y mareo ----
    pointerSpeed *= Math.exp(-dt * 6);
    const hovering = pointerInside && !dragging && monster.hitTest(raycaster.ray);
    if (hovering) {
      hoverTime += dt;
      if (sleeping && pointerSpeed > 400) {
        wakeUp(true);
      } else if (!sleeping) {
        if (pointerSpeed > 60 && pointerSpeed < 1500) pet += dt;
        if (hoverTime > 0.5) setMood('curious', 0.4);
        if (pet > 1.4) {
          pet = 0;
          setMood('happy', 2.2);
          say('pet');
          sfx.giggle();
          fx.emit('💜', pointerPx.x, pointerPx.y, 2);
          monster.bump(0.15, 0.5);
          stats.happy += 0.08;
        }
      }
    } else {
      hoverTime = 0;
      pet = Math.max(0, pet - dt * 0.5);
    }

    shake = Math.max(0, shake + (pointerSpeed > 1800 ? dt : -dt * 0.6));
    if (shake > 1.6 && !sleeping) {
      shake = 0;
      if (setMood('dizzy', 3.5)) {
        say('dizzy');
        sfx.boing();
      }
    }
    monster.dizzy += ((mood === 'dizzy' ? 1 : 0) - monster.dizzy) * (1 - Math.exp(-dt * 4));
    monster.turnAway += ((time < turnAwayUntil ? 1 : 0) - monster.turnAway) * (1 - Math.exp(-dt * 5));
    monster.chewing = Math.max(0, monster.chewing - dt * 1.3);

    // ---- Comida en camino ----
    if (fx.foodInFlight > 0 && mood !== 'eating') setMood('eager', 0.3);

    // ---- Baile ----
    // Enojo, mareo, amor o que lo agarren interrumpen el baile.
    if (dragging || sleeping || (time < moodUntil && PRIORITY[mood] >= PRIORITY.love)) danceUntil = 0;
    const dancing = time < danceUntil;
    monster.danceAmount += ((dancing ? 1 : 0) - monster.danceAmount) * (1 - Math.exp(-dt * 5));
    if (dancing) {
      lastInput = time;
      setMood('happy', 0.5);
      if (time > nextDanceHop) {
        nextDanceHop = time + 0.42;
        hop(danceNote % 2 === 0 ? 1.6 : -1.6, 4.5);
        sfx.note(danceNote++);
        if (danceNote % 3 === 0) emitAtHead('🎵', 1);
      }
    }

    // ---- Sueño, energía y hambre ----
    const idle = time - lastInput;
    if (!sleeping) {
      stats.energy = Math.max(0, stats.energy - dt / 300);
      if (idle > 9 && !saidYawn) {
        saidYawn = true;
        say('yawn');
      }
      if (idle > 18 || (stats.energy < 0.12 && idle > 4)) fallAsleep();
    } else {
      stats.energy = Math.min(1, stats.energy + dt / 25);
      if (time > nextZ) {
        nextZ = time + 1.3;
        const h = headScreen();
        fx.emit(Math.random() < 0.5 ? '💤' : 'Z', h.x + 30, h.y + 50, 1, 0.3);
      }
      if (time > nextSnore) {
        nextSnore = time + 3.2;
        sfx.snore();
      }
    }

    stats.hunger = Math.min(1, stats.hunger + dt / 160);
    stats.happy += (0.5 - stats.happy) * dt * 0.01;
    stats.happy = THREE.MathUtils.clamp(stats.happy, 0, 1);
    if (stats.hunger > 0.75 && !sleeping && time > nextHungerComplaint) {
      nextHungerComplaint = time + 18;
      setMood('sad', 2);
      say('hungry');
    }
    if (stats.hunger > 0.05) overfed = 0;

    // ---- Acciones al aburrirse ----
    if (!sleeping && !dancing && mood === 'neutral' && time > nextIdleAction) {
      nextIdleAction = time + 6 + Math.random() * 5;
      idleAction();
    }

    // ---- Expira el ánimo temporal ----
    if (time >= moodUntil) {
      const b = baselineMood();
      if (b !== mood) {
        mood = b;
        moodUntil = time;
        monster.setMood(b, MOOD_COLOR[b]);
        els.moodLabel.textContent = MOOD_LABEL[b];
      }
    }

    // Se estira al volar o al ser arrastrado.
    const stretch = grounded ? 0 : Math.min(Math.abs(vel.y) * 0.012, 0.25);
    monster.update(dt, time, accel, stretch);

    fx.update(dt, mouthScreen(), headScreen(), eat);

    hudTimer -= dt;
    if (hudTimer <= 0) {
      hudTimer = 0.2;
      els.bars.happy.style.width = `${stats.happy * 100}%`;
      els.bars.hunger.style.width = `${stats.hunger * 100}%`;
      els.bars.energy.style.width = `${stats.energy * 100}%`;
    }

    renderer.render(scene, camera);
  }

  renderer.setAnimationLoop(tick);
}

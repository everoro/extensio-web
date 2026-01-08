/* "Minuts al Jardí" (popup) — 1 minut = 1 pètal
   - Nombre de pètals = minuts totals de la fase actual 
   - El pètal en curs creix amb els segons
   - Pol·len cada segon si el temporitzador corre
*/

console.log(" sketch.js carregat");

const POLLEN_PER_SECOND = 4;
const POLLEN_LIMIT = 220;
const FONT_ASSET = "assets/Questrial-Regular.ttf"; 

// No fem servir p5.sound; l'àudio es gestiona a popup.js
// const MUSIC_ASSET = null;
// const NOTIF_ASSET = null;

let uiFont, fontReady = false;
let particles = [];

let cfg = {
  width: 300,
  height: 90,
  phase: 'work',
  isRunning: false,
  remainingMs: 25 * 60 * 1000,
  workMs: 25 * 60 * 1000,
  restMs: 5 * 60 * 1000
};

let lastSecond = -1;
let petalCount = 25;       // es recalcula segons la fase

/* Helpers de fase  */

function totalMsOfPhase() {
  return (cfg.phase === 'work') ? cfg.workMs : cfg.restMs;
}
function updatePetalCount() {
  // 1 pètal per minut; limitem una mica perquè el canvas és petit
  const mins = Math.round(totalMsOfPhase() / 60000);
  petalCount = Math.max(5, Math.min(60, mins)); // 5..60 pètals
}

/*  PRELOAD  */

function preload() {
  console.log(" preload() cridat");
  if (FONT_ASSET) {
    uiFont = loadFont(
      FONT_ASSET,
      () => { fontReady = true; console.log(" Font carregada"); },
      () => { fontReady = false; console.warn(" No s'ha pogut carregar la font"); }
    );
  }
}

/*  SETUP  */

function setup() {
  console.log(" setup() de p5 executat");

  const c = createCanvas(cfg.width, cfg.height);
  const parent = document.getElementById('canvas-holder');
  c.parent(parent || document.body);
  pixelDensity(1);
  frameRate(60);
  colorMode(HSB, 360, 100, 100, 1);
  textAlign(CENTER, CENTER);
  if (fontReady) textFont(uiFont);
  noStroke();
  updatePetalCount();

  // BOTÓ DE MODE (p5 DOM) – només si tenim funcions DOM
  if (typeof select === 'function' && typeof createButton === 'function' && typeof createDiv === 'function') {
    const presetContainer = select('#presetMenu');
    if (presetContainer) {
      const presetBtn = createButton('Mode: Pomodoro 25/5 ▼');
      presetBtn.id('presetButton');

      presetBtn.style('background', '#1b1f29');
      presetBtn.style('color', 'white');
      presetBtn.style('padding', '6px 10px');
      presetBtn.style('border-radius', '6px');
      presetBtn.style('border', '1px solid #2c2f39');
      presetBtn.style('width', '100%');
      presetBtn.style('text-align', 'center');
      presetBtn.style('cursor', 'pointer');
      presetBtn.style('font-size', '12px');
      presetBtn.style('box-sizing', 'border-box');

      presetContainer.child(presetBtn);

      const menu = createDiv();
      menu.id('presetDropdown');

      menu.style('background', '#14171f');
      menu.style('border', '1px solid #2c2f39');
      menu.style('border-radius', '6px');
      menu.style('padding', '4px');
      menu.style('margin-top', '4px');
      menu.style('display', 'none');
      menu.style('box-sizing', 'border-box');

      presetContainer.child(menu);

      function addOption(label, value) {
        const opt = createButton(label);
        opt.style('width', '100%');
        opt.style('text-align', 'center');
        opt.style('padding', '5px');
        opt.style('color', 'white');
        opt.style('background', '#14171f');
        opt.style('border', 'none');
        opt.style('cursor', 'pointer');
        opt.style('font-size', '12px');
        opt.style('box-sizing', 'border-box');

        opt.mousePressed(() => {
          presetBtn.html('Mode: ' + label + ' ▼');
          menu.style('display', 'none');
          if (window.applyPresetFromValue) {
            window.applyPresetFromValue(value);
          }
        });

        menu.child(opt);
      }

      addOption("Pomodoro 25/5", "25-5");
      addOption("15 / 3", "15-3");
      addOption("5 / 1", "5-1");
      addOption("Personalitzat", "custom");

      presetBtn.mousePressed(() => {
        const current = menu.style('display');
        menu.style('display', current === 'none' ? 'block' : 'none');
      });
    }
  } else {
    console.warn(" p5 DOM no disponible; no es crearà el menú de modes.");
  }
}


/*  DRAW  */

function draw() {
  if (!fontReady) textFont('sans-serif');

  const total = totalMsOfPhase();
  // si l’usuari canvia presets/fase, ajusta pètals
  updatePetalCount();

  const left  = constrain(cfg.remainingMs, 0, total);
  const pct = total > 0 ? 1 - (left / total) : 0;

  drawBackground(pct);

  // Flor
  const cx = width * 0.40;
  const cy = height * 0.56;
  const baseR = min(width, height) * 0.22;

  const hueC = (cfg.phase === 'work') ? 32 : 120; // taronja / verd
  const satC = 70, briC = 90;

  push();
  translate(cx, cy);

  // Corona base (pètals curts per volum)
  for (let k = 0; k < petalCount; k++) {
    const ang = -HALF_PI + k * TWO_PI / petalCount;
    push();
    rotate(ang);
    drawPetal(0.10, 1.0, 0.6, baseR, hueC, satC, briC, 0.65);
    pop();
  }

  // Pètals plens (minuts complets transcorreguts)
  const done = (total - left) / 60000;           // minuts fets (amb decimals)
  const full = floor(done);                      // minuts complets
  for (let k = 0; k < min(full, petalCount); k++) {
    const ang = -HALF_PI + k * TWO_PI / petalCount;
    push();
    rotate(ang);
    drawPetal(1.0, 1.0, 0.75, baseR, hueC, satC, briC, 1.0);
    pop();
  }

  // Pètal fraccional (minut en curs) creix amb els segons
  if (full < petalCount) {
    const frac = constrain(done - full, 0, 1);   // 0..1 dins del minut
    const ang = -HALF_PI + full * TWO_PI / petalCount;
    push();
    rotate(ang);
    drawPetal(frac, 1.0, 0.7, baseR, hueC, satC, briC, 1.0);
    pop();
  }

  // Centre
  noStroke();
  fill(hueC, satC * 0.35, 100, 1);
  circle(0, 0, baseR * 1.45);
  pop();

  // Pol·len cada segon si corre
  const sNow = floor(millis() / 1000);
  if (cfg.isRunning && sNow !== lastSecond) {
    lastSecond = sNow;
    emitPollen({ x: cx, y: cy }, POLLEN_PER_SECOND);
  }
  updateAndDrawPollen();

  // HUD petit (percentatge de progrés)
  drawHUD(pct);
}

/*  Petal (reutilitzat del Jardí)  */

function drawPetal(lengthK, widthK, roundK, baseR, hueC, satC, briC, alpha = 1) {
  const L = baseR * lerp(1.4, 5.8, lengthK);
  const W = baseR * lerp(2.6, 1.4, lengthK) * widthK;
  const neck = L * 0.25;
  const tip  = L * (0.75 + 0.2 * roundK);

  fill(hueC, satC, max(0, briC - 12), alpha * 0.9);  // ombra
  petalPath(W, neck, tip, L);

  fill(hueC, satC, min(100, briC + 8), alpha * 0.9); // llum
  push();
  scale(0.97, 0.97);
  petalPath(W * 0.92, neck * 0.98, tip * 0.99, L * 0.98);
  pop();
}
function petalPath(W, neck, tip, L) {
  beginShape();
  vertex(0, 0);
  bezierVertex(-W * 0.45, -neck * 0.25, -W * 0.60, -L * 0.55, 0, -tip);
  bezierVertex( W * 0.60, -L * 0.55,  W * 0.45, -neck * 0.25, 0, 0);
  endShape(CLOSE);
}

/*  Fons (vinyeta)  */

function drawBackground(pct) {
  // Color base del fons (taronja / verd segons fase)
  const baseHue = (cfg.phase === 'work') ? 32 : 120;

  // --- CAPA 1: FONS PLE ---
  // Taronja o verd intens, sense ser transparent
  background(baseHue, 55, 65, 1);

  const vx = width * 0.5;
  const vy = height * 0.5;

  // Radi de la flor (per evitar que el cercle baixi massa)
  const baseR = min(width, height) * 0.22;

  // Radi mínim (ha de ser més gran que la flor)
  const minR = baseR * 1.7;

  // Radi màxim (tot el canvas)
  const maxR = max(width, height) * 1.25;

  // Radi que disminueix amb el temps
  const r = lerp(maxR, minR, pct);

  // --- CAPA 2: CERCLE TRANSLÚCID ---
  noStroke();
  fill(baseHue, 60, 95, 0.25);  // opacitat suau i agradable
  circle(vx, vy, r);
}


/*  Pol·len  */
function emitPollen(center, n) {
  for (let i = 0; i < n; i++) {
    const a = random(TWO_PI), spd = random(0.5, 1.4);
    particles.push({
      x: center.x + cos(a) * 2,
      y: center.y + sin(a) * 2,
      vx: cos(a) * spd + random(-0.2, 0.2),
      vy: sin(a) * spd + random(-0.2, 0.2),
      life: 1,
      size: random(1.6, 3.2)
    });
  }
  if (particles.length > POLLEN_LIMIT) {
    particles.splice(0, particles.length - POLLEN_LIMIT);
  }
}
function updateAndDrawPollen() {
  noStroke();
  fill(48, 70, 100, 0.9);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy -= 0.004;
    p.life -= 0.012;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    ellipse(p.x, p.y, p.size, p.size);
  }
}

/*  HUD  */
function drawHUD(pct) {
  const label = (cfg.phase === 'work') ? "Treball" : "Descans";
  const percent = Math.round(pct * 100);
  fill(0, 0, 100, 0.95);
  textSize(12);
  textAlign(RIGHT, TOP);
  text(`${label}`, width - 38, 6);
  textAlign(RIGHT, BOTTOM);
  text(`${percent}%`, width - 38, height - 6);
}

/*  Hooks per a popup.js  */
window.p5UpdateConfig = function (newState) {
  cfg.phase = newState.phase;
  cfg.isRunning = newState.isRunning;
  cfg.workMs = newState.workMs;
  cfg.restMs = newState.restMs;

  // sincronitzar temps restant amb l'estat inicial
  if (typeof newState.remainingMs === 'number') {
    cfg.remainingMs = newState.remainingMs;
  }

  updatePetalCount();
};

window.p5SetRemaining = function (ms) {
  cfg.remainingMs = ms;
};

/*  Hooks d'àudio — s'actualitzen des de popup.js
   (aquí només posem stubs per si es carrega sketch.js tot sol)  */
window.p5PlayMusic = function (shouldPlay) {
  // implementat realment a popup.js amb HTMLAudioElement
};

window.p5PlayNotifSound = function () {
  // implementat realment a popup.js amb HTMLAudioElement
};

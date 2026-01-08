//  Estat clau persistit 
const KEY = 'r3_timer_state_v1';

// Àudio HTML per a música de fons i so de notificació
let bgAudio = null;
let notifAudio = null;

// Fem servir storeItem()/getItem() de p5.js si existeixen.
// Si no, fem servir window.localStorage.
const HAS_P5_STORAGE = typeof getItem === 'function' && typeof storeItem === 'function';
const storage = {
  get(k) {
    try {
      if (HAS_P5_STORAGE) return getItem(k);
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.info("Cap estat anterior trobat.");
      return null;
    }
  },
  set(k, v) {
    try {
      if (HAS_P5_STORAGE) return storeItem(k, v);
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      console.warn("No s'ha pogut desar l'estat:", e);
    }
  }
};

let state = {
  phase: 'work',
  isRunning: false,
  workMs: 25 * 60 * 1000,
  restMs: 5 * 60 * 1000,
  startedAt: null,
  remainingMs: 25 * 60 * 1000,
  autoSwitch: true,
  music: true,   // música de fons (sun-garden.mp3)
  notif: true    // notificacions sonores/visuals
};

function msToMMSS(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(t / 60).toString().padStart(2, '0');
  const s = (t % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// helper per sincronitzar la música amb l'estat actual
function updateMusicPlayback() {
  if (window.p5PlayMusic) {
    window.p5PlayMusic(state.music && state.isRunning);
  }
}

function loadState() {
  try {
    const saved = storage.get(KEY);
    if (saved && typeof saved === 'object') {
      Object.assign(state, saved);
      if (state.isRunning && state.startedAt) {
        const elapsed = Date.now() - state.startedAt;
        state.remainingMs = Math.max(0, state.remainingMs - elapsed);
        state.startedAt = Date.now();
        if (state.remainingMs === 0 && state.autoSwitch) switchPhase();
      }
    }
  } catch (e) {
    console.info("Cap estat anterior trobat.");
  }
  updateMusicPlayback();
}

function saveState() {
  storage.set(KEY, state);
  updateLabels();
}

function switchPhase() {
  state.phase = state.phase === 'work' ? 'rest' : 'work';
  state.remainingMs = state.phase === 'work' ? state.workMs : state.restMs;
  state.startedAt = state.isRunning ? Date.now() : null;
  // beep lligat a "Notificació"
  if (state.notif) beep();
  saveState();
}

function start() {
  if (state.isRunning) return;
  state.isRunning = true;
  state.startedAt = Date.now();
  saveState();
  updateMusicPlayback();
}

function pause() {
  if (!state.isRunning) return;
  const elapsed = Date.now() - (state.startedAt || Date.now());
  state.remainingMs = Math.max(0, state.remainingMs - elapsed);
  state.isRunning = false;
  state.startedAt = null;
  saveState();
  updateMusicPlayback();
}

function reset() {
  state.isRunning = false;
  state.phase = 'work';
  state.remainingMs = state.workMs;
  state.startedAt = null;
  saveState();
  updateMusicPlayback();
}

//  Refs del DOM 
let customFields,
    workMin,
    restMin,
    startPauseBtn,
    resetBtn,
    musicToggle,
    notifToggle,
    phaseLabel,
    timeLabel;

function need(id) {
  const el = document.getElementById(id);
  if (!el) console.error(`[UI] Falta l'element #${id} al HTML`);
  return el;
}

// Aquesta funció la cridarà sketch.js quan esculls un mode al menú p5
window.applyPresetFromValue = function (val) {
  // Mostrar / amagar camps personalitzats
  if (val === 'custom') {
    if (customFields) customFields.classList.remove('hidden');
  } else {
    if (customFields) customFields.classList.add('hidden');
  }

  // Assignar durades segons el mode
  if (val === '25-5') {
    state.workMs = 25 * 60 * 1000;
    state.restMs = 5 * 60 * 1000;
  } else if (val === '15-3') {
    state.workMs = 15 * 60 * 1000;
    state.restMs = 3 * 60 * 1000;
  } else if (val === '5-1') {
    state.workMs = 5 * 60 * 1000;
    state.restMs = 1 * 60 * 1000;
  } else if (val === 'custom') {
    const w = Math.max(1, parseInt((workMin && workMin.value) || '20', 10));
    const r = Math.max(1, parseInt((restMin && restMin.value) || '5', 10));
    state.workMs = w * 60 * 1000;
    state.restMs = r * 60 * 1000;
  }

  // Ajustem el temps restant si el temporitzador està parat
  if (!state.isRunning) {
    state.remainingMs = (state.phase === 'work') ? state.workMs : state.restMs;
  }

  saveState();
  if (window.p5UpdateConfig) window.p5UpdateConfig(state);
};

function updateLabels() {
  if (!phaseLabel || !timeLabel || !startPauseBtn) return;
  phaseLabel.textContent = state.phase === 'work' ? 'Treball' : 'Descans';
  timeLabel.textContent  = msToMMSS(state.remainingMs);
  startPauseBtn.textContent = state.isRunning ? 'Pausa' : 'Inicia';
}

let audioCtx;
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g);
    g.connect(audioCtx.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(880, audioCtx.currentTime);
    g.gain.setValueAtTime(0.001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    o.stop(audioCtx.currentTime + 0.21);
  } catch (e) {}
}

//  Ticker 
setInterval(() => {
  if (!state.isRunning || !state.startedAt) return;

  const elapsed = Date.now() - state.startedAt;
  const left = Math.max(0, state.remainingMs - elapsed);

  // actualitza temps a la UI i p5 mentre encara queda temps
  if (left > 0) {
    if (timeLabel) timeLabel.textContent = msToMMSS(left);
    if (window.p5SetRemaining) window.p5SetRemaining(left);
    return;
  }

  // ha arribat a 0
  state.remainingMs = 0;
  pause(); // atura el comptador i guarda estat

  //  Notificació si la casella "Notificació" està activada
  if (state.notif) {
    // so de notificació (notification-sound.mp3 via HTML Audio)
    if (window.p5PlayNotifSound) {
      window.p5PlayNotifSound();
    }

    // notificació visual del navegador (si hi ha permís)
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Temporitzador", {
        body: state.phase === "work"
          ? "Has acabat el treball. Descansa!"
          : "Has acabat el descans. Tornem-hi!",
        icon: "assets/icon48.png"
      });
    }
  }

  // Canvi automàtic de fase 
  if (state.autoSwitch) {
    switchPhase();
    start();
  }

  updateLabels();
  if (window.p5UpdateConfig) window.p5UpdateConfig(state);
}, 200);


//  Init 
document.addEventListener('DOMContentLoaded', () => {
  customFields  = document.getElementById('custom-fields');
  workMin       = document.getElementById('workMin');
  restMin       = document.getElementById('restMin');
  startPauseBtn = need('startPauseBtn');
  resetBtn      = need('resetBtn');
  musicToggle   = need('musicToggle');
  notifToggle   = need('notifToggle');
  phaseLabel    = need('phaseLabel');
  timeLabel     = need('timeLabel');

  // Inicialitzar àudios HTML
  try {
    bgAudio = new Audio('assets/sun-garden.mp3');
    bgAudio.loop = true;
    bgAudio.volume = 0.4;

    notifAudio = new Audio('assets/notification-sound.mp3');
    notifAudio.volume = 0.8;
  } catch (e) {
    console.warn("No s'ha pogut inicialitzar l'àudio HTML:", e);
  }

  // Hooks d'àudio per a sketch.js i la resta del codi
  window.p5PlayMusic = function (shouldPlay) {
    if (!bgAudio) return;
    if (shouldPlay) {
      bgAudio.play().catch(err => {
        console.warn("No s'ha pogut reproduir la música (pot requerir interacció):", err);
      });
    } else {
      bgAudio.pause();
    }
  };

  window.p5PlayNotifSound = function () {
    if (!notifAudio) return;
    try {
      notifAudio.currentTime = 0;
      notifAudio.play().catch(err => {
        console.warn("No s'ha pogut reproduir el so de notificació:", err);
      });
    } catch (e) {
      console.warn("Error reproduint el so de notificació:", e);
    }
  };

  loadState();

  // Inicialitzar inputs personalitzats segons estat guardat
  if (workMin) workMin.value = Math.round(state.workMs / 60000);
  if (restMin) restMin.value = Math.round(state.restMs / 60000);

  // Si l'usuari canvia minuts - mode custom
  if (workMin) {
    workMin.addEventListener('input', () => {
      window.applyPresetFromValue('custom');
    });
  }
  if (restMin) {
    restMin.addEventListener('input', () => {
      window.applyPresetFromValue('custom');
    });
  }

  if (startPauseBtn) {
    startPauseBtn.addEventListener('click', () => {
      if (state.isRunning) {
        pause();
      } else {
        start();
      }
      updateLabels();
      if (window.p5UpdateConfig) window.p5UpdateConfig(state);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      reset();
      updateLabels();
      if (window.p5UpdateConfig) window.p5UpdateConfig(state);
    });
  }

  // Checkboxes de la UI
  if (musicToggle) {
    musicToggle.checked = state.music;
    musicToggle.addEventListener('change', () => {
      state.music = musicToggle.checked;
      saveState();
      updateMusicPlayback();
    });
  }

  if (notifToggle) {
    notifToggle.checked = state.notif;
    notifToggle.addEventListener('change', () => {
      state.notif = notifToggle.checked;
      saveState();

      if (state.notif && "Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
    });
  }

  // Botó "Restablir dades" 
  const clearBtn = document.getElementById("clearDataBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (typeof clearStorage === 'function') {
        clearStorage();    // Esborra totes les claus de p5.storeItem()
      }
      localStorage.clear(); // Per si hi ha altres dades
      location.reload();    // Reinicia el popup
    });
  }

  updateLabels();
  if (window.p5UpdateConfig) window.p5UpdateConfig(state);
  updateMusicPlayback();
});

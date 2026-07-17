// -----------------------------------------------------
// MINUTS AL JARDÍ
// Mode dual: extensió Firefox + demo web
// -----------------------------------------------------

const WEB_STORAGE_KEY = 'minuts_al_jardi_web_v1';

const extensionAPI =
  globalThis.browser ??
  globalThis.chrome ??
  null;

const isExtensionEnvironment = Boolean(
  extensionAPI?.runtime?.sendMessage
);

const DEFAULT_STATE = {
  phase: 'work',
  isRunning: false,

  workMs: 25 * 60 * 1000,
  restMs: 5 * 60 * 1000,

  remainingMs: 25 * 60 * 1000,
  endsAt: null,

  autoSwitch: true,
  music: true,
  notif: true,

  completedWorkSessions: 0
};

let timerState = null;
let webTicker = null;

let customFields;
let workMin;
let restMin;

let startPauseBtn;
let resetBtn;
let skipBtn;

let musicToggle;
let notifToggle;

let phaseLabel;
let timeLabel;

// -----------------------------------------------------
// HELPERS
// -----------------------------------------------------

function getElement(id) {
  return document.getElementById(id);
}

function cloneDefaultState() {
  return {
    ...DEFAULT_STATE
  };
}

function clamp(value, min, max) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

function msToMMSS(milliseconds) {
  const totalSeconds = Math.max(
    0,
    Math.ceil(milliseconds / 1000)
  );

  const minutes = Math.floor(
    totalSeconds / 60
  )
    .toString()
    .padStart(2, '0');

  const seconds = (
    totalSeconds % 60
  )
    .toString()
    .padStart(2, '0');

  return `${minutes}:${seconds}`;
}

function getPhaseDuration() {
  if (!timerState) {
    return DEFAULT_STATE.workMs;
  }

  return timerState.phase === 'work'
    ? timerState.workMs
    : timerState.restMs;
}

function getRemainingMs() {
  if (!timerState) return 0;

  if (
    timerState.isRunning &&
    Number.isFinite(timerState.endsAt)
  ) {
    return Math.max(
      0,
      timerState.endsAt - Date.now()
    );
  }

  return Math.max(
    0,
    timerState.remainingMs
  );
}

function normalizeState(saved = {}) {
  const state = {
    ...cloneDefaultState(),
    ...saved
  };

  state.phase =
    state.phase === 'rest'
      ? 'rest'
      : 'work';

  state.workMs = clamp(
    Number(state.workMs) ||
      DEFAULT_STATE.workMs,
    60 * 1000,
    180 * 60 * 1000
  );

  state.restMs = clamp(
    Number(state.restMs) ||
      DEFAULT_STATE.restMs,
    60 * 1000,
    60 * 60 * 1000
  );

  state.remainingMs = Math.max(
    0,
    Number(state.remainingMs) ||
      (
        state.phase === 'work'
          ? state.workMs
          : state.restMs
      )
  );

  state.endsAt =
    Number.isFinite(state.endsAt)
      ? state.endsAt
      : null;

  state.isRunning =
    Boolean(state.isRunning) &&
    Number.isFinite(state.endsAt);

  state.music =
    state.music !== false;

  state.notif =
    state.notif !== false;

  state.autoSwitch =
    state.autoSwitch !== false;

  state.completedWorkSessions =
    Math.max(
      0,
      Number.parseInt(
        state.completedWorkSessions,
        10
      ) || 0
    );

  return state;
}

// -----------------------------------------------------
// COMUNICACIÓ AMB L’EXTENSIÓ
// -----------------------------------------------------

async function sendExtensionMessage(
  type,
  data = {}
) {
  try {
    const response =
      await extensionAPI.runtime.sendMessage({
        type,
        ...data
      });

    if (response?.state) {
      timerState =
        normalizeState(response.state);

      renderAll();
    }

    return response;
  } catch (error) {
    console.error(
      'Error comunicant amb el background:',
      error
    );

    return null;
  }
}

// -----------------------------------------------------
// MODE WEB
// -----------------------------------------------------

function loadWebState() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(
        WEB_STORAGE_KEY
      ) || '{}'
    );

    timerState =
      normalizeState(saved);

    restoreExpiredWebTimer();
  } catch (error) {
    console.warn(
      'No s’ha pogut carregar el temporitzador web.',
      error
    );

    timerState =
      cloneDefaultState();
  }
}

function saveWebState() {
  if (!timerState) return;

  timerState.remainingMs =
    getRemainingMs();

  try {
    localStorage.setItem(
      WEB_STORAGE_KEY,
      JSON.stringify(timerState)
    );
  } catch (error) {
    console.warn(
      'No s’ha pogut desar el temporitzador web.',
      error
    );
  }
}

function startWebTimer() {
  if (timerState.isRunning) return;

  if (timerState.remainingMs <= 0) {
    timerState.remainingMs =
      getPhaseDuration();
  }

  timerState.isRunning = true;

  timerState.endsAt =
    Date.now() +
    timerState.remainingMs;

  saveWebState();
  renderAll();
}

function pauseWebTimer() {
  if (!timerState.isRunning) return;

  timerState.remainingMs =
    getRemainingMs();

  timerState.isRunning = false;
  timerState.endsAt = null;

  saveWebState();
  renderAll();
}

function resetWebTimer() {
  timerState.phase = 'work';
  timerState.isRunning = false;

  timerState.remainingMs =
    timerState.workMs;

  timerState.endsAt = null;

  saveWebState();
  renderAll();
}

function skipWebPhase() {
  const continueRunning =
    timerState.isRunning;

  switchWebPhase({
    continueRunning,
    notify: false
  });
}

function finishWebPhase() {
  const finishedPhase =
    timerState.phase;

  if (finishedPhase === 'work') {
    timerState.completedWorkSessions += 1;
  }

  playCompletionFeedback(
    finishedPhase
  );

  switchWebPhase({
    continueRunning:
      timerState.autoSwitch,
    notify: false
  });
}

function switchWebPhase({
  continueRunning = false,
  notify = false
} = {}) {
  const previousPhase =
    timerState.phase;

  timerState.phase =
    previousPhase === 'work'
      ? 'rest'
      : 'work';

  timerState.remainingMs =
    getPhaseDuration();

  timerState.isRunning =
    continueRunning;

  timerState.endsAt =
    continueRunning
      ? Date.now() +
        timerState.remainingMs
      : null;

  if (notify) {
    playCompletionFeedback(
      previousPhase
    );
  }

  saveWebState();
  renderAll();
}

function restoreExpiredWebTimer() {
  if (
    !timerState.isRunning ||
    !Number.isFinite(
      timerState.endsAt
    )
  ) {
    return;
  }

  const remaining =
    timerState.endsAt -
    Date.now();

  if (remaining > 0) {
    timerState.remainingMs =
      remaining;

    return;
  }

  timerState.isRunning = false;
  timerState.endsAt = null;
  timerState.remainingMs = 0;

  const finishedPhase =
    timerState.phase;

  if (finishedPhase === 'work') {
    timerState.completedWorkSessions += 1;
  }

  timerState.phase =
    finishedPhase === 'work'
      ? 'rest'
      : 'work';

  timerState.remainingMs =
    getPhaseDuration();

  timerState.isRunning = false;
  timerState.endsAt = null;

  saveWebState();
}

// -----------------------------------------------------
// ACCIONS COMUNES
// -----------------------------------------------------

async function startOrPause() {
  if (isExtensionEnvironment) {
    await sendExtensionMessage(
      timerState?.isRunning
        ? 'TIMER_PAUSE'
        : 'TIMER_START'
    );

    return;
  }

  if (timerState.isRunning) {
    pauseWebTimer();
  } else {
    startWebTimer();
  }
}

async function resetTimer() {
  if (isExtensionEnvironment) {
    await sendExtensionMessage(
      'TIMER_RESET'
    );

    return;
  }

  resetWebTimer();
}

async function skipPhase() {
  if (isExtensionEnvironment) {
    await sendExtensionMessage(
      'TIMER_SKIP'
    );

    return;
  }

  skipWebPhase();
}

async function applyDurations(
  workMinutes,
  restMinutes
) {
  const workMs =
    workMinutes * 60 * 1000;

  const restMs =
    restMinutes * 60 * 1000;

  if (isExtensionEnvironment) {
    await sendExtensionMessage(
      'TIMER_APPLY_DURATIONS',
      {
        workMs,
        restMs
      }
    );

    return;
  }

  timerState.workMs = workMs;
  timerState.restMs = restMs;

  if (!timerState.isRunning) {
    timerState.remainingMs =
      getPhaseDuration();

    timerState.endsAt = null;
  }

  saveWebState();
  renderAll();
}

async function updateSettings(
  settings
) {
  if (isExtensionEnvironment) {
    await sendExtensionMessage(
      'TIMER_UPDATE_SETTINGS',
      {
        settings
      }
    );

    return;
  }

  timerState = {
    ...timerState,
    ...settings
  };

  saveWebState();
  renderAll();
}

async function clearAppData() {
  const confirmed =
    window.confirm(
      'Vols eliminar les preferències i restablir el temporitzador?'
    );

  if (!confirmed) return;

  if (isExtensionEnvironment) {
    await sendExtensionMessage(
      'TIMER_CLEAR_DATA'
    );

    location.reload();
    return;
  }

  localStorage.removeItem(
    WEB_STORAGE_KEY
  );

  timerState =
    cloneDefaultState();

  renderAll();
}

// -----------------------------------------------------
// PRESETS
// -----------------------------------------------------

window.applyPresetFromValue =
  async function applyPresetFromValue(
    value
  ) {
    if (!timerState) return;

    if (value === 'custom') {
      customFields?.classList.remove(
        'hidden'
      );
    } else {
      customFields?.classList.add(
        'hidden'
      );
    }

    let workMinutes = 25;
    let restMinutes = 5;

    if (value === '15-3') {
      workMinutes = 15;
      restMinutes = 3;
    }

    if (value === '5-1') {
      workMinutes = 5;
      restMinutes = 1;
    }

    if (value === 'custom') {
      workMinutes = clamp(
        Number.parseInt(
          workMin?.value || '20',
          10
        ),
        1,
        180
      );

      restMinutes = clamp(
        Number.parseInt(
          restMin?.value || '5',
          10
        ),
        1,
        60
      );
    }

    if (workMin) {
      workMin.value =
        workMinutes;
    }

    if (restMin) {
      restMin.value =
        restMinutes;
    }

    await applyDurations(
      workMinutes,
      restMinutes
    );
  };

// -----------------------------------------------------
// NOTIFICACIONS I SO
// -----------------------------------------------------

async function requestWebNotificationPermission() {
  if (
    isExtensionEnvironment ||
    !('Notification' in window)
  ) {
    return;
  }

  if (
    Notification.permission ===
    'default'
  ) {
    try {
      await Notification
        .requestPermission();
    } catch (error) {
      console.warn(
        'No s’ha pogut demanar permís de notificació.',
        error
      );
    }
  }
}

function playCompletionFeedback(
  finishedPhase
) {
  if (
    typeof window.p5PlayNotifSound ===
    'function'
  ) {
    window.p5PlayNotifSound();
  }

  if (
    !timerState.notif ||
    isExtensionEnvironment ||
    !('Notification' in window) ||
    Notification.permission !==
      'granted'
  ) {
    return;
  }

  const finishedWork =
    finishedPhase === 'work';

  new Notification(
    'Minuts al Jardí',
    {
      body: finishedWork
        ? 'Has acabat la sessió de treball. És hora de descansar.'
        : 'Has acabat el descans. Tornem-hi!',

      icon: './assets/icon48.png'
    }
  );
}

// -----------------------------------------------------
// INTERFÍCIE I P5
// -----------------------------------------------------

function updateInterface() {
  if (!timerState) return;

  const remaining =
    getRemainingMs();

  if (phaseLabel) {
    phaseLabel.textContent =
      timerState.phase === 'work'
        ? 'Treball'
        : 'Descans';
  }

  if (timeLabel) {
    timeLabel.textContent =
      msToMMSS(remaining);
  }

  if (startPauseBtn) {
    startPauseBtn.textContent =
      timerState.isRunning
        ? 'Pausa'
        : 'Inicia';

    startPauseBtn.setAttribute(
      'aria-label',
      timerState.isRunning
        ? 'Pausar el temporitzador'
        : 'Iniciar el temporitzador'
    );
  }

  if (musicToggle) {
    musicToggle.checked =
      timerState.music;
  }

  if (notifToggle) {
    notifToggle.checked =
      timerState.notif;
  }

  document.body.dataset.phase =
    timerState.phase;

  document.body.dataset.environment =
    isExtensionEnvironment
      ? 'extension'
      : 'web';
}

function syncP5() {
  if (
    !timerState ||
    typeof window.p5UpdateConfig !==
      'function'
  ) {
    return;
  }

  window.p5UpdateConfig({
    ...timerState,
    remainingMs:
      getRemainingMs()
  });
}

function updateMusicPlayback() {
  if (
    !timerState ||
    typeof window.p5PlayMusic !==
      'function'
  ) {
    return;
  }

  window.p5PlayMusic(
    timerState.music &&
    timerState.isRunning
  );
}

function renderAll() {
  updateInterface();
  syncP5();
  updateMusicPlayback();
}

// -----------------------------------------------------
// MISSATGES DEL BACKGROUND
// -----------------------------------------------------

if (
  isExtensionEnvironment &&
  extensionAPI?.runtime?.onMessage
) {
  extensionAPI.runtime.onMessage.addListener(
    (message) => {
      if (
        message?.type ===
          'TIMER_STATE_UPDATED' &&
        message.state
      ) {
        timerState =
          normalizeState(
            message.state
          );

        renderAll();
      }

      if (
        message?.type ===
          'TIMER_PHASE_FINISHED' &&
        message.state
      ) {
        timerState =
          normalizeState(
            message.state
          );

        if (
          typeof window
            .p5PlayNotifSound ===
            'function'
        ) {
          window.p5PlayNotifSound();
        }

        renderAll();
      }
    }
  );
}

// -----------------------------------------------------
// ACTUALITZACIÓ VISUAL
// -----------------------------------------------------

function startVisualTicker() {
  clearInterval(webTicker);

  webTicker = setInterval(() => {
    if (!timerState) return;

    const remaining =
      getRemainingMs();

    if (
      !isExtensionEnvironment &&
      timerState.isRunning &&
      remaining <= 0
    ) {
      finishWebPhase();
      return;
    }

    if (timeLabel) {
      timeLabel.textContent =
        msToMMSS(remaining);
    }

    if (
      typeof window.p5SetRemaining ===
        'function'
    ) {
      window.p5SetRemaining(
        remaining
      );
    }

    if (
      !isExtensionEnvironment &&
      timerState.isRunning
    ) {
      timerState.remainingMs =
        remaining;

      saveWebState();
    }
  }, 250);
}

// -----------------------------------------------------
// INICIALITZACIÓ
// -----------------------------------------------------

document.addEventListener(
  'DOMContentLoaded',
  async () => {
    customFields =
      getElement('custom-fields');

    workMin =
      getElement('workMin');

    restMin =
      getElement('restMin');

    startPauseBtn =
      getElement('startPauseBtn');

    resetBtn =
      getElement('resetBtn');

    skipBtn =
      getElement('skipBtn');

    musicToggle =
      getElement('musicToggle');

    notifToggle =
      getElement('notifToggle');

    phaseLabel =
      getElement('phaseLabel');

    timeLabel =
      getElement('timeLabel');

    startPauseBtn?.addEventListener(
      'click',
      startOrPause
    );

    resetBtn?.addEventListener(
      'click',
      resetTimer
    );

    skipBtn?.addEventListener(
      'click',
      skipPhase
    );

    musicToggle?.addEventListener(
      'change',
      async () => {
        await updateSettings({
          music:
            musicToggle.checked
        });
      }
    );

    notifToggle?.addEventListener(
      'change',
      async () => {
        await updateSettings({
          notif:
            notifToggle.checked
        });

        if (notifToggle.checked) {
          await requestWebNotificationPermission();
        }
      }
    );

    workMin?.addEventListener(
      'change',
      () => {
        window.applyPresetFromValue(
          'custom'
        );
      }
    );

    restMin?.addEventListener(
      'change',
      () => {
        window.applyPresetFromValue(
          'custom'
        );
      }
    );

    getElement(
      'clearDataBtn'
    )?.addEventListener(
      'click',
      clearAppData
    );

    if (isExtensionEnvironment) {
      const response =
        await sendExtensionMessage(
          'TIMER_GET_STATE'
        );

      if (!response?.state) {
        timerState =
          cloneDefaultState();
      }
    } else {
      loadWebState();
    }

    if (workMin && timerState) {
      workMin.value =
        Math.round(
          timerState.workMs /
          60000
        );
    }

    if (restMin && timerState) {
      restMin.value =
        Math.round(
          timerState.restMs /
          60000
        );
    }

    renderAll();
    startVisualTicker();
  }
);

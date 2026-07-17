// -----------------------------------------------------
// MINUTS AL JARDÍ
// Temporitzador persistent en segon pla
// -----------------------------------------------------

const STORAGE_KEY = 'minuts_al_jardi_timer_v3';
const ALARM_NAME = 'minuts_al_jardi_phase_end';

const DEFAULT_WORK_MS = 25 * 60 * 1000;
const DEFAULT_REST_MS = 5 * 60 * 1000;

const DEFAULT_STATE = {
  phase: 'work',
  isRunning: false,

  workMs: DEFAULT_WORK_MS,
  restMs: DEFAULT_REST_MS,

  remainingMs: DEFAULT_WORK_MS,
  endsAt: null,

  autoSwitch: true,
  music: true,
  notif: true,

  completedWorkSessions: 0
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createDefaultState() {
  return { ...DEFAULT_STATE };
}

function getPhaseDuration(state) {
  return state.phase === 'work'
    ? state.workMs
    : state.restMs;
}

function normalizeState(saved) {
  const state = {
    ...createDefaultState(),
    ...(saved || {})
  };

  state.phase =
    state.phase === 'rest'
      ? 'rest'
      : 'work';

  state.workMs = clamp(
    Number(state.workMs) || DEFAULT_WORK_MS,
    60 * 1000,
    180 * 60 * 1000
  );

  state.restMs = clamp(
    Number(state.restMs) || DEFAULT_REST_MS,
    60 * 1000,
    60 * 60 * 1000
  );

  state.remainingMs = Math.max(
    0,
    Number(state.remainingMs) ||
      getPhaseDuration(state)
  );

  state.endsAt =
    Number.isFinite(state.endsAt)
      ? state.endsAt
      : null;

  state.isRunning =
    Boolean(state.isRunning) &&
    Number.isFinite(state.endsAt);

  state.autoSwitch =
    state.autoSwitch !== false;

  state.music =
    state.music !== false;

  state.notif =
    state.notif !== false;

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

async function getState() {
  const stored =
    await browser.storage.local.get(
      STORAGE_KEY
    );

  return normalizeState(
    stored[STORAGE_KEY]
  );
}

async function saveState(state) {
  const normalized =
    normalizeState(state);

  await browser.storage.local.set({
    [STORAGE_KEY]: normalized
  });

  return normalized;
}

function getRemainingMs(state) {
  if (
    state.isRunning &&
    Number.isFinite(state.endsAt)
  ) {
    return Math.max(
      0,
      state.endsAt - Date.now()
    );
  }

  return Math.max(
    0,
    state.remainingMs
  );
}

async function clearTimerAlarm() {
  await browser.alarms.clear(
    ALARM_NAME
  );
}

async function scheduleTimerAlarm(state) {
  await clearTimerAlarm();

  if (
    state.isRunning &&
    Number.isFinite(state.endsAt)
  ) {
    browser.alarms.create(
      ALARM_NAME,
      {
        when: state.endsAt
      }
    );
  }
}

async function broadcastState(state) {
  try {
    await browser.runtime.sendMessage({
      type: 'TIMER_STATE_UPDATED',
      state
    });
  } catch {
    // El popup pot estar tancat.
  }
}

async function broadcastPhaseFinished(state) {
  try {
    await browser.runtime.sendMessage({
      type: 'TIMER_PHASE_FINISHED',
      state
    });
  } catch {
    // El popup pot estar tancat.
  }
}

async function commitState(state) {
  const saved = await saveState(state);

  await scheduleTimerAlarm(saved);
  await broadcastState(saved);

  return saved;
}

// -----------------------------------------------------
// NOTIFICACIONS
// -----------------------------------------------------

async function showPhaseNotification(
  finishedPhase,
  state
) {
  if (!state.notif) return;

  const finishedWork =
    finishedPhase === 'work';

  await browser.notifications.create({
    type: 'basic',
    iconUrl: browser.runtime.getURL(
      'assets/icon48.png'
    ),
    title: 'Minuts al Jardí',
    message: finishedWork
      ? 'Has acabat la sessió de treball. És hora de descansar.'
      : 'Has acabat el descans. Tornem a concentrar-nos!'
  });
}

// -----------------------------------------------------
// CANVI DE FASE
// -----------------------------------------------------

async function finishPhase(
  state,
  {
    notify = true,
    continueRunning = true
  } = {}
) {
  const finishedPhase = state.phase;

  if (finishedPhase === 'work') {
    state.completedWorkSessions += 1;
  }

  if (notify) {
    await showPhaseNotification(
      finishedPhase,
      state
    );
  }

  state.phase =
    finishedPhase === 'work'
      ? 'rest'
      : 'work';

  state.remainingMs =
    getPhaseDuration(state);

  state.isRunning =
    continueRunning &&
    state.autoSwitch;

  state.endsAt =
    state.isRunning
      ? Date.now() +
        state.remainingMs
      : null;

  const saved =
    await commitState(state);

  await broadcastPhaseFinished(saved);

  return saved;
}

// -----------------------------------------------------
// ACCIONS
// -----------------------------------------------------

async function startTimer(state) {
  if (state.isRunning) {
    return state;
  }

  if (state.remainingMs <= 0) {
    state.remainingMs =
      getPhaseDuration(state);
  }

  state.isRunning = true;

  state.endsAt =
    Date.now() +
    state.remainingMs;

  return commitState(state);
}

async function pauseTimer(state) {
  state.remainingMs =
    getRemainingMs(state);

  state.isRunning = false;
  state.endsAt = null;

  return commitState(state);
}

async function resetTimer(state) {
  state.phase = 'work';
  state.isRunning = false;

  state.remainingMs =
    state.workMs;

  state.endsAt = null;

  return commitState(state);
}

async function skipPhase(state) {
  state.isRunning = false;
  state.endsAt = null;

  return finishPhase(state, {
    notify: false,
    continueRunning: false
  });
}

async function applyDurations(
  state,
  message
) {
  state.workMs = clamp(
    Number(message.workMs),
    60 * 1000,
    180 * 60 * 1000
  );

  state.restMs = clamp(
    Number(message.restMs),
    60 * 1000,
    60 * 60 * 1000
  );

  if (!state.isRunning) {
    state.remainingMs =
      getPhaseDuration(state);
  }

  return commitState(state);
}

async function updateSettings(
  state,
  settings
) {
  if (
    typeof settings.music ===
    'boolean'
  ) {
    state.music =
      settings.music;
  }

  if (
    typeof settings.notif ===
    'boolean'
  ) {
    state.notif =
      settings.notif;
  }

  if (
    typeof settings.autoSwitch ===
    'boolean'
  ) {
    state.autoSwitch =
      settings.autoSwitch;
  }

  return commitState(state);
}

// -----------------------------------------------------
// MISSATGES DEL POPUP
// -----------------------------------------------------

browser.runtime.onMessage.addListener(
  async (message) => {
    if (!message?.type) return;

    let state = await getState();

    switch (message.type) {
      case 'TIMER_GET_STATE':
        return {
          ok: true,
          state
        };

      case 'TIMER_START':
        state =
          await startTimer(state);
        break;

      case 'TIMER_PAUSE':
        state =
          await pauseTimer(state);
        break;

      case 'TIMER_RESET':
        state =
          await resetTimer(state);
        break;

      case 'TIMER_SKIP':
        state =
          await skipPhase(state);
        break;

      case 'TIMER_APPLY_DURATIONS':
        state =
          await applyDurations(
            state,
            message
          );
        break;

      case 'TIMER_UPDATE_SETTINGS':
        state =
          await updateSettings(
            state,
            message.settings || {}
          );
        break;

      case 'TIMER_CLEAR_DATA':
        await clearTimerAlarm();

        await browser.storage.local.remove(
          STORAGE_KEY
        );

        state = createDefaultState();

        await saveState(state);
        await broadcastState(state);
        break;

      default:
        return;
    }

    return {
      ok: true,
      state
    };
  }
);

// -----------------------------------------------------
// ALARMA DE FINAL DE FASE
// -----------------------------------------------------

browser.alarms.onAlarm.addListener(
  async (alarm) => {
    if (alarm.name !== ALARM_NAME) {
      return;
    }

    const state = await getState();

    if (!state.isRunning) return;

    state.remainingMs = 0;
    state.isRunning = false;
    state.endsAt = null;

    await finishPhase(state, {
      notify: true,
      continueRunning: true
    });
  }
);

// -----------------------------------------------------
// RESTAURAR AL INICIAR FIREFOX
// -----------------------------------------------------

async function restoreTimer() {
  let state = await getState();

  if (
    state.isRunning &&
    Number.isFinite(state.endsAt)
  ) {
    if (state.endsAt <= Date.now()) {
      state.remainingMs = 0;
      state.isRunning = false;
      state.endsAt = null;

      state = await finishPhase(state, {
        notify: false,
        continueRunning: false
      });
    } else {
      state.remainingMs =
        getRemainingMs(state);

      await scheduleTimerAlarm(state);
      await saveState(state);
    }
  }
}

browser.runtime.onStartup.addListener(
  restoreTimer
);

browser.runtime.onInstalled.addListener(
  restoreTimer
);

restoreTimer().catch((error) => {
  console.error(
    'No s’ha pogut restaurar el temporitzador:',
    error
  );
});

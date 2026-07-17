// -----------------------------------------------------
// MINUTS AL JARDÍ
// Interfície del popup
// -----------------------------------------------------

let timerState = null;

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

function getElement(id) {
  return document.getElementById(id);
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

async function sendTimerMessage(
  type,
  data = {}
) {
  try {
    const response =
      await browser.runtime.sendMessage({
        type,
        ...data
      });

    if (response?.state) {
      timerState = response.state;
      updateInterface();
      syncP5();
      updateMusicPlayback();
    }

    return response;
  } catch (error) {
    console.error(
      'Error comunicant amb el temporitzador:',
      error
    );

    return null;
  }
}

async function loadTimerState() {
  await sendTimerMessage(
    'TIMER_GET_STATE'
  );
}

function updateInterface() {
  if (!timerState) return;

  const remaining =
    getRemainingMs();

  phaseLabel.textContent =
    timerState.phase === 'work'
      ? 'Treball'
      : 'Descans';

  timeLabel.textContent =
    msToMMSS(remaining);

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

  musicToggle.checked =
    timerState.music;

  notifToggle.checked =
    timerState.notif;

  document.body.dataset.phase =
    timerState.phase;
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
    remainingMs: getRemainingMs()
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

// -----------------------------------------------------
// PRESETS
// -----------------------------------------------------

window.applyPresetFromValue =
  async function (value) {
    if (!timerState) return;

    if (value === 'custom') {
      customFields.classList.remove(
        'hidden'
      );
    } else {
      customFields.classList.add(
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
      workMinutes = Math.max(
        1,
        Math.min(
          180,
          Number.parseInt(
            workMin.value || '20',
            10
          )
        )
      );

      restMinutes = Math.max(
        1,
        Math.min(
          60,
          Number.parseInt(
            restMin.value || '5',
            10
          )
        )
      );
    }

    workMin.value = workMinutes;
    restMin.value = restMinutes;

    await sendTimerMessage(
      'TIMER_APPLY_DURATIONS',
      {
        workMs:
          workMinutes * 60 * 1000,

        restMs:
          restMinutes * 60 * 1000
      }
    );
  };

// -----------------------------------------------------
// EVENTOS DEL BACKGROUND
// -----------------------------------------------------

browser.runtime.onMessage.addListener(
  (message) => {
    if (
      message.type ===
        'TIMER_STATE_UPDATED' &&
      message.state
    ) {
      timerState = message.state;

      updateInterface();
      syncP5();
      updateMusicPlayback();
    }

    if (
      message.type ===
        'TIMER_PHASE_FINISHED' &&
      message.state
    ) {
      timerState = message.state;

      if (
        typeof window
          .p5PlayNotifSound ===
        'function'
      ) {
        window.p5PlayNotifSound();
      }

      updateInterface();
      syncP5();
      updateMusicPlayback();
    }
  }
);

// -----------------------------------------------------
// ACTUALIZACIÓN VISUAL
// -----------------------------------------------------

setInterval(() => {
  if (!timerState) return;

  timeLabel.textContent =
    msToMMSS(getRemainingMs());

  if (
    typeof window.p5SetRemaining ===
    'function'
  ) {
    window.p5SetRemaining(
      getRemainingMs()
    );
  }
}, 250);

// -----------------------------------------------------
// INICIALIZACIÓN
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

    startPauseBtn.addEventListener(
      'click',
      async () => {
        if (timerState?.isRunning) {
          await sendTimerMessage(
            'TIMER_PAUSE'
          );
        } else {
          await sendTimerMessage(
            'TIMER_START'
          );
        }
      }
    );

    resetBtn.addEventListener(
      'click',
      async () => {
        await sendTimerMessage(
          'TIMER_RESET'
        );
      }
    );

    skipBtn?.addEventListener(
      'click',
      async () => {
        await sendTimerMessage(
          'TIMER_SKIP'
        );
      }
    );

    musicToggle.addEventListener(
      'change',
      async () => {
        await sendTimerMessage(
          'TIMER_UPDATE_SETTINGS',
          {
            settings: {
              music:
                musicToggle.checked
            }
          }
        );
      }
    );

    notifToggle.addEventListener(
      'change',
      async () => {
        await sendTimerMessage(
          'TIMER_UPDATE_SETTINGS',
          {
            settings: {
              notif:
                notifToggle.checked
            }
          }
        );
      }
    );

    workMin.addEventListener(
      'change',
      () => {
        window.applyPresetFromValue(
          'custom'
        );
      }
    );

    restMin.addEventListener(
      'change',
      () => {
        window.applyPresetFromValue(
          'custom'
        );
      }
    );

    getElement(
      'clearDataBtn'
    ).addEventListener(
      'click',
      async () => {
        const confirmed =
          window.confirm(
            'Vols eliminar les preferències i restablir el temporitzador?'
          );

        if (!confirmed) return;

        await sendTimerMessage(
          'TIMER_CLEAR_DATA'
        );

        location.reload();
      }
    );

    await loadTimerState();

    if (timerState) {
      workMin.value = Math.round(
        timerState.workMs / 60000
      );

      restMin.value = Math.round(
        timerState.restMs / 60000
      );
    }
  }
);

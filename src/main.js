// ==========================================================================
// VR Controller Studio - Firebase Realtime Database Engine
// ==========================================================================

const RTDB_BASE = 'https://easy-ise-default-rtdb.firebaseio.com';

// State Management
const state = {
  vendorControl: {
    yes: 'no',
    choice: ''
  },
  alphabetControl: {
    currentLetter: ''
  },
  soundEnabled: true,
  autoResetEnabled: false,
  autoResetTimer: null,
  latency: null,
  isOnline: true,
  rawDb: null
};

// ==========================================================================
// Web Audio Synthesizer (Zero-dependency Tactile Sound FX)
// ==========================================================================
class SoundFX {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playClick(freq = 600, duration = 0.04) {
    if (!state.soundEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, this.ctx.currentTime + duration);

      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  playSuccess() {
    if (!state.soundEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.05);

        gain.gain.setValueAtTime(0.18, this.ctx.currentTime + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.05 + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + idx * 0.05);
        osc.stop(this.ctx.currentTime + idx * 0.05 + 0.25);
      });
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  playReset() {
    if (!state.soundEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, this.ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }
}

const sfx = new SoundFX();

// ==========================================================================
// DOM Elements Selection
// ==========================================================================
const currentYesDisplay = document.getElementById('current-yes-display');
const currentLetterDisplay = document.getElementById('current-letter-display');
const vendorStateBadge = document.getElementById('vendor-state-badge');
const latencyTag = document.getElementById('latency-tag');
const connectionIndicator = document.getElementById('connection-indicator');
const statusDot = connectionIndicator.querySelector('.status-indicator-dot');
const jsonVendorYes = document.getElementById('json-vendor-yes');
const jsonVendorChoice = document.getElementById('json-vendor-choice');
const jsonAlphabetLetter = document.getElementById('json-alphabet-letter');
const fullRawJson = document.getElementById('full-raw-json');
const lastSyncTime = document.getElementById('last-sync-time');
const activityLogList = document.getElementById('activity-log-list');
const toastContainer = document.getElementById('toast-container');
const autoResetChk = document.getElementById('auto-reset-chk');
const soundToggleBtn = document.getElementById('sound-toggle-btn');
const soundIcon = document.getElementById('sound-icon');

// Buttons
const btnYes = document.getElementById('btn-yes');
const btnNoReset = document.getElementById('btn-no-reset');
const btnToggleYes = document.getElementById('btn-toggle-yes');
const letterButtons = {
  A: document.getElementById('btn-a'),
  B: document.getElementById('btn-b'),
  C: document.getElementById('btn-c'),
  D: document.getElementById('btn-d')
};
const btnClearLetter = document.getElementById('btn-clear-letter');
const refreshDbBtn = document.getElementById('refresh-db-btn');
const clearLogsBtn = document.getElementById('clear-logs-btn');

// ==========================================================================
// Logging & Toast Utilities
// ==========================================================================
function addLog(msg, type = 'info') {
  const item = document.createElement('div');
  item.className = `log-item ${type}`;

  const timeStr = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  item.innerHTML = `
    <span class="log-time">${timeStr}</span>
    <span class="log-msg">${msg}</span>
  `;

  activityLogList.insertBefore(item, activityLogList.firstChild);

  // Keep max 60 log entries
  while (activityLogList.children.length > 60) {
    activityLogList.removeChild(activityLogList.lastChild);
  }
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '⚡' : '⚠️'}</span>
    <span>${message}</span>
  `;

  toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 2800);
}

// Flash UI tree row on change
function flashRow(rowId) {
  const row = document.getElementById(rowId);
  if (row) {
    row.classList.remove('pulse-change');
    void row.offsetWidth; // trigger reflow
    row.classList.add('pulse-change');
  }
}

// ==========================================================================
// UI Render Function
// ==========================================================================
function updateUI() {
  const yesVal = (state.vendorControl.yes || 'no').toLowerCase();

  // Update YES badge
  currentYesDisplay.textContent = yesVal.toUpperCase();
  currentYesDisplay.className = `state-value ${yesVal === 'yes' ? 'state-yes' : 'state-no'}`;

  // Update Letter badge
  const activeLetter = state.alphabetControl.currentLetter || state.vendorControl.choice || '';
  currentLetterDisplay.textContent = activeLetter ? `"${activeLetter}"` : 'NONE';

  // Highlight active letter button
  ['A', 'B', 'C', 'D'].forEach(letter => {
    const btn = letterButtons[letter];
    if (btn) {
      if (activeLetter === letter) {
        btn.classList.add('active-state');
      } else {
        btn.classList.remove('active-state');
      }
    }
  });

  // Update Live Tree View
  if (jsonVendorYes) {
    jsonVendorYes.textContent = `"${yesVal}"`;
    jsonVendorYes.style.color = yesVal === 'yes' ? 'var(--neon-emerald)' : 'var(--neon-danger)';
  }

  if (jsonVendorChoice) {
    const choice = state.vendorControl.choice || '-';
    jsonVendorChoice.textContent = choice ? `"${choice}"` : '""';
  }

  if (jsonAlphabetLetter) {
    jsonAlphabetLetter.textContent = `"${state.alphabetControl.currentLetter || ''}"`;
  }

  // Latency & Connection
  if (state.latency !== null) {
    latencyTag.textContent = `${state.latency} ms`;
  }

  statusDot.className = `status-indicator-dot ${state.isOnline ? 'online' : 'offline'}`;
  lastSyncTime.textContent = new Date().toLocaleTimeString([], { hour12: false });

  if (state.rawDb && fullRawJson) {
    fullRawJson.textContent = JSON.stringify(state.rawDb, null, 2);
  }
}

// ==========================================================================
// Firebase RTDB API Operations
// ==========================================================================

// Set vendorControl.yes (Target of the user's primary prompt)
async function setVendorYes(value) {
  const normalized = value.toLowerCase();
  const startTime = performance.now();

  // Optimistic UI update
  state.vendorControl.yes = normalized;
  updateUI();
  flashRow('row-vendor-yes');

  if (normalized === 'yes') {
    sfx.playSuccess();
    btnYes.classList.add('simulated-active');
    setTimeout(() => btnYes.classList.remove('simulated-active'), 300);
  } else {
    sfx.playReset();
  }

  try {
    const res = await fetch(`${RTDB_BASE}/vendorControl/yes.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized)
    });

    const elapsed = Math.round(performance.now() - startTime);
    state.latency = elapsed;

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    state.vendorControl.yes = data;
    updateUI();

    addLog(`PUT <strong>vendorControl/yes</strong> &rarr; <code>"${data}"</code> (${elapsed}ms)`, 'success');
    showToast(`vendorControl.yes changed to "${data}"`, 'success');

    // Handle auto-reset to "no" after 3s if enabled
    if (normalized === 'yes' && state.autoResetEnabled) {
      if (state.autoResetTimer) clearTimeout(state.autoResetTimer);
      state.autoResetTimer = setTimeout(() => {
        addLog('Auto-resetting vendorControl/yes back to "no"', 'info');
        setVendorYes('no');
      }, 3000);
    }
  } catch (err) {
    console.error('Failed to update vendorControl.yes:', err);
    addLog(`Error setting vendorControl/yes: ${err.message}`, 'error');
    showToast(`Failed to update Firebase: ${err.message}`, 'error');
  }
}

// Set letter selection (A, B, C, D)
async function setLetter(letter) {
  const startTime = performance.now();
  sfx.playClick(750 + ['A', 'B', 'C', 'D'].indexOf(letter) * 120, 0.08);

  // Optimistic update
  state.alphabetControl.currentLetter = letter;
  state.vendorControl.choice = letter;
  updateUI();
  flashRow('row-alphabet-current');
  flashRow('row-vendor-choice');

  try {
    // We update both alphabetControl/currentLetter and vendorControl/choice
    // so any VR controller scene listening to either path receives the event!
    const [resAlpha, resVendor] = await Promise.all([
      fetch(`${RTDB_BASE}/alphabetControl/currentLetter.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(letter)
      }),
      fetch(`${RTDB_BASE}/vendorControl.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choice: letter })
      })
    ]);

    const elapsed = Math.round(performance.now() - startTime);
    state.latency = elapsed;

    if (!resAlpha.ok) throw new Error(`HTTP ${resAlpha.status}`);

    addLog(`Selected Button <strong>[${letter}]</strong> &rarr; alphabetControl &amp; vendorControl (${elapsed}ms)`, 'success');
    showToast(`Controller Button [${letter}] Dispatched`, 'success');
    updateUI();
  } catch (err) {
    console.error('Failed to set letter:', err);
    addLog(`Error setting letter ${letter}: ${err.message}`, 'error');
    showToast(`Error: ${err.message}`, 'error');
  }
}

// Clear Letter
async function clearLetter() {
  sfx.playClick(400, 0.05);
  state.alphabetControl.currentLetter = '';
  state.vendorControl.choice = '';
  updateUI();

  try {
    await Promise.all([
      fetch(`${RTDB_BASE}/alphabetControl/currentLetter.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify('')
      }),
      fetch(`${RTDB_BASE}/vendorControl.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choice: '' })
      })
    ]);
    addLog('Cleared letter selection in Firebase', 'info');
    showToast('Selection Cleared', 'info');
  } catch (e) {
    console.error(e);
  }
}

// Fetch Full Database Snapshot
async function fetchFullDatabase() {
  const start = performance.now();
  try {
    const res = await fetch(`${RTDB_BASE}/.json`);
    const elapsed = Math.round(performance.now() - start);
    state.latency = elapsed;
    state.isOnline = true;

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    state.rawDb = data;

    if (data.vendorControl) {
      state.vendorControl.yes = data.vendorControl.yes || 'no';
      state.vendorControl.choice = data.vendorControl.choice || '';
    }
    if (data.alphabetControl) {
      state.alphabetControl.currentLetter = data.alphabetControl.currentLetter || '';
    }

    updateUI();
    return data;
  } catch (err) {
    state.isOnline = false;
    updateUI();
    console.error('Database fetch error:', err);
  }
}

// ==========================================================================
// Real-time EventSource Stream (Firebase Server-Sent Events)
// ==========================================================================
let eventSource = null;

function setupRealtimeStream() {
  if (eventSource) {
    eventSource.close();
  }

  try {
    eventSource = new EventSource(`${RTDB_BASE}/.json`);

    eventSource.addEventListener('put', (event) => {
      try {
        const payload = JSON.parse(event.data);
        const { path, data } = payload;

        // Path e.g. "/vendorControl/yes" or "/" or "/alphabetControl"
        if (path === '/vendorControl/yes') {
          if (state.vendorControl.yes !== data) {
            state.vendorControl.yes = data;
            flashRow('row-vendor-yes');
            addLog(`Real-time update: <code>vendorControl.yes = "${data}"</code>`, 'info');
          }
        } else if (path === '/vendorControl') {
          if (data && data.yes) state.vendorControl.yes = data.yes;
          if (data && data.choice !== undefined) state.vendorControl.choice = data.choice;
          flashRow('row-vendor-yes');
        } else if (path === '/alphabetControl/currentLetter') {
          if (state.alphabetControl.currentLetter !== data) {
            state.alphabetControl.currentLetter = data;
            flashRow('row-alphabet-current');
            addLog(`Real-time update: <code>alphabetControl.currentLetter = "${data}"</code>`, 'info');
          }
        } else if (path === '/' && data) {
          state.rawDb = data;
          if (data.vendorControl) {
            state.vendorControl.yes = data.vendorControl.yes || 'no';
            state.vendorControl.choice = data.vendorControl.choice || '';
          }
          if (data.alphabetControl) {
            state.alphabetControl.currentLetter = data.alphabetControl.currentLetter || '';
          }
        }

        updateUI();
      } catch (e) {
        console.error('Error handling SSE event:', e);
      }
    });

    eventSource.addEventListener('patch', (event) => {
      try {
        const payload = JSON.parse(event.data);
        const { path, data } = payload;
        if (data && data.yes) state.vendorControl.yes = data.yes;
        if (data && data.choice !== undefined) state.vendorControl.choice = data.choice;
        if (data && data.currentLetter !== undefined) state.alphabetControl.currentLetter = data.currentLetter;
        updateUI();
      } catch (e) {
        console.error('Patch error:', e);
      }
    });

    eventSource.onopen = () => {
      state.isOnline = true;
      updateUI();
      addLog('Real-time SSE Stream connected to Firebase', 'info');
    };

    eventSource.onerror = (err) => {
      // EventSource reconnects automatically
      console.warn('SSE connection warning:', err);
    };
  } catch (err) {
    console.warn('EventSource not supported or blocked:', err);
  }
}

// Fallback Heartbeat Poller (Every 4 seconds)
setInterval(async () => {
  await fetchFullDatabase();
}, 4000);

// ==========================================================================
// Event Listeners & Interactions
// ==========================================================================

// YES Button click
btnYes.addEventListener('click', () => {
  setVendorYes('yes');
});

// Reset to "no" button click
btnNoReset.addEventListener('click', () => {
  setVendorYes('no');
});

// Toggle YES / NO button click
btnToggleYes.addEventListener('click', () => {
  const current = (state.vendorControl.yes || 'no').toLowerCase();
  setVendorYes(current === 'yes' ? 'no' : 'yes');
});

// Auto-reset toggle change
autoResetChk.addEventListener('change', (e) => {
  state.autoResetEnabled = e.target.checked;
  sfx.playClick(500, 0.05);
  addLog(`Auto-reset after 3s: <strong>${state.autoResetEnabled ? 'ENABLED' : 'DISABLED'}</strong>`, 'info');
});

// Alphabet Buttons [A, B, C, D]
['A', 'B', 'C', 'D'].forEach(letter => {
  const btn = letterButtons[letter];
  if (btn) {
    btn.addEventListener('click', () => setLetter(letter));
  }
});

// Clear Letter Button
btnClearLetter.addEventListener('click', () => clearLetter());

// Force Refresh DB
refreshDbBtn.addEventListener('click', async () => {
  sfx.playClick(800, 0.04);
  refreshDbBtn.querySelector('.refresh-icon').style.transform = 'rotate(360deg)';
  await fetchFullDatabase();
  setTimeout(() => {
    refreshDbBtn.querySelector('.refresh-icon').style.transform = '';
  }, 400);
  showToast('Database Refreshed', 'info');
});

// Clear Logs
clearLogsBtn.addEventListener('click', () => {
  activityLogList.innerHTML = '';
  addLog('Logs cleared', 'info');
});

// Sound Toggle
soundToggleBtn.addEventListener('click', () => {
  state.soundEnabled = !state.soundEnabled;
  soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';
  soundToggleBtn.style.opacity = state.soundEnabled ? '1' : '0.5';
  if (state.soundEnabled) sfx.playClick(880, 0.06);
  showToast(`Audio Feedback ${state.soundEnabled ? 'Enabled' : 'Muted'}`, 'info');
});

// Keyboard Shortcuts (A, B, C, D, Y, N, Enter, Space)
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  const key = e.key.toUpperCase();
  if (['A', 'B', 'C', 'D'].includes(key)) {
    e.preventDefault();
    const btn = letterButtons[key];
    if (btn) {
      btn.classList.add('simulated-active');
      setTimeout(() => btn.classList.remove('simulated-active'), 200);
    }
    setLetter(key);
  } else if (key === 'Y' || e.key === 'Enter') {
    e.preventDefault();
    setVendorYes('yes');
  } else if (key === 'N') {
    e.preventDefault();
    setVendorYes('no');
  } else if (e.key === ' ') {
    e.preventDefault();
    // Space toggles YES/NO
    const current = (state.vendorControl.yes || 'no').toLowerCase();
    setVendorYes(current === 'yes' ? 'no' : 'yes');
  }
});

// ==========================================================================
// Initialization
// ==========================================================================
async function init() {
  addLog('Initializing VR Controller Studio...', 'info');
  await fetchFullDatabase();
  setupRealtimeStream();
  addLog('Controller ready for input commands.', 'success');
}

init();

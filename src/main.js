// ==========================================================================
// VR Controller Studio - Mobile-First Firebase Realtime Database Engine
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
// Mobile Haptics & Web Audio Synthesizer
// ==========================================================================
function triggerHaptic(duration = 25) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(duration);
    } catch (e) {
      // Haptics not allowed or supported
    }
  }
}

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
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.05 + 0.22);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + idx * 0.05);
        osc.stop(this.ctx.currentTime + idx * 0.05 + 0.22);
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
      osc.frequency.exponentialRampToValueAtTime(140, this.ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
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
const latencyTag = document.getElementById('latency-tag');
const connectionIndicator = document.getElementById('connection-indicator');
const statusDot = connectionIndicator.querySelector('.status-indicator-dot');
const jsonVendorYes = document.getElementById('json-vendor-yes');
const jsonVendorChoice = document.getElementById('json-vendor-choice');
const jsonAlphabetLetter = document.getElementById('json-alphabet-letter');
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
// Toast & Logging
// ==========================================================================
function addLog(msg, type = 'info') {
  const item = document.createElement('div');
  item.className = 'log-item text-[11px] py-0.5 flex gap-1.5 leading-snug';

  const timeStr = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  let colorClass = 'text-slate-300';
  if (type === 'success') colorClass = 'text-emerald-400';
  if (type === 'error') colorClass = 'text-rose-400';

  item.innerHTML = `
    <span class="text-slate-500 shrink-0 font-mono">[${timeStr}]</span>
    <span class="${colorClass}">${msg}</span>
  `;

  activityLogList.insertBefore(item, activityLogList.firstChild);

  while (activityLogList.children.length > 50) {
    activityLogList.removeChild(activityLogList.lastChild);
  }
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  const borderCol = type === 'success' ? 'border-emerald-500/50 text-emerald-200' : 'border-rose-500/50 text-rose-200';
  const icon = type === 'success' ? '⚡' : '⚠️';

  toast.className = `flex items-center gap-2 bg-slate-900/95 backdrop-blur-md border ${borderCol} px-3.5 py-2 rounded-xl text-xs font-medium shadow-2xl transition-all duration-300 transform translate-y-3 opacity-0 pointer-events-auto`;
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;

  toastContainer.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-3', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('translate-y-3', 'opacity-0');
    setTimeout(() => toast.remove(), 350);
  }, 2400);
}

// Flash UI tree row on change
function flashRow(rowId) {
  const row = document.getElementById(rowId);
  if (row) {
    row.classList.add('bg-cyan-500/20');
    setTimeout(() => row.classList.remove('bg-cyan-500/20'), 600);
  }
}

// ==========================================================================
// UI Render Function
// ==========================================================================
function updateUI() {
  const yesVal = (state.vendorControl.yes || 'no').toLowerCase();

  // Update YES badge
  currentYesDisplay.textContent = yesVal.toUpperCase();
  if (yesVal === 'yes') {
    currentYesDisplay.className = 'font-mono text-xl sm:text-2xl font-black tracking-tight text-emerald-400 drop-shadow-[0_0_12px_#34d399]';
  } else {
    currentYesDisplay.className = 'font-mono text-xl sm:text-2xl font-black tracking-tight text-rose-400 drop-shadow-[0_0_12px_#f43f5e]';
  }

  // Update Letter badge
  const activeLetter = state.alphabetControl.currentLetter || state.vendorControl.choice || '';
  currentLetterDisplay.textContent = activeLetter ? `"${activeLetter}"` : 'NONE';

  // Highlight active letter button
  ['A', 'B', 'C', 'D'].forEach(letter => {
    const btn = letterButtons[letter];
    if (btn) {
      if (activeLetter === letter) {
        btn.classList.add('ring-2', 'ring-white', 'scale-105');
      } else {
        btn.classList.remove('ring-2', 'ring-white', 'scale-105');
      }
    }
  });

  // Update Live Tree View
  if (jsonVendorYes) {
    jsonVendorYes.textContent = `"${yesVal}"`;
    jsonVendorYes.className = `font-bold ${yesVal === 'yes' ? 'text-emerald-400' : 'text-rose-400'}`;
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

  if (state.isOnline) {
    statusDot.className = 'status-indicator-dot w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]';
  } else {
    statusDot.className = 'status-indicator-dot w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_#f43f5e]';
  }
}

// ==========================================================================
// Firebase RTDB Operations
// ==========================================================================
async function setVendorYes(value) {
  const normalized = value.toLowerCase();
  const startTime = performance.now();

  triggerHaptic(normalized === 'yes' ? 40 : 20);

  // Optimistic UI update
  state.vendorControl.yes = normalized;
  updateUI();
  flashRow('row-vendor-yes');

  if (normalized === 'yes') {
    sfx.playSuccess();
    btnYes.classList.add('simulated-active');
    setTimeout(() => btnYes.classList.remove('simulated-active'), 250);
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

    addLog(`vendorControl/yes &rarr; <strong>"${data}"</strong> (${elapsed}ms)`, 'success');
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
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function setLetter(letter) {
  const startTime = performance.now();
  triggerHaptic(25);
  sfx.playClick(750 + ['A', 'B', 'C', 'D'].indexOf(letter) * 120, 0.06);

  // Optimistic update
  state.alphabetControl.currentLetter = letter;
  state.vendorControl.choice = letter;
  updateUI();
  flashRow('row-alphabet-current');
  flashRow('row-vendor-choice');

  try {
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

    addLog(`Selected <strong>[${letter}]</strong> &rarr; RTDB (${elapsed}ms)`, 'success');
    showToast(`Button [${letter}] Dispatched`, 'success');
    updateUI();
  } catch (err) {
    console.error('Failed to set letter:', err);
    addLog(`Error setting letter ${letter}: ${err.message}`, 'error');
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function clearLetter() {
  triggerHaptic(20);
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
    addLog('Cleared letter selection', 'info');
    showToast('Selection Cleared', 'info');
  } catch (e) {
    console.error(e);
  }
}

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
// Real-time EventSource Stream (SSE)
// ==========================================================================
let eventSource = null;

function setupRealtimeStream() {
  if (eventSource) eventSource.close();

  try {
    eventSource = new EventSource(`${RTDB_BASE}/.json`);

    eventSource.addEventListener('put', (event) => {
      try {
        const payload = JSON.parse(event.data);
        const { path, data } = payload;

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
        console.error('SSE Error:', e);
      }
    });

    eventSource.onopen = () => {
      state.isOnline = true;
      updateUI();
      addLog('Real-time SSE Stream connected', 'info');
    };
  } catch (err) {
    console.warn('EventSource warning:', err);
  }
}

// Polling fallback
setInterval(fetchFullDatabase, 4000);

// ==========================================================================
// Event Listeners
// ==========================================================================
btnYes.addEventListener('click', () => setVendorYes('yes'));
btnNoReset.addEventListener('click', () => setVendorYes('no'));
btnToggleYes.addEventListener('click', () => {
  const current = (state.vendorControl.yes || 'no').toLowerCase();
  setVendorYes(current === 'yes' ? 'no' : 'yes');
});

autoResetChk.addEventListener('change', (e) => {
  state.autoResetEnabled = e.target.checked;
  triggerHaptic(15);
  sfx.playClick(500, 0.05);
  addLog(`Auto-reset (3s): <strong>${state.autoResetEnabled ? 'ON' : 'OFF'}</strong>`, 'info');
});

['A', 'B', 'C', 'D'].forEach(letter => {
  const btn = letterButtons[letter];
  if (btn) btn.addEventListener('click', () => setLetter(letter));
});

btnClearLetter.addEventListener('click', clearLetter);

refreshDbBtn.addEventListener('click', async () => {
  triggerHaptic(20);
  sfx.playClick(800, 0.04);
  const icon = refreshDbBtn.querySelector('.refresh-icon');
  if (icon) icon.style.transform = 'rotate(360deg)';
  await fetchFullDatabase();
  setTimeout(() => { if (icon) icon.style.transform = ''; }, 400);
  showToast('Database Refreshed', 'info');
});

clearLogsBtn.addEventListener('click', () => {
  activityLogList.innerHTML = '';
  addLog('Logs cleared', 'info');
});

soundToggleBtn.addEventListener('click', () => {
  state.soundEnabled = !state.soundEnabled;
  triggerHaptic(20);
  soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';
  soundToggleBtn.style.opacity = state.soundEnabled ? '1' : '0.5';
  if (state.soundEnabled) sfx.playClick(880, 0.06);
  showToast(`Audio Feedback ${state.soundEnabled ? 'Enabled' : 'Muted'}`, 'info');
});

// Keyboard bindings for desktop/laptop testing
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  const key = e.key.toUpperCase();
  if (['A', 'B', 'C', 'D'].includes(key)) {
    e.preventDefault();
    const btn = letterButtons[key];
    if (btn) {
      btn.classList.add('scale-95');
      setTimeout(() => btn.classList.remove('scale-95'), 150);
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
    const current = (state.vendorControl.yes || 'no').toLowerCase();
    setVendorYes(current === 'yes' ? 'no' : 'yes');
  }
});

// ==========================================================================
// Initialization
// ==========================================================================
async function init() {
  addLog('Initializing Mobile VR Controller...', 'info');
  await fetchFullDatabase();
  setupRealtimeStream();
  addLog('Controller ready for touch input.', 'success');
}

init();

// ============================================================
// EXECUTION ENGINE — Core App Logic (v2)
// ============================================================

const DB_KEY = 'execution-engine-data';

let state = loadState();
let activeModal = null;

function defaultState() {
  return {
    days: {},
    achievements: [],
    patterns: [],
    settings: { weekStart: 'monday' },
    version: 2
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return defaultState();
}

function save() {
  localStorage.setItem(DB_KEY, JSON.stringify(state));
  syncToServer();
}

// Sync state to server (for widget + Claude access)
let syncTimeout = null;
function syncToServer() {
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    const serverUrl = `./api/sync`;
    fetch(serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    }).catch(() => {}); // Silent fail if offline
  }, 500); // Debounce 500ms
}

// On load, try server API first, fall back to static data.json
function pullFromServer() {
  return fetch(`./api/state`)
    .then(r => { if (!r.ok) throw new Error('no api'); return r.json(); })
    .then(mergeServerState)
    .catch(() => {
      return fetch(`./data.json`)
        .then(r => { if (!r.ok) throw new Error('no data'); return r.json(); })
        .then(mergeServerState)
        .catch(() => {});
    });
}

function mergeServerState(serverState) {
  if (!serverState || !serverState.days) return;
  if (Object.keys(serverState.days).length === 0) return;

  const localTasks = Object.values(state.days).reduce((sum, d) => sum + (d.tasks ? d.tasks.length : 0), 0);

  // Fresh install or server has more data — use server state
  if (localTasks === 0) {
    state = serverState;
    localStorage.setItem(DB_KEY, JSON.stringify(state));
    return;
  }

  const serverTasks = Object.values(serverState.days).reduce((sum, d) => sum + (d.tasks ? d.tasks.length : 0), 0);
  if (serverTasks > localTasks) {
    state = serverState;
    localStorage.setItem(DB_KEY, JSON.stringify(state));
  }
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getDay(date) {
  if (!state.days[date]) {
    state.days[date] = {
      energy: null,
      ocdImpact: null,
      recoveryLevel: 0,
      tasks: [],
      notes: '',
      wins: [],
      misses: []
    };
    save();
  }
  return state.days[date];
}

// ============================================================
// NAVIGATION
// ============================================================

function switchScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`screen-${name}`).classList.add('active');
  document.querySelector(`[data-screen="${name}"]`).classList.add('active');
  if (name === 'today') renderToday();
  if (name === 'stats') renderStats();
  if (name === 'log') renderLog();
  if (name === 'system') renderSystem();
  if (name === 'sync') renderSync();
}

// ============================================================
// TODAY SCREEN
// ============================================================

function renderToday() {
  const d = getDay(today());
  const container = document.getElementById('today-content');

  const quotes = [
    { text: "Begin — the rest is just staying on the path.", author: "Marcus Aurelius" },
    { text: "Perfect is the enemy of good.", author: "Voltaire" },
    { text: "It is not that we have a short time to live, but that we waste much of it.", author: "Seneca" },
    { text: "Stop thinking and go in.", author: "Napoleon" },
    { text: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" },
    { text: "Nature does not hurry, yet everything is accomplished.", author: "Lao Tzu" },
    { text: "Energy and persistence conquer all things.", author: "Benjamin Franklin" }
  ];
  const q = quotes[new Date().getDay() % quotes.length]; // Consistent daily, not random

  const big = d.tasks.filter(t => t.tier === 'big');
  const med = d.tasks.filter(t => t.tier === 'med');
  const small = d.tasks.filter(t => t.tier === 'small');
  const done = d.tasks.filter(t => t.status === 'done').length;
  const total = d.tasks.length;

  container.innerHTML = `
    <div class="quote-box">
      <div class="quote-text">"${q.text}"</div>
      <div class="quote-author">— ${q.author}</div>
    </div>

    ${d.recoveryLevel >= 3 ? `
    <div class="card" style="border-color:var(--red);background:rgba(248,113,113,0.05)">
      <div class="card-title" style="color:var(--red)">Recovery Mode Active (Level ${d.recoveryLevel})</div>
      <div style="font-size:13px;color:var(--text-dim)">System simplified. Do ONE small thing. No shame.</div>
    </div>` : ''}

    <div class="card">
      <div class="card-title">Energy & State</div>
      <div class="energy-row">
        <button class="energy-btn ${d.energy === 'high' ? 'selected-high' : ''}" onclick="setEnergy('high')">High</button>
        <button class="energy-btn ${d.energy === 'med' ? 'selected-med' : ''}" onclick="setEnergy('med')">Med</button>
        <button class="energy-btn ${d.energy === 'low' ? 'selected-low' : ''}" onclick="setEnergy('low')">Low</button>
      </div>
      <div class="ocd-toggle" style="margin-top:8px">
        <button class="ocd-btn ${d.ocdImpact === 'low' ? 'selected' : ''}" onclick="setOCD('low')">OCD: Low</button>
        <button class="ocd-btn ${d.ocdImpact === 'med' ? 'selected' : ''}" onclick="setOCD('med')">OCD: Med</button>
        <button class="ocd-btn ${d.ocdImpact === 'high' ? 'selected' : ''}" onclick="setOCD('high')">OCD: High</button>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Big Task (1)</div>
      ${renderTasks(big, 'big')}
      ${big.length === 0 ? '<div style="color:var(--text-dim);font-size:13px;padding:8px 0">No big task set.</div>' : ''}
    </div>

    <div class="card">
      <div class="card-title">Medium Tasks (up to 3)</div>
      ${renderTasks(med, 'med')}
      ${med.length === 0 ? '<div style="color:var(--text-dim);font-size:13px;padding:8px 0">None yet.</div>' : ''}
    </div>

    <div class="card">
      <div class="card-title">Small Tasks (up to 5)</div>
      ${renderTasks(small, 'small')}
      ${small.length === 0 ? '<div style="color:var(--text-dim);font-size:13px;padding:8px 0">None yet.</div>' : ''}
    </div>

    <div class="card">
      <div class="add-task">
        <input type="text" id="new-task-input" placeholder="Add task..." onkeydown="if(event.key==='Enter')addTask()">
        <select id="new-task-tier">
          <option value="small">SM</option>
          <option value="med">MED</option>
          <option value="big">BIG</option>
        </select>
        <button class="add-btn" onclick="addTask()">+</button>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Quick Notes</div>
      <textarea id="today-notes" placeholder="What's on your mind? End of day reflection..." rows="2">${d.notes || ''}</textarea>
      <button class="save-notes-btn" onclick="saveNotes()">Save</button>
    </div>

    <!-- Panic button -->
    <button class="spiral-btn" onclick="triggerSpiral()">I'm spiraling</button>

    <!-- Timer -->
    <div class="card">
      <div class="card-title">Focus Timer</div>
      <div class="timer-display" id="timer-display">25:00</div>
      <div class="timer-controls">
        <button class="timer-btn" onclick="startTimer(25)">25 min</button>
        <button class="timer-btn" onclick="startTimer(50)">50 min</button>
        <button class="timer-btn" onclick="startTimer(90)">90 min</button>
        <button class="timer-btn stop" onclick="stopTimer()">Stop</button>
      </div>
      <div class="timer-msg" id="timer-msg"></div>
    </div>
  `;
}

function renderTasks(tasks, tier) {
  if (tasks.length === 0) return '';
  return tasks.map(t => {
    const idx = getDay(today()).tasks.indexOf(t);
    const tierClass = tier === 'big' ? 'tier-big' : tier === 'med' ? 'tier-med' : 'tier-small';
    const statusIcon = t.status === 'done' ? '&#10003;' : t.status === 'missed' ? '&#10007;' : t.status === 'partial' ? '~' : '';
    return `
      <div class="task">
        <div class="task-check ${t.status || ''}" onclick="showStatusMenu(${idx})">${statusIcon}</div>
        <div class="task-text ${t.status === 'done' ? 'done-text' : ''}">${escHtml(t.name)}</div>
        <button class="defer-btn" onclick="deferTask(${idx})" title="Defer to tomorrow">&#8594;</button>
      </div>
    `;
  }).join('');
}

function showStatusMenu(idx) {
  const d = getDay(today());
  const t = d.tasks[idx];

  showModal(`
    <h3>Mark: ${escHtml(t.name)}</h3>
    <div class="status-options">
      <button class="status-opt done" onclick="setStatus(${idx},'done')">Done</button>
      <button class="status-opt partial" onclick="setStatus(${idx},'partial')">Partial</button>
      <button class="status-opt missed" onclick="promptMissReason(${idx})">Missed</button>
      <button class="status-opt clear" onclick="setStatus(${idx},null)">Clear</button>
    </div>
  `);
}

function setStatus(idx, status) {
  const d = getDay(today());
  const t = d.tasks[idx];
  t.status = status;

  if (status === 'done') {
    if (!d.wins.includes(t.name)) d.wins.push(t.name);
    d.misses = d.misses.filter(m => m.task !== t.name);
    // Check for achievement
    const weekDone = getWeeklyCompletion();
    if (weekDone >= 70 && !state.achievements.find(a => a.week === getWeekKey())) {
      state.achievements.push({ week: getWeekKey(), type: '70% hit', date: today() });
    }
  }

  save();
  hideModal();
  renderToday();
}

function promptMissReason(idx) {
  const d = getDay(today());
  const t = d.tasks[idx];

  showModal(`
    <h3>What happened?</h3>
    <p style="font-size:13px;color:var(--text-dim);margin-bottom:12px">No judgment. This helps find patterns.</p>
    <div class="miss-reasons">
      <button class="miss-reason-btn" onclick="logMiss(${idx},'energy')">Low energy</button>
      <button class="miss-reason-btn" onclick="logMiss(${idx},'ocd')">OCD blocking</button>
      <button class="miss-reason-btn" onclick="logMiss(${idx},'avoidance')">Avoidance</button>
      <button class="miss-reason-btn" onclick="logMiss(${idx},'too-big')">Task too big</button>
      <button class="miss-reason-btn" onclick="logMiss(${idx},'unclear')">Unclear what to do</button>
      <button class="miss-reason-btn" onclick="logMiss(${idx},'time')">Ran out of time</button>
      <button class="miss-reason-btn" onclick="logMiss(${idx},'other')">Other</button>
    </div>
  `);
}

function logMiss(idx, reason) {
  const d = getDay(today());
  const t = d.tasks[idx];
  t.status = 'missed';
  t.missReason = reason;

  d.misses.push({ task: t.name, reason, tier: t.tier, date: today() });
  d.wins = d.wins.filter(w => w !== t.name);

  save();
  hideModal();
  renderToday();
}

function deferTask(idx) {
  const d = getDay(today());
  const t = d.tasks[idx];

  // Move to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tKey = tomorrow.toISOString().slice(0, 10);
  const tDay = getDay(tKey);

  tDay.tasks.push({ name: t.name, tier: t.tier, status: null, deferred: true, addedAt: new Date().toISOString() });
  d.tasks.splice(idx, 1);

  save();
  renderToday();
}

function addTask() {
  const input = document.getElementById('new-task-input');
  const tier = document.getElementById('new-task-tier').value;
  const name = input.value.trim();
  if (!name) return;

  const d = getDay(today());
  d.tasks.push({ name, tier, status: null, addedAt: new Date().toISOString() });
  save();
  input.value = '';
  renderToday();
}

function setEnergy(level) {
  getDay(today()).energy = level;
  save();
  renderToday();
}

function setOCD(level) {
  const d = getDay(today());
  d.ocdImpact = level;
  if (level === 'high') d.recoveryLevel = Math.max(d.recoveryLevel, 2);
  save();
  renderToday();
}

function saveNotes() {
  const ta = document.getElementById('today-notes');
  getDay(today()).notes = ta.value.trim();
  save();
  ta.style.borderColor = 'var(--green)';
  setTimeout(() => ta.style.borderColor = '', 800);
}

function triggerSpiral() {
  const d = getDay(today());
  d.recoveryLevel = 3;
  save();

  showModal(`
    <h3 style="color:var(--orange)">Recovery Mode Activated</h3>
    <p style="margin:12px 0;font-size:14px;line-height:1.6">
      System simplified. Here's what to do:<br><br>
      1. Close everything except this app<br>
      2. Walk for 5 minutes or breathe for 2<br>
      3. Come back and do ONE small thing<br>
      4. That's success for today. Plan tomorrow tonight.<br><br>
      <em style="color:var(--text-dim)">The spiral is not evidence of failure. It's the system catching you.</em>
    </p>
    <button class="btn-primary" style="width:100%;padding:14px;border-radius:8px;border:none;font-size:15px;cursor:pointer" onclick="hideModal()">Got it</button>
  `);
}

// ============================================================
// TIMER
// ============================================================

let timerInterval = null;
let timerEnd = null;

function startTimer(minutes) {
  stopTimer();
  timerEnd = Date.now() + minutes * 60 * 1000;
  updateTimerDisplay();
  timerInterval = setInterval(updateTimerDisplay, 1000);
  document.getElementById('timer-msg').textContent = `${minutes} min block started. Stop when it ends.`;
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  timerEnd = null;
  document.getElementById('timer-display').textContent = '00:00';
  const msg = document.getElementById('timer-msg');
  if (msg) msg.textContent = '';
}

function updateTimerDisplay() {
  const display = document.getElementById('timer-display');
  if (!timerEnd) return;

  const remaining = Math.max(0, timerEnd - Date.now());
  const min = Math.floor(remaining / 60000);
  const sec = Math.floor((remaining % 60000) / 1000);
  display.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

  if (remaining <= 0) {
    stopTimer();
    display.textContent = "TIME'S UP";
    display.style.color = 'var(--green)';
    document.getElementById('timer-msg').textContent = 'Stop. The discomfort is ERP working. Move to next task.';
    // Vibrate if available
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
    setTimeout(() => { display.style.color = ''; }, 5000);
  }
}

// ============================================================
// STATS SCREEN
// ============================================================

function renderStats() {
  const container = document.getElementById('stats-content');
  const days = getLast7Days();

  let totalTasks = 0, doneTasks = 0, bigDone = 0, bigTotal = 0;
  let energyDays = { high: 0, med: 0, low: 0 };
  let ocdDays = { low: 0, med: 0, high: 0 };
  let missReasons = {};

  days.forEach(({ data }) => {
    if (!data) return;
    data.tasks.forEach(t => {
      totalTasks++;
      if (t.status === 'done') doneTasks++;
      if (t.tier === 'big') { bigTotal++; if (t.status === 'done') bigDone++; }
      if (t.missReason) missReasons[t.missReason] = (missReasons[t.missReason] || 0) + 1;
    });
    if (data.energy) energyDays[data.energy]++;
    if (data.ocdImpact) ocdDays[data.ocdImpact]++;
  });

  const weeklyPct = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0;
  const isSuccess = weeklyPct >= 70;

  // Adaptive insights
  const insights = generateInsights();

  container.innerHTML = `
    <div class="stat-grid">
      <div class="stat-box">
        <div class="stat-num" style="color:${isSuccess ? 'var(--green)' : 'var(--yellow)'}">${weeklyPct}%</div>
        <div class="stat-label">Weekly Rate</div>
      </div>
      <div class="stat-box">
        <div class="stat-num" style="color:var(--accent)">${bigDone}/${bigTotal}</div>
        <div class="stat-label">Big Tasks</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">70% Rule</div>
      <div class="progress-bar">
        <div class="progress-fill ${isSuccess ? 'fill-green' : 'fill-yellow'}" style="width:${Math.min(weeklyPct, 100)}%"></div>
      </div>
      <div style="text-align:center;margin-top:8px;font-size:13px;color:${isSuccess ? 'var(--green)' : 'var(--text-dim)'}">
        ${isSuccess ? 'SUCCESS this week' : `${weeklyPct}% — need 70% for success`}
      </div>
    </div>

    ${Object.keys(missReasons).length > 0 ? `
    <div class="card">
      <div class="card-title">Why Tasks Were Missed</div>
      ${Object.entries(missReasons).sort((a,b) => b[1]-a[1]).map(([reason, count]) => `
        <div class="pattern-item">
          <div class="pattern-label">${formatReason(reason)}</div>
          <div class="progress-bar"><div class="progress-fill fill-red" style="width:${count/Math.max(...Object.values(missReasons))*100}%"></div></div>
          <div style="font-size:12px;color:var(--text-dim)">${count} time${count>1?'s':''}</div>
        </div>
      `).join('')}
    </div>` : ''}

    ${insights.length > 0 ? `
    <div class="card">
      <div class="card-title">Adaptive Insights</div>
      ${insights.map(i => `
        <div class="insight ${i.type}">
          <div class="insight-text">${i.text}</div>
        </div>
      `).join('')}
    </div>` : ''}

    <div class="card">
      <div class="card-title">Energy This Week</div>
      <div class="pattern-item">
        <div class="pattern-value">High: ${energyDays.high}d / Med: ${energyDays.med}d / Low: ${energyDays.low}d</div>
      </div>
      <div class="pattern-item">
        <div class="pattern-label">OCD Impact</div>
        <div class="pattern-value">Low: ${ocdDays.low}d / Med: ${ocdDays.med}d / High: ${ocdDays.high}d</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Achievements</div>
      ${state.achievements.length === 0 ? '<div style="color:var(--text-dim);font-size:13px">Hit 70% weekly to earn your first achievement.</div>' : ''}
      ${state.achievements.slice(-5).reverse().map(a => `
        <div class="pattern-item">
          <div class="pattern-value" style="color:var(--green)">${a.type}</div>
          <div class="pattern-label">${formatDate(a.date)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================================
// ADAPTIVE INSIGHTS ENGINE
// ============================================================

function generateInsights() {
  const insights = [];
  const allDays = Object.entries(state.days).sort((a,b) => b[0].localeCompare(a[0]));
  if (allDays.length < 3) return insights;

  // Day-of-week analysis
  const dowStats = {};
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  allDays.forEach(([date, data]) => {
    const dow = new Date(date + 'T12:00:00').getDay();
    if (!dowStats[dow]) dowStats[dow] = { done: 0, total: 0, name: dayNames[dow] };
    data.tasks.forEach(t => {
      dowStats[dow].total++;
      if (t.status === 'done') dowStats[dow].done++;
    });
  });

  // Find worst day
  let worstDay = null, worstPct = 100;
  Object.values(dowStats).forEach(s => {
    if (s.total >= 3) {
      const pct = s.done / s.total * 100;
      if (pct < worstPct) { worstPct = pct; worstDay = s.name; }
    }
  });
  if (worstDay && worstPct < 50) {
    insights.push({ type: 'warning', text: `${worstDay}s are your hardest day (${Math.round(worstPct)}% completion). Consider scheduling lighter on ${worstDay}s or making it a recovery day.` });
  }

  // OCD correlation
  let highOcdMisses = 0, highOcdTotal = 0;
  allDays.forEach(([_, data]) => {
    if (data.ocdImpact === 'high') {
      data.tasks.forEach(t => {
        highOcdTotal++;
        if (t.status === 'missed') highOcdMisses++;
      });
    }
  });
  if (highOcdTotal >= 3 && highOcdMisses / highOcdTotal > 0.5) {
    insights.push({ type: 'info', text: `On high-OCD days, you miss ${Math.round(highOcdMisses/highOcdTotal*100)}% of tasks. Consider auto-enabling recovery mode when OCD is high.` });
  }

  // Big task pattern
  let bigMisses = 0, bigTotal = 0;
  allDays.slice(0, 14).forEach(([_, data]) => {
    data.tasks.forEach(t => {
      if (t.tier === 'big') { bigTotal++; if (t.status === 'missed') bigMisses++; }
    });
  });
  if (bigTotal >= 5 && bigMisses / bigTotal > 0.5) {
    insights.push({ type: 'warning', text: `Big tasks missed ${Math.round(bigMisses/bigTotal*100)}% of the time. They might be too large — try breaking them into 2-3 medium tasks.` });
  }

  // Miss reason pattern
  const allMissReasons = {};
  allDays.forEach(([_, data]) => {
    data.tasks.forEach(t => {
      if (t.missReason) allMissReasons[t.missReason] = (allMissReasons[t.missReason] || 0) + 1;
    });
  });
  const topReason = Object.entries(allMissReasons).sort((a,b) => b[1]-a[1])[0];
  if (topReason && topReason[1] >= 3) {
    const fixes = {
      'energy': 'Schedule hard tasks earlier in the day (BPT window).',
      'ocd': 'Pre-set "done" thresholds before starting. Time-box strictly.',
      'avoidance': 'Use 2-min micro-commit. Just open the file.',
      'too-big': 'Break into smaller pieces night before. First action should take <5 min.',
      'unclear': 'Define first physical action in evening ritual. "Open X, write Y."',
      'time': 'Buffer estimates x1.5. Cut one medium task per day.'
    };
    insights.push({ type: 'action', text: `Top miss reason: "${formatReason(topReason[0])}" (${topReason[1]}x). Fix: ${fixes[topReason[0]] || 'Log more detail to find the pattern.'}` });
  }

  // Streak detection
  let currentStreak = 0;
  for (const [_, data] of allDays) {
    const pct = data.tasks.length > 0 ? data.tasks.filter(t => t.status === 'done').length / data.tasks.length : 0;
    if (pct >= 0.7) currentStreak++;
    else break;
  }
  if (currentStreak >= 3) {
    insights.push({ type: 'positive', text: `${currentStreak}-day streak above 70%. System is working. Don't change anything.` });
  }

  return insights;
}

function formatReason(reason) {
  const map = { energy: 'Low energy', ocd: 'OCD blocking', avoidance: 'Avoidance', 'too-big': 'Task too big', unclear: 'Unclear what to do', time: 'Ran out of time', other: 'Other' };
  return map[reason] || reason;
}

// ============================================================
// LOG SCREEN
// ============================================================

function renderLog() {
  const container = document.getElementById('log-content');

  const entries = [];
  Object.entries(state.days).sort((a, b) => b[0].localeCompare(a[0])).forEach(([date, data]) => {
    data.wins.forEach(w => entries.push({ date, type: 'win', text: w }));
    data.misses.forEach(m => {
      const text = typeof m === 'object' ? `${m.task} (${formatReason(m.reason)})` : m;
      entries.push({ date, type: 'miss', text });
    });
  });
  state.patterns.forEach(p => entries.push({ date: p.date, type: 'pattern', text: p.text }));
  state.achievements.forEach(a => entries.push({ date: a.date, type: 'achievement', text: a.type }));

  entries.sort((a, b) => b.date.localeCompare(a.date));

  container.innerHTML = `
    <div class="card">
      <div class="card-title">Log a Pattern</div>
      <textarea id="log-textarea" placeholder="What pattern did you notice?" rows="2"></textarea>
      <button class="save-notes-btn" onclick="addPattern()" style="margin-top:8px">Save Pattern</button>
    </div>

    <div class="card">
      <div class="card-title">Add Achievement</div>
      <div class="add-task">
        <input type="text" id="achievement-input" placeholder="What did you ship/accomplish?" onkeydown="if(event.key==='Enter')addAchievement()">
        <button class="add-btn" onclick="addAchievement()">+</button>
      </div>
    </div>

    <div class="card">
      <div class="card-title">History (${entries.length} entries)</div>
      ${entries.length === 0 ? '<div style="color:var(--text-dim);font-size:13px;padding:8px">Use the app for a few days to build history.</div>' : ''}
      ${entries.slice(0, 40).map(e => `
        <div class="log-entry">
          <div class="log-date">${formatDate(e.date)}</div>
          <div class="log-content">${escHtml(e.text)}</div>
          <span class="log-tag ${e.type === 'win' ? 'tag-win' : e.type === 'miss' ? 'tag-miss' : e.type === 'achievement' ? 'tag-achievement' : 'tag-pattern'}">
            ${e.type === 'win' ? 'Win' : e.type === 'miss' ? 'Miss' : e.type === 'achievement' ? 'Achievement' : 'Pattern'}
          </span>
        </div>
      `).join('')}
    </div>
  `;
}

function addPattern() {
  const ta = document.getElementById('log-textarea');
  const text = ta.value.trim();
  if (!text) return;
  state.patterns.push({ date: today(), text });
  save();
  ta.value = '';
  renderLog();
}

function addAchievement() {
  const input = document.getElementById('achievement-input');
  const text = input.value.trim();
  if (!text) return;
  state.achievements.push({ date: today(), type: text });
  save();
  input.value = '';
  renderLog();
}

// ============================================================
// SYSTEM SCREEN
// ============================================================

function renderSystem() {
  const container = document.getElementById('system-content');
  container.innerHTML = `
    <div class="card">
      <div class="card-title">The Rules</div>
      <div class="rule"><span class="rule-num">1</span>One Big Task per day. Not three. One.</div>
      <div class="rule"><span class="rule-num">2</span>Buffer everything x1.5. Your brain runs threat-detection in parallel.</div>
      <div class="rule"><span class="rule-num">3</span>70% weekly is success. Measured weekly, not daily.</div>
      <div class="rule"><span class="rule-num">4</span>Pivots are protocol. The pivot IS the system working.</div>
      <div class="rule"><span class="rule-num">5</span>Recovery days are scheduled, not earned through burnout.</div>
      <div class="rule"><span class="rule-num">6</span>Stop when the timer ends. The anxiety is ERP working.</div>
      <div class="rule"><span class="rule-num">7</span>Pre-decide everything. Sunday night for Monday's work.</div>
      <div class="rule"><span class="rule-num">8</span>Body double for hard starts. Even 1x/week counts.</div>
      <div class="rule"><span class="rule-num">9</span>No streak tracking. Streaks become compulsions.</div>
      <div class="rule"><span class="rule-num">10</span>System serves you. If tweaking >20 min/week, freeze it.</div>
    </div>

    <div class="card">
      <div class="card-title">Recovery Ladder</div>
      <div class="recovery-level l1"><div class="recovery-title">Level 1 — Late start</div><div class="recovery-desc">Start anyway, compress session</div></div>
      <div class="recovery-level l2"><div class="recovery-title">Level 2 — Missed block</div><div class="recovery-desc">Push to next slot, cut one medium task</div></div>
      <div class="recovery-level l3"><div class="recovery-title">Level 3 — Multiple misses</div><div class="recovery-desc">Salvage day. ONE small thing. Plan tomorrow.</div></div>
      <div class="recovery-level l4"><div class="recovery-title">Level 4 — Week falling apart</div><div class="recovery-desc">Friday rescue. One Big Task, reset Sunday.</div></div>
      <div class="recovery-level l5"><div class="recovery-title">Level 5 — Burnout</div><div class="recovery-desc">Suspend everything. Sleep 9+, exercise only. 3 days.</div></div>
    </div>

    <div class="card">
      <div class="card-title">Procrastination Interrupt</div>
      <div class="rule">Intrusive anxiety? → Walk, breathe, come back in 30 min</div>
      <div class="rule">Avoidance? → Switch focus area completely</div>
      <div class="rule">Energy depleted? → Drop to small task</div>
      <div class="rule">None of these? → Push 10 min, then reassess</div>
      <div style="margin-top:12px;padding:10px;background:var(--surface2);border-radius:8px;font-size:13px;color:var(--text-dim)">
        The pivot IS the system working. No shame. No makeup work.
      </div>
    </div>

    <div class="card">
      <div class="card-title">"Not Right" Protocol</div>
      <div class="rule"><span class="rule-num">1</span>Label: "That's OCD, not quality feedback"</div>
      <div class="rule"><span class="rule-num">2</span>Don't negotiate. No intellectual reassurance.</div>
      <div class="rule"><span class="rule-num">3</span>Check: Did it meet pre-decided "done" criteria? Yes → done.</div>
      <div class="rule"><span class="rule-num">4</span>Move: physically go to next thing.</div>
    </div>
  `;
}

// ============================================================
// SYNC SCREEN
// ============================================================

function renderSync() {
  const container = document.getElementById('sync-content');
  const lastSync = localStorage.getItem('last-sync') || 'Never';

  container.innerHTML = `
    <div class="card">
      <div class="card-title">Send Data to Claude</div>
      <p style="font-size:13px;color:var(--text-dim);margin-bottom:16px">
        Export your tracking data so Claude reads it next session.
      </p>
      <button class="sync-btn" onclick="copyToClipboard()">Copy Report to Clipboard</button>
      <button class="sync-btn" style="background:var(--purple)" onclick="exportToVault()">Download .md File</button>
      <div class="sync-status">Last sync: ${lastSync}</div>
    </div>

    <div class="card">
      <div class="card-title">Data</div>
      <div class="pattern-item">
        <div class="pattern-label">Days tracked</div>
        <div class="pattern-value">${Object.keys(state.days).length}</div>
      </div>
      <div class="pattern-item">
        <div class="pattern-label">Tasks logged</div>
        <div class="pattern-value">${Object.values(state.days).reduce((s, d) => s + d.tasks.length, 0)}</div>
      </div>
      <div class="pattern-item">
        <div class="pattern-label">Patterns</div>
        <div class="pattern-value">${state.patterns.length}</div>
      </div>
      <div class="pattern-item">
        <div class="pattern-label">Achievements</div>
        <div class="pattern-value">${state.achievements.length}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title" style="color:var(--red)">Reset</div>
      <button class="sync-btn" style="background:var(--red)" onclick="if(confirm('Delete ALL data? Cannot be undone.'))resetAll()">Reset All Data</button>
    </div>
  `;
}

function generateSyncReport() {
  const allDays = Object.entries(state.days).sort((a, b) => b[0].localeCompare(a[0]));
  const recent = allDays.slice(0, 7);

  let totalTasks = 0, doneTasks = 0, bigDone = 0, bigTotal = 0;
  let missReasons = {};

  recent.forEach(([_, data]) => {
    data.tasks.forEach(t => {
      totalTasks++;
      if (t.status === 'done') doneTasks++;
      if (t.tier === 'big') { bigTotal++; if (t.status === 'done') bigDone++; }
      if (t.missReason) missReasons[t.missReason] = (missReasons[t.missReason] || 0) + 1;
    });
  });

  const weeklyPct = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0;
  const insights = generateInsights();

  let report = `---
title: "Engine Sync"
date: ${today()}
type: sync
---

# Execution Engine Sync — ${today()}

## Weekly Stats
- Completion: **${weeklyPct}%** ${weeklyPct >= 70 ? '(SUCCESS)' : '(BELOW THRESHOLD)'}
- Big tasks: ${bigDone}/${bigTotal}
- Total: ${doneTasks}/${totalTasks}

## Top Miss Reasons
${Object.entries(missReasons).sort((a,b)=>b[1]-a[1]).map(([r,c]) => `- ${formatReason(r)}: ${c}x`).join('\n') || '- None logged'}

## Adaptive Insights
${insights.map(i => `- [${i.type}] ${i.text}`).join('\n') || '- Not enough data yet'}

## Achievements
${state.achievements.slice(-5).map(a => `- [${a.date}] ${a.type}`).join('\n') || '- None yet'}

## Patterns Logged
${state.patterns.slice(-5).map(p => `- [${p.date}] ${p.text}`).join('\n') || '- None yet'}

## Daily Breakdown (Last 7 Days)
`;

  recent.forEach(([date, data]) => {
    const pct = data.tasks.length > 0 ? Math.round(data.tasks.filter(t => t.status === 'done').length / data.tasks.length * 100) : 0;
    report += `\n### ${date} | Energy: ${data.energy || '?'} | OCD: ${data.ocdImpact || '?'} | ${pct}%\n`;
    data.tasks.forEach(t => {
      const icon = t.status === 'done' ? '[x]' : t.status === 'missed' ? '[-]' : t.status === 'partial' ? '[~]' : '[ ]';
      report += `- ${icon} (${t.tier}) ${t.name}${t.missReason ? ` — reason: ${formatReason(t.missReason)}` : ''}\n`;
    });
    if (data.notes) report += `- Notes: ${data.notes}\n`;
    if (data.recoveryLevel >= 3) report += `- RECOVERY MODE (Level ${data.recoveryLevel})\n`;
  });

  report += `\n## For Claude — Action Items
- Weekly rate: ${weeklyPct}% → ${weeklyPct >= 70 ? 'maintain current approach' : 'investigate and adjust'}
- Top blocker: ${Object.entries(missReasons).sort((a,b)=>b[1]-a[1])[0]?.[0] ? formatReason(Object.entries(missReasons).sort((a,b)=>b[1]-a[1])[0][0]) : 'unknown'}
- Energy trend: ${recent.filter(([_,d]) => d.energy === 'low').length >= 3 ? 'LOW — suggest lighter load' : 'stable'}
- OCD trend: ${recent.filter(([_,d]) => d.ocdImpact === 'high').length >= 2 ? 'HIGH — suggest recovery/simplification' : 'manageable'}
`;

  return report;
}

function copyToClipboard() {
  const report = generateSyncReport();
  navigator.clipboard.writeText(report).then(() => {
    localStorage.setItem('last-sync', new Date().toLocaleString());
    showModal(`<h3 style="color:var(--green)">Copied!</h3><p style="margin:12px 0;font-size:14px">Paste this to Claude at the start of your next session. He'll read your data and adjust your plan.</p><button class="btn-primary" style="width:100%;padding:12px;border-radius:8px;border:none;font-size:14px;cursor:pointer" onclick="hideModal()">Done</button>`);
    renderSync();
  });
}

function exportToVault() {
  const report = generateSyncReport();
  const blob = new Blob([report], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '(C) Engine Sync Data.md';
  a.click();
  URL.revokeObjectURL(url);
  localStorage.setItem('last-sync', new Date().toLocaleString());
  renderSync();
}

function resetAll() {
  localStorage.removeItem(DB_KEY);
  state = defaultState();
  switchScreen('today');
}

// ============================================================
// MODAL
// ============================================================

function showModal(html) {
  let overlay = document.getElementById('modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = '<div class="modal"></div>';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) hideModal(); });
    document.body.appendChild(overlay);
  }
  overlay.querySelector('.modal').innerHTML = html;
  overlay.classList.add('show');
}

function hideModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.remove('show');
}

// ============================================================
// UTILITIES
// ============================================================

function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, data: state.days[key] || null });
  }
  return days;
}

function getWeeklyCompletion() {
  const days = getLast7Days();
  let total = 0, done = 0;
  days.forEach(({ data }) => {
    if (!data) return;
    data.tasks.forEach(t => { total++; if (t.status === 'done') done++; });
  });
  return total > 0 ? Math.round(done / total * 100) : 0;
}

function getWeekKey() {
  const d = new Date();
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return start.toISOString().slice(0, 10);
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchScreen(btn.dataset.screen));
  });
  await pullFromServer();
  switchScreen('today');
});

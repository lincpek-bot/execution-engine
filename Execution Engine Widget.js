// ============================================================
// Execution Engine — Scriptable Widget
// ============================================================
// Setup:
// 1. Install Scriptable from App Store
// 2. Create new script, paste this code
// 3. Set SERVER_IP to your Mac's local IP
// 4. Add Scriptable widget to home screen → select this script
// ============================================================

const SERVER_IP = '10.193.178.114'; // Your Mac's local IP
const SERVER_PORT = 8080;
const API_URL = `http://${SERVER_IP}:${SERVER_PORT}/api/widget`;

// Colors
const BG = new Color('#0d0d0d');
const SURFACE = new Color('#1a1a1a');
const ACCENT = new Color('#4f9eff');
const GREEN = new Color('#34d399');
const YELLOW = new Color('#fbbf24');
const RED = new Color('#f87171');
const TEXT = new Color('#e8e8e8');
const DIM = new Color('#888888');

async function fetchData() {
  try {
    const req = new Request(API_URL);
    req.timeoutInterval = 5;
    return await req.loadJSON();
  } catch (e) {
    return null;
  }
}

function createSmallWidget(data) {
  const w = new ListWidget();
  w.backgroundColor = BG;
  w.setPadding(14, 14, 14, 14);

  if (!data || !data.bigTask) {
    const msg = w.addText('No Big Task set');
    msg.font = Font.mediumSystemFont(14);
    msg.textColor = DIM;
    const sub = w.addText('Open app to plan today');
    sub.font = Font.regularSystemFont(11);
    sub.textColor = DIM;
    return w;
  }

  // Header
  const header = w.addText('BIG TASK');
  header.font = Font.boldSystemFont(10);
  header.textColor = ACCENT;
  header.textOpacity = 0.8;

  w.addSpacer(6);

  // Big task name
  const task = w.addText(data.bigTask);
  task.font = Font.semiboldSystemFont(15);
  task.textColor = data.bigTaskDone ? GREEN : TEXT;
  task.lineLimit = 2;

  w.addSpacer(8);

  // Progress
  const pct = data.todayTotal > 0 ? `${data.todayDone}/${data.todayTotal}` : '0/0';
  const prog = w.addText(`Today: ${pct} done`);
  prog.font = Font.regularSystemFont(11);
  prog.textColor = DIM;

  w.addSpacer(4);

  // Weekly
  const weekColor = data.weekPct >= 70 ? GREEN : data.weekPct >= 40 ? YELLOW : RED;
  const week = w.addText(`Week: ${data.weekPct}%`);
  week.font = Font.mediumSystemFont(11);
  week.textColor = weekColor;

  return w;
}

function createMediumWidget(data) {
  const w = new ListWidget();
  w.backgroundColor = BG;
  w.setPadding(14, 16, 14, 16);

  if (!data) {
    const msg = w.addText('Engine offline — check server');
    msg.font = Font.mediumSystemFont(14);
    msg.textColor = DIM;
    return w;
  }

  // Top row
  const topStack = w.addStack();
  topStack.layoutHorizontally();
  topStack.centerAlignContent();

  const titleStack = topStack.addStack();
  titleStack.layoutVertically();

  const header = titleStack.addText('EXECUTION ENGINE');
  header.font = Font.boldSystemFont(9);
  header.textColor = ACCENT;
  header.textOpacity = 0.7;

  const dateText = titleStack.addText(formatDate(data.date));
  dateText.font = Font.regularSystemFont(10);
  dateText.textColor = DIM;

  topStack.addSpacer();

  // Weekly badge
  const weekColor = data.weekPct >= 70 ? GREEN : data.weekPct >= 40 ? YELLOW : RED;
  const badge = topStack.addText(`${data.weekPct}%`);
  badge.font = Font.boldMonospacedSystemFont(20);
  badge.textColor = weekColor;

  w.addSpacer(10);

  // Big Task
  if (data.bigTask) {
    const bigStack = w.addStack();
    bigStack.layoutHorizontally();
    bigStack.centerAlignContent();

    const dot = bigStack.addText(data.bigTaskDone ? '●' : '○');
    dot.font = Font.mediumSystemFont(12);
    dot.textColor = data.bigTaskDone ? GREEN : ACCENT;
    bigStack.addSpacer(6);

    const bigText = bigStack.addText(data.bigTask);
    bigText.font = Font.semiboldSystemFont(14);
    bigText.textColor = data.bigTaskDone ? GREEN : TEXT;
    bigText.lineLimit = 1;
  }

  w.addSpacer(6);

  // Medium tasks
  if (data.medTasks && data.medTasks.length > 0) {
    for (const t of data.medTasks.slice(0, 3)) {
      const taskStack = w.addStack();
      taskStack.layoutHorizontally();
      taskStack.centerAlignContent();

      const check = taskStack.addText(t.done ? '●' : '○');
      check.font = Font.regularSystemFont(9);
      check.textColor = t.done ? GREEN : DIM;
      taskStack.addSpacer(6);

      const name = taskStack.addText(t.name);
      name.font = Font.regularSystemFont(12);
      name.textColor = t.done ? DIM : TEXT;
      name.lineLimit = 1;

      w.addSpacer(2);
    }
  }

  w.addSpacer(4);

  // Footer: energy + OCD
  if (data.energy || data.recoveryLevel > 0) {
    const footStack = w.addStack();
    footStack.layoutHorizontally();

    if (data.energy) {
      const eColor = data.energy === 'high' ? GREEN : data.energy === 'med' ? YELLOW : RED;
      const e = footStack.addText(`Energy: ${data.energy}`);
      e.font = Font.regularSystemFont(10);
      e.textColor = eColor;
    }

    if (data.recoveryLevel >= 3) {
      footStack.addSpacer(12);
      const r = footStack.addText(`Recovery L${data.recoveryLevel}`);
      r.font = Font.boldSystemFont(10);
      r.textColor = RED;
    }
  }

  return w;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

// Main
const data = await fetchData();

if (config.widgetFamily === 'medium' || config.widgetFamily === 'large') {
  const widget = createMediumWidget(data);
  widget.url = 'https://lincpek-bot.github.io/execution-engine/';
  Script.setWidget(widget);
} else {
  const widget = createSmallWidget(data);
  widget.url = 'https://lincpek-bot.github.io/execution-engine/';
  Script.setWidget(widget);
}

Script.complete();

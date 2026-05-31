/**
 * app.js — 1000 Nights
 *
 * Hash router. Reads data/reading-list.json and config.json.
 * Handles:
 *   /#/          → landing page (computes today's day number)
 *   /#/day/N     → day view, all 5 content types
 *   /#/day/N?poem=1&tech=1 → day view, filtered types
 *
 * No dependencies. No build step. Vanilla JS.
 */

// ── Config ────────────────────────────────────────────────────────────────────

const CONTENT_TYPES = [
  { key: 'poem',    label: 'Poem',    icon: '📖' },
  { key: 'story',   label: 'Story',   icon: '📚' },
  { key: 'essay',   label: 'Essay',   icon: '🖊️' },
  { key: 'tech',    label: 'Tech',    icon: '💻' },
  { key: 'insight', label: 'Insight', icon: '🌐' },
];

// ── State ─────────────────────────────────────────────────────────────────────

let readingList = null;  // loaded once, cached
let siteConfig  = null;

// ── DOM refs ──────────────────────────────────────────────────────────────────

const views = {
  landing: document.getElementById('view-landing'),
  day:     document.getElementById('view-day'),
  loading: document.getElementById('view-loading'),
  error:   document.getElementById('view-error'),
};

// ── Utilities ─────────────────────────────────────────────────────────────────

function showView(name) {
  for (const [k, el] of Object.entries(views)) {
    el.classList.toggle('hidden', k !== name);
  }
}

function showError(msg) {
  document.getElementById('error-msg').textContent = msg;
  showView('error');
}

/** Compute today's day number from a startDate string */
function computeToday(startDate) {
  const start = new Date(startDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - start) / 86_400_000) + 1;
  return Math.max(1, Math.min(1000, diff));
}

/** Parse the current hash into { route, day, filters } */
function parseHash() {
  const raw = window.location.hash.slice(1) || '/';
  const [path, qs] = raw.split('?');
  const params = new URLSearchParams(qs || '');

  // Determine active filters — default all on if no params present
  const hasAnyParam = CONTENT_TYPES.some(t => params.has(t.key));
  const filters = {};
  for (const t of CONTENT_TYPES) {
    filters[t.key] = hasAnyParam ? params.get(t.key) === '1' : true;
  }

  const dayMatch = path.match(/^\/day\/(\d+)$/);
  if (dayMatch) {
    return { route: 'day', day: parseInt(dayMatch[1], 10), filters };
  }
  return { route: 'landing', day: null, filters };
}

/** Build a hash URL for a given day + filters */
function buildHash(day, filters) {
  const active = CONTENT_TYPES.filter(t => filters[t.key]);
  const allActive = active.length === CONTENT_TYPES.length;

  if (allActive) return `#/day/${day}`;
  const qs = active.map(t => `${t.key}=1`).join('&');
  return `#/day/${day}${qs ? '?' + qs : ''}`;
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadData() {
  if (readingList && siteConfig) return;

  const [listRes, configRes] = await Promise.all([
    fetch('data/reading-list.json'),
    fetch('config.json'),
  ]);

  if (!listRes.ok)   throw new Error('Could not load reading list.');
  if (!configRes.ok) throw new Error('Could not load config.');

  readingList = await listRes.json();
  siteConfig  = await configRes.json();
}

// ── Render: Landing ───────────────────────────────────────────────────────────

async function renderLanding() {
  showView('loading');

  try {
    await loadData();
  } catch (e) {
    showError(e.message);
    return;
  }

  const todayN = computeToday(siteConfig.startDate);
  document.getElementById('btn-tonight').setAttribute('href', `#/day/${todayN}`);

  showView('landing');
}

// ── Render: Day ───────────────────────────────────────────────────────────────

async function renderDay(dayNum, filters) {
  showView('loading');

  try {
    await loadData();
  } catch (e) {
    showError(e.message);
    return;
  }

  if (dayNum < 1 || dayNum > 1000) {
    showError(`Day ${dayNum} is out of range. Days run from 1 to 1,000.`);
    return;
  }

  const entry = readingList[dayNum - 1];
  if (!entry) {
    showError(`No data found for Day ${dayNum}.`);
    return;
  }

  // ── Header ─────────────────────────────────────────────────────────────────
  document.getElementById('day-label').textContent = `Day ${dayNum}`;
  document.getElementById('progress-bar').style.width = `${(dayNum / 1000) * 100}%`;

  // ── Filter pills ───────────────────────────────────────────────────────────
  for (const t of CONTENT_TYPES) {
    const pill = document.getElementById(`pill-${t.key}`);
    pill.classList.toggle('active', !!filters[t.key]);
  }

  // ── Cards ──────────────────────────────────────────────────────────────────
  const cardsEl = document.getElementById('cards');
  cardsEl.innerHTML = '';

  for (const t of CONTENT_TYPES) {
    const item = entry[t.key];
    if (!item) continue;

    const card = document.createElement('article');
    card.className = 'card' + (filters[t.key] ? '' : ' hidden');
    card.dataset.type = t.key;
    card.setAttribute('aria-label', `${t.label}: ${item.title}`);

    card.innerHTML = `
      <div class="card-type">${t.icon} ${t.label}</div>
      <h2 class="card-title">${escapeHtml(item.title)}</h2>
      <p class="card-author">${escapeHtml(item.author)}</p>
      <a class="card-link"
         href="${escapeHtml(item.url)}"
         target="_blank"
         rel="noopener noreferrer"
         id="read-${t.key}-day-${dayNum}">
        Read
      </a>
    `;
    cardsEl.appendChild(card);
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  const prevEl = document.getElementById('nav-prev');
  const nextEl = document.getElementById('nav-next');

  if (dayNum > 1) {
    prevEl.setAttribute('href', buildHash(dayNum - 1, filters));
    prevEl.removeAttribute('aria-disabled');
  } else {
    prevEl.setAttribute('href', '#');
    prevEl.setAttribute('aria-disabled', 'true');
  }

  if (dayNum < 1000) {
    nextEl.setAttribute('href', buildHash(dayNum + 1, filters));
    nextEl.removeAttribute('aria-disabled');
  } else {
    nextEl.setAttribute('href', '#');
    nextEl.setAttribute('aria-disabled', 'true');
  }

  // ── Share button ───────────────────────────────────────────────────────────
  const shareBtn = document.getElementById('btn-share');
  shareBtn.onclick = async () => {
    const url = window.location.origin + window.location.pathname + buildHash(dayNum, filters);
    try {
      await navigator.clipboard.writeText(url);
      shareBtn.textContent = 'Copied!';
      shareBtn.classList.add('copied');
      setTimeout(() => {
        shareBtn.textContent = 'Share Day';
        shareBtn.classList.remove('copied');
      }, 2000);
    } catch {
      prompt('Copy this link:', url);
    }
  };

  showView('day');
}

// ── Filter pill interaction ───────────────────────────────────────────────────

function bindPills(dayNum, filters) {
  for (const t of CONTENT_TYPES) {
    const pill = document.getElementById(`pill-${t.key}`);
    pill.onclick = () => {
      filters[t.key] = !filters[t.key];
      pill.classList.toggle('active', filters[t.key]);

      // Toggle corresponding card
      const card = document.querySelector(`.card[data-type="${t.key}"]`);
      if (card) card.classList.toggle('hidden', !filters[t.key]);

      // Update URL without re-render
      const newHash = buildHash(dayNum, filters);
      history.replaceState(null, '', newHash);
    };
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

async function route() {
  const { route: r, day, filters } = parseHash();

  if (r === 'day') {
    await renderDay(day, filters);
    bindPills(day, filters);
  } else {
    await renderLanding();
  }
}

// ── Landing: day-jump widget ──────────────────────────────────────────────────

document.getElementById('btn-jump').addEventListener('click', () => {
  const val = parseInt(document.getElementById('day-input').value, 10);
  if (val >= 1 && val <= 1000) {
    window.location.hash = `#/day/${val}`;
  }
});

document.getElementById('day-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btn-jump').click();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────────

window.addEventListener('hashchange', route);
route();

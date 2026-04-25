const STORAGE_KEY = 'now_entries';

let entries = [];

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    entries = raw ? JSON.parse(raw) : [];
  } catch(e) { entries = []; }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function formatTime(ts) {
  const d = new Date(ts);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2,'0');
  const ampm = h >= 12 ? 'pm' : 'am';
  return `${h % 12 || 12}:${m} ${ampm}`;
}

function formatDuration(ms) {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 1) return '<1m';
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatDateHeader(ts) {
  return new Date(ts).toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' });
}

function render() {
  const wrap = document.getElementById('timeline');
  const empty = document.getElementById('empty');

  if (entries.length === 0) {
    empty.style.display = 'flex';
    // remove all entries
    wrap.querySelectorAll('.entry, .date-header').forEach(el => el.remove());
    return;
  }
  empty.style.display = 'none';

  // Build fresh — simple approach for POC
  wrap.querySelectorAll('.entry, .date-header').forEach(el => el.remove());

  // Newest first
  const sorted = [...entries].sort((a,b) => b.ts - a.ts);
  let lastDate = null;

  sorted.forEach((entry, i) => {
    const dateStr = formatDateHeader(entry.ts);

    if (dateStr !== lastDate) {
      const dh = document.createElement('div');
      dh.className = 'date-header';
      dh.style.cssText = `font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:var(--muted);padding:20px 0 4px;`;
      dh.textContent = dateStr;
      wrap.appendChild(dh);
      lastDate = dateStr;
    }

    const newerEntry = i === 0 ? { ts: Date.now() } : sorted[i - 1];
    const dur = newerEntry.ts - entry.ts;
    const durationHtml = `<span class="duration">${formatDuration(dur)}</span>`;

    const el = document.createElement('div');
    el.className = 'entry';
    el.dataset.id = entry.id;
    el.innerHTML = `
      <div class="entry-dot-col">
        <div class="dot"></div>
        <div class="dot-line"></div>
      </div>
      <div class="entry-body">
        <div class="entry-time">${formatTime(entry.ts)}${durationHtml}</div>
        <div class="entry-text">${escHtml(entry.text)}</div>
      </div>
      <button class="reuse-btn" onclick="reuseEntry('${entry.id}')" title="Fill in memo">⤴</button>
      <button class="delete-btn" onclick="deleteEntry('${entry.id}')" title="Delete">×</button>
    `;
    wrap.appendChild(el);
  });
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function logEntry() {
  const input = document.getElementById('task-input');
  const text = input.value.trim();
  if (!text) return;

  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,5),
    ts: Date.now(),
    text
  };
  entries.push(entry);
  save();

  input.value = '';
  input.style.height = 'auto';
  render();
  showToast('Logged');
}

function deleteEntry(id) {
  entries = entries.filter(e => e.id !== id);
  save();
  render();
}

function reuseEntry(id) {
  const entry = entries.find(e => e.id === id);
  if (!entry) return;
  const input = document.getElementById('task-input');
  input.value = entry.text;
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  document.getElementById('timeline').scrollTop = 0;
  input.focus();
}

function clearAll() {
  if (entries.length === 0) return;
  if (!confirm(`Clear all ${entries.length} entries?`)) return;
  entries = [];
  save();
  render();
}

function exportCSV() {
  if (entries.length === 0) { showToast('Nothing to export'); return; }
  const sorted = [...entries].sort((a,b) => a.ts - b.ts);
  const rows = [['timestamp_iso','timestamp_unix','description']];
  sorted.forEach(e => {
    const iso = new Date(e.ts).toISOString();
    rows.push([iso, e.ts, `"${e.text.replace(/"/g,'""')}"`]);
  });
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0,10);
  a.href = url;
  a.download = `now-${dateStr}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

// Auto-resize textarea
const input = document.getElementById('task-input');
input.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// Enter to submit (Shift+Enter for newline)
input.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    logEntry();
  }
});

// Init
load();
render();

// Auto-focus on load (desktop); skip on mobile to avoid keyboard popup
if (window.innerWidth > 600) {
  input.focus();
}

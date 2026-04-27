export function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  return `${h % 12 || 12}:${m} ${ampm}`;
}

export function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 1) return '<1m';
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatDateHeader(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

export function buildCsvContent(entries: { ts: number; text: string }[]): string {
  const sorted = [...entries].sort((a, b) => a.ts - b.ts);
  const rows = [['timestamp_iso', 'timestamp_unix', 'description']];
  for (const e of sorted) {
    const iso = new Date(e.ts).toISOString();
    rows.push([iso, String(e.ts), `"${e.text.replace(/"/g, '""')}"`]);
  }
  return rows.map((r) => r.join(',')).join('\n');
}

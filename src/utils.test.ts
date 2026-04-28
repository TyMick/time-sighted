import { buildCsvContent, formatDateHeader, formatDuration, formatTime, generateId } from './utils';

describe('formatTime', () => {
  it('formats midnight as 12:00 am', () => {
    expect(formatTime(new Date(2024, 0, 15, 0, 0).getTime())).toBe('12:00 am');
  });

  it('formats noon as 12:00 pm', () => {
    expect(formatTime(new Date(2024, 0, 15, 12, 0).getTime())).toBe('12:00 pm');
  });

  it('formats an afternoon hour with minutes', () => {
    expect(formatTime(new Date(2024, 0, 15, 13, 7).getTime())).toBe('1:07 pm');
  });

  it('formats a morning hour', () => {
    expect(formatTime(new Date(2024, 0, 15, 9, 45).getTime())).toBe('9:45 am');
  });
});

describe('formatDuration', () => {
  it('returns <1m for 0ms', () => {
    expect(formatDuration(0)).toBe('<1m');
  });

  it('returns <1m for durations that round down to 0 minutes', () => {
    expect(formatDuration(29000)).toBe('<1m');
  });

  it('returns whole minutes for sub-hour durations', () => {
    expect(formatDuration(30000)).toBe('1m');
    expect(formatDuration(25 * 60 * 1000)).toBe('25m');
  });

  it('returns whole hours when there are no remaining minutes', () => {
    expect(formatDuration(60 * 60 * 1000)).toBe('1h');
    expect(formatDuration(2 * 60 * 60 * 1000)).toBe('2h');
  });

  it('returns hours and minutes when both are non-zero', () => {
    expect(formatDuration(90 * 60 * 1000)).toBe('1h 30m');
    expect(formatDuration((2 * 60 + 15) * 60 * 1000)).toBe('2h 15m');
  });
});

describe('formatDateHeader', () => {
  it('formats a known date correctly', () => {
    // January 15, 2024 is a Monday
    expect(formatDateHeader(new Date(2024, 0, 15).getTime())).toBe('Monday, Jan 15');
  });
});

describe('generateId', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateId()).toBe('string');
    expect(generateId().length).toBeGreaterThan(0);
  });

  it('produces unique values on successive calls', () => {
    expect(generateId()).not.toBe(generateId());
  });
});

describe('buildCsvContent', () => {
  it('returns only the header row for an empty array', () => {
    expect(buildCsvContent([])).toBe('timestamp_iso,timestamp_unix,description');
  });

  it('includes one data row per entry, sorted ascending by timestamp', () => {
    const entries = [
      { ts: 2000, text: 'second' },
      { ts: 1000, text: 'first' },
    ];
    const lines = buildCsvContent(entries).split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('"first"');
    expect(lines[2]).toContain('"second"');
  });

  it('includes iso timestamp, unix timestamp, and description columns', () => {
    const ts = 1705276800000; // 2024-01-15T00:00:00.000Z
    const lines = buildCsvContent([{ ts, text: 'standup' }]).split('\n');
    expect(lines[1]).toContain(new Date(ts).toISOString());
    expect(lines[1]).toContain(String(ts));
    expect(lines[1]).toContain('"standup"');
  });

  it('escapes double quotes in the description', () => {
    const csv = buildCsvContent([{ ts: 1000, text: 'say "hello"' }]);
    expect(csv).toContain('"say ""hello"""');
  });
});

import { useCallback, useEffect, useState } from 'react';
import { loadEntries, saveEntries } from './storage';
import type { Entry } from './types';
import { generateId } from './utils';

export function useEntries() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadEntries().then((stored) => {
      setEntries(stored);
      setLoaded(true);
    });
  }, []);

  const persist = useCallback((next: Entry[]) => {
    setEntries(next);
    saveEntries(next);
  }, []);

  const addEntry = useCallback(
    (text: string) => {
      const entry: Entry = { id: generateId(), ts: Date.now(), text };
      persist([...entries, entry]);
    },
    [entries, persist],
  );

  const removeEntry = useCallback(
    (id: string) => {
      persist(entries.filter((e) => e.id !== id));
    },
    [entries, persist],
  );

  const clearAll = useCallback(() => {
    persist([]);
  }, [persist]);

  return { entries, loaded, addEntry, removeEntry, clearAll };
}

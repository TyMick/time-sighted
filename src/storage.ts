import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Entry } from './types';

const STORAGE_KEY = 'now_entries';

export async function loadEntries(): Promise<Entry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Entry[]) : [];
  } catch {
    return [];
  }
}

export async function saveEntries(entries: Entry[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadEntries, saveEntries } from './storage';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('loadEntries', () => {
  it('returns an empty array when storage is empty', async () => {
    await expect(loadEntries()).resolves.toEqual([]);
  });

  it('returns the parsed entries when data exists', async () => {
    const entries = [{ id: '1', ts: 1000, text: 'test' }];
    await AsyncStorage.setItem('now_entries', JSON.stringify(entries));
    await expect(loadEntries()).resolves.toEqual(entries);
  });

  it('returns an empty array when storage throws', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk full'));
    await expect(loadEntries()).resolves.toEqual([]);
  });
});

describe('saveEntries', () => {
  it('persists entries so they can be reloaded', async () => {
    const entries = [
      { id: 'a', ts: 1000, text: 'first' },
      { id: 'b', ts: 2000, text: 'second' },
    ];
    await saveEntries(entries);
    await expect(loadEntries()).resolves.toEqual(entries);
  });
});

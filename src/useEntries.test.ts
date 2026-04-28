import { act, renderHook, waitFor } from '@testing-library/react-native';
import { loadEntries, saveEntries } from './storage';
import { useEntries } from './useEntries';

jest.mock('./storage');

const mockLoad = loadEntries as jest.MockedFunction<typeof loadEntries>;
const mockSave = saveEntries as jest.MockedFunction<typeof saveEntries>;

beforeEach(() => {
  jest.clearAllMocks();
  mockLoad.mockResolvedValue([]);
  mockSave.mockResolvedValue(undefined);
});

it('starts with no entries and loaded=false, then sets loaded=true after mount', async () => {
  const { result } = renderHook(() => useEntries());
  expect(result.current.entries).toEqual([]);
  expect(result.current.loaded).toBe(false);
  await waitFor(() => expect(result.current.loaded).toBe(true));
});

it('populates entries from storage on mount', async () => {
  const stored = [{ id: '1', ts: 1000, text: 'hello' }];
  mockLoad.mockResolvedValue(stored);
  const { result } = renderHook(() => useEntries());
  await waitFor(() => expect(result.current.loaded).toBe(true));
  expect(result.current.entries).toEqual(stored);
});

it('addEntry appends an entry with the given text', async () => {
  const { result } = renderHook(() => useEntries());
  await waitFor(() => expect(result.current.loaded).toBe(true));
  act(() => { result.current.addEntry('standup'); });
  expect(result.current.entries).toHaveLength(1);
  expect(result.current.entries[0].text).toBe('standup');
});

it('removeEntry removes the matching entry and leaves others', async () => {
  const stored = [
    { id: 'a', ts: 1000, text: 'keep' },
    { id: 'b', ts: 2000, text: 'remove' },
  ];
  mockLoad.mockResolvedValue(stored);
  const { result } = renderHook(() => useEntries());
  await waitFor(() => expect(result.current.loaded).toBe(true));
  act(() => { result.current.removeEntry('b'); });
  expect(result.current.entries).toHaveLength(1);
  expect(result.current.entries[0].id).toBe('a');
});

it('clearAll removes all entries', async () => {
  mockLoad.mockResolvedValue([
    { id: 'a', ts: 1000, text: 'first' },
    { id: 'b', ts: 2000, text: 'second' },
  ]);
  const { result } = renderHook(() => useEntries());
  await waitFor(() => expect(result.current.loaded).toBe(true));
  act(() => { result.current.clearAll(); });
  expect(result.current.entries).toEqual([]);
});

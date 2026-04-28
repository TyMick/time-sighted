import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import Index from '../app/index';
import type { Entry } from '../src/types';

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return { id: 'e1', ts: 1_000_000, text: 'test entry', ...overrides };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runAllTimers();
  jest.useRealTimers();
});

describe('Index screen', () => {
  it('renders the app title', async () => {
    render(<Index />);
    await waitFor(() => expect(screen.getByText('Time Sighted')).toBeTruthy());
  });

  it('shows the empty state once entries have loaded', async () => {
    render(<Index />);
    await waitFor(() => expect(screen.getByText('Nothing logged yet')).toBeTruthy());
  });

  it('adds an entry and shows it in the timeline', async () => {
    const user = userEvent.setup();
    render(<Index />);
    await waitFor(() => screen.getByText('Nothing logged yet'));
    await user.type(screen.getByPlaceholderText('What are you switching to?'), 'deep work');
    await user.press(screen.getByLabelText('Log entry'));
    await waitFor(() => expect(screen.getByText('deep work')).toBeTruthy());
  });

  it('ignores blank submissions', async () => {
    const user = userEvent.setup();
    render(<Index />);
    await waitFor(() => screen.getByText('Nothing logged yet'));
    await user.press(screen.getByLabelText('Log entry'));
    expect(screen.getByText('Nothing logged yet')).toBeTruthy();
  });

  it('renders entries loaded from storage', async () => {
    await AsyncStorage.setItem('now_entries', JSON.stringify([makeEntry({ text: 'focused coding' })]));
    render(<Index />);
    await waitFor(() => expect(screen.getByText('focused coding')).toBeTruthy());
  });

  it('removes an entry when delete is pressed', async () => {
    await AsyncStorage.setItem('now_entries', JSON.stringify([makeEntry({ text: 'to delete' })]));
    const user = userEvent.setup();
    render(<Index />);
    await waitFor(() => screen.getByText('to delete'));
    await user.press(screen.getByLabelText('Delete this entry'));
    await waitFor(() => expect(screen.queryByText('to delete')).toBeNull());
  });

  it('fills the input with the entry text when reuse is pressed', async () => {
    await AsyncStorage.setItem('now_entries', JSON.stringify([makeEntry({ text: 'team sync' })]));
    const user = userEvent.setup();
    render(<Index />);
    await waitFor(() => screen.getByText('team sync'));
    await user.press(screen.getByLabelText('Reuse this entry'));
    expect(screen.getByDisplayValue('team sync')).toBeTruthy();
  });

  it('shows a confirmation alert before clearing', async () => {
    await AsyncStorage.setItem('now_entries', JSON.stringify([makeEntry()]));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<Index />);
    await waitFor(() => screen.getByText('test entry'));
    await user.press(screen.getByText('✕'));
    expect(alertSpy).toHaveBeenCalled();
    expect(screen.getByText('test entry')).toBeTruthy();
    alertSpy.mockRestore();
  });
});

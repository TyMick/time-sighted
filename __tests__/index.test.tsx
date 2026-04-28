import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import Index from '../app/index';
import { useEntries } from '../src/useEntries';
import type { Entry } from '../src/types';

jest.mock('../src/useEntries');

const mockUseEntries = useEntries as jest.MockedFunction<typeof useEntries>;

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return { id: '1', ts: Date.now(), text: 'test entry', ...overrides };
}

function setupMock(overrides: Partial<ReturnType<typeof useEntries>> = {}) {
  const addEntry = jest.fn();
  const removeEntry = jest.fn();
  const clearAll = jest.fn();
  mockUseEntries.mockReturnValue({
    entries: [],
    loaded: true,
    addEntry,
    removeEntry,
    clearAll,
    ...overrides,
  });
  return { addEntry, removeEntry, clearAll };
}

describe('Index screen', () => {
  it('renders the app title', () => {
    setupMock();
    render(<Index />);
    expect(screen.getByText('Time Sighted')).toBeTruthy();
  });

  it('shows the empty state when there are no entries', () => {
    setupMock({ entries: [] });
    render(<Index />);
    expect(screen.getByText('Nothing logged yet')).toBeTruthy();
  });

  it('calls addEntry with trimmed text on submit via keyboard', () => {
    const { addEntry } = setupMock();
    render(<Index />);
    const input = screen.getByPlaceholderText('What are you switching to?');
    fireEvent.changeText(input, '  deep work  ');
    fireEvent(input, 'submitEditing');
    expect(addEntry).toHaveBeenCalledWith('deep work');
  });

  it('calls addEntry when pressing the submit button', () => {
    const { addEntry } = setupMock();
    render(<Index />);
    const input = screen.getByPlaceholderText('What are you switching to?');
    fireEvent.changeText(input, 'lunch break');
    fireEvent.press(screen.getByLabelText('Log entry'));
    expect(addEntry).toHaveBeenCalledWith('lunch break');
  });

  it('does not call addEntry for blank input', () => {
    const { addEntry } = setupMock();
    render(<Index />);
    fireEvent.press(screen.getByLabelText('Log entry'));
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('renders entry text in the list', () => {
    setupMock({ entries: [makeEntry({ text: 'focused coding' })] });
    render(<Index />);
    expect(screen.getByText('focused coding')).toBeTruthy();
  });

  it('calls removeEntry with the entry id when delete is pressed', () => {
    const entry = makeEntry({ id: 'abc123', text: 'to delete' });
    const { removeEntry } = setupMock({ entries: [entry] });
    render(<Index />);
    fireEvent.press(screen.getByLabelText('Delete this entry'));
    expect(removeEntry).toHaveBeenCalledWith('abc123');
  });

  it('fills the input with entry text when reuse is pressed', () => {
    const entry = makeEntry({ text: 'team sync' });
    setupMock({ entries: [entry] });
    render(<Index />);
    fireEvent.press(screen.getByLabelText('Reuse this entry'));
    expect(screen.getByDisplayValue('team sync')).toBeTruthy();
  });

  it('shows a confirmation alert before clearing and does not clear without confirmation', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const entry = makeEntry();
    const { clearAll } = setupMock({ entries: [entry] });
    render(<Index />);
    fireEvent.press(screen.getByText('✕'));
    expect(alertSpy).toHaveBeenCalled();
    expect(clearAll).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

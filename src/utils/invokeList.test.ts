import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// zoox's empty "Notify me about": a first call to Rust that failed or never
// answered left the list empty for the whole run.

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...a: unknown[]) => invokeMock(...a) }));
vi.mock('./logger', () => ({ Logger: { info: vi.fn(), warn: vi.fn() } }));

import { invokeList } from './invokeList';

beforeEach(() => {
  vi.useFakeTimers();
  invokeMock.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('a list read from Rust', () => {
  it('tries again after a failed call', async () => {
    invokeMock.mockRejectedValueOnce(new Error('ipc not ready')).mockResolvedValueOnce([{ id: 'live' }]);
    const read = invokeList<{ id: string }>('get_alert_types');
    await vi.runAllTimersAsync();
    expect(await read).toEqual([{ id: 'live' }]);
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it('starts another call when one never answers', async () => {
    invokeMock.mockReturnValueOnce(new Promise(() => {})).mockResolvedValueOnce([{ id: 'live' }]);
    const read = invokeList<{ id: string }>('get_alert_types');
    await vi.runAllTimersAsync();
    expect(await read).toEqual([{ id: 'live' }]);
  });

  it('does not settle on an empty answer while tries are left', async () => {
    invokeMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'live' }]);
    const read = invokeList<{ id: string }>('get_alert_types');
    await vi.runAllTimersAsync();
    expect(await read).toEqual([{ id: 'live' }]);
  });

  it('gives up with an empty list only after every try', async () => {
    invokeMock.mockRejectedValue(new Error('gone'));
    const read = invokeList<{ id: string }>('get_alert_types');
    await vi.runAllTimersAsync();
    expect(await read).toEqual([]);
    expect(invokeMock.mock.calls.length).toBeGreaterThan(5);
  });
});

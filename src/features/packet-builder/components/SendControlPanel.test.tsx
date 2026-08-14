import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LanguageProvider } from '@/app/providers/LanguageProvider';

import type { SendSchedulerConfig, SendSchedulerState } from '../sendScheduler';
import { SendControlPanel } from './SendControlPanel';

/**
 * Seçiciler `data-testid` ve rol üzerinden; panelin çeviri anahtarları sözlüğe
 * henüz eklenmedi ve `t()` boş döner.
 */

const IDLE_STATE: SendSchedulerState = { running: false, sentCount: 0, lastErrorKey: null };

const ONCE_CONFIG: SendSchedulerConfig = { mode: 'once', intervalMs: 1000, count: 10 };

interface RenderOptions {
  readonly config?: SendSchedulerConfig;
  readonly state?: SendSchedulerState;
  readonly canSend?: boolean;
  readonly responseTimeoutMs?: number;
  readonly lastResponse?: Uint8Array | null;
}

function renderPanel(options: RenderOptions = {}): {
  readonly onConfigChange: ReturnType<typeof vi.fn>;
  readonly onResponseTimeoutMsChange: ReturnType<typeof vi.fn>;
  readonly onSend: ReturnType<typeof vi.fn>;
  readonly onStop: ReturnType<typeof vi.fn>;
} {
  const handlers = {
    onConfigChange: vi.fn(),
    onResponseTimeoutMsChange: vi.fn(),
    onSend: vi.fn(),
    onStop: vi.fn(),
  };

  render(
    <LanguageProvider>
      <SendControlPanel
        config={options.config ?? ONCE_CONFIG}
        responseTimeoutMs={options.responseTimeoutMs ?? 500}
        state={options.state ?? IDLE_STATE}
        canSend={options.canSend ?? true}
        lastResponse={options.lastResponse ?? null}
        {...handlers}
      />
    </LanguageProvider>,
  );
  return handlers;
}

function elementById(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`#${id} was not rendered`);
  }
  return element;
}

describe('SendControlPanel', () => {
  it('offers the three modes the scheduler implements', () => {
    renderPanel();

    const select = elementById('builder-send-mode-select');
    const values = within(select).getAllByRole('option').map((option) => option.getAttribute('value'));
    expect(values).toEqual(['once', 'count', 'periodic']);
  });

  it('reports a mode change to its owner', () => {
    const handlers = renderPanel();

    fireEvent.change(elementById('builder-send-mode-select'), { target: { value: 'periodic' } });

    expect(handlers.onConfigChange).toHaveBeenCalledWith({ ...ONCE_CONFIG, mode: 'periodic' });
  });

  it('hides interval and count in the single shot mode', () => {
    renderPanel();

    // 'once' modunda periyot ve tekrar sayısı anlamsız; gösterilseydi kullanıcı
    // ayarladığı değerin işe yaradığını sanardı.
    expect(screen.queryByTestId('builder-send-interval')).not.toBeInTheDocument();
    expect(screen.queryByTestId('builder-send-count')).not.toBeInTheDocument();
  });

  it('shows the interval but not the repeat count while periodic', () => {
    renderPanel({ config: { mode: 'periodic', intervalMs: 250, count: 10 } });

    expect(screen.getByTestId('builder-send-interval')).toBeInTheDocument();
    expect(screen.queryByTestId('builder-send-count')).not.toBeInTheDocument();
  });

  it('shows both interval and count while repeating a fixed number of times', () => {
    renderPanel({ config: { mode: 'count', intervalMs: 250, count: 4 } });

    expect(screen.getByTestId('builder-send-interval')).toBeInTheDocument();
    expect(screen.getByTestId('builder-send-count')).toBeInTheDocument();
  });

  it('passes the interval on as a number', () => {
    const handlers = renderPanel({ config: { mode: 'periodic', intervalMs: 250, count: 10 } });

    fireEvent.change(elementById('builder-send-interval-input'), { target: { value: '80' } });

    expect(handlers.onConfigChange).toHaveBeenCalledWith({ mode: 'periodic', intervalMs: 80, count: 10 });
  });

  it('passes the repeat count on as a number', () => {
    const handlers = renderPanel({ config: { mode: 'count', intervalMs: 250, count: 4 } });

    fireEvent.change(elementById('builder-send-count-input'), { target: { value: '7' } });

    expect(handlers.onConfigChange).toHaveBeenCalledWith({ mode: 'count', intervalMs: 250, count: 7 });
  });

  it('passes the response window on as a number', () => {
    const handlers = renderPanel();

    fireEvent.change(elementById('builder-send-timeout-input'), { target: { value: '120' } });

    expect(handlers.onResponseTimeoutMsChange).toHaveBeenCalledWith(120);
  });

  it('starts and stops the loop through its owner', () => {
    const handlers = renderPanel({ state: { running: true, sentCount: 3, lastErrorKey: null } });

    fireEvent.click(screen.getByTestId('builder-stop'));
    expect(handlers.onStop).toHaveBeenCalledTimes(1);

    // Koşarken yeniden başlatmak iki döngü demek olurdu; düğme kapalı.
    expect(screen.getByTestId('builder-send')).toBeDisabled();
  });

  it('sends when it is allowed to', () => {
    const handlers = renderPanel();

    fireEvent.click(screen.getByTestId('builder-send'));

    expect(handlers.onSend).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('builder-stop')).toBeDisabled();
  });

  it('explains why sending is blocked', () => {
    renderPanel({ canSend: false });

    expect(screen.getByTestId('builder-send')).toBeDisabled();
    expect(screen.getByTestId('builder-send-disabled')).toBeInTheDocument();
  });

  it('counts the packets that actually went out', () => {
    renderPanel({ state: { running: false, sentCount: 12, lastErrorKey: null } });

    expect(screen.getByTestId('builder-sent-count').textContent).toBe('12');
  });

  it('announces the failure that stopped the loop', () => {
    renderPanel({
      state: { running: false, sentCount: 2, lastErrorKey: 'builder.error.cannotWrite' },
    });

    expect(screen.getByTestId('builder-send-error')).toHaveAttribute('role', 'alert');
  });

  it('shows the reply as hex, and says so when there is none', () => {
    renderPanel({ lastResponse: Uint8Array.from([0xaa, 0x01, 0x55]) });

    expect(screen.getByTestId('builder-last-response').textContent).toBe('AA0155');
    expect(screen.queryByTestId('builder-last-response-empty')).not.toBeInTheDocument();
  });

  it('treats a missing reply as an ordinary state, not an error', () => {
    renderPanel({ lastResponse: null });

    expect(screen.getByTestId('builder-last-response-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('builder-send-error')).not.toBeInTheDocument();
  });
});

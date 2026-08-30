import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LanguageProvider } from '@/app/providers/LanguageProvider';

import type { BuilderConnectionState, BuilderSourceKind } from '../builderTypes';
import { BuilderConnectionPanel } from './BuilderConnectionPanel';

/**
 * Seçiciler `data-testid` ve rol üzerinden kurulu, METİN ÜZERİNDEN DEĞİL:
 * panelin çeviri anahtarları sözlüğe henüz eklenmedi, `t()` bu yüzden boş
 * döner. Ada göre arayan bir test, anahtar eklendiği gün de kırılırdı.
 */

const holder = vi.hoisted(() => ({ serialSupported: true }));

vi.mock('@/connection/serial/webSerialTypes', () => ({
  isWebSerialSupported: () => holder.serialSupported,
  requestSerialPort: vi.fn(),
}));

function connectionState(patch: Partial<BuilderConnectionState> = {}): BuilderConnectionState {
  return { status: 'disconnected', kind: null, canWrite: false, errorKey: null, ...patch };
}

interface RenderOptions {
  readonly connection?: BuilderConnectionState;
  readonly selectedKind?: BuilderSourceKind;
  readonly webSocketUrl?: string;
}

function renderPanel(options: RenderOptions = {}): {
  readonly onSelectedKindChange: ReturnType<typeof vi.fn>;
  readonly onConnect: ReturnType<typeof vi.fn>;
  readonly onDisconnect: ReturnType<typeof vi.fn>;
  readonly onWebSocketUrlChange: ReturnType<typeof vi.fn>;
} {
  const handlers = {
    onSelectedKindChange: vi.fn(),
    onConnect: vi.fn(),
    onDisconnect: vi.fn(),
    onWebSocketUrlChange: vi.fn(),
  };

  const element: ReactElement = (
    <LanguageProvider>
      <BuilderConnectionPanel
        connection={options.connection ?? connectionState()}
        selectedKind={options.selectedKind ?? 'simulated'}
        webSocketUrl={options.webSocketUrl ?? 'ws://localhost:8080'}
        {...handlers}
      />
    </LanguageProvider>
  );
  render(element);
  return handlers;
}

beforeEach(() => {
  holder.serialSupported = true;
});

describe('BuilderConnectionPanel', () => {
  it('marks the selected source as pressed', () => {
    renderPanel({ selectedKind: 'serial' });

    expect(screen.getByTestId('builder-source-serial')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('builder-source-simulated')).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the picked source to its owner', () => {
    const handlers = renderPanel({ selectedKind: 'simulated' });

    fireEvent.click(screen.getByTestId('builder-source-serial'));

    expect(handlers.onSelectedKindChange).toHaveBeenCalledWith('serial');
  });

  /** Uzun süre "planlandı" rozetli devre dışı bir düğmeydi; kaynak yazılınca seçilebilir oldu. */
  it('offers WebSocket as a real source and asks for its address only then', () => {
    renderPanel({ selectedKind: 'simulated' });

    expect(screen.getByTestId('builder-source-websocket')).toBeEnabled();
    // Adres kutusu seri/simülasyon seçiliyken görünmez: karşılığı olmayan alan basılmaz.
    expect(screen.queryByTestId('builder-websocket-url')).not.toBeInTheDocument();
  });

  it('shows the address field with the WebSocket source selected', () => {
    const handlers = renderPanel({ selectedKind: 'websocket', webSocketUrl: 'ws://localhost:9099' });

    expect(screen.getByTestId('builder-websocket-url')).toHaveValue('ws://localhost:9099');

    fireEvent.change(screen.getByTestId('builder-websocket-url'), {
      target: { value: 'wss://bridge.example/line' },
    });
    expect(handlers.onWebSocketUrlChange).toHaveBeenCalledWith('wss://bridge.example/line');
  });

  it('disables the serial source and explains why when the browser lacks Web Serial', () => {
    holder.serialSupported = false;
    renderPanel();

    expect(screen.getByTestId('builder-source-serial')).toBeDisabled();
    expect(screen.getByTestId('builder-serial-unsupported')).toBeInTheDocument();
  });

  it('offers connecting while disconnected', () => {
    const handlers = renderPanel();

    fireEvent.click(screen.getByTestId('builder-connect'));

    expect(handlers.onConnect).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('builder-disconnect')).not.toBeInTheDocument();
  });

  it('offers disconnecting while connected', () => {
    const handlers = renderPanel({
      connection: connectionState({ status: 'connected', kind: 'serial', canWrite: true }),
    });

    fireEvent.click(screen.getByTestId('builder-disconnect'));

    expect(handlers.onDisconnect).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('builder-connect')).not.toBeInTheDocument();
  });

  it('locks the source choice while a connection is live', () => {
    renderPanel({
      connection: connectionState({ status: 'connected', kind: 'simulated', canWrite: false }),
    });

    expect(screen.getByTestId('builder-source-serial')).toBeDisabled();
    expect(screen.getByTestId('builder-source-simulated')).toBeDisabled();
  });

  it('blocks a second connect attempt while one is in flight', () => {
    renderPanel({ connection: connectionState({ status: 'connecting', kind: 'serial' }) });

    expect(screen.getByTestId('builder-connect')).toBeDisabled();
  });

  it('warns that a connected read-only source cannot send', () => {
    renderPanel({
      connection: connectionState({ status: 'connected', kind: 'simulated', canWrite: false }),
    });

    expect(screen.getByTestId('builder-cannot-write')).toBeInTheDocument();
  });

  it('keeps quiet about writing when the source can write', () => {
    renderPanel({
      connection: connectionState({ status: 'connected', kind: 'serial', canWrite: true }),
    });

    expect(screen.queryByTestId('builder-cannot-write')).not.toBeInTheDocument();
  });

  it('announces a connection error through an alert', () => {
    renderPanel({
      connection: connectionState({ status: 'error', kind: 'serial', errorKey: 'builder.error.portBusy' }),
    });

    expect(screen.getByTestId('builder-connection-error')).toHaveAttribute('role', 'alert');
  });
});

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LanguageProvider } from '@/app/providers/LanguageProvider';
import { SPEC_BUILDER_FRAME } from '@/protocol-core/schemas/specFixture';

import type { FramingPluginOption } from '../builderTypes';
import type { PacketIssue, PostProcessing } from '../packetPipeline';
import { PacketPreviewPanel } from './PacketPreviewPanel';

/**
 * Seçiciler `data-testid` ve rol üzerinden; panelin çeviri anahtarları sözlüğe
 * henüz eklenmedi ve `t()` boş döner. Doğrulanan metinler ÜRETİLEN çıktılardır
 * (hex, C/Python/JS dizisi) — onlar koddan gelir, sözlükten değil.
 */

/** `AA 05 20 02 02 4B 6E 55` — spec §10 örneği. */
const FRAME_HEX = 'AA052002024B6E55';

/** Plugin zarfları defterden gelir; panel testi listenin İÇERİĞİNİ değil davranışını sınar. */
const FRAMING_PLUGINS: readonly FramingPluginOption[] = [
  { pluginId: 'hdlc', displayName: 'HDLC' },
  { pluginId: 'xmodem', displayName: 'XMODEM', fixedParametersKey: 'builder.encoder.fixed.xmodem' },
];

interface RenderOptions {
  readonly bytes?: Uint8Array | null;
  readonly issues?: readonly PacketIssue[];
  readonly hexOverride?: string | null;
  readonly postProcessing?: PostProcessing;
  readonly framingPluginId?: string | null;
}

function renderPanel(options: RenderOptions = {}): {
  readonly onHexOverrideChange: ReturnType<typeof vi.fn>;
  readonly onPostProcessingChange: ReturnType<typeof vi.fn>;
  readonly onFramingPluginChange: ReturnType<typeof vi.fn>;
} {
  const handlers = {
    onHexOverrideChange: vi.fn(),
    onPostProcessingChange: vi.fn(),
    onFramingPluginChange: vi.fn(),
  };

  render(
    <LanguageProvider>
      <PacketPreviewPanel
        bytes={options.bytes === undefined ? SPEC_BUILDER_FRAME : options.bytes}
        issues={options.issues ?? []}
        hexOverride={options.hexOverride ?? null}
        postProcessing={options.postProcessing ?? 'none'}
        framingPluginId={options.framingPluginId ?? null}
        framingPlugins={FRAMING_PLUGINS}
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

describe('PacketPreviewPanel', () => {
  it('says there is nothing to show when no packet could be built', () => {
    renderPanel({ bytes: null });

    expect(screen.getByTestId('builder-preview-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('builder-byte-viewer')).not.toBeInTheDocument();
  });

  it('draws the packet bytes and their count', () => {
    renderPanel();

    expect(screen.getByTestId('builder-byte-viewer').textContent).toContain('AA 05 20');
    expect(screen.getByTestId('builder-preview-byte-count').textContent).toBe('8');
  });

  it('leaves the byte view uncoloured and says where field colours live', () => {
    renderPanel();

    // `buildPacket` bölge döndürmüyor; uydurulmuş bölge checksum'un neyin
    // üzerinde hesaplandığı konusunda yanlış bilgi verirdi.
    expect(within(screen.getByTestId('builder-byte-viewer')).queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByTestId('builder-preview-regions-note')).toBeInTheDocument();
  });

  it('shows the packet as copyable hex', () => {
    renderPanel();

    expect(elementById('builder-preview-hex-value').textContent).toBe(FRAME_HEX);
  });

  it('generates the packet in three languages', () => {
    renderPanel();

    expect(elementById('builder-code-c-value').textContent).toContain('uint8_t packet[]');
    expect(elementById('builder-code-python-value').textContent).toContain('packet = bytes([');
    expect(elementById('builder-code-javascript-value').textContent).toContain(
      'const packet = new Uint8Array([',
    );
  });

  it('reports a post processing choice to its owner', () => {
    const handlers = renderPanel();

    fireEvent.change(elementById('builder-post-processing'), { target: { value: 'cobs' } });

    expect(handlers.onPostProcessingChange).toHaveBeenCalledWith('cobs');
  });

  it('offers every post processing mode the engine implements, then the plugin envelopes', () => {
    renderPanel();

    const select = elementById('builder-post-processing');
    const values = within(select).getAllByRole('option').map((option) => option.getAttribute('value'));
    expect(values).toEqual([
      'none',
      'byteStuffing',
      'bitStuffing',
      'cobs',
      'slip',
      'plugin:hdlc',
      'plugin:xmodem',
    ]);
  });

  it('reports a plugin envelope by its plugin id, not as a post processing mode', () => {
    const handlers = renderPanel();

    fireEvent.change(elementById('builder-post-processing'), { target: { value: 'plugin:hdlc' } });

    expect(handlers.onFramingPluginChange).toHaveBeenCalledWith('hdlc');
    expect(handlers.onPostProcessingChange).not.toHaveBeenCalled();
  });

  it('keeps the plugin envelope selected while it is in use', () => {
    renderPanel({ postProcessing: 'plugin', framingPluginId: 'hdlc' });

    expect(elementById('builder-post-processing')).toHaveValue('plugin:hdlc');
  });

  /** Tek parametreli `encode` sözleşmesinin sabitlediği parametreler GİZLENMEZ. */
  it('warns about the parameters the single-argument encoder contract fixes', () => {
    renderPanel({ postProcessing: 'plugin', framingPluginId: 'xmodem' });

    expect(screen.getByTestId('builder-framing-fixed-note')).toBeInTheDocument();
  });

  it('shows no fixed-parameter warning for an envelope that has none', () => {
    renderPanel({ postProcessing: 'plugin', framingPluginId: 'hdlc' });

    expect(screen.queryByTestId('builder-framing-fixed-note')).toBeNull();
  });

  it('seeds the hex override with the current packet when it is switched on', () => {
    const handlers = renderPanel();

    fireEvent.click(screen.getByTestId('builder-hex-override-toggle'));

    // Boş kutu açmak, kullanıcıyı elindeki paketi elle yeniden yazmaya zorlardı.
    expect(handlers.onHexOverrideChange).toHaveBeenCalledWith(FRAME_HEX);
  });

  it('clears the override when it is switched off', () => {
    const handlers = renderPanel({ hexOverride: FRAME_HEX });

    fireEvent.click(screen.getByTestId('builder-hex-override-toggle'));

    expect(handlers.onHexOverrideChange).toHaveBeenCalledWith(null);
  });

  it('edits the override text without touching the form', () => {
    const handlers = renderPanel({ hexOverride: FRAME_HEX });

    fireEvent.change(elementById('builder-hex-override-value'), { target: { value: 'DEAD' } });

    expect(handlers.onHexOverrideChange).toHaveBeenCalledWith('DEAD');
  });

  it('hides the override entry while it is switched off', () => {
    renderPanel();

    expect(screen.queryByTestId('builder-hex-override')).not.toBeInTheDocument();
  });

  it('announces build issues as alerts', () => {
    renderPanel({
      issues: [
        { fieldId: null, messageKey: 'builder.error.invalidHex' },
        { fieldId: 'payload', messageKey: 'builder.issue.invalidValue', params: { detail: 'oops' } },
      ],
    });

    expect(within(screen.getByTestId('builder-preview-issues')).getAllByRole('alert')).toHaveLength(2);
  });
});

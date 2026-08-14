import { fireEvent, render, screen } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LanguageProvider } from '@/app/providers/LanguageProvider';
import { parsedFrameToRegions } from '@/components/byte-viewer';
import type { ByteRegion } from '@/components/byte-viewer';
import { parseWithSchema } from '@/protocol-core';
import { isParseSuccess } from '@/protocol-core/types';
import { SPEC_SENSOR_FRAME, SPEC_SENSOR_PROTOCOL } from '@/protocol-core/schemas/specFixture';

import { BitGridView, FrameViewPanel } from './FrameViewPanel';
import type { FrameViewPanelProps } from './FrameViewPanel';

/**
 * Metin beklentisi YOK: panelin çeviri anahtarları sözlüğe henüz eklenmedi,
 * `t()` bu yüzden boş döner. Seçiciler data-testid ve role üzerinden kurulur.
 */

/** Gerçek ayrıştırma çıktısı; el yazımı bölge listesi renk sırasını taklit edemez. */
function regionsOf(frame: Uint8Array): readonly ByteRegion[] {
  const result = parseWithSchema(SPEC_SENSOR_PROTOCOL, frame);
  if (!isParseSuccess(result)) {
    throw new Error(`Fixture ayrıştırılamadı: ${result.error.message}`);
  }
  return parsedFrameToRegions(result.frame);
}

const SPEC_REGIONS = regionsOf(SPEC_SENSOR_FRAME);

/** Bozuk checksum: çerçeve çözülür ama checksum alanı geçersiz işaretlenir. */
const CORRUPTED_FRAME = ((): Uint8Array => {
  const frame = Uint8Array.from(SPEC_SENSOR_FRAME);
  frame[7] = 0x00;
  return frame;
})();

function renderPanel(overrides: Partial<FrameViewPanelProps> = {}): RenderResult {
  const props: FrameViewPanelProps = {
    bytes: SPEC_SENSOR_FRAME,
    regions: SPEC_REGIONS,
    hexInput: 'AA 05 10 03 34 12 7F 4F 55',
    hexErrorKey: null,
    selectedRegionId: null,
    onHexInputChange: vi.fn(),
    onSelectRegion: vi.fn(),
    ...overrides,
  };
  return render(
    <LanguageProvider>
      <FrameViewPanel {...props} />
    </LanguageProvider>,
  );
}

function switchTo(mode: 'hexAscii' | 'hexOnly' | 'bits'): void {
  fireEvent.click(screen.getByTestId(`frame-view-mode-${mode}`));
}

describe('FrameViewPanel — hex girdisi', () => {
  it('shows the current hex input in a multiline field', () => {
    renderPanel();

    const input = screen.getByRole('textbox');

    expect(input.tagName).toBe('TEXTAREA');
    expect(input).toHaveValue('AA 05 10 03 34 12 7F 4F 55');
  });

  it('reports every hex keystroke without touching its own state', () => {
    const onHexInputChange = vi.fn();
    renderPanel({ onHexInputChange });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'AA BB' } });

    expect(onHexInputChange).toHaveBeenCalledTimes(1);
    expect(onHexInputChange).toHaveBeenCalledWith('AA BB');
    // Kontrollü alan: değer yalnız prop'tan gelir.
    expect(screen.getByRole('textbox')).toHaveValue('AA 05 10 03 34 12 7F 4F 55');
  });

  it('marks the hex input invalid and announces the error when hexErrorKey is set', () => {
    // `useProtocolStudio` geçersiz hex'in her türünü bu tek anahtara eşliyor;
    // uydurma bir anahtar kullanmak sözlükte ölü kayıt bırakırdı.
    renderPanel({ hexErrorKey: 'studio.error.invalidHex' });

    const input = screen.getByRole('textbox');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.className).toContain('border-danger');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-describedby', 'studio-frame-hex-error');
  });

  it('leaves the hex input clean when there is no error key', () => {
    renderPanel();

    const input = screen.getByRole('textbox');

    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(input.className).toContain('border-line');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('FrameViewPanel — görünüm modları', () => {
  it('exposes the three view modes as a radiogroup', () => {
    renderPanel();

    const radios = screen.getAllByRole('radio');

    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(radios).toHaveLength(3);
    expect(screen.getByTestId('frame-view-mode-hexAscii')).toHaveAttribute('aria-checked', 'true');
  });

  it('shows hex and ascii columns by default', () => {
    renderPanel();

    expect(screen.getByTestId('byte-viewer-hex')).toHaveTextContent('AA 05 10 03 34 12 7F 4F 55');
    expect(screen.getByTestId('byte-viewer-ascii')).toBeInTheDocument();
    expect(screen.queryByTestId('bit-grid')).toBeNull();
  });

  it('drops the ascii column in hex-only mode', () => {
    renderPanel();

    switchTo('hexOnly');

    expect(screen.getByTestId('byte-viewer-hex')).toBeInTheDocument();
    expect(screen.queryByTestId('byte-viewer-ascii')).toBeNull();
    expect(screen.getByTestId('frame-view-mode-hexOnly')).toHaveAttribute('aria-checked', 'true');
  });

  it('replaces the byte viewer with the bit grid in bit mode', () => {
    renderPanel();

    switchTo('bits');

    expect(screen.queryByTestId('byte-viewer')).toBeNull();
    expect(screen.getByTestId('bit-grid')).toBeInTheDocument();
  });
});

describe('FrameViewPanel — bit ızgarası', () => {
  it('renders exactly eight bit cells per byte', () => {
    renderPanel();

    switchTo('bits');

    expect(screen.getAllByTestId('bit-grid-byte')).toHaveLength(SPEC_SENSOR_FRAME.length);
    expect(screen.getAllByTestId('bit-grid-cell')).toHaveLength(SPEC_SENSOR_FRAME.length * 8);
  });

  it('prints each byte MSB-first', () => {
    renderPanel();

    switchTo('bits');

    const bytes = screen.getAllByTestId('bit-grid-bits');

    // 0xAA = 1010 1010, 0x05 = 0000 0101 — soldan sağa 7. bitten 0. bite.
    expect(bytes[0]?.textContent).toBe('10101010');
    expect(bytes[1]?.textContent).toBe('00000101');
  });

  it('colors the bits of a field with its series token', () => {
    const { container } = renderPanel();

    switchTo('bits');

    // `address` bölge listesinin ilk yaprağı: renk döngüsünde 0. sıra.
    const cells = container.querySelectorAll('[data-testid="bit-grid-cell"][data-region-id="address"]');

    expect(cells).toHaveLength(8);
    expect(cells[0]?.className).toContain('text-series-1');
    expect(cells[0]?.className).toContain('bg-series-1/10');
  });

  it('marks the bits of an invalid field with the danger token', () => {
    const { container } = renderPanel({
      bytes: CORRUPTED_FRAME,
      regions: regionsOf(CORRUPTED_FRAME),
    });

    switchTo('bits');

    const cells = container.querySelectorAll('[data-testid="bit-grid-cell"][data-region-id="checksum"]');

    expect(cells).toHaveLength(8);
    expect(cells[0]?.className).toContain('bg-danger-soft');
    expect(cells[0]?.className).toContain('text-danger');
    expect(cells[0]).toHaveAttribute('data-invalid', 'true');
  });

  it('leaves bytes outside every field unclickable', () => {
    const { container } = renderPanel();

    switchTo('bits');

    // 0xAA çerçeveleme baytı hiçbir alana ait değil: buton değil, düz metin.
    const firstByte = screen.getAllByTestId('bit-grid-byte')[0];

    expect(firstByte?.querySelectorAll('button')).toHaveLength(0);
    expect(container.querySelectorAll('[data-testid="bit-grid-cell"][data-region-id]')).toHaveLength(
      (SPEC_SENSOR_FRAME.length - 2) * 8,
    );
  });
});

describe('FrameViewPanel — seçim', () => {
  it('selects a region when a hex segment is clicked', () => {
    const onSelectRegion = vi.fn();
    renderPanel({ onSelectRegion });

    fireEvent.click(screen.getByRole('button', { name: 'Device Address @0x0001 +1' }));

    expect(onSelectRegion).toHaveBeenCalledWith('address');
  });

  it('clears the selection when the selected region is clicked again', () => {
    const onSelectRegion = vi.fn();
    renderPanel({ onSelectRegion, selectedRegionId: 'address' });

    fireEvent.click(screen.getByRole('button', { name: 'Device Address @0x0001 +1' }));

    expect(onSelectRegion).toHaveBeenCalledWith(null);
  });

  it('selects a region when a bit cell is clicked', () => {
    const onSelectRegion = vi.fn();
    const { container } = renderPanel({ onSelectRegion });

    switchTo('bits');
    const cell = container.querySelector('[data-testid="bit-grid-cell"][data-region-id="command"]');
    fireEvent.click(cell as Element);

    expect(onSelectRegion).toHaveBeenCalledWith('command');
  });

  it('toggles the selection off from the bit grid too', () => {
    const onSelectRegion = vi.fn();
    const { container } = renderPanel({ onSelectRegion, selectedRegionId: 'command' });

    switchTo('bits');
    const cell = container.querySelector('[data-testid="bit-grid-cell"][data-region-id="command"]');
    fireEvent.click(cell as Element);

    expect(onSelectRegion).toHaveBeenCalledWith(null);
  });

  it('marks the selected region in both views', () => {
    const { container } = renderPanel({ selectedRegionId: 'payload' });

    expect(container.querySelector('[data-region-id="payload"]')).toHaveAttribute(
      'data-selected',
      'true',
    );

    switchTo('bits');

    expect(
      container.querySelector('[data-testid="bit-grid-cell"][data-region-id="payload"]'),
    ).toHaveAttribute('data-selected', 'true');
  });
});

describe('FrameViewPanel — düzen ayarları', () => {
  it('re-lays out the rows when bytesPerRow changes', () => {
    renderPanel();

    expect(screen.getAllByTestId('byte-viewer-offset').map((node) => node.textContent)).toEqual([
      '0000:',
    ]);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '8' } });

    expect(screen.getAllByTestId('byte-viewer-offset').map((node) => node.textContent)).toEqual([
      '0000:',
      '0008:',
    ]);
  });

  it('hides the offset column of the byte viewer through the checkbox', () => {
    renderPanel();

    expect(screen.getAllByTestId('byte-viewer-offset').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('checkbox'));

    expect(screen.queryByTestId('byte-viewer-offset')).toBeNull();
    expect(screen.getByTestId('byte-viewer-hex')).toBeInTheDocument();
  });

  it('hides the per-byte offsets of the bit grid through the same checkbox', () => {
    renderPanel();

    switchTo('bits');
    expect(screen.getAllByTestId('bit-grid-offset')).toHaveLength(SPEC_SENSOR_FRAME.length);

    fireEvent.click(screen.getByRole('checkbox'));

    expect(screen.queryByTestId('bit-grid-offset')).toBeNull();
  });

  it('keeps the bit grid in one row per bytesPerRow bytes', () => {
    renderPanel();

    switchTo('bits');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '8' } });

    expect(screen.getAllByTestId('bit-grid-offset').map((node) => node.textContent)).toEqual([
      '0000',
      '0001',
      '0002',
      '0003',
      '0004',
      '0005',
      '0006',
      '0007',
      '0008',
    ]);
  });
});

describe('FrameViewPanel — boş girdi', () => {
  it('shows the empty placeholder instead of a byte grid', () => {
    renderPanel({ bytes: new Uint8Array(), regions: [], hexInput: '' });

    expect(screen.getByTestId('byte-viewer-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('byte-viewer-hex')).toBeNull();
  });

  it('shows the empty placeholder in bit mode as well', () => {
    renderPanel({ bytes: new Uint8Array(), regions: [], hexInput: '' });

    switchTo('bits');

    expect(screen.getByTestId('bit-grid-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('bit-grid-cell')).toBeNull();
  });
});

describe('BitGridView', () => {
  it('renders standalone without a language provider', () => {
    render(
      <BitGridView
        bytes={Uint8Array.from([0x0f])}
        regions={[{ id: 'only', name: 'Only', offset: 0, length: 1, colorIndex: 2 }]}
        bytesPerRow={16}
        hideOffsets={false}
        selectedRegionId={null}
        onSelectRegion={vi.fn()}
        emptyLabel="—"
      />,
    );

    expect(screen.getByTestId('bit-grid-bits').textContent).toBe('00001111');
    expect(screen.getAllByTestId('bit-grid-cell')[0]?.className).toContain('text-series-3');
  });
});

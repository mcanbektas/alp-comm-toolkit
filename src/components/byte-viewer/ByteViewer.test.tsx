import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ByteViewer } from './ByteViewer';
import { MAX_RENDERED_ROWS } from './layout';
import type { ByteRegion } from './types';

/** Spec §43 custom protocol fixture. */
const FIXTURE = new Uint8Array([0xaa, 0x05, 0x10, 0x03, 0x34, 0x12, 0x7f, 0x4f, 0x55]);

const REGIONS: readonly ByteRegion[] = [
  { id: 'sof', name: 'SOF', offset: 0, length: 1 },
  { id: 'length', name: 'Length', offset: 1, length: 1 },
  { id: 'command', name: 'Command', offset: 2, length: 1, invalid: true },
  { id: 'payload', name: 'Payload', offset: 3, length: 3 },
  { id: 'crc', name: 'CRC', offset: 6, length: 2 },
  { id: 'eof', name: 'EOF', offset: 8, length: 1 },
];

describe('ByteViewer', () => {
  it('prints every byte as uppercase hex', () => {
    render(<ByteViewer bytes={FIXTURE} />);

    expect(screen.getByTestId('byte-viewer-hex')).toHaveTextContent('AA 05 10 03 34 12 7F 4F 55');
  });

  it('prints printable characters in the ascii column and dots elsewhere', () => {
    render(<ByteViewer bytes={FIXTURE} />);

    // Boşlukla doldurulmuş kuyruk normalize edilmesin diye textContent'e bakılıyor.
    expect(screen.getByTestId('byte-viewer-ascii').textContent).toContain('....4..OU');
  });

  it('keeps a 0x20 byte visible as a space rather than collapsing it', () => {
    render(<ByteViewer bytes={new Uint8Array([0x41, 0x20, 0x42])} bytesPerRow={3} />);

    expect(screen.getByTestId('byte-viewer-ascii').textContent).toBe('A B');
  });

  it('renders one padded offset label per row', () => {
    render(<ByteViewer bytes={FIXTURE} bytesPerRow={4} />);

    expect(screen.getAllByTestId('byte-viewer-offset').map((node) => node.textContent)).toEqual([
      '0000:',
      '0004:',
      '0008:',
    ]);
  });

  it('hides the offset and ascii columns on demand', () => {
    render(<ByteViewer bytes={FIXTURE} hideOffsets hideAscii />);

    expect(screen.queryByTestId('byte-viewer-offset')).toBeNull();
    expect(screen.queryByTestId('byte-viewer-ascii')).toBeNull();
  });

  it('exposes each region as a button naming its offset and length', () => {
    render(<ByteViewer bytes={FIXTURE} regions={REGIONS} />);

    expect(screen.getByRole('button', { name: 'SOF @0x0000 +1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Payload @0x0003 +3' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(REGIONS.length);
  });

  it('announces the clipped length when a region overruns the frame', () => {
    render(
      <ByteViewer bytes={FIXTURE} regions={[{ id: 'tail', name: 'Tail', offset: 7, length: 10 }]} />,
    );

    expect(screen.getByRole('button', { name: 'Tail @0x0007 +2' })).toBeInTheDocument();
  });

  it('calls onRegionSelect with the clicked region id', () => {
    const onRegionSelect = vi.fn();
    render(<ByteViewer bytes={FIXTURE} regions={REGIONS} onRegionSelect={onRegionSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'CRC @0x0006 +2' }));

    expect(onRegionSelect).toHaveBeenCalledTimes(1);
    expect(onRegionSelect).toHaveBeenCalledWith('crc');
  });

  it('reports hover enter and leave', () => {
    const onRegionHover = vi.fn();
    render(<ByteViewer bytes={FIXTURE} regions={REGIONS} onRegionHover={onRegionHover} />);
    const target = screen.getByRole('button', { name: 'Length @0x0001 +1' });

    fireEvent.mouseEnter(target);
    fireEvent.mouseLeave(target);

    expect(onRegionHover.mock.calls).toEqual([['length'], [null]]);
  });

  it('mirrors hover on keyboard focus', () => {
    const onRegionHover = vi.fn();
    render(<ByteViewer bytes={FIXTURE} regions={REGIONS} onRegionHover={onRegionHover} />);

    fireEvent.focus(screen.getByRole('button', { name: 'EOF @0x0008 +1' }));

    expect(onRegionHover).toHaveBeenCalledWith('eof');
  });

  it('marks an invalid region and leaves valid ones unmarked', () => {
    render(<ByteViewer bytes={FIXTURE} regions={REGIONS} />);

    expect(screen.getByRole('button', { name: 'Command @0x0002 +1' })).toHaveAttribute(
      'data-invalid',
      'true',
    );
    expect(screen.getByRole('button', { name: 'SOF @0x0000 +1' })).toHaveAttribute(
      'data-invalid',
      'false',
    );
  });

  it('marks only the selected region as pressed', () => {
    render(<ByteViewer bytes={FIXTURE} regions={REGIONS} selectedRegionId="payload" />);

    expect(screen.getByRole('button', { name: 'Payload @0x0003 +3' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'SOF @0x0000 +1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('shows the caller supplied label for an empty frame', () => {
    render(<ByteViewer bytes={new Uint8Array()} emptyLabel="No frame selected" />);

    expect(screen.getByTestId('byte-viewer-empty')).toHaveTextContent('No frame selected');
    expect(screen.queryByTestId('byte-viewer-hex')).toBeNull();
  });

  it('falls back to a neutral glyph when no empty label is given', () => {
    render(<ByteViewer bytes={new Uint8Array()} />);

    expect(screen.getByTestId('byte-viewer-empty')).toHaveTextContent('—');
  });

  it('truncates an oversized frame and reports the hidden byte count', () => {
    const perRow = 16;
    const hidden = 6;
    render(<ByteViewer bytes={new Uint8Array(MAX_RENDERED_ROWS * perRow + hidden)} />);

    expect(screen.getAllByTestId('byte-viewer-hex')).toHaveLength(MAX_RENDERED_ROWS);
    expect(screen.getByTestId('byte-viewer-truncated')).toHaveTextContent(`+${hidden} B`);
  });
});

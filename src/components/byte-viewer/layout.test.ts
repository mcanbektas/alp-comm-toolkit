import { describe, expect, it } from 'vitest';

import {
  buildLayout,
  buildRegionMap,
  buildRows,
  DEFAULT_BYTES_PER_ROW,
  formatOffset,
  normalizeRegions,
  resolveBytesPerRow,
  splitRowByRegion,
  toHexByte,
  toPrintableAscii,
} from './layout';
import type { ByteRegion } from './types';

/** Spec §43 custom protocol fixture: SOF, len, cmd, payload, CRC, EOF. */
const FIXTURE = new Uint8Array([0xaa, 0x05, 0x10, 0x03, 0x34, 0x12, 0x7f, 0x4f, 0x55]);

function firstRow(bytes: Uint8Array, perRow: number) {
  const row = buildRows(bytes, perRow).at(0);
  if (row === undefined) throw new Error('expected at least one row');
  return row;
}

describe('toHexByte', () => {
  it('emits two uppercase digits', () => {
    expect(toHexByte(0x00)).toBe('00');
    expect(toHexByte(0x0a)).toBe('0A');
    expect(toHexByte(0xff)).toBe('FF');
    expect(toHexByte(0xaa)).toBe('AA');
  });

  it('masks out-of-range input instead of widening the column', () => {
    expect(toHexByte(0x1ff)).toBe('FF');
    expect(toHexByte(Number.NaN)).toBe('00');
  });
});

describe('toPrintableAscii', () => {
  it('passes through the printable range inclusively', () => {
    expect(toPrintableAscii(0x20)).toBe(' ');
    expect(toPrintableAscii(0x41)).toBe('A');
    expect(toPrintableAscii(0x7e)).toBe('~');
  });

  it('replaces control and high bytes with a single dot', () => {
    expect(toPrintableAscii(0x00)).toBe('.');
    expect(toPrintableAscii(0x1f)).toBe('.');
    expect(toPrintableAscii(0x7f)).toBe('.');
    expect(toPrintableAscii(0xaa)).toBe('.');
  });
});

describe('formatOffset', () => {
  it('pads to four digits and grows beyond them', () => {
    expect(formatOffset(0)).toBe('0000');
    expect(formatOffset(0x1234)).toBe('1234');
    expect(formatOffset(0x12345)).toBe('12345');
  });

  it('clamps invalid offsets to zero', () => {
    expect(formatOffset(-1)).toBe('0000');
    expect(formatOffset(Number.NaN)).toBe('0000');
  });
});

describe('resolveBytesPerRow', () => {
  it('falls back to the default for missing or malformed input', () => {
    expect(resolveBytesPerRow(undefined)).toBe(DEFAULT_BYTES_PER_ROW);
    expect(resolveBytesPerRow(0)).toBe(DEFAULT_BYTES_PER_ROW);
    expect(resolveBytesPerRow(-4)).toBe(DEFAULT_BYTES_PER_ROW);
    expect(resolveBytesPerRow(2.5)).toBe(DEFAULT_BYTES_PER_ROW);
    expect(resolveBytesPerRow(Number.NaN)).toBe(DEFAULT_BYTES_PER_ROW);
  });

  it('keeps a valid width', () => {
    expect(resolveBytesPerRow(8)).toBe(8);
  });
});

describe('buildRows', () => {
  it('returns no rows for an empty frame', () => {
    expect(buildRows(new Uint8Array(), 4)).toEqual([]);
  });

  it('splits the fixture into rows whose last one may be short', () => {
    const rows = buildRows(FIXTURE, 4);

    expect(rows.map((row) => row.offset)).toEqual([0, 4, 8]);
    expect(rows.map((row) => row.cells.length)).toEqual([4, 4, 1]);
  });

  it('renders hex and ascii per cell with absolute indices', () => {
    const row = firstRow(FIXTURE, 4);

    expect(row.cells.map((cell) => cell.hex)).toEqual(['AA', '05', '10', '03']);
    expect(row.cells.map((cell) => cell.ascii)).toEqual(['.', '.', '.', '.']);
    expect(row.cells.map((cell) => cell.index)).toEqual([0, 1, 2, 3]);
  });

  it('numbers cells by absolute index, not by position within the row', () => {
    const rows = buildRows(FIXTURE, 4);
    const second = rows.at(1);
    if (second === undefined) throw new Error('expected a second row');

    expect(second.cells.map((cell) => cell.index)).toEqual([4, 5, 6, 7]);
    expect(second.cells.map((cell) => cell.ascii)).toEqual(['4', '.', '.', 'O']);
  });
});

describe('buildLayout', () => {
  it('reports no truncation when the frame fits', () => {
    const layout = buildLayout(FIXTURE, 4, 10);

    expect(layout.rows).toHaveLength(3);
    expect(layout.hiddenByteCount).toBe(0);
    expect(layout.totalByteCount).toBe(FIXTURE.length);
  });

  it('caps the row count and reports the hidden remainder', () => {
    const layout = buildLayout(new Uint8Array(100), 4, 2);

    expect(layout.rows).toHaveLength(2);
    expect(layout.hiddenByteCount).toBe(92);
    expect(layout.totalByteCount).toBe(100);
  });
});

describe('normalizeRegions', () => {
  it('clips a region that overruns the frame instead of throwing', () => {
    const [clipped] = normalizeRegions(
      [{ id: 'tail', name: 'Tail', offset: 7, length: 10 }],
      FIXTURE.length,
    );

    expect(clipped?.start).toBe(7);
    expect(clipped?.end).toBe(FIXTURE.length);
  });

  it('drops malformed regions silently', () => {
    const malformed: readonly ByteRegion[] = [
      { id: 'negative', name: 'Negative', offset: -1, length: 2 },
      { id: 'nan', name: 'NaN', offset: Number.NaN, length: 2 },
      { id: 'fractional', name: 'Fractional', offset: 1.5, length: 2 },
      { id: 'empty', name: 'Empty', offset: 0, length: 0 },
      { id: 'beyond', name: 'Beyond', offset: 99, length: 4 },
    ];

    expect(normalizeRegions(malformed, FIXTURE.length)).toEqual([]);
  });

  it('cycles auto colors without consuming a slot for explicit ones', () => {
    const result = normalizeRegions(
      [
        { id: 'a', name: 'A', offset: 0, length: 1 },
        { id: 'b', name: 'B', offset: 1, length: 1, colorIndex: 3 },
        { id: 'c', name: 'C', offset: 2, length: 1 },
      ],
      FIXTURE.length,
    );

    expect(result.map((item) => item.colorIndex)).toEqual([0, 3, 1]);
  });

  it('does not advance the auto color for dropped regions', () => {
    const result = normalizeRegions(
      [
        { id: 'broken', name: 'Broken', offset: -5, length: 2 },
        { id: 'first', name: 'First', offset: 0, length: 1 },
      ],
      FIXTURE.length,
    );

    expect(result.map((item) => item.colorIndex)).toEqual([0]);
  });
});

describe('buildRegionMap', () => {
  it('maps every byte of the frame', () => {
    expect(buildRegionMap([], FIXTURE.length)).toHaveLength(FIXTURE.length);
    expect(buildRegionMap(undefined, 0)).toEqual([]);
  });

  it('lets the later region win an overlap', () => {
    const map = buildRegionMap(
      [
        { id: 'payload', name: 'Payload', offset: 0, length: 6 },
        { id: 'command', name: 'Command', offset: 2, length: 2 },
      ],
      FIXTURE.length,
    );

    expect(map[1]?.region.id).toBe('payload');
    expect(map[2]?.region.id).toBe('command');
    expect(map[3]?.region.id).toBe('command');
    expect(map[4]?.region.id).toBe('payload');
  });

  it('leaves uncovered bytes undefined', () => {
    const map = buildRegionMap([{ id: 'sof', name: 'SOF', offset: 0, length: 1 }], FIXTURE.length);

    expect(map[0]?.region.id).toBe('sof');
    expect(map[1]).toBeUndefined();
  });
});

describe('splitRowByRegion', () => {
  it('groups consecutive bytes of one region into a single segment', () => {
    const map = buildRegionMap(
      [
        { id: 'sof', name: 'SOF', offset: 0, length: 1 },
        { id: 'header', name: 'Header', offset: 1, length: 2 },
      ],
      FIXTURE.length,
    );
    const segments = splitRowByRegion(firstRow(FIXTURE, 4), map);

    expect(segments.map((segment) => segment.region?.region.id)).toEqual([
      'sof',
      'header',
      undefined,
    ]);
    expect(segments.map((segment) => segment.cells.length)).toEqual([1, 2, 1]);
  });

  it('breaks a region that crosses a row boundary into per-row segments', () => {
    const map = buildRegionMap(
      [{ id: 'wide', name: 'Wide', offset: 2, length: 5 }],
      FIXTURE.length,
    );
    const rows = buildRows(FIXTURE, 4);
    const covered = rows.flatMap((row) =>
      splitRowByRegion(row, map).filter((segment) => segment.region?.region.id === 'wide'),
    );

    expect(covered).toHaveLength(2);
    expect(covered.map((segment) => segment.cells.length)).toEqual([2, 3]);
  });

  it('produces unique keys across rows', () => {
    const map = buildRegionMap([], FIXTURE.length);
    const keys = buildRows(FIXTURE, 4).flatMap((row) =>
      splitRowByRegion(row, map).map((segment) => segment.key),
    );

    expect(new Set(keys).size).toBe(keys.length);
  });
});

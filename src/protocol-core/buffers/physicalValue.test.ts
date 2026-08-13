import { describe, expect, it } from 'vitest';

import { toPhysicalValue, toRawValue } from './physicalValue';

describe('toPhysicalValue / toRawValue', () => {
  it('computes Physical Value = Raw Value × Scale + Offset for the spec example (653, 0.1, -40 -> 25.3 °C)', () => {
    expect(toPhysicalValue(653, 0.1, -40)).toBeCloseTo(25.3, 10);
  });

  it('computes Raw Value = (Physical Value − Offset) / Scale for the same fixture', () => {
    expect(toRawValue(25.3, 0.1, -40)).toBeCloseTo(653, 10);
  });

  it('round-trips through both directions', () => {
    const raw = toRawValue(toPhysicalValue(1234, 0.5, 10), 0.5, 10);
    expect(raw).toBeCloseTo(1234, 10);
  });

  it('rejects converting back to raw with a zero scale', () => {
    expect(() => toRawValue(10, 0, 5)).toThrow();
  });

  it('allows a zero scale for the forward conversion (constant physical value)', () => {
    expect(toPhysicalValue(999, 0, 42)).toBe(42);
  });
});

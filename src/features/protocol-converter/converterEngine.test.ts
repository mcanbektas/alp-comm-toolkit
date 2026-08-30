import { describe, expect, it } from 'vitest';

import { bytesToHex } from '@/protocol-core/buffers/representation';
import { createRawFrame } from '@/protocol-core/types';
import type { ParsedField, ParsedFrame } from '@/protocol-core/types';

import { applyTransform, convertFrame } from './converterEngine';
import type { FieldMapping } from './converterTypes';

/**
 * Motorun ölçütü spec §33'ün KENDİ örneğidir:
 *
 * ```
 * Source: Modbus Register 40001 · Transform: value × 0.1
 * Destination: MQTT Topic: sensors/temperature
 * ```
 *
 * Çerçeve burada elle kuruluyor (parser'ın çıktısı `ParsedFrame`tir); amaç
 * ÇEVİRİYİ sınamak, Modbus'u yeniden sınamak değil.
 */

function field(partial: Partial<ParsedField> & Pick<ParsedField, 'id' | 'name'>): ParsedField {
  return {
    offset: 0,
    length: 2,
    rawBytes: Uint8Array.from([0x00, 0x64]),
    valid: true,
    warnings: [],
    ...partial,
  };
}

function frameWith(fields: readonly ParsedField[]): ParsedFrame {
  return {
    protocol: 'modbus-rtu',
    timestamp: 0,
    rawFrame: createRawFrame(Uint8Array.from([0x01, 0x03]), { timestamp: 0, direction: 'rx' }),
    fields: [...fields],
    valid: true,
    errors: [],
    warnings: [],
  };
}

const SPEC_FRAME = frameWith([
  field({ id: 'register-0', name: 'Register 0', rawValue: 100 }),
  field({ id: 'register-1', name: 'Register 1', rawValue: 200 }),
  field({ id: 'function-code', name: 'Function Code', rawValue: 3, physicalValue: 'Read Holding Registers' }),
]);

const SPEC_MAPPING: FieldMapping = {
  id: 'mapping-1',
  sourceFieldId: 'register-0',
  transform: 'scale',
  factor: 0.1,
  addend: 0,
  destinationName: 'sensors/temperature',
};

describe('applyTransform', () => {
  it('applies only the parts the selected transform names', () => {
    expect(applyTransform(100, 'none', 0.1, 5)).toBe(100);
    expect(applyTransform(100, 'scale', 0.1, 5)).toBe(10);
    expect(applyTransform(100, 'offset', 0.1, 5)).toBe(105);
    expect(applyTransform(100, 'scaleOffset', 0.1, 5)).toBe(15);
  });

  /** `0.1 * 3 = 0.30000000000000004` — ekranda görünmesi gereken sayı 0.3. */
  it('trims floating point noise', () => {
    expect(applyTransform(3, 'scale', 0.1, 0)).toBe(0.3);
  });
});

describe('convertFrame', () => {
  it('produces the spec example as a real MQTT packet', () => {
    const output = convertFrame(SPEC_FRAME, [SPEC_MAPPING], 'mqtt-publish');

    expect(output.values[0]?.value).toBe(10);
    expect(output.issues).toEqual([]);
    expect(output.packets).toHaveLength(1);

    // 30 17 · topic uzunluğu 0013 (19 harf) · "sensors/temperature" · payload "10".
    const packet = output.packets[0]?.bytes;
    expect(packet).toBeDefined();
    expect(bytesToHex(packet ?? new Uint8Array()).slice(0, 8)).toBe('30170013');
    expect(new TextDecoder().decode(packet?.subarray(4) ?? new Uint8Array())).toBe('sensors/temperature10');
  });

  it('renders JSON keyed by destination name', () => {
    const output = convertFrame(SPEC_FRAME, [SPEC_MAPPING], 'json');

    expect(JSON.parse(output.text)).toEqual({ 'sensors/temperature': 10 });
    expect(output.packets).toEqual([]);
  });

  it('renders CSV as a header row and one data row', () => {
    const mappings: readonly FieldMapping[] = [
      SPEC_MAPPING,
      { ...SPEC_MAPPING, id: 'mapping-2', sourceFieldId: 'register-1', destinationName: 'sensors/pressure' },
    ];

    const output = convertFrame(SPEC_FRAME, mappings, 'csv');

    expect(output.text).toBe('sensors/temperature,sensors/pressure\n10,20');
  });

  /** Virgül içeren bir hedef ad, tırnaklanmazsa sütunları kaydırırdı. */
  it('quotes CSV values that contain a comma', () => {
    const output = convertFrame(
      frameWith([field({ id: 'label', name: 'Label', physicalValue: 'ready, armed' })]),
      [{ ...SPEC_MAPPING, sourceFieldId: 'label', transform: 'none', destinationName: 'state' }],
      'csv',
    );

    expect(output.text).toBe('state\n"ready, armed"');
  });

  /**
   * Kaynak protokol değişince eski eşleme ayakta kalır ve alan kaybolur. O
   * satır düşer, ÖTEKİLER üretilmeye devam eder.
   */
  it('keeps the other rows when one mapping points at a missing field', () => {
    const mappings: readonly FieldMapping[] = [
      { ...SPEC_MAPPING, id: 'mapping-2', sourceFieldId: 'nmea-heading', destinationName: 'nav/heading' },
      SPEC_MAPPING,
    ];

    const output = convertFrame(SPEC_FRAME, mappings, 'json');

    expect(output.issues[0]?.messageKey).toBe('converter.issue.unknownField');
    expect(JSON.parse(output.text)).toEqual({ 'sensors/temperature': 10 });
  });

  it('carries a text field through without arithmetic and says so', () => {
    const output = convertFrame(
      SPEC_FRAME,
      [{ ...SPEC_MAPPING, sourceFieldId: 'function-code', destinationName: 'command' }],
      'json',
    );

    expect(output.issues[0]?.messageKey).toBe('converter.issue.notNumeric');
    expect(JSON.parse(output.text)).toEqual({ command: 'Read Holding Registers' });
  });

  it('leaves out a row with no destination name', () => {
    const output = convertFrame(SPEC_FRAME, [{ ...SPEC_MAPPING, destinationName: '  ' }], 'json');

    expect(output.issues[0]?.messageKey).toBe('converter.issue.missingDestination');
    expect(output.values).toEqual([]);
  });

  /** Boş topic'li PUBLISH encoder tarafından reddedilir; istisna ekrana kaçmaz. */
  it('turns an encoder rejection into an issue, not an exception', () => {
    const output = convertFrame(
      frameWith([field({ id: 'register-0', name: 'Register 0', rawValue: 100 })]),
      [{ ...SPEC_MAPPING, destinationName: 'x' }],
      'mqtt-publish',
    );

    expect(output.packets).toHaveLength(1);
    expect(output.issues).toEqual([]);
  });
});

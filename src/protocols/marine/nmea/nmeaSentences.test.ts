import { describe, expect, it } from 'vitest';

import { NMEA_SENTENCE_FORMATTERS, decodeSentenceFields, splitPayloadTokens } from './nmeaSentences';
import type { ParsedField } from '@/protocol-core/types';

function sentenceBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    bytes[index] = text.charCodeAt(index);
  }
  return bytes;
}

/** `payload` `$`siz, checksum'sız tam veri kısmıdır (ör. "GPRMC,123519,A,..."). */
function decodePayload(payload: string) {
  const tokens = splitPayloadTokens(payload, 1);
  const identifier = tokens[0];
  if (identifier === undefined) throw new Error('boş payload');
  const formatter = identifier.value.slice(2);
  const data = sentenceBytes(`$${payload}*00`);
  return decodeSentenceFields(formatter, data, tokens);
}

function byId(fields: readonly ParsedField[], id: string): ParsedField {
  const found = fields.find((field) => field.id === id);
  if (found === undefined) {
    throw new Error(`field "${id}" not found; got ${fields.map((f) => f.id).join(', ')}`);
  }
  return found;
}

describe('NMEA_SENTENCE_FORMATTERS', () => {
  it('spec\'in saydığı 18 formatteri birebir listeler', () => {
    expect(NMEA_SENTENCE_FORMATTERS).toHaveLength(18);
  });

  it('yalnız GNSS odaklı 7\'li tam semantik alır (kullanıcı kararı, brief-faz9-dalga2.md)', () => {
    const semantic = NMEA_SENTENCE_FORMATTERS.filter((info) => info.hasSemanticFields)
      .map((info) => info.formatter)
      .sort();
    expect(semantic).toEqual(['GGA', 'GLL', 'GSA', 'GSV', 'RMC', 'VTG', 'ZDA'].sort());
  });
});

describe('splitPayloadTokens', () => {
  it('virgülle böler, ofsetleri payload başlangıcına göre korur', () => {
    const tokens = splitPayloadTokens('GPGGA,1,2', 1);
    expect(tokens.map((token) => token.value)).toEqual(['GPGGA', '1', '2']);
    expect(tokens.map((token) => token.offset)).toEqual([1, 7, 9]);
  });

  it('ardışık virgüllerde boş token üretir, atlamaz', () => {
    const tokens = splitPayloadTokens('A,,B', 1);
    expect(tokens.map((token) => token.value)).toEqual(['A', '', 'B']);
  });
});

describe('decodeSentenceFields — GGA (spec §43 fixture)', () => {
  const result = decodePayload('GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,');

  it('UTC saatini HH:MM:SS olarak biçimlendirir', () => {
    expect(byId(result.fields, 'utc-time').physicalValue).toBe('12:35:19');
  });

  it('enlem/boylamı ondalık dereceye çevirir (48.1173 / 11.516666...)', () => {
    expect(byId(result.fields, 'latitude').physicalValue).toBeCloseTo(48.1173, 4);
    expect(byId(result.fields, 'latitude').unit).toBe('°');
    expect(byId(result.fields, 'longitude').physicalValue).toBeCloseTo(11.516667, 4);
  });

  it('fix quality, satellite count, HDOP ve altitude çözülür', () => {
    expect(byId(result.fields, 'fix-quality').physicalValue).toBe('GPS Fix');
    expect(byId(result.fields, 'satellite-count').physicalValue).toBe(8);
    expect(byId(result.fields, 'hdop').physicalValue).toBe(0.9);
    const altitude = byId(result.fields, 'altitude');
    expect(altitude.physicalValue).toBe(545.4);
    expect(altitude.unit).toBe('m');
  });

  it('boş DGPS alanlarında rawValue undefined kalır, uydurma değer üretilmez', () => {
    expect(byId(result.fields, 'dgps-age').rawValue).toBeUndefined();
    expect(byId(result.fields, 'dgps-station-id').rawValue).toBeUndefined();
  });

  it('eksik/fazla alan uyarısı yoktur — tam 14 veri alanı var', () => {
    expect(result.warnings).not.toContain('protocol.nmea.sentence.warning.insufficientFields');
    expect(result.warnings).not.toContain('protocol.nmea.sentence.warning.trailingFields');
  });
});

describe('decodeSentenceFields — RMC', () => {
  const result = decodePayload(
    'GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W',
  );

  it('status, pozisyon, SOG/COG ve manyetik sapmayı çözer', () => {
    expect(byId(result.fields, 'status').physicalValue).toBe('Active');
    expect(byId(result.fields, 'latitude').physicalValue).toBeCloseTo(48.1173, 4);
    expect(byId(result.fields, 'longitude').physicalValue).toBeCloseTo(11.516667, 4);
    const sog = byId(result.fields, 'speed-over-ground');
    expect(sog.physicalValue).toBe(22.4);
    expect(sog.unit).toBe('kn');
    expect(byId(result.fields, 'course-over-ground').physicalValue).toBe(84.4);
    const variation = byId(result.fields, 'magnetic-variation');
    expect(variation.physicalValue).toBe(-3.1);
  });

  it('ddmmyy tarihini toolkit\'in 2000+yy kuralıyla biçimlendirir', () => {
    // "230394" → gün 23, ay 03, yıl 2000+94=2094: NMEA 0183 yüzyılı belirtmez,
    // toolkit'in kapsadığı dönemde (2000-2099) tek anlamlı okuma budur.
    expect(byId(result.fields, 'date').physicalValue).toBe('2094-03-23');
  });
});

describe('decodeSentenceFields — GSA', () => {
  const result = decodePayload('GPGSA,A,3,04,05,,09,12,,,24,,,,,2.5,1.3,2.1');

  it('seçim modu ve fix tipini etiketler', () => {
    expect(byId(result.fields, 'selection-mode').physicalValue).toBe('Automatic');
    expect(byId(result.fields, 'fix-type').physicalValue).toBe('3D Fix');
  });

  it('12 uydu PRN slotunu (boş olanlar dahil) çözer', () => {
    expect(byId(result.fields, 'satellite-prn-0').rawValue).toBe('04');
    expect(byId(result.fields, 'satellite-prn-1').rawValue).toBe('05');
    expect(byId(result.fields, 'satellite-prn-2').rawValue).toBeUndefined();
    expect(byId(result.fields, 'satellite-prn-3').rawValue).toBe('09');
    expect(byId(result.fields, 'satellite-prn-7').rawValue).toBe('24');
  });

  it('PDOP/HDOP/VDOP değerlerini sayıya çevirir', () => {
    expect(byId(result.fields, 'pdop').physicalValue).toBe(2.5);
    expect(byId(result.fields, 'hdop').physicalValue).toBe(1.3);
    expect(byId(result.fields, 'vdop').physicalValue).toBe(2.1);
  });
});

describe('decodeSentenceFields — GSV', () => {
  const result = decodePayload(
    'GPGSV,3,1,11,03,03,111,00,04,15,270,00,06,01,010,00,13,06,292,00',
  );

  it('mesaj çerçevelemesini ve görüş alanındaki uydu sayısını çözer', () => {
    expect(byId(result.fields, 'total-messages').physicalValue).toBe(3);
    expect(byId(result.fields, 'message-number').physicalValue).toBe(1);
    expect(byId(result.fields, 'satellites-in-view').physicalValue).toBe(11);
  });

  it('mesaj başına en çok 4 uydu bloğunu (PRN/elevation/azimuth/SNR) çözer', () => {
    expect(byId(result.fields, 'satellite-0-prn').physicalValue).toBe(3);
    expect(byId(result.fields, 'satellite-0-elevation').physicalValue).toBe(3);
    expect(byId(result.fields, 'satellite-0-azimuth').physicalValue).toBe(111);
    expect(byId(result.fields, 'satellite-0-snr').physicalValue).toBe(0);
    expect(byId(result.fields, 'satellite-3-prn').physicalValue).toBe(13);
    expect(result.fields.filter((field) => field.id.startsWith('satellite-')).length).toBe(16);
  });
});

describe('decodeSentenceFields — VTG', () => {
  const result = decodePayload('GPVTG,054.7,T,034.4,M,005.5,N,010.2,K');

  it('gerçek/manyetik seyri ve knot/km-h hızını çözer', () => {
    expect(byId(result.fields, 'course-true').physicalValue).toBe(54.7);
    expect(byId(result.fields, 'course-magnetic').physicalValue).toBe(34.4);
    const knots = byId(result.fields, 'speed-knots');
    expect(knots.physicalValue).toBe(5.5);
    expect(knots.unit).toBe('kn');
    const kmh = byId(result.fields, 'speed-kmh');
    expect(kmh.physicalValue).toBe(10.2);
    expect(kmh.unit).toBe('km/h');
  });
});

describe('decodeSentenceFields — GLL', () => {
  const result = decodePayload('GPGLL,4916.45,N,12311.12,W,225444,A');

  it('pozisyonu, saati ve durumu çözer', () => {
    expect(byId(result.fields, 'latitude').physicalValue).toBeCloseTo(49.274167, 4);
    expect(byId(result.fields, 'longitude').physicalValue).toBeCloseTo(-123.185333, 4);
    expect(byId(result.fields, 'utc-time').physicalValue).toBe('22:54:44');
    expect(byId(result.fields, 'status').physicalValue).toBe('Active');
  });
});

describe('decodeSentenceFields — ZDA', () => {
  const result = decodePayload('GPZDA,123519,29,08,2026,00,00');

  it('UTC saatini, tarih alanlarını ve yerel dilim ofsetini çözer', () => {
    expect(byId(result.fields, 'utc-time').physicalValue).toBe('12:35:19');
    expect(byId(result.fields, 'day').physicalValue).toBe(29);
    expect(byId(result.fields, 'month').physicalValue).toBe(8);
    expect(byId(result.fields, 'year').physicalValue).toBe(2026);
    expect(byId(result.fields, 'local-zone-hours').physicalValue).toBe(0);
    expect(byId(result.fields, 'local-zone-minutes').physicalValue).toBe(0);
  });
});

describe('decodeSentenceFields — generic envelope (kalan 11 tip + bilinmeyen formatter)', () => {
  it('MWV (generic-only) alanları semantik ad almaz, ham token olarak döner', () => {
    const result = decodePayload('WIMWV,045.0,R,10.5,N,A');
    expect(result.warnings).toContain('protocol.nmea.sentence.warning.genericFieldsOnly');
    expect(result.fields.map((field) => field.id)).toEqual([
      'field-1',
      'field-2',
      'field-3',
      'field-4',
      'field-5',
    ]);
    expect(result.fields[0]?.rawValue).toBe('045.0');
  });

  it('bilinmeyen formatter unknown uyarısı üretir ama yine ham alanlarla döner', () => {
    const result = decodePayload('GPZZZ,1,2,3');
    expect(result.warnings).toContain('protocol.nmea.sentence.warning.unknownFormatter');
    expect(result.fields.map((field) => field.id)).toEqual(['field-1', 'field-2', 'field-3']);
  });
});

describe('decodeSentenceFields — eksik/fazla alan (spec §47: gizlenmez, gösterilir)', () => {
  it('kısa kalan GGA eksik-alan uyarısı üretir ama elde olan alanları çözer', () => {
    const result = decodePayload('GPGGA,123519,4807.038,N');
    expect(result.warnings).toContain('protocol.nmea.sentence.warning.insufficientFields');
    expect(byId(result.fields, 'utc-time').physicalValue).toBe('12:35:19');
  });

  it('fazla alanlı VTG trailing-field uyarısı üretir ve artanı ham alan olarak ekler', () => {
    const result = decodePayload('GPVTG,054.7,T,034.4,M,005.5,N,010.2,K,A,FAZLA');
    expect(result.warnings).toContain('protocol.nmea.sentence.warning.trailingFields');
    const trailing = byId(result.fields, 'field-10');
    expect(trailing.rawValue).toBe('FAZLA');
    expect(trailing.valid).toBe(false);
  });
});

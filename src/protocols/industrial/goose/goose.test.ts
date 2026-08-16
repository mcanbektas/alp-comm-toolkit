import { describe, expect, it } from 'vitest';

import {
  ERROR_APDU_TRUNCATED,
  ERROR_BER_INDEFINITE_LENGTH,
  ERROR_ETHER_TYPE_NOT_GOOSE,
  ERROR_LENGTH_BELOW_HEADER,
  ERROR_PDU_TAG_NOT_GOOSE,
  WARN_CLOCK_NOT_TRUSTWORTHY,
  WARN_DATA_DEPTH_LIMIT,
  WARN_DATA_SEMANTICS_NEED_SCL,
  WARN_DATA_SET_COUNT_MISMATCH,
  WARN_DESTINATION_NOT_GOOSE_RANGE,
  WARN_GSE_MANAGEMENT_PDU,
  WARN_MISSING_MANDATORY_FIELD,
  WARN_NEEDS_COMMISSIONING,
  WARN_PADDING_NOT_ZERO,
  WARN_RESERVED_NOT_ZERO,
  WARN_SECURITY_NOT_DECODED,
  WARN_SIMULATION_ACTIVE,
  WARN_TIMESTAMP_LENGTH_UNEXPECTED,
  WARN_TRAILING_BYTES,
  WARN_UNKNOWN_DATA_TYPE,
  gooseParser,
  goosePlugin,
  parseGoose,
} from './goose';
import type {
  ParseFailure,
  ParseResult,
  ParseSuccess,
  ParsedField,
  ParsedFrame,
} from '@/protocol-core/types';

function bytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/\s+/g, '');
  const result = new Uint8Array(cleaned.length / 2);
  for (let index = 0; index < result.length; index += 1) {
    result[index] = Number.parseInt(cleaned.slice(index * 2, index * 2 + 2), 16);
  }
  return result;
}

function expectSuccess(result: ParseResult): ParseSuccess {
  if (!result.success) {
    throw new Error(`expected success, got error "${result.error.code}"`);
  }
  return result;
}

function expectFailure(result: ParseResult): ParseFailure {
  if (result.success) {
    throw new Error('expected failure, got a parsed frame');
  }
  return result;
}

function fieldById(frame: ParsedFrame, id: string): ParsedField {
  const found = frame.fields.find((field) => field.id === id);
  if (found === undefined) {
    throw new Error(`field "${id}" not found; got ${frame.fields.map((f) => f.id).join(', ')}`);
  }
  return found;
}

function hasField(frame: ParsedFrame, id: string): boolean {
  return frame.fields.some((field) => field.id === id);
}

function warningCodes(frame: ParsedFrame): string[] {
  return frame.warnings.map((warning) => warning.code);
}

function errorCodes(frame: ParsedFrame): string[] {
  return frame.errors.map((error) => error.code);
}

function errorMessages(frame: ParsedFrame): string[] {
  return frame.errors.map((error) => error.message);
}

function exampleBytes(id: string): Uint8Array {
  const example = goosePlugin.exampleFrames.find((frame) => frame.id === id);
  if (example === undefined) {
    throw new Error(`example "${id}" not found`);
  }
  return example.bytes;
}

function parseExample(id: string): ParsedFrame {
  return expectSuccess(parseGoose(exampleBytes(id))).frame;
}

// ── Motorun sabitlerinden BAĞIMSIZ kurucular ────────────────────────────────
// Baytlar burada X.690 + IEC 61850 alan ağacından elle diziliyor; motorun kendi
// yardımcıları KULLANILMIYOR. Testin kanıt değeri bundan geliyor.

const GOOSE_DST = [0x01, 0x0c, 0xcd, 0x01, 0x00, 0x01];
const SRC = [0x00, 0x21, 0xc1, 0x25, 0x1f, 0x64];

function tlv(tagByte: number, value: readonly number[]): number[] {
  if (value.length < 0x80) return [tagByte, value.length, ...value];
  return [tagByte, 0x81, value.length, ...value];
}

function ascii(text: string): number[] {
  return Array.from(text, (character) => character.charCodeAt(0));
}

function integerOctets(value: number): number[] {
  const octets: number[] = [];
  let remaining = value;
  do {
    octets.unshift(remaining & 0xff);
    remaining = Math.floor(remaining / 0x100);
  } while (remaining > 0);
  if (((octets[0] ?? 0) & 0x80) !== 0) octets.unshift(0x00);
  return octets;
}

interface FrameInit {
  readonly pdu: readonly number[];
  readonly appId?: number;
  readonly reserved1?: number;
  readonly destination?: readonly number[];
  readonly vlanTci?: number;
  readonly etherType?: readonly number[];
  readonly lengthOverride?: number;
  readonly trailing?: readonly number[];
}

/** DST(6) + SRC(6) [+ VLAN(4)] + EtherType(2) + APPID/Length/Res1/Res2 + APDU. */
function buildFrame(init: FrameInit): Uint8Array {
  const out: number[] = [...(init.destination ?? GOOSE_DST), ...SRC];
  if (init.vlanTci !== undefined) {
    out.push(0x81, 0x00, (init.vlanTci >>> 8) & 0xff, init.vlanTci & 0xff);
  }
  out.push(...(init.etherType ?? [0x88, 0xb8]));
  const appId = init.appId ?? 0x0001;
  const declared = init.lengthOverride ?? 8 + init.pdu.length;
  out.push((appId >>> 8) & 0xff, appId & 0xff);
  out.push((declared >>> 8) & 0xff, declared & 0xff);
  const reserved1 = init.reserved1 ?? 0;
  out.push((reserved1 >>> 8) & 0xff, reserved1 & 0xff, 0x00, 0x00);
  out.push(...init.pdu);
  if (init.trailing !== undefined) out.push(...init.trailing);
  return Uint8Array.from(out);
}

const TIMESTAMP = [0x69, 0x93, 0x06, 0xc0, 0x80, 0x00, 0x00, 0x8a];

interface PduInit {
  readonly stNum?: number;
  readonly sqNum?: number;
  readonly entries?: number;
  readonly allData?: readonly number[];
  readonly timestamp?: readonly number[];
  readonly simulation?: boolean;
  readonly ndsCom?: boolean;
  readonly extra?: readonly number[];
  readonly omitGoId?: boolean;
  readonly omitAllData?: boolean;
}

function buildPdu(init: PduInit = {}): number[] {
  const parts: number[] = [
    ...tlv(0x80, ascii('IED/LLN0$GO$gcbA')),
    ...tlv(0x81, integerOctets(2000)),
    ...tlv(0x82, ascii('IED/LLN0$DsA')),
  ];
  if (init.omitGoId !== true) parts.push(...tlv(0x83, ascii('EvtA')));
  parts.push(...tlv(0x84, init.timestamp ?? TIMESTAMP));
  parts.push(...tlv(0x85, integerOctets(init.stNum ?? 1)));
  parts.push(...tlv(0x86, integerOctets(init.sqNum ?? 7)));
  parts.push(...tlv(0x87, [init.simulation === true ? 0xff : 0x00]));
  parts.push(...tlv(0x88, integerOctets(1)));
  parts.push(...tlv(0x89, [init.ndsCom === true ? 0xff : 0x00]));
  parts.push(...tlv(0x8a, integerOctets(init.entries ?? 1)));
  if (init.omitAllData !== true) parts.push(...tlv(0xab, init.allData ?? tlv(0x83, [0xff])));
  if (init.extra !== undefined) parts.push(...init.extra);
  return tlv(0x61, parts);
}

describe('goose örnek çerçeveleri', () => {
  /**
   * Bağımsız kanıt: bu hex, motorun kodlayıcı yardımcıları kullanılmadan, alan
   * ağacından elle dizilerek hesaplandı. Kırılım:
   *   01 0C CD 01 00 01  DST (IEC/TC57 GOOSE aralığı)
   *   00 21 C1 25 1F 64  SRC
   *   88 B8              EtherType
   *   00 01              APPID
   *   00 A9              Length = 169 = 8 (başlık) + 161 (APDU)
   *   00 00 00 00        Reserved 1 + Reserved 2
   *   61 81 9E           goosePdu, UZUN FORM uzunluk (158 bayt gövde)
   *   80 2D …            gocbRef (45 bayt), 81 02 07 D0 timeAllowedtoLive=2000,
   *   82 27 …            datSet (39), 83 14 … goID (20),
   *   84 08 69 93 06 C0 80 00 00 8A   t = 1771243200 s + 2²³ kesir + kalite 0x8A
   *   85 01 01 stNum=1, 86 01 0C sqNum=12, 87 01 00 simulation=FALSE,
   *   88 01 01 confRev=1, 89 01 00 ndsCom=FALSE, 8A 01 04 numDatSetEntries=4,
   *   AB 0E { 83 01 00 | 84 03 03 00 00 | 85 01 2A | 83 01 00 }
   */
  const STEADY_STATE_HEX =
    '01 0C CD 01 00 01 00 21 C1 25 1F 64 88 B8 00 01 00 A9 00 00 00 00 61 81 9E 80 2D ' +
    '41 4C 50 5F 53 75 62 73 74 61 74 69 6F 6E 49 45 44 2F 4C 4C 4E 30 24 47 4F 24 67 ' +
    '63 62 50 72 6F 74 65 63 74 69 6F 6E 45 76 65 6E 74 73 81 02 07 D0 82 27 41 4C 50 ' +
    '5F 53 75 62 73 74 61 74 69 6F 6E 49 45 44 2F 4C 4C 4E 30 24 50 72 6F 74 65 63 74 ' +
    '69 6F 6E 45 76 65 6E 74 73 83 14 41 4C 50 5F 50 72 6F 74 65 63 74 69 6F 6E 45 76 ' +
    '65 6E 74 73 84 08 69 93 06 C0 80 00 00 8A 85 01 01 86 01 0C 87 01 00 88 01 01 89 ' +
    '01 00 8A 01 04 AB 0E 83 01 00 84 03 03 00 00 85 01 2A 83 01 00';

  it('kararlı durum örneği elle hesaplanmış baytlarla birebir aynıdır', () => {
    expect(Array.from(exampleBytes('steady-state-publication'))).toEqual(
      Array.from(bytes(STEADY_STATE_HEX)),
    );
  });

  it('her örneğin geçerlilik beklentisi çözüm sonucuyla tutar', () => {
    for (const example of goosePlugin.exampleFrames) {
      const result = parseGoose(example.bytes);
      const valid = result.success && result.frame.valid;
      expect(valid, `${example.id} beklenen geçerlilik tutmuyor`).toBe(
        example.expectedValid !== false,
      );
    }
  });
});

describe('goose Ethernet katmanı', () => {
  it('GOOSE multicast aralığını bilgi olarak işaretler, uyarı basmaz', () => {
    const frame = parseExample('steady-state-publication');
    const destination = fieldById(frame, 'destination-mac');
    expect(destination.rawValue).toBe('01:0C:CD:01:00:01');
    expect(String(destination.physicalValue)).toContain('IEC/TC57 GOOSE range');
    expect(warningCodes(frame)).not.toContain(WARN_DESTINATION_NOT_GOOSE_RANGE);
  });

  it('aralık dışı hedef MAC için yalnız bilgi uyarısı basar, hata basmaz', () => {
    const frame = expectSuccess(
      parseGoose(buildFrame({ destination: [0x01, 0x00, 0x5e, 0x00, 0x00, 0x01], pdu: buildPdu() })),
    ).frame;
    expect(warningCodes(frame)).toContain(WARN_DESTINATION_NOT_GOOSE_RANGE);
    expect(frame.errors).toEqual([]);
  });

  it('EtherType 0x88B8’i GOOSE olarak adlandırır', () => {
    const frame = parseExample('steady-state-publication');
    const etherType = fieldById(frame, 'ethertype');
    expect(etherType.rawValue).toBe(0x88b8);
    expect(etherType.physicalValue).toBe('GOOSE');
    expect(etherType.offset).toBe(12);
  });

  it('yanlış EtherType’ta gövdeye dokunmaz', () => {
    const frame = parseExample('ethertype-not-goose');
    expect(errorCodes(frame)).toContain('start-delimiter-not-found');
    expect(errorMessages(frame)).toContain(ERROR_ETHER_TYPE_NOT_GOOSE);
    expect(hasField(frame, 'appid')).toBe(false);
    expect(hasField(frame, 'goose-pdu')).toBe(false);
    expect(hasField(frame, 'payload')).toBe(true);
  });

  it('VLAN tag’li çerçevede tüm ofsetler dört bayt kayar ama mutlak kalır', () => {
    const frame = parseExample('vlan-tagged-publication');
    expect(hasField(frame, 'vlan-1-vid')).toBe(true);
    expect(fieldById(frame, 'ethertype').offset).toBe(16);
    expect(fieldById(frame, 'appid').offset).toBe(18);
    expect(fieldById(frame, 'goose-pdu').offset).toBe(26);
    // gocbRef, VLAN'sız örnekte 25'te; burada tam dört bayt ileride.
    expect(fieldById(frame, 'gocb-ref').offset).toBe(29);
    expect(frame.errors).toEqual([]);
  });
});

describe('goose başlığı', () => {
  it('APPID ve Length’i network order okur; Length APPID’den itibaren sayar', () => {
    const frame = parseExample('steady-state-publication');
    expect(fieldById(frame, 'appid').rawValue).toBe(0x0001);
    const length = fieldById(frame, 'goose-length');
    // 169 = 8 (başlık) + 161 (APDU); Ethernet başlığının 14 baytı SAYILMAZ.
    expect(length.rawValue).toBe(169);
    expect(length.physicalValue).toBe('header 8 + APDU 161');
    expect(exampleBytes('steady-state-publication').length).toBe(14 + 169);
  });

  it('Length 8’in altındaysa hata basar ve PDU’ya girmez', () => {
    const frame = expectSuccess(
      parseGoose(buildFrame({ pdu: buildPdu(), lengthOverride: 4 })),
    ).frame;
    expect(errorCodes(frame)).toContain('length-mismatch');
    expect(errorMessages(frame)).toContain(ERROR_LENGTH_BELOW_HEADER);
    expect(fieldById(frame, 'goose-length').valid).toBe(false);
    expect(hasField(frame, 'goose-pdu')).toBe(false);
  });

  it('Length telde olandan uzunsa hata basar ama okuduğu kadarını çözer', () => {
    const pdu = buildPdu();
    const frame = expectSuccess(
      parseGoose(buildFrame({ pdu, lengthOverride: 8 + pdu.length + 40 })),
    ).frame;
    expect(errorMessages(frame)).toContain(ERROR_APDU_TRUNCATED);
    expect(fieldById(frame, 'gocb-ref').rawValue).toBe('IED/LLN0$GO$gcbA');
  });

  it('Length’in kapsamadığı kuyruk baytlarını dolgu olarak gösterir', () => {
    const pdu = buildPdu();
    const frame = expectSuccess(
      parseGoose(buildFrame({ pdu, trailing: [0x00, 0x00, 0x00, 0x00] })),
    ).frame;
    const padding = fieldById(frame, 'padding');
    expect(padding.length).toBe(4);
    expect(warningCodes(frame)).not.toContain(WARN_PADDING_NOT_ZERO);
  });

  it('sıfırdan farklı dolgu için uyarır', () => {
    const frame = expectSuccess(
      parseGoose(buildFrame({ pdu: buildPdu(), trailing: [0xde, 0xad] })),
    ).frame;
    expect(warningCodes(frame)).toContain(WARN_PADDING_NOT_ZERO);
  });

  it('Reserved alanları sıfır değilse ham bırakır ve uyarır (bit 15 adlandırılmaz)', () => {
    const frame = parseExample('simulated-publication');
    const reserved1 = fieldById(frame, 'reserved1');
    expect(reserved1.rawValue).toBe(0x8000);
    expect(reserved1.physicalValue).toBe('0x8000');
    // "Simulated" diye bir alan ADLANDIRILMADI — tek kaynaklı bilgi.
    expect(hasField(frame, 'reserved1-simulated')).toBe(false);
    expect(warningCodes(frame)).toContain(WARN_RESERVED_NOT_ZERO);
  });
});

describe('goosePdu alanları', () => {
  it('uzun form BER uzunluğunu çözer ve PDU başlığını üç bayt sayar', () => {
    const frame = parseExample('steady-state-publication');
    const pdu = fieldById(frame, 'goose-pdu');
    expect(pdu.rawValue).toBe(0x61);
    expect(pdu.physicalValue).toBe('APPLICATION 1 (goosePdu)');
    expect(pdu.offset).toBe(22);
    // 61 81 9E → tag + uzun form uzunluk = 3 bayt.
    expect(pdu.length).toBe(3);
  });

  it('her PDU alanını adlandırır ve değerini çözer', () => {
    const frame = parseExample('steady-state-publication');
    expect(fieldById(frame, 'gocb-ref').rawValue).toBe('ALP_SubstationIED/LLN0$GO$gcbProtectionEvents');
    expect(fieldById(frame, 'gocb-ref').offset).toBe(25);
    expect(fieldById(frame, 'time-allowed-to-live').rawValue).toBe(2000n);
    expect(fieldById(frame, 'time-allowed-to-live').unit).toBe('ms');
    expect(fieldById(frame, 'dat-set').rawValue).toBe('ALP_SubstationIED/LLN0$ProtectionEvents');
    expect(fieldById(frame, 'go-id').rawValue).toBe('ALP_ProtectionEvents');
    expect(fieldById(frame, 'st-num').rawValue).toBe(1n);
    expect(fieldById(frame, 'sq-num').rawValue).toBe(12n);
    expect(fieldById(frame, 'simulation').physicalValue).toBe('FALSE');
    expect(fieldById(frame, 'conf-rev').rawValue).toBe(1n);
    expect(fieldById(frame, 'nds-com').physicalValue).toBe('FALSE');
    expect(fieldById(frame, 'num-dat-set-entries').rawValue).toBe(4n);
    expect(fieldById(frame, 'all-data').rawValue).toBe(4);
    expect(frame.errors).toEqual([]);
  });

  it('zaman damgasını saniye / kesir / kalite olarak üçe böler', () => {
    const frame = parseExample('steady-state-publication');
    // 69 93 06 C0 = 1771243200 s; 80 00 00 = 2²³ = tam yarım saniye.
    expect(fieldById(frame, 'timestamp-seconds').rawValue).toBe(1771243200);
    expect(fieldById(frame, 'timestamp-fraction').physicalValue).toBe('500 ms');
    expect(fieldById(frame, 'timestamp').physicalValue).toBe('2026-02-16T12:00:00.500Z');
    const quality = fieldById(frame, 'timestamp-quality');
    // 0x8A = leapSecondsKnown 1, clockFailure 0, clockNotSynchronized 0, accuracy 10.
    expect(quality.physicalValue).toBe(
      'leapSecondsKnown=1, clockFailure=0, clockNotSynchronized=0, accuracy=10',
    );
    expect(warningCodes(frame)).not.toContain(WARN_CLOCK_NOT_TRUSTWORTHY);
  });

  it('saat arızası/senkronsuzluk bildiren TimeQuality için uyarır', () => {
    // 0x60 = clockFailure + clockNotSynchronized.
    const frame = expectSuccess(
      parseGoose(
        buildFrame({ pdu: buildPdu({ timestamp: [0x69, 0x93, 0x06, 0xc0, 0x00, 0x00, 0x00, 0x60] }) }),
      ),
    ).frame;
    expect(warningCodes(frame)).toContain(WARN_CLOCK_NOT_TRUSTWORTHY);
  });

  it('8 bayt olmayan zaman damgasını parçalamaz, uyarır', () => {
    const frame = expectSuccess(
      parseGoose(buildFrame({ pdu: buildPdu({ timestamp: [0x00, 0x01, 0x02, 0x03] }) })),
    ).frame;
    expect(warningCodes(frame)).toContain(WARN_TIMESTAMP_LENGTH_UNEXPECTED);
    expect(hasField(frame, 'timestamp-seconds')).toBe(false);
  });

  it('simulation ve ndsCom TRUE olduğunda uyarı basar', () => {
    const frame = expectSuccess(
      parseGoose(buildFrame({ pdu: buildPdu({ simulation: true, ndsCom: true }) })),
    ).frame;
    expect(fieldById(frame, 'simulation').physicalValue).toBe('TRUE');
    expect(warningCodes(frame)).toContain(WARN_SIMULATION_ACTIVE);
    expect(warningCodes(frame)).toContain(WARN_NEEDS_COMMISSIONING);
  });

  it('opsiyonel goID’in yokluğunu eksik alan saymaz', () => {
    const frame = expectSuccess(parseGoose(buildFrame({ pdu: buildPdu({ omitGoId: true }) }))).frame;
    expect(hasField(frame, 'go-id')).toBe(false);
    expect(warningCodes(frame)).not.toContain(WARN_MISSING_MANDATORY_FIELD);
  });

  it('zorunlu alan eksikse uyarır', () => {
    const frame = expectSuccess(
      parseGoose(buildFrame({ pdu: buildPdu({ omitAllData: true }) })),
    ).frame;
    expect(warningCodes(frame)).toContain(WARN_MISSING_MANDATORY_FIELD);
  });

  it('security alanını çözmez, ham bırakır (karar 8)', () => {
    // context 12, constructed: dijital imza için ayrılmış alan.
    const frame = expectSuccess(
      parseGoose(buildFrame({ pdu: buildPdu({ extra: tlv(0xac, [0x01, 0x02, 0x03]) }) })),
    ).frame;
    const security = fieldById(frame, 'security');
    expect(security.rawBytes.length).toBe(5);
    expect(warningCodes(frame)).toContain(WARN_SECURITY_NOT_DECODED);
  });

  it('gseMngtPdu’yu adlandırır ama çözmez ve hata basmaz', () => {
    const frame = expectSuccess(
      parseGoose(buildFrame({ pdu: tlv(0x60, [0x80, 0x01, 0x01]) })),
    ).frame;
    expect(fieldById(frame, 'goose-pdu').physicalValue).toBe('APPLICATION 0 (gseMngtPdu)');
    expect(hasField(frame, 'pdu-body')).toBe(true);
    expect(warningCodes(frame)).toContain(WARN_GSE_MANAGEMENT_PDU);
    expect(frame.errors).toEqual([]);
  });

  it('goosePdu/gseMngtPdu dışındaki bir etikette hata basar', () => {
    const frame = expectSuccess(parseGoose(buildFrame({ pdu: tlv(0x30, [0x05, 0x00]) }))).frame;
    expect(errorMessages(frame)).toContain(ERROR_PDU_TAG_NOT_GOOSE);
    expect(hasField(frame, 'gocb-ref')).toBe(false);
  });

  it('PDU’dan sonra kalan baytları Length bölgesinde kuyruk olarak gösterir', () => {
    const pdu = buildPdu();
    const frame = expectSuccess(
      parseGoose(
        buildFrame({ pdu: [...pdu, 0xaa, 0xbb], lengthOverride: 8 + pdu.length + 2 }),
      ),
    ).frame;
    expect(fieldById(frame, 'apdu-trailing').length).toBe(2);
    expect(warningCodes(frame)).toContain(WARN_TRAILING_BYTES);
  });
});

describe('goose dataset', () => {
  it('dört elemanı tipiyle adlandırır ve basit değerleri çözer', () => {
    const frame = parseExample('steady-state-publication');
    expect(fieldById(frame, 'data-0').name).toBe('allData[0] — boolean');
    expect(fieldById(frame, 'data-0').physicalValue).toBe('FALSE');
    // 84 03 03 00 00 → ilk oktet 3 kullanılmayan bit, 2 veri okteti → 13 bit.
    expect(fieldById(frame, 'data-1').physicalValue).toBe('13 bits (unused 3)');
    expect(fieldById(frame, 'data-2').rawValue).toBe(42n);
    expect(fieldById(frame, 'data-3').physicalValue).toBe('FALSE');
    expect(hasField(frame, 'data-4')).toBe(false);
  });

  it('her dataset elemanına “anlamı SCL’den gelir” notunu iliştirir', () => {
    const frame = parseExample('steady-state-publication');
    expect(fieldById(frame, 'data-0').warnings).toContain(WARN_DATA_SEMANTICS_NEED_SCL);
    expect(warningCodes(frame)).toContain(WARN_DATA_SEMANTICS_NEED_SCL);
  });

  it('durum değişikliği örneğinde stNum artar, sqNum sıfırlanır', () => {
    const frame = parseExample('state-change-publication');
    expect(fieldById(frame, 'st-num').rawValue).toBe(2n);
    expect(fieldById(frame, 'sq-num').rawValue).toBe(0n);
    expect(fieldById(frame, 'data-0').physicalValue).toBe('TRUE');
    expect(fieldById(frame, 'data-2').rawValue).toBe(43n);
  });

  it('iç içe structure’a iner ve float ile utc-time’ı çözer', () => {
    const frame = parseExample('structured-dataset');
    expect(fieldById(frame, 'data-0').name).toBe('allData[0] — structure');
    // 87 05 08 43 66 80 00 → üs genişliği 8 + IEEE-754 single 0x43668000 = 230.5.
    expect(fieldById(frame, 'data-0-0').physicalValue).toBe(230.5);
    expect(fieldById(frame, 'data-0-1').physicalValue).toBe('13 bits (unused 3)');
    expect(fieldById(frame, 'data-1').name).toBe('allData[1] — utc-time');
    expect(fieldById(frame, 'data-1-seconds').rawValue).toBe(1771243200);
    expect(frame.errors).toEqual([]);
  });

  it('numDatSetEntries eleman sayısıyla uyuşmuyorsa uyarır ama hata basmaz', () => {
    const frame = parseExample('dataset-count-mismatch');
    expect(fieldById(frame, 'num-dat-set-entries').rawValue).toBe(4n);
    expect(fieldById(frame, 'all-data').rawValue).toBe(2);
    expect(warningCodes(frame)).toContain(WARN_DATA_SET_COUNT_MISMATCH);
    expect(frame.errors).toEqual([]);
  });

  it('çift teyitli olmayan tip etiketini adlandırmaz', () => {
    // 0x88 = real [8]: goose.asn'de var, libIEC61850'nin kümesinde YOK.
    const frame = expectSuccess(
      parseGoose(buildFrame({ pdu: buildPdu({ allData: tlv(0x88, [0x00, 0x01]) }) })),
    ).frame;
    const element = fieldById(frame, 'data-0');
    expect(element.name).toBe('allData[0]');
    expect(element.valid).toBe(false);
    expect(warningCodes(frame)).toContain(WARN_UNKNOWN_DATA_TYPE);
  });

  it('derinlik sınırına ulaşınca daha derine inmez', () => {
    // Beş kat structure: sınır dördüncü seviyede devreye girer.
    const deepest = tlv(0x83, [0xff]);
    let nested = tlv(0xa2, deepest);
    for (let level = 0; level < 4; level += 1) nested = tlv(0xa2, nested);
    const frame = expectSuccess(parseGoose(buildFrame({ pdu: buildPdu({ allData: nested }) }))).frame;
    expect(warningCodes(frame)).toContain(WARN_DATA_DEPTH_LIMIT);
    expect(frame.errors).toEqual([]);
  });

  it('bozuk BER uzunluğunda net hata verir ve okumayı durdurur', () => {
    const frame = parseExample('indefinite-length-ber');
    expect(errorCodes(frame)).toContain('unsupported-encoding');
    expect(errorMessages(frame)).toContain(ERROR_BER_INDEFINITE_LENGTH);
    expect(frame.valid).toBe(false);
    // Hata öncesi çözülen alanlar KORUNUR (kısmi sonuç sözleşmesi).
    expect(fieldById(frame, 'st-num').rawValue).toBe(1n);
  });
});

describe('gooseParser', () => {
  it('canParse yalnız 0x88B8 taşıyan yeterince uzun çerçeveye evet der', () => {
    expect(gooseParser.canParse(exampleBytes('steady-state-publication'))).toBe(true);
    expect(gooseParser.canParse(exampleBytes('vlan-tagged-publication'))).toBe(true);
    expect(gooseParser.canParse(exampleBytes('ethertype-not-goose'))).toBe(false);
    expect(gooseParser.canParse(exampleBytes('frame-too-short'))).toBe(false);
    expect(gooseParser.canParse(new Uint8Array(0))).toBe(false);
  });

  it('çok kısa çerçevede kurtarılabilir ParseFailure döner', () => {
    const failure = expectFailure(parseGoose(exampleBytes('frame-too-short')));
    expect(failure.error.code).toBe('truncated-frame');
    expect(failure.recoverable).toBe(true);
  });

  it('maxFrameLength aşılırsa buffer ayırmadan durur', () => {
    const failure = expectFailure(
      gooseParser.parse(exampleBytes('steady-state-publication'), { maxFrameLength: 32 }),
    );
    expect(failure.error.code).toBe('frame-too-long');
    expect(failure.recoverable).toBe(false);
  });

  it('iptal edilmiş signal ile parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();
    const failure = expectFailure(
      gooseParser.parse(exampleBytes('steady-state-publication'), { signal: controller.signal }),
    );
    expect(failure.error.code).toBe('parser-timeout');
  });

  it('tüm çerçeveyi tükettiğini bildirir', () => {
    const data = exampleBytes('steady-state-publication');
    expect(expectSuccess(parseGoose(data)).consumedBytes).toBe(data.length);
  });

  it('çerçeve metadata’sını özet için doldurur', () => {
    const success = expectSuccess(parseGoose(exampleBytes('steady-state-publication')));
    const metadata = success.frame.rawFrame.metadata as Record<string, unknown>;
    expect(metadata['appId']).toBe(0x0001);
    expect(metadata['stNum']).toBe('1');
    expect(metadata['sqNum']).toBe('12');
    expect(metadata['dataSetEntryCount']).toBe(4);
  });
});

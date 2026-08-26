import { describe, expect, it } from 'vitest';

import { isParseSuccess } from '@/protocol-core/types';
import type { ParsedField, ParsedFrame } from '@/protocol-core/types';

import { walkDot11Elements } from './dot11Elements';
import { DOT11_BASE_HEADER_LENGTH, DOT11_FCS_LENGTH, readFrameControl } from './dot11Frame';
import {
  CAPABILITY_BIT_NAMES,
  CAPABILITY_PRIVACY_BIT,
  describeCapabilities,
  planManagementBody,
} from './dot11Management';
import { wifiParser, wifiPlugin } from './wifi';

/**
 * Faz 10 dalga 18b — yönetim gövdelerinin birim testleri.
 *
 * En önemlisi ilk `describe`: brifin ELLE çözdüğü sabit alan tablosu burada
 * gerçek çerçeveler üzerinde YENİDEN çözülüyor. Dalga 17'de brifin kendi
 * çözümü bir bayt atlamıştı; bu tablo o dersin kodlanmış hâlidir ve sabit
 * sayı EZBERLEMEZ — `24 + sabit + IE + 4` toplamını çerçevenin GERÇEK
 * uzunluğuyla karşılaştırır.
 */

function example(id: string): Uint8Array {
  const found = wifiPlugin.exampleFrames.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`missing example: ${id}`);
  return found.bytes;
}

function decoded(bytes: Uint8Array, options?: Record<string, unknown>): ParsedFrame {
  const result = wifiParser.parse(bytes, options === undefined ? undefined : { options });
  if (!isParseSuccess(result)) throw new Error(`parse failed: ${result.error.code}`);
  return result.frame;
}

function fieldById(frame: ParsedFrame, id: string): ParsedField | undefined {
  return frame.fields.find((candidate) => candidate.id === id);
}

function physical(frame: ParsedFrame, id: string): string {
  return String(fieldById(frame, id)?.physicalValue ?? '');
}

function hexToBytes(hex: string): Uint8Array {
  const parts = hex.trim().split(/\s+/);
  const bytes = new Uint8Array(parts.length);
  for (let index = 0; index < parts.length; index += 1) {
    bytes[index] = Number.parseInt(parts[index] ?? '0', 16) & 0xff;
  }
  return bytes;
}

/** Brifin altı satırlık tablosu + Probe Response = YEDİ çerçeve. */
const ARITHMETIC_CASES: readonly { readonly id: string; readonly total: number }[] = [
  { id: 'authentication', total: 34 },
  { id: 'disassociation', total: 30 },
  { id: 'association-response', total: 58 },
  { id: 'association-request', total: 79 },
  { id: 'probe-request', total: 53 },
  { id: 'beacon', total: 144 },
  { id: 'probe-response', total: 138 },
];

describe('🚨 ARİTMETİK ÇAPRAZLAMA — `24 + sabit + IE + 4 === n`', () => {
  for (const entry of ARITHMETIC_CASES) {
    it(`${entry.id}: toplam ${String(entry.total)} bayt üç parçadan ÇIKAR`, () => {
      const bytes = example(entry.id);
      expect(bytes.length).toBe(entry.total);

      const subtype = readFrameControl(bytes).subtype;
      const plan = planManagementBody(subtype);
      expect(plan.known, `alt tip ${String(subtype)} tabloda`).toBe(true);

      const elementsStart = DOT11_BASE_HEADER_LENGTH + plan.fixedLength;
      const elementsEnd = bytes.length - DOT11_FCS_LENGTH;
      const walk = walkDot11Elements(bytes, elementsStart, elementsEnd);
      // Element zinciri ARTIK BAYT BIRAKMADAN bitmeli; bırakıyorsa sabit alan
      // uzunluğu YANLIŞTIR ve tam da o zaman zincir sessizce kayar.
      expect(walk.truncated, `${entry.id}: element zinciri kesildi`).toBe(false);
      expect(walk.trailingLength, `${entry.id}: artık bayt`).toBe(0);

      const elementBytes = walk.elements.reduce((total, element) => total + 2 + element.length, 0);
      expect(
        DOT11_BASE_HEADER_LENGTH + plan.fixedLength + elementBytes + DOT11_FCS_LENGTH,
        `${entry.id}: 24 + ${String(plan.fixedLength)} + ${String(elementBytes)} + 4`,
      ).toBe(entry.total);
    });
  }

  it('brifin verdiği ÜÇ element toplamı (104 / 24 / 25) TUTTU', () => {
    const measured = new Map<string, number>();
    for (const entry of ARITHMETIC_CASES) {
      const bytes = example(entry.id);
      const plan = planManagementBody(readFrameControl(bytes).subtype);
      const walk = walkDot11Elements(
        bytes,
        DOT11_BASE_HEADER_LENGTH + plan.fixedLength,
        bytes.length - DOT11_FCS_LENGTH,
      );
      measured.set(
        entry.id,
        walk.elements.reduce((total, element) => total + 2 + element.length, 0),
      );
    }
    expect(measured.get('beacon')).toBe(104);
    expect(measured.get('association-response')).toBe(24);
    expect(measured.get('probe-request')).toBe(25);
    // Brifte SAYI VERİLMEYEN üçü de kayda geçer.
    expect(measured.get('association-request')).toBe(47);
    expect(measured.get('probe-response')).toBe(98);
    expect(measured.get('authentication')).toBe(0);
  });
});

describe('sabit alan planı — alt tip başına', () => {
  it('brifin ON BİR alt tipi tabloda ve uzunlukları TUTUYOR', () => {
    const expected = new Map<number, number>([
      [0, 4],
      [1, 6],
      [2, 10],
      [3, 6],
      [4, 0],
      [5, 12],
      [8, 12],
      [10, 2],
      [11, 6],
      [12, 2],
      [13, 1],
      [14, 1],
    ]);
    for (const [subtype, fixedLength] of expected) {
      const plan = planManagementBody(subtype);
      expect(plan.known, `alt tip ${String(subtype)}`).toBe(true);
      expect(plan.fixedLength, `alt tip ${String(subtype)}`).toBe(fixedLength);
    }
  });

  it('Action (13/14) sabit alandan SONRA element zinciri BEKLEMEZ — 18c`nin işi', () => {
    expect(planManagementBody(13).elementsFollow).toBe(false);
    expect(planManagementBody(14).elementsFollow).toBe(false);
    expect(planManagementBody(8).elementsFollow).toBe(true);
  });

  it('tabloda OLMAYAN yönetim alt tipi UYDURULMAZ', () => {
    // 6 (Timing Advertisement) ve 9 (ATIM) adlandırılmış olsa bile gövde
    // yerleşimleri bu sürümde YOK; varsaymak sessiz kayma üretirdi.
    for (const subtype of [6, 7, 9, 15]) {
      const plan = planManagementBody(subtype);
      expect(plan.known, `alt tip ${String(subtype)}`).toBe(false);
      expect(plan.fixedLength).toBe(0);
    }
  });
});

describe('Capability Information — 16 bit, little-endian', () => {
  it('bit sırası IEEE tablosuyla aynı ve Privacy 4. bittir', () => {
    expect(CAPABILITY_BIT_NAMES).toHaveLength(16);
    expect(CAPABILITY_BIT_NAMES[CAPABILITY_PRIVACY_BIT]).toBe('Privacy');
    expect(CAPABILITY_BIT_NAMES[0]).toBe('ESS');
    expect(CAPABILITY_BIT_NAMES[10]).toBe('Short Slot Time');
  });

  it('gerçek Beacon`ın `11 04`ü ESS + Privacy + Short Slot Time verir', () => {
    // LE: `11 04` → 0x0411. Brifin `[KANIT]` satırı.
    expect(describeCapabilities(0x0411)).toBe('ESS, Privacy, Short Slot Time');
    const frame = decoded(example('beacon'));
    expect(fieldById(frame, 'mgmt-capability')?.rawValue).toBe('0x0411');
    expect(physical(frame, 'mgmt-capability')).toBe('ESS, Privacy, Short Slot Time');
  });

  it('Privacy AYRI satırdır — SIFIR olduğunda da GÖRÜNÜR', () => {
    const frame = decoded(example('beacon'));
    expect(fieldById(frame, 'mgmt-capability-privacy')?.rawValue).toBe(1);
    expect(physical(frame, 'mgmt-capability-privacy')).toContain('required');

    // Privacy biti düşürülmüş bir Beacon: "kurulu bayrakları say" biçimi bunu
    // GÖSTEREMEZDİ, ayrı satır gösteriyor.
    const open = Uint8Array.from(example('beacon'));
    open[34] = (open[34] ?? 0) & ~(1 << CAPABILITY_PRIVACY_BIT);
    const openFrame = decoded(open);
    expect(fieldById(openFrame, 'mgmt-capability-privacy')?.rawValue).toBe(0);
    expect(physical(openFrame, 'mgmt-capability-privacy')).toContain('open network');
  });
});

describe('sabit alanlar gerçek çerçevelerde', () => {
  it('Beacon: TSF zaman damgası µs, aralık 100 TU', () => {
    const frame = decoded(example('beacon'));
    expect(fieldById(frame, 'mgmt-timestamp')?.unit).toBe('µs');
    expect(fieldById(frame, 'mgmt-timestamp')?.rawValue).toBe(4761907593n);
    expect(fieldById(frame, 'mgmt-beacon-interval')?.rawValue).toBe(100);
    expect(fieldById(frame, 'mgmt-beacon-interval')?.unit).toBe('TU');
  });

  it('Authentication: "Open System / seq 1 / Successful" üçlüsü', () => {
    const frame = decoded(example('authentication'));
    expect(physical(frame, 'mgmt-auth-algorithm')).toBe('0 — Open System');
    expect(fieldById(frame, 'mgmt-auth-sequence')?.rawValue).toBe(1);
    expect(physical(frame, 'mgmt-status-code')).toBe('0 — Successful');
  });

  it('Disassociation: Reason Code 8 adlandırılır', () => {
    const frame = decoded(example('disassociation'));
    expect(physical(frame, 'mgmt-reason-code')).toContain('8 — Disassociated');
  });

  it('Association Response: AID`in ÜST İKİ BİTİ maskelenir', () => {
    const frame = decoded(example('association-response'));
    // Telde `01 c0` → 0xC001; AID 14 bittir ve 1 eder.
    expect(fieldById(frame, 'mgmt-aid')?.rawValue).toBe('0xC001');
    expect(physical(frame, 'mgmt-aid')).toContain('1 (');
  });

  it('Association Request: Listen Interval SAYIMDIR, `unit` TAŞIMAZ', () => {
    const frame = decoded(example('association-request'));
    expect(fieldById(frame, 'mgmt-listen-interval')?.rawValue).toBe(10);
    expect(fieldById(frame, 'mgmt-listen-interval')?.unit).toBeUndefined();
    expect(physical(frame, 'mgmt-listen-interval')).toContain('beacon interval');
  });

  it('Probe Request: sabit alan YOKTUR, gövde doğrudan element zinciridir', () => {
    const frame = decoded(example('probe-request'));
    expect(fieldById(frame, 'mgmt-capability')).toBeUndefined();
    expect(fieldById(frame, 'ie-0')?.offset).toBe(24);
    expect(physical(frame, 'ie-0')).toBe('"Coherer"');
  });

  it('tabloda OLMAYAN kod UYDURULMAZ, sayı basılır', () => {
    const auth = Uint8Array.from(example('authentication'));
    auth[28] = 0xf0; // Status Code 240 — tabloda yok.
    const frame = decoded(auth);
    expect(physical(frame, 'mgmt-status-code')).toContain('240');
    expect(physical(frame, 'mgmt-status-code')).toContain('not in this release');
    expect(fieldById(frame, 'mgmt-status-code')?.warnings).toContain(
      'protocol.wifi.field.codeNotInTable',
    );
  });
});

describe('Action ve sınır durumları', () => {
  /** TÜRETİLMİŞ Action çerçevesi: FC `d0 00`, Category 3 (BA), gövde ham. */
  const ACTION_HEADER_AND_BODY =
    'd0 00 3a 01 00 0c 41 82 b2 55 00 0d 93 82 36 3a 00 0c 41 82 b2 55 70 01 ' +
    '03 00 01 02 03';

  it('Action: Category BASILIR, gövde 18c için HAM kalır', () => {
    const built = hexToBytes(ACTION_HEADER_AND_BODY);
    const frame = decoded(withFcs(built));
    expect(fieldById(frame, 'mgmt-action-category')?.rawValue).toBe(3);
    expect(physical(frame, 'mgmt-action-category')).toContain('category specific');
    expect(fieldById(frame, 'mgmt-action-body')?.length).toBe(4);
    expect(frame.warnings.map((warning) => warning.code)).toContain('actionBodyNotDecoded');
    // Action gövdesinde element zinciri ARANMAZ.
    expect(frame.fields.some((entry) => entry.id.startsWith('ie-'))).toBe(false);
  });

  it('sabit alanlara YETMEYEN gövde yarım basılmaz, HAM bırakılır', () => {
    // Beacon (12 baytlık sabit alan) ama gövdede yalnız 5 bayt var.
    const built = hexToBytes(
      '80 00 00 00 ff ff ff ff ff ff 00 0c 41 82 b2 55 00 0c 41 82 b2 55 50 f8 89 f1 d4 1b 01',
    );
    const frame = decoded(withFcs(built));
    expect(fieldById(frame, 'mgmt-timestamp')).toBeUndefined();
    expect(fieldById(frame, 'mgmt-body-truncated')?.valid).toBe(false);
    expect(frame.warnings.map((warning) => warning.code)).toContain('managementBodyTruncated');
  });

  it('tabloda olmayan yönetim alt tipinin gövdesi HAM kalır', () => {
    const built = hexToBytes(
      '90 00 00 00 ff ff ff ff ff ff 00 0c 41 82 b2 55 00 0c 41 82 b2 55 50 f8 aa bb cc dd',
    );
    const frame = decoded(withFcs(built));
    expect(frame.warnings.map((warning) => warning.code)).toContain('managementSubtypeNotDecoded');
    expect(frame.warnings.map((warning) => warning.code)).toContain('bodyNotDecoded');
    expect(fieldById(frame, 'body')?.length).toBe(4);
  });
});

/** Türetilmiş çerçevenin FCS'i ELLE YAZILMAZ; motorun kendi CRC'siyle üretilir. */
function withFcs(headerAndBody: Uint8Array): Uint8Array {
  const frame = new Uint8Array(headerAndBody.length + DOT11_FCS_LENGTH);
  frame.set(headerAndBody, 0);
  let crc = 0xffffffff;
  for (const byte of headerAndBody) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  const fcs = (crc ^ 0xffffffff) >>> 0;
  frame[headerAndBody.length] = fcs & 0xff;
  frame[headerAndBody.length + 1] = (fcs >>> 8) & 0xff;
  frame[headerAndBody.length + 2] = (fcs >>> 16) & 0xff;
  frame[headerAndBody.length + 3] = (fcs >>> 24) & 0xff;
  return frame;
}

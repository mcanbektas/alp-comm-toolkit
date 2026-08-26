import { describe, expect, it } from 'vitest';

import { computeNamedCrc } from '@/protocol-core/checksums';
import type { ProtocolError, ProtocolWarning } from '@/protocol-core/types';

import {
  ADDRESS_ROLE_BOTH,
  ADDRESS_ROLE_RAW,
  CONTROL_SUBTYPE_NAMES,
  DOT11_DEFAULT_OPTIONS,
  DOT11_FCS_LENGTH,
  FCS_PRESENT_NO,
  FCS_PRESENT_YES,
  MANAGEMENT_SUBTYPE_NAMES,
  PRESENCE_NO,
  PRESENCE_YES,
  VENDOR_LABELS_HIDE,
  checkDot11Fcs,
  classifyFrame,
  createFieldSink,
  dataSubtypeName,
  decodeDot11Header,
  hasDot11Signature,
  hasFcslessDot11Signature,
  hasStrictFcslessDot11Signature,
  htControlIsMeaningful,
  minimumFrameLength,
  planDot11Header,
  pushDot11Fcs,
  readFrameControl,
  resolveAddressRoles,
} from './dot11Frame';
import type { Dot11DecodeOptions, Dot11HeaderSummary, FieldSink } from './dot11Frame';
import { wifiPlugin } from './wifi';

/**
 * Faz 10 dalga 18a — 802.11 MAC başlığı çözücüsünün birim testleri.
 *
 * Fixture'lar `wifiPlugin.exampleFrames`ten OKUNUR, kopyalanmaz: spec §42/§43
 * "ekranda çalışan örnek testte de yeşildir" kuralı. Sekiz örnek gerçek
 * `wpa-Induction.pcap` çerçevesidir; ikisi türetilmiştir ve FCS'leri motorun
 * kendi CRC-32'siyle üretilmiştir.
 */

function exampleBytes(id: string): Uint8Array {
  const example = wifiPlugin.exampleFrames.find((candidate) => candidate.id === id);
  if (example === undefined) throw new Error(`missing example: ${id}`);
  return example.bytes;
}

interface DecodeHarness {
  readonly sink: FieldSink;
  readonly warnings: ProtocolWarning[];
  readonly errors: ProtocolError[];
  readonly summary: Dot11HeaderSummary;
}

function decode(data: Uint8Array, options?: Partial<Dot11DecodeOptions>): DecodeHarness {
  const sink = createFieldSink();
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];
  const merged: Dot11DecodeOptions = { ...DOT11_DEFAULT_OPTIONS, ...options };
  const summary = decodeDot11Header(data, sink, warnings, errors, merged);
  pushDot11Fcs(data, sink, warnings, errors, summary, merged);
  return { sink, warnings, errors, summary };
}

function field(harness: DecodeHarness, id: string) {
  return harness.sink.fields.find((candidate) => candidate.id === id);
}

function hexToBytes(hex: string): Uint8Array {
  const parts = hex.trim().split(/\s+/);
  const bytes = new Uint8Array(parts.length);
  for (let index = 0; index < parts.length; index += 1) {
    bytes[index] = Number.parseInt(parts[index] ?? '0', 16) & 0xff;
  }
  return bytes;
}

function appendFcs(headerAndBody: Uint8Array): Uint8Array {
  const frame = new Uint8Array(headerAndBody.length + DOT11_FCS_LENGTH);
  frame.set(headerAndBody, 0);
  const fcs = Number(computeNamedCrc(headerAndBody, 'CRC32')) >>> 0;
  frame[headerAndBody.length] = fcs & 0xff;
  frame[headerAndBody.length + 1] = (fcs >>> 8) & 0xff;
  frame[headerAndBody.length + 2] = (fcs >>> 16) & 0xff;
  frame[headerAndBody.length + 3] = (fcs >>> 24) & 0xff;
  return frame;
}

// ── FCS ───────────────────────────────────────────────────────────────────

describe('802.11 FCS — katalogdaki CRC32, sahte dostu CRC32C DEĞİL', () => {
  it('gerçek ACK çerçevesinde katalog CRC32 birebir tutuyor', () => {
    const ack = exampleBytes('ack');
    const covered = ack.subarray(0, ack.length - DOT11_FCS_LENGTH);
    const calculated = Number(computeNamedCrc(covered, 'CRC32'));
    const check = checkDot11Fcs(ack);
    expect(check?.valid).toBe(true);
    expect(check?.calculated).toBe(calculated);
    // Kapsam = FCS HARİÇ tüm çerçeve; ACK'te 10 bayt.
    expect(check?.offset).toBe(10);
  });

  it('🚨 CRC32C AYNI çerçevede BAŞKA sonuç verir — hata vermeden yanlış PASS basardı', () => {
    const ack = exampleBytes('ack');
    const covered = ack.subarray(0, ack.length - DOT11_FCS_LENGTH);
    const correct = Number(computeNamedCrc(covered, 'CRC32'));
    const falseFriend = Number(computeNamedCrc(covered, 'CRC32C'));
    expect(falseFriend).not.toBe(correct);
  });

  it('sekiz gerçek çerçevenin YEDİSİ PASS, biri (yakalamanın kendi bozuğu) FAIL', () => {
    const passing = [
      'beacon',
      'ack',
      'protected-data',
      'probe-request',
      'authentication',
      'association-response',
      'disassociation',
    ];
    for (const id of passing) {
      expect(checkDot11Fcs(exampleBytes(id))?.valid, id).toBe(true);
    }
    expect(checkDot11Fcs(exampleBytes('corrupt-fcs'))?.valid).toBe(false);
  });

  it('türetilmiş iki çerçevenin FCS`i motorun kendi CRC`siyle üretildi', () => {
    expect(checkDot11Fcs(exampleBytes('four-address-wds'))?.valid).toBe(true);
    expect(checkDot11Fcs(exampleBytes('qos-data'))?.valid).toBe(true);
  });
});

// ── Ofset zinciri ─────────────────────────────────────────────────────────

describe('ofset zinciri — sınıf başına DEĞİŞKEN başlık uzunluğu', () => {
  it('ACK 14 baytta doğru çözülür: A2 ve SeqCtl YOKTUR', () => {
    const harness = decode(exampleBytes('ack'));
    expect(harness.summary.readable).toBe(true);
    expect(harness.summary.frameClass).toBe('control');
    expect(harness.summary.subtypeName).toBe('ACK');
    // 2 (FC) + 2 (Duration) + 6 (A1) = 10; gövde YOK.
    expect(harness.summary.headerLength).toBe(10);
    expect(harness.summary.bodyLength).toBe(0);
    expect(harness.summary.addresses).toHaveLength(1);
    expect(field(harness, 'address-2')).toBeUndefined();
    expect(field(harness, 'sequence-number')).toBeUndefined();
    expect(field(harness, 'fragment-number')).toBeUndefined();
    expect(harness.summary.sequenceNumber).toBeUndefined();
    expect(harness.errors).toEqual([]);
  });

  it('sekiz gerçek çerçevede `başlık + gövde + FCS === n` ARİTMETİĞİ tutar', () => {
    const expectations: readonly (readonly [string, number, number, number])[] = [
      // [örnek, toplam, başlık, gövde]
      ['beacon', 144, 24, 116],
      ['ack', 14, 10, 0],
      ['protected-data', 94, 24, 66],
      ['probe-request', 53, 24, 25],
      ['authentication', 34, 24, 6],
      ['association-response', 58, 24, 30],
      ['disassociation', 30, 24, 2],
      ['corrupt-fcs', 65, 24, 37],
    ];
    for (const [id, total, headerLength, bodyLength] of expectations) {
      const bytes = exampleBytes(id);
      expect(bytes.length, id).toBe(total);
      const harness = decode(bytes);
      expect(harness.summary.headerLength, id).toBe(headerLength);
      expect(harness.summary.bodyLength, id).toBe(bodyLength);
      expect(headerLength + bodyLength + DOT11_FCS_LENGTH, id).toBe(total);
    }
  });

  it('CTS ve ACK dışındaki ADLANDIRILMIŞ kontrol çerçevelerinde A2 VAR, SeqCtl YOK', () => {
    // RTS (alt tip 11): FC + Duration + RA + TA = 16 bayt.
    const rts = appendFcs(hexToBytes('b4 00 3a 01 00 0c 41 82 b2 55 00 0d 93 82 36 3a'));
    const harness = decode(rts);
    expect(harness.summary.subtypeName).toBe('RTS');
    expect(harness.summary.headerLength).toBe(16);
    expect(harness.summary.addresses).toHaveLength(2);
    expect(harness.summary.sequenceNumber).toBeUndefined();
    expect(harness.summary.bodyLength).toBe(0);
  });

  it('ADLANDIRILMAMIŞ kontrol alt tipinde A2 UYDURULMAZ — geometri bilinmiyor denir', () => {
    // Alt tip 7 (Control Wrapper) — 0-7 aralığının geometrileri farklı.
    const wrapper = appendFcs(hexToBytes('74 00 00 00 00 0c 41 82 b2 55 aa bb cc dd ee ff'));
    const harness = decode(wrapper);
    expect(harness.summary.layout.controlGeometryUnknown).toBe(true);
    expect(harness.summary.headerLength).toBe(10);
    expect(harness.summary.addresses).toHaveLength(1);
    expect(harness.warnings.map((warning) => warning.code)).toContain('controlGeometryUnknown');
    // Kalan baytlar HAM: gövde uzunluğu onları sayar.
    expect(harness.summary.bodyLength).toBe(6);
  });

  it('dört adresli WDS dalında A4 SeqCtl`den SONRA gelir ve başlık 30 bayttır', () => {
    const harness = decode(exampleBytes('four-address-wds'));
    expect(harness.summary.headerLength).toBe(30);
    expect(harness.summary.addresses).toHaveLength(4);
    expect(field(harness, 'address-4')?.offset).toBe(24);
    expect(field(harness, 'sequence-number')?.offset).toBe(22);
    // Alanlar TEL SIRASINDA basılır: SeqCtl, A4'ten ÖNCE.
    const ids = harness.sink.fields.map((entry) => entry.id);
    expect(ids.indexOf('sequence-number')).toBeLessThan(ids.indexOf('address-4'));
  });

  it('QoS Data`da QoS Control alanı VAR ve başlık 26 bayta çıkar', () => {
    const harness = decode(exampleBytes('qos-data'));
    expect(harness.summary.subtypeName).toBe('QoS Data');
    expect(harness.summary.headerLength).toBe(26);
    expect(harness.summary.qosControl).toBe(0x0006);
    expect(field(harness, 'qos-tid')?.physicalValue).toBe('6');
  });

  it('FCS alanı gövdeden SONRA basılır — alan listesi ofset sırasını korur', () => {
    const harness = decode(exampleBytes('beacon'));
    const ids = harness.sink.fields.map((entry) => entry.id);
    expect(ids.indexOf('body')).toBeLessThan(ids.indexOf('fcs'));
    const offsets = harness.sink.fields.map((entry) => entry.offset);
    expect(offsets).toEqual([...offsets].sort((left, right) => left - right));
  });
});

// ── 🚨 +HTC / Order tuzağı ────────────────────────────────────────────────

describe('🚨 +HTC / Order tuzağı — aynı bit, TÜRE GÖRE farklı anlam', () => {
  it('QoS-OLMAYAN Data çerçevesinde bit 15 açık olsa bile HT Control YOKTUR', () => {
    const fc = readFrameControl(hexToBytes('08 80'));
    expect(fc.type).toBe(2);
    expect(fc.subtype).toBe(0);
    expect(fc.orderOrHtc).toBe(true);
    expect(htControlIsMeaningful(fc)).toBe(false);
    // Ana brifin sözde-kodu burada +4 diyordu; doğru cevap 24.
    expect(planDot11Header(fc).headerLength).toBe(24);
    expect(planDot11Header(fc).htControlOffset).toBeUndefined();
  });

  it('QoS Data çerçevesinde AYNI bit HT Control demektir (24 + 2 + 4 = 30)', () => {
    const fc = readFrameControl(hexToBytes('88 80'));
    expect(htControlIsMeaningful(fc)).toBe(true);
    const layout = planDot11Header(fc);
    expect(layout.qosControlOffset).toBe(24);
    expect(layout.htControlOffset).toBe(26);
    expect(layout.headerLength).toBe(30);
  });

  it('Yönetim çerçevesinde bit 15 HT Control demektir (24 + 4 = 28)', () => {
    const fc = readFrameControl(hexToBytes('80 80'));
    expect(htControlIsMeaningful(fc)).toBe(true);
    expect(planDot11Header(fc).headerLength).toBe(28);
  });

  it('QoS-olmayan Data`da açık Order biti UYARI basar — sessiz 4 baytlık kayma önlenir', () => {
    const frame = appendFcs(
      hexToBytes('08 80 00 00 00 0c 41 82 b2 55 00 0d 93 82 36 3a 00 0c 41 82 b2 55 00 00 de ad'),
    );
    const harness = decode(frame);
    expect(harness.warnings.map((warning) => warning.code)).toContain('orderBitWithoutHtControl');
    expect(harness.summary.headerLength).toBe(24);
    expect(field(harness, 'fc-order-htc')?.name).toContain('Order');
    expect(field(harness, 'ht-control')).toBeUndefined();
  });
});

// ── 🚨 Adres rol matrisi ──────────────────────────────────────────────────

describe('🚨 adres rol matrisi — "Address 1 = hedef" VARSAYILMAZ', () => {
  it('dört dalın hepsi tablodaki rolleri verir', () => {
    const roles = (b1: string): readonly (string | undefined)[] =>
      resolveAddressRoles(readFrameControl(hexToBytes(`08 ${b1}`)));
    expect(roles('00')).toEqual(['DA', 'SA', 'BSSID', undefined]);
    expect(roles('02')).toEqual(['DA', 'BSSID', 'SA', undefined]);
    expect(roles('01')).toEqual(['BSSID', 'SA', 'DA', undefined]);
    expect(roles('03')).toEqual([undefined, undefined, 'DA', 'SA']);
  });

  it('GERÇEK korumalı Data çerçevesi ToDS=0/FromDS=1 dalını KANITLAR', () => {
    const harness = decode(exampleBytes('protected-data'));
    const [first, second, third] = harness.summary.addresses;
    expect(harness.summary.frameControl.toDs).toBe(false);
    expect(harness.summary.frameControl.fromDs).toBe(true);
    expect(first?.text).toBe('01:80:C2:00:00:00');
    expect(first?.resolvedRole).toBe('DA');
    expect(first?.groupAddressed).toBe(true);
    expect(first?.groupLabel).toBe('IEEE 802.1D Spanning Tree');
    expect(second?.text).toBe('00:0C:41:82:B2:55');
    expect(second?.resolvedRole).toBe('BSSID');
    expect(third?.resolvedRole).toBe('SA');
  });

  it('kontrol çerçevelerinde bağlamsal rol YOKTUR; PS-Poll`da Addr1 BSSID`dir', () => {
    expect(resolveAddressRoles(readFrameControl(hexToBytes('d4 00')))[0]).toBeUndefined();
    // PS-Poll (alt tip 10) standardın kendi istisnasıdır.
    expect(resolveAddressRoles(readFrameControl(hexToBytes('a4 00')))[0]).toBe('BSSID');
  });

  it('I/G, U/L ve broadcast bitleri her adreste okunur', () => {
    const harness = decode(exampleBytes('probe-request'));
    const [first, second, third] = harness.summary.addresses;
    expect(first?.broadcast).toBe(true);
    expect(first?.groupAddressed).toBe(true);
    expect(second?.broadcast).toBe(false);
    expect(second?.groupAddressed).toBe(false);
    expect(second?.locallyAdministered).toBe(false);
    // Addr3 joker BSSID: reddedilen dar imzanın (`W5`) karşı örneği.
    expect(third?.broadcast).toBe(true);
  });

  it('adres rolü gösterimi üç şıkta da alan ADINI değiştirir', () => {
    const frame = exampleBytes('protected-data');
    expect(field(decode(frame), 'address-1')?.name).toBe('802.11 · Address 1 · DA');
    expect(field(decode(frame, { addressRoleDisplay: ADDRESS_ROLE_RAW }), 'address-1')?.name).toBe(
      '802.11 · Address 1',
    );
    expect(field(decode(frame, { addressRoleDisplay: ADDRESS_ROLE_BOTH }), 'address-1')?.name).toBe(
      '802.11 · Address 1 · RA / DA',
    );
  });

  it('üretici etiketi KAPATILABİLİR ama grup adresinin ANLAMI kaybolmaz', () => {
    const harness = decode(exampleBytes('protected-data'), {
      vendorAddressLabels: VENDOR_LABELS_HIDE,
    });
    expect(String(field(harness, 'address-2')?.physicalValue)).not.toContain('Cisco');
    // "broadcast" / "Spanning Tree" bir ÜRETİCİ ADI değil, adresin anlamıdır.
    expect(String(field(harness, 'address-1')?.physicalValue)).toContain('Spanning Tree');
  });
});

// ── Frame Control ve alt tipler ───────────────────────────────────────────

describe('Frame Control — 11 alt alan ve alt tip adlandırması', () => {
  it('on bir alt alanın hepsi basılır', () => {
    const harness = decode(exampleBytes('beacon'));
    const ids = harness.sink.fields.filter((entry) => entry.id.startsWith('fc-'));
    expect(ids.map((entry) => entry.id)).toEqual([
      'fc-protocol-version',
      'fc-type',
      'fc-subtype',
      'fc-to-ds',
      'fc-from-ds',
      'fc-more-fragments',
      'fc-retry',
      'fc-power-management',
      'fc-more-data',
      'fc-protected',
      'fc-order-htc',
    ]);
  });

  it('sınıflandırma ve asgari uzunluk tablosu (W12`nin orta ayağı)', () => {
    expect(classifyFrame(0)).toBe('management');
    expect(classifyFrame(1)).toBe('control');
    expect(classifyFrame(2)).toBe('data');
    expect(classifyFrame(3)).toBe('extension');
    expect(minimumFrameLength(readFrameControl(hexToBytes('d4 00')))).toBe(14);
    expect(minimumFrameLength(readFrameControl(hexToBytes('c4 00')))).toBe(14);
    expect(minimumFrameLength(readFrameControl(hexToBytes('b4 00')))).toBe(20);
    expect(minimumFrameLength(readFrameControl(hexToBytes('80 00')))).toBe(28);
    expect(minimumFrameLength(readFrameControl(hexToBytes('08 00')))).toBe(28);
  });

  it('Data alt tip adı EZBERLENMEZ, bitlerden TÜRETİLİR', () => {
    expect(dataSubtypeName(0)).toBe('Data');
    expect(dataSubtypeName(4)).toBe('Null');
    expect(dataSubtypeName(8)).toBe('QoS Data');
    expect(dataSubtypeName(12)).toBe('QoS Null');
    expect(dataSubtypeName(1)).toBe('Data + CF-Ack');
    expect(dataSubtypeName(3)).toBe('Data + CF-Ack + CF-Poll');
    // 13 standartta REZERVEDİR; türetme oraya uygulanmaz.
    expect(dataSubtypeName(13)).toBeUndefined();
  });

  it('bilinmeyen alt tip HATA DEĞİLDİR — alan geçerli kalır, uyarı düşer', () => {
    // Yönetim alt tip 7: tabloda yok.
    const frame = appendFcs(
      hexToBytes('70 00 00 00 00 0c 41 82 b2 55 00 0d 93 82 36 3a 00 0c 41 82 b2 55 00 00'),
    );
    const harness = decode(frame);
    const subtype = field(harness, 'fc-subtype');
    expect(subtype?.valid).toBe(true);
    expect(subtype?.physicalValue).toBeUndefined();
    expect(harness.warnings.map((warning) => warning.code)).toContain('unknownSubtype');
    expect(harness.errors).toEqual([]);
  });

  it('alt tip tabloları 18b/18c için `export` edilmiştir', () => {
    expect(MANAGEMENT_SUBTYPE_NAMES.get(8)).toBe('Beacon');
    expect(MANAGEMENT_SUBTYPE_NAMES.get(13)).toBe('Action');
    expect(CONTROL_SUBTYPE_NAMES.get(13)).toBe('ACK');
    expect(CONTROL_SUBTYPE_NAMES.has(7)).toBe(false);
  });

  it('Duration/ID yalnız GERÇEK süre olduğunda birim taşır', () => {
    // Authentication: 0x013A = 314 µs.
    expect(field(decode(exampleBytes('authentication')), 'duration-id')?.unit).toBe('µs');
    // PS-Poll: alan bir SÜRE DEĞİL, AID — birim YOK.
    const psPoll = appendFcs(hexToBytes('a4 00 01 c0 00 0c 41 82 b2 55 00 0d 93 82 36 3a'));
    const harness = decode(psPoll);
    const duration = field(harness, 'duration-id');
    expect(duration?.unit).toBeUndefined();
    expect(duration?.physicalValue).toBe('AID 1');
  });

  it('Type 3 (Extension) AÇIKÇA reddedilir — sessizce "geçersiz" denmez', () => {
    const frame = appendFcs(hexToBytes('0c 00 00 00 00 0c 41 82 b2 55 00 00 00 00 00 00 00 00 00 00 00 00 00 00'));
    const harness = decode(frame);
    expect(harness.summary.readable).toBe(false);
    expect(harness.errors[0]?.code).toBe('unsupported-encoding');
    // Okunabilen Frame Control alanları YİNE basılır (boş kart yasağı).
    expect(field(harness, 'fc-type')?.physicalValue).toBe('extension');
  });
});

// ── Sequence Control ──────────────────────────────────────────────────────

describe('Sequence Control — 16 bit LE tek sayı, sonra maskelenir', () => {
  it('gerçek Beacon`da `50 f8` → frag 0, seq 3973', () => {
    const harness = decode(exampleBytes('beacon'));
    expect(harness.summary.sequenceNumber).toBe(3973);
    expect(harness.summary.fragmentNumber).toBe(0);
  });

  it('bozuk çerçevede parça numarası da okunur (kısmi çözüm gösterilir)', () => {
    const harness = decode(exampleBytes('corrupt-fcs'));
    expect(harness.summary.sequenceNumber).toBe(557);
    expect(harness.summary.fragmentNumber).toBe(5);
  });
});

// ── decodeOptions kanallarının çekirdek üzerindeki etkisi ─────────────────

describe('kanallar — çekirdek davranışı', () => {
  it('`fcsPresent = no` FCS alanını HİÇ basmaz ve gövdeyi dört bayt uzatır', () => {
    const harness = decode(exampleBytes('beacon'), { fcsPresent: FCS_PRESENT_NO });
    expect(field(harness, 'fcs')).toBeUndefined();
    expect(harness.summary.fcsPresent).toBe(false);
    expect(harness.summary.bodyLength).toBe(120);
    expect(harness.errors).toEqual([]);
  });

  it('`fcsPresent = auto` bozuk FCS`i GİZLEMEZ — FAIL basar ve alternatifi söyler', () => {
    const harness = decode(exampleBytes('corrupt-fcs'));
    expect(field(harness, 'fcs')?.valid).toBe(false);
    expect(String(field(harness, 'fcs')?.physicalValue)).toContain('FAIL');
    expect(harness.errors.map((error) => error.code)).toContain('crc-mismatch');
    expect(harness.warnings.map((warning) => warning.code)).toContain('fcsMismatch');
  });

  it('`fcsPresent = yes` yer kalmadığında AÇIKÇA kesik der', () => {
    const harness = decode(hexToBytes('d4 00 00 00 00 0c 41 82 b2 55'), {
      fcsPresent: FCS_PRESENT_YES,
    });
    expect(harness.errors.map((error) => error.code)).toContain('truncated-frame');
  });

  it('QoS ve HT Control varlığı ELLE geçersiz kılınabilir ve uyarı düşer', () => {
    const qosOff = decode(exampleBytes('qos-data'), { qosControlPresent: PRESENCE_NO });
    expect(qosOff.summary.headerLength).toBe(24);
    expect(qosOff.warnings.map((warning) => warning.code)).toContain('qosControlForced');

    const htOn = decode(exampleBytes('beacon'), { htControlPresent: PRESENCE_YES });
    expect(htOn.summary.headerLength).toBe(28);
    expect(htOn.warnings.map((warning) => warning.code)).toContain('htControlForced');
  });
});

// ── `canParse` imzaları ───────────────────────────────────────────────────

describe('imzalar — W12 motorda, W13 yalnız ÖLÇÜM için', () => {
  it('W12 dört koşulun TAMAMIDIR — hiçbiri tek başına yetmez', () => {
    const beacon = exampleBytes('beacon');
    expect(hasDot11Signature(beacon)).toBe(true);

    // Protokol sürümü bozulursa eler.
    const badVersion = Uint8Array.from(beacon);
    badVersion[0] = (badVersion[0] ?? 0) | 0x02;
    expect(hasDot11Signature(badVersion)).toBe(false);

    // FCS bozulursa eler (W13'ün eleyemediği yer).
    const badFcs = Uint8Array.from(beacon);
    badFcs[beacon.length - 1] = ((badFcs[beacon.length - 1] ?? 0) ^ 0xff) & 0xff;
    expect(hasDot11Signature(badFcs)).toBe(false);
    expect(hasFcslessDot11Signature(badFcs)).toBe(true);
    expect(hasStrictFcslessDot11Signature(badFcs)).toBe(true);

    // Uzunluk kapısı: 27 baytlık bir yönetim çerçevesi 28'i geçemez.
    expect(hasDot11Signature(beacon.subarray(0, 27))).toBe(false);
  });

  it('DEJENERE girdide `true` DÖNMEZ (`schemaParser.ts` mayınının sınıfı)', () => {
    expect(hasDot11Signature(new Uint8Array(0))).toBe(false);
    expect(hasDot11Signature(new Uint8Array(9))).toBe(false);
    expect(hasFcslessDot11Signature(new Uint8Array(0))).toBe(false);
    // 10 baytlık sıfır dizisi: sürüm 0 ve type 0 ama uzunluk 28'in altında.
    expect(hasDot11Signature(new Uint8Array(10))).toBe(false);
  });

  it('bozuk-FCS örneği W12`yi YALNIZ FCS`te kaybeder — BEKLENEN istisna', () => {
    const corrupt = exampleBytes('corrupt-fcs');
    expect(hasDot11Signature(corrupt)).toBe(false);
    expect(hasFcslessDot11Signature(corrupt)).toBe(true);
  });

  it('imza kaydın ÖTEKİ dokuz örneğinin hepsinde `true`', () => {
    for (const example of wifiPlugin.exampleFrames) {
      if (example.id === 'corrupt-fcs') continue;
      expect(hasDot11Signature(example.bytes), example.id).toBe(true);
    }
  });
});

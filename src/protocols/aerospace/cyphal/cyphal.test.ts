import { describe, expect, it } from 'vitest';

import {
  CYPHAL_SPEC_V1_0,
  CYPHAL_SPEC_V1_1,
  buildCyphalTailByte,
  cyphalParser,
  cyphalPlugin,
  decodeCyphalIdentity,
  decodeCyphalTailByte,
  encodeCyphalV11MessageId,
  isCyphalV11MessageLayout,
  parseCyphal,
} from './cyphal';
import { buildCanClassicFrame } from '../../automotive/can/canClassic';
import { buildCanFdFrame } from '../../automotive/can/canFd';
import { CAN_FD_FRAME_LENGTH } from '../../automotive/can/canFrame';
import { isParseSuccess } from '@/protocol-core/types';
import type { ParsedField, ProtocolWarning } from '@/protocol-core/types';

function fieldById(fields: readonly ParsedField[], id: string): ParsedField | undefined {
  return fields.find((field) => field.id === id);
}

function hasWarning(warnings: readonly ProtocolWarning[], code: string): boolean {
  return warnings.some((warning) => warning.code === code);
}

function exampleBytes(id: string): Uint8Array {
  const example = cyphalPlugin.exampleFrames.find((candidate) => candidate.id === id);
  if (example === undefined) throw new Error(`örnek çerçeve yok: ${id}`);
  return example.bytes;
}

/**
 * Faz 10 dalga 15b. Sayısal fixture'ların HEPSİ resmî Cyphal Specification'ın
 * "Examples" bölümünden BİREBİR alındı (`cyphal.ts` dosya başı "Kaynak turu");
 * uydurulmuş CAN ID yok.
 */
describe('decodeCyphalIdentity — sıra: SNM bit 25, sonra sürüm biti 7, EN SON anonimlik', () => {
  it('SNM(bit 25)=1 → servis; source node id 0 olsa BİLE anonim mesaja SAPMAZ', () => {
    const id = (0x1 << 25) >>> 0; // yalnız SNM biti
    const identity = decodeCyphalIdentity(id);
    expect(identity.kind).toBe('service-response');
  });

  it('SNM=0 ve source node id=0 → ANONİM DEĞİL, normal mesaj (v0 kuralı Cyphal’da GEÇERSİZ)', () => {
    const identity = decodeCyphalIdentity(0);
    expect(identity.kind).toBe('message');
    if (identity.kind !== 'message') throw new Error('daraltma');
    expect(identity.anonymous).toBe(false);
    expect(identity.sourceNodeId).toBe(0);
  });

  it('anonimlik yalnız bit 24’ten okunur', () => {
    const identity = decodeCyphalIdentity((0x1 << 24) >>> 0);
    expect(identity.kind).toBe('message');
    if (identity.kind !== 'message') throw new Error('daraltma');
    expect(identity.anonymous).toBe(true);
  });

  it('spec örneği 0x107D552A → nominal öncelik, subject 7509, kaynak düğüm 42', () => {
    const identity = decodeCyphalIdentity(0x107d552a);
    expect(identity.kind).toBe('message');
    if (identity.kind !== 'message') throw new Error('daraltma');
    expect(identity.priority).toBe(4);
    expect(identity.subjectId).toBe(7509);
    expect(identity.subjectIdWidth).toBe(13);
    expect(identity.sourceNodeId).toBe(42);
    expect(identity.anonymous).toBe(false);
    expect(identity.reserved23Zero).toBe(true);
  });

  it('spec örneği 0x136B957B → servis İSTEĞİ, service 430 (GetInfo), 123 → 42', () => {
    const identity = decodeCyphalIdentity(0x136b957b);
    expect(identity.kind).toBe('service-request');
    if (identity.kind === 'message') throw new Error('daraltma');
    expect(identity.serviceId).toBe(430);
    expect(identity.sourceNodeId).toBe(123);
    expect(identity.destinationNodeId).toBe(42);
  });

  it('spec örneği 0x126BBDAA → servis YANITI, aynı servis, yön ters', () => {
    const identity = decodeCyphalIdentity(0x126bbdaa);
    expect(identity.kind).toBe('service-response');
    if (identity.kind === 'message') throw new Error('daraltma');
    expect(identity.serviceId).toBe(430);
    expect(identity.sourceNodeId).toBe(42);
    expect(identity.destinationNodeId).toBe(123);
  });

  it('spec örneği 0x11133775 → anonim mesaj, subject 4919, ayrılmış bit 22/21 SIFIR', () => {
    const identity = decodeCyphalIdentity(0x11133775);
    expect(identity.kind).toBe('message');
    if (identity.kind !== 'message') throw new Error('daraltma');
    expect(identity.anonymous).toBe(true);
    expect(identity.subjectId).toBe(4919);
    expect(identity.sourceNodeId).toBe(117);
    // Spec: "Transmit 1; ignore (do not check) when receiving" — spec'in KENDİ
    // örneği 0 basıyor, bu yüzden `canParse` bu iki biti denetlemez.
    expect((0x11133775 >>> 22) & 0x1).toBe(0);
    expect((0x11133775 >>> 21) & 0x1).toBe(0);
  });

  it('v1.1 biçimi yalnız AÇIK opt-in ile 16-bit subject-ID olarak okunur', () => {
    const id = encodeCyphalV11MessageId(4, 9000, 42);
    expect(isCyphalV11MessageLayout(id)).toBe(true);

    const v10 = decodeCyphalIdentity(id, CYPHAL_SPEC_V1_0);
    expect(v10.kind).toBe('message');
    if (v10.kind !== 'message') throw new Error('daraltma');
    expect(v10.subjectIdWidth).toBe(13);

    const v11 = decodeCyphalIdentity(id, CYPHAL_SPEC_V1_1);
    expect(v11.kind).toBe('message');
    if (v11.kind !== 'message') throw new Error('daraltma');
    expect(v11.subjectIdWidth).toBe(16);
    expect(v11.subjectId).toBe(9000);
    expect(v11.sourceNodeId).toBe(42);
  });

  it('servis çerçevesinde bit 7 hedef node-ID’nin parçasıdır, sürüm ayırıcısı DEĞİL', () => {
    // 0x136B957B'in bit 7'si 0; hedef 42 = 0b0101010, en düşük biti 0.
    expect(isCyphalV11MessageLayout(0x136b957b)).toBe(false);
  });
});

describe('decodeCyphalTailByte — Toggle 1’den BAŞLAR (v0’ın TERSİ)', () => {
  it('spec örneği 0xE0 → SOT=1, EOT=1, Toggle=1, Transfer-ID=0', () => {
    const tail = decodeCyphalTailByte(0xe0);
    expect(tail).toEqual({
      startOfTransfer: true,
      endOfTransfer: true,
      toggle: true,
      transferId: 0,
      frameRole: 'single-frame',
    });
  });

  it('spec örneği 0xA1/0x01/0x21/0x61 → first / middle / middle / last', () => {
    expect(decodeCyphalTailByte(0xa1).frameRole).toBe('multi-frame-first');
    expect(decodeCyphalTailByte(0xa1).toggle).toBe(true);
    expect(decodeCyphalTailByte(0x01).frameRole).toBe('multi-frame-middle');
    expect(decodeCyphalTailByte(0x21).frameRole).toBe('multi-frame-middle');
    expect(decodeCyphalTailByte(0x61).frameRole).toBe('multi-frame-last');
    expect(decodeCyphalTailByte(0x61).transferId).toBe(1);
  });

  it('Transfer-ID 5 bit, modulo 32 — 0x1F üst sınır', () => {
    expect(decodeCyphalTailByte(0xff).transferId).toBe(31);
    expect(buildCyphalTailByte(true, true, true, 32)).toBe(0xe0);
  });
});

describe('parseCyphal — spec örnek çerçeveleri', () => {
  it('Heartbeat: alanlar bayt offset’leriyle çözülür, Transfer-ID’de `unit` YOK', () => {
    const result = parseCyphal(exampleBytes('heartbeat-message'));
    expect(isParseSuccess(result)).toBe(true);
    if (!isParseSuccess(result)) throw new Error('daraltma');

    expect(result.frame.valid).toBe(true);
    expect(fieldById(result.frame.fields, 'priority')?.physicalValue).toBe('Nominal');
    expect(fieldById(result.frame.fields, 'subject-id')?.rawValue).toBe(7509);
    expect(fieldById(result.frame.fields, 'source-node-id')?.rawValue).toBe(42);
    expect(fieldById(result.frame.fields, 'anonymous')?.physicalValue).toBe('Regular');
    expect(fieldById(result.frame.fields, 'transfer-kind')?.physicalValue).toBe('Message');
    expect(fieldById(result.frame.fields, 'tail-toggle')?.physicalValue).toBe('Set');

    // CAN ID alt alanları KAPSAYAN bayt aralığını taşır (offset 0, length 4);
    // bit ayrıntısı alan ADINDADIR (types.ts kilitli sözleşme).
    const subject = fieldById(result.frame.fields, 'subject-id');
    expect(subject?.offset).toBe(0);
    expect(subject?.length).toBe(4);
    expect(subject?.name).toContain('bit 20:8');

    const transferId = fieldById(result.frame.fields, 'tail-transfer-id');
    expect(transferId?.offset).toBe(15); // 8 (header) + 8 (DLC) - 1
    expect(transferId?.length).toBe(1);
    expect(transferId?.unit).toBeUndefined();

    // Tek çerçeveli transferde transfer CRC HİÇ YOKTUR.
    expect(fieldById(result.frame.fields, 'transfer-crc')).toBeUndefined();
    expect(hasWarning(result.frame.warnings, 'protocol.cyphal.warning.dsdlRequiredForPayload')).toBe(
      true,
    );
  });

  it('servis isteği: payload YOK, yalnız tail byte — Data alanı üretilmez', () => {
    const result = parseCyphal(exampleBytes('service-request'));
    if (!isParseSuccess(result)) throw new Error('daraltma');
    expect(result.frame.valid).toBe(true);
    expect(fieldById(result.frame.fields, 'service-id')?.rawValue).toBe(430);
    expect(fieldById(result.frame.fields, 'request-not-response')?.physicalValue).toBe('Request');
    expect(fieldById(result.frame.fields, 'destination-node-id')?.rawValue).toBe(42);
    expect(fieldById(result.frame.fields, 'source-node-id')?.rawValue).toBe(123);
    expect(fieldById(result.frame.fields, 'data')).toBeUndefined();
  });

  it('servis yanıtı ilk çerçevesi: multi-frame-first, veri alanı TAM dolu (uyarı yok)', () => {
    const result = parseCyphal(exampleBytes('service-response-first'));
    if (!isParseSuccess(result)) throw new Error('daraltma');
    expect(fieldById(result.frame.fields, 'tail-sot')?.physicalValue).toBe('Set');
    expect(fieldById(result.frame.fields, 'tail-eot')?.physicalValue).toBe('Not set');
    expect(fieldById(result.frame.fields, 'tail-toggle')?.physicalValue).toBe('Set');
    expect(
      hasWarning(result.frame.warnings, 'protocol.cyphal.warning.nonLastFrameNotFullMtu'),
    ).toBe(false);
    // Transfer CRC SON çerçevededir (DroneCAN'in TERSİ) — ilkinde YOK.
    expect(fieldById(result.frame.fields, 'transfer-crc')).toBeUndefined();
  });

  it('servis yanıtı son çerçevesi: CRC iki çerçeveye BÖLÜNMÜŞ, kısmi alan + iki uyarı', () => {
    const result = parseCyphal(exampleBytes('service-response-last'));
    if (!isParseSuccess(result)) throw new Error('daraltma');
    const crc = fieldById(result.frame.fields, 'transfer-crc');
    expect(crc?.offset).toBe(8);
    expect(crc?.length).toBe(1);
    expect(crc?.rawValue).toBe(0xe7); // spec: 0x9AE7'nin DÜŞÜK baytı
    expect(
      hasWarning(result.frame.warnings, 'protocol.cyphal.warning.transferCrcNeedsFullTransfer'),
    ).toBe(true);
    expect(
      hasWarning(result.frame.warnings, 'protocol.cyphal.warning.transferCrcSplitAcrossFrames'),
    ).toBe(true);
  });

  it('son çerçevede tam CRC varsa big-endian okunur ve Data ondan ÖNCE gelir', () => {
    // Spec: "The resulting CRC value is appended … in the big-endian byte
    // order (most significant byte first)".
    const bytes = buildCanClassicFrame(
      0x126bbdaa,
      [0x41, 0x42, 0x9a, 0xe7, buildCyphalTailByte(false, true, true, 1)],
      { extended: true },
    );
    const result = parseCyphal(bytes);
    if (!isParseSuccess(result)) throw new Error('daraltma');
    const crc = fieldById(result.frame.fields, 'transfer-crc');
    expect(crc?.length).toBe(2);
    expect(crc?.offset).toBe(10);
    expect(crc?.rawValue).toBe(0x9ae7);
    const data = fieldById(result.frame.fields, 'data');
    expect(data?.offset).toBe(8);
    expect(data?.length).toBe(2);
    expect(
      hasWarning(result.frame.warnings, 'protocol.cyphal.warning.transferCrcSplitAcrossFrames'),
    ).toBe(false);
  });

  it('anonim mesaj: bit 24 set, kaynak alanı pseudo-ID taşır', () => {
    const result = parseCyphal(exampleBytes('anonymous-message'));
    if (!isParseSuccess(result)) throw new Error('daraltma');
    expect(fieldById(result.frame.fields, 'anonymous')?.physicalValue).toBe('Anonymous (pseudo-ID)');
    expect(fieldById(result.frame.fields, 'subject-id')?.rawValue).toBe(4919);
    expect(fieldById(result.frame.fields, 'source-node-id')?.rawValue).toBe(117);
    expect(result.frame.valid).toBe(true);
  });
});

describe('parseCyphal — spec kurallarının uyarı/hata yolları', () => {
  it('ilk çerçevede Toggle=0 → DroneCAN imzası: alan geçersiz + yönlendirme uyarısı', () => {
    const result = parseCyphal(exampleBytes('dronecan-toggle-rejected'));
    if (!isParseSuccess(result)) throw new Error('daraltma');
    const toggle = fieldById(result.frame.fields, 'tail-toggle');
    expect(toggle?.valid).toBe(false);
    expect(toggle?.warnings).toContain('protocol.cyphal.warning.toggleLooksLikeDroneCan');
    expect(
      hasWarning(result.frame.warnings, 'protocol.cyphal.warning.toggleLooksLikeDroneCan'),
    ).toBe(true);
    // Uyarı, HATA değil: çerçeve yine tam çözülür.
    expect(result.frame.valid).toBe(true);
  });

  it('ayrılmış bit 23 set → spec "discard" kuralı hata olarak basılır', () => {
    const id = (0x107d552a | (0x1 << 23)) >>> 0;
    const result = parseCyphal(buildCanClassicFrame(id, [0x00, 0xe0], { extended: true }));
    if (!isParseSuccess(result)) throw new Error('daraltma');
    expect(result.frame.valid).toBe(false);
    expect(result.frame.errors[0]?.message).toBe('protocol.cyphal.error.reservedBit23NotZero');
  });

  it('kendine adreslenen servis transferi uyarı basar', () => {
    // service-ID 430, hedef = kaynak = 42.
    const id = ((0x1 << 25) | (430 << 14) | (42 << 7) | 42) >>> 0;
    const result = parseCyphal(buildCanClassicFrame(id, [0xe0], { extended: true }));
    if (!isParseSuccess(result)) throw new Error('daraltma');
    expect(hasWarning(result.frame.warnings, 'protocol.cyphal.warning.selfAddressedService')).toBe(
      true,
    );
  });

  it('çok çerçeveli anonim mesaj uyarı basar (spec: yalnız tek çerçeve)', () => {
    const bytes = buildCanClassicFrame(
      0x11133775,
      [0, 1, 2, 3, 4, 5, 6, buildCyphalTailByte(true, false, true, 0)],
      { extended: true },
    );
    const result = parseCyphal(bytes);
    if (!isParseSuccess(result)) throw new Error('daraltma');
    expect(
      hasWarning(result.frame.warnings, 'protocol.cyphal.warning.anonymousMustBeSingleFrame'),
    ).toBe(true);
  });

  it('son OLMAYAN çerçeve veri alanını doldurmuyorsa uyarı basılır', () => {
    const bytes = buildCanClassicFrame(
      0x107d552a,
      [0x01, 0x02, buildCyphalTailByte(true, false, true, 3)],
      { extended: true },
    );
    const result = parseCyphal(bytes);
    if (!isParseSuccess(result)) throw new Error('daraltma');
    expect(
      hasWarning(result.frame.warnings, 'protocol.cyphal.warning.nonLastFrameNotFullMtu'),
    ).toBe(true);
  });

  it('veri alanı boş → tail byte yok, spec gereği geçersiz', () => {
    const result = parseCyphal(buildCanClassicFrame(0x107d552a, [], { extended: true }));
    if (!isParseSuccess(result)) throw new Error('daraltma');
    expect(result.frame.errors[0]?.message).toBe('protocol.cyphal.error.tailByteMissing');
  });

  it('11-bit çerçeve: hata basar ama CAN ID/DLC yine gösterilir', () => {
    const result = parseCyphal(exampleBytes('not-extended-rejected'));
    if (!isParseSuccess(result)) throw new Error('daraltma');
    expect(result.frame.valid).toBe(false);
    expect(result.frame.errors[0]?.code).toBe('value-out-of-range');
    expect(fieldById(result.frame.fields, 'can-id')?.physicalValue).toBe('Base / 11-bit');
    expect(fieldById(result.frame.fields, 'priority')).toBeUndefined();
    expect(fieldById(result.frame.fields, 'tail-sot')).toBeUndefined();
  });
});

describe('CAN FD — KAPSAM DIŞI ve AÇIKÇA reddedilir (xcpOnCan.ts emsali)', () => {
  it('72 baytlık CAN FD konteyneri `unsupported-encoding` ile durur', () => {
    const bytes = exampleBytes('can-fd-rejected');
    expect(bytes.length).toBe(CAN_FD_FRAME_LENGTH);
    const result = parseCyphal(bytes);
    expect(result.success).toBe(false);
    if (result.success) throw new Error('daraltma');
    expect(result.error.code).toBe('unsupported-encoding');
    expect(result.error.message).toBe('protocol.cyphal.error.canFdNotSupported');
    expect(result.recoverable).toBe(false);
  });

  it('`canParse` hiçbir CAN FD çerçevesini aday saymaz', () => {
    const fd = buildCanFdFrame(0x107d552a, Array.from({ length: 12 }, () => 0xe0), {
      extended: true,
    });
    expect(cyphalParser.canParse(fd)).toBe(false);
    expect(cyphalParser.canParse(exampleBytes('can-fd-rejected'))).toBe(false);
  });
});

describe('decodeOptions — specVersion gerçekten yorumu değiştirir', () => {
  it('varsayılan v1.0: bit 7 set olan mesaj çerçevesi opt-in hatası basar', () => {
    const result = parseCyphal(exampleBytes('v11-experimental-message'));
    if (!isParseSuccess(result)) throw new Error('daraltma');
    expect(result.frame.valid).toBe(false);
    expect(result.frame.errors.some((e) => e.message === 'protocol.cyphal.error.v11RequiresOptIn')).toBe(
      true,
    );
    expect(
      hasWarning(result.frame.warnings, 'protocol.cyphal.warning.experimentalSpecVersion'),
    ).toBe(false);
  });

  it('v1.1 seçilince 16-bit subject-ID çözülür ve deneysel uyarı KOŞULSUZ basılır', () => {
    const result = cyphalParser.parse(exampleBytes('v11-experimental-message'), {
      options: { specVersion: CYPHAL_SPEC_V1_1 },
    });
    if (!isParseSuccess(result)) throw new Error('daraltma');
    expect(result.frame.valid).toBe(true);
    expect(fieldById(result.frame.fields, 'subject-id')?.rawValue).toBe(9000);
    expect(fieldById(result.frame.fields, 'subject-id')?.name).toContain('bit 23:8');
    expect(fieldById(result.frame.fields, 'version-discriminator')?.physicalValue).toBe(
      'v1.1 · 16-bit Subject-ID',
    );
    expect(fieldById(result.frame.fields, 'anonymous')).toBeUndefined();
    expect(
      hasWarning(result.frame.warnings, 'protocol.cyphal.warning.experimentalSpecVersion'),
    ).toBe(true);
  });

  it('v1.1 uyarısı çerçeve v1.0 biçiminde olsa BİLE basılır (koşulsuz)', () => {
    const result = cyphalParser.parse(exampleBytes('heartbeat-message'), {
      options: { specVersion: CYPHAL_SPEC_V1_1 },
    });
    if (!isParseSuccess(result)) throw new Error('daraltma');
    expect(
      hasWarning(result.frame.warnings, 'protocol.cyphal.warning.experimentalSpecVersion'),
    ).toBe(true);
    expect(fieldById(result.frame.fields, 'subject-id')?.rawValue).toBe(7509);
  });

  it('plugin iki decodeOption bildirir; transport TEK şıkla kapsam sınırını gösterir', () => {
    const options = cyphalPlugin.decodeOptions ?? [];
    expect(options.map((option) => option.id)).toEqual(['transport', 'specVersion']);
    expect(options[0]?.choices).toHaveLength(1);
    expect(options[0]?.defaultValue).toBe('can');
    expect(options[1]?.defaultValue).toBe(CYPHAL_SPEC_V1_0);
  });
});

describe('cyphalParser.canParse — kendi örnekleri beklendiği gibi sınıflanır', () => {
  it('aday olmayanlar BİLEREK elenir: middle rolü, v1.1, Toggle=0, FD, 11-bit', () => {
    const expectedFalse = new Set([
      'service-response-middle',
      'v11-experimental-message',
      'dronecan-toggle-rejected',
      'can-fd-rejected',
      'not-extended-rejected',
    ]);
    for (const example of cyphalPlugin.exampleFrames) {
      expect(cyphalParser.canParse(example.bytes), `cyphal/${example.id}`).toBe(
        !expectedFalse.has(example.id),
      );
    }
  });

  it('son çerçeve en az 2 bayt (CRC baytı + tail) taşımalı', () => {
    const oneByte = buildCanClassicFrame(
      0x107d552a,
      [buildCyphalTailByte(false, true, true, 1)],
      { extended: true },
    );
    expect(cyphalParser.canParse(oneByte)).toBe(false);
  });

  it('son OLMAYAN çerçeve DLC 8 istemek zorunda', () => {
    const shortFirst = buildCanClassicFrame(
      0x107d552a,
      [0x01, buildCyphalTailByte(true, false, true, 1)],
      { extended: true },
    );
    expect(cyphalParser.canParse(shortFirst)).toBe(false);
  });
});

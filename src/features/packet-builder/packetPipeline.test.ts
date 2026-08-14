/**
 * `packetPipeline` testleri — spec §10 Packet Builder motorunun sözleşmesi.
 *
 * Bu dosyanın taşıdığı en kritik iki değişmez:
 *
 * 1. **Checksum HAM çerçeve üzerinde hesaplanır**, post-processing'den ÖNCE.
 *    Aşağıda byte stuffing uygulanmış çıktının checksum baytı, istiflenmiş
 *    baytların checksum'uyla KASTEN karşılaştırılıyor: ikisi farklı çıkmalı,
 *    yoksa alıcı destuff ettikten sonra doğrulayamaz.
 * 2. **`describeBuilderFields`in `path` biçimi `encodeWithSchema`nın
 *    `EncodeValues` anahtar biçimiyle aynıdır.** Testler formun yazacağı
 *    anahtarları doğrudan kodlayıcıya besleyerek bunu uçtan uca kanıtlar;
 *    iki biçim ayrışırsa kullanıcının girdiği değer sessizce yok sayılırdı.
 */

import { describe, expect, it } from 'vitest';

import { computeChecksum } from '../../protocol-core/checksums/algorithmCatalogue';
import type { EncodeValues } from '../../protocol-core/encoding/schemaEncoder';
import { stuffBits } from '../../protocol-core/framing/bitStuffing';
import { decodeCobs } from '../../protocol-core/framing/cobs';
import type { ProtocolFieldSchema, ProtocolSchema } from '../../protocol-core/schemas/protocolSchema';
import { SPEC_BUILDER_FRAME, SPEC_SENSOR_PROTOCOL } from '../../protocol-core/schemas/specFixture';
import {
  buildPacket,
  describeBuilderFields,
  nextSequenceValues,
  randomizeValues,
  stepFieldValue,
} from './packetPipeline';
import type { BuilderFieldDescriptor, PacketBuildResult, PacketIssue } from './packetPipeline';

// --- Yardımcılar ----------------------------------------------------------

function schemaWith(
  fields: readonly ProtocolFieldSchema[],
  overrides: Partial<ProtocolSchema> = {},
): ProtocolSchema {
  return {
    name: 'test',
    version: '1',
    framing: { type: 'none', maximumFrameLength: 256 },
    fields,
    ...overrides,
  };
}

/** `noUncheckedIndexedAccess` altında dizinin boş olmadığını tek yerde kanıtlar. */
function firstIssue(result: PacketBuildResult): PacketIssue {
  const issue = result.issues[0];
  if (issue === undefined) {
    throw new Error('En az bir sorun bekleniyordu');
  }
  return issue;
}

function framedOf(result: PacketBuildResult): number[] {
  if (result.framedBytes === null) {
    throw new Error(`Paket üretilemedi: ${result.issues.map((issue) => issue.messageKey).join('; ')}`);
  }
  return Array.from(result.framedBytes);
}

function rawOf(result: PacketBuildResult): number[] {
  if (result.rawFrame === null) {
    throw new Error(`Ham çerçeve üretilemedi: ${result.issues.map((issue) => issue.messageKey).join('; ')}`);
  }
  return Array.from(result.rawFrame);
}

function descriptorAt(
  descriptors: readonly BuilderFieldDescriptor[],
  path: string,
): BuilderFieldDescriptor {
  const found = descriptors.find((descriptor) => descriptor.path === path);
  if (found === undefined) {
    throw new Error(`Alan bulunamadı: ${path}`);
  }
  return found;
}

/** Deterministik üreteç: dizi tükenince 0 döner, testler asla gerçek rastgeleye düşmez. */
function scriptedRandom(sequence: readonly number[]): () => number {
  let index = 0;
  return () => {
    const value = sequence[index];
    index += 1;
    return value ?? 0;
  };
}

/** Spec §10'un "Set Output, kanal 2, %75 duty" örneğinin kullanıcı girdisi. */
const SET_OUTPUT_VALUES: EncodeValues = {
  address: 5,
  command: 0x20,
  payload: Uint8Array.from([0x02, 0x4b]),
};

// --- buildPacket: spec fixture --------------------------------------------

describe('buildPacket — spec §10 çerçevesi', () => {
  it('Set Output paketini birebir üretir (checksum 0x6E; §10 metnindeki 0x6C YANLIŞ)', () => {
    const result = buildPacket(SPEC_SENSOR_PROTOCOL, SET_OUTPUT_VALUES, { postProcessing: 'none' });

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(framedOf(result)).toEqual(Array.from(SPEC_BUILDER_FRAME));
    // XOR8(05 20 02 02 4B) = 0x6E. Spec §10'un dizgi hatası (0x6C) teste girmez.
    expect(framedOf(result)[6]).toBe(0x6e);
  });

  it('uzunluk ve checksum alanlarını kullanıcı girdisine RAĞMEN kendisi hesaplar', () => {
    const result = buildPacket(
      SPEC_SENSOR_PROTOCOL,
      { ...SET_OUTPUT_VALUES, payloadLength: 99, checksum: 0x11 },
      { postProcessing: 'none' },
    );

    expect(framedOf(result)).toEqual(Array.from(SPEC_BUILDER_FRAME));
  });

  it('postProcessing yokken framedBytes rawFrame ile AYNI nesnedir', () => {
    const result = buildPacket(SPEC_SENSOR_PROTOCOL, SET_OUTPUT_VALUES, { postProcessing: 'none' });

    expect(result.framedBytes).toBe(result.rawFrame);
  });
});

// --- buildPacket: post-processing -----------------------------------------

describe('buildPacket — post-processing kipleri', () => {
  it('byteStuffing yalnız GÖVDEYİ kaçışlar, delimiter baytlarına dokunmaz', () => {
    const result = buildPacket(
      SPEC_SENSOR_PROTOCOL,
      { address: 5, command: 0x20, payload: Uint8Array.from([0xaa, 0x11]) },
      { postProcessing: 'byteStuffing' },
    );

    // Ham: AA | 05 20 02 AA 11 9C | 55  — gövdedeki 0xAA kaçışlanacak.
    expect(rawOf(result)).toEqual([0xaa, 0x05, 0x20, 0x02, 0xaa, 0x11, 0x9c, 0x55]);
    // 0xAA → 0x7D, 0xAA^0x20 = 0x8A. Baştaki 0xAA ve sondaki 0x55 delimiter'dır, kaçışlanmaz.
    expect(framedOf(result)).toEqual([0xaa, 0x05, 0x20, 0x02, 0x7d, 0x8a, 0x11, 0x9c, 0x55]);
  });

  it('checksum İSTİFLEMEDEN ÖNCE ham çerçeve üzerinde hesaplanır', () => {
    const result = buildPacket(
      SPEC_SENSOR_PROTOCOL,
      { address: 5, command: 0x20, payload: Uint8Array.from([0xaa, 0x11]) },
      { postProcessing: 'byteStuffing' },
    );

    const raw = result.rawFrame;
    const framed = result.framedBytes;
    if (raw === null || framed === null) {
      throw new Error('Paket üretilemedi');
    }

    const storedChecksum = framed[framed.length - 2];
    // Ham çerçevede kapsam address..payload = indeks 1..5.
    expect(computeChecksum(raw.subarray(1, 6), 'xor8')).toBe(BigInt(storedChecksum ?? -1));
    // İstiflenmiş gövde üzerinden hesaplansaydı 0xC1 çıkardı — alıcı destuff
    // ettikten sonra doğrulayamazdı. İki değerin FARKLI olması sıranın kanıtı.
    expect(computeChecksum(framed.subarray(1, framed.length - 2), 'xor8')).toBe(0xc1n);
    expect(storedChecksum).toBe(0x9c);
  });

  it('byteStuffing kaçış baytını ve kaçışlanacak kümeyi seçenekten alır', () => {
    const result = buildPacket(SPEC_SENSOR_PROTOCOL, SET_OUTPUT_VALUES, {
      postProcessing: 'byteStuffing',
      escapeByte: 0x1b,
      escapedBytes: [0x4b],
    });

    // 0x4B → 0x1B, 0x4B^0x20 = 0x6B; varsayılan 0xAA/0x55 kümesi devre dışı.
    expect(framedOf(result)).toEqual([0xaa, 0x05, 0x20, 0x02, 0x02, 0x1b, 0x6b, 0x6e, 0x55]);
  });

  it('bitStuffing bayt sınırında bitmeyen akışta doldurma uyarısı üretir', () => {
    const schema = schemaWith([{ id: 'flags', name: 'Flags', type: 'uint8', length: 1 }]);
    const result = buildPacket(schema, { flags: 0xff }, { postProcessing: 'bitStuffing' });

    // 0xFF: beş 1'den sonra bir 0 eklenir → 9 bit → 0xFB 0x80, 7 bit dolgu.
    expect(result.ok).toBe(true);
    expect(framedOf(result)).toEqual([0xfb, 0x80]);
    expect(firstIssue(result)).toEqual({
      fieldId: null,
      messageKey: 'builder.warning.bitPadding',
      params: { bits: '7' },
    });
  });

  it('bitStuffing bayt sınırında biten akışta uyarı üretmez', () => {
    const schema = schemaWith([{ id: 'flags', name: 'Flags', type: 'uint8', length: 1 }]);
    const result = buildPacket(schema, { flags: 0x00 }, { postProcessing: 'bitStuffing' });

    expect(framedOf(result)).toEqual([0x00]);
    expect(result.issues).toEqual([]);
  });

  it('bitStuffing delimiter baytlarını istiflemez, yalnız gövdeyi istifler', () => {
    const result = buildPacket(
      SPEC_SENSOR_PROTOCOL,
      { address: 5, command: 0x20, payload: Uint8Array.from([0xff]) },
      { postProcessing: 'bitStuffing' },
    );

    const raw = result.rawFrame;
    if (raw === null) {
      throw new Error('Ham çerçeve üretilemedi');
    }
    const framed = framedOf(result);

    expect(rawOf(result)).toEqual([0xaa, 0x05, 0x20, 0x01, 0xff, 0xdb, 0x55]);
    expect(framed[0]).toBe(0xaa);
    expect(framed[framed.length - 1]).toBe(0x55);
    // Gövde (delimiter'lar hariç) tam olarak stuffBits çıktısıdır.
    expect(framed.slice(1, framed.length - 1)).toEqual(
      Array.from(stuffBits(raw.subarray(1, raw.length - 1)).bytes),
    );
    expect(firstIssue(result).params).toEqual({ bits: '6' });
  });

  it('cobs TÜM çerçeveyi yük sayar ve kendi 0x00 sonlandırıcısını ekler', () => {
    const result = buildPacket(SPEC_SENSOR_PROTOCOL, SET_OUTPUT_VALUES, { postProcessing: 'cobs' });

    // Çerçevede sıfır bayt yok → tek blok: kod 9, ardından 8 bayt, sonra 0x00.
    expect(framedOf(result)).toEqual([0x09, 0xaa, 0x05, 0x20, 0x02, 0x02, 0x4b, 0x6e, 0x55, 0x00]);
  });

  it('cobs sıfır bayt taşıyan çerçeveyi blok sınırına çevirir ve geri çözülebilir', () => {
    const result = buildPacket(
      SPEC_SENSOR_PROTOCOL,
      { address: 5, command: 0x20, payload: Uint8Array.from([0x00, 0x01]) },
      { postProcessing: 'cobs' },
    );

    expect(rawOf(result)).toEqual([0xaa, 0x05, 0x20, 0x02, 0x00, 0x01, 0x26, 0x55]);
    expect(framedOf(result)).toEqual([0x05, 0xaa, 0x05, 0x20, 0x02, 0x04, 0x01, 0x26, 0x55, 0x00]);

    const framed = result.framedBytes;
    if (framed === null) {
      throw new Error('Paket üretilemedi');
    }
    const decoded = decodeCobs(framed.subarray(0, framed.length - 1));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(Array.from(decoded.data)).toEqual(rawOf(result));
    }
  });

  it('slip çerçevenin tamamını kaçışlar ve END (0xC0) ekler', () => {
    const plain = buildPacket(SPEC_SENSOR_PROTOCOL, SET_OUTPUT_VALUES, { postProcessing: 'slip' });
    expect(framedOf(plain)).toEqual([0xaa, 0x05, 0x20, 0x02, 0x02, 0x4b, 0x6e, 0x55, 0xc0]);

    const withEnd = buildPacket(
      SPEC_SENSOR_PROTOCOL,
      { address: 5, command: 0x20, payload: Uint8Array.from([0xc0]) },
      { postProcessing: 'slip' },
    );
    // 0xC0 → 0xDB 0xDC (RFC 1055); şemanın 0xAA/0x55 delimiter'ları SLIP için özel değil.
    expect(rawOf(withEnd)).toEqual([0xaa, 0x05, 0x20, 0x01, 0xc0, 0xe4, 0x55]);
    expect(framedOf(withEnd)).toEqual([0xaa, 0x05, 0x20, 0x01, 0xdb, 0xdc, 0xe4, 0x55, 0xc0]);
  });

  it('post-processing rawFrame nesnesini değiştirmez', () => {
    const result = buildPacket(SPEC_SENSOR_PROTOCOL, SET_OUTPUT_VALUES, { postProcessing: 'cobs' });

    expect(rawOf(result)).toEqual(Array.from(SPEC_BUILDER_FRAME));
  });
});

// --- buildPacket: sorunlar -------------------------------------------------

describe('buildPacket — sorun yönetimi', () => {
  it('kodlayıcının FIRLATTIĞI durumu sorun listesine çevirir, çökmez', () => {
    const schema = schemaWith([{ id: 'amount', name: 'Amount', type: 'bcd', length: 2 }]);

    // BCD kodlayıcı negatif değerde Error fırlatır; form her tuş vuruşunda
    // buildPacket çağırdığı için istisnanın ekrana kaçmaması şart.
    expect(() => buildPacket(schema, { amount: -5 }, { postProcessing: 'none' })).not.toThrow();

    const result = buildPacket(schema, { amount: -5 }, { postProcessing: 'none' });
    expect(result.ok).toBe(false);
    expect(result.rawFrame).toBeNull();
    expect(result.framedBytes).toBeNull();
    expect(result.issues).toHaveLength(1);
    expect(firstIssue(result).messageKey).toBe('builder.error.encodeFailed');
    expect(firstIssue(result).fieldId).toBeNull();
    expect(firstIssue(result).params?.detail).toContain('BCD');
  });

  it('length-mismatch ENGELLEYİCİ değildir: ok true iken bile sorun listesi dolu olabilir', () => {
    const schema = schemaWith([{ id: 'tag', name: 'Tag', type: 'ascii', length: 2 }]);
    const result = buildPacket(schema, { tag: 'ABCD' }, { postProcessing: 'none' });

    expect(result.ok).toBe(true);
    expect(framedOf(result)).toEqual([0x41, 0x42]);
    expect(result.issues).toHaveLength(1);
    expect(firstIssue(result).messageKey).toBe('builder.issue.lengthMismatch');
    expect(firstIssue(result).fieldId).toBe('tag');
  });

  it('rawBytes uzunluk uyuşmazlığında da paketi ÜRETİR, yalnız uyarır', () => {
    const schema = schemaWith([{ id: 'blob', name: 'Blob', type: 'rawBytes', length: 4 }]);
    const result = buildPacket(
      schema,
      { blob: Uint8Array.from([0x01, 0x02]) },
      { postProcessing: 'none' },
    );

    expect(result.ok).toBe(true);
    expect(framedOf(result)).toEqual([0x01, 0x02]);
    expect(firstIssue(result).messageKey).toBe('builder.issue.lengthMismatch');
  });

  it('aralık dışı değer engelleyicidir: ok false, çerçeve yok', () => {
    const schema = schemaWith([{ id: 'level', name: 'Level', type: 'uint8', length: 1 }]);
    const result = buildPacket(schema, { level: 300 }, { postProcessing: 'none' });

    expect(result.ok).toBe(false);
    expect(result.rawFrame).toBeNull();
    expect(result.framedBytes).toBeNull();
    expect(firstIssue(result).messageKey).toBe('builder.issue.valueOutOfRange');
    expect(firstIssue(result).params?.detail).toBe('Value exceeds uint8 range');
  });

  it('çerçeve geneli sorunlarda fieldId null olur (kodlayıcının boş kimliği çevrilir)', () => {
    const schema = schemaWith(
      [
        { id: 'a', name: 'A', type: 'uint8', length: 1 },
        { id: 'b', name: 'B', type: 'uint8', length: 1 },
        { id: 'c', name: 'C', type: 'uint8', length: 1 },
      ],
      { framing: { type: 'none', maximumFrameLength: 2 } },
    );
    const result = buildPacket(schema, { a: 1, b: 2, c: 3 }, { postProcessing: 'none' });

    expect(result.ok).toBe(false);
    expect(firstIssue(result)).toEqual({
      fieldId: null,
      messageKey: 'builder.issue.exceedsMaximumFrameLength',
      params: { detail: 'Üretilen paket 3 bayt; azami 2' },
    });
  });
});

// --- describeBuilderFields -------------------------------------------------

const NESTED_SCHEMA: ProtocolSchema = schemaWith([
  {
    id: 'header',
    name: 'Header',
    type: 'structure',
    fields: [{ id: 'deviceAddress', name: 'Device Address', type: 'uint8', length: 1 }],
  },
  {
    id: 'items',
    name: 'Items',
    type: 'array',
    repeatCount: 2,
    fields: [{ id: 'v', name: 'Value', type: 'uint8', length: 1 }],
  },
]);

describe('describeBuilderFields', () => {
  it('yalnız yaprak alanları döner; kapsayıcıların kendi girdisi yoktur', () => {
    const descriptors = describeBuilderFields(NESTED_SCHEMA);

    expect(descriptors.map((descriptor) => descriptor.path)).toEqual([
      'header.deviceAddress',
      'items[0].v',
      'items[1].v',
    ]);
    expect(descriptors.map((descriptor) => descriptor.id)).toEqual(['deviceAddress', 'v', 'v']);
  });

  it('path biçimi encodeWithSchema’nın EncodeValues anahtarıyla AYNIdır', () => {
    const descriptors = describeBuilderFields(NESTED_SCHEMA);
    const values: Record<string, number> = {};
    descriptors.forEach((descriptor, index) => {
      values[descriptor.path] = index + 1;
    });

    // Anahtar biçimi ayrışsaydı değerler kodlayıcıya ulaşmaz, çerçeve sıfırlarla dolardı.
    const result = buildPacket(NESTED_SCHEMA, values, { postProcessing: 'none' });
    expect(framedOf(result)).toEqual([1, 2, 3]);
  });

  it('tekrar sayısı başka alandan gelen dizide TEK öğelik iskelet gösterir', () => {
    const schema = schemaWith([
      { id: 'count', name: 'Count', type: 'uint8', length: 1 },
      {
        id: 'items',
        name: 'Items',
        type: 'array',
        repeatCount: { fromField: 'count' },
        fields: [{ id: 'v', name: 'Value', type: 'uint8', length: 1 }],
      },
    ]);

    expect(describeBuilderFields(schema).map((descriptor) => descriptor.path)).toEqual([
      'count',
      'items[0].v',
    ]);
  });

  it('checksum, length tipi ve lengthFrom hedefi alanları derived işaretlenir', () => {
    const descriptors = describeBuilderFields(SPEC_SENSOR_PROTOCOL);

    expect(descriptorAt(descriptors, 'address').derived).toBe(false);
    expect(descriptorAt(descriptors, 'command').derived).toBe(false);
    expect(descriptorAt(descriptors, 'payload').derived).toBe(false);
    // payloadLength tipi uint8'dir ama payload.lengthFrom onu hedef gösterir.
    expect(descriptorAt(descriptors, 'payloadLength').derived).toBe(true);
    expect(descriptorAt(descriptors, 'checksum').derived).toBe(true);
  });

  it('crc ve length tipleri de derived sayılır', () => {
    const schema = schemaWith([
      { id: 'len', name: 'Length', type: 'length', length: 1 },
      { id: 'value', name: 'Value', type: 'uint8', length: 1 },
      {
        id: 'crc',
        name: 'CRC',
        type: 'crc',
        algorithm: 'CRC16_CCITT_FALSE',
        coverage: { startField: 'len', endField: 'value' },
      },
    ]);
    const descriptors = describeBuilderFields(schema);

    expect(descriptorAt(descriptors, 'len').derived).toBe(true);
    expect(descriptorAt(descriptors, 'crc').derived).toBe(true);
    expect(descriptorAt(descriptors, 'value').derived).toBe(false);
  });

  it('form için gereken sunum bilgisini taşır (enum tablosu, birim, sınır, ölçek)', () => {
    const schema = schemaWith([
      {
        id: 'temperature',
        name: 'Temperature',
        type: 'int16',
        unit: '°C',
        minimum: -40,
        maximum: 125,
        scale: 0.1,
        calibrationOffset: -273.15,
      },
    ]);
    const descriptor = descriptorAt(describeBuilderFields(schema), 'temperature');

    expect(descriptor).toEqual({
      id: 'temperature',
      path: 'temperature',
      name: 'Temperature',
      type: 'int16',
      derived: false,
      enumValues: null,
      unit: '°C',
      minimum: -40,
      maximum: 125,
      scale: 0.1,
      calibrationOffset: -273.15,
    });

    const command = descriptorAt(describeBuilderFields(SPEC_SENSOR_PROTOCOL), 'command');
    expect(command.enumValues?.get('16')).toBe('Sensor Data');
    expect(command.enumValues?.size).toBe(3);
    expect(command.unit).toBeNull();
  });
});

// --- nextSequenceValues ----------------------------------------------------

const SEQUENCE_SCHEMA: ProtocolSchema = schemaWith([
  { id: 'seq', name: 'Sequence', type: 'sequenceCounter', length: 1 },
  { id: 'wide', name: 'Wide Sequence', type: 'sequenceCounter', length: 2 },
  { id: 'payload', name: 'Payload', type: 'uint8', length: 1 },
]);

describe('nextSequenceValues', () => {
  it('sayacı alan GENİŞLİĞİNE göre sarmalar (uint8 → mod 256)', () => {
    expect(nextSequenceValues(SEQUENCE_SCHEMA, {}, 300)).toEqual({ seq: 44, wide: 300 });
    expect(nextSequenceValues(SEQUENCE_SCHEMA, {}, 256)).toEqual({ seq: 0, wide: 256 });
    expect(nextSequenceValues(SEQUENCE_SCHEMA, {}, 65_536)).toEqual({ seq: 0, wide: 0 });
  });

  it('negatif sayaç da sarmalanır, işaret sızmaz', () => {
    expect(nextSequenceValues(SEQUENCE_SCHEMA, {}, -1)).toEqual({ seq: 255, wide: 65_535 });
  });

  it('sequenceCounter olmayan şemada girdi nesnesini AYNEN döndürür', () => {
    const values: EncodeValues = { address: 5 };

    // Referans eşitliği sözleşmenin parçası: çağıran gereksiz yeniden çizimden kaçınır.
    expect(nextSequenceValues(SPEC_SENSOR_PROTOCOL, values, 7)).toBe(values);
  });

  it('sayaç sonlu değilse girdiyi olduğu gibi bırakır', () => {
    const values: EncodeValues = { seq: 3 };

    expect(nextSequenceValues(SEQUENCE_SCHEMA, values, Number.NaN)).toBe(values);
    expect(nextSequenceValues(SEQUENCE_SCHEMA, values, Number.POSITIVE_INFINITY)).toBe(values);
  });

  it('sayaç dışındaki değerleri korur ve YENİ nesne döndürür', () => {
    const values: EncodeValues = { payload: 9, seq: 1 };
    const next = nextSequenceValues(SEQUENCE_SCHEMA, values, 2);

    expect(next).not.toBe(values);
    expect(next).toEqual({ payload: 9, seq: 2, wide: 2 });
  });
});

// --- randomizeValues -------------------------------------------------------

describe('randomizeValues', () => {
  it('enjekte edilen üreteçle deterministiktir', () => {
    const first = randomizeValues(SPEC_SENSOR_PROTOCOL, {}, scriptedRandom([0.5]));
    const second = randomizeValues(SPEC_SENSOR_PROTOCOL, {}, scriptedRandom([0.5]));

    // uint8 aralığının tam ortası: 0 + floor(0.5 · 2^53) · 256 / 2^53 = 128.
    expect(first).toEqual({ address: 128 });
    expect(second).toEqual(first);
  });

  it('türetilmiş alanlara (checksum / uzunluk) dokunmaz', () => {
    const result = randomizeValues(SPEC_SENSOR_PROTOCOL, {}, scriptedRandom([0.5]));

    expect(Object.keys(result)).toEqual(['address']);
    expect(result).not.toHaveProperty('payloadLength');
    expect(result).not.toHaveProperty('checksum');
  });

  it('üretilen değer alanın minimum..maximum aralığında kalır', () => {
    const schema = schemaWith([
      { id: 'low', name: 'Low', type: 'uint8', length: 1, minimum: 10, maximum: 20 },
      { id: 'high', name: 'High', type: 'uint8', length: 1, minimum: 10, maximum: 20 },
      { id: 'middle', name: 'Middle', type: 'uint8', length: 1, minimum: 10, maximum: 20 },
    ]);
    const result = randomizeValues(schema, {}, scriptedRandom([0, 1, 0.5]));

    expect(result).toEqual({ low: 10, high: 20, middle: 15 });
  });

  it('ölçekli ve ondalıklı alanlarda FİZİKSEL değer aralığı kullanılır', () => {
    const schema = schemaWith([
      { id: 'duty', name: 'Duty', type: 'uint8', length: 1, scale: 0.5 },
      { id: 'ratio', name: 'Ratio', type: 'float32', minimum: 0, maximum: 1 },
    ]);
    const result = randomizeValues(schema, {}, scriptedRandom([0.5, 0.25]));

    // uint8 · 0.5 → 0..127.5 fiziksel aralık; ikilik aralık kullanılsaydı 128 çıkardı.
    expect(result).toEqual({ duty: 63.75, ratio: 0.25 });
  });

  it('sayısal olmayan alanlar (enum, boolean, rawBytes) atlanır ve girdi aynen döner', () => {
    const schema = schemaWith([
      { id: 'mode', name: 'Mode', type: 'enum', length: 1, enumValues: { '0': 'Off', '1': 'On' } },
      { id: 'flag', name: 'Flag', type: 'boolean' },
      { id: 'blob', name: 'Blob', type: 'rawBytes', length: 2 },
    ]);
    const values: EncodeValues = { mode: 1 };

    expect(randomizeValues(schema, values, scriptedRandom([0.5]))).toBe(values);
  });

  it('rastgelelenen değerler geçerli bir paket üretir', () => {
    const values = randomizeValues(
      SPEC_SENSOR_PROTOCOL,
      { command: 0x20, payload: Uint8Array.from([0x01]) },
      scriptedRandom([0.99]),
    );
    const result = buildPacket(SPEC_SENSOR_PROTOCOL, values, { postProcessing: 'none' });

    expect(result.ok).toBe(true);
    expect(rawOf(result)[1]).toBe(values['address']);
  });
});

// --- stepFieldValue --------------------------------------------------------

const STEP_SCHEMA: ProtocolSchema = schemaWith([
  { id: 'plain', name: 'Plain', type: 'uint8', length: 1 },
  { id: 'bounded', name: 'Bounded', type: 'uint8', length: 1, minimum: 10, maximum: 20 },
  { id: 'scaled', name: 'Scaled', type: 'uint16', length: 2, scale: 0.1 },
  { id: 'ticks', name: 'Ticks', type: 'uint64' },
  { id: 'digits', name: 'Digits', type: 'bcd', length: 2 },
  { id: 'bits', name: 'Bits', type: 'bitField', bitOffset: 0, bitLength: 3 },
]);

describe('stepFieldValue', () => {
  it('azami ve asgari değerde KIRPAR, sarmalamaz', () => {
    expect(stepFieldValue(STEP_SCHEMA, { plain: 255 }, 'plain', 5)).toEqual({ plain: 255 });
    expect(stepFieldValue(STEP_SCHEMA, { plain: 0 }, 'plain', -5)).toEqual({ plain: 0 });
  });

  it('şemada bildirilen minimum/maximum tipin ham sınırından ÖNCE gelir', () => {
    expect(stepFieldValue(STEP_SCHEMA, { bounded: 19 }, 'bounded', 5)).toEqual({ bounded: 20 });
    expect(stepFieldValue(STEP_SCHEMA, { bounded: 11 }, 'bounded', -5)).toEqual({ bounded: 10 });
  });

  it('değeri olmayan alanda 0’dan başlar ve aralığa kırpar', () => {
    expect(stepFieldValue(STEP_SCHEMA, {}, 'bounded', 1)).toEqual({ bounded: 11 });
    expect(stepFieldValue(STEP_SCHEMA, {}, 'plain', 3)).toEqual({ plain: 3 });
  });

  it('metin olarak tutulan değeri sayıya çevirir', () => {
    expect(stepFieldValue(STEP_SCHEMA, { plain: '7' }, 'plain', 1)).toEqual({ plain: 8 });
  });

  it('ölçekli alanda ondalık adım uygular', () => {
    expect(stepFieldValue(STEP_SCHEMA, { scaled: 1 }, 'scaled', 0.5)).toEqual({ scaled: 1.5 });
    // Fiziksel üst sınır 65535 · 0.1 = 6553.5.
    expect(stepFieldValue(STEP_SCHEMA, { scaled: 6553.4 }, 'scaled', 1)).toEqual({ scaled: 6553.5 });
  });

  it('2^53 üstünde BIGINT aritmetiği yapar, değeri yuvarlamaz', () => {
    const atLimit = stepFieldValue(STEP_SCHEMA, { ticks: 9_007_199_254_740_991n }, 'ticks', 1);
    expect(atLimit['ticks']).toBe(9_007_199_254_740_992n);
    expect(typeof atLimit['ticks']).toBe('bigint');

    const wide = stepFieldValue(STEP_SCHEMA, { ticks: 2n ** 60n }, 'ticks', 1);
    expect(wide['ticks']).toBe(1_152_921_504_606_846_977n);

    // Güvenli aralıkta kalan değer number olarak döner — form gereksiz yere BigInt görmez.
    const small = stepFieldValue(STEP_SCHEMA, { ticks: 5 }, 'ticks', 1);
    expect(small['ticks']).toBe(6);
    expect(typeof small['ticks']).toBe('number');
  });

  it('BCD alanında ONDALIK basamak sınırı geçerlidir (2 bayt → 9999)', () => {
    expect(stepFieldValue(STEP_SCHEMA, { digits: 9998 }, 'digits', 5)).toEqual({ digits: 9999 });
  });

  it('bit alanında sınır bitLength’ten gelir (3 bit → 7)', () => {
    expect(stepFieldValue(STEP_SCHEMA, { bits: 6 }, 'bits', 5)).toEqual({ bits: 7 });
  });

  it('bilinmeyen yol, türetilmiş alan ve sayısal olmayan alan girdiyi AYNEN döndürür', () => {
    const values: EncodeValues = { address: 5, payload: Uint8Array.from([0x01]) };

    expect(stepFieldValue(SPEC_SENSOR_PROTOCOL, values, 'yok', 1)).toBe(values);
    expect(stepFieldValue(SPEC_SENSOR_PROTOCOL, values, 'checksum', 1)).toBe(values);
    expect(stepFieldValue(SPEC_SENSOR_PROTOCOL, values, 'payloadLength', 1)).toBe(values);
    expect(stepFieldValue(SPEC_SENSOR_PROTOCOL, values, 'payload', 1)).toBe(values);
  });

  it('delta sonlu değilse girdiyi olduğu gibi bırakır', () => {
    const values: EncodeValues = { plain: 3 };

    expect(stepFieldValue(STEP_SCHEMA, values, 'plain', Number.NaN)).toBe(values);
    expect(stepFieldValue(STEP_SCHEMA, values, 'plain', Number.POSITIVE_INFINITY)).toBe(values);
  });

  it('iç içe ve dizi alanlarını path ile adresler', () => {
    const values: EncodeValues = { 'items[1].v': 4 };
    const stepped = stepFieldValue(NESTED_SCHEMA, values, 'items[1].v', 1);

    expect(stepped).toEqual({ 'items[1].v': 5 });
    expect(stepFieldValue(NESTED_SCHEMA, {}, 'header.deviceAddress', 2)).toEqual({
      'header.deviceAddress': 2,
    });
  });
});

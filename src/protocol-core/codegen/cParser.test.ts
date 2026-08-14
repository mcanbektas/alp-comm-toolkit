import { describe, expect, it } from 'vitest';

import type { ProtocolSchema } from '@/protocol-core/schemas/protocolSchema';
import { SPEC_SENSOR_PROTOCOL } from '@/protocol-core/schemas/specFixture';
import { generateCParser } from './cParser';

/**
 * Üretilen metnin DERLENEBİLİRLİĞİ burada sınanamaz (CI'da C derleyicisi yok),
 * bu yüzden testler yapısal: hata kodları, çerçeve denetimleri, alan adları,
 * CRC parametreleri. Metnin tamamını satır satır karşılaştırmak kırılgan olurdu
 * — yorum bir kelime değişince kırılan test, yanlış bir bekçidir.
 */

/** İç içe yapı + dizi + CRC: düz olmayan yolları tek şemada sınar. */
const NESTED_SCHEMA: ProtocolSchema = {
  name: 'Nested Telemetry',
  version: '1.0',
  defaultEndianness: 'little',
  framing: { type: 'lengthField', maximumFrameLength: 512 },
  fields: [
    {
      id: 'header',
      name: 'Header',
      type: 'structure',
      fields: [
        { id: 'deviceAddress', name: 'Device Address', type: 'uint8' },
        { id: 'itemCount', name: 'Item Count', type: 'uint8' },
      ],
    },
    {
      id: 'items',
      name: 'Items',
      type: 'array',
      repeatCount: { fromField: 'itemCount' },
      fields: [
        { id: 'value', name: 'Value', type: 'uint16', scale: 0.1, calibrationOffset: -40 },
        {
          id: 'flags',
          name: 'Flags',
          type: 'structure',
          fields: [{ id: 'alarm', name: 'Alarm', type: 'bitField', bitOffset: 3, bitLength: 2 }],
        },
      ],
    },
    {
      id: 'crc',
      name: 'CRC',
      type: 'crc',
      algorithm: 'CRC16_MODBUS',
      coverage: { startField: 'header', endField: 'items' },
    },
  ],
};

/** Zor tipler: işaret genişletme, IEEE-754, çözümlemesi ertelenen aileler. */
const WIDE_SCHEMA: ProtocolSchema = {
  name: 'Wide Types',
  version: '1.0',
  framing: { type: 'none', maximumFrameLength: 128 },
  fields: [
    { id: 'depth', name: 'Depth', type: 'int24' },
    { id: 'temperature', name: 'Temperature', type: 'float32', endianness: 'little' },
    { id: 'precise', name: 'Precise', type: 'float64' },
    { id: 'half', name: 'Half', type: 'float16' },
    { id: 'stamp', name: 'Stamp', type: 'dateTime' },
    { id: 'epoch', name: 'Epoch', type: 'unixTimestamp' },
    { id: 'serial', name: 'Serial', type: 'bcd', length: 4 },
    { id: 'label', name: 'Label', type: 'utf8', length: 6 },
    { id: 'tag', name: 'Tag', type: 'ascii', length: 3 },
    { id: 'ready', name: 'Ready', type: 'boolean' },
  ],
};

describe('generateCParser', () => {
  it('describes the artifact with a c-parser identity and a file name without a path', () => {
    const artifact = generateCParser(SPEC_SENSOR_PROTOCOL);
    expect(artifact.id).toBe('c-parser');
    expect(artifact.language).toBe('c');
    expect(artifact.fileName).toBe('alp_sensor_protocol_parser.c');
    expect(artifact.fileName).not.toContain('/');
    expect(artifact.code.endsWith('\n')).toBe(true);
  });

  it('includes the struct header and string.h', () => {
    const { code } = generateCParser(SPEC_SENSOR_PROTOCOL);
    expect(code).toContain('#include "alp_sensor_protocol.h"');
    expect(code).toContain('#include <string.h>');
  });

  it('emits the banner by default and drops it on request', () => {
    const withBanner = generateCParser(SPEC_SENSOR_PROTOCOL).code;
    expect(withBanner).toContain('Protokol: ALP Sensor Protocol');
    expect(withBanner.startsWith('/*')).toBe(true);

    const without = generateCParser(SPEC_SENSOR_PROTOCOL, { banner: false }).code;
    expect(without).not.toContain('elle düzenlemeyin');
    // Başlık düşse de "bu metin çalıştırılmaz" uyarısı kalmalı (spec §41).
    expect(without).toContain('ALP Comm Toolkit onu çalıştırmaz');
  });

  it('defines all five error codes with their fixed negative values', () => {
    const { code } = generateCParser(SPEC_SENSOR_PROTOCOL);
    expect(code).toContain('#define ALP_SENSOR_PROTOCOL_ERR_TOO_SHORT (-1)');
    expect(code).toContain('#define ALP_SENSOR_PROTOCOL_ERR_BAD_START (-2)');
    expect(code).toContain('#define ALP_SENSOR_PROTOCOL_ERR_BAD_END (-3)');
    expect(code).toContain('#define ALP_SENSOR_PROTOCOL_ERR_LENGTH_MISMATCH (-4)');
    expect(code).toContain('#define ALP_SENSOR_PROTOCOL_ERR_CHECKSUM (-5)');
  });

  it('emits the documented parse signature', () => {
    const { code } = generateCParser(SPEC_SENSOR_PROTOCOL);
    expect(code).toContain(
      'int alp_sensor_protocol_parse(const uint8_t *data, size_t length, AlpSensorProtocol *out)',
    );
    expect(code).toContain('return 0;');
  });

  it('checks the start and end signatures against the framing bytes', () => {
    const { code } = generateCParser(SPEC_SENSOR_PROTOCOL);
    expect(code).toContain('if (data[0] != 0xAAu) {');
    expect(code).toContain('return ALP_SENSOR_PROTOCOL_ERR_BAD_START;');
    // Bitiş imzası sondan sayılır: aradaki alanlar dinamik olabilir.
    expect(code).toContain('if (data[length - 1u] != 0x55u) {');
    expect(code).toContain('return ALP_SENSOR_PROTOCOL_ERR_BAD_END;');
  });

  it('rejects frames shorter than the static skeleton and longer than the maximum', () => {
    const { code } = generateCParser(SPEC_SENSOR_PROTOCOL);
    // Başlangıç (1) + address + command + payloadLength + checksum + bitiş (1).
    expect(code).toContain('if (length < 6u) {');
    expect(code).toContain('if (length > 256u) {');
    expect(code).toContain('return ALP_SENSOR_PROTOCOL_ERR_LENGTH_MISMATCH;');
  });

  it('writes every schema field into the output struct', () => {
    const { code } = generateCParser(SPEC_SENSOR_PROTOCOL);
    expect(code).toContain('out->device_address = ');
    expect(code).toContain('out->command = ');
    expect(code).toContain('out->payload_length = ');
    expect(code).toContain('out->payload = ');
    expect(code).toContain('out->checksum = ');
    // Alan kimlikleri yorumda da geçmeli: üretilen kod şemaya geri izlenebilsin.
    for (const field of SPEC_SENSOR_PROTOCOL.fields) {
      expect(code).toContain(`/* ${field.id} — ${field.name}`);
    }
  });

  it('lists enum values as a comment instead of inventing constants', () => {
    const { code } = generateCParser(SPEC_SENSOR_PROTOCOL);
    expect(code).toContain('16 = Sensor Data');
    expect(code).toContain('32 = Set Output');
    expect(code).toContain('48 = Status Request');
  });

  it('verifies a simple checksum over the covered byte range', () => {
    const { code } = generateCParser(SPEC_SENSOR_PROTOCOL);
    expect(code).toContain('static uint8_t alp_sensor_protocol_xor8(const uint8_t *data, size_t length)');
    expect(code).toContain('result = (uint8_t)(result ^ data[index]);');
    // Kapsamın ilk alanı mutlak konum taşıyor: sınır o konumdan başlar.
    expect(code).toContain('checksum_coverage_start = 1u;');
    expect(code).toContain('checksum_coverage_end = offset;');
    // Ters ya da taşan aralık size_t çıkarmasında tampon dışını okuturdu.
    expect(code).toContain(
      'if (checksum_coverage_end < checksum_coverage_start || checksum_coverage_end > length) {',
    );
    expect(code).toContain(
      'uint8_t expected = alp_sensor_protocol_xor8(&data[checksum_coverage_start], checksum_coverage_end - checksum_coverage_start);',
    );
    expect(code).toContain('if (expected != out->checksum) {');
    expect(code).toContain('return ALP_SENSOR_PROTOCOL_ERR_CHECKSUM;');
  });

  it('prints the CRC parameters straight from the reveng catalogue', () => {
    const { code } = generateCParser(NESTED_SCHEMA);
    // CRC16_MODBUS: poly=0x8005 init=0xFFFF refin=true refout=true xorout=0x0000.
    expect(code).toContain('poly=0x8005');
    expect(code).toContain('init=0xFFFF refin=true refout=true xorout=0x0000');
    expect(code).toContain('uint16_t crc = 0xFFFFu;');
    expect(code).toContain('crc = (uint16_t)((uint16_t)(crc << 1) ^ 0x8005u);');
    expect(code).toContain('return (uint16_t)(crc ^ 0x0000u);');
    // refin/refout için bit çevirici üretilmeli.
    expect(code).toContain('static uint8_t nested_telemetry_reflect8(uint8_t value)');
    expect(code).toContain('static uint16_t nested_telemetry_reflect16(uint16_t value)');
    expect(code).toContain('current = nested_telemetry_reflect8(current); /* refin */');
    expect(code).toContain('crc = nested_telemetry_reflect16(crc); /* refout */');
  });

  it('scales the CRC helper to the algorithm width', () => {
    const wide: ProtocolSchema = {
      name: 'Wide Crc',
      version: '1.0',
      framing: { type: 'none', maximumFrameLength: 64 },
      fields: [
        { id: 'a', name: 'A', type: 'uint8' },
        {
          id: 'k',
          name: 'K',
          type: 'crc',
          algorithm: 'CRC32',
          coverage: { startField: 'a', endField: 'a' },
        },
      ],
    };
    const { code } = generateCParser(wide);
    expect(code).toContain('static uint32_t wide_crc_crc32(const uint8_t *data, size_t length)');
    expect(code).toContain('uint32_t crc = 0xFFFFFFFFu;');
    expect(code).toContain('poly=0x04C11DB7');
    expect(code).toContain('return (uint32_t)(crc ^ 0xFFFFFFFFu);');
    expect(code).toContain('static uint32_t wide_crc_reflect32(uint32_t value)');
    // 32 bitlik CRC alanı 4 bayt okunur.
    expect(code).toContain('if (offset + 4u > length) {');
  });

  it('skips verification with a comment when the algorithm is missing', () => {
    const noAlgorithm: ProtocolSchema = {
      name: 'No Algorithm',
      version: '1.0',
      framing: { type: 'none', maximumFrameLength: 32 },
      fields: [
        { id: 'a', name: 'A', type: 'uint8' },
        { id: 'k', name: 'K', type: 'checksum', coverage: { startField: 'a', endField: 'a' } },
      ],
    };
    const { code } = generateCParser(noAlgorithm);
    // Sessiz atlama YASAK: neden doğrulanmadığı üretilen kaynakta yazmalı.
    expect(code).toContain('Algoritma tanımlı değil; doğrulama atlandı');
    expect(code).not.toContain('ERR_CHECKSUM;\n    }\n  }\n\n  return 0;');
  });

  it('emits a separate byte order path for little and big endian', () => {
    const bigEndian: ProtocolSchema = {
      name: 'Order',
      version: '1.0',
      framing: { type: 'none', maximumFrameLength: 16 },
      fields: [{ id: 'value', name: 'Value', type: 'uint16' }],
    };
    const littleEndian: ProtocolSchema = { ...bigEndian, defaultEndianness: 'little' };

    expect(generateCParser(bigEndian).code).toContain(
      'out->value = (uint16_t)(((uint16_t)data[offset] << 8) | (uint16_t)data[offset + 1u]);',
    );
    expect(generateCParser(littleEndian).code).toContain(
      'out->value = (uint16_t)((uint16_t)data[offset] | ((uint16_t)data[offset + 1u] << 8));',
    );
  });

  it('lets a field override the schema default byte order', () => {
    const { code } = generateCParser(WIDE_SCHEMA);
    // Şema varsayılanı big; `temperature` alanı little diyor.
    expect(code).toContain(
      'uint32_t raw = (uint32_t)((uint32_t)data[offset] | ((uint32_t)data[offset + 1u] << 8) | ((uint32_t)data[offset + 2u] << 16) | ((uint32_t)data[offset + 3u] << 24));',
    );
    // `precise` alanı varsayılanı (big) kullanır.
    expect(code).toContain('((uint64_t)data[offset] << 56)');
  });

  it('sign extends widths that are narrower than their C storage type', () => {
    const { code } = generateCParser(WIDE_SCHEMA);
    expect(code).toContain('/* İşaret genişletmesi: 24 bitlik değer 32 bite taşınıyor. */');
    expect(code).toContain('if ((raw & 0x800000u) != 0u) {');
    expect(code).toContain('raw |= 0xFF000000u;');
    expect(code).toContain('out->depth = (int32_t)raw;');
  });

  it('moves IEEE-754 bit patterns with memcpy instead of pointer punning', () => {
    const { code } = generateCParser(WIDE_SCHEMA);
    expect(code).toContain('float value;');
    expect(code).toContain('memcpy(&value, &raw, sizeof(value));');
    expect(code).toContain('out->temperature = value;');
    expect(code).toContain('double value;');
    expect(code).toContain('strict aliasing');
  });

  it('leaves hard types raw and says so instead of skipping them silently', () => {
    const { code } = generateCParser(WIDE_SCHEMA);
    expect(code).toContain('BCD paketli ondalık');
    expect(code).toContain('memcpy(out->serial, &data[offset], 4u);');
    expect(code).toContain('çok baytlı kod noktalarının çözümlenmesi çağırana bırakıldı');
    expect(code).toContain('takvim/dilim çözümlemesi çağırana bırakıldı');
    expect(code).toContain('Yarım kayan noktanın C99 karşılığı yok');
    expect(code).toContain('out->half = (uint16_t)');
    expect(code).toContain('NUL sonlandırma YOK');
    expect(code).toContain('out->ready = (data[offset] != 0u);');
  });

  it('points dynamic length fields at the frame buffer without copying', () => {
    const { code } = generateCParser(SPEC_SENSOR_PROTOCOL);
    expect(code).toContain('size_t payload_size = 0u;');
    expect(code).toContain('payload_size = (size_t)out->payload_length;');
    // Kendi uzunluk alanıyla çelişen çerçeve TOO_SHORT değil, LENGTH_MISMATCH.
    expect(code).toContain('if (offset + payload_size > length) {');
    expect(code).toContain('out->payload = (uint8_t *)&data[offset];');
    expect(code).toContain('offset += payload_size;');
  });

  it('walks nested structures and array repetitions with real access paths', () => {
    const { code } = generateCParser(NESTED_SCHEMA);
    expect(code).toContain('out->header.device_address = ');
    expect(code).toContain('out->header.item_count = ');
    expect(code).toContain('size_t items_total = (size_t)out->header.item_count;');
    expect(code).toContain(
      'for (size_t items_index = 0u; items_index < items_total; items_index++) {',
    );
    expect(code).toContain('out->items[items_index].value = ');
    expect(code).toContain('out->items[items_index].flags.alarm = ');
  });

  it('guards the fixed array capacity of the generated header', () => {
    const { code } = generateCParser(NESTED_SCHEMA);
    // Kapasite makrosu C struct üreticisinin başlığından gelir; taşan çerçeve
    // komşu üyelerin üzerine yazmak yerine reddedilir.
    expect(code).toContain('if (items_total > NESTED_TELEMETRY_ITEMS_MAX_COUNT) {');
    expect(code).toContain('return NESTED_TELEMETRY_ERR_LENGTH_MISMATCH;');
    expect(code).toContain('out->items_count = (uint16_t)items_total;');
  });

  it('drops the capacity guard when the repeat count is a fixed number', () => {
    const fixed: ProtocolSchema = {
      name: 'Fixed Array',
      version: '1.0',
      framing: { type: 'none', maximumFrameLength: 64 },
      fields: [
        {
          id: 'samples',
          name: 'Samples',
          type: 'array',
          repeatCount: 3,
          fields: [{ id: 'value', name: 'Value', type: 'uint8' }],
        },
      ],
    };
    const { code } = generateCParser(fixed);
    expect(code).toContain('for (size_t samples_index = 0u; samples_index < 3u; samples_index++) {');
    expect(code).not.toContain('MAX_COUNT');
    expect(code).not.toContain('samples_count');
  });

  it('shifts and masks bit fields according to bitOffset and bitOrder', () => {
    const { code } = generateCParser(NESTED_SCHEMA);
    // bitOffset 3, bitLength 2, msb-first → (8 - 3 - 2) = 3 bit kaydırma.
    expect(code).toContain('(uint8_t)((raw >> 3) & 0x3u)');

    const lsbFirst: ProtocolSchema = {
      name: 'Bits',
      version: '1.0',
      framing: { type: 'none', maximumFrameLength: 8 },
      fields: [
        {
          id: 'flag',
          name: 'Flag',
          type: 'bitField',
          bitOffset: 2,
          bitLength: 3,
          bitOrder: 'lsb-first',
        },
      ],
    };
    expect(generateCParser(lsbFirst).code).toContain('(uint8_t)((raw >> 2) & 0x7u)');
  });

  it('documents the physical value formula without inventing a struct member', () => {
    const { code } = generateCParser(NESTED_SCHEMA);
    expect(code).toContain('(float)out->items[items_index].value * 0.1f - 40.0f */');
    // Başlıkta fiziksel değer üyesi YOK; atama üretmek derlenmez kod olurdu.
    expect(code).not.toContain('_physical =');
    // Ölçeği olmayan alan formül satırı da üretmemeli.
    expect(code).not.toContain('(float)out->header.item_count');
  });

  it('wraps conditional fields in the condition they declare', () => {
    const conditional: ProtocolSchema = {
      name: 'Conditional',
      version: '1.0',
      framing: { type: 'none', maximumFrameLength: 32 },
      fields: [
        { id: 'mode', name: 'Mode', type: 'uint8' },
        { id: 'extra', name: 'Extra', type: 'uint8', condition: { field: 'mode', equals: 7 } },
      ],
    };
    const { code } = generateCParser(conditional);
    expect(code).toContain('if (out->mode == 7) {');
    expect(code).toContain('memset(out, 0, sizeof(*out));');
  });

  it('keeps checksum coverage bounds outside the conditional block', () => {
    const conditionalBoundary: ProtocolSchema = {
      name: 'Conditional Coverage',
      version: '1.0',
      framing: { type: 'none', maximumFrameLength: 32 },
      fields: [
        { id: 'mode', name: 'Mode', type: 'uint8' },
        { id: 'extra', name: 'Extra', type: 'uint8', condition: { field: 'mode', equals: 7 } },
        {
          id: 'k',
          name: 'K',
          type: 'checksum',
          algorithm: 'sum8',
          coverage: { startField: 'mode', endField: 'extra' },
        },
      ],
    };
    const { code } = generateCParser(conditionalBoundary);
    const conditionLine = code.indexOf('if (out->mode == 7) {');
    const endLine = code.indexOf('k_coverage_end = offset;');
    const closingBrace = code.lastIndexOf('}', endLine);
    // Sınır atamasının koşul bloğunun İÇİNDE kalması, alan atlandığında
    // `end - start` çıkarmasını taşırıp checksum'ı tampon dışına okuturdu.
    expect(conditionLine).toBeGreaterThan(-1);
    expect(endLine).toBeGreaterThan(closingBrace);
    expect(closingBrace).toBeGreaterThan(conditionLine);
  });

  it('keeps identifiers unique when two fields share a name', () => {
    const duplicated: ProtocolSchema = {
      name: 'Duplicate Names',
      version: '1.0',
      framing: { type: 'none', maximumFrameLength: 16 },
      fields: [
        { id: 'first', name: 'Sıcaklık', type: 'uint8' },
        { id: 'second', name: 'Sicaklik', type: 'uint8' },
      ],
    };
    const { code } = generateCParser(duplicated);
    expect(code).toContain('out->sicaklik = ');
    expect(code).toContain('out->sicaklik_2 = ');
  });

  it('stays inside the embedded target constraints', () => {
    for (const schema of [SPEC_SENSOR_PROTOCOL, NESTED_SCHEMA, WIDE_SCHEMA]) {
      const { code } = generateCParser(schema);
      // Yorumda "`malloc` yok" yazdığı için ÇAĞRI biçimi aranır, kelime değil.
      expect(code).not.toContain('malloc(');
      expect(code).not.toContain('alloca(');
      expect(code).not.toContain('free(');
      expect(code).not.toContain('eval(');
      // VLA yok: dizi boyutları ya sabit ya da hiç yok.
      expect(code).not.toMatch(/\[[a-z_]+_(count|size|length)\]/);
    }
  });

  it('honours the indent option and produces deterministic output', () => {
    const first = generateCParser(NESTED_SCHEMA).code;
    const second = generateCParser(NESTED_SCHEMA).code;
    // Tarih/rastgelelik yok: aynı şema her zaman aynı metin.
    expect(first).toBe(second);
    expect(first).toContain('\n  size_t offset = 0u;');

    const tabbed = generateCParser(NESTED_SCHEMA, { indent: '\t' }).code;
    expect(tabbed).toContain('\n\tsize_t offset = 0u;');
  });
});

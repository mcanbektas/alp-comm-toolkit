/**
 * Protocol Converter'ın SAF motoru (spec §33) — React'siz, senkron, ekranı
 * bilmez. Packet Builder'ın `packetPipeline`ı ile aynı disiplin: ekran karar
 * verir, motor hesaplar.
 *
 * ## Dönüşüm neden `physicalValue` üzerinden okuyor
 *
 * `ParsedField` iki değer taşır: `rawValue` (telden gelen) ve `physicalValue`
 * (ölçeklenmiş/yorumlanmış). Kullanıcının "Modbus Register 40001 × 0.1" derken
 * kastettiği, protokolün KENDİ yorumundan sonraki değerdir; alan zaten bir
 * ölçek uyguluyorsa onu yok sayıp ham sayıyı çarpmak sessizce başka bir sonuç
 * üretirdi. Bu yüzden sıra: `physicalValue` varsa o, yoksa `rawValue`.
 *
 * `physicalValue` METİN de olabilir (enum etiketleri: "Read Holding
 * Registers"). O durumda aritmetik UYGULANMAZ ve değer olduğu gibi taşınır —
 * metni sayıya zorlamak `NaN` üretip çıktıyı sessizce bozardı; kullanıcı
 * etiketi bir JSON alanına taşımak istiyor olabilir ve bu meşrudur.
 */

import { encodeMqttPublishPacket } from '@/protocols/network/mqtt/mqttEncoders';
import { bytesToHex } from '@/protocol-core/buffers/representation';
import type { ParsedField, ParsedFrame } from '@/protocol-core/types';

import type {
  ConversionIssue,
  ConversionOutput,
  ConvertedPacket,
  ConvertedValue,
  DestinationKind,
  FieldMapping,
  TransformKind,
} from './converterTypes';

/** Kayan nokta gürültüsünü kesen basamak sayısı (spec §47: toleransla çalış). */
const VALUE_PRECISION = 6;

const TOPIC_LENGTH_FIELD_SIZE = 2;
const BITS_PER_BYTE = 8;
const BYTE_MASK = 0xff;

/** Alanın sayısal değeri; metin/enum alanlarında `undefined`. */
function readNumericValue(field: ParsedField): number | undefined {
  const source = field.physicalValue ?? field.rawValue;
  if (typeof source === 'number') return source;
  // BigInt alanlar (64 bitlik sayaçlar) `Number`a düşürülür: dönüşüm
  // aritmetiği zaten kayan noktalı ve 2^53 üstü değerler §33'ün kapsamında yok.
  if (typeof source === 'bigint') return Number(source);
  return undefined;
}

/** Metin değeri — sayısal olmayan alanlar için. */
function readTextValue(field: ParsedField): string {
  const source = field.physicalValue ?? field.rawValue;
  return source === undefined ? '' : String(source);
}

/** `value × factor + addend`in dört hâli. Yalnız seçilen parçalar uygulanır. */
export function applyTransform(value: number, transform: TransformKind, factor: number, addend: number): number {
  const scaled = transform === 'scale' || transform === 'scaleOffset' ? value * factor : value;
  const shifted = transform === 'offset' || transform === 'scaleOffset' ? scaled + addend : scaled;
  return Number.parseFloat(shifted.toFixed(VALUE_PRECISION));
}

function findField(frame: ParsedFrame, fieldId: string): ParsedField | undefined {
  return frame.fields.find((field) => field.id === fieldId);
}

/** JSON çıktısı: hedef adı ANAHTAR olur. Aynı ad iki kez yazılırsa sonuncusu kalır — JSON'un kendi kuralı. */
function renderJson(values: readonly ConvertedValue[]): string {
  const object: Record<string, number | string> = {};
  for (const value of values) {
    object[value.destinationName] = value.value;
  }
  return JSON.stringify(object, null, 2);
}

/**
 * CSV çıktısı: başlık satırı + TEK veri satırı. Bir çerçeve bir satırdır;
 * §33'ün "J1939 SPN → CSV" örneği de tek mesajın alanlarını sütunlara açar.
 *
 * Alan ayracı virgül, ve virgül içeren değer tırnaklanır (RFC 4180) — aksi
 * hâlde tek bir etiket sütunları kaydırırdı.
 */
function renderCsv(values: readonly ConvertedValue[]): string {
  const escape = (text: string): string =>
    /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;

  const header = values.map((value) => escape(value.destinationName)).join(',');
  const row = values.map((value) => escape(String(value.value))).join(',');
  return `${header}\n${row}`;
}

/**
 * MQTT PUBLISH gövdesi: `topic uzunluğu (2) + topic + payload`. Payload,
 * değerin ASCII metnidir — §33'ün örneğinde hedef bir topic'tir ve broker'a
 * giden yük de o değerin metnidir.
 */
function buildPublishBody(topic: string, value: number | string): Uint8Array {
  const topicBytes = new TextEncoder().encode(topic);
  const payloadBytes = new TextEncoder().encode(String(value));
  const body = new Uint8Array(TOPIC_LENGTH_FIELD_SIZE + topicBytes.length + payloadBytes.length);
  body[0] = (topicBytes.length >> BITS_PER_BYTE) & BYTE_MASK;
  body[1] = topicBytes.length & BYTE_MASK;
  body.set(topicBytes, TOPIC_LENGTH_FIELD_SIZE);
  body.set(payloadBytes, TOPIC_LENGTH_FIELD_SIZE + topicBytes.length);
  return body;
}

/**
 * Çevirinin tamamı: çözülmüş çerçeve + eşleme listesi + hedef biçimi → çıktı.
 *
 * Kaybolan alan bir HATA değil, bir DURUMDUR: kullanıcı kaynak protokolü
 * değiştirdiğinde eski eşlemeler ayakta kalır ve alan kimliği artık yoktur.
 * O satır çıktıdan düşer, sorun listesine iner, ÖTEKİ satırlar üretilmeye
 * devam eder.
 */
export function convertFrame(
  frame: ParsedFrame,
  mappings: readonly FieldMapping[],
  destination: DestinationKind,
): ConversionOutput {
  const values: ConvertedValue[] = [];
  const issues: ConversionIssue[] = [];

  for (const mapping of mappings) {
    const field = findField(frame, mapping.sourceFieldId);
    if (field === undefined) {
      issues.push({
        mappingId: mapping.id,
        messageKey: 'converter.issue.unknownField',
        params: { detail: mapping.sourceFieldId },
      });
      continue;
    }
    if (mapping.destinationName.trim() === '') {
      issues.push({
        mappingId: mapping.id,
        messageKey: 'converter.issue.missingDestination',
        params: { detail: field.name },
      });
      continue;
    }

    const numeric = readNumericValue(field);
    if (numeric === undefined && mapping.transform !== 'none') {
      // Aritmetik metne uygulanamaz. Satır DÜŞMEZ, değer ham metin olarak
      // taşınır ve kullanıcı neden çarpılmadığını görür.
      issues.push({
        mappingId: mapping.id,
        messageKey: 'converter.issue.notNumeric',
        params: { detail: field.name },
      });
    }

    values.push({
      mappingId: mapping.id,
      destinationName: mapping.destinationName.trim(),
      sourceFieldName: field.name,
      value:
        numeric === undefined
          ? readTextValue(field)
          : applyTransform(numeric, mapping.transform, mapping.factor, mapping.addend),
    });
  }

  if (destination !== 'mqtt-publish') {
    return {
      values,
      text: destination === 'json' ? renderJson(values) : renderCsv(values),
      packets: [],
      issues,
    };
  }

  const packets: ConvertedPacket[] = [];
  for (const value of values) {
    try {
      packets.push({
        mappingId: value.mappingId,
        topic: value.destinationName,
        bytes: encodeMqttPublishPacket(buildPublishBody(value.destinationName, value.value)),
      });
    } catch (cause) {
      // Encoder "üretemedim" diyecek bir dönüş değeri taşımıyor, FIRLATIYOR
      // (`mqttEncoders.ts`). İstisna ekrana kaçmamalı, sorun listesine iner.
      issues.push({
        mappingId: value.mappingId,
        messageKey: 'converter.issue.encodeFailed',
        params: { detail: cause instanceof Error ? cause.message : String(cause) },
      });
    }
  }

  return {
    values,
    text: packets.map((packet) => `${packet.topic}: ${bytesToHex(packet.bytes)}`).join('\n'),
    packets,
    issues,
  };
}

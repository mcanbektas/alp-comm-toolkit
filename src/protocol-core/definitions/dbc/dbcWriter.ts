/**
 * `DbcDatabase` → DBC metni. Spec §17.4 yalnız okumayı değil OLUŞTURMAYI da
 * istiyor ("DBC yükleme ve oluşturma desteği").
 *
 * Çıktı, `parseDbc`ın geri okuyabileceği biçimdedir ve testler gidiş-dönüşü
 * (parse → write → parse) çivilemektedir: yazıcı ile çözücü ayrışırsa
 * kullanıcının dışa aktardığı dosya kendi uygulamamızda bile açılmazdı.
 *
 * `NS_` ve `BS_` bölümleri BİLEREK boş iskelet olarak yazılır: birçok araç
 * dosyayı bu iki başlık yoksa reddeder, ama içerikleri sinyal çözümüyle
 * ilgisizdir ve uydurulmaları yanlış olurdu.
 */

import type { DbcDatabase, DbcMessage, DbcSignal } from './dbcTypes';

/** DBC'de extended identifier bu bit ile işaretlenir. */
const DBC_EXTENDED_ID_FLAG = 0x80000000;

/**
 * `NS_` bölümünün başlıkları. İçerik değil İSKELET: araçların beklediği
 * bölümün varlığını sağlar, hiçbir öznitelik uydurmaz.
 */
const NEW_SYMBOLS_HEADER = ['NS_ :', '', 'BS_:', ''];

/**
 * Sayıyı DBC'nin beklediği sade ondalık gösterime çevirir. `toString()`
 * üstel gösterim üretebilir (`1e-7`) ve bazı araçlar bunu okumaz; küçük
 * değerler bu yüzden sabit noktaya düşürülür.
 */
function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Number.isInteger(value)) return String(value);
  const text = String(value);
  if (!text.includes('e') && !text.includes('E')) return text;
  // Üstel gösterimden kurtul: 20 hane DBC'nin pratikte gördüğü en ince
  // çözünürlüğün çok ötesinde, sondaki sıfırlar kırpılır.
  return value.toFixed(20).replace(/0+$/, '').replace(/\.$/, '');
}

function formatMultiplex(signal: DbcSignal): string {
  switch (signal.multiplex.kind) {
    case 'multiplexor':
      return ' M';
    case 'multiplexed':
      return ` m${String(signal.multiplex.switchValue)}`;
    default:
      return '';
  }
}

function writeSignal(signal: DbcSignal): string {
  const byteOrder = signal.byteOrder === 'intel' ? '1' : '0';
  const sign = signal.signed ? '-' : '+';
  const receivers = signal.receivers.length > 0 ? signal.receivers.join(',') : 'Vector__XXX';
  return (
    ` SG_ ${signal.name}${formatMultiplex(signal)} : ` +
    `${String(signal.startBit)}|${String(signal.bitLength)}@${byteOrder}${sign} ` +
    `(${formatNumber(signal.factor)},${formatNumber(signal.offset)}) ` +
    `[${formatNumber(signal.minimum)}|${formatNumber(signal.maximum)}] ` +
    `"${signal.unit}" ${receivers}`
  );
}

/** Dosyada yazılacak ham identifier: extended mesajlarda bayrak geri eklenir. */
function rawIdentifier(message: DbcMessage): number {
  return message.extended ? (message.canId | DBC_EXTENDED_ID_FLAG) >>> 0 : message.canId;
}

function writeMessage(message: DbcMessage): string[] {
  const transmitter = message.transmitter === '' ? 'Vector__XXX' : message.transmitter;
  const lines = [
    `BO_ ${String(rawIdentifier(message))} ${message.name}: ` +
      `${String(message.byteLength)} ${transmitter}`,
  ];
  for (const signal of message.signals) {
    lines.push(writeSignal(signal));
  }
  lines.push('');
  return lines;
}

/** `CM_` yorum satırları — mesaj ve sinyal yorumları ayrı biçimlerde yazılır. */
function writeComments(database: DbcDatabase): string[] {
  const lines: string[] = [];
  for (const comment of database.comments) {
    lines.push(`CM_ "${comment}";`);
  }
  for (const message of database.messages) {
    const id = String(rawIdentifier(message));
    if (message.comment !== undefined && message.comment !== '') {
      lines.push(`CM_ BO_ ${id} "${message.comment}";`);
    }
    for (const signal of message.signals) {
      if (signal.comment !== undefined && signal.comment !== '') {
        lines.push(`CM_ SG_ ${id} ${signal.name} "${signal.comment}";`);
      }
    }
  }
  return lines;
}

/** `VAL_` değer tabloları. Anahtarlar sayısal sırada yazılır — çıktı deterministik olmalı. */
function writeValueTables(database: DbcDatabase): string[] {
  const lines: string[] = [];
  for (const message of database.messages) {
    const id = String(rawIdentifier(message));
    for (const signal of message.signals) {
      if (signal.valueTable === undefined || signal.valueTable.size === 0) continue;
      const pairs = [...signal.valueTable.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([value, label]) => `${String(value)} "${label}"`)
        .join(' ');
      lines.push(`VAL_ ${id} ${signal.name} ${pairs} ;`);
    }
  }
  return lines;
}

/** `DbcDatabase`i `parseDbc`ın geri okuyabileceği DBC metnine çevirir. */
export function writeDbc(database: DbcDatabase): string {
  const lines: string[] = [`VERSION "${database.version}"`, '', ...NEW_SYMBOLS_HEADER];

  // `BU_` her zaman yazılır, liste boş olsa bile: bölümün yokluğu bazı
  // araçlarda çözümlemeyi durduruyor.
  lines.push(`BU_: ${database.nodes.join(' ')}`.trimEnd(), '');

  for (const message of database.messages) {
    lines.push(...writeMessage(message));
  }

  const comments = writeComments(database);
  if (comments.length > 0) lines.push(...comments, '');

  const valueTables = writeValueTables(database);
  if (valueTables.length > 0) lines.push(...valueTables, '');

  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

/**
 * UART karakter hattı çekirdeği — Faz 10 dalga 11d'nin (rs-485 + rs-422)
 * paylaşılan motoru. `qspiCore.ts`in (dalga 11b) rolüyle aynı: iki protokol
 * dosyası da aynı bayt→hat görünümü mantığını kullanır, mantık TEK yerde durur.
 *
 * ── Bu dosya NE yapar ───────────────────────────────────────────────────────
 * Yakalanmış bir baytı UART karakter çerçevesine açar: Start biti (0), veri
 * bitleri LSB-first, (varsa) parity biti, Stop biti/bitleri (1). Spec özetinin
 * KENDİ örneği (`docs/spec/ozet/01-fiziksel-arayuzler.md:117`, RS-232 bölümü)
 * bire bir doğrular: 9600 8N1, Data=0x41 → `Start D0..D7 Stop = 0 1 0 0 0 0 0 1 0 1`.
 * 0x41 = 0b01000001, LSB-first D0..D7 = 1 0 0 0 0 0 1 0 — bu fixture
 * `uartLineCore.test.ts`te kalıcı testtir.
 *
 * Ayrıca diferansiyel arayüzler (RS-422/RS-485) için hat seviyelerinin V_AB
 * karşılığını üretir: spec'in RS-422 bit görünümü (`:113-118`) `UART 1 0 1 1 0`
 * dizisini `Vdiff +V −V +V +V −V` olarak veriyor — yani **logic 1 → V_AB
 * pozitif**, logic 0 → V_AB negatif. Eşleme spec'in kendi örneğinden alındı,
 * uydurulmadı. (A/B pin adlandırmasının satıcıdan satıcıya ters olabilmesi
 * spec'in kendi "Entegrasyon problemleri" listesinde: "A/B polarite ters".)
 *
 * ── Sabit 8N1 varsayımı, gerekçesi ─────────────────────────────────────────
 * `ProtocolParser.parse(data, context)` yalnız bayt + timestamp/direction/
 * channel/signal alır — baud/parity/stop için bir konfigürasyon kanalı YOK.
 * Bu yüzden RS-422/RS-485 sayfaları 8N1 varsayar ve bunu dokümantasyonunda
 * açıkça yazar. Çekirdek yine de konfigürasyonu parametre olarak alır: parity
 * ve 2 stop biti burada test edilmiştir, sıradaki alt-dalga (#5: uart, rs-232,
 * ttl-uart, cmos-uart — kendi "Configuration" aracı olan sayfalar) bunu
 * yeniden yazmadan kullanacak.
 *
 * ── KAPSAM DIŞI ─────────────────────────────────────────────────────────────
 * - Gerçek gerilim değerleri (V_OH/V_OL, ±200 mV receiver eşiği), dalga formu,
 *   TX+/TX− ayrı kanalları: bit değil elektriksel sinyal; bu toolkit yalnız
 *   yakalanmış BAYTLARI çözer.
 * - Baud/karakter süresi saniye cinsinden: `protocol-core/timing/uart.ts`
 *   (Faz 5) zaten hesaplıyor, `uart-timing` hesaplayıcısında çalışıyor —
 *   burada TEKRAR YAZILMADI, yalnız bit-süresi (birimsiz) sayılır.
 */

import type { UartParity } from '@/protocol-core';
import type { ParsedField } from '@/protocol-core/types';

const HEX_RADIX = 16;
const BINARY_RADIX = 2;
const START_BIT_LEVEL = 0;
const STOP_BIT_LEVEL = 1;
const PRINTABLE_MIN = 0x20;
const PRINTABLE_MAX = 0x7e;

/** Hat seviyesi açılan karakter sayısının üst sınırı — bkz. `buildCharacterFields`. */
export const MAX_EXPANDED_CHARACTERS = 64;

export interface UartLineConfig {
  /** Spec örneklerinin hepsi 8 veri biti kullanır; 5-9 aralığı UART'ın genel tanımı. */
  dataBits: number;
  parity: UartParity;
  stopBits: number;
}

/** RS-422/RS-485 sayfalarının varsayımı (dosya başındaki gerekçe). */
export const UART_8N1: UartLineConfig = { dataBits: 8, parity: 'none', stopBits: 1 };

export interface UartCharacterLine {
  byte: number;
  startBit: number;
  /** LSB-first — spec'in `Start D0..D7 Stop` sıralaması. */
  dataBits: number[];
  parityBit?: number;
  stopBits: number[];
  /** Start'tan Stop'a tüm hat seviyeleri, tek dizi. */
  levels: number[];
}

function bitAt(value: number, index: number): number {
  return (value >> index) & 1;
}

/** Even parity: veri bitlerindeki 1'lerin toplamını çift yapar; odd bunun tersi. */
function computeParityBit(dataBits: readonly number[], parity: UartParity): number | undefined {
  if (parity === 'none') return undefined;
  const ones = dataBits.reduce((total, bit) => total + bit, 0);
  const evenBit = ones % 2 === 0 ? 0 : 1;
  return parity === 'even' ? evenBit : 1 - evenBit;
}

export function expandUartCharacter(
  byte: number,
  config: UartLineConfig = UART_8N1,
): UartCharacterLine {
  const dataBits: number[] = [];
  for (let index = 0; index < config.dataBits; index += 1) {
    dataBits.push(bitAt(byte, index));
  }
  const parityBit = computeParityBit(dataBits, config.parity);
  const stopBits: number[] = Array.from({ length: config.stopBits }, () => STOP_BIT_LEVEL);
  const levels = [
    START_BIT_LEVEL,
    ...dataBits,
    ...(parityBit === undefined ? [] : [parityBit]),
    ...stopBits,
  ];

  return {
    byte,
    startBit: START_BIT_LEVEL,
    dataBits,
    ...(parityBit === undefined ? {} : { parityBit }),
    stopBits,
    levels,
  };
}

/** `1(start) + dataBits + parity + stopBits` — spec'in 8N1 için verdiği 10 bit. */
export function bitsPerCharacter(config: UartLineConfig = UART_8N1): number {
  return 1 + config.dataBits + (config.parity === 'none' ? 0 : 1) + config.stopBits;
}

/**
 * Hat görünümü, gruplanmış: `0 10000010 1` (start · veri · [parity] · stop).
 * Gruplama etiket taşımaz — dar ekranda tek satıra sığması için (dalga 11c'nin
 * 390 piksel taşma testi bu tabloyu da kapsıyor); anlamı sayfa
 * dokümantasyonunda yazılı.
 */
export function formatUartLine(line: UartCharacterLine): string {
  const groups = [
    String(line.startBit),
    line.dataBits.join(''),
    ...(line.parityBit === undefined ? [] : [String(line.parityBit)]),
    line.stopBits.join(''),
  ];
  return groups.join(' ');
}

/** Hat seviyelerinin V_AB karşılığı: logic 1 → `+`, logic 0 → `−` (spec RS-422 bit görünümü). */
export function formatDifferentialLine(levels: readonly number[]): string {
  return levels.map((level) => (level === 1 ? '+' : '−')).join('');
}

/**
 * Hat seviyelerinin RS-232 mark/space karşılığı: **logic 1 → Mark (`M`, negatif
 * hat gerilimi), logic 0 → Space (`S`, pozitif)** — spec özeti
 * (`01-fiziksel-arayuzler.md:101`): "Mark→Logic1→negatif hat gerilimi;
 * Space→Logic0→pozitif hat gerilimi". Idle mark olduğu için RS-232 TX hattı
 * boştayken negatiftir (spec'in "logic inversion" notu).
 *
 * Gerçek gerilim ARALIĞI (±3V…±15V) spec özetinde YOK — bu yüzden yalnız
 * polarite adı üretilir, sayı uydurulmaz (RS-232 kaydının bilerek bıraktığı
 * boşluk, brief'in "Signal View kapsamı BELİRSİZ" saptaması).
 */
export function formatMarkSpaceLine(levels: readonly number[]): string {
  return levels.map((level) => (level === 1 ? 'M' : 'S')).join('');
}

function formatHexByte(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(2, '0')}`;
}

/** Yalnız basılabilir ASCII gösterilir — 0x0D gibi kontrol baytları için sessiz kalır. */
function printableAscii(byte: number): string | undefined {
  if (byte < PRINTABLE_MIN || byte > PRINTABLE_MAX) return undefined;
  return `'${String.fromCharCode(byte)}'`;
}

/** Alan tablosunda görünen metin: `0x41 'A' · 0 10000010 1`. */
export function describeCharacter(byte: number, config: UartLineConfig = UART_8N1): string {
  const ascii = printableAscii(byte);
  const line = formatUartLine(expandUartCharacter(byte, config));
  return [formatHexByte(byte), ...(ascii === undefined ? [] : [ascii]), '·', line].join(' ');
}

/**
 * Yakalamanın ASCII karşılığı; basılamayan bayt `.` olur (spec'in canlı görünüm
 * örneği: `48 65 6C 6C 6F 0D 0A` → `Hello` + satır sonu, `01-fiziksel-arayuzler.md:91`).
 * Satır sonu baytları çağıran tarafta ayrılır, burada da `.` olarak görünür.
 */
export function formatAsciiText(data: Uint8Array): string {
  let text = '';
  for (const byte of data) {
    text += byte >= PRINTABLE_MIN && byte <= PRINTABLE_MAX ? String.fromCharCode(byte) : '.';
  }
  return text;
}

/** İkilik gösterim (MSB-first) — testlerin ve dokümantasyonun okunurluğu için. */
export function formatBinaryByte(byte: number, dataBits: number = UART_8N1.dataBits): string {
  return byte.toString(BINARY_RADIX).padStart(dataBits, '0');
}

export interface CharacterFieldOptions {
  /** Aynı frame'de iki karakter dizisi varsa (RS-485 echo) alan id'lerini ayırır. */
  idPrefix?: string;
  /** Alan adının önüne eklenir, ör. `Echo · `. */
  namePrefix?: string;
  /** İkinci dizinin frame içindeki başlangıç offset'i. */
  baseOffset?: number;
  /**
   * Alan metnini üreten fonksiyon; verilmezse `describeCharacter`. RS-232
   * sayfası buradan kendi mark/space sütununu ekler — çekirdeğe protokole özel
   * dal koymak yerine davranış dışarıdan geçilir.
   */
  describe?: (byte: number, config: UartLineConfig) => string;
}

/**
 * Bayt dizisini karakter alanlarına açar.
 *
 * `MAX_EXPANDED_CHARACTERS` üstündeki baytlar TEK bir "kalan" alanına toplanır —
 * sessizce DÜŞMEZ. Dalga 11a/11b'nin iki hatası (onewire CRC kapsama off-by-one'ı,
 * qspiCore'un kısmi adres baytlarını kaybetmesi) aynı sınıftandı: "veri sessizce
 * kayboluyor". Bu sınır bilerek görünür kılındı ve testle sabitlendi.
 */
export function buildCharacterFields(
  data: Uint8Array,
  config: UartLineConfig = UART_8N1,
  options: CharacterFieldOptions = {},
): ParsedField[] {
  const idPrefix = options.idPrefix ?? '';
  const namePrefix = options.namePrefix ?? '';
  const baseOffset = options.baseOffset ?? 0;
  const describe = options.describe ?? describeCharacter;

  const expandedCount = Math.min(data.length, MAX_EXPANDED_CHARACTERS);
  const fields: ParsedField[] = [];

  for (let index = 0; index < expandedCount; index += 1) {
    const byte = data[index] ?? 0;
    fields.push({
      id: `${idPrefix}char${index}`,
      name: `${namePrefix}Character ${index + 1}`,
      offset: baseOffset + index,
      length: 1,
      rawBytes: data.slice(index, index + 1),
      rawValue: byte,
      physicalValue: describe(byte, config),
      valid: true,
      warnings: [],
    });
  }

  if (data.length > expandedCount) {
    const remaining = data.length - expandedCount;
    fields.push({
      id: `${idPrefix}remaining`,
      name: `${namePrefix}Remaining Characters`,
      offset: baseOffset + expandedCount,
      length: remaining,
      rawBytes: data.slice(expandedCount),
      unit: 'B',
      physicalValue: `+${remaining} · line view capped at ${MAX_EXPANDED_CHARACTERS}`,
      valid: true,
      warnings: [],
    });
  }

  return fields;
}

/** Açılan karakterlerin V_AB dizisi — frame metadata'sına girer (alan tablosunu şişirmez). */
export function differentialLines(
  data: Uint8Array,
  config: UartLineConfig = UART_8N1,
): string[] {
  const expandedCount = Math.min(data.length, MAX_EXPANDED_CHARACTERS);
  const lines: string[] = [];
  for (let index = 0; index < expandedCount; index += 1) {
    lines.push(formatDifferentialLine(expandUartCharacter(data[index] ?? 0, config).levels));
  }
  return lines;
}

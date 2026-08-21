/**
 * XMODEM-ailesi (XMODEM/YMODEM) blok çerçeveleri için PAYLAŞILAN çekirdek —
 * Faz 10 dalga 10d. `xmodem.ts`/`ymodem.ts` bunun üstüne ince sarmal.
 *
 * **Framing motoruna (protocol-core/framing/) UYMAZ, hiç çağrılmaz** — spec'in
 * kendi notu (brief-faz10-dalga10.md): stop-and-wait ACK/NAK oturumlu bir
 * dosya transferi, motorun 15 yönteminden hiçbiri bu şekli karşılamıyor
 * (delimiter/length-field YOK — çerçeve sınırı Header baytının KENDİSİNİN
 * taşıdığı sabit veri uzunluğundan (128/1024) türetilir). Decode sekmesi
 * TEK bir blok çerçevesi (ya da tek bir kontrol baytı: EOT/ACK/NAK/CAN) alır
 * — canlı oturum/batch takibi bu motorun işi DEĞİL (`ProtocolParser.parse()`
 * saf/stateless kalır, PPP'nin LCP oturum takibini de ERTELEMESİYLE aynı
 * disiplin, dalga 10b).
 *
 * **Blok yapısı** (spec `02-framing-protokolleri.md` satır 240-241, NET):
 * `Header(SOH=0x01|STX=0x02) Block(1) ~Block(1) Data(128|1024) Trailer`.
 * `~Block = Block XOR 0xFF` (bire bir tümleyen). Header SOH→128 bayt veri,
 * STX→1024 bayt (XMODEM-1K, satır 252-253) — spec bu ikisini AYRI
 * doğrulanmış birer sabit vermiyor ama TAPR/klasik XMODEM'in evrensel
 * konvansiyonu budur, uydurulmadı.
 *
 * **Trailer uzunluğu ÇERÇEVENİN KENDİ TOPLAM boyutundan türetilir** — 1 bayt
 * ise checksum modu (`SUM-8`, spec satır 244: `(Σ Data) mod 256`), 2 bayt
 * ise CRC modu (`CRC16_XMODEM`, spec satır 246 "CRC-16" diyor, somut
 * parametreler yalnız kodda — `crcCatalogue.ts`, fixture `crcEngine.test.ts`
 * `"123456789"→0x31C3`). Checksum-modu el sıkışması (yalnız NAK, `C` YOK)
 * spec'te yazılı değil ama klasik XMODEM'in evrensel davranışı — spec yalnız
 * CRC-modu el sıkışmasını (`Receiver→C`) belgeliyor, checksum-modu ayrım
 * yalnız ÇERÇEVE UZUNLUĞUNDAN çözülüyor, el sıkışma baytına bakılmıyor
 * (decode tab tek çerçeve alır, oturum geçmişi yok).
 *
 * **CRC bayt sırası — BÜYÜK-UÇLU (big-endian), HDLC'nin (dalga 10c)
 * KÜÇÜK-UÇLU FCS'inin TERSİNE:** `CRC16_XMODEM` parametreleri
 * `refin=false, refout=false` (yansıtılmamış) — HDLC'nin `CRC16_X25`si
 * (`refin=true, refout=true`, yansıtılmış → küçük-uçlu tel sırası) ile
 * TAM TERS profil. Yansıtılmamış CRC'ler geleneksel olarak büyük-uçlu
 * iletilir (CRC teorisinin standart eşleşmesi, `bacnetmstp.ts`in Header
 * CRC-8'i tek baytlık olduğu için bu ayrımı hiç göstermiyordu) — burada
 * yüksek bayt ÖNCE.
 */

import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';
import { sum8Checksum } from '@/protocol-core/checksums/simpleChecksums';

export const SOH = 0x01;
export const STX = 0x02;
export const EOT = 0x04;
export const ACK = 0x06;
export const NAK = 0x15;
export const CAN = 0x18;

export const BLOCK_DATA_LENGTH_STANDARD = 128;
export const BLOCK_DATA_LENGTH_1K = 1024;

/** Tek baytlık, veri taşımayan protokol sinyalleri — spec satır 238. */
export const CONTROL_BYTE_NAMES: ReadonlyMap<number, string> = new Map([
  [EOT, 'EOT (End Of Transmission)'],
  [ACK, 'ACK (Acknowledge)'],
  [NAK, 'NAK (Negative Acknowledge)'],
  [CAN, 'CAN (Cancel)'],
]);

export type XmodemChecksumMode = 'checksum' | 'crc';

export interface XmodemBlockFrame {
  readonly kind: 'block';
  readonly header: number;
  readonly dataLength: 128 | 1024;
  readonly block: number;
  readonly blockComplement: number;
  readonly complementValid: boolean;
  readonly data: Uint8Array;
  readonly mode: XmodemChecksumMode;
  readonly trailer: Uint8Array;
  readonly received: number;
  readonly calculated: number;
  readonly integrityValid: boolean;
}

export interface XmodemControlFrame {
  readonly kind: 'control';
  readonly byte: number;
  readonly name: string;
}

export type XmodemFrame = XmodemBlockFrame | XmodemControlFrame;

export type XmodemParseFailureReason = 'empty' | 'unknown-header' | 'bad-trailer-length';

export type XmodemParseResult = { readonly ok: true; readonly frame: XmodemFrame } | { readonly ok: false; readonly reason: XmodemParseFailureReason };

/** noUncheckedIndexedAccess guard — bayt dizisi erişimi bu guard'dan geçer (iec104.ts `byteAt` emsali). */
export function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

/**
 * Trailer uzunluğunu ÇERÇEVENİN KENDİ TOPLAM boyutundan çıkarır — XMODEM'in
 * hiçbir alanı "trailer N bayttır" demez, yalnız 1 (checksum) ya da 2 (CRC)
 * olabileceği bilinir (dosya başı). `undefined` dönerse çerçeve uzunluğu
 * ne checksum ne CRC moduyla tutarlı (bozuk/eksik).
 */
function detectMode(totalLength: number, dataLength: number): XmodemChecksumMode | undefined {
  const trailerLength = totalLength - 3 - dataLength;
  if (trailerLength === 1) return 'checksum';
  if (trailerLength === 2) return 'crc';
  return undefined;
}

export function parseXmodemFrame(data: Uint8Array): XmodemParseResult {
  if (data.length === 0) return { ok: false, reason: 'empty' };

  if (data.length === 1) {
    const byte = byteAt(data, 0);
    const name = CONTROL_BYTE_NAMES.get(byte);
    if (name === undefined) return { ok: false, reason: 'unknown-header' };
    return { ok: true, frame: { kind: 'control', byte, name } };
  }

  const header = byteAt(data, 0);
  const dataLength = header === SOH ? BLOCK_DATA_LENGTH_STANDARD : header === STX ? BLOCK_DATA_LENGTH_1K : undefined;
  if (dataLength === undefined) return { ok: false, reason: 'unknown-header' };

  const mode = detectMode(data.length, dataLength);
  if (mode === undefined) return { ok: false, reason: 'bad-trailer-length' };

  const block = byteAt(data, 1);
  const blockComplement = byteAt(data, 2);
  const complementValid = (block ^ blockComplement) === 0xff;
  const blockData = data.slice(3, 3 + dataLength);
  const trailer = data.slice(3 + dataLength);

  let received: number;
  let calculated: number;
  if (mode === 'checksum') {
    received = byteAt(trailer, 0);
    calculated = sum8Checksum(blockData);
  } else {
    // Büyük-uçlu — dosya başı disiplini (HDLC'nin CRC16_X25 küçük-uçlusunun TERSİ).
    received = (byteAt(trailer, 0) << 8) | byteAt(trailer, 1);
    calculated = Number(computeNamedCrc(blockData, 'CRC16_XMODEM'));
  }

  return {
    ok: true,
    frame: {
      kind: 'block',
      header,
      dataLength,
      block,
      blockComplement,
      complementValid,
      data: blockData,
      mode,
      trailer,
      received,
      calculated,
      integrityValid: received === calculated,
    },
  };
}

/**
 * Gerçek encoder — hem pluginlerin `encoder`ini besler hem örnek/test
 * çerçevelerini kurar (HDLC/SDLC'nin `encodeHdlcSyncFrame` deseniyle aynı
 * ikili rol). `data.length` TAM 128 ya da 1024 olmalı — çağıran (dahili
 * kod) garanti eder, bu iç bir yardımcı, kullanıcı girdisiyle çağrılmaz.
 */
export function encodeXmodemBlock(block: number, data: Uint8Array, mode: XmodemChecksumMode): Uint8Array {
  let header: number;
  if (data.length === BLOCK_DATA_LENGTH_STANDARD) {
    header = SOH;
  } else if (data.length === BLOCK_DATA_LENGTH_1K) {
    header = STX;
  } else {
    throw new RangeError(`encodeXmodemBlock: data.length ${data.length} baytı 128 ya da 1024 olmalı`);
  }

  const trailer =
    mode === 'checksum'
      ? Uint8Array.from([sum8Checksum(data)])
      : (() => {
          const crcValue = Number(computeNamedCrc(data, 'CRC16_XMODEM'));
          return Uint8Array.from([(crcValue >> 8) & 0xff, crcValue & 0xff]);
        })();

  const framed = new Uint8Array(3 + data.length + trailer.length);
  framed[0] = header;
  framed[1] = block;
  framed[2] = block ^ 0xff;
  framed.set(data, 3);
  framed.set(trailer, 3 + data.length);
  return framed;
}

const HEX_RADIX = 16;

export function hexByte(byte: number): string {
  return `0x${byte.toString(HEX_RADIX).toUpperCase().padStart(2, '0')}`;
}

export function hexWord(word: number): string {
  return `0x${word.toString(HEX_RADIX).toUpperCase().padStart(4, '0')}`;
}

export function hexString(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(HEX_RADIX).toUpperCase().padStart(2, '0')).join(' ');
}

/**
 * HDLC-ailesi (HDLC/SDLC) çerçeveleri için PAYLAŞILAN çekirdek — Faz 10
 * dalga 10c. `hdlc.ts`/`sdlc.ts` bunun üstüne ince, protokole özgü sarmal.
 *
 * **Çerçeveleme kararı — neden `hdlcFlagExtractor` (PPP'nin motoru) DEĞİL:**
 * gerçek bit-senkron HDLC'nin bit-stuffing'i (`bitStuffing.ts`) canlı bir
 * bayt akışından bit-hizasız çerçeve çıkarmıyor (kendi başlık yorumu,
 * kasıtlı dar kapsam — `BitStream` alır, `FrameExtractor` DEĞİL). Decode
 * sekmesinin girdisi (hex yapıştırma, TEK çerçeve) spec'in kendi ayrımıyla
 * (`02-framing-protokolleri.md` satır 163-164) zaten "Logical Frame":
 * bit-stuffing gerçek donanımda/sürücüde temizlenir, decode tab'ına
 * bayt-hizalı Flag/Address/Control/Information/FCS ulaşır — "Transmitted
 * Bit Stream" (ayrı bir görünüm, bu dalgada YOK) değil. Bu YÜZDEN
 * `hdlcFlagExtractor` burada YANLIŞ araç: o `0x7D`'yi kaçış baytı sayıp XOR
 * çözer, ama gerçek bit-senkron veride `0x7D` sıradan bir veri baytıdır
 * (bit-stuffing hiç bayt-seviyeli kaçış YAPMAZ, yalnız 5 ardışık `1`
 * biti hedefler) — kullanırsak rastgele bir Address/Control/Info baytını
 * bozardık. Çerçeveleme bu yüzden KAÇIŞSIZ `createBoundedDelimiterExtractor`
 * (start=end=0x7E) ile kuruldu — jenerik motor zaten var
 * (`delimiterFraming.ts`), yeni yazılmadı.
 *
 * **Control field — BASİK/modulo-8 mod (1 bayt):** spec dosyası bit
 * pozisyonlarını "profile-bağımlı" diye kasıtlı açık bırakıyor (aynı dosya,
 * satır 170-172: "Exact control-field bit yorumu seçilen HDLC
 * profile/moduna göre değişir"), bu yüzden ISO 13239/ITU-T Q.921'in
 * TEMEL/varsayılan profili seçildi (PPP'nin RFC 1662 varsayılan Address/
 * Control seçmesiyle aynı disiplin, dalga 10b): bit0=0→I-frame (N(S)
 * bit1-3, P/F bit4, N(R) bit5-7); bit0-1=01→S-frame (S-tipi bit2-3, P/F
 * bit4, N(R) bit5-7); bit0-1=11→U-frame (M-bit'ler bit2-3+5-7, P/F bit4).
 * Genişletilmiş (modulo-128, 2 baytlık control) mod bu dalgada YOK.
 *
 * **U-frame KOMUT adları (SABM/DISC/UA/FRMR vb.) BİLEREK adlanmadı** —
 * repoda ne spec'te ne başka bir dosyada doğrulanmış bir bit-deseni↔ad
 * tablosu yok; ezberden uydurmak yanlış ad basma riski taşır (KISS'in
 * Persistence formülü/PPP'nin RFC 1570 LCP kod uzantılarının aynı
 * disiplini, dalga 10b). Yalnız format (I/S/U) + P/F + I/S formatlarının
 * N(S)/N(R)/S-tipi çözülür.
 *
 * **FCS:** `CRC16_X25` — `bacnetmstp.ts`in `dataCrc`/`zigbee.ts`in FCS
 * deseniyle BİREBİR aynı: hesapla, alınanla karşılaştır, PASS/FAIL. Address+
 * Control+Information üzerinden hesaplanır, tel üzerinde little-endian
 * (düşük bayt önce) taşınır — `bacnetmstp.ts:358`in `low | (high << 8)`
 * deseniyle aynı. Fixture: `crcEngine.test.ts`teki doğrulanmış CRC16_X25
 * check değeri (`"123456789"` → `0x906E`) — bu dalganın kendi örnek/test
 * çerçeveleri motorun KENDİSİYLE (`computeNamedCrc`) hesaplanır,
 * `bacnetmstp.test.ts`in "motorun kendi hesabından bağımsız" emsaliyle aynı
 * gerekçe: `crcCatalogue` ayrıca doğrulanmış, bu dosyanın test ettiği şey
 * BAYT SINIRLARI (offset/uzunluk), CRC algoritmasının kendisi değil.
 */

import { createBoundedDelimiterExtractor } from '@/protocol-core/framing/delimiterFraming';
import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';
import type { FrameExtractor } from '@/protocol-core/framing/types';

export const HDLC_SYNC_FLAG = 0x7e;

export const hdlcSyncExtractor: FrameExtractor = createBoundedDelimiterExtractor({
  method: 'start-end-delimiter',
  startSequence: [HDLC_SYNC_FLAG],
  endSequence: [HDLC_SYNC_FLAG],
});

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

/** noUncheckedIndexedAccess guard — bayt dizisi erişimi bu guard'dan geçer (iec104.ts `byteAt` emsali). */
export function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

const FRAME_TYPE_MASK = 0x03;
const FRAME_TYPE_S_VALUE = 0x01;
const FRAME_TYPE_U_VALUE = 0x03;
const POLL_FINAL_BIT = 0x10;
const S_TYPE_MASK = 0x0c;

export type HdlcFrameFormat = 'i-format' | 's-format' | 'u-format';

/** RFC/ISO adları — RR/REJ/RNR/SREJ, S-frame'in dört standart alt-türü. */
const S_TYPE_NAMES: Readonly<Record<number, string>> = {
  0: 'RR (Receive Ready)',
  1: 'REJ (Reject)',
  2: 'RNR (Receive Not Ready)',
  3: 'SREJ (Selective Reject)',
};

export function classifyControlByte(control: number): HdlcFrameFormat {
  if ((control & FRAME_TYPE_MASK) === FRAME_TYPE_U_VALUE) return 'u-format';
  if ((control & FRAME_TYPE_MASK) === FRAME_TYPE_S_VALUE) return 's-format';
  return 'i-format';
}

export interface HdlcControlFields {
  readonly format: HdlcFrameFormat;
  readonly pollFinal: boolean;
  readonly sendSequenceNumber?: number;
  readonly receiveSequenceNumber?: number;
  readonly supervisoryType?: string;
}

/** Basık modda N(S)/N(R) 3-bit (0-7) — genişletilmiş (modulo-128) mod bu dalgada YOK (dosya başı). */
export function decodeControlByte(control: number): HdlcControlFields {
  const format = classifyControlByte(control);
  const pollFinal = (control & POLL_FINAL_BIT) !== 0;
  if (format === 'i-format') {
    return { format, pollFinal, sendSequenceNumber: (control >> 1) & 0x07, receiveSequenceNumber: (control >> 5) & 0x07 };
  }
  if (format === 's-format') {
    const sType = (control & S_TYPE_MASK) >> 2;
    return { format, pollFinal, receiveSequenceNumber: (control >> 5) & 0x07, supervisoryType: S_TYPE_NAMES[sType] ?? `Unknown (${sType})` };
  }
  return { format, pollFinal };
}

export interface HdlcFcsResult {
  readonly received: number;
  readonly calculated: number;
  readonly valid: boolean;
}

/** `fcsBytes` tam 2 bayt olmalı (çağıran doğrular) — tel sırası little-endian (bacnetmstp.ts:358 emsali). */
export function validateHdlcFcs(coveredBytes: Uint8Array, fcsBytes: Uint8Array): HdlcFcsResult {
  const received = byteAt(fcsBytes, 0) | (byteAt(fcsBytes, 1) << 8);
  const calculated = Number(computeNamedCrc(coveredBytes, 'CRC16_X25'));
  return { received, calculated, valid: received === calculated };
}

/**
 * Gerçek encoder — hem `ProtocolPlugin.encoder`i besler hem örnek/test
 * çerçevelerini kurar (SLIP/COBS/PPP'nin `encodeSlip`/`encodeHdlcFlagFrame`
 * deseniyle aynı ikili rol). Girdi: Address+Control+Information (mantıksal,
 * kaçışsız) baytları. FCS motorun KENDİSİYLE hesaplanır — bkz. dosya başı.
 */
export function encodeHdlcSyncFrame(addressControlInformation: Uint8Array): Uint8Array {
  const fcs = Number(computeNamedCrc(addressControlInformation, 'CRC16_X25'));
  const framed = new Uint8Array(addressControlInformation.length + 4);
  framed[0] = HDLC_SYNC_FLAG;
  framed.set(addressControlInformation, 1);
  framed[addressControlInformation.length + 1] = fcs & 0xff;
  framed[addressControlInformation.length + 2] = (fcs >> 8) & 0xff;
  framed[addressControlInformation.length + 3] = HDLC_SYNC_FLAG;
  return framed;
}

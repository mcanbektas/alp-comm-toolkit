/**
 * CAN çerçeve çekirdeği — CAN 2.0A/2.0B, CAN FD ve J1939'un ORTAK beyni
 * (modbusPdu.ts'in bu dalgadaki karşılığı).
 *
 * Spec §3.4 dört CAN varyantını da aynı identifier modeline bağlıyor; bu yüzden
 * identifier çözümü, DLC eşlemesi ve payload alanı üretimi burada TEK yerde
 * yaşar. Varyant dosyaları (canClassic/canFd/canXl) yalnız kendi bayrak ve
 * uzunluk kurallarını ekler; J1939 de aynı identifier çözümünün üstüne oturur.
 *
 * ── GİRDİ DÜZENİ: SocketCAN `struct can_frame` / `struct canfd_frame` ────────
 *
 * `ProtocolParser.parse(data: Uint8Array)` tek bir bayt dizisi alır, oysa bir
 * CAN çerçevesinin ANLAMI identifier'ındadır — dolayısıyla identifier'ı taşıyan
 * bir bayt düzeni seçmek ZORUNLUYDU. Seçim Linux'un SocketCAN düzeni:
 *
 *   struct can_frame   : can_id(4, little-endian) | dlc(1) | pad | res0 |
 *                        len8_dlc(1) | data[8]                    → 16 bayt
 *   struct canfd_frame : can_id(4, little-endian) | len(1) | flags(1) |
 *                        res0 | res1 | data[64]                   → 72 bayt
 *
 * Neden uydurma bir düzen değil: bu düzen gerçek araçların (candump, SocketCAN
 * köprüleri, USB-CAN adaptörleri) ÜRETTİĞİ düzendir — spec §24 de log kaynağı
 * olarak "Candump import, USB-CAN bridge" sayıyor. Kendi düzenimizi uydursaydık
 * kullanıcının elindeki hiçbir kayıt doğrudan yapıştırılamazdı.
 *
 * Neden HAM TEL BİTLERİ (SOF / bit stuffing / CRC-15 / ACK) değil: spec o
 * çözümü desteklemiyor — CRC polinomunu ve stuffing kuralının bit sayısını
 * HİÇ vermiyor, üstelik §17.2 çerçeve uzunluğunu `47 + 8 × DLC` YAKLAŞIK
 * formülüyle veriyor. Bit-tam yeniden kurulum beklenseydi uzunluk tahmin
 * edilmez, sayılırdı. Ayrıca hiçbir CAN denetleyicisi ham tel bitlerini
 * uygulamaya vermez. Spec'in decoder alan listesindeki "CRC state" ve
 * "ACK state" bu yüzden ÇERÇEVE İÇİNDEN değil, adaptör metadata'sından gelir;
 * SocketCAN kaydında böyle bir alan olmadığı için burada da üretilmez.
 *
 * TUZAK — LITTLE-ENDIAN IDENTIFIER: `can_id` ana makine sırasındadır, yani
 * x86/ARM'de LITTLE-ENDIAN. Big-endian okunursa 0x18F00401 çerçevesi
 * 0x0104F098 olarak çözülür ve PGN tamamen yanlış çıkar. Bu düzenin güzel yan
 * etkisi: J1939'un bütün alanları temiz bayt sınırlarına düşer (SA=bayt 0,
 * PS=bayt 1, PF=bayt 2, Priority/DP/R=bayt 3) — bkz. `j1939.ts`.
 *
 * TUZAK — CAN ID ≠ NODE ADRESİ: spec bunu üç kez tekrarlıyor. Identifier
 * burada yalnız öncelik ve içerik göstergesidir; adres kavramı ancak üst
 * katmanda (J1939 → Source Address) modellenir. Bu dosya hiçbir yerde
 * identifier'ı "adres" diye adlandırmaz.
 */

import type { ParsedField } from '@/protocol-core/types';

/** `can_id` alanı 4 bayt, ana makine sırası (little-endian). */
const CAN_ID_LENGTH = 4;
const CAN_ID_OFFSET = 0;
/**
 * EFF/RTR/ERR bayrakları `can_id`in 29-31. bitlerindedir; alan LITTLE-ENDIAN
 * olduğu için o bitler dördüncü bayta düşer.
 */
const CAN_FLAG_BYTE_OFFSET = 3;
/** Klasik çerçevede DLC, FD çerçevesinde gerçek uzunluk — ikisi de 4. baytta. */
const CAN_LENGTH_OFFSET = 4;
const SINGLE_BYTE_FIELD_LENGTH = 1;

/** `struct can_frame`/`struct canfd_frame` başlığı: id + len + üç bayt (pad/flags/res). */
export const CAN_HEADER_LENGTH = 8;
/** `struct can_frame` sabit boyu: başlık + data[8]. */
export const CAN_CLASSIC_FRAME_LENGTH = 16;
/** `struct canfd_frame` sabit boyu: başlık + data[64]. */
export const CAN_FD_FRAME_LENGTH = 72;

export const CAN_CLASSIC_MAX_PAYLOAD = 8;
export const CAN_FD_MAX_PAYLOAD = 64;

/**
 * SocketCAN bayrakları `can_id`in üst bitlerinde taşınır. RTR ile iki maske
 * DIŞA AÇIK: `canClassic.ts`in encoder'ı çözücüyle AYNI bit tanımlarını
 * kullanmak zorunda, ikinci bir kopya ayrışmanın davetiyesi olurdu.
 */
const CAN_EFF_FLAG = 0x80000000;
export const CAN_RTR_FLAG = 0x40000000;
const CAN_ERR_FLAG = 0x20000000;
/** Base format 11 bit, extended format 29 bit. */
export const CAN_SFF_MASK = 0x000007ff;
export const CAN_EFF_MASK = 0x1fffffff;

/** `canfd_frame.flags` bitleri. FDF, çerçevenin CAN FD olduğunu bildirir. */
const CANFD_BRS_FLAG = 0x01;
const CANFD_ESI_FLAG = 0x02;
const CANFD_FDF_FLAG = 0x04;

const HEX_RADIX = 16;

/**
 * Uyarı ve özet dizgeleri ÇEVİRİ ANAHTARIDIR (CLAUDE.md): görünen hiçbir metin
 * koda gömülmez. Anahtarlar tam literal yazılır — şablonla üretilseydi ne grep
 * ile bulunur ne de sözlükten düşünce fark edilirdi. Hiçbirinde yer tutucu yok;
 * sayılar `summaryParams` ve `details` üzerinden ayrı taşınır.
 */
export const WARN_TRUNCATED_PAYLOAD = 'protocol.can.frame.warning.truncatedPayload';
export const WARN_TRAILING_BYTES = 'protocol.can.frame.warning.trailingBytes';
export const WARN_ERROR_FLAG_SET = 'protocol.can.frame.warning.errorFlagSet';
export const WARN_REMOTE_WITH_PAYLOAD = 'protocol.can.frame.warning.remoteWithPayload';
export const WARN_EXTENDED_ON_BASE_PAGE = 'protocol.can.frame.warning.extendedOnBasePage';
export const WARN_BASE_ON_EXTENDED_PAGE = 'protocol.can.frame.warning.baseOnExtendedPage';
export const WARN_NON_CANONICAL_FD_LENGTH = 'protocol.can.frame.warning.nonCanonicalFdLength';
export const WARN_MISSING_FDF_FLAG = 'protocol.can.frame.warning.missingFdfFlag';
export const WARN_HIGHER_LAYER_CANDIDATES = 'protocol.can.frame.warning.higherLayerCandidates';

/**
 * CAN FD'nin DLC KODU → PAYLOAD UZUNLUĞU tablosu.
 *
 * ⚠️ KAYNAK UYARISI: bu tablo SPEC'TE YOKTUR. Spec yalnız hedef uzunluk kümesini
 * sayıyor ("12, 16, 20, 24, 32, 48, 64 byte uzunluklarını doğru göstermelidir")
 * ve eşlemeyi yapılması gereken iş olarak bırakıyor; kod↔uzunluk karşılıkları
 * ISO 11898-1'dendir. Spec §43'te bunu doğrulayacak bir fixture da yok — bu
 * yüzden tablo tek yerde durur ve testi kümenin spec'le birebir aynı olduğunu
 * ayrıca doğrular.
 *
 * 0-8 arası kod doğrudan bayt sayısıdır; kırılma 9'dan sonra başlar.
 */
export const CAN_FD_DLC_LENGTHS: readonly number[] = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 16, 20, 24, 32, 48, 64,
];

/** SocketCAN `canfd_frame.len` GERÇEK uzunluktur; DLC kodu gösterim için geri türetilir. */
export function dlcForLength(length: number): number | undefined {
  const index = CAN_FD_DLC_LENGTHS.indexOf(length);
  return index === -1 ? undefined : index;
}

export function lengthForDlc(dlc: number): number | undefined {
  return CAN_FD_DLC_LENGTHS[dlc];
}

/** Çözümlenmiş identifier — hem CAN varyantları hem J1939 bunu kullanır. */
export interface CanIdentity {
  /** Bayrak bitleri atılmış saf identifier (11 ya da 29 bit). */
  readonly id: number;
  readonly extended: boolean;
  readonly remote: boolean;
  readonly errorFrame: boolean;
  /** Ham 32-bit alan, bayraklar dahil — hata bildirimlerinde birebir gösterilir. */
  readonly rawId: number;
}

/**
 * `can_id` alanını çözer. Bayrak bitleri identifier'ın PARÇASI DEĞİLDİR:
 * ayrılmadan maskelenirse extended bir çerçevenin identifier'ı 0x98F00401 gibi
 * okunur ve J1939 priority'si 4 çıkar (doğrusu 6).
 */
export function decodeCanId(rawId: number): CanIdentity {
  // `>>> 0`: bit işlemleri JS'te işaretli 32-bit üretir, 0x80000000 negatife döner.
  const unsigned = rawId >>> 0;
  const extended = (unsigned & CAN_EFF_FLAG) !== 0;
  return {
    id: extended ? unsigned & CAN_EFF_MASK : unsigned & CAN_SFF_MASK,
    extended,
    remote: (unsigned & CAN_RTR_FLAG) !== 0,
    errorFrame: (unsigned & CAN_ERR_FLAG) !== 0,
    rawId: unsigned,
  };
}

/** `noUncheckedIndexedAccess`: sınır kontrolü yapılmış olsa da eleman `number | undefined`. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

/** 32-bit little-endian okuma — SocketCAN alanları ana makine sırasındadır. */
export function readUint32Le(data: Uint8Array, offset: number): number {
  const value =
    byteAt(data, offset) |
    (byteAt(data, offset + 1) << 8) |
    (byteAt(data, offset + 2) << 16) |
    (byteAt(data, offset + 3) << 24);
  // `>>> 0`: bit işlemleri işaretli 32-bit üretir, üst bit set ise negatife döner.
  return value >>> 0;
}

/** 16-bit little-endian okuma — CAN XL'in `len` alanı. */
export function readUint16Le(data: Uint8Array, offset: number): number {
  return byteAt(data, offset) | (byteAt(data, offset + 1) << 8);
}

export function formatHex(value: number, digits: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(digits, '0')}`;
}

/** Biriktirici durum; `decodeSocketCanFrame` dışına sızmaz. */
interface CanDecodeState {
  readonly fields: ParsedField[];
  readonly warnings: string[];
  readonly params: Record<string, string>;
}

function addWarning(state: CanDecodeState, key: string): void {
  // Aynı uyarı birden çok alandan tetiklenebilir; kullanıcıya bir kez gösterilir.
  if (!state.warnings.includes(key)) {
    state.warnings.push(key);
  }
}

/**
 * Identifier alanı. Bayraklar identifier'ın kendisiyle AYNI dört baytta durduğu
 * için ayrı alan olarak değil, `physicalValue` içinde biçim etiketiyle gösterilir
 * — byte-viewer'da aynı baytları iki kez vurgulamak kullanıcıyı yanıltırdı.
 */
function buildIdentifierField(data: Uint8Array, identity: CanIdentity): ParsedField {
  return {
    id: 'can-id',
    name: 'CAN ID',
    offset: CAN_ID_OFFSET,
    length: CAN_ID_LENGTH,
    rawBytes: data.slice(CAN_ID_OFFSET, CAN_ID_OFFSET + CAN_ID_LENGTH),
    rawValue: identity.id,
    // Protokol terimi — veridir, çevrilmez (spec'in "Base / 11-bit" gösterimi).
    physicalValue: identity.extended ? 'Extended / 29-bit' : 'Base / 11-bit',
    valid: true,
    warnings: [],
  };
}

/**
 * RTR/IDE bayrakları için alan. Ofset 3'tür, identifier'ın tamamı DEĞİL:
 * SocketCAN bu bayrakları `can_id`in 29-31. bitlerinde taşır ve alan
 * little-endian olduğu için o bitler DÖRDÜNCÜ bayta (indeks 3) düşer.
 *
 * Neden önemli: bayrak alanlarına identifier'ın dört baytını verirsek
 * byte-viewer'da `can-id` bölgesini TAMAMEN örterler (bölge adaptöründe çakışan
 * aralıklarda listede sonra gelen kazanır) ve kullanıcı CAN ID satırına
 * tıkladığında hiçbir bayt vurgulanmaz. Ölçüldü: dalga 3'ün tarayıcı turunda
 * identifier'ın rengini IDE alanı almıştı.
 */
function buildFlagField(
  data: Uint8Array,
  id: string,
  name: string,
  active: boolean,
  activeLabel: string,
  inactiveLabel: string,
): ParsedField {
  return {
    id,
    name,
    offset: CAN_FLAG_BYTE_OFFSET,
    length: SINGLE_BYTE_FIELD_LENGTH,
    rawBytes: data.slice(CAN_FLAG_BYTE_OFFSET, CAN_FLAG_BYTE_OFFSET + SINGLE_BYTE_FIELD_LENGTH),
    rawValue: active ? 1 : 0,
    physicalValue: active ? activeLabel : inactiveLabel,
    valid: true,
    warnings: [],
  };
}

export type CanFrameKind = 'classic' | 'fd';

export interface SocketCanDecodeOptions {
  readonly kind: CanFrameKind;
  /** Sayfanın beklediği identifier biçimi; uyuşmazlık HATA değil UYARIDIR. */
  readonly expectedFormat?: 'base' | 'extended';
  /** true ise 29-bit identifier için üst katman adayları uyarısı basılır (CAN 2.0B sayfası). */
  readonly suggestHigherLayers?: boolean;
}

export interface SocketCanDecodeResult {
  readonly fields: readonly ParsedField[];
  readonly warnings: readonly string[];
  readonly summaryKey: string;
  readonly summaryParams: Record<string, string>;
  readonly identity: CanIdentity;
  /** Gerçekten çözülebilen payload uzunluğu (bildirilen uzunluk kısaltılmış olabilir). */
  readonly payloadLength: number;
}

const SUMMARY_CLASSIC_DATA = 'protocol.can.frame.summary.classicData';
const SUMMARY_CLASSIC_REMOTE = 'protocol.can.frame.summary.classicRemote';
const SUMMARY_FD_DATA = 'protocol.can.frame.summary.fdData';

/**
 * SocketCAN klasik/FD çerçevesinin ORTAK alanlarını çözer: identifier, bayraklar,
 * uzunluk ve payload. Fırlatmaz — kısa/bozuk çerçeve uyarıya çevrilir ve kısmi
 * alan listesi döner (spec §47 "hatalı veride uygulamayı çökertme").
 *
 * Çağıran, uzunluk sınırlarını KENDİ kontrol etmiş olmalıdır; buradaki iş yalnız
 * alan üretimi.
 */
export function decodeSocketCanFrame(
  data: Uint8Array,
  options: SocketCanDecodeOptions,
): SocketCanDecodeResult {
  const state: CanDecodeState = { fields: [], warnings: [], params: {} };

  const identity = decodeCanId(readUint32Le(data, CAN_ID_OFFSET));
  state.params.canId = formatHex(identity.id, identity.extended ? 8 : 3);
  state.params.format = identity.extended ? 'extended' : 'base';

  state.fields.push(buildIdentifierField(data, identity));

  if (identity.errorFrame) {
    // Error frame bir VERİ çerçevesi değildir; alanları normal çözmek yanıltıcı
    // olurdu ama gizlemek de yanlış — uyarı basılır, çözüm sürer.
    addWarning(state, WARN_ERROR_FLAG_SET);
  }

  if (options.expectedFormat === 'base' && identity.extended) {
    addWarning(state, WARN_EXTENDED_ON_BASE_PAGE);
  }
  if (options.expectedFormat === 'extended' && !identity.extended) {
    addWarning(state, WARN_BASE_ON_EXTENDED_PAGE);
  }
  if (options.suggestHigherLayers === true && identity.extended) {
    // Spec: "29-bit ID tek başına protokol kanıtı değildir" — J1939, NMEA 2000,
    // ISO-TP Extended, CANopen Extended, OEM Custom hepsi aday.
    addWarning(state, WARN_HIGHER_LAYER_CANDIDATES);
  }

  const declaredLength = byteAt(data, CAN_LENGTH_OFFSET);
  const maxPayload =
    options.kind === 'classic' ? CAN_CLASSIC_MAX_PAYLOAD : CAN_FD_MAX_PAYLOAD;

  const lengthField: ParsedField = {
    id: options.kind === 'classic' ? 'dlc' : 'payload-length',
    name: options.kind === 'classic' ? 'DLC' : 'Payload Length',
    offset: CAN_LENGTH_OFFSET,
    length: SINGLE_BYTE_FIELD_LENGTH,
    rawBytes: data.slice(CAN_LENGTH_OFFSET, CAN_LENGTH_OFFSET + SINGLE_BYTE_FIELD_LENGTH),
    rawValue: declaredLength,
    valid: true,
    warnings: [],
  };

  if (options.kind === 'fd') {
    // FD'de alan GERÇEK uzunluktur; DLC kodu gösterim için geri türetilir.
    // Kanonik olmayan uzunluk (ör. 13) gerçek bir FD çerçevesinde olamaz.
    const dlc = dlcForLength(declaredLength);
    if (dlc === undefined) {
      lengthField.valid = false;
      lengthField.warnings.push(WARN_NON_CANONICAL_FD_LENGTH);
      addWarning(state, WARN_NON_CANONICAL_FD_LENGTH);
    } else {
      // `unit` BİLEREK yazılmıyor: burada fiziksel değer bir DLC KODUDUR, bayt
      // sayısı değil. "9 B" basmak kodu uzunluk sanmaya davet ederdi — oysa
      // kod 9 tam olarak 12 bayt demektir. Etiket protokol terimidir, çevrilmez.
      lengthField.physicalValue = `DLC ${String(dlc)}`;
      state.params.dlc = String(dlc);
    }
  } else {
    lengthField.physicalValue = Math.min(declaredLength, maxPayload);
    lengthField.unit = 'B';
  }
  state.params.declaredLength = String(declaredLength);
  state.fields.push(lengthField);

  state.fields.push(
    buildFlagField(data, 'rtr', 'RTR', identity.remote, 'Remote Frame', 'Data Frame'),
  );
  state.fields.push(
    buildFlagField(data, 'ide', 'IDE', identity.extended, 'Extended', 'Base'),
  );

  if (options.kind === 'fd') {
    const flags = byteAt(data, 5);
    const fdFlagBytes = data.slice(5, 6);
    const pushFdFlag = (id: string, name: string, mask: number, on: string, off: string): void => {
      state.fields.push({
        id,
        name,
        offset: 5,
        length: SINGLE_BYTE_FIELD_LENGTH,
        rawBytes: fdFlagBytes,
        rawValue: (flags & mask) === 0 ? 0 : 1,
        physicalValue: (flags & mask) === 0 ? off : on,
        valid: true,
        warnings: [],
      });
    };
    // Protokol terimleri veridir, çevrilmez (spec'in "ESI: Error Active" gösterimi).
    pushFdFlag('fdf', 'FDF', CANFD_FDF_FLAG, 'CAN FD Frame', 'Classical Frame');
    pushFdFlag('brs', 'BRS', CANFD_BRS_FLAG, 'Bit Rate Switched', 'Single Bit Rate');
    pushFdFlag('esi', 'ESI', CANFD_ESI_FLAG, 'Error Passive', 'Error Active');
    if ((flags & CANFD_FDF_FLAG) === 0) {
      // FDF'siz bir canfd_frame tutarsızdır: ya kayıt klasik çerçeveden
      // dönüştürülmüş ya da bayrak baytı kaybolmuş.
      addWarning(state, WARN_MISSING_FDF_FLAG);
    }
  }

  // Payload: bildirilen uzunluk elde olandan büyükse kısaltılır ve uyarılır.
  const availableAfterHeader = Math.max(0, data.length - CAN_HEADER_LENGTH);
  const cappedLength = Math.min(declaredLength, maxPayload);
  const payloadLength = Math.min(cappedLength, availableAfterHeader);
  if (payloadLength < cappedLength) {
    addWarning(state, WARN_TRUNCATED_PAYLOAD);
  }

  if (identity.remote && payloadLength > 0) {
    // Remote frame veri TAŞIMAZ; taşıyorsa kayıt bozuk ya da adaptör dolgu bırakmış.
    addWarning(state, WARN_REMOTE_WITH_PAYLOAD);
  }

  if (payloadLength > 0) {
    const payloadBytes = data.slice(CAN_HEADER_LENGTH, CAN_HEADER_LENGTH + payloadLength);
    state.fields.push({
      id: 'data',
      name: 'Data',
      offset: CAN_HEADER_LENGTH,
      length: payloadLength,
      rawBytes: payloadBytes,
      valid: true,
      warnings: [],
      unit: 'B',
    });
  }

  // `struct` sabit boyludur: bildirilen uzunluktan sonrası DOLGUDUR, uyarı
  // konusu değil. Ancak struct'ın kendi boyunu da aşan bayt varsa kayıt bozuktur.
  const structLength =
    options.kind === 'classic' ? CAN_CLASSIC_FRAME_LENGTH : CAN_FD_FRAME_LENGTH;
  if (data.length > structLength) {
    addWarning(state, WARN_TRAILING_BYTES);
  }

  state.params.payloadLength = String(payloadLength);

  let summaryKey: string;
  if (options.kind === 'fd') {
    summaryKey = SUMMARY_FD_DATA;
  } else if (identity.remote) {
    summaryKey = SUMMARY_CLASSIC_REMOTE;
  } else {
    summaryKey = SUMMARY_CLASSIC_DATA;
  }

  return {
    fields: state.fields,
    warnings: state.warnings,
    summaryKey,
    summaryParams: state.params,
    identity,
    payloadLength,
  };
}

/**
 * Spec §17.2'nin YAKLAŞIK çerçeve uzunluğu. "Yaklaşık" spec'in kendi sözcüğü:
 * stuff bitleri veriye bağlı olduğu için tam sayı ancak tel üzerinde bilinir.
 *
 *   Standard: 47 + 8 × DLC     Extended: 67 + 8 × DLC
 */
export function approximateFrameBits(payloadLength: number, extended: boolean): number {
  const base = extended ? 67 : 47;
  return base + 8 * payloadLength;
}

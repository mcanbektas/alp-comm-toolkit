/**
 * AS-Interface (AS-i, IEC 62026-2 / EN 50295) — sensör-aktüatör seviyesinde,
 * veriyi ve gücü aynı iki telden taşıyan master/slave ağı. Master bütün
 * slave'leri sırayla yoklar: master çağrısı → duraklama → slave yanıtı →
 * duraklama (31 slave ile ~5 ms çevrim).
 *
 * Faz 10, dalga 13g. `classic-fieldbus` ailesinin üçüncü kaydı.
 *
 * ── HANGİ NESİL ÇÖZÜLÜYOR: **KLASİK AS-i**, ASi-5 DEĞİL ────────────────────
 * Spec özeti (`docs/spec/ozet/03-endustriyel.md:119-123`) "İki nesil AYRI:
 * Classic AS-i, ASi-5 (aynı başlık, farklı decoder)" diyor. Bu motor YALNIZ
 * KLASİK AS-i'yi çözer: 14 bitlik master çağrısı + 7 bitlik slave yanıtı.
 * **ASi-5 KAPSAM DIŞIDIR** ve bu bir kaynak kararıdır: ASi-5 OFDM tabanlı,
 * tamamen farklı bir fiziksel/veri bağı katmanıdır ve tel biçimi AS-International
 * Association üyeliği arkasındadır — kamuya açık hiçbir alan tablosu bulunamadı.
 * Karıştırmamak için her çözümde `WARN_CLASSIC_ASI_ONLY` basılır.
 *
 * ── KAYNAK: İKİ BAĞIMSIZ, KAMUYA AÇIK KAYNAK — ÇAPRAZ TEYİTLİ ─────────────
 * AS-Interface Complete Specification ücretlidir ve bu depoda YOKTUR. Alan
 * yerleşimi İKİ bağımsız kaynaktan teyitle alındı (ikisine de bu oturumda
 * gerçekten erişildi; KOD KOPYALANMADI):
 *   A = **ASI4U / ASI4U-E / ASI4U-F datasheet** (Integrated Device Technology,
 *       2016) — AS-International Association'ın KENDİ sitesinde yayımlanıyor
 *       (`as-interface.net/media/sudk4ukd/3005.pdf`) ve "fully compliant with
 *       the AS-Interface Complete Specification V3.0" diyor. **Table 3.2
 *       "ASI4U Master Calls and Related Slave Responses"** bütün master
 *       çağrılarının bit tablosunu, ardındaki şema da (CB,I4,I3)×(I2,I1,I0)
 *       kod haritasını verir. Parite kuralını da harfi harfine tanımlar
 *       (aşağıda).
 *   S = **Sense Eletrônica, "Rede AS-Interface — Manual de Instruções"**
 *       (3000000093A, Portekizce) §5 "Estrutura do Telegrama": bağımsız bir
 *       üreticinin kılavuzu, çerçeveyi BİREBİR aynı sırayla veriyor —
 *       master `ST SB A4 A3 A2 A1 A0 I4 I3 I2 I1 I0 PB EB`, slave
 *       `ST I3 I2 I1 I0 PB EB`; ST hep "0", EB hep "1", SB=0 veri/parametre,
 *       SB=1 komut; SB=0 ∧ I4=0 → 4 veri biti, SB=0 ∧ I4=1 → 4 parametre biti.
 *       https://www.sense.com.br/arquivos/produtos/arq0/3000000093A.pdf
 * ÜÇÜNCÜ, BAĞIMSIZ TEYİT: **Pepperl+Fuchs "The AS-interface"** kitapçığı
 * (RS Components arşivi) — "master telegram is always 14 bits ... slave
 * response is always 7 bits", "Data protection: 1 bit parity", APM/Manchester.
 * https://docs.rs-online.com/ba88/0900766b8002a103.pdf
 *
 * ── PARİTE GERÇEKTEN DOĞRULANIR (sercos/CC-Link IE'den FARKI) ─────────────
 * `sercosIii.ts`in CRC32'si ve `ccLinkIe.ts`in HEC'i "gösterilir ama
 * doğrulanmaz"dı, çünkü ALGORİTMA PARAMETRELERİ tek kaynaklı bile değildi.
 * Burada durum farklı: A kuralı harfi harfine yazıyor — *"The sum of all
 * information bits in master requests or slave responses (excluding start and
 * end bits, including the parity bit) must be even"*. Yani parite CB + A4..A0
 * + I4..I0 + PB üzerinden ÇİFT olmalı (slave'de I3..I0 + PB). Kural açık ve
 * tek anlamlı olduğu için bu motor pariteyi HESAPLAR ve uyuşmazlıkta HATA
 * BASAR — protokolün kendi tanımladığı doğrulamayı atlamak, `ethercat.ts`
 * ölçütüne göre `ready` olmayı engellerdi.
 *
 * ── GİRDİ: BİT DEĞİL BAYT — APM/MANCHESTER GÖRÜLMEZ ───────────────────────
 * (`dali.ts`in "Manchester decoder'a hiç sızmaz" gerekçesinin aynısı.) AS-i
 * hatta alternating pulse modulation (Manchester-II'nin AS-i'ye özgü
 * uygulaması) ile sürülür; bu kodlama hiçbir AS-i alıcısında uygulamaya
 * "bit akışı" olarak çıkmaz. Girdi ÇÖZÜLMÜŞ bitlerdir ve şu sözleşmeyle
 * verilir:
 *   • **2 bayt → master çağrısı**: 14 bit, 16 bitlik big-endian değerin SAĞA
 *     DAYALI hâli (bit 13..0). Üstteki 2 bit dolgudur ve sıfır olmalıdır.
 *   • **1 bayt → slave yanıtı**: 7 bit, baytın sağa dayalı hâli (bit 6..0).
 *     Bit 7 dolgudur.
 *   • Başka uzunluk → `ParseFailure` (sözleşme dışı girdi).
 *
 * ── SEÇİM BİTİ (I3) — İKİ KAYNAK POLARİTEDE ANLAŞMIYOR ────────────────────
 * Genişletilmiş adreslemede (A/B slave, 62 cihaz) I3 biti veri değil SEÇİM
 * bilgisi taşır. Ama A'nın kendi içinde iki gösterim çelişiyor: Table 3.2
 * Data Exchange satırının I3 hücresinde `D3 / ~Sel` yazarken, hemen
 * ardındaki şemanın satır başlığı `I3=Sel` diyor. Yani bitin İÇERİĞİ
 * (seçim bilgisi) teyitli, POLARİTESİ değil. Bu yüzden I3 ADLANDIRILIR ama
 * "A-slave mi B-slave mi" İDDİA EDİLMEZ; `WARN_SELECT_BIT_POLARITY_UNCONFIRMED`
 * taşır (`sercosIii.ts`in telgraf numarası genişliği çakışmasının aynı
 * deseni). Ayrıca bir çerçeve tek başına slave'in standart mı A/B mi
 * olduğunu SÖYLEMEZ.
 *
 * ── decodeOptions: AÇILMADI, GEREKÇESİ ─────────────────────────────────────
 *  1. "Master çağrısı mı slave yanıtı mı" → UZUNLUKTAN çıkar (2 bayt / 1
 *     bayt). Kanal gereksiz olurdu (12f'nin WebSocket MASK-biti dersi).
 *  2. "Bu yanıt hangi çağrıya ait" → bir `select` alanına sığar gibi görünür
 *     ama YANLIŞ olurdu: yanıtın anlamı ÖNCEKİ çerçeveden gelir, kullanıcının
 *     seçiminden değil. Çok çerçeveli korelasyon parser'ın değil analyzer'ın
 *     işidir (`rtp.ts`/`dns.ts` emsali) — yanıt ham bitleriyle basılır ve
 *     bağımlılık uyarıyla söylenir.
 *
 * ── STATUS: 'partial' — GEREKÇE (iec-61850 GOOSE-only emsali) ─────────────
 * Klasik AS-i çerçevesinin HER BİTİ adlandırılıp çözülür: başlangıç biti,
 * kontrol biti, 5 bitlik adres, bilgi alanının çağrı tipine göre kırılımı
 * (veri / parametre / yeni adres / komut), parite ve bitiş biti. Protokolün
 * kendi tanımladığı doğrulama (çift parite) YAPILIR — yani KLASİK AS-i
 * tarafı `ready` ölçütünü karşılar. Rozet yine de `partial`, çünkü KAYDIN
 * KENDİSİ İKİ NESİL VAAT EDİYOR: katalog özeti "classic AS-i and the faster
 * ASi-5 generation" diyor ve araç listesinde ayrı bir "ASi-5" maddesi var.
 * ASi-5 yukarıdaki kaynak gerekçesiyle BİLİNÇLİ eksik olduğu için rozet
 * `ready` değil `partial` — `iec-61850`in "MMS ve SCL yok" kararının aynısı.
 *
 * ── KAPSAM DIŞI (dosya başında AÇIKÇA) ────────────────────────────────────
 *  • **ASi-5**: yukarıdaki gerekçe.
 *  • **AS-i Safety at Work (güvenlik telgrafları)**: 8 telgraflık kod dizisi
 *    tek çerçeveden çözülemez, ayrıca kod tablosu cihaza özeldir.
 *  • **Analog profil (7.3/7.4) veri aktarımı**: birden çok çevrime yayılan
 *    aktarım; çok çerçeveli analiz, `ethercat.ts`in "analyzer sınırı" emsali.
 *  • **Status/IO-Configuration/ID-Code bitlerinin ANLAMI**: yanıt bitleri
 *    çözülür ama S3..S0 / IO3..IO0 / ID3..ID0'ın anlamı profil tablosundan
 *    gelir — ikinci bir kaynakta teyit edilemedi, ADLANDIRILMADI.
 */

import { createRawFrame } from '@/protocol-core/types';
import type {
  ExampleFrame,
  FrameDirection,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolError,
  ProtocolErrorCode,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

/** Katalogdaki kayıt id'siyle birebir aynı olmalı — plugin bağı budur. */
const PROTOCOL_ID = 'as-interface';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'AS-Interface';

const MASTER_REQUEST_BYTES = 2;
const SLAVE_RESPONSE_BYTES = 1;
/** A ve S: master çağrısı 14 bit, slave yanıtı 7 bit. */
const MASTER_REQUEST_BITS = 14;
const SLAVE_RESPONSE_BITS = 7;

const ADDRESS_BITS = 5;
const INFORMATION_BITS = 5;
const RESPONSE_DATA_BITS = 4;
const MAX_SLAVE_ADDRESS = 31;
/** Broadcast (Reset) çağrısının adres alanı: A4..A0 = 11111 (A, Table 3.2). */
const BROADCAST_ADDRESS = 31;

export const ERROR_UNSUPPORTED_LENGTH = 'protocol.asInterface.error.unsupportedLength';
export const ERROR_FRAME_TOO_LONG = 'protocol.asInterface.error.frameTooLong';
export const ERROR_ABORTED = 'protocol.asInterface.error.aborted';
export const ERROR_START_BIT_NOT_ZERO = 'protocol.asInterface.error.startBitNotZero';
export const ERROR_PARITY_MISMATCH = 'protocol.asInterface.error.parityMismatch';

export const WARN_CLASSIC_ASI_ONLY = 'protocol.asInterface.warning.classicAsiOnly';
export const WARN_END_BIT_NOT_ONE = 'protocol.asInterface.warning.endBitNotOne';
export const WARN_PADDING_BITS_NOT_ZERO = 'protocol.asInterface.warning.paddingBitsNotZero';
export const WARN_SELECT_BIT_POLARITY_UNCONFIRMED =
  'protocol.asInterface.warning.selectBitPolarityUnconfirmed';
export const WARN_RESPONSE_MEANING_NEEDS_REQUEST =
  'protocol.asInterface.warning.responseMeaningNeedsRequest';
export const WARN_CALL_NOT_NAMED = 'protocol.asInterface.warning.callNotNamed';
export const WARN_ADDRESS_ZERO_IS_UNCONFIGURED =
  'protocol.asInterface.warning.addressZeroIsUnconfigured';

const SUMMARY_MASTER_REQUEST = 'protocol.asInterface.summary.masterRequest';
const SUMMARY_SLAVE_RESPONSE = 'protocol.asInterface.summary.slaveResponse';

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

class WarningSink {
  private readonly seen = new Set<string>();
  readonly warnings: ProtocolWarning[] = [];

  push(key: string): void {
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.warnings.push(toProtocolWarning(key));
  }
}

interface FailureInit {
  readonly code: ProtocolErrorCode;
  readonly message: string;
  readonly recoverable: boolean;
  readonly offset?: number;
  readonly length?: number;
  readonly details?: Record<string, unknown>;
}

function fail(init: FailureInit): ParseResult {
  const error: ProtocolError = { code: init.code, message: init.message };
  if (init.offset !== undefined) error.offset = init.offset;
  if (init.length !== undefined) error.length = init.length;
  if (init.details !== undefined) error.details = init.details;
  return { success: false, error, consumedBytes: 0, recoverable: init.recoverable };
}

export type AsInterfaceFrameMetadata = {
  kind: 'master-request' | 'slave-response';
  slaveAddress: number | undefined;
  callName: string | undefined;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface AsInterfaceParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

interface FieldInit {
  readonly id: string;
  readonly name: string;
  readonly offset: number;
  readonly length: number;
  readonly rawValue?: number | string;
  readonly physicalValue?: string;
  readonly valid?: boolean;
  readonly warnings?: readonly string[];
}

function pushField(fields: ParsedField[], data: Uint8Array, init: FieldInit): void {
  const field: ParsedField = {
    id: init.id,
    name: init.name,
    offset: init.offset,
    length: init.length,
    rawBytes: data.slice(init.offset, init.offset + init.length),
    valid: init.valid ?? true,
    warnings: init.warnings === undefined ? [] : [...init.warnings],
  };
  if (init.rawValue !== undefined) field.rawValue = init.rawValue;
  if (init.physicalValue !== undefined) field.physicalValue = init.physicalValue;
  fields.push(field);
}

/** `0b1010` gibi sabit genişlikli ikilik gösterim — bit alanları için. */
function toBinary(value: number, width: number): string {
  return `0b${value.toString(2).padStart(width, '0')}`;
}

/** A: "start ve end HARİÇ, parite biti DÂHİL bitlerin toplamı ÇİFT olmalı". */
function countOnes(value: number): number {
  let count = 0;
  let remaining = value;
  while (remaining !== 0) {
    count += remaining & 1;
    remaining >>>= 1;
  }
  return count;
}

/** Adlandırılmış master komutu (A Table 3.2 + ardındaki kod haritası). */
interface MasterCall {
  readonly mnemonic: string;
  readonly name: string;
}

/**
 * SB=1 iken bilgi alanının (I4..I0) çözümü. Anahtar: `I4` ve `I2 I1 I0`.
 * I3 seçim bitidir ve komutu BELİRLEMEZ (dosya başı: polarite teyitsiz).
 */
function lookupCommand(
  informationField: number,
  slaveAddress: number,
): MasterCall | undefined {
  const i4 = (informationField >>> 4) & 1;
  const i3 = (informationField >>> 3) & 1;
  const low = informationField & 0b111;

  if (i4 === 0) {
    // A Table 3.2 WID1: adres 00000 + CB=1 + I4=0 → I3..I0 ID kodudur, alt üç
    // bit SABİT DEĞİLDİR. DELA ise adres != 0 iken I2 I1 I0 = 000 ister.
    if (slaveAddress === 0) return { mnemonic: 'WID1', name: 'Write Extended ID Code_1' };
    if (low !== 0b000) return undefined;
    return { mnemonic: 'DELA', name: 'Delete Address' };
  }

  switch (low) {
    case 0b000:
      return { mnemonic: 'RDIO', name: 'Read I/O Configuration' };
    case 0b001:
      return { mnemonic: 'RDID', name: 'Read ID Code' };
    case 0b010:
      return { mnemonic: 'RID1', name: 'Read ID Code_1' };
    case 0b011:
      return { mnemonic: 'RID2', name: 'Read ID Code_2' };
    case 0b100:
      return { mnemonic: 'RES', name: 'Reset Slave' };
    case 0b101:
      // Şema: I3=0 → Broadcast, I3=1 → Enter Program Mode.
      if (i3 === 0 && slaveAddress === BROADCAST_ADDRESS) {
        return { mnemonic: 'BR01', name: 'Broadcast (Reset)' };
      }
      if (i3 === 1 && slaveAddress === 0) {
        return { mnemonic: 'PRGM', name: 'Enter Program Mode' };
      }
      return undefined;
    case 0b110:
      return { mnemonic: 'RDST', name: 'Read Status' };
    default:
      // 0b111 A'nın şemasında "reserved".
      return undefined;
  }
}

function decodeMasterRequest(
  data: Uint8Array,
  fields: ParsedField[],
  warnings: WarningSink,
  errors: ProtocolError[],
  summaryParams: Record<string, string>,
): { slaveAddress: number; callName: string | undefined } {
  const value = (byteAt(data, 0) << 8) | byteAt(data, 1);

  const padding = (value >>> MASTER_REQUEST_BITS) & 0b11;
  const startBit = (value >>> 13) & 1;
  const controlBit = (value >>> 12) & 1;
  const slaveAddress = (value >>> 7) & 0b11111;
  const informationField = (value >>> 2) & 0b11111;
  const parityBit = (value >>> 1) & 1;
  const endBit = value & 1;

  if (padding !== 0) warnings.push(WARN_PADDING_BITS_NOT_ZERO);
  pushField(fields, data, {
    id: 'padding-bits',
    name: 'Padding (bits 15-14)',
    offset: 0,
    length: 1,
    rawValue: padding,
    physicalValue: toBinary(padding, 2),
    valid: padding === 0,
    warnings: padding === 0 ? [] : [WARN_PADDING_BITS_NOT_ZERO],
  });

  pushField(fields, data, {
    id: 'start-bit',
    name: 'ST — Start Bit',
    offset: 0,
    length: 1,
    rawValue: startBit,
    physicalValue: startBit === 0 ? 'Valid (0)' : 'Invalid (must be 0)',
    valid: startBit === 0,
    warnings: startBit === 0 ? [] : [ERROR_START_BIT_NOT_ZERO],
  });
  if (startBit !== 0) {
    errors.push({
      code: 'start-delimiter-not-found',
      message: ERROR_START_BIT_NOT_ZERO,
      offset: 0,
      length: 1,
      details: { startBit },
    });
  }

  pushField(fields, data, {
    id: 'control-bit',
    name: 'SB — Control Bit',
    offset: 0,
    length: 1,
    rawValue: controlBit,
    physicalValue: controlBit === 0 ? 'Data / parameter transfer' : 'Command',
  });

  const addressWarnings = slaveAddress === 0 ? [WARN_ADDRESS_ZERO_IS_UNCONFIGURED] : [];
  if (slaveAddress === 0) warnings.push(WARN_ADDRESS_ZERO_IS_UNCONFIGURED);
  pushField(fields, data, {
    id: 'slave-address',
    name: 'A4-A0 — Slave Address',
    offset: 0,
    length: MASTER_REQUEST_BYTES,
    rawValue: slaveAddress,
    physicalValue: slaveAddress === 0 ? '0 (unconfigured slave)' : `${slaveAddress}`,
    warnings: addressWarnings,
  });
  summaryParams['address'] = `${slaveAddress}`;

  pushField(fields, data, {
    id: 'information-field',
    name: 'I4-I0 — Information Field',
    offset: 1,
    length: 1,
    rawValue: informationField,
    physicalValue: toBinary(informationField, INFORMATION_BITS),
  });

  let callName: string | undefined;
  const i4 = (informationField >>> 4) & 1;
  const i3 = (informationField >>> 3) & 1;
  const lowNibble = informationField & 0b1111;

  if (controlBit === 0 && slaveAddress === 0) {
    // Adres 0 + SB=0 → yeni adres bilgi alanında taşınır (A Table 3.2 ADRA).
    callName = 'Address Assignment';
    pushField(fields, data, {
      id: 'new-slave-address',
      name: 'A4-A0 — New Slave Address',
      offset: 1,
      length: 1,
      rawValue: informationField,
      physicalValue: `${informationField}`,
    });
  } else if (controlBit === 0 && i4 === 0) {
    callName = 'Data Exchange';
    pushField(fields, data, {
      id: 'output-data',
      name: 'D3-D0 — Output Data',
      offset: 1,
      length: 1,
      rawValue: lowNibble,
      physicalValue: toBinary(lowNibble, RESPONSE_DATA_BITS),
    });
    pushSelectBit(fields, data, i3);
    warnings.push(WARN_SELECT_BIT_POLARITY_UNCONFIRMED);
  } else if (controlBit === 0) {
    callName = 'Write Parameter';
    pushField(fields, data, {
      id: 'parameter-data',
      name: 'P3-P0 — Parameter Data',
      offset: 1,
      length: 1,
      rawValue: lowNibble,
      physicalValue: toBinary(lowNibble, RESPONSE_DATA_BITS),
    });
    pushSelectBit(fields, data, i3);
    warnings.push(WARN_SELECT_BIT_POLARITY_UNCONFIRMED);
  } else {
    const command = lookupCommand(informationField, slaveAddress);
    callName = command?.name;
    pushField(fields, data, {
      id: 'command',
      name: 'Command',
      offset: 1,
      length: 1,
      rawValue: informationField,
      physicalValue:
        command === undefined ? toBinary(informationField, INFORMATION_BITS) : command.name,
      valid: command !== undefined,
      warnings: command === undefined ? [WARN_CALL_NOT_NAMED] : [],
    });
    if (command === undefined) warnings.push(WARN_CALL_NOT_NAMED);
    if (command !== undefined) summaryParams['mnemonic'] = command.mnemonic;
    if (command?.mnemonic === 'WID1') {
      pushField(fields, data, {
        id: 'extended-id-code-1',
        name: 'ID3-ID0 — Extended ID Code_1',
        offset: 1,
        length: 1,
        rawValue: lowNibble,
        physicalValue: toBinary(lowNibble, RESPONSE_DATA_BITS),
      });
    }
  }
  summaryParams['call'] = callName ?? toBinary(informationField, INFORMATION_BITS);

  // Parite: CB + A4..A0 + I4..I0 + PB üzerinden ÇİFT (A'nın harfi harfine kuralı).
  const parityCovered = ((value >>> 1) & 0b111111111111) >>> 0;
  const parityIsEven = countOnes(parityCovered) % 2 === 0;
  pushField(fields, data, {
    id: 'parity-bit',
    name: 'PB — Parity Bit (even)',
    offset: 1,
    length: 1,
    rawValue: parityBit,
    physicalValue: parityIsEven ? 'Even parity OK' : 'Even parity MISMATCH',
    valid: parityIsEven,
    warnings: parityIsEven ? [] : [ERROR_PARITY_MISMATCH],
  });
  if (!parityIsEven) {
    errors.push({
      code: 'checksum-mismatch',
      message: ERROR_PARITY_MISMATCH,
      offset: 1,
      length: 1,
      details: { parityBit, expectedParityBit: parityBit ^ 1 },
    });
  }

  pushEndBit(fields, data, endBit, warnings);
  return { slaveAddress, callName };
}

function pushSelectBit(fields: ParsedField[], data: Uint8Array, i3: number): void {
  pushField(fields, data, {
    id: 'select-bit',
    name: 'I3 — Data bit D3 / select bit',
    offset: 1,
    length: 1,
    rawValue: i3,
    // Polarite teyitsiz: hangi yarının A hangisinin B slave olduğu İDDİA EDİLMEZ.
    physicalValue: `D3=${i3} · extended addressing: select bit = ${i3}`,
    warnings: [WARN_SELECT_BIT_POLARITY_UNCONFIRMED],
  });
}

function pushEndBit(
  fields: ParsedField[],
  data: Uint8Array,
  endBit: number,
  warnings: WarningSink,
): void {
  const offset = data.length - 1;
  if (endBit !== 1) warnings.push(WARN_END_BIT_NOT_ONE);
  pushField(fields, data, {
    id: 'end-bit',
    name: 'EB — End Bit',
    offset,
    length: 1,
    rawValue: endBit,
    physicalValue: endBit === 1 ? 'Valid (1)' : 'Invalid (must be 1)',
    valid: endBit === 1,
    warnings: endBit === 1 ? [] : [WARN_END_BIT_NOT_ONE],
  });
}

function decodeSlaveResponse(
  data: Uint8Array,
  fields: ParsedField[],
  warnings: WarningSink,
  errors: ProtocolError[],
  summaryParams: Record<string, string>,
): void {
  const value = byteAt(data, 0);
  const padding = (value >>> SLAVE_RESPONSE_BITS) & 1;
  const startBit = (value >>> 6) & 1;
  const responseData = (value >>> 2) & 0b1111;
  const parityBit = (value >>> 1) & 1;
  const endBit = value & 1;

  if (padding !== 0) warnings.push(WARN_PADDING_BITS_NOT_ZERO);
  pushField(fields, data, {
    id: 'padding-bits',
    name: 'Padding (bit 7)',
    offset: 0,
    length: 1,
    rawValue: padding,
    physicalValue: toBinary(padding, 1),
    valid: padding === 0,
    warnings: padding === 0 ? [] : [WARN_PADDING_BITS_NOT_ZERO],
  });

  pushField(fields, data, {
    id: 'start-bit',
    name: 'ST — Start Bit',
    offset: 0,
    length: 1,
    rawValue: startBit,
    physicalValue: startBit === 0 ? 'Valid (0)' : 'Invalid (must be 0)',
    valid: startBit === 0,
    warnings: startBit === 0 ? [] : [ERROR_START_BIT_NOT_ZERO],
  });
  if (startBit !== 0) {
    errors.push({
      code: 'start-delimiter-not-found',
      message: ERROR_START_BIT_NOT_ZERO,
      offset: 0,
      length: 1,
      details: { startBit },
    });
  }

  warnings.push(WARN_RESPONSE_MEANING_NEEDS_REQUEST);
  pushField(fields, data, {
    id: 'response-data',
    name: 'I3-I0 — Response Data',
    offset: 0,
    length: 1,
    rawValue: responseData,
    physicalValue: toBinary(responseData, RESPONSE_DATA_BITS),
    warnings: [WARN_RESPONSE_MEANING_NEEDS_REQUEST],
  });
  summaryParams['data'] = toBinary(responseData, RESPONSE_DATA_BITS);

  const parityCovered = (value >>> 1) & 0b11111;
  const parityIsEven = countOnes(parityCovered) % 2 === 0;
  pushField(fields, data, {
    id: 'parity-bit',
    name: 'PB — Parity Bit (even)',
    offset: 0,
    length: 1,
    rawValue: parityBit,
    physicalValue: parityIsEven ? 'Even parity OK' : 'Even parity MISMATCH',
    valid: parityIsEven,
    warnings: parityIsEven ? [] : [ERROR_PARITY_MISMATCH],
  });
  if (!parityIsEven) {
    errors.push({
      code: 'checksum-mismatch',
      message: ERROR_PARITY_MISMATCH,
      offset: 0,
      length: 1,
      details: { parityBit, expectedParityBit: parityBit ^ 1 },
    });
  }

  pushEndBit(fields, data, endBit, warnings);
}

function parseAsInterfaceFrame(
  data: Uint8Array,
  options: AsInterfaceParseOptions,
): ParseResult {
  if (options.signal?.aborted === true) {
    return fail({ code: 'parser-timeout', message: ERROR_ABORTED, recoverable: false });
  }

  if (options.maxFrameLength !== undefined && data.length > options.maxFrameLength) {
    return fail({
      code: 'frame-too-long',
      message: ERROR_FRAME_TOO_LONG,
      recoverable: false,
      offset: options.maxFrameLength,
      length: data.length - options.maxFrameLength,
      details: { maxFrameLength: options.maxFrameLength, frameLength: data.length },
    });
  }

  if (data.length !== MASTER_REQUEST_BYTES && data.length !== SLAVE_RESPONSE_BYTES) {
    return fail({
      code: 'length-mismatch',
      message: ERROR_UNSUPPORTED_LENGTH,
      recoverable: true,
      offset: 0,
      length: data.length,
      details: { frameLength: data.length, masterRequestBytes: 2, slaveResponseBytes: 1 },
    });
  }

  const fields: ParsedField[] = [];
  const warnings = new WarningSink();
  const errors: ProtocolError[] = [];
  const summaryParams: Record<string, string> = {};

  // Klasik AS-i ile ASi-5 karıştırılmasın: her çözümde söylenir (dosya başı).
  warnings.push(WARN_CLASSIC_ASI_ONLY);

  let metadata: AsInterfaceFrameMetadata;
  if (data.length === MASTER_REQUEST_BYTES) {
    const outcome = decodeMasterRequest(data, fields, warnings, errors, summaryParams);
    metadata = {
      kind: 'master-request',
      slaveAddress: outcome.slaveAddress,
      callName: outcome.callName,
      summaryKey: SUMMARY_MASTER_REQUEST,
      summaryParams,
    };
  } else {
    decodeSlaveResponse(data, fields, warnings, errors, summaryParams);
    metadata = {
      kind: 'slave-response',
      slaveAddress: undefined,
      callName: undefined,
      summaryKey: SUMMARY_SLAVE_RESPONSE,
      summaryParams,
    };
  }

  const rawFrame = createRawFrame(data, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
    metadata,
  });

  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields,
    valid: errors.length === 0,
    errors,
    warnings: warnings.warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export function parseAsInterface(data: Uint8Array): ParseResult {
  return parseAsInterfaceFrame(data, {});
}

export const asInterfaceParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * Ucuz ön eleme: uzunluk sözleşmesi + başlangıç bitinin sıfır olması.
   * Sihirli bayt yoktur, bundan fazlası uydurma olurdu.
   */
  canParse(data: Uint8Array): boolean {
    if (data.length === MASTER_REQUEST_BYTES) return ((byteAt(data, 0) >>> 5) & 1) === 0;
    if (data.length === SLAVE_RESPONSE_BYTES) return ((byteAt(data, 0) >>> 6) & 1) === 0;
    return false;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: AsInterfaceParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseAsInterfaceFrame(data, options);
  },
};

// ── Örnek çerçeveler ────────────────────────────────────────────────────────
// Baytlar YAPIYA göre kurulur: parite HESAPLANIR, elle yazılmaz — böylece bir
// alan değişirse örnek de doğru kalır. Bir örnek pariteyi BİLEREK bozar.

/** ST=0 · CB · A4..A0 · I4..I0 · PB (hesaplanır) · EB=1 → 2 bayt. */
function masterRequest(
  controlBit: number,
  slaveAddress: number,
  informationField: number,
  options?: { readonly breakParity?: boolean; readonly startBit?: number; readonly endBit?: number },
): Uint8Array {
  const startBit = options?.startBit ?? 0;
  const endBit = options?.endBit ?? 1;
  const withoutParity = (controlBit << 11) | (slaveAddress << 6) | (informationField << 1);
  let parityBit = countOnes(withoutParity) % 2 === 0 ? 0 : 1;
  if (options?.breakParity === true) parityBit ^= 1;
  const value =
    (startBit << 13) |
    (controlBit << 12) |
    (slaveAddress << 7) |
    (informationField << 2) |
    (parityBit << 1) |
    endBit;
  return Uint8Array.from([(value >>> 8) & 0xff, value & 0xff]);
}

/** ST=0 · I3..I0 · PB (hesaplanır) · EB=1 → 1 bayt. */
function slaveResponse(responseData: number, options?: { readonly breakParity?: boolean }): Uint8Array {
  let parityBit = countOnes(responseData << 1) % 2 === 0 ? 0 : 1;
  if (options?.breakParity === true) parityBit ^= 1;
  return Uint8Array.from([(responseData << 2) | (parityBit << 1) | 1]);
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'data-exchange-request',
    name: 'protocol.asInterface.example.dataExchangeRequest.name',
    // SB=0, I4=0 → veri çağrısı; adres 5, çıkış verisi 0b1010.
    bytes: masterRequest(0, 5, 0b01010),
    description: 'protocol.asInterface.example.dataExchangeRequest.description',
    expectedValid: true,
  },
  {
    id: 'data-exchange-response',
    name: 'protocol.asInterface.example.dataExchangeResponse.name',
    bytes: slaveResponse(0b0011),
    description: 'protocol.asInterface.example.dataExchangeResponse.description',
    expectedValid: true,
  },
  {
    id: 'write-parameter-request',
    name: 'protocol.asInterface.example.writeParameterRequest.name',
    // SB=0, I4=1 → parametre çağrısı; adres 12, parametre 0b0110.
    bytes: masterRequest(0, 12, 0b10110),
    description: 'protocol.asInterface.example.writeParameterRequest.description',
    expectedValid: true,
  },
  {
    id: 'address-assignment',
    name: 'protocol.asInterface.example.addressAssignment.name',
    // Adres 0 + SB=0 → yeni adres bilgi alanındadır (burada 7).
    bytes: masterRequest(0, 0, 7),
    description: 'protocol.asInterface.example.addressAssignment.description',
    expectedValid: true,
  },
  {
    id: 'read-io-configuration',
    name: 'protocol.asInterface.example.readIoConfiguration.name',
    // SB=1, I4=1, I2 I1 I0 = 000 → Read I/O Configuration.
    bytes: masterRequest(1, 3, 0b10000),
    description: 'protocol.asInterface.example.readIoConfiguration.description',
    expectedValid: true,
  },
  {
    id: 'read-id-code',
    name: 'protocol.asInterface.example.readIdCode.name',
    bytes: masterRequest(1, 3, 0b10001),
    description: 'protocol.asInterface.example.readIdCode.description',
    expectedValid: true,
  },
  {
    id: 'reset-slave',
    name: 'protocol.asInterface.example.resetSlave.name',
    bytes: masterRequest(1, 9, 0b11100),
    description: 'protocol.asInterface.example.resetSlave.description',
    expectedValid: true,
  },
  {
    id: 'read-status',
    name: 'protocol.asInterface.example.readStatus.name',
    bytes: masterRequest(1, 9, 0b11110),
    description: 'protocol.asInterface.example.readStatus.description',
    expectedValid: true,
  },
  {
    id: 'delete-address',
    name: 'protocol.asInterface.example.deleteAddress.name',
    // SB=1, I4=0, I2 I1 I0 = 000 → Delete Address (adres 0 DEĞİL).
    bytes: masterRequest(1, 21, 0b00000),
    description: 'protocol.asInterface.example.deleteAddress.description',
    expectedValid: true,
  },
  {
    id: 'broadcast-reset',
    name: 'protocol.asInterface.example.broadcastReset.name',
    // A Table 3.2 BR01: adres 11111, SB=1, I4..I0 = 10101 → yanıt beklenmez.
    bytes: masterRequest(1, BROADCAST_ADDRESS, 0b10101),
    description: 'protocol.asInterface.example.broadcastReset.description',
    expectedValid: true,
  },
  {
    id: 'unnamed-command',
    name: 'protocol.asInterface.example.unnamedCommand.name',
    // SB=1, I4=1, I2 I1 I0 = 111 → A'nın şemasında "reserved".
    bytes: masterRequest(1, 4, 0b10111),
    description: 'protocol.asInterface.example.unnamedCommand.description',
    expectedValid: true,
  },
  {
    id: 'parity-error',
    name: 'protocol.asInterface.example.parityError.name',
    bytes: masterRequest(0, 5, 0b01010, { breakParity: true }),
    description: 'protocol.asInterface.example.parityError.description',
    expectedValid: false,
  },
  {
    id: 'start-bit-error',
    name: 'protocol.asInterface.example.startBitError.name',
    bytes: masterRequest(0, 5, 0b01010, { startBit: 1 }),
    description: 'protocol.asInterface.example.startBitError.description',
    expectedValid: false,
  },
  {
    id: 'end-bit-error',
    name: 'protocol.asInterface.example.endBitError.name',
    bytes: masterRequest(0, 5, 0b01010, { endBit: 0 }),
    description: 'protocol.asInterface.example.endBitError.description',
    expectedValid: true,
  },
];

export const asInterfacePlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'industrial-automation',
  parser: asInterfaceParser,
  documentation: {
    summary: 'protocol.asInterface.documentation.summary',
    layer: 'multi-layer',
    references: [
      {
        title:
          'ASI4U / ASI4U-E / ASI4U-F datasheet (IDT) — Table 3.2 Master Calls and Related Slave Responses, published on as-interface.net',
        url: 'https://www.as-interface.net/media/sudk4ukd/3005.pdf',
      },
      {
        title:
          'Sense Eletrônica — Rede AS-Interface, Manual de Instruções (3000000093A), §5 Estrutura do Telegrama',
        url: 'https://www.sense.com.br/arquivos/produtos/arq0/3000000093A.pdf',
      },
      {
        title: 'Pepperl+Fuchs — The AS-interface (14-bit master telegram, 7-bit slave response, APM)',
        url: 'https://docs.rs-online.com/ba88/0900766b8002a103.pdf',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};

/** Adres alanının bit genişliği — testler bu sabiti bekçiler. */
export const AS_INTERFACE_ADDRESS_BITS = ADDRESS_BITS;
export const AS_INTERFACE_MAX_SLAVE_ADDRESS = MAX_SLAVE_ADDRESS;
export const AS_INTERFACE_MASTER_REQUEST_BITS = MASTER_REQUEST_BITS;
export const AS_INTERFACE_SLAVE_RESPONSE_BITS = SLAVE_RESPONSE_BITS;

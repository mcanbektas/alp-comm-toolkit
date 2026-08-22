/**
 * SMBus transaction çekirdeği — `smbus.ts` ve `pmbus.ts` PAYLAŞIR
 * (`qspiCore.ts`/`uartLineCore.ts`nin dalga 11b/11d'deki rolüyle aynı).
 * PMBus, SMBus'ın üstünde bir komut protokolüdür (spec özeti: "SMBus tabanlı
 * command protocol"), yani aynı paket iskeletini kullanır; ayrım yalnız komut
 * kodunun ve veri baytlarının YORUMUNDA.
 *
 * ── Ne çözülür ──────────────────────────────────────────────────────────────
 * Girdi YAKALANMIŞ bayt dizisidir: adres baytları dahil, ACK/NACK/START/STOP
 * HARİÇ (i2c.ts'nin dalga 11c'de sabitlediği kabul). Bu, PEC kapsamıyla da
 * birebir örtüşür — SMBus 3.1 §5.4: "The PEC calculation includes all bytes in
 * the transmission, including address, command and data. The PEC calculation
 * does not include ACK or NACK bits or START, STOP or REPEATED START
 * conditions."
 *
 * ── PEC: doğrulandı, varsayılmadı ───────────────────────────────────────────
 * Brief (`brief-faz10-dalga11.md:80,111`) PEC'in düz `CRC8` olduğunu
 * "GİBİ ama provenance yok" diye AÇIKTA bırakmıştı. Doğrulama zinciri:
 *   1. **SMBus Specification Version 3.1 (SMIF, 19 Mart 2018) §5.4**: "The PEC
 *      may be calculated in any way that conforms to a CRC-8 represented by the
 *      polynomial, C(x) = x8 + x2 + x1 + 1, and must be calculated in the order
 *      of the bits as received." → poly 0x07, yansıma YOK.
 *   2. Depodaki `crcCatalogue.ts:45` `CRC8` girdisi tam bu parametre kümesi
 *      (poly 0x07, init 0x00, refin/refout false, xorout 0x00) ve
 *      `crcEngine.test.ts:19` check-value'sunu 0xF4 olarak zaten sabitliyor —
 *      CRC-8/SMBUS'ın standart check değeri.
 *   3. Bağımsız bir bit-bit referans uygulama aynı 0xF4'ü verdi (dalga 11i
 *      doğrulama turu; 1-Wire CRC'sinde uygulanan "elle hesapla, sonra koda
 *      yaz" disiplininin aynısı).
 * Sonuç: PEC = `computeNamedCrc(bytes, 'CRC8')`, yeni bir CRC girdisi
 * AÇILMADI.
 *
 * ── PEC var mı yok mu: kanıt, varsayım değil ────────────────────────────────
 * SMBus'ta her protokolün PEC'li ve PEC'siz iki biçimi vardır (§6.5) ve
 * yakalanmış baytlara bakarak hangisi olduğu doğrudan görünmez. Kural: son bayt
 * kendisinden ÖNCEKİ tüm baytların CRC-8'ine EŞİTSE PEC kabul edilir. Yanlış
 * pozitif olasılığı 1/256'dır ve gizlenmez — böyle bir çerçevede `pecInferred`
 * bayrağı ile uyarı üretilir (rs485.ts'nin half-duplex echo kararıyla aynı
 * disiplin: hata değil UYARI, alanlar eksiksiz gösterilir).
 *
 * ── Transaction sınıflandırma ───────────────────────────────────────────────
 * Spec özetinin saydığı 11 transaction türü (`…Platformu.md`, "SMBus
 * transaction türleri") bayt sayısı + repeated-START konumundan türetilir.
 * Repeated START tespiti i2c.ts'ten devralındı: gövdedeki bir bayt, ilk baytla
 * AYNI 7-bit adresi taşıyor VE R/W biti Read ise orada yön dönmüştür.
 *
 * Bazı şekiller GERÇEKTEN belirsizdir — örneğin `addr+W, cmd, 01h, ABh` hem
 * Write Word (low=01h, high=ABh) hem Block Write (count=1, veri ABh) okunabilir.
 * Karar: SABİT boyutlu yorum kazanır (Write Word), alternatif Block okuması
 * `alternativeKinds`e yazılır ve çağıran uyarı olarak gösterir. Sessizce birini
 * seçip diğerini yok saymak, dalga 11b/11a'da testlerin yakaladığı "veri
 * sessizce kayboluyor" hata sınıfının aynısı olurdu.
 *
 * ── KAPSAM DIŞI (gerekçeli) ─────────────────────────────────────────────────
 * - **Timeout/bus-stuck izleme** (spec özetinin "Clock LOW duration /
 *   Transaction timeout / Bus stuck detection" isteği): bunlar BİT-seviyeli
 *   zamanlama ölçümleridir, yakalanmış bayt dizisinde izleri yoktur. i2c.ts'nin
 *   clock-stretch/arbitration kararıyla aynı: katalogdaki "Timeout Monitor"
 *   aracının motoru bu dosyada YOK.
 * - **SMBALERT#, Host Notify, ARP/UDID** — spec özeti SMBALERT#'i yalnız
 *   "opsiyonel hat" olarak sayar, paket biçimi vermez.
 * - **10-bit adresleme** — i2c.ts ile aynı gerekçe (kaynakta yok).
 */

import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';

const READ_WRITE_BIT = 0x01;
const ADDRESS_7BIT_SHIFT = 1;
const HEX_RADIX = 16;

/** Spec özetinin saydığı 11 tür + sınıflandırılamayan. */
export type SmbusTransactionKind =
  | 'quick-command'
  | 'send-byte'
  | 'receive-byte'
  | 'write-byte'
  | 'read-byte'
  | 'write-word'
  | 'read-word'
  | 'process-call'
  | 'block-write'
  | 'block-read'
  | 'block-write-block-read'
  | 'unknown';

/** Spec özetinin PEC panelinde istediği beş alanın veri karşılığı. */
export interface SmbusPecCheck {
  /** Son bayt hesaplanan CRC-8 ile eşleşti mi (yani PEC'li mi okundu). */
  present: boolean;
  /** Eşleşme YALNIZ CRC tutmasından çıkarıldıysa true — 1/256 yanlış pozitif payı. */
  inferred: boolean;
  /** Çerçevede taşınan PEC baytı; PEC yoksa undefined. */
  received?: number;
  /** Kapsanan baytlar üzerinden hesaplanan CRC-8. PEC yoksa: TÜM baytlar için ne çıkardı. */
  calculated: number;
  /** "PEC Input Coverage" — hesaba giren bayt sayısı. */
  coverageBytes: number;
}

export interface SmbusStructure {
  addressByte: number;
  address7bit: number;
  /** İlk adres baytının R/W biti (Receive Byte / Quick Command Read ayrımı). */
  isReadFirst: boolean;
  /** Repeated START adres baytının gövdedeki indeksi; yoksa undefined. */
  repeatedStartOffset?: number;
  /** Komut kodu (Quick Command ve Receive Byte'ta YOKTUR). */
  commandCode?: number;
  /** Komut kodundan sonra, yön dönmeden önce yazılan baytlar. */
  writeData: Uint8Array;
  /** Repeated START'tan sonra okunan baytlar. */
  readData: Uint8Array;
  /** Block türlerinde ilk okunan/yazılan bayt olan sayaç; başka türlerde undefined. */
  blockCount?: number;
  kind: SmbusTransactionKind;
  /** Bayt dizisine EŞİT ÖLÇÜDE uyan, seçilmeyen yorumlar. */
  alternativeKinds: readonly SmbusTransactionKind[];
  pec: SmbusPecCheck;
  /** PEC baytı çıkarıldıktan sonraki gövde — alan ofsetleri bununla hizalanır. */
  body: Uint8Array;
}

export function formatHexByte(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(2, '0')}`;
}

export function address7Bit(addressByte: number): number {
  return addressByte >> ADDRESS_7BIT_SHIFT;
}

export function isReadAddress(addressByte: number): boolean {
  return (addressByte & READ_WRITE_BIT) !== 0;
}

/** i2c.ts'in adres biçimi — 7-bit/8-bit ayrımı spec'in açık isteği. */
export function formatAddress(addressByte: number): string {
  const direction = isReadAddress(addressByte) ? 'Read' : 'Write';
  return `${direction} · 7-bit ${formatHexByte(address7Bit(addressByte))} (${formatHexByte(addressByte)})`;
}

/**
 * SMBus PEC'i hesaplar: CRC-8 (poly 0x07, init 0x00, yansıma yok), adres
 * baytları DAHİL tüm baytlar üzerinde (SMBus 3.1 §5.4). Depodaki `CRC8`
 * girdisi tekrar yazılmadı — dosya başındaki doğrulama zincirine bak.
 */
export function computeSmbusPec(bytes: Uint8Array): number {
  return Number(computeNamedCrc(bytes, 'CRC8'));
}

/** noUncheckedIndexedAccess guard'ı (i2c.ts'ten). */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function detectPec(data: Uint8Array): { body: Uint8Array; pec: SmbusPecCheck } {
  const MIN_PEC_FRAME = 2;
  if (data.length >= MIN_PEC_FRAME) {
    const candidateBody = data.slice(0, data.length - 1);
    const received = byteAt(data, data.length - 1);
    const calculated = computeSmbusPec(candidateBody);
    if (calculated === received) {
      return {
        body: candidateBody,
        pec: {
          present: true,
          inferred: true,
          received,
          calculated,
          coverageBytes: candidateBody.length,
        },
      };
    }
  }

  // PEC yok: hesaplanan değer yine de gösterilir — "gönderen ne eklemeliydi".
  return {
    body: data,
    pec: {
      present: false,
      inferred: false,
      calculated: computeSmbusPec(data),
      coverageBytes: data.length,
    },
  };
}

/** İlk baytla aynı 7-bit adresi Read yönünde tekrar eden ilk bayt (i2c.ts kuralı). */
function findRepeatedStart(body: Uint8Array): number | undefined {
  const first = byteAt(body, 0);
  if (isReadAddress(first)) return undefined;
  const MIN_REPEAT_OFFSET = 2;
  for (let offset = MIN_REPEAT_OFFSET; offset < body.length; offset += 1) {
    const candidate = byteAt(body, offset);
    if (isReadAddress(candidate) && address7Bit(candidate) === address7Bit(first)) {
      return offset;
    }
  }
  return undefined;
}

/** Sayaç baytı, kendisinden sonraki bayt sayısına eşitse blok yorumu tutarlıdır. */
function isBlockConsistent(bytes: Uint8Array): boolean {
  if (bytes.length < 1) return false;
  return byteAt(bytes, 0) === bytes.length - 1;
}

interface Classification {
  kind: SmbusTransactionKind;
  alternatives: SmbusTransactionKind[];
  blockCount?: number;
}

/** Yön dönmeyen (yalnız yazma) şekiller. */
function classifyWriteOnly(body: Uint8Array): Classification {
  const QUICK = 1;
  const SEND_BYTE = 2;
  const WRITE_BYTE = 3;
  const WRITE_WORD = 4;
  const afterCommand = body.slice(2);
  const blockFits = isBlockConsistent(afterCommand);
  const alternatives: SmbusTransactionKind[] = [];

  if (body.length === QUICK) return { kind: 'quick-command', alternatives };
  if (body.length === SEND_BYTE) return { kind: 'send-byte', alternatives };

  if (body.length === WRITE_BYTE || body.length === WRITE_WORD) {
    // Sabit boyutlu yorum kazanır; blok da tutuyorsa alternatif olarak yazılır.
    if (blockFits) alternatives.push('block-write');
    return {
      kind: body.length === WRITE_BYTE ? 'write-byte' : 'write-word',
      alternatives,
      ...(blockFits ? { blockCount: byteAt(afterCommand, 0) } : {}),
    };
  }

  if (blockFits) {
    return { kind: 'block-write', alternatives, blockCount: byteAt(afterCommand, 0) };
  }
  return { kind: 'unknown', alternatives };
}

/** Repeated START ile yön dönen şekiller. */
function classifyRead(body: Uint8Array, repeatOffset: number): Classification {
  const COMMAND_ONLY_OFFSET = 2;
  const readData = body.slice(repeatOffset + 1);
  const writeData = body.slice(2, repeatOffset);
  const alternatives: SmbusTransactionKind[] = [];
  const readBlockFits = isBlockConsistent(readData);

  if (repeatOffset === COMMAND_ONLY_OFFSET) {
    const READ_BYTE = 1;
    const READ_WORD = 2;
    if (readData.length === READ_BYTE || readData.length === READ_WORD) {
      if (readBlockFits) alternatives.push('block-read');
      return {
        kind: readData.length === READ_BYTE ? 'read-byte' : 'read-word',
        alternatives,
        ...(readBlockFits ? { blockCount: byteAt(readData, 0) } : {}),
      };
    }
    if (readBlockFits) {
      return { kind: 'block-read', alternatives, blockCount: byteAt(readData, 0) };
    }
    return { kind: 'unknown', alternatives };
  }

  // Yön dönmeden önce komut kodunun ARDINDAN da bayt yazılmış: Process Call ailesi.
  const PROCESS_CALL_WRITE_BYTES = 2;
  const PROCESS_CALL_READ_BYTES = 2;
  if (writeData.length === PROCESS_CALL_WRITE_BYTES && readData.length === PROCESS_CALL_READ_BYTES) {
    if (isBlockConsistent(writeData) && readBlockFits) alternatives.push('block-write-block-read');
    return { kind: 'process-call', alternatives };
  }
  if (isBlockConsistent(writeData) && readBlockFits) {
    return { kind: 'block-write-block-read', alternatives, blockCount: byteAt(readData, 0) };
  }
  return { kind: 'unknown', alternatives };
}

/**
 * Yakalanmış bayt dizisini SMBus iskeletine ayırır. Boş dizide çağrılmaz —
 * çağıran (parser) uzunluk kontrolünü kendi hata koduyla yapar.
 */
export function splitSmbusTransaction(data: Uint8Array): SmbusStructure {
  const { body, pec } = detectPec(data);
  const addressByte = byteAt(body, 0);
  const readFirst = isReadAddress(addressByte);
  const repeatOffset = findRepeatedStart(body);

  let classification: Classification;
  if (readFirst) {
    // Yön en baştan Read: Receive Byte (tek veri baytı) ya da Quick Command Read.
    const RECEIVE_BYTE_LENGTH = 2;
    const QUICK_LENGTH = 1;
    classification =
      body.length === QUICK_LENGTH
        ? { kind: 'quick-command', alternatives: [] }
        : body.length === RECEIVE_BYTE_LENGTH
          ? { kind: 'receive-byte', alternatives: [] }
          : { kind: 'unknown', alternatives: [] };
  } else if (repeatOffset === undefined) {
    classification = classifyWriteOnly(body);
  } else {
    classification = classifyRead(body, repeatOffset);
  }

  const hasCommand = !readFirst && body.length > 1;
  const writeData =
    repeatOffset === undefined ? body.slice(hasCommand ? 2 : 1) : body.slice(2, repeatOffset);
  const readData = repeatOffset === undefined ? new Uint8Array(0) : body.slice(repeatOffset + 1);

  return {
    addressByte,
    address7bit: address7Bit(addressByte),
    isReadFirst: readFirst,
    ...(repeatOffset === undefined ? {} : { repeatedStartOffset: repeatOffset }),
    ...(hasCommand ? { commandCode: byteAt(body, 1) } : {}),
    writeData,
    readData,
    ...(classification.blockCount === undefined ? {} : { blockCount: classification.blockCount }),
    kind: classification.kind,
    alternativeKinds: classification.alternatives,
    pec,
    body,
  };
}

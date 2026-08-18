/**
 * BACnet NPDU (Network Layer Protocol Data Unit) çözüm çekirdeği.
 *
 * BİLEREK `bacnetmstp.ts`den AYRI, `building/bacnet/` altında PAYLAŞILAN bir
 * ailede: NPDU/APDU alan sırası MS/TP ile BACnet/IP (dalga 6g, BVLL
 * başlığından sonra) arasında ORTAKTIR — yalnız veri bağı (MS/TP çerçevesi ya
 * da BVLL başlığı) değişir. Desen `iec104.ts`nin `iec104Asdu.ts`yi ayırmasının
 * BİREBİR AYNISI: motor dosyası ince, çekirdek ayrı dosyada, ikinci motor
 * (6g) aynı çekirdeği import edip kullanır (brief-faz10-dalga6.md Karar 4).
 * `decodeNpdu` de `decodeAsdu` gibi OUT-PARAMETER ACCUMULATOR deseni kullanır:
 * `fields`/`warnings`/`errors` çağıranın dizileridir, bu fonksiyon onlara PUSH
 * eder ve küçük bir özet nesnesi DÖNER — discriminated union döndürmez.
 *
 * ── KAYNAK UYARISI (Karar 2, brief-faz10-dalga6.md) ─────────────────────────
 * ANSI/ASHRAE 135'in resmi metni ÜCRETLİdir ve bu depoda YOK. Aşağıdaki NPDU
 * Control okteti bit yerleşimi, koşullu alan sırası (DNET/DLEN/DADR/SNET/SLEN/
 * SADR/Hop Count) ve Network Layer Message alan yapısı İKİ bağımsız kamuya
 * açık kaynaktan ÇAPRAZ TEYİTLE alındı (2026-08-18 taranarak), KOD KOPYALANMADI
 * — yalnız format/bit-konumu bilgisi:
 *   1. bacnet-stack (github.com/bacnet-stack/bacnet-stack, MIT): `src/npdu.c`
 *      encode/decode fonksiyonları — Control okteti BIT7/BIT5/BIT3/BIT2
 *      maskeleri + `priority = npdu[1] & 0x03`; DNET/DLEN/DADR → SNET/SLEN/
 *      SADR → Hop Count alan sırası; `src/bacnet/bacenum.h`deki Network Layer
 *      Message tipi adları (Who-Is-Router-To-Network=0 vb.).
 *   2. bacpypes (github.com/JoelBender/bacpypes, MIT — yalnız format/sabit
 *      bilgisi referans alındı, KOD KOPYALANMADI): `bacpypes/npdu.py`
 *      `NPCI.encode()` — AYNI bit maskelerini (`netLayerMessage=0x80`,
 *      `dnetPresent=0x20`, `snetPresent=0x08`) ve AYNI alan sırasını
 *      bağımsızca doğruluyor; Network Layer Message tipi adları da
 *      (`whoIsRouterToNetwork=0x00` vb.) birebir örtüşüyor.
 * İki kaynak da AYNI bit konumunda AYNI adı veriyor; hiçbir alan tek kaynaktan
 * gelmedi. Üçüncü destekleyici kaynak: bacnet.org'un kamuya açık "Encoding"
 * notu (örnek: "0x28 → Bit5=1 DNET present, Bit1-0=00 normal priority").
 *
 * ── KAPSAM ÇİZGİSİ (Karar 3, brief-faz10-dalga6.md) ─────────────────────────
 * NPDU TAM çözülür (bu dosya). APDU BAŞLIK düzeyinde çözülür (`apdu.ts`):
 * PDU type, service choice ADI, invoke ID — tag'li servis parametreleri HAM
 * kalır (berReader BACnet tag formatına uymuyor, bkz. `apdu.ts` dosya başı).
 *
 * ── NETWORK LAYER MESSAGE: ADLANDIR AMA İÇİNİ ÇÖZME ─────────────────────────
 * Control okteti Bit7=1 ise NSDU bir ağ katmanı mesajıdır (Who-Is-Router-To-
 * Network vb.), APDU DEĞİLDİR. Bu çekirdek mesaj tipini dar bir ad kümesiyle
 * adlandırır (+ proprietary aralıkta Vendor ID'yi okur) ve DÖNER — mesajın
 * içeriğini (router tablosu, network numaraları) ÇÖZMEZ; bu analyzer işidir
 * (ozet07 MS/TP Error Analyzer bölümü, spec 22274+ BBMD/discovery emsali).
 * Çağıran (`bacnetmstp.ts`) `isNetworkLayerMessage: true` gördüğünde APDU
 * çözümüne HİÇ girmemelidir.
 */

import { readBitsAsNumber } from '@/protocol-core/decoding/bitCursor';
import type { ParsedField, ProtocolError, ProtocolWarning } from '@/protocol-core/types';

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function readUint16BE(data: Uint8Array, offset: number): number {
  return (byteAt(data, offset) << 8) | byteAt(data, offset + 1);
}

function toProtocolWarning(key: string, offset?: number, length?: number): ProtocolWarning {
  const warning: ProtocolWarning = { code: key, message: key };
  if (offset !== undefined) warning.offset = offset;
  if (length !== undefined) warning.length = length;
  return warning;
}

export const WARN_UNKNOWN_NETWORK_MESSAGE_TYPE = 'protocol.bacnetMstp.warning.unknownNetworkMessageType';
export const WARN_UNEXPECTED_NPDU_VERSION = 'protocol.bacnetMstp.warning.unexpectedNpduVersion';
export const ERROR_NPDU_TRUNCATED = 'protocol.bacnetMstp.error.npduTruncated';

/** NPDU'nun tek desteklenen versiyonu — ASHRAE 135'te hiç değişmedi (dosya başı kaynak uyarısı). */
const NPDU_SUPPORTED_VERSION = 1;

/** Control okteti bit-index'leri (bitCursor msb-first: 0=bit7 … 7=bit0) — dosya başı kaynak uyarısı. */
const CTRL_NETWORK_LAYER_MESSAGE_BIT = 0; // bit7
const CTRL_DESTINATION_SPECIFIER_BIT = 2; // bit5
const CTRL_SOURCE_SPECIFIER_BIT = 4; // bit3
const CTRL_EXPECTING_REPLY_BIT = 5; // bit2
const CTRL_PRIORITY_BIT = 6; // bit1-0, 2 bit genişlik

const PRIORITY_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'Normal'],
  [1, 'Urgent'],
  [2, 'Critical Equipment'],
  [3, 'Life Safety'],
]);

/** Vendor-proprietary aralığın alt sınırı — bu ve üstü 2 baytlık Vendor ID ister. */
const NETWORK_MESSAGE_VENDOR_PROPRIETARY_MIN = 0x80;

/**
 * Network Layer Message tipi — dar, İKİ kaynak teyitli küme (dosya başı kaynak
 * uyarısı, bacnet-stack `bacenum.h` + bacpypes `npdu.py` birebir örtüşüyor).
 * Router keşif/yönetim mesajları; içerikleri (network numara listeleri) bu
 * çekirdekte ÇÖZÜLMEZ (dosya başı kapsam notu).
 */
const NETWORK_MESSAGE_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'Who-Is-Router-To-Network'],
  [1, 'I-Am-Router-To-Network'],
  [2, 'I-Could-Be-Router-To-Network'],
  [3, 'Reject-Message-To-Network'],
  [4, 'Router-Busy-To-Network'],
  [5, 'Router-Available-To-Network'],
  [6, 'Initialize-Routing-Table'],
  [7, 'Initialize-Routing-Table-Ack'],
]);

export interface NpduAddress {
  readonly net: number;
  readonly len: number;
  /** `len === 0` broadcast anlamına gelir (yalnız destination'da anlamlı) — `adr` o durumda boştur. */
  readonly adr: Uint8Array;
}

/**
 * NPDU çözümünün özeti. `consumed`, NPDU'nun (network-layer-message ise onun
 * Message Type/Vendor ID alanları DAHİL) tükettiği bayt sayısıdır — çağıran
 * bunu `data`ya uygulayıp kalan baytları (varsa) `decodeApdu`ya geçirir. Hiçbir
 * alan opsiyonel (`?:`) DEĞİLDİR — hepsi `| undefined` ile hep-var alanlardır,
 * böylece out-parameter dönüşünde `exactOptionalPropertyTypes` riski olmadan
 * her yol aynı şekli üretir (`decodeAsdu`nun `AsduSummary`siyle aynı disiplin).
 */
export interface NpduSummary {
  readonly consumed: number;
  readonly isNetworkLayerMessage: boolean;
  readonly destination: NpduAddress | undefined;
  readonly source: NpduAddress | undefined;
  readonly hopCount: number | undefined;
  readonly networkMessageType: number | undefined;
  readonly networkMessageTypeLabel: string | undefined;
}

function pushBitField(
  fields: ParsedField[],
  id: string,
  name: string,
  offset: number,
  rawBytes: Uint8Array,
  rawValue: number,
  physicalValue?: string,
): void {
  const field: ParsedField = { id, name, offset, length: 1, rawBytes, rawValue, valid: true, warnings: [] };
  if (physicalValue !== undefined) field.physicalValue = physicalValue;
  fields.push(field);
}

/** DNET/DLEN/DADR ya da SNET/SLEN/SADR üçlüsünü çözer — ikisi de aynı şekli paylaşır. */
function decodeAddressBlock(
  data: Uint8Array,
  pos: number,
  baseOffset: number,
  idPrefix: string,
  namePrefix: string,
  fields: ParsedField[],
  errors: ProtocolError[],
): { readonly address: NpduAddress; readonly consumed: number } | undefined {
  if (data.length - pos < 3) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_NPDU_TRUNCATED,
      offset: baseOffset + pos,
      length: data.length - pos,
    });
    return undefined;
  }
  const net = readUint16BE(data, pos);
  fields.push({
    id: `${idPrefix}-net`,
    name: `${namePrefix}NET`,
    offset: baseOffset + pos,
    length: 2,
    rawBytes: data.slice(pos, pos + 2),
    rawValue: net,
    valid: true,
    warnings: [],
  });
  const len = byteAt(data, pos + 2);
  const lenField: ParsedField = {
    id: `${idPrefix}-len`,
    name: `${namePrefix}LEN`,
    offset: baseOffset + pos + 2,
    length: 1,
    rawBytes: data.slice(pos + 2, pos + 3),
    rawValue: len,
    valid: true,
    warnings: [],
  };
  // DLEN=0 broadcast'tir (yalnız destination'da anlamlı) — dosya başı kaynak uyarısı.
  if (len === 0) lenField.physicalValue = 'broadcast';
  fields.push(lenField);

  if (data.length - (pos + 3) < len) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_NPDU_TRUNCATED,
      offset: baseOffset + pos + 3,
      length: data.length - (pos + 3),
    });
    return undefined;
  }
  const adr = data.slice(pos + 3, pos + 3 + len);
  let consumed = 3;
  if (len > 0) {
    fields.push({
      id: `${idPrefix}-adr`,
      name: `${namePrefix}ADR`,
      offset: baseOffset + pos + 3,
      length: len,
      rawBytes: adr,
      valid: true,
      warnings: [],
    });
    consumed += len;
  }
  return { address: { net, len, adr }, consumed };
}

/**
 * NPDU'yu çözer, alanları `fields`e PUSH eder. `data` NPDU'nun BAŞLADIĞI
 * yerden (Version okteti) itibaren kalan TÜM baytlardır; `baseOffset` bu
 * baytların ORİJİNAL çerçevedeki (MS/TP Data alanı ya da BVLL sonrası) mutlak
 * konumudur — 6g bu çekirdeği BVLL'den sonraki baytlarla AYNI şekilde çağırır.
 */
export function decodeNpdu(
  data: Uint8Array,
  baseOffset: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
): NpduSummary {
  const MIN_NPDU_LENGTH = 2; // Version + Control, asgari.

  let pos = 0;
  let destination: NpduAddress | undefined;
  let source: NpduAddress | undefined;
  let hopCount: number | undefined;
  let networkMessageType: number | undefined;
  let networkMessageTypeLabel: string | undefined;
  let isNetworkLayerMessage = false;

  const summary = (): NpduSummary => ({
    consumed: pos,
    isNetworkLayerMessage,
    destination,
    source,
    hopCount,
    networkMessageType,
    networkMessageTypeLabel,
  });

  if (data.length < MIN_NPDU_LENGTH) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_NPDU_TRUNCATED,
      offset: baseOffset,
      length: data.length,
      details: { availableBytes: data.length, requiredBytes: MIN_NPDU_LENGTH },
    });
    return summary();
  }

  const version = byteAt(data, pos);
  const versionField: ParsedField = {
    id: 'npdu-version',
    name: 'NPDU Version',
    offset: baseOffset + pos,
    length: 1,
    rawBytes: data.slice(pos, pos + 1),
    rawValue: version,
    valid: version === NPDU_SUPPORTED_VERSION,
    warnings: [],
  };
  if (version !== NPDU_SUPPORTED_VERSION) {
    versionField.warnings.push(WARN_UNEXPECTED_NPDU_VERSION);
    warnings.push(toProtocolWarning(WARN_UNEXPECTED_NPDU_VERSION, baseOffset + pos, 1));
  }
  fields.push(versionField);
  pos += 1;

  // Control okteti henüz tüketilmedi (pos hâlâ bu bayta işaret ediyor) — bit
  // alanları bitCursor ile `data` ÜZERİNDE (baseOffset'siz, yerel) okunur.
  const controlBitBase = pos * 8;
  isNetworkLayerMessage = readBitsAsNumber(data, controlBitBase + CTRL_NETWORK_LAYER_MESSAGE_BIT, 1) === 1;
  const destinationSpecifierPresent =
    readBitsAsNumber(data, controlBitBase + CTRL_DESTINATION_SPECIFIER_BIT, 1) === 1;
  const sourceSpecifierPresent = readBitsAsNumber(data, controlBitBase + CTRL_SOURCE_SPECIFIER_BIT, 1) === 1;
  const expectingReply = readBitsAsNumber(data, controlBitBase + CTRL_EXPECTING_REPLY_BIT, 1) === 1;
  const priority = readBitsAsNumber(data, controlBitBase + CTRL_PRIORITY_BIT, 2);

  const controlRawBytes = data.slice(pos, pos + 1);
  pushBitField(
    fields,
    'npdu-network-layer-message',
    'Network Layer Message',
    baseOffset + pos,
    controlRawBytes,
    isNetworkLayerMessage ? 1 : 0,
  );
  pushBitField(
    fields,
    'npdu-destination-specifier',
    'Destination Specifier',
    baseOffset + pos,
    controlRawBytes,
    destinationSpecifierPresent ? 1 : 0,
  );
  pushBitField(
    fields,
    'npdu-source-specifier',
    'Source Specifier',
    baseOffset + pos,
    controlRawBytes,
    sourceSpecifierPresent ? 1 : 0,
  );
  pushBitField(
    fields,
    'npdu-expecting-reply',
    'Expecting Reply',
    baseOffset + pos,
    controlRawBytes,
    expectingReply ? 1 : 0,
  );
  pushBitField(
    fields,
    'npdu-priority',
    'Priority',
    baseOffset + pos,
    controlRawBytes,
    priority,
    PRIORITY_NAMES.get(priority),
  );
  pos += 1;

  if (destinationSpecifierPresent) {
    const result = decodeAddressBlock(data, pos, baseOffset, 'npdu-destination', 'D', fields, errors);
    if (result === undefined) return summary();
    destination = result.address;
    pos += result.consumed;
  }

  if (sourceSpecifierPresent) {
    const result = decodeAddressBlock(data, pos, baseOffset, 'npdu-source', 'S', fields, errors);
    if (result === undefined) return summary();
    source = result.address;
    pos += result.consumed;
  }

  // Hop Count yalnız DESTINATION varsa vardır ve SADR bloğundan SONRA gelir —
  // Source'a değil Destination'a bağlıdır (dosya başı kaynak uyarısı, sıra).
  if (destinationSpecifierPresent) {
    if (data.length - pos < 1) {
      errors.push({ code: 'truncated-frame', message: ERROR_NPDU_TRUNCATED, offset: baseOffset + pos, length: 0 });
      return summary();
    }
    hopCount = byteAt(data, pos);
    fields.push({
      id: 'npdu-hop-count',
      name: 'Hop Count',
      offset: baseOffset + pos,
      length: 1,
      rawBytes: data.slice(pos, pos + 1),
      rawValue: hopCount,
      valid: true,
      warnings: [],
    });
    pos += 1;
  }

  if (!isNetworkLayerMessage) {
    return summary();
  }

  if (data.length - pos < 1) {
    errors.push({ code: 'truncated-frame', message: ERROR_NPDU_TRUNCATED, offset: baseOffset + pos, length: 0 });
    return summary();
  }
  networkMessageType = byteAt(data, pos);
  networkMessageTypeLabel = NETWORK_MESSAGE_TYPE_NAMES.get(networkMessageType);
  const messageTypeField: ParsedField = {
    id: 'npdu-network-message-type',
    name: 'Network Layer Message Type',
    offset: baseOffset + pos,
    length: 1,
    rawBytes: data.slice(pos, pos + 1),
    rawValue: networkMessageType,
    valid: networkMessageTypeLabel !== undefined,
    warnings: [],
  };
  if (networkMessageTypeLabel !== undefined) {
    messageTypeField.physicalValue = networkMessageTypeLabel;
  } else {
    messageTypeField.warnings.push(WARN_UNKNOWN_NETWORK_MESSAGE_TYPE);
    warnings.push(toProtocolWarning(WARN_UNKNOWN_NETWORK_MESSAGE_TYPE, baseOffset + pos, 1));
  }
  fields.push(messageTypeField);
  pos += 1;

  if (networkMessageType >= NETWORK_MESSAGE_VENDOR_PROPRIETARY_MIN) {
    if (data.length - pos < 2) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_NPDU_TRUNCATED,
        offset: baseOffset + pos,
        length: data.length - pos,
      });
      return summary();
    }
    const vendorId = readUint16BE(data, pos);
    fields.push({
      id: 'npdu-vendor-id',
      name: 'Vendor ID',
      offset: baseOffset + pos,
      length: 2,
      rawBytes: data.slice(pos, pos + 2),
      rawValue: vendorId,
      valid: true,
      warnings: [],
    });
    pos += 2;
  }

  return summary();
}

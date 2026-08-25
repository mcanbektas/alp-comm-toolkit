/**
 * UAVCAN Compatibility — kendi teli OLMAYAN bir **SINIFLANDIRICI**.
 *
 * Faz 10, dalga 15b. Bu kayıt bir wire protokolü DEĞİLDİR: "UAVCAN" adının
 * iki ayrı hattı (v0 → DroneCAN, v1 → Cyphal) işaret etmesinden doğan
 * karışıklığı çözer. Spec bunu bir ÜRÜN GEREKSİNİMİ olarak yazıyor:
 * *"auto-detection sonucu `Legacy UAVCAN / DroneCAN candidate` veya
 * `Cyphal/CAN candidate` şeklinde gösterilmelidir"* ve *"belirsiz
 * `Protocol: UAVCAN` seçeneği kabul edilmemeli"*
 * (`docs/spec/ozet/06-havacilik-uav.md:111`, `:182`, `:536`).
 *
 * ── NE YAPAR, NE YAPMAZ ─────────────────────────────────────────────────────
 * **YAPAR:** 29-bit CAN ID'yi ve tail byte'ı İKİ düzene göre okur, hangisinin
 * tutarlı olduğunu raporlar, ayrım KANITLARINI alan tablosuna basar ve
 * kullanıcıyı kaydı gerçekten çözen sayfaya yönlendirir (`ipv4.ts`in
 * "üst katmanı şu sayfada çöz" deseninin aynısı).
 *
 * **YAPMAZ:** alan çözmez, CRC hesaplamaz, payload'a dokunmaz. **İki çekirdeği
 * (`droneCanParser.parse` / `cyphalParser.parse`) ÇAĞIRMAZ** — bu sayfada
 * DroneCAN'in ya da Cyphal'ın alan tablosu ÜRETİLMEZ, yalnız aday tablosu
 * üretilir. `dronecan.ts` ve `cyphal.ts`ten alınan tek şey **SAF ayrım
 * yardımcılarıdır** (`decodeDroneCanIdentity`, `decodeDroneCanTailByte`,
 * `decodeCyphalIdentity`, `decodeCyphalTailByte`, `isCyphalV11MessageLayout`):
 * bit düzenleri ÜÇÜNCÜ kez KOPYALANMAZ — `cipCore.ts`/`xcpPacket.ts` sınıfı bir
 * TÜKETİM, `ccp.ts`in reddettiği türden bir BİRLEŞTİRME değil.
 *
 * ── `canParse` DAİMA `false` — BU BİR EKSİKLİK DEĞİL, KARARDIR ──────────────
 * Bu kaydın kendi tel biçimi YOKTUR: girdisi, `dronecan` ve `cyphal`ın da
 * girdisi olan aynı 16 baytlık SocketCAN konteyneridir. `canParse` `true`
 * dönseydi otomatik algılamada HER UAVCAN çerçevesini kendine çeker ve
 * gerçekten çözen iki kaydın çerçevesini ÇALARDI — registry'nin aday listesi
 * çöpe dönerdi. Kullanıcı bu sayfayı **açıkça seçer**; kaydın varlık sebebi
 * (`Protocol Selector Guard`) tam olarak budur. `parse()` bundan
 * ETKİLENMEZ — sayfa açıldığında ve örnek seçildiğinde tam çalışır.
 *
 * ── SINIFLANDIRMA ÖLÇÜTÜ — kaynağı olan TEK kesin ayrım ─────────────────────
 * **Transferin İLK çerçevesindeki (SOT=1) toggle biti.** DroneCAN'de 0'dan,
 * Cyphal'da 1'den başlar. Bu, referans uygulamanın KENDİ sürüm tespitidir —
 * BİREBİR alıntı, kaynağı `OpenCyphal/libcanard`, `libcanard/canard.c`
 * **satır 1117-1120** (2026-08-25'te doğrudan indirildi; dosya md5
 * `78af03ac4e918317ba963fa87a648328`, 102994 bayt):
 * https://github.com/OpenCyphal/libcanard/blob/master/libcanard/canard.c#L1117-L1120
 *
 *   // Version detection: v1 requires the toggle to start from 1, v0 starts from 0.
 *   // If this is not the first frame of a transfer, the version is not detectable, so we attempt to parse both.
 *   bool is_v1 = !(start && !toggle) && payload_ok;
 *   bool is_v0 = !(start && toggle) && payload_ok;
 *
 * (İkinci yorum satırı kaynakta TEK satırdır — burada da tek satır tutuldu ki
 * birebir `grep` eşleşsin. `dronecan/libcanard`de bu kod YOKTUR: o depo yalnız
 * v0'ı uygular; sürüm tespiti iki hattı BİRLİKTE çözen OpenCyphal sürümüne
 * özgüdür.)
 *
 * Aynı iki koşul `OpenCyphal/pycyphal`de de var — `src/pycyphal2/can/_wire.py`
 * `parse_frames`, satır 197 (`if not (start and toggle):` → v0 dalı) ve 236
 * (`if start and not toggle: return` → v1 dalından çıkış); TX tarafı satır 119
 * `toggle = True` ile transferi 1'den başlatıyor:
 * https://github.com/OpenCyphal/pycyphal/blob/master/src/pycyphal2/can/_wire.py
 *
 * v0 tarafı BAĞIMSIZ olarak `dronecan/libcanard`de de doğrulanır
 * (https://github.com/dronecan/libcanard/blob/master/canard.c):
 * `:494` `rx_state->next_toggle = 0;` (SOT sonrası sıfırdan başlar) · `:667`
 * her çerçevede döner · `:536-538` uyuşmazlık `CANARD_ERROR_RX_WRONG_TOGGLE`.
 *
 * Bu yüzden:
 *
 *   • **SOT=1, Toggle=1** → Cyphal adayı `high`, DroneCAN **dışlandı**.
 *   • **SOT=1, Toggle=0** → DroneCAN adayı `high`, Cyphal **dışlandı**.
 *   • **SOT=0 (devam çerçevesi)** → toggle sürüm bilgisi TAŞIMAZ; iki hat da
 *     `low` güvenle aday kalır → **BELİRSİZ, kullanıcı SEÇMELİ**. Referans
 *     uygulama da tam olarak bunu yapıyor ("attempt to parse both").
 *
 * Toggle tek başına yetmediği yerde her hattın KENDİ yapısal kuralları da
 * uygulanır ve bir kural çiğnendiğinde o hat `excluded` olur (aşağıdaki
 * `classifyUavcanFrame`). Bunlar `dronecan.ts`/`cyphal.ts` dosya başlarındaki
 * resmî spec alıntılarının aynısıdır; burada YENİDEN TÜRETİLMEZ, uygulanır.
 *
 * ── TRANSFER-ID BİR AYRIM ÖLÇÜTÜ DEĞİLDİR ───────────────────────────────────
 * Ana brif "v1'de transfer-ID genişliği farklı olabilir" diyordu; kaynak turu
 * bunu ÇÜRÜTTÜ: iki hatta da 5 bit, modulo 32 (`cyphal.ts` kaynak turu madde
 * 3). Alan tablosunda GÖSTERİLİR ama "paylaşılan, ayırt edici değil" diye
 * işaretlenir — sessizce bir kanıt gibi kullanılmaz.
 *
 * ── KAPSAM DIŞI ─────────────────────────────────────────────────────────────
 * • Çerçeveler arası oy toplama (bir yakalamanın TAMAMINA bakıp hattı kesin
 *   söylemek) — analyzer işi (`mavlink.ts`in SEQ-LOSS kararı, bulgu 10).
 *   Bu parser TEK çerçeveye bakar.
 * • Cyphal/UDP, Cyphal/Serial, CAN FD — `cyphal.ts` kapsamının aynısı.
 * • Alan çözümü, CRC, payload — yukarı bakın.
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
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

import { buildCanClassicFrame } from '../../automotive/can/canClassic';
import {
  CAN_CLASSIC_FRAME_LENGTH,
  CAN_CLASSIC_MAX_PAYLOAD,
  CAN_FD_FRAME_LENGTH,
  CAN_HEADER_LENGTH,
  decodeCanId,
  formatHex,
  readUint32Le,
} from '../../automotive/can/canFrame';
import { decodeDroneCanIdentity, decodeDroneCanTailByte } from '../dronecan/dronecan';
import {
  CYPHAL_SPEC_V1_0,
  decodeCyphalIdentity,
  decodeCyphalTailByte,
  isCyphalV11MessageLayout,
} from '../cyphal/cyphal';

const PROTOCOL_ID = 'uavcan-compatibility';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md); katalog kaydıyla BİREBİR aynı. */
const PROTOCOL_DISPLAY_NAME = 'UAVCAN Compatibility';

const CAN_ID_FIELD_OFFSET = 0;
const CAN_ID_FIELD_LENGTH = 4;
const DLC_OFFSET = 4;

const CYPHAL_SNM_SHIFT = 25;
const CYPHAL_RESERVED_23_SHIFT = 23;
const DRONECAN_SNM_SHIFT = 7;

const ERROR_FRAME_TOO_SHORT = 'protocol.uavcanCompatibility.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.uavcanCompatibility.error.frameTooLong';
const ERROR_CAN_FD_NOT_SUPPORTED = 'protocol.uavcanCompatibility.error.canFdNotSupported';
const ERROR_NOT_EXTENDED = 'protocol.uavcanCompatibility.error.notExtended';
const ERROR_TAIL_BYTE_MISSING = 'protocol.uavcanCompatibility.error.tailByteMissing';
const ERROR_ABORTED = 'protocol.uavcanCompatibility.error.aborted';

const WARN_CLASSIFIER_DOES_NOT_DECODE =
  'protocol.uavcanCompatibility.warning.classifierDoesNotDecode';
const WARN_NOT_IN_AUTO_DETECTION = 'protocol.uavcanCompatibility.warning.notInAutoDetection';
const WARN_SELECT_DRONECAN_PAGE = 'protocol.uavcanCompatibility.warning.selectDroneCanPage';
const WARN_SELECT_CYPHAL_PAGE = 'protocol.uavcanCompatibility.warning.selectCyphalPage';
const WARN_AMBIGUOUS_USER_MUST_CHOOSE =
  'protocol.uavcanCompatibility.warning.ambiguousUserMustChoose';
const WARN_NO_CANDIDATE = 'protocol.uavcanCompatibility.warning.noCandidate';

const SUMMARY_PREFIX = 'protocol.uavcanCompatibility.summary.';

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

// ── Sınıflandırma ───────────────────────────────────────────────────────────

export type UavcanLine = 'dronecan' | 'cyphal';
export type UavcanConfidence = 'high' | 'low' | 'excluded';
export type UavcanDecision = UavcanLine | 'ambiguous' | 'none';

export interface UavcanCandidate {
  readonly line: UavcanLine;
  readonly confidence: UavcanConfidence;
  /**
   * Kararın tek cümlelik gerekçesi. Çeviri anahtarı DEĞİL, teknik veri
   * (`dronecan.ts`in `TRANSFER_TYPE_LABEL`i gibi) — çeviriye giren metin
   * çerçeve/alan UYARILARIDIR, bu değer onların içine parametre olarak girer.
   */
  readonly reason: string;
}

export interface UavcanClassification {
  readonly droneCan: UavcanCandidate;
  readonly cyphal: UavcanCandidate;
  readonly decision: UavcanDecision;
}

const REASON_TOGGLE_SET = 'toggle = 1 on start of transfer';
const REASON_TOGGLE_CLEAR = 'toggle = 0 on start of transfer';
const REASON_TOGGLE_WRONG_FOR_LINE = 'toggle contradicts the start-of-transfer rule of this line';
const REASON_NO_VERSION_EVIDENCE = 'continuation frame carries no version evidence';
const REASON_NON_LAST_FRAME_NOT_FULL = 'non-last frame does not fully use the data field';
const REASON_ANONYMOUS_MULTI_FRAME = 'anonymous transfer is not single-frame';
const REASON_SERVICE_NODE_ID_ZERO = 'service transfer uses node-ID 0';
const REASON_SERVICE_SELF_ADDRESSED = 'service transfer is self-addressed';
const REASON_RESERVED_23_SET = 'reserved bit 23 is set';
const REASON_RESERVED_7_SET = 'reserved bit 7 is set (v1.1 layout, opt-in only)';

function candidate(line: UavcanLine, confidence: UavcanConfidence, reason: string): UavcanCandidate {
  return { line, confidence, reason };
}

/**
 * Tek bir 29-bit CAN çerçevesini iki hatta göre değerlendirir.
 *
 * SAF fonksiyon: yalnız CAN ID, tail byte ve DLC'ye bakar; hiçbir parser
 * ÇAĞIRMAZ (dosya başı). Sıra: (1) her hattın KENDİ yapısal kuralları,
 * (2) toggle kanıtı. Yapısal bir kural çiğnenirse toggle'a BAKILMAZ — hat
 * zaten dışlanmıştır.
 */
export function classifyUavcanFrame(
  extendedCanId: number,
  tailByteValue: number,
  declaredLength: number,
): UavcanClassification {
  const id = extendedCanId >>> 0;

  // ── DroneCAN (UAVCAN v0) ──
  const v0Tail = decodeDroneCanTailByte(tailByteValue);
  const v0Identity = decodeDroneCanIdentity(id);
  let droneCan: UavcanCandidate;
  if (!v0Tail.endOfTransfer && declaredLength !== CAN_CLASSIC_MAX_PAYLOAD) {
    droneCan = candidate('dronecan', 'excluded', REASON_NON_LAST_FRAME_NOT_FULL);
  } else if (
    v0Identity.kind === 'anonymous-message' &&
    v0Tail.frameRole !== 'single-frame'
  ) {
    droneCan = candidate('dronecan', 'excluded', REASON_ANONYMOUS_MULTI_FRAME);
  } else if (
    (v0Identity.kind === 'service-request' || v0Identity.kind === 'service-response') &&
    (v0Identity.sourceNodeId === 0 || v0Identity.destinationNodeId === 0)
  ) {
    droneCan = candidate('dronecan', 'excluded', REASON_SERVICE_NODE_ID_ZERO);
  } else if (v0Tail.startOfTransfer) {
    droneCan = v0Tail.toggle
      ? candidate('dronecan', 'excluded', REASON_TOGGLE_WRONG_FOR_LINE)
      : candidate('dronecan', 'high', REASON_TOGGLE_CLEAR);
  } else {
    droneCan = candidate('dronecan', 'low', REASON_NO_VERSION_EVIDENCE);
  }

  // ── Cyphal (UAVCAN v1) ──
  const v1Tail = decodeCyphalTailByte(tailByteValue);
  const v1Identity = decodeCyphalIdentity(id, CYPHAL_SPEC_V1_0);
  let cyphal: UavcanCandidate;
  if (!v1Identity.reserved23Zero) {
    cyphal = candidate('cyphal', 'excluded', REASON_RESERVED_23_SET);
  } else if (isCyphalV11MessageLayout(id)) {
    cyphal = candidate('cyphal', 'excluded', REASON_RESERVED_7_SET);
  } else if (!v1Tail.endOfTransfer && declaredLength !== CAN_CLASSIC_MAX_PAYLOAD) {
    cyphal = candidate('cyphal', 'excluded', REASON_NON_LAST_FRAME_NOT_FULL);
  } else if (
    v1Identity.kind === 'message' &&
    v1Identity.anonymous &&
    v1Tail.frameRole !== 'single-frame'
  ) {
    cyphal = candidate('cyphal', 'excluded', REASON_ANONYMOUS_MULTI_FRAME);
  } else if (
    v1Identity.kind !== 'message' &&
    v1Identity.sourceNodeId === v1Identity.destinationNodeId
  ) {
    cyphal = candidate('cyphal', 'excluded', REASON_SERVICE_SELF_ADDRESSED);
  } else if (v1Tail.startOfTransfer) {
    cyphal = v1Tail.toggle
      ? candidate('cyphal', 'high', REASON_TOGGLE_SET)
      : candidate('cyphal', 'excluded', REASON_TOGGLE_WRONG_FOR_LINE);
  } else {
    cyphal = candidate('cyphal', 'low', REASON_NO_VERSION_EVIDENCE);
  }

  const droneCanPossible = droneCan.confidence !== 'excluded';
  const cyphalPossible = cyphal.confidence !== 'excluded';
  let decision: UavcanDecision;
  if (droneCanPossible && cyphalPossible) {
    decision = 'ambiguous';
  } else if (droneCanPossible) {
    decision = 'dronecan';
  } else if (cyphalPossible) {
    decision = 'cyphal';
  } else {
    decision = 'none';
  }

  return { droneCan, cyphal, decision };
}

const LINE_LABEL: Record<UavcanLine, string> = {
  dronecan: 'DroneCAN (UAVCAN v0)',
  cyphal: 'Cyphal (UAVCAN v1)',
};

const DECISION_LABEL: Record<UavcanDecision, string> = {
  dronecan: 'DroneCAN (UAVCAN v0) — decode on the DroneCAN page',
  cyphal: 'Cyphal (UAVCAN v1) — decode on the Cyphal page',
  ambiguous: 'Ambiguous — you must choose the line',
  none: 'No candidate — neither layout fits',
};

// `interface` DEĞİL `type`: `RawFrameInit.metadata` `Record<string, unknown>`
// bekliyor (dronecan.ts/cyphal.ts ile aynı sebep).
export type UavcanCompatibilityFrameMetadata = {
  readonly classification?: UavcanClassification;
  readonly payloadLength: number;
  readonly summaryKey: string;
  readonly summaryParams: Record<string, string>;
};

function evidenceField(
  id: string,
  name: string,
  offset: number,
  length: number,
  rawBytes: Uint8Array,
  rawValue: number | string,
  physicalValue: string,
): ParsedField {
  return { id, name, offset, length, rawBytes, rawValue, physicalValue, valid: true, warnings: [] };
}

interface UavcanCompatibilityParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseUavcanCompatibilityFrame(
  data: Uint8Array,
  options: UavcanCompatibilityParseOptions,
): ParseResult {
  if (options.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < CAN_HEADER_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_FRAME_TOO_SHORT,
        offset: 0,
        length: data.length,
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  // İki hattın da (bu aracın kapsamında) CAN FD'si YOK — sınıflandırılacak
  // bir şey de yok. `cyphal.ts`/`dronecan.ts` ile aynı ret yolu.
  if (data.length === CAN_FD_FRAME_LENGTH) {
    return {
      success: false,
      error: {
        code: 'unsupported-encoding',
        message: ERROR_CAN_FD_NOT_SUPPORTED,
        offset: 0,
        length: data.length,
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const maxFrameLength = options.maxFrameLength ?? CAN_CLASSIC_FRAME_LENGTH;
  if (data.length > maxFrameLength) {
    return {
      success: false,
      error: {
        code: 'frame-too-long',
        message: ERROR_FRAME_TOO_LONG,
        offset: maxFrameLength,
        length: data.length - maxFrameLength,
        details: { maxFrameLength, frameLength: data.length },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const identity = decodeCanId(readUint32Le(data, 0));
  const fields: ParsedField[] = [];
  const errors: ProtocolError[] = [];
  // Bu iki uyarı KOŞULSUZDUR: kaydın varlık sebebi budur (dosya başı).
  const warnings: ProtocolWarning[] = [
    toProtocolWarning(WARN_CLASSIFIER_DOES_NOT_DECODE),
    toProtocolWarning(WARN_NOT_IN_AUTO_DETECTION),
  ];

  const canIdBytes = data.slice(CAN_ID_FIELD_OFFSET, CAN_ID_FIELD_OFFSET + CAN_ID_FIELD_LENGTH);
  fields.push({
    id: 'can-id',
    name: 'CAN ID',
    offset: CAN_ID_FIELD_OFFSET,
    length: CAN_ID_FIELD_LENGTH,
    rawBytes: canIdBytes,
    rawValue: identity.id,
    physicalValue: identity.extended ? 'Extended / 29-bit' : 'Base / 11-bit',
    valid: identity.extended,
    warnings: [],
  });

  const declaredLength = byteAt(data, DLC_OFFSET);
  const availableAfterHeader = Math.max(0, data.length - CAN_HEADER_LENGTH);
  const payloadLength = Math.min(declaredLength, CAN_CLASSIC_MAX_PAYLOAD, availableAfterHeader);

  fields.push({
    id: 'dlc',
    name: 'DLC',
    offset: DLC_OFFSET,
    length: 1,
    rawBytes: data.slice(DLC_OFFSET, DLC_OFFSET + 1),
    rawValue: declaredLength,
    physicalValue: payloadLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  let classification: UavcanClassification | undefined;

  if (!identity.extended) {
    errors.push({
      code: 'value-out-of-range',
      message: ERROR_NOT_EXTENDED,
      offset: CAN_ID_FIELD_OFFSET,
      length: CAN_ID_FIELD_LENGTH,
      details: { canId: formatHex(identity.id, 3), requiredFormat: 'extended' },
    });
  } else if (payloadLength < 1) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_TAIL_BYTE_MISSING,
      offset: CAN_HEADER_LENGTH,
      length: 0,
    });
  } else {
    const tailByteOffset = CAN_HEADER_LENGTH + payloadLength - 1;
    const tailBytes = data.slice(tailByteOffset, tailByteOffset + 1);
    const tailByteValue = byteAt(data, tailByteOffset);
    // Tail byte'ın alan bölümü İKİ hatta da AYNIDIR (SOT/EOT/Toggle/5-bit
    // Transfer-ID); ayrım toggle'ın DEĞERİNDEDİR, yerleşiminde değil.
    const tail = decodeCyphalTailByte(tailByteValue);
    classification = classifyUavcanFrame(identity.id, tailByteValue, declaredLength);

    fields.push(
      evidenceField(
        'evidence-sot',
        'Evidence · Tail Start Of Transfer (bit 7)',
        tailByteOffset,
        1,
        tailBytes,
        tail.startOfTransfer ? 1 : 0,
        tail.startOfTransfer
          ? 'Set — the toggle bit below is decisive'
          : 'Not set — continuation frame, no version evidence',
      ),
      evidenceField(
        'evidence-toggle',
        'Evidence · Tail Toggle (bit 5)',
        tailByteOffset,
        1,
        tailBytes,
        tail.toggle ? 1 : 0,
        tail.startOfTransfer
          ? tail.toggle
            ? 'Set — Cyphal (UAVCAN v1) signature'
            : 'Not set — DroneCAN (UAVCAN v0) signature'
          : 'Not decisive on a continuation frame',
      ),
      evidenceField(
        'evidence-transfer-id',
        'Evidence · Tail Transfer ID (bit 4:0)',
        tailByteOffset,
        1,
        tailBytes,
        tail.transferId,
        'Shared — 5 bits, modulo 32 in both lines (not a discriminator)',
      ),
      evidenceField(
        'evidence-dronecan-snm',
        'Evidence · DroneCAN Service-Not-Message (bit 7)',
        CAN_ID_FIELD_OFFSET,
        CAN_ID_FIELD_LENGTH,
        canIdBytes,
        (identity.id >>> DRONECAN_SNM_SHIFT) & 0x1,
        ((identity.id >>> DRONECAN_SNM_SHIFT) & 0x1) === 1
          ? 'Service under the v0 layout'
          : 'Message under the v0 layout',
      ),
      evidenceField(
        'evidence-cyphal-snm',
        'Evidence · Cyphal Service-Not-Message (bit 25)',
        CAN_ID_FIELD_OFFSET,
        CAN_ID_FIELD_LENGTH,
        canIdBytes,
        (identity.id >>> CYPHAL_SNM_SHIFT) & 0x1,
        ((identity.id >>> CYPHAL_SNM_SHIFT) & 0x1) === 1
          ? 'Service under the v1 layout'
          : 'Message under the v1 layout',
      ),
      evidenceField(
        'evidence-cyphal-reserved-23',
        'Evidence · Cyphal Reserved (bit 23)',
        CAN_ID_FIELD_OFFSET,
        CAN_ID_FIELD_LENGTH,
        canIdBytes,
        (identity.id >>> CYPHAL_RESERVED_23_SHIFT) & 0x1,
        ((identity.id >>> CYPHAL_RESERVED_23_SHIFT) & 0x1) === 0
          ? 'Zero — allowed by the v1 layout'
          : 'Set — the v1 specification requires discarding the frame',
      ),
      evidenceField(
        'candidate-dronecan',
        `Candidate · ${LINE_LABEL.dronecan}`,
        CAN_ID_FIELD_OFFSET,
        CAN_ID_FIELD_LENGTH,
        canIdBytes,
        classification.droneCan.confidence,
        `${classification.droneCan.confidence.toUpperCase()} — ${classification.droneCan.reason}`,
      ),
      evidenceField(
        'candidate-cyphal',
        `Candidate · ${LINE_LABEL.cyphal}`,
        CAN_ID_FIELD_OFFSET,
        CAN_ID_FIELD_LENGTH,
        canIdBytes,
        classification.cyphal.confidence,
        `${classification.cyphal.confidence.toUpperCase()} — ${classification.cyphal.reason}`,
      ),
      evidenceField(
        'decision',
        'Decision',
        CAN_ID_FIELD_OFFSET,
        CAN_ID_FIELD_LENGTH,
        canIdBytes,
        classification.decision,
        DECISION_LABEL[classification.decision],
      ),
    );

    switch (classification.decision) {
      case 'dronecan':
        warnings.push(toProtocolWarning(WARN_SELECT_DRONECAN_PAGE));
        break;
      case 'cyphal':
        warnings.push(toProtocolWarning(WARN_SELECT_CYPHAL_PAGE));
        break;
      case 'ambiguous':
        warnings.push(toProtocolWarning(WARN_AMBIGUOUS_USER_MUST_CHOOSE));
        break;
      case 'none':
        warnings.push(toProtocolWarning(WARN_NO_CANDIDATE));
        break;
    }
  }

  let summaryKey: string;
  let summaryParams: Record<string, string>;
  if (classification === undefined) {
    summaryKey = `${SUMMARY_PREFIX}notExtended`;
    summaryParams = {};
  } else if (classification.decision === 'dronecan') {
    summaryKey = `${SUMMARY_PREFIX}dronecan`;
    summaryParams = {
      confidence: classification.droneCan.confidence.toUpperCase(),
      reason: classification.droneCan.reason,
    };
  } else if (classification.decision === 'cyphal') {
    summaryKey = `${SUMMARY_PREFIX}cyphal`;
    summaryParams = {
      confidence: classification.cyphal.confidence.toUpperCase(),
      reason: classification.cyphal.reason,
    };
  } else if (classification.decision === 'ambiguous') {
    summaryKey = `${SUMMARY_PREFIX}ambiguous`;
    summaryParams = {};
  } else {
    summaryKey = `${SUMMARY_PREFIX}none`;
    summaryParams = {};
  }

  const metadata: UavcanCompatibilityFrameMetadata = {
    ...(classification === undefined ? {} : { classification }),
    payloadLength,
    summaryKey,
    summaryParams,
  };

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
    warnings,
  };

  return { success: true, frame, consumedBytes: data.length };
}

export function parseUavcanCompatibility(data: Uint8Array): ParseResult {
  return parseUavcanCompatibilityFrame(data, {});
}

export const uavcanCompatibilityParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * **DAİMA `false`.** Girdi hiç okunmaz — bu bir eksiklik değil, KARARDIR
   * (dosya başı "canParse DAİMA false"). Bu kaydın kendi tel biçimi yoktur;
   * `true` dönmek `dronecan`/`cyphal`in çerçevesini otomatik algılamada
   * çalmak olurdu. Kullanıcı sayfayı AÇIKÇA seçer.
   *
   * `uavcanCompatibility.test.ts` bunu `dronecan`/`cyphal`in KABUL ETTİĞİ
   * çerçeveler üzerinde de kanıtlar — "hiç çerçeve gelmediği için false
   * dönüyor" yanılgısına yer bırakmaz.
   */
  canParse(): boolean {
    return false;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    const options: UavcanCompatibilityParseOptions = {};
    if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
    if (context?.direction !== undefined) options.direction = context.direction;
    if (context?.channel !== undefined) options.channel = context.channel;
    if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
    if (context?.signal !== undefined) options.signal = context.signal;
    return parseUavcanCompatibilityFrame(data, options);
  },
};

/**
 * Örnek çerçeveler — dört sınıflandırma sonucunun her biri için bir tane,
 * artı ret yolu. CAN ID'ler iki kaydın KENDİ örneklerinden gelir (Cyphal
 * tarafı resmî spec "Examples" bölümünden, DroneCAN tarafı 15a'nın spec tail
 * byte örneği `0xC5`ten) — burada yeni bir sayı UYDURULMADI.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'cyphal-start-of-transfer',
    name: 'protocol.uavcanCompatibility.example.cyphalStartOfTransfer.name',
    // Cyphal spec "Examples": Heartbeat, CAN ID 0x107D552A, tail 0xE0
    // (SOT=1, EOT=1, Toggle=1) → Toggle 1 DroneCAN'i doğrudan dışlar.
    bytes: buildCanClassicFrame(
      0x107d552a,
      [0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0xa1, 0xe0],
      { extended: true },
    ),
    description: 'protocol.uavcanCompatibility.example.cyphalStartOfTransfer.description',
    expectedValid: true,
  },
  {
    id: 'dronecan-start-of-transfer',
    name: 'protocol.uavcanCompatibility.example.droneCanStartOfTransfer.name',
    // 15a'nın mesaj yayını örneği: Priority 20, Message Type ID 1000, Source
    // Node 42 → (20<<24)|(1000<<8)|42 = 0x1403E82A; tail 0xC5 spec örneği
    // (SOT=1, EOT=1, Toggle=0) → Toggle 0 Cyphal'i doğrudan dışlar.
    bytes: buildCanClassicFrame(0x1403e82a, [0x01, 0x02, 0x03, 0xc5], { extended: true }),
    description: 'protocol.uavcanCompatibility.example.droneCanStartOfTransfer.description',
    expectedValid: true,
  },
  {
    id: 'ambiguous-continuation',
    name: 'protocol.uavcanCompatibility.example.ambiguousContinuation.name',
    // Cyphal spec "Examples" son çerçevesi: CAN ID 0x126BBDAA, data E7 61
    // (SOT=0, EOT=1). Start-of-transfer sıfır → toggle sürüm kanıtı taşımaz;
    // aynı kimlik v0 düzeninde de geçerli bir servis isteğidir (düğüm 42 →
    // düğüm 61, ikisi de sıfırdan farklı). İki hat da aday kalır.
    bytes: buildCanClassicFrame(0x126bbdaa, [0xe7, 0x61], { extended: true }),
    description: 'protocol.uavcanCompatibility.example.ambiguousContinuation.description',
    expectedValid: true,
  },
  {
    id: 'no-candidate',
    name: 'protocol.uavcanCompatibility.example.noCandidate.name',
    // Aynı Heartbeat kimliği ama ayrılmış bit 23 SET: Cyphal spec'i "discard"
    // diyor. Tail 0xE0 (SOT=1, Toggle=1) ise DroneCAN'i dışlıyor. Geriye
    // hiçbir aday kalmaz.
    bytes: buildCanClassicFrame(
      (0x107d552a | (0x1 << 23)) >>> 0,
      [0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0xa1, 0xe0],
      { extended: true },
    ),
    description: 'protocol.uavcanCompatibility.example.noCandidate.description',
    expectedValid: true,
  },
  {
    id: 'not-extended-rejected',
    name: 'protocol.uavcanCompatibility.example.notExtendedRejected.name',
    bytes: buildCanClassicFrame(0x123, [0xaa, 0xe0]),
    description: 'protocol.uavcanCompatibility.example.notExtendedRejected.description',
    expectedValid: false,
  },
];

export const uavcanCompatibilityPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'aerospace-uav',
  parser: uavcanCompatibilityParser,
  documentation: {
    summary: 'protocol.uavcanCompatibility.documentation.summary',
    layer: 'multi-layer',
    references: [
      {
        title: 'libcanard — version detection between UAVCAN v0 and Cyphal v1 (canard.c:1117)',
        url: 'https://github.com/OpenCyphal/libcanard/blob/master/libcanard/canard.c#L1117-L1120',
      },
      {
        title: 'pycyphal — CAN wire parser accepting both lines (_wire.py)',
        url: 'https://github.com/OpenCyphal/pycyphal/blob/master/src/pycyphal2/can/_wire.py',
      },
      {
        title: 'Cyphal Specification — Cyphal/CAN transport',
        url: 'https://opencyphal.org/specification/',
      },
      {
        title: 'UAVCAN v0 Specification — 4. CAN bus transport layer (legacy.uavcan.org)',
        url: 'https://legacy.uavcan.org/Specification/4._CAN_bus_transport_layer/',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
};

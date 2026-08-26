/**
 * LonWorks — ISO/IEC 14908 kontrol ağı (Faz 10, dalga 17).
 * **`building-automation` domain'ini KAPATAN kayıt** (yedinci kapanan domain).
 *
 * ── KAPSAM ÇİZGİSİ: HANGİ TEL ÇÖZÜLÜR ─────────────────────────────────────
 * **ÇÖZÜLEN:** CN/IP (ISO/IEC 14908-4 · ANSI/CEA-852) UDP datagramı VE
 * içindeki LonTalk (ISO/IEC 14908-1 · ANSI/EIA-709.1) PDU'su.
 *
 * **KAPSAM DIŞI, ve gerekçesi "belgesiz" DEĞİL:**
 *   · **ISO/IEC 14908-2 (TP/FT-10) ve 14908-3 (PL-20) ham L2 çerçevelemesi**
 *     — preamble/bit-sync/byte-sync, kodlama, kuyruk CRC'si. Bu telin
 *     **BİÇİMİ normatif spec'te TAM olarak var** (Figure 3.2 + CRC bölümü);
 *     eksik olan **YAKALAMA YOLU**: libpcap'te LonTalk için bir `DLT_`/
 *     `LINKTYPE_` YOK, Wireshark'ın link katmanı girişi yok, kamuya açık ham
 *     L2 yakalaması yok. **Bir `Uint8Array`e ham LonTalk L2 çerçevesinin
 *     girmesinin kamuya açık bir yolu yoktur.** Birinci sınıf kaynağın kendi
 *     mimarisi bunu doğruluyor: `packet-lon.c`in TEK giriş noktası
 *     `dissector_add_uint("cnip.protocol", 0, lon_handle)`, yani CN/IP
 *     datagramının `pcode == 0` yüküdür. *"Belgesiz"* ile *"erişilemez"*
 *     farklıdır ve bu kayıt ikincisidir.
 *   · **XIF dosya çözümü** — biçim BELGELİ (LONMARK Device Interface File
 *     Reference Guide rev 4.501, girişsiz PDF; `izot/shortstack`ta ~20 gerçek
 *     `.xif`; `g3gg0/LonScan`da açık C# parser). Yazılmama gerekçesi
 *     `[Karar 15h-1]`in aynısı: **domain'i kapatan dalgada ikinci bir motor
 *     riski artırır.** `definitions` sekmesi bu yüzden "planlandı" basar ve
 *     BU DOĞRU DAVRANIŞTIR (`ProtocolPage.tsx`in `DEFINITION_PANELS`inde
 *     `xif` YOK; emsal `lin`/`arinc-429`, ikisi de `ready`).
 *   · **Gateway Mapping (BACnet Object ↔ LON NV)** — analyzer işi, çözücünün
 *     değil; `bacnetip.ts`in BBMD/Foreign-Device tablo takibini reddetmesiyle
 *     aynı sınıf.
 *   · **SNVT tipinin ÇERÇEVEDEN ÇIKARILMASI** — aşağıda.
 *
 * Ham L2 için kapı KAPALI DEĞİL: kullanıcı başka bir yoldan ham PDU elde
 * etmişse `payloadKind` kanalıyla çözebilir. Kapsam dışı olan ham L2
 * ÇERÇEVELEMESİDİR, PDU'nun kendisi değil.
 *
 * ── `canParse` `true` DÖNER — ve bu ÖLÇÜLMÜŞ bir karardır ─────────────────
 * İmza CN/IP'nin TAM imzasıdır: uzunluk alanı KENDİNİ doğrular + sürüm 1 +
 * paket tipi 14'lük kümede + `20 + 4×exth ≤ n`. Ana brif TAM registry
 * üzerinde ölçtü (143 kayıt / 886 örnek) ve çakışma **SIFIR** çıktı; aynı
 * imza gerçek yakalamanın 12.028 datagramında 12.028 doğru pozitif verdi.
 *
 * **Ham LonTalk PDU'su için `canParse` ASLA `true` olamaz** ve bu kapsam
 * kararının ikinci ayağıdır: ham telin sihirli sayısı, uzunluk alanı ve
 * sınırlayıcısı YOK; naif imza aynı 886 örnekte **401 (%45)**, daraltılmış
 * imza **375** çakışıyor — `seatalk`in (16b) 27/870'inden on beş kat kötü.
 * Bekçi `lonworksCanParseRegistry.test.ts` üç yönü de kodda TEKRARLAR.
 *
 * ── 🚨 SNVT TİPİ TELDE YOKTUR ─────────────────────────────────────────────
 * NV mesajı yalnız 14 bitlik bir **selector** taşır ve selector cihazın
 * bağlama tablosundaki bir İNDEKSTİR, tip değildir. Aynı iki bayt (`00 CA`)
 * beş ayrı mühendislik değeri verir: `SNVT_temp` −253.8 °C · `SNVT_temp_p`
 * 2.02 °C · `SNVT_lev_percent` 1.01 % · `SNVT_amp` 20.2 A · `SNVT_count` 202.
 * **Tipi tahmin etmek bunlar arasında seçim yapmaktır.** Deponun kendi
 * spec'inin KNX ilkesi birebir aynı (`ozet/07-bina-otomasyonu.md:446`:
 * *"Cannot determine engineering meaning without DPT"*).
 * → Tip `nvPayloadType` kanalıdır; seçilmezse değer HAM kalır ve **her NV
 * çözümünde `nvTypeNotOnWire` uyarısı KOŞULSUZ basılır** (`seatalk`in
 * `commandBitNotInBytes`i ile aynı sınıf: kapatılamayan uyarı).
 * Ölçek formülü `A × 10^B × (ham + C)` — parantez kritik, `snvtTypes.ts`.
 *
 * ── CRC: TÜNELDE YOK, AMA VARSA DOĞRULANIR ────────────────────────────────
 * LonTalk'ın CRC'si **CRC-16/GENIBUS**tur (`check = 0xD64E`) ve bu dalgada
 * `crcCatalogue.ts`e eklendi. **`CRC16_CCITT_FALSE` ondan YALNIZ `xorout`ta
 * ayrılıyor** — deponun en keskin sahte dostu; gerekçe `crcCatalogue.ts`teki
 * girdinin başında.
 *
 * IP-852 yükünde kuyruk CRC'si ÖLÇÜLDÜ ve **12.028 datagramın hiçbirinde
 * YOK** (4 polinom × 3 init × yansıma × xorout × iki bayt sırası tarandı;
 * bağımsız ikinci sürüm 3000 çerçeve / 36.000 denemede 2 tutma verdi — şans
 * düzeyi). Gövde uzunlukları da doğruluyor: 8 baytlık gövdeler tam olarak
 * `PPDU + NPDU + src(2) + dst(2) + domain(1) + TPDU(1)`, CRC'ye yer yok.
 * **AMA** `lon-stack-ex`in `LtLreIpClient.cpp`si alınan IP-852 yüklerinde bir
 * kuyruk CRC'si doğruluyor. → **VARSAYILMAZ, ama VARSA doğrulanır:**
 * `cnip-tunnel` modunda CRC HİÇ hesaplanmaz (otomatik sezme yalnız 1/65536
 * yanlış pozitif eklerdi), `raw-lontalk-pdu-with-crc` şıkkında GERÇEKTEN
 * doğrulanır. *"gösterilir ≠ doğrulanır"* korunur.
 *
 * ── DOĞRULANMAYAN YOLLAR — hepsi kaynak metninden geliyor ─────────────────
 * Gerçek yakalama (12.028 datagram) şunları DOĞRULADI: CN/IP 20 baytlık
 * başlık · `len` kendini doğrulaması · PPDU/NPDU bit düzeni · adres biçimi 0
 * ve 2a · domain 0 ve 1 bayt · TPDU ACKD/ACK · SPDU REQUEST/RESPONSE · APDU
 * NV/NM/Application · transaction eşleşmesi · NM yanıt kodu aritmetiği.
 *
 * Şunlar **DOĞRULANMADI** ve alanları `pathNotVerifiedInCapture` uyarısı
 * taşır: `exth > 0` · CN/IP bayt 2'nin 5/3 bölünmesi · `pcode != 0` ·
 * security bit · Data Packet dışındaki 13 tip · adres biçimi 1 / 2b / 3 ·
 * domain 3 ve 6 bayt · TPDU/SPDU REMINDER + REM/MSG (`M_Len`/`M_List`) ·
 * AuthPDU'nun tamamı · Network Diagnostic · Foreign Frame kod anlamı ·
 * `NM_MANUAL_SERVICE_REQUEST`in 6+8 baytlık kuyruğu · kuyruk CRC'li ham PDU.
 * Doğrulanmamış bir yolu doğrulanmış gibi göstermek dalga 13 dersi 3'ün
 * ihlalidir.
 *
 * ── `build` SEKMESİ YOK → `encoder` YAZILMAZ ─────────────────────────────
 * Katalog `tabs`ında `'build'`, `'live'` ve `'timing'` yok (kaydın kendi
 * yorumu: *"ilk sürümde full stack implementasyonu hedeflenmiyor"*). 16c'nin
 * `iec-61162` gerekçesinin aynısı.
 */

import { computeNamedCrc } from '@/protocol-core/checksums';
import { createRawFrame } from '@/protocol-core/types';
import type {
  DecodeOption,
  ExampleFrame,
  ParseContext,
  ParseResult,
  ParsedFrame,
  ProtocolError,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

import {
  CNIP_HEADER_LENGTH,
  LENGTH_LENIENT,
  LENGTH_STRICT,
  PACKET_TYPE_HANDLING_NAME_AND_RAW,
  PACKET_TYPE_HANDLING_REJECT,
  TIMESTAMP_EPOCH_1900,
  TIMESTAMP_EPOCH_1970,
  TIMESTAMP_EPOCH_RAW,
  VERSION_SPLIT_ECHELON,
  VERSION_SPLIT_WHOLE_BYTE,
  decodeCnipHeader,
  isKnownCnipPacketType,
  pushField,
  toProtocolWarning,
} from './cnip';
import type { FieldSink } from './cnip';
import {
  FOREIGN_FRAME_LABELS_HIDE,
  FOREIGN_FRAME_LABELS_NUMERIC,
  NEURON_ID_AS_TRANSMITTED,
  NEURON_ID_REVERSED,
  decodeLonTalkPdu,
} from './lonTalk';
import { SNVT_RAW, SNVT_SCALAR_TYPES } from './snvtTypes';

/** Kayıt defterindeki ve katalogdaki kimlikle AYNI olmak zorunda: bağ bu string. */
const PROTOCOL_ID = 'lonworks';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md); katalog kaydıyla birebir aynı. */
const PROTOCOL_DISPLAY_NAME = 'LonWorks';

const TRANSLATION_KEY_PREFIX = 'protocol.lonworks';

const ERROR_ABORTED = `${TRANSLATION_KEY_PREFIX}.error.aborted`;
const ERROR_EMPTY_DATAGRAM = `${TRANSLATION_KEY_PREFIX}.error.emptyDatagram`;
const ERROR_TOO_SHORT_FOR_CNIP = `${TRANSLATION_KEY_PREFIX}.error.tooShortForCnip`;
const ERROR_TOO_SHORT_FOR_PDU = `${TRANSLATION_KEY_PREFIX}.error.tooShortForPdu`;
const ERROR_CRC_MISMATCH = `${TRANSLATION_KEY_PREFIX}.error.crcMismatch`;

const WARN_RAW_PDU_MODE = `${TRANSLATION_KEY_PREFIX}.warning.rawPduModeNoEnvelope`;
const WARN_TUNNEL_CARRIES_NO_CRC = `${TRANSLATION_KEY_PREFIX}.warning.tunnelCarriesNoCrc`;

const FIELD_WARN_CRC_MISMATCH = `${TRANSLATION_KEY_PREFIX}.field.crcMismatch`;

// ── decodeOptions — SEKİZ kanal ───────────────────────────────────────────
// Hepsi ÇERÇEVEDEN ÇIKARILAMAYAN parametrelerdir; hiçbiri kullanıcıya olmayan
// bir karar sordurmaz. KANAL YAPILMAYANLAR ve gerekçeleri:
//   · adres biçimi 2b'nin +4 alanının adı → normatif spec ÇÖZDÜ, seçenek gereksiz;
//   · NM/ND yanıt kodu ayrımı → çerçevede YOK, uyarı basılır;
//   · protokol kodu filtresi → kapsam kararı, ayar değil.

const OPTION_PAYLOAD_KIND = 'payloadKind';
const OPTION_NV_PAYLOAD_TYPE = 'nvPayloadType';
const OPTION_TIMESTAMP_EPOCH = 'timestampEpoch';
const OPTION_STRICT_LENGTH = 'strictLength';
const OPTION_NEURON_ID_BYTE_ORDER = 'neuronIdByteOrder';
const OPTION_UNKNOWN_PACKET_TYPE = 'unknownPacketTypeHandling';
const OPTION_VERSION_BYTE_SPLIT = 'versionByteSplit';
const OPTION_FOREIGN_FRAME_LABELS = 'foreignFrameCodeLabels';

const PAYLOAD_KIND_TUNNEL = 'cnip-tunnel';
const PAYLOAD_KIND_RAW_PDU = 'raw-lontalk-pdu';
const PAYLOAD_KIND_RAW_PDU_WITH_CRC = 'raw-lontalk-pdu-with-crc';

const CRC_LENGTH = 2;

const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_PAYLOAD_KIND,
    label: `${TRANSLATION_KEY_PREFIX}.option.payloadKind`,
    kind: 'select',
    defaultValue: PAYLOAD_KIND_TUNNEL,
    description: `${TRANSLATION_KEY_PREFIX}.option.payloadKind.description`,
    choices: [
      { value: PAYLOAD_KIND_TUNNEL, label: `${TRANSLATION_KEY_PREFIX}.option.payloadKind.tunnel` },
      { value: PAYLOAD_KIND_RAW_PDU, label: `${TRANSLATION_KEY_PREFIX}.option.payloadKind.rawPdu` },
      {
        value: PAYLOAD_KIND_RAW_PDU_WITH_CRC,
        label: `${TRANSLATION_KEY_PREFIX}.option.payloadKind.rawPduWithCrc`,
      },
    ],
  },
  {
    id: OPTION_NV_PAYLOAD_TYPE,
    label: `${TRANSLATION_KEY_PREFIX}.option.nvPayloadType`,
    kind: 'select',
    defaultValue: SNVT_RAW,
    description: `${TRANSLATION_KEY_PREFIX}.option.nvPayloadType.description`,
    choices: [
      { value: SNVT_RAW, label: `${TRANSLATION_KEY_PREFIX}.option.nvPayloadType.raw` },
      // SNVT adları ve indeksleri VERİDİR, çeviriye girmez (CLAUDE.md).
      ...SNVT_SCALAR_TYPES.map((type) => ({
        value: type.name,
        label: `${type.name} (${String(type.index)})`,
      })),
    ],
  },
  {
    id: OPTION_TIMESTAMP_EPOCH,
    label: `${TRANSLATION_KEY_PREFIX}.option.timestampEpoch`,
    kind: 'select',
    defaultValue: TIMESTAMP_EPOCH_RAW,
    description: `${TRANSLATION_KEY_PREFIX}.option.timestampEpoch.description`,
    choices: [
      { value: TIMESTAMP_EPOCH_RAW, label: `${TRANSLATION_KEY_PREFIX}.option.timestampEpoch.raw` },
      { value: TIMESTAMP_EPOCH_1900, label: `${TRANSLATION_KEY_PREFIX}.option.timestampEpoch.epoch1900` },
      { value: TIMESTAMP_EPOCH_1970, label: `${TRANSLATION_KEY_PREFIX}.option.timestampEpoch.epoch1970` },
    ],
  },
  {
    id: OPTION_STRICT_LENGTH,
    label: `${TRANSLATION_KEY_PREFIX}.option.strictLength`,
    kind: 'select',
    defaultValue: LENGTH_STRICT,
    description: `${TRANSLATION_KEY_PREFIX}.option.strictLength.description`,
    choices: [
      { value: LENGTH_STRICT, label: `${TRANSLATION_KEY_PREFIX}.option.strictLength.strict` },
      { value: LENGTH_LENIENT, label: `${TRANSLATION_KEY_PREFIX}.option.strictLength.lenient` },
    ],
  },
  {
    id: OPTION_NEURON_ID_BYTE_ORDER,
    label: `${TRANSLATION_KEY_PREFIX}.option.neuronIdByteOrder`,
    kind: 'select',
    defaultValue: NEURON_ID_AS_TRANSMITTED,
    description: `${TRANSLATION_KEY_PREFIX}.option.neuronIdByteOrder.description`,
    choices: [
      {
        value: NEURON_ID_AS_TRANSMITTED,
        label: `${TRANSLATION_KEY_PREFIX}.option.neuronIdByteOrder.asTransmitted`,
      },
      { value: NEURON_ID_REVERSED, label: `${TRANSLATION_KEY_PREFIX}.option.neuronIdByteOrder.reversed` },
    ],
  },
  {
    id: OPTION_UNKNOWN_PACKET_TYPE,
    label: `${TRANSLATION_KEY_PREFIX}.option.unknownPacketTypeHandling`,
    kind: 'select',
    defaultValue: PACKET_TYPE_HANDLING_NAME_AND_RAW,
    description: `${TRANSLATION_KEY_PREFIX}.option.unknownPacketTypeHandling.description`,
    choices: [
      {
        value: PACKET_TYPE_HANDLING_NAME_AND_RAW,
        label: `${TRANSLATION_KEY_PREFIX}.option.unknownPacketTypeHandling.nameAndRaw`,
      },
      {
        value: PACKET_TYPE_HANDLING_REJECT,
        label: `${TRANSLATION_KEY_PREFIX}.option.unknownPacketTypeHandling.reject`,
      },
    ],
  },
  {
    id: OPTION_VERSION_BYTE_SPLIT,
    label: `${TRANSLATION_KEY_PREFIX}.option.versionByteSplit`,
    kind: 'select',
    defaultValue: VERSION_SPLIT_ECHELON,
    description: `${TRANSLATION_KEY_PREFIX}.option.versionByteSplit.description`,
    choices: [
      { value: VERSION_SPLIT_ECHELON, label: `${TRANSLATION_KEY_PREFIX}.option.versionByteSplit.echelon` },
      { value: VERSION_SPLIT_WHOLE_BYTE, label: `${TRANSLATION_KEY_PREFIX}.option.versionByteSplit.wholeByte` },
    ],
  },
  {
    id: OPTION_FOREIGN_FRAME_LABELS,
    label: `${TRANSLATION_KEY_PREFIX}.option.foreignFrameCodeLabels`,
    kind: 'select',
    defaultValue: FOREIGN_FRAME_LABELS_NUMERIC,
    description: `${TRANSLATION_KEY_PREFIX}.option.foreignFrameCodeLabels.description`,
    choices: [
      {
        value: FOREIGN_FRAME_LABELS_NUMERIC,
        label: `${TRANSLATION_KEY_PREFIX}.option.foreignFrameCodeLabels.numeric`,
      },
      { value: FOREIGN_FRAME_LABELS_HIDE, label: `${TRANSLATION_KEY_PREFIX}.option.foreignFrameCodeLabels.hide` },
    ],
  },
];

function readSelect(
  options: Record<string, unknown> | undefined,
  optionId: string,
  fallback: string,
): string {
  const raw = options?.[optionId];
  if (typeof raw !== 'string') return fallback;
  const option = DECODE_OPTIONS.find((candidate) => candidate.id === optionId);
  return option?.choices?.some((choice) => choice.value === raw) === true ? raw : fallback;
}

// ── `canParse` imzası (R4) ────────────────────────────────────────────────

/**
 * CN/IP'nin TAM imzası. Dört koşulun hepsi ŞART ve ölçüldü: uzunluk alanı
 * OLMADAN aynı tarama 1 çakışma veriyor (`dmx512/oversizedSlotCount`, 522 B),
 * uzunluk alanının ofset taraması da 0'ın tek temiz ofset olduğunu gösteriyor
 * (ofset 1'de 1 çakışma, ofset 10'da 6).
 */
export function hasCnipSignature(data: Uint8Array): boolean {
  if (data.length < CNIP_HEADER_LENGTH) return false;
  const declaredLength = ((data[0] ?? 0) << 8) | (data[1] ?? 0);
  if (declaredLength !== data.length) return false;
  // Sürüm bayt 2'nin ALT BEŞ bitidir (Echelon bölünmesi, `cnip.ts` dosya başı).
  if (((data[2] ?? 0) & 0x1f) !== 1) return false;
  if (!isKnownCnipPacketType(data[3] ?? 0)) return false;
  // `exth` 32-BİT SÖZCÜK sayar; başlık datagrama sığmalı.
  return CNIP_HEADER_LENGTH + 4 * (data[4] ?? 0) <= data.length;
}

/**
 * Ham LonTalk PDU'sunun NAİF imzası — **motorda KULLANILMAZ**, yalnız bekçi
 * testinin "yazılsaydı kaç çerçeve çalardı" ölçümünü kodda tekrarlayabilmesi
 * için dışa verilir. 886 örnek üzerinde 401 çakışma (%45) ölçtü.
 */
export function hasNaiveLonTalkSignature(data: Uint8Array): boolean {
  if (data.length < 8) return false;
  return (((data[1] ?? 0) >> 6) & 0x03) === 0;
}

// ── Çözüm ─────────────────────────────────────────────────────────────────

function buildFrame(
  data: Uint8Array,
  sink: FieldSink,
  errors: ProtocolError[],
  warnings: ProtocolWarning[],
  context: ParseContext | undefined,
): ParseResult {
  const rawFrame = createRawFrame(data, {
    ...(context?.timestamp === undefined ? {} : { timestamp: context.timestamp }),
    ...(context?.direction === undefined ? {} : { direction: context.direction }),
    ...(context?.channel === undefined ? {} : { channel: context.channel }),
  });

  const frame: ParsedFrame = {
    protocol: PROTOCOL_ID,
    timestamp: rawFrame.timestamp,
    rawFrame,
    fields: sink.fields,
    valid: errors.length === 0,
    errors,
    warnings,
  };
  return { success: true, frame, consumedBytes: data.length };
}

function parseLonWorks(data: Uint8Array, context?: ParseContext): ParseResult {
  if (context?.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length === 0) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_EMPTY_DATAGRAM, offset: 0, length: 0 },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const options = context?.options;
  const payloadKind = readSelect(options, OPTION_PAYLOAD_KIND, PAYLOAD_KIND_TUNNEL);
  const lonTalkOptions = {
    nvPayloadType: readSelect(options, OPTION_NV_PAYLOAD_TYPE, SNVT_RAW),
    neuronIdByteOrder: readSelect(options, OPTION_NEURON_ID_BYTE_ORDER, NEURON_ID_AS_TRANSMITTED),
    foreignFrameCodeLabels: readSelect(
      options,
      OPTION_FOREIGN_FRAME_LABELS,
      FOREIGN_FRAME_LABELS_NUMERIC,
    ),
  };

  const sink: FieldSink = { fields: [], usedIds: new Set() };
  const errors: ProtocolError[] = [];
  const warnings: ProtocolWarning[] = [];

  if (payloadKind !== PAYLOAD_KIND_TUNNEL) {
    // ── Ham PDU modu — zarf YOK ─────────────────────────────────────────
    const withCrc = payloadKind === PAYLOAD_KIND_RAW_PDU_WITH_CRC;
    const minimum = withCrc ? 2 + CRC_LENGTH : 2;
    if (data.length < minimum) {
      return {
        success: false,
        error: {
          code: 'truncated-frame',
          message: ERROR_TOO_SHORT_FOR_PDU,
          offset: 0,
          length: data.length,
        },
        consumedBytes: 0,
        recoverable: true,
      };
    }

    const pduEnd = withCrc ? data.length - CRC_LENGTH : data.length;
    decodeLonTalkPdu(data.subarray(0, pduEnd), 0, sink, warnings, errors, lonTalkOptions);

    if (withCrc) {
      // CRC-16/GENIBUS, BÜYÜK ENDIAN (`LtCUtil.c`: önce yüksek bayt).
      const covered = data.subarray(0, pduEnd);
      const calculated = Number(computeNamedCrc(covered, 'CRC16_GENIBUS'));
      const received = ((data[pduEnd] ?? 0) << 8) | (data[pduEnd + 1] ?? 0);
      const crcValid = received === calculated;
      pushField(sink, {
        id: 'lontalk-crc',
        name: 'LonTalk · NPDU CRC (CRC-16/GENIBUS)',
        offset: pduEnd,
        length: CRC_LENGTH,
        rawBytes: data.slice(pduEnd, pduEnd + CRC_LENGTH),
        rawValue: `0x${received.toString(16).toUpperCase().padStart(4, '0')}`,
        physicalValue: crcValid
          ? `PASS (covers ${String(pduEnd)} B)`
          : `FAIL (calculated 0x${calculated.toString(16).toUpperCase().padStart(4, '0')} over ${String(pduEnd)} B)`,
        valid: crcValid,
        warnings: crcValid ? [] : [FIELD_WARN_CRC_MISMATCH],
      });
      if (!crcValid) {
        errors.push({
          code: 'crc-mismatch',
          message: ERROR_CRC_MISMATCH,
          offset: pduEnd,
          length: CRC_LENGTH,
          details: { received, calculated },
        });
      }
    }

    warnings.push(toProtocolWarning('rawPduModeNoEnvelope', WARN_RAW_PDU_MODE));
    return buildFrame(data, sink, errors, warnings, context);
  }

  // ── CN/IP tüneli ──────────────────────────────────────────────────────
  if (data.length < CNIP_HEADER_LENGTH) {
    return {
      success: false,
      error: {
        code: 'truncated-frame',
        message: ERROR_TOO_SHORT_FOR_CNIP,
        offset: 0,
        length: data.length,
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const header = decodeCnipHeader(data, sink, warnings, errors, {
    versionByteSplit: readSelect(options, OPTION_VERSION_BYTE_SPLIT, VERSION_SPLIT_ECHELON),
    strictLength: readSelect(options, OPTION_STRICT_LENGTH, LENGTH_STRICT),
    unknownPacketTypeHandling: readSelect(
      options,
      OPTION_UNKNOWN_PACKET_TYPE,
      PACKET_TYPE_HANDLING_NAME_AND_RAW,
    ),
    timestampEpoch: readSelect(options, OPTION_TIMESTAMP_EPOCH, TIMESTAMP_EPOCH_RAW),
  });

  if (header.readable && header.carriesLonTalk) {
    // Tünelde kuyruk CRC'si YOKTUR (dosya başı) — hesaplanmaz, iddia edilmez.
    warnings.push(toProtocolWarning('tunnelCarriesNoCrc', WARN_TUNNEL_CARRIES_NO_CRC));
    decodeLonTalkPdu(data, header.payloadOffset, sink, warnings, errors, lonTalkOptions);
  }

  return buildFrame(data, sink, errors, warnings, context);
}

export const lonworksParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * `true` DÖNER — ölçülmüş karar (dosya başı). `decodeOptions` BURAYA GİRMEZ
   * (`ProtocolParser` sözleşmesi): `payloadKind` ham PDU'ya çevrilmiş olsa
   * bile imza HÂLÂ CN/IP imzasıdır. Ham PDU'nun kendi imzası olamaz — 401
   * çakışma bunu ölçtü.
   */
  canParse(data: Uint8Array): boolean {
    return hasCnipSignature(data);
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseLonWorks(data, context);
  },
};

// ── Örnekler ──────────────────────────────────────────────────────────────
// İlk YEDİSİ Wireshark wiki'sinin `eia709.1-over-eia852.pcap` yakalamasının
// (12.028 datagram, "lots of button presses, temperature sensors") GERÇEK
// datagramlarıdır; keşif turunda çıkarıldılar ve alan alan elle çözüldüler.
// Sonraki BEŞİ bunlardan TEK BAYT değiştirilerek TÜRETİLDİ ve açıklamaları
// böyle yazar — üretilmiş "gerçek gibi" veri YOK.

function hexToBytes(hex: string): Uint8Array {
  const parts = hex.trim().split(/\s+/);
  const bytes = new Uint8Array(parts.length);
  for (let index = 0; index < parts.length; index += 1) {
    bytes[index] = Number.parseInt(parts[index] ?? '0', 16) & 0xff;
  }
  return bytes;
}

/** TPDU ACKD + NV güncellemesi — 1) ile 2) AYNI transaction'dır (trans=3). */
const FRAME_TPDU_ACKD_NV =
  '00 20 01 01 00 00 00 00 6B 8B 45 67 00 00 00 00 00 00 00 00 01 09 01 AA 01 A9 01 03 81 0D 00 CA';
/** Eşleşen ACK — ters yön, aynı transaction. */
const FRAME_TPDU_ACK =
  '00 1C 01 01 00 00 00 00 6B 8B 45 67 00 00 00 01 00 00 00 00 00 09 01 A9 01 AA 01 23';
/** SPDU REQUEST + NM_NV_FETCH (`0x73`), NV indeksi `07`. */
const FRAME_SPDU_REQUEST_NM =
  '00 1E 01 01 00 00 00 00 6B 8B 45 67 00 00 0E BD 00 00 00 00 01 19 01 C9 01 98 01 0B 73 07';
/** SPDU RESPONSE — NM/ND yanıt kodu çakışmasının GERÇEK kanıtı (`0x33`). */
const FRAME_SPDU_RESPONSE_AMBIGUOUS =
  '00 2A 01 01 00 00 00 00 6B 8B 45 67 00 00 0E BF 00 00 00 00 00 19 01 98 01 C9 01 2B 33 07 00 00 00 00 00 00 00 00 00 00 00 00';
/** APDU doğrudan — taşıma katmanı okteti YOK; NV selector 0x3FFF. */
const FRAME_APDU_DIRECT_NV =
  '00 20 01 01 00 00 00 00 6B 8B 45 67 00 00 00 17 00 00 00 00 00 39 01 C9 01 9D 01 BF FF 00 00 02';
/** Yakalamanın EN UZUN datagramı (43 B) — 14 baytlık NV yükü, selector 845. */
const FRAME_APDU_LONGEST_NV =
  '00 2B 01 01 00 00 00 00 6B 8B 45 67 00 00 01 38 00 00 00 00 00 39 01 BD 01 8C 01 83 4D 0C 00 00 07 D0 0A 28 FF 08 0B 00 64 01 80';
/**
 * Broadcast + domain-wide + PDU OKTETİ YOK. Yakalamanın 12.028 çerçevesinden
 * TEK BÖYLE ÇERÇEVE: `truncated-frame` hatasını türetilmiş veriyle değil
 * GERÇEK YAKALAMAYLA kanıtlar.
 */
const FRAME_BROADCAST_TRUNCATED =
  '00 19 01 01 00 00 00 00 6B 8B 45 67 00 00 04 F3 00 00 00 00 80 00 00 01 00';

function withByte(hex: string, index: number, value: number): Uint8Array {
  const bytes = hexToBytes(hex);
  bytes[index] = value;
  return bytes;
}

/** 1)'in `len` alanı 0x0020 → 0x0021: `length-mismatch`. */
const DERIVED_LENGTH_MISMATCH = withByte(FRAME_TPDU_ACKD_NV, 1, 0x21);
/** 1)'in paket tipi 0x01 → 0x63 (Device Configuration Request): ad basılır, gövde ham kalır. */
const DERIVED_NON_DATA_PACKET = withByte(FRAME_TPDU_ACKD_NV, 3, 0x63);
/** 1)'in protokol kodu 0 → 1: KAPSAM DIŞI, açıkça reddedilir. */
const DERIVED_FOREIGN_PROTOCOL_CODE = withByte(FRAME_TPDU_ACKD_NV, 5, 0x01);
/** 6)'nın APDU kod baytı 0x83 (NV) → 0x4D: Foreign Frame, kod 0x0D. */
const DERIVED_FOREIGN_FRAME = withByte(FRAME_APDU_LONGEST_NV, 27, 0x4d);

/**
 * 1)'in `exth` alanı 0 → 1 ve araya 4 bayt eklenmiş hâli; `len` de 4 artırıldı
 * ki alan kendini doğrulamaya devam etsin. Motorun `4 × exth` atlamasını
 * kanıtlar — bayt saysaydı LonTalk PDU'su 3 bayt kayardı.
 */
function deriveExtendedHeader(): Uint8Array {
  const original = hexToBytes(FRAME_TPDU_ACKD_NV);
  const extended = new Uint8Array(original.length + 4);
  extended.set(original.subarray(0, CNIP_HEADER_LENGTH), 0);
  extended.set(original.subarray(CNIP_HEADER_LENGTH), CNIP_HEADER_LENGTH + 4);
  extended[1] = (original[1] ?? 0) + 4;
  extended[4] = 1;
  return extended;
}
const DERIVED_EXTENDED_HEADER = deriveExtendedHeader();

/**
 * 1)'in LonTalk PDU'su (12 bayt) + CRC-16/GENIBUS (`09 9E`, büyük endian).
 * ZARF YOKTUR: `payloadKind` `raw-lontalk-pdu-with-crc`ye çevrilmeden
 * çözülmez, varsayılan tünel modunda `truncated-frame` verir — bu KASITLIDIR.
 * CRC değeri Echelon'un `LtCRC16`sı bağımsızca yeniden kurularak üretildi.
 */
const DERIVED_RAW_PDU_WITH_CRC = hexToBytes('01 09 01 AA 01 A9 01 03 81 0D 00 CA 09 9E');

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'tpdu-ackd-nv-update',
    name: `${TRANSLATION_KEY_PREFIX}.example.tpduAckdNvUpdate.name`,
    bytes: hexToBytes(FRAME_TPDU_ACKD_NV),
    description: `${TRANSLATION_KEY_PREFIX}.example.tpduAckdNvUpdate.description`,
    expectedValid: true,
  },
  {
    id: 'tpdu-ack',
    name: `${TRANSLATION_KEY_PREFIX}.example.tpduAck.name`,
    bytes: hexToBytes(FRAME_TPDU_ACK),
    description: `${TRANSLATION_KEY_PREFIX}.example.tpduAck.description`,
    expectedValid: true,
  },
  {
    id: 'spdu-request-nv-fetch',
    name: `${TRANSLATION_KEY_PREFIX}.example.spduRequestNvFetch.name`,
    bytes: hexToBytes(FRAME_SPDU_REQUEST_NM),
    description: `${TRANSLATION_KEY_PREFIX}.example.spduRequestNvFetch.description`,
    expectedValid: true,
  },
  {
    id: 'spdu-response-ambiguous',
    name: `${TRANSLATION_KEY_PREFIX}.example.spduResponseAmbiguous.name`,
    bytes: hexToBytes(FRAME_SPDU_RESPONSE_AMBIGUOUS),
    description: `${TRANSLATION_KEY_PREFIX}.example.spduResponseAmbiguous.description`,
    expectedValid: true,
  },
  {
    id: 'apdu-direct-nv',
    name: `${TRANSLATION_KEY_PREFIX}.example.apduDirectNv.name`,
    bytes: hexToBytes(FRAME_APDU_DIRECT_NV),
    description: `${TRANSLATION_KEY_PREFIX}.example.apduDirectNv.description`,
    expectedValid: true,
  },
  {
    id: 'apdu-longest-nv',
    name: `${TRANSLATION_KEY_PREFIX}.example.apduLongestNv.name`,
    bytes: hexToBytes(FRAME_APDU_LONGEST_NV),
    description: `${TRANSLATION_KEY_PREFIX}.example.apduLongestNv.description`,
    expectedValid: true,
  },
  {
    id: 'broadcast-truncated',
    name: `${TRANSLATION_KEY_PREFIX}.example.broadcastTruncated.name`,
    bytes: hexToBytes(FRAME_BROADCAST_TRUNCATED),
    description: `${TRANSLATION_KEY_PREFIX}.example.broadcastTruncated.description`,
    expectedValid: false,
  },
  {
    id: 'length-mismatch',
    name: `${TRANSLATION_KEY_PREFIX}.example.lengthMismatch.name`,
    bytes: DERIVED_LENGTH_MISMATCH,
    description: `${TRANSLATION_KEY_PREFIX}.example.lengthMismatch.description`,
    expectedValid: false,
  },
  {
    id: 'non-data-packet',
    name: `${TRANSLATION_KEY_PREFIX}.example.nonDataPacket.name`,
    bytes: DERIVED_NON_DATA_PACKET,
    description: `${TRANSLATION_KEY_PREFIX}.example.nonDataPacket.description`,
    expectedValid: true,
  },
  {
    id: 'foreign-protocol-code',
    name: `${TRANSLATION_KEY_PREFIX}.example.foreignProtocolCode.name`,
    bytes: DERIVED_FOREIGN_PROTOCOL_CODE,
    description: `${TRANSLATION_KEY_PREFIX}.example.foreignProtocolCode.description`,
    expectedValid: false,
  },
  {
    id: 'extended-header',
    name: `${TRANSLATION_KEY_PREFIX}.example.extendedHeader.name`,
    bytes: DERIVED_EXTENDED_HEADER,
    description: `${TRANSLATION_KEY_PREFIX}.example.extendedHeader.description`,
    expectedValid: true,
  },
  {
    id: 'foreign-frame',
    name: `${TRANSLATION_KEY_PREFIX}.example.foreignFrame.name`,
    bytes: DERIVED_FOREIGN_FRAME,
    description: `${TRANSLATION_KEY_PREFIX}.example.foreignFrame.description`,
    expectedValid: true,
  },
  {
    id: 'raw-pdu-with-crc',
    name: `${TRANSLATION_KEY_PREFIX}.example.rawPduWithCrc.name`,
    bytes: DERIVED_RAW_PDU_WITH_CRC,
    description: `${TRANSLATION_KEY_PREFIX}.example.rawPduWithCrc.description`,
    expectedValid: false,
  },
];

export const lonworksPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'building-automation',
  parser: lonworksParser,
  // 'build' sekmesi YOK (katalog) → `encoder` YAZILMAZ.
  documentation: {
    summary: `${TRANSLATION_KEY_PREFIX}.documentation.summary`,
    layer: 'multi-layer',
    references: [
      {
        title:
          'Echelon LonTalk Protocol Specification v3.0 (078-0125-01A) — normative ISO/IEC 14908-1 source, Figure 3.2 addressing, APDU code space, NPDU CRC polynomial',
        url: 'https://scadahacker.com/library/Documents/ICS_Protocols/Echelon%20-%20LonTalk%20Protocol%20Specification%20v3.0.pdf',
      },
      {
        title:
          'izot/lon-stack-ex — the original Echelon LonTalk Stack (MIT): LtIpPackets.h/.cpp CN/IP header, LtCUtil.c LtCRC16',
        url: 'https://github.com/izot/lon-stack-ex',
      },
      {
        title:
          'izot/lon-stack-dx — clean ISO/IEC 14908-1 stack (MIT): lcs_link.c, lcs_network.c, lcs_tsa.c bit fields and bitfield.h read direction',
        url: 'https://github.com/izot/lon-stack-dx',
      },
      {
        title:
          'Wireshark epan/dissectors/packet-cnip.c — CN/IP (EIA-852) dissector; its only LonTalk entry point is dissector_add_uint("cnip.protocol", 0, ...)',
        url: 'https://gitlab.com/wireshark/wireshark/-/raw/master/epan/dissectors/packet-cnip.c',
      },
      {
        title:
          'Wireshark epan/dissectors/packet-lon.c — LonTalk PDU dissector (cross-check only: three deviations from the normative spec, AuthPDU masks flagged broken by its own TODO)',
        url: 'https://gitlab.com/wireshark/wireshark/-/raw/master/epan/dissectors/packet-lon.c',
      },
      {
        title: 'LonMark International online resource files — SNVT master list with index, size, Neuron C type and scaling (A,B,C)',
        url: 'https://www.lonmark.org/nvs/',
      },
      {
        title:
          'Wireshark SampleCaptures eia709.1-over-eia852.pcap — 12,028 real EIA-709.1-over-EIA-852 datagrams',
        url: 'https://wiki.wireshark.org/uploads/__moin_import__/attachments/SampleCaptures/eia709.1-over-eia852.pcap',
      },
      {
        title:
          'LONMARK Device Interface File (XIF) Reference Guide rev 4.501 — the format this page deliberately does NOT parse yet',
        url: 'https://www.lonmark.org/wp-content/uploads/2020/12/LmXif4501.pdf',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};

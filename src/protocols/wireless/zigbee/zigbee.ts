/**
 * Zigbee — ÜÇ katman TEK motor: IEEE 802.15.4 MAC → Zigbee NWK → Zigbee APS
 * (+ dar ZCL). Girdi TAM 802.15.4 MAC çerçevesi (FCF'den FCS'e kadar,
 * sniffer/Wireshark seviyesi — ethercat.ts'in "girdi katman zinciri DEĞİL,
 * çerçevenin kendisi" emsali).
 *
 * ── KAYNAKLAR (dalga 7 kaynak politikası: resmi + bir çapraz doğrulama) ────
 * MAC: IEEE Std 802.15.4-2006 §7.2.1 (resmi, ücretsiz mirror) + Wireshark
 * `packet-ieee802154.c`/`.h` + OpenThread `mac_frame.hpp` (iki bağımsız açık
 * kaynak, birbirini bit bit doğruluyor). FCS: resmi spec'in KENDİ worked
 * example'ı (§7.2.1.9, 3 baytlık örnek → 0x79E4) bağımsız hesaplamayla
 * yeniden üretilip DOĞRULANDI — bu depodaki `CRC16_KERMIT` katalog girdisiyle
 * aynı parametreler (poly 0x1021, init 0x0000, refin/refout true, xorout 0).
 * NWK+APS: CSA Zigbee Specification 05-3474-23 (R23, resmi) + Wireshark
 * `packet-zbee-nwk.c`/`packet-zbee-aps.c` bit bit örtüşüyor. ZCL: resmi metne
 * bu dalgada ulaşılamadı (CSA indirme formu kayıt ister) — Wireshark
 * `packet-zbee-zcl.c`/`.h` + zigbee-herdsman (Apache-2.0) çapraz doğrulaması
 * kullanıldı, ikisi bağımsızca örtüşüyor (dalga 5'in "kaynaklar KAMU"
 * gevşemesinin sınırı: ZCL için tek kaynak ailesi resmi değil, iki bağımsız
 * açık kaynak var — dalga 7 karar 2'nin "resmi + bir çapraz" asgarisi
 * ikisiyle de karşılanıyor).
 *
 * ── KAPSAM ÇİZGİSİ (dalga 7 karar 5 + karar 7 + brief adım 8-10) ──────────
 * MAC: yalnız Frame Version 2003/2006 (Zigbee'nin fiilen kullandığı); 2015+
 * adresleme (Table 7-6) KARMAŞIK VE ZIGBEE'DE KULLANILMIYOR → desteklenmez,
 * ham+uyarı. Yalnız Data frame (FrameType=1) payload'ı NWK'ya geçer.
 * NWK: Multicast/Source Route alt-çerçeveleri ÇÖZÜLMEZ (nadir, brief adım 9
 * dar listesinde yok) — bu bitler set ise Dest/Src IEEE sonrası ham+uyarı.
 * Security=1 ise payload "Encrypted NWK payload" (öteye İNİLMEZ, brief).
 * APS: yalnız Data frame + Unicast/Broadcast delivery + Extended Header YOK
 * durumu tam çözülür (Group addressing/Extended Header dar kapsam dışı, ham+
 * uyarı). Security=1 ise "Encrypted APS payload" (ZCL'e hiç geçilmez).
 * ZCL: APS Cluster ID + Read Attributes Response/Report Attributes'taki
 * Attribute ID'ler dar bir cluster/attribute kütüphanesiyle adlandırılır
 * (dalga 8'in "karar 5" borcu — bkz. CLUSTER/ATTRIBUTE KÜTÜPHANESİ aşağıda).
 * Global komutların TÜMÜ isimle tanınır ama yalnız Read Attributes
 * Response(0x01)/Report Attributes(0x0A)/Default Response(0x0B) payload'ı
 * çözülür (karar 5); kalan global komutlar + TÜM cluster-specific komutlar
 * hâlâ ham+uyarı (yalnız etiket cluster adını taşır, gövde çözülmez).
 * Attribute value dar veri tipi kümesi (Boolean/Uint8-32/Int8-32/Enum8-16/
 * Single/Octet+Character String) — bilinmeyen tipte uzunluk belirsizleştiği
 * için zincir orada durur (ham kalan + uyarı).
 *
 * ── CLUSTER/ATTRIBUTE KÜTÜPHANESİ (dalga 8, dar küme) ───────────────────────
 * TAM ZCL kütüphanesi (CSA'nın yüzlerce cluster'ı) DEĞİL — Home Automation'da
 * en yaygın 18 cluster (Zigbee2MQTT/deCONZ'un da öncelikli desteklediği aile).
 * Kaynak: zigbee-herdsman `src/zspec/zcl/definition/cluster.ts` (Apache-2.0)
 * + Wireshark `packet-zbee-zcl-*.c` (`ZBEE_ZCL_ATTR_ID_*` sabitleri) çapraz
 * doğrulaması (2026-08-19). Level Control/Door Lock/IAS Zone'da birkaç
 * attribute (`ZCL_CLUSTERS` içinde "tek kaynak" yorumlu) YALNIZ herdsman'da
 * var — o üç cluster'ın Wireshark dissector'ü spec'in tamamını kapsamıyor;
 * satırlar gerçek (herdsman'dan), yalnız ikinci çapraz kaynağı yok. Dar küme
 * dışı Cluster/Attribute ID'ler hata DEĞİL: `valid: true` kalır, yalnız
 * `physicalValue` boş — açık/seyrek bir ID uzayında "bilmediğim cluster" hep
 * beklenen durumdur (bleAdvertisement.ts'in bilinmeyen Company ID'yi ham hex'e
 * düşürüp uyarı basmaması emsali, MAC Frame Type'ın kapalı 3-bit enum'undan
 * FARKLI bir sınıf).
 *
 * ── BİT SIRASI: 802.15.4/NWK/APS/ZCL HEPSİ LSB-FIRST, LITTLE-ENDIAN ────────
 * "All multiple octet fields... least significant octet first, each octet...
 * least significant bit (LSB) first" (IEEE 802.15.4-2006 §nn, birebir).
 * bitCursor `lsb-first`, multi-byte alan okuma LE (dalga 7 tuzak notu).
 *
 * ── FCS: BU DALGADA GERÇEKTEN DOĞRULANIR (BLE/LoRaWAN'ın TERSİ) ───────────
 * MIC/checksum'ın "anahtar gerektirdiği için asla PASS/FAIL basılmaz" kuralı
 * (mavlink emsali) FCS için GEÇERSİZ — FCS anahtarsız, sade bir CRC16, gerçek
 * PASS/FAIL üretilir (dalga 7 karar 7, Modbus/DNP3 CRC emsali). NWK/APS/ZCL
 * security'nin ("MIC valid/invalid/unable to verify") anahtar gerektirmesiyle
 * KARIŞTIRILMAZ — bu üçü hâlâ hiç doğrulanmaz, encrypted+ham bırakılır.
 *
 * ── GÖSTERİM: 64-bit ADRESLER TERS YAZILIR ─────────────────────────────────
 * IEEE 64-bit adresler (MAC Extended, NWK Dest/Src IEEE) wire'da LE; ekranda
 * geleneksel EUI64 gösterimiyle TERS/ayraçlı (BLE AdvA / LoRaWAN EUI emsali).
 * 16-bit NWK adresleri tek hex sayı (LoRaWAN DevAddr emsali — oturum/ağ
 * adresleri ayraçsız gösterilir, yalnız kalıcı donanım kimlikleri ayraçlı).
 */

import { readBitsAsNumber, toSignedBits } from '@/protocol-core/decoding/bitCursor';
import { computeNamedCrc } from '@/protocol-core/checksums/crcCatalogue';
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

const PROTOCOL_ID = 'zigbee';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'Zigbee';
const TRANSLATION_KEY_PREFIX = 'protocol.zigbee';

// ───────────────────────── 802.15.4 MAC sabitleri ─────────────────────────

const MAC_FCF_LENGTH = 2;
const MAC_SEQ_LENGTH = 1;
const MAC_PAN_ID_LENGTH = 2;
const MAC_SHORT_ADDR_LENGTH = 2;
const MAC_EXT_ADDR_LENGTH = 8;
const MAC_FCS_LENGTH = 2;
const MAC_MIN_LENGTH = MAC_FCF_LENGTH + MAC_SEQ_LENGTH + MAC_FCS_LENGTH;

const MAC_FRAME_TYPE_BIT_POSITION = 0;
const MAC_FRAME_TYPE_BIT_LENGTH = 3;
const MAC_SECURITY_BIT_POSITION = 3;
const MAC_FRAME_PENDING_BIT_POSITION = 4;
const MAC_ACK_REQUEST_BIT_POSITION = 5;
const MAC_PAN_ID_COMPRESSION_BIT_POSITION = 6;
const MAC_DEST_ADDR_MODE_BIT_POSITION = 10;
const MAC_ADDR_MODE_BIT_LENGTH = 2;
const MAC_FRAME_VERSION_BIT_POSITION = 12;
const MAC_FRAME_VERSION_BIT_LENGTH = 2;
const MAC_SRC_ADDR_MODE_BIT_POSITION = 14;

const MAC_FRAME_TYPE_DATA = 0b001;
/** IEEE 802.15.4-2006 §7.2.1.1.1 Table 79 — 0/1/2/3 resmi metinden; 4-7 spec'te topluca "Reserved" (dosya başı). */
const MAC_FRAME_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [0b000, 'Beacon'],
  [MAC_FRAME_TYPE_DATA, 'Data'],
  [0b010, 'Acknowledgment'],
  [0b011, 'MAC Command'],
]);

const MAC_ADDR_MODE_NONE = 0b00;
const MAC_ADDR_MODE_SHORT = 0b10;
const MAC_ADDR_MODE_EXT = 0b11;
/** IEEE 802.15.4-2006 §7.2.1.1.6/.8 Table 80 — resmi metin, dest/src ortak. */
const MAC_ADDR_MODE_NAMES: ReadonlyMap<number, string> = new Map([
  [MAC_ADDR_MODE_NONE, 'Not present'],
  [0b01, 'Reserved'],
  [MAC_ADDR_MODE_SHORT, '16-bit short address'],
  [MAC_ADDR_MODE_EXT, '64-bit extended address'],
]);

const MAC_FRAME_VERSION_2003 = 0b00;
const MAC_FRAME_VERSION_2006 = 0b01;
/** IEEE 802.15.4-2006 §7.2.1.1.7 — resmi metin. 2015+ (Table 7-6) bu dalgada desteklenmez (dosya başı). */
const MAC_FRAME_VERSION_NAMES: ReadonlyMap<number, string> = new Map([
  [MAC_FRAME_VERSION_2003, 'IEEE 802.15.4-2003'],
  [MAC_FRAME_VERSION_2006, 'IEEE 802.15.4-2006'],
]);

// ───────────────────────── Zigbee NWK sabitleri ─────────────────────────

const NWK_FCF_LENGTH = 2;
const NWK_ADDR_LENGTH = 2;
const NWK_RADIUS_LENGTH = 1;
const NWK_SEQ_LENGTH = 1;
const NWK_EXT_ADDR_LENGTH = 8;
const NWK_MIN_LENGTH = NWK_FCF_LENGTH + NWK_ADDR_LENGTH * 2 + NWK_RADIUS_LENGTH + NWK_SEQ_LENGTH;

const NWK_FRAME_TYPE_BIT_POSITION = 0;
const NWK_FRAME_TYPE_BIT_LENGTH = 2;
const NWK_PROTOCOL_VERSION_BIT_POSITION = 2;
const NWK_PROTOCOL_VERSION_BIT_LENGTH = 4;
const NWK_DISCOVER_ROUTE_BIT_POSITION = 6;
const NWK_DISCOVER_ROUTE_BIT_LENGTH = 2;
const NWK_MULTICAST_BIT_POSITION = 8;
const NWK_SECURITY_BIT_POSITION = 9;
const NWK_SOURCE_ROUTE_BIT_POSITION = 10;
const NWK_EXT_DEST_BIT_POSITION = 11;
const NWK_EXT_SOURCE_BIT_POSITION = 12;

const NWK_FRAME_TYPE_DATA = 0b00;
/** CSA 05-3474-23 §3.3.1.1 (resmi) + Wireshark packet-zbee-nwk.h (dosya başı). */
const NWK_FRAME_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [NWK_FRAME_TYPE_DATA, 'Data'],
  [0b01, 'NWK command'],
  [0b11, 'Inter-PAN'],
]);

// ───────────────────────── Zigbee APS sabitleri ─────────────────────────

const APS_FCF_LENGTH = 1;
const APS_ENDPOINT_LENGTH = 1;
const APS_CLUSTER_ID_LENGTH = 2;
const APS_PROFILE_ID_LENGTH = 2;
const APS_COUNTER_LENGTH = 1;
const APS_MIN_LENGTH = APS_FCF_LENGTH;

const APS_FRAME_TYPE_BIT_POSITION = 0;
const APS_FRAME_TYPE_BIT_LENGTH = 2;
const APS_DELIVERY_MODE_BIT_POSITION = 2;
const APS_DELIVERY_MODE_BIT_LENGTH = 2;
const APS_ACK_FORMAT_BIT_POSITION = 4;
const APS_SECURITY_BIT_POSITION = 5;
const APS_ACK_REQUEST_BIT_POSITION = 6;
const APS_EXTENDED_HEADER_BIT_POSITION = 7;

const APS_FRAME_TYPE_DATA = 0b00;
/** CSA 05-3474-23 §2.2.5.1.1 Table 2-20 (resmi) + Wireshark packet-zbee-aps.h (dosya başı). */
const APS_FRAME_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [APS_FRAME_TYPE_DATA, 'Data'],
  [0b01, 'Command'],
  [0b10, 'Acknowledgement'],
  [0b11, 'Inter-PAN APS'],
]);

const APS_DELIVERY_MODE_UNICAST = 0b00;
const APS_DELIVERY_MODE_GROUP = 0b11;
/** CSA 05-3474-23 §2.2.5.1.2 Table 2-21 (resmi). */
const APS_DELIVERY_MODE_NAMES: ReadonlyMap<number, string> = new Map([
  [APS_DELIVERY_MODE_UNICAST, 'Normal unicast delivery'],
  [0b01, 'Reserved'],
  [0b10, 'Broadcast'],
  [APS_DELIVERY_MODE_GROUP, 'Group addressing'],
]);

// ───────────────────────── ZCL sabitleri ─────────────────────────

const ZCL_FCF_LENGTH = 1;
const ZCL_MFR_CODE_LENGTH = 2;
const ZCL_TSN_LENGTH = 1;
const ZCL_CMD_ID_LENGTH = 1;
const ZCL_MIN_LENGTH = ZCL_FCF_LENGTH + ZCL_TSN_LENGTH + ZCL_CMD_ID_LENGTH;

const ZCL_FRAME_TYPE_BIT_POSITION = 0;
const ZCL_FRAME_TYPE_BIT_LENGTH = 2;
const ZCL_MFR_SPECIFIC_BIT_POSITION = 2;
const ZCL_DIRECTION_BIT_POSITION = 3;
const ZCL_DISABLE_DEFAULT_RESPONSE_BIT_POSITION = 4;

const ZCL_FRAME_TYPE_GLOBAL = 0b00;
const ZCL_FRAME_TYPE_CLUSTER_SPECIFIC = 0b01;
const ZCL_FRAME_TYPE_NAMES: ReadonlyMap<number, string> = new Map([
  [ZCL_FRAME_TYPE_GLOBAL, 'Profile-wide (Global)'],
  [ZCL_FRAME_TYPE_CLUSTER_SPECIFIC, 'Cluster-specific'],
]);

const ZCL_CMD_READ_ATTR = 0x00;
const ZCL_CMD_READ_ATTR_RESP = 0x01;
const ZCL_CMD_REPORT_ATTR = 0x0a;
const ZCL_CMD_DEFAULT_RESP = 0x0b;
/** Wireshark packet-zbee-zcl.h + zigbee-herdsman foundation.ts — iki bağımsız açık kaynak, bit bit örtüşüyor (dosya başı). */
const ZCL_GLOBAL_COMMAND_NAMES: ReadonlyMap<number, string> = new Map([
  [ZCL_CMD_READ_ATTR, 'Read Attributes'],
  [ZCL_CMD_READ_ATTR_RESP, 'Read Attributes Response'],
  [0x02, 'Write Attributes'],
  [0x03, 'Write Attributes Undivided'],
  [0x04, 'Write Attributes Response'],
  [0x05, 'Write Attributes No Response'],
  [0x06, 'Configure Reporting'],
  [0x07, 'Configure Reporting Response'],
  [0x08, 'Read Reporting Configuration'],
  [0x09, 'Read Reporting Configuration Response'],
  [ZCL_CMD_REPORT_ATTR, 'Report Attributes'],
  [ZCL_CMD_DEFAULT_RESP, 'Default Response'],
  [0x0c, 'Discover Attributes'],
  [0x0d, 'Discover Attributes Response'],
  [0x0e, 'Read Attributes Structured'],
  [0x0f, 'Write Attributes Structured'],
  [0x10, 'Write Attributes Structured Response'],
  [0x11, 'Discover Commands Received'],
  [0x12, 'Discover Commands Received Response'],
  [0x13, 'Discover Commands Generated'],
  [0x14, 'Discover Commands Generated Response'],
  [0x15, 'Discover Attributes Extended'],
  [0x16, 'Discover Attributes Extended Response'],
]);

const ZCL_STATUS_SUCCESS = 0x00;

type ZclDataTypeKind = 'boolean' | 'uint' | 'int' | 'enum' | 'single' | 'octet-string' | 'char-string';

interface ZclDataTypeInfo {
  readonly name: string;
  readonly kind: ZclDataTypeKind;
  /** Sabit genişlikli tiplerde bayt sayısı; string tiplerinde `undefined` (1B uzunluk öneki kendi belirler). */
  readonly fixedLength?: number;
}

/** Dar veri tipi kümesi (karar 5) — Wireshark packet-zbee-zcl.h + zigbee-herdsman datatypes.ts, bit bit örtüşüyor (dosya başı). */
const ZCL_DATA_TYPES: ReadonlyMap<number, ZclDataTypeInfo> = new Map([
  [0x10, { name: 'Boolean', kind: 'boolean', fixedLength: 1 }],
  [0x20, { name: 'Unsigned 8-bit Integer', kind: 'uint', fixedLength: 1 }],
  [0x21, { name: 'Unsigned 16-bit Integer', kind: 'uint', fixedLength: 2 }],
  [0x23, { name: 'Unsigned 32-bit Integer', kind: 'uint', fixedLength: 4 }],
  [0x28, { name: 'Signed 8-bit Integer', kind: 'int', fixedLength: 1 }],
  [0x29, { name: 'Signed 16-bit Integer', kind: 'int', fixedLength: 2 }],
  [0x2b, { name: 'Signed 32-bit Integer', kind: 'int', fixedLength: 4 }],
  [0x30, { name: '8-bit Enumeration', kind: 'enum', fixedLength: 1 }],
  [0x31, { name: '16-bit Enumeration', kind: 'enum', fixedLength: 2 }],
  [0x39, { name: 'Single Precision Float', kind: 'single', fixedLength: 4 }],
  [0x41, { name: 'Octet String', kind: 'octet-string' }],
  [0x42, { name: 'Character String', kind: 'char-string' }],
]);

interface ZclAttributeInfo {
  readonly name: string;
}

interface ZclClusterInfo {
  readonly name: string;
  readonly attributes: ReadonlyMap<number, ZclAttributeInfo>;
}

/** Dar cluster/attribute kütüphanesi (dosya başı CLUSTER/ATTRIBUTE KÜTÜPHANESİ) — Wireshark + zigbee-herdsman çapraz doğrulaması. */
const ZCL_CLUSTERS: ReadonlyMap<number, ZclClusterInfo> = new Map([
  [
    0x0000,
    {
      name: 'Basic',
      attributes: new Map([
        [0x0000, { name: 'zclVersion' }],
        [0x0001, { name: 'appVersion' }],
        [0x0003, { name: 'hwVersion' }],
        [0x0004, { name: 'manufacturerName' }],
        [0x0005, { name: 'modelId' }],
        [0x0006, { name: 'dateCode' }],
        [0x0007, { name: 'powerSource' }],
        [0x4000, { name: 'swBuildId' }],
      ]),
    },
  ],
  [
    0x0001,
    {
      name: 'Power Configuration',
      attributes: new Map([
        [0x0000, { name: 'mainsVoltage' }],
        [0x0001, { name: 'mainsFrequency' }],
        [0x0010, { name: 'mainsAlarmMask' }],
        [0x0020, { name: 'batteryVoltage' }],
        [0x0021, { name: 'batteryPercentageRemaining' }],
        [0x0030, { name: 'batteryManufacturer' }],
        [0x0031, { name: 'batterySize' }],
        [0x0033, { name: 'batteryQuantity' }],
        [0x0034, { name: 'batteryRatedVoltage' }],
        [0x0035, { name: 'batteryAlarmMask' }],
      ]),
    },
  ],
  [0x0003, { name: 'Identify', attributes: new Map([[0x0000, { name: 'identifyTime' }]]) }],
  [0x0004, { name: 'Groups', attributes: new Map([[0x0000, { name: 'nameSupport' }]]) }],
  [
    0x0005,
    {
      name: 'Scenes',
      attributes: new Map([
        [0x0000, { name: 'count' }],
        [0x0001, { name: 'currentScene' }],
        [0x0002, { name: 'currentGroup' }],
        [0x0003, { name: 'sceneValid' }],
        [0x0004, { name: 'nameSupport' }],
        [0x0005, { name: 'lastCfgBy' }],
      ]),
    },
  ],
  [
    0x0006,
    {
      name: 'On/Off',
      attributes: new Map([
        [0x0000, { name: 'onOff' }],
        [0x4000, { name: 'globalSceneCtrl' }],
        [0x4001, { name: 'onTime' }],
        [0x4002, { name: 'offWaitTime' }],
        [0x4003, { name: 'startUpOnOff' }],
      ]),
    },
  ],
  [
    0x0008,
    {
      name: 'Level Control',
      attributes: new Map([
        [0x0000, { name: 'currentLevel' }],
        [0x0001, { name: 'remainingTime' }],
        [0x0002, { name: 'minLevel' }], // tek kaynak (herdsman) — dosya başı
        [0x0003, { name: 'maxLevel' }], // tek kaynak (herdsman) — dosya başı
        [0x000f, { name: 'options' }], // tek kaynak (herdsman) — dosya başı
        [0x0010, { name: 'onOffTransitionTime' }],
        [0x0011, { name: 'onLevel' }],
        [0x4000, { name: 'startUpCurrentLevel' }],
      ]),
    },
  ],
  [
    0x0101,
    {
      name: 'Door Lock',
      attributes: new Map([
        [0x0000, { name: 'lockState' }],
        [0x0001, { name: 'lockType' }],
        [0x0002, { name: 'actuatorEnabled' }],
        [0x0003, { name: 'doorState' }],
        [0x0012, { name: 'numOfPinUsersSupported' }], // tek kaynak (herdsman) — dosya başı
        [0x0017, { name: 'maxPinLen' }], // tek kaynak (herdsman) — dosya başı
        [0x0021, { name: 'language' }], // tek kaynak (herdsman) — dosya başı
        [0x0023, { name: 'autoRelockTime' }], // tek kaynak (herdsman) — dosya başı
        [0x0024, { name: 'soundVolume' }], // tek kaynak (herdsman) — dosya başı
      ]),
    },
  ],
  [
    0x0201,
    {
      name: 'Thermostat',
      attributes: new Map([
        [0x0000, { name: 'localTemp' }],
        [0x0007, { name: 'pICoolingDemand' }],
        [0x0008, { name: 'pIHeatingDemand' }],
        [0x0010, { name: 'localTemperatureCalibration' }],
        [0x0011, { name: 'occupiedCoolingSetpoint' }],
        [0x0012, { name: 'occupiedHeatingSetpoint' }],
        [0x001b, { name: 'ctrlSeqeOfOper' }],
        [0x001c, { name: 'systemMode' }],
        [0x001e, { name: 'runningMode' }],
        [0x0029, { name: 'runningState' }],
      ]),
    },
  ],
  [
    0x0300,
    {
      name: 'Color Control',
      attributes: new Map([
        [0x0000, { name: 'currentHue' }],
        [0x0001, { name: 'currentSaturation' }],
        [0x0003, { name: 'currentX' }],
        [0x0004, { name: 'currentY' }],
        [0x0007, { name: 'colorTemperature' }],
        [0x0008, { name: 'colorMode' }],
        [0x400a, { name: 'colorCapabilities' }],
        [0x400b, { name: 'colorTempPhysicalMin' }],
        [0x400c, { name: 'colorTempPhysicalMax' }],
      ]),
    },
  ],
  [
    0x0400,
    {
      name: 'Illuminance Measurement',
      attributes: new Map([
        [0x0000, { name: 'measuredValue' }],
        [0x0001, { name: 'minMeasuredValue' }],
        [0x0002, { name: 'maxMeasuredValue' }],
        [0x0003, { name: 'tolerance' }],
        [0x0004, { name: 'lightSensorType' }],
      ]),
    },
  ],
  [
    0x0402,
    {
      name: 'Temperature Measurement',
      attributes: new Map([
        [0x0000, { name: 'measuredValue' }],
        [0x0001, { name: 'minMeasuredValue' }],
        [0x0002, { name: 'maxMeasuredValue' }],
        [0x0003, { name: 'tolerance' }],
      ]),
    },
  ],
  [
    0x0403,
    {
      name: 'Pressure Measurement',
      attributes: new Map([
        [0x0000, { name: 'measuredValue' }],
        [0x0001, { name: 'minMeasuredValue' }],
        [0x0002, { name: 'maxMeasuredValue' }],
        [0x0003, { name: 'tolerance' }],
        [0x0010, { name: 'scaledValue' }],
        [0x0011, { name: 'minScaledValue' }],
        [0x0012, { name: 'maxScaledValue' }],
        [0x0013, { name: 'scaledTolerance' }],
        [0x0014, { name: 'scale' }],
      ]),
    },
  ],
  [
    0x0405,
    {
      name: 'Relative Humidity Measurement',
      attributes: new Map([
        [0x0000, { name: 'measuredValue' }],
        [0x0001, { name: 'minMeasuredValue' }],
        [0x0002, { name: 'maxMeasuredValue' }],
        [0x0003, { name: 'tolerance' }],
      ]),
    },
  ],
  [
    0x0406,
    {
      name: 'Occupancy Sensing',
      attributes: new Map([
        [0x0000, { name: 'occupancy' }],
        [0x0001, { name: 'occupancySensorType' }],
        [0x0002, { name: 'occupancySensorTypeBitmap' }],
        [0x0010, { name: 'pirOToUDelay' }],
        [0x0011, { name: 'pirUToODelay' }],
        [0x0012, { name: 'pirUToOThreshold' }],
        [0x0020, { name: 'ultrasonicOToUDelay' }],
        [0x0021, { name: 'ultrasonicUToODelay' }],
        [0x0022, { name: 'ultrasonicUToOThreshold' }],
      ]),
    },
  ],
  [
    0x0500,
    {
      name: 'IAS Zone',
      attributes: new Map([
        [0x0000, { name: 'zoneState' }],
        [0x0001, { name: 'zoneType' }],
        [0x0002, { name: 'zoneStatus' }],
        [0x0010, { name: 'iasCieAddr' }],
        [0x0011, { name: 'zoneId' }], // tek kaynak (herdsman) — dosya başı
        [0x0012, { name: 'numZoneSensitivityLevelsSupported' }], // tek kaynak (herdsman) — dosya başı
        [0x0013, { name: 'currentZoneSensitivityLevel' }], // tek kaynak (herdsman) — dosya başı
      ]),
    },
  ],
  [
    0x0b04,
    {
      name: 'Electrical Measurement',
      attributes: new Map([
        [0x0000, { name: 'measurementType' }],
        [0x0505, { name: 'rmsVoltage' }],
        [0x0508, { name: 'rmsCurrent' }],
        [0x050b, { name: 'activePower' }],
        [0x050f, { name: 'apparentPower' }],
        [0x0510, { name: 'powerFactor' }],
        [0x0600, { name: 'acVoltageMultiplier' }],
        [0x0601, { name: 'acVoltageDivisor' }],
        [0x0602, { name: 'acCurrentMultiplier' }],
        [0x0603, { name: 'acCurrentDivisor' }],
      ]),
    },
  ],
  [
    0x0702,
    {
      name: 'Metering',
      attributes: new Map([
        [0x0000, { name: 'currentSummDelivered' }],
        [0x0001, { name: 'currentSummReceived' }],
        [0x0006, { name: 'powerFactor' }],
        [0x0200, { name: 'status' }],
        [0x0300, { name: 'unitOfMeasure' }],
        [0x0301, { name: 'multiplier' }],
        [0x0302, { name: 'divisor' }],
        [0x0306, { name: 'meteringDeviceType' }],
        [0x0400, { name: 'instantaneousDemand' }],
      ]),
    },
  ],
]);

// ───────────────────────── hata/uyarı anahtarları ─────────────────────────

const ERROR_FRAME_TOO_SHORT = `${TRANSLATION_KEY_PREFIX}.error.frameTooShort`;
const ERROR_FRAME_TOO_LONG = `${TRANSLATION_KEY_PREFIX}.error.frameTooLong`;
const ERROR_ABORTED = `${TRANSLATION_KEY_PREFIX}.error.aborted`;
const ERROR_FCS_MISMATCH = `${TRANSLATION_KEY_PREFIX}.error.fcsMismatch`;
const ERROR_MAC_ADDRESSING_TRUNCATED = `${TRANSLATION_KEY_PREFIX}.error.macAddressingTruncated`;
const ERROR_NWK_TRUNCATED = `${TRANSLATION_KEY_PREFIX}.error.nwkTruncated`;
const ERROR_APS_TRUNCATED = `${TRANSLATION_KEY_PREFIX}.error.apsTruncated`;

const WARN_FRAME_VERSION_UNSUPPORTED = `${TRANSLATION_KEY_PREFIX}.warning.frameVersionUnsupported`;
const WARN_NON_DATA_FRAME = `${TRANSLATION_KEY_PREFIX}.warning.nonDataFrame`;
const WARN_NWK_ADVANCED_ADDRESSING = `${TRANSLATION_KEY_PREFIX}.warning.nwkAdvancedAddressing`;
const WARN_NWK_ENCRYPTED = `${TRANSLATION_KEY_PREFIX}.warning.nwkEncrypted`;
const WARN_NWK_NON_DATA = `${TRANSLATION_KEY_PREFIX}.warning.nwkNonData`;
const WARN_APS_OUT_OF_SCOPE = `${TRANSLATION_KEY_PREFIX}.warning.apsOutOfScope`;
const WARN_APS_ENCRYPTED = `${TRANSLATION_KEY_PREFIX}.warning.apsEncrypted`;
const WARN_APS_NON_DATA = `${TRANSLATION_KEY_PREFIX}.warning.apsNonData`;
const WARN_ZCL_CLUSTER_SPECIFIC_NOT_DECODED = `${TRANSLATION_KEY_PREFIX}.warning.zclClusterSpecificNotDecoded`;
const WARN_ZCL_GLOBAL_COMMAND_NOT_DECODED = `${TRANSLATION_KEY_PREFIX}.warning.zclGlobalCommandNotDecoded`;
const WARN_ZCL_UNKNOWN_DATA_TYPE = `${TRANSLATION_KEY_PREFIX}.warning.zclUnknownDataType`;

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/** noUncheckedIndexedAccess: bayt dizisi erişimi her yerde bu guard'dan geçer. */
function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function toHex(value: number, byteWidth: number): string {
  return `0x${value.toString(16).padStart(byteWidth * 2, '0').toUpperCase()}`;
}

function readUint16Le(bytes: Uint8Array, offset: number): number {
  return byteAt(bytes, offset) | (byteAt(bytes, offset + 1) << 8);
}

function readUint32Le(bytes: Uint8Array, offset: number): number {
  return (
    (byteAt(bytes, offset) |
      (byteAt(bytes, offset + 1) << 8) |
      (byteAt(bytes, offset + 2) << 16) |
      (byteAt(bytes, offset + 3) << 24)) >>>
    0
  );
}

/** Wire LE; ekranda geleneksel EUI64 gösterimiyle TERS/ayraçlı (dosya başı gösterim ayrımı). */
function formatEui64(bytes: Uint8Array): string {
  return Array.from(bytes)
    .reverse()
    .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
    .join(':');
}

function macAddressLength(mode: number): number {
  if (mode === MAC_ADDR_MODE_SHORT) return MAC_SHORT_ADDR_LENGTH;
  if (mode === MAC_ADDR_MODE_EXT) return MAC_EXT_ADDR_LENGTH;
  return 0;
}

function formatMacAddress(mode: number, bytes: Uint8Array): string {
  if (mode === MAC_ADDR_MODE_EXT) return formatEui64(bytes);
  return toHex(readUint16Le(bytes, 0), 2);
}

interface MacAddressingPlan {
  readonly destPanPresent: boolean;
  readonly srcPanPresent: boolean;
  readonly supported: boolean;
}

/** IEEE 802.15.4-2006 §7.2.1.1.5/.5 (resmi metin, birebir) — yalnız 2003/2006 (dosya başı). */
function planMacAddressing(destMode: number, srcMode: number, panIdCompression: number, frameVersion: number): MacAddressingPlan {
  if (frameVersion !== MAC_FRAME_VERSION_2003 && frameVersion !== MAC_FRAME_VERSION_2006) {
    return { destPanPresent: false, srcPanPresent: false, supported: false };
  }
  const destPresent = destMode !== MAC_ADDR_MODE_NONE;
  const srcPresent = srcMode !== MAC_ADDR_MODE_NONE;
  if (destPresent && srcPresent) {
    return { destPanPresent: true, srcPanPresent: panIdCompression === 0, supported: true };
  }
  if (destPresent) return { destPanPresent: true, srcPanPresent: false, supported: true };
  if (srcPresent) return { destPanPresent: false, srcPanPresent: true, supported: true };
  return { destPanPresent: false, srcPanPresent: false, supported: true };
}

function decodeZclValue(kind: ZclDataTypeKind, fixedLength: number | undefined, data: Uint8Array, offset: number): { length: number; physicalValue: string } | undefined {
  switch (kind) {
    case 'boolean': {
      const raw = byteAt(data, offset);
      return { length: 1, physicalValue: raw === 0x01 ? 'true' : raw === 0x00 ? 'false' : 'invalid' };
    }
    case 'uint': {
      const width = fixedLength ?? 1;
      const value = width === 1 ? byteAt(data, offset) : width === 2 ? readUint16Le(data, offset) : readUint32Le(data, offset);
      return { length: width, physicalValue: String(value) };
    }
    case 'int': {
      const width = fixedLength ?? 1;
      const raw = width === 1 ? byteAt(data, offset) : width === 2 ? readUint16Le(data, offset) : readUint32Le(data, offset);
      return { length: width, physicalValue: toSignedBits(BigInt(raw), width * 8).toString() };
    }
    case 'enum': {
      const width = fixedLength ?? 1;
      const value = width === 1 ? byteAt(data, offset) : readUint16Le(data, offset);
      return { length: width, physicalValue: toHex(value, width) };
    }
    case 'single': {
      if (offset + 4 > data.length) return undefined;
      const view = new DataView(data.buffer, data.byteOffset + offset, 4);
      return { length: 4, physicalValue: view.getFloat32(0, true).toString() };
    }
    case 'octet-string': {
      const length = byteAt(data, offset);
      return { length: 1 + length, physicalValue: `${String(length)}B` };
    }
    case 'char-string': {
      const length = byteAt(data, offset);
      const text = new TextDecoder('utf-8').decode(data.slice(offset + 1, offset + 1 + length));
      return { length: 1 + length, physicalValue: text };
    }
  }
}

interface ZigbeeParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
}

function parseZigbeeFrame(data: Uint8Array, options: ZigbeeParseOptions): ParseResult {
  if (options.signal?.aborted === true) {
    return { success: false, error: { code: 'parser-timeout', message: ERROR_ABORTED }, consumedBytes: 0, recoverable: false };
  }
  if (data.length < MAC_MIN_LENGTH) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_FRAME_TOO_SHORT, offset: 0, length: data.length },
      consumedBytes: 0,
      recoverable: true,
    };
  }
  const maxFrameLength = options.maxFrameLength;
  if (maxFrameLength !== undefined && data.length > maxFrameLength) {
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

  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  // ═══════════════════════ 802.15.4 MAC ═══════════════════════

  const macFrameType = readBitsAsNumber(data, MAC_FRAME_TYPE_BIT_POSITION, MAC_FRAME_TYPE_BIT_LENGTH, 'lsb-first');
  const macFrameTypeField: ParsedField = {
    id: 'mac-frame-type',
    name: 'MAC Frame Type',
    offset: 0,
    length: MAC_FRAME_TYPE_BIT_LENGTH,
    rawBytes: data.slice(0, 1),
    rawValue: macFrameType,
    valid: MAC_FRAME_TYPE_NAMES.has(macFrameType),
    warnings: [],
  };
  const macFrameTypeName = MAC_FRAME_TYPE_NAMES.get(macFrameType);
  if (macFrameTypeName !== undefined) macFrameTypeField.physicalValue = macFrameTypeName;
  fields.push(macFrameTypeField);

  const macSecurity = readBitsAsNumber(data, MAC_SECURITY_BIT_POSITION, 1, 'lsb-first');
  fields.push({ id: 'mac-security', name: 'Security Enabled', offset: 0, length: 1, rawBytes: data.slice(0, 1), rawValue: macSecurity, valid: true, warnings: [] });

  const macFramePending = readBitsAsNumber(data, MAC_FRAME_PENDING_BIT_POSITION, 1, 'lsb-first');
  fields.push({ id: 'mac-frame-pending', name: 'Frame Pending', offset: 0, length: 1, rawBytes: data.slice(0, 1), rawValue: macFramePending, valid: true, warnings: [] });

  const macAckRequest = readBitsAsNumber(data, MAC_ACK_REQUEST_BIT_POSITION, 1, 'lsb-first');
  fields.push({ id: 'mac-ack-request', name: 'Ack Request', offset: 0, length: 1, rawBytes: data.slice(0, 1), rawValue: macAckRequest, valid: true, warnings: [] });

  const macPanIdCompression = readBitsAsNumber(data, MAC_PAN_ID_COMPRESSION_BIT_POSITION, 1, 'lsb-first');
  fields.push({ id: 'mac-pan-id-compression', name: 'PAN ID Compression', offset: 0, length: 1, rawBytes: data.slice(0, 1), rawValue: macPanIdCompression, valid: true, warnings: [] });

  const macDestAddrMode = readBitsAsNumber(data, MAC_DEST_ADDR_MODE_BIT_POSITION, MAC_ADDR_MODE_BIT_LENGTH, 'lsb-first');
  fields.push({
    id: 'mac-dest-addr-mode',
    name: 'Destination Addressing Mode',
    offset: 1,
    length: MAC_ADDR_MODE_BIT_LENGTH,
    rawBytes: data.slice(1, 2),
    rawValue: macDestAddrMode,
    physicalValue: MAC_ADDR_MODE_NAMES.get(macDestAddrMode),
    valid: true,
    warnings: [],
  });

  const macFrameVersion = readBitsAsNumber(data, MAC_FRAME_VERSION_BIT_POSITION, MAC_FRAME_VERSION_BIT_LENGTH, 'lsb-first');
  const macFrameVersionField: ParsedField = {
    id: 'mac-frame-version',
    name: 'Frame Version',
    offset: 1,
    length: MAC_FRAME_VERSION_BIT_LENGTH,
    rawBytes: data.slice(1, 2),
    rawValue: macFrameVersion,
    valid: true,
    warnings: [],
  };
  const macFrameVersionName = MAC_FRAME_VERSION_NAMES.get(macFrameVersion);
  if (macFrameVersionName !== undefined) {
    macFrameVersionField.physicalValue = macFrameVersionName;
  } else {
    macFrameVersionField.warnings = [WARN_FRAME_VERSION_UNSUPPORTED];
    warnings.push(toProtocolWarning(WARN_FRAME_VERSION_UNSUPPORTED));
  }
  fields.push(macFrameVersionField);

  const macSrcAddrMode = readBitsAsNumber(data, MAC_SRC_ADDR_MODE_BIT_POSITION, MAC_ADDR_MODE_BIT_LENGTH, 'lsb-first');
  fields.push({
    id: 'mac-src-addr-mode',
    name: 'Source Addressing Mode',
    offset: 1,
    length: MAC_ADDR_MODE_BIT_LENGTH,
    rawBytes: data.slice(1, 2),
    rawValue: macSrcAddrMode,
    physicalValue: MAC_ADDR_MODE_NAMES.get(macSrcAddrMode),
    valid: true,
    warnings: [],
  });

  fields.push({
    id: 'mac-seq',
    name: 'Sequence Number',
    offset: MAC_FCF_LENGTH,
    length: MAC_SEQ_LENGTH,
    rawBytes: data.slice(MAC_FCF_LENGTH, MAC_FCF_LENGTH + MAC_SEQ_LENGTH),
    rawValue: byteAt(data, MAC_FCF_LENGTH),
    valid: true,
    warnings: [],
  });

  let cursor = MAC_FCF_LENGTH + MAC_SEQ_LENGTH;
  const fcsOffset = data.length - MAC_FCS_LENGTH;
  let macPayloadStart = cursor;
  let macPayloadEnd = fcsOffset;
  let nwkPayload: Uint8Array | undefined;

  const addressingPlan = planMacAddressing(macDestAddrMode, macSrcAddrMode, macPanIdCompression, macFrameVersion);

  if (!addressingPlan.supported) {
    // Frame Version 2015+/reserved — Table 7-6 karmaşık ve Zigbee'de kullanılmaz (dosya başı).
    macPayloadStart = cursor;
  } else {
    let truncated = false;
    if (addressingPlan.destPanPresent) {
      if (cursor + MAC_PAN_ID_LENGTH > fcsOffset) truncated = true;
      else {
        fields.push({ id: 'mac-dest-pan', name: 'Destination PAN ID', offset: cursor, length: MAC_PAN_ID_LENGTH, rawBytes: data.slice(cursor, cursor + MAC_PAN_ID_LENGTH), rawValue: toHex(readUint16Le(data, cursor), 2), valid: true, warnings: [] });
        cursor += MAC_PAN_ID_LENGTH;
      }
    }
    if (!truncated && macDestAddrMode !== MAC_ADDR_MODE_NONE) {
      const length = macAddressLength(macDestAddrMode);
      if (length === 0 || cursor + length > fcsOffset) truncated = true;
      else {
        fields.push({ id: 'mac-dest-addr', name: 'Destination Address', offset: cursor, length, rawBytes: data.slice(cursor, cursor + length), rawValue: formatMacAddress(macDestAddrMode, data.slice(cursor, cursor + length)), valid: true, warnings: [] });
        cursor += length;
      }
    }
    if (!truncated && addressingPlan.srcPanPresent) {
      if (cursor + MAC_PAN_ID_LENGTH > fcsOffset) truncated = true;
      else {
        fields.push({ id: 'mac-src-pan', name: 'Source PAN ID', offset: cursor, length: MAC_PAN_ID_LENGTH, rawBytes: data.slice(cursor, cursor + MAC_PAN_ID_LENGTH), rawValue: toHex(readUint16Le(data, cursor), 2), valid: true, warnings: [] });
        cursor += MAC_PAN_ID_LENGTH;
      }
    }
    if (!truncated && macSrcAddrMode !== MAC_ADDR_MODE_NONE) {
      const length = macAddressLength(macSrcAddrMode);
      if (length === 0 || cursor + length > fcsOffset) truncated = true;
      else {
        fields.push({ id: 'mac-src-addr', name: 'Source Address', offset: cursor, length, rawBytes: data.slice(cursor, cursor + length), rawValue: formatMacAddress(macSrcAddrMode, data.slice(cursor, cursor + length)), valid: true, warnings: [] });
        cursor += length;
      }
    }
    if (truncated) {
      errors.push({ code: 'truncated-frame', message: ERROR_MAC_ADDRESSING_TRUNCATED, offset: cursor, length: fcsOffset - cursor });
    }
    macPayloadStart = cursor;
  }

  if (macPayloadStart <= macPayloadEnd) {
    const payload = data.slice(macPayloadStart, macPayloadEnd);
    if (macFrameType === MAC_FRAME_TYPE_DATA && addressingPlan.supported) {
      nwkPayload = payload;
    } else if (payload.length > 0) {
      fields.push({ id: 'mac-payload', name: 'MAC Payload', offset: macPayloadStart, length: payload.length, rawBytes: payload, unit: 'B', valid: true, warnings: [WARN_NON_DATA_FRAME] });
      warnings.push(toProtocolWarning(WARN_NON_DATA_FRAME));
    }
  }

  // FCS — bu dalgada GERÇEKTEN doğrulanır (dosya başı, MIC/checksum-dialect kuralının istisnası).
  const fcsBytes = data.slice(fcsOffset, fcsOffset + MAC_FCS_LENGTH);
  const receivedFcs = BigInt(readUint16Le(data, fcsOffset));
  const calculatedFcs = computeNamedCrc(data.slice(0, fcsOffset), 'CRC16_KERMIT');
  const fcsValid = receivedFcs === calculatedFcs;
  const fcsField: ParsedField = {
    id: 'mac-fcs',
    name: 'FCS',
    offset: fcsOffset,
    length: MAC_FCS_LENGTH,
    rawBytes: fcsBytes,
    rawValue: toHex(Number(receivedFcs), 2),
    physicalValue: fcsValid ? 'PASS' : 'FAIL',
    valid: fcsValid,
    warnings: [],
  };
  fields.push(fcsField);
  if (!fcsValid) {
    errors.push({
      code: 'crc-mismatch',
      message: ERROR_FCS_MISMATCH,
      offset: fcsOffset,
      length: MAC_FCS_LENGTH,
      details: { received: receivedFcs.toString(16), calculated: calculatedFcs.toString(16) },
    });
  }

  // ═══════════════════════ Zigbee NWK ═══════════════════════

  if (nwkPayload !== undefined && nwkPayload.length >= NWK_MIN_LENGTH) {
    const nwkOffset = macPayloadStart;
    const nwkFrameType = readBitsAsNumber(data, nwkOffset * 8 + NWK_FRAME_TYPE_BIT_POSITION, NWK_FRAME_TYPE_BIT_LENGTH, 'lsb-first');
    const nwkFrameTypeField: ParsedField = {
      id: 'nwk-frame-type',
      name: 'NWK Frame Type',
      offset: nwkOffset,
      length: NWK_FRAME_TYPE_BIT_LENGTH,
      rawBytes: data.slice(nwkOffset, nwkOffset + 1),
      rawValue: nwkFrameType,
      valid: NWK_FRAME_TYPE_NAMES.has(nwkFrameType),
      warnings: [],
    };
    const nwkFrameTypeName = NWK_FRAME_TYPE_NAMES.get(nwkFrameType);
    if (nwkFrameTypeName !== undefined) nwkFrameTypeField.physicalValue = nwkFrameTypeName;
    fields.push(nwkFrameTypeField);

    const nwkProtocolVersion = readBitsAsNumber(data, nwkOffset * 8 + NWK_PROTOCOL_VERSION_BIT_POSITION, NWK_PROTOCOL_VERSION_BIT_LENGTH, 'lsb-first');
    fields.push({ id: 'nwk-protocol-version', name: 'Protocol Version', offset: nwkOffset, length: NWK_PROTOCOL_VERSION_BIT_LENGTH, rawBytes: data.slice(nwkOffset, nwkOffset + 1), rawValue: nwkProtocolVersion, valid: true, warnings: [] });

    const nwkDiscoverRoute = readBitsAsNumber(data, nwkOffset * 8 + NWK_DISCOVER_ROUTE_BIT_POSITION, NWK_DISCOVER_ROUTE_BIT_LENGTH, 'lsb-first');
    fields.push({ id: 'nwk-discover-route', name: 'Discover Route', offset: nwkOffset, length: NWK_DISCOVER_ROUTE_BIT_LENGTH, rawBytes: data.slice(nwkOffset, nwkOffset + 1), rawValue: nwkDiscoverRoute, valid: true, warnings: [] });

    const nwkMulticast = readBitsAsNumber(data, nwkOffset * 8 + NWK_MULTICAST_BIT_POSITION, 1, 'lsb-first');
    fields.push({ id: 'nwk-multicast', name: 'Multicast Flag', offset: nwkOffset + 1, length: 1, rawBytes: data.slice(nwkOffset + 1, nwkOffset + 2), rawValue: nwkMulticast, valid: true, warnings: [] });

    const nwkSecurity = readBitsAsNumber(data, nwkOffset * 8 + NWK_SECURITY_BIT_POSITION, 1, 'lsb-first');
    fields.push({ id: 'nwk-security', name: 'Security', offset: nwkOffset + 1, length: 1, rawBytes: data.slice(nwkOffset + 1, nwkOffset + 2), rawValue: nwkSecurity, valid: true, warnings: [] });

    const nwkSourceRoute = readBitsAsNumber(data, nwkOffset * 8 + NWK_SOURCE_ROUTE_BIT_POSITION, 1, 'lsb-first');
    const nwkExtDest = readBitsAsNumber(data, nwkOffset * 8 + NWK_EXT_DEST_BIT_POSITION, 1, 'lsb-first');
    const nwkExtSource = readBitsAsNumber(data, nwkOffset * 8 + NWK_EXT_SOURCE_BIT_POSITION, 1, 'lsb-first');
    fields.push({ id: 'nwk-source-route', name: 'Source Route', offset: nwkOffset + 1, length: 1, rawBytes: data.slice(nwkOffset + 1, nwkOffset + 2), rawValue: nwkSourceRoute, valid: true, warnings: [] });
    fields.push({ id: 'nwk-ext-dest', name: 'Destination IEEE Address present', offset: nwkOffset + 1, length: 1, rawBytes: data.slice(nwkOffset + 1, nwkOffset + 2), rawValue: nwkExtDest, valid: true, warnings: [] });
    fields.push({ id: 'nwk-ext-source', name: 'Source IEEE Address present', offset: nwkOffset + 1, length: 1, rawBytes: data.slice(nwkOffset + 1, nwkOffset + 2), rawValue: nwkExtSource, valid: true, warnings: [] });

    let nwkCursor = nwkOffset + NWK_FCF_LENGTH;
    const nwkEnd = nwkOffset + nwkPayload.length;

    const nwkDest = readUint16Le(data, nwkCursor);
    fields.push({ id: 'nwk-dest', name: 'Destination Address', offset: nwkCursor, length: NWK_ADDR_LENGTH, rawBytes: data.slice(nwkCursor, nwkCursor + NWK_ADDR_LENGTH), rawValue: toHex(nwkDest, 2), valid: true, warnings: [] });
    nwkCursor += NWK_ADDR_LENGTH;

    const nwkSrc = readUint16Le(data, nwkCursor);
    fields.push({ id: 'nwk-src', name: 'Source Address', offset: nwkCursor, length: NWK_ADDR_LENGTH, rawBytes: data.slice(nwkCursor, nwkCursor + NWK_ADDR_LENGTH), rawValue: toHex(nwkSrc, 2), valid: true, warnings: [] });
    nwkCursor += NWK_ADDR_LENGTH;

    fields.push({ id: 'nwk-radius', name: 'Radius', offset: nwkCursor, length: NWK_RADIUS_LENGTH, rawBytes: data.slice(nwkCursor, nwkCursor + NWK_RADIUS_LENGTH), rawValue: byteAt(data, nwkCursor), valid: true, warnings: [] });
    nwkCursor += NWK_RADIUS_LENGTH;

    fields.push({ id: 'nwk-seq', name: 'Sequence Number', offset: nwkCursor, length: NWK_SEQ_LENGTH, rawBytes: data.slice(nwkCursor, nwkCursor + NWK_SEQ_LENGTH), rawValue: byteAt(data, nwkCursor), valid: true, warnings: [] });
    nwkCursor += NWK_SEQ_LENGTH;

    let nwkTruncated = false;
    if (nwkExtDest === 1) {
      if (nwkCursor + NWK_EXT_ADDR_LENGTH > nwkEnd) nwkTruncated = true;
      else {
        fields.push({ id: 'nwk-dest-ieee', name: 'Destination IEEE Address', offset: nwkCursor, length: NWK_EXT_ADDR_LENGTH, rawBytes: data.slice(nwkCursor, nwkCursor + NWK_EXT_ADDR_LENGTH), rawValue: formatEui64(data.slice(nwkCursor, nwkCursor + NWK_EXT_ADDR_LENGTH)), valid: true, warnings: [] });
        nwkCursor += NWK_EXT_ADDR_LENGTH;
      }
    }
    if (!nwkTruncated && nwkExtSource === 1) {
      if (nwkCursor + NWK_EXT_ADDR_LENGTH > nwkEnd) nwkTruncated = true;
      else {
        fields.push({ id: 'nwk-src-ieee', name: 'Source IEEE Address', offset: nwkCursor, length: NWK_EXT_ADDR_LENGTH, rawBytes: data.slice(nwkCursor, nwkCursor + NWK_EXT_ADDR_LENGTH), rawValue: formatEui64(data.slice(nwkCursor, nwkCursor + NWK_EXT_ADDR_LENGTH)), valid: true, warnings: [] });
        nwkCursor += NWK_EXT_ADDR_LENGTH;
      }
    }

    if (nwkTruncated) {
      errors.push({ code: 'truncated-frame', message: ERROR_NWK_TRUNCATED, offset: nwkCursor, length: nwkEnd - nwkCursor });
    } else {
      const nwkRest = data.slice(nwkCursor, nwkEnd);
      let apsPayload: Uint8Array | undefined;
      const apsOffset = nwkCursor;

      if (nwkMulticast === 1 || nwkSourceRoute === 1) {
        // Multicast Control / Source Route subframe dar kapsam dışı (dosya başı).
        if (nwkRest.length > 0) {
          fields.push({ id: 'nwk-payload', name: 'NWK Payload', offset: nwkCursor, length: nwkRest.length, rawBytes: nwkRest, unit: 'B', valid: true, warnings: [WARN_NWK_ADVANCED_ADDRESSING] });
          warnings.push(toProtocolWarning(WARN_NWK_ADVANCED_ADDRESSING));
        }
      } else if (nwkSecurity === 1) {
        if (nwkRest.length > 0) {
          fields.push({ id: 'nwk-payload', name: 'NWK Payload (encrypted)', offset: nwkCursor, length: nwkRest.length, rawBytes: nwkRest, unit: 'B', valid: true, warnings: [WARN_NWK_ENCRYPTED] });
          warnings.push(toProtocolWarning(WARN_NWK_ENCRYPTED));
        }
      } else if (nwkFrameType !== NWK_FRAME_TYPE_DATA) {
        if (nwkRest.length > 0) {
          fields.push({ id: 'nwk-payload', name: 'NWK Payload', offset: nwkCursor, length: nwkRest.length, rawBytes: nwkRest, unit: 'B', valid: true, warnings: [WARN_NWK_NON_DATA] });
          warnings.push(toProtocolWarning(WARN_NWK_NON_DATA));
        }
      } else {
        apsPayload = nwkRest;
      }

      // ═══════════════════════ Zigbee APS ═══════════════════════

      if (apsPayload !== undefined && apsPayload.length >= APS_MIN_LENGTH) {
        const apsFrameType = readBitsAsNumber(data, apsOffset * 8 + APS_FRAME_TYPE_BIT_POSITION, APS_FRAME_TYPE_BIT_LENGTH, 'lsb-first');
        const apsFrameTypeField: ParsedField = {
          id: 'aps-frame-type',
          name: 'APS Frame Type',
          offset: apsOffset,
          length: APS_FRAME_TYPE_BIT_LENGTH,
          rawBytes: data.slice(apsOffset, apsOffset + 1),
          rawValue: apsFrameType,
          valid: APS_FRAME_TYPE_NAMES.has(apsFrameType),
          warnings: [],
        };
        const apsFrameTypeName = APS_FRAME_TYPE_NAMES.get(apsFrameType);
        if (apsFrameTypeName !== undefined) apsFrameTypeField.physicalValue = apsFrameTypeName;
        fields.push(apsFrameTypeField);

        const apsDeliveryMode = readBitsAsNumber(data, apsOffset * 8 + APS_DELIVERY_MODE_BIT_POSITION, APS_DELIVERY_MODE_BIT_LENGTH, 'lsb-first');
        fields.push({ id: 'aps-delivery-mode', name: 'Delivery Mode', offset: apsOffset, length: APS_DELIVERY_MODE_BIT_LENGTH, rawBytes: data.slice(apsOffset, apsOffset + 1), rawValue: apsDeliveryMode, physicalValue: APS_DELIVERY_MODE_NAMES.get(apsDeliveryMode), valid: true, warnings: [] });

        const apsAckFormat = readBitsAsNumber(data, apsOffset * 8 + APS_ACK_FORMAT_BIT_POSITION, 1, 'lsb-first');
        fields.push({ id: 'aps-ack-format', name: 'Ack Format', offset: apsOffset, length: 1, rawBytes: data.slice(apsOffset, apsOffset + 1), rawValue: apsAckFormat, valid: true, warnings: [] });

        const apsSecurity = readBitsAsNumber(data, apsOffset * 8 + APS_SECURITY_BIT_POSITION, 1, 'lsb-first');
        fields.push({ id: 'aps-security', name: 'Security', offset: apsOffset, length: 1, rawBytes: data.slice(apsOffset, apsOffset + 1), rawValue: apsSecurity, valid: true, warnings: [] });

        const apsAckRequest = readBitsAsNumber(data, apsOffset * 8 + APS_ACK_REQUEST_BIT_POSITION, 1, 'lsb-first');
        fields.push({ id: 'aps-ack-request', name: 'Ack Request', offset: apsOffset, length: 1, rawBytes: data.slice(apsOffset, apsOffset + 1), rawValue: apsAckRequest, valid: true, warnings: [] });

        const apsExtendedHeader = readBitsAsNumber(data, apsOffset * 8 + APS_EXTENDED_HEADER_BIT_POSITION, 1, 'lsb-first');
        fields.push({ id: 'aps-extended-header', name: 'Extended Header Present', offset: apsOffset, length: 1, rawBytes: data.slice(apsOffset, apsOffset + 1), rawValue: apsExtendedHeader, valid: true, warnings: [] });

        let apsCursor = apsOffset + APS_FCF_LENGTH;
        const apsEnd = apsOffset + apsPayload.length;
        const apsRest = data.slice(apsCursor, apsEnd);
        let zclPayload: Uint8Array | undefined;
        let clusterId: number | undefined;

        if (apsFrameType !== APS_FRAME_TYPE_DATA) {
          if (apsRest.length > 0) {
            fields.push({ id: 'aps-payload', name: 'APS Payload', offset: apsCursor, length: apsRest.length, rawBytes: apsRest, unit: 'B', valid: true, warnings: [WARN_APS_NON_DATA] });
            warnings.push(toProtocolWarning(WARN_APS_NON_DATA));
          }
        } else if (apsDeliveryMode === APS_DELIVERY_MODE_GROUP || apsExtendedHeader === 1) {
          if (apsRest.length > 0) {
            fields.push({ id: 'aps-payload', name: 'APS Payload', offset: apsCursor, length: apsRest.length, rawBytes: apsRest, unit: 'B', valid: true, warnings: [WARN_APS_OUT_OF_SCOPE] });
            warnings.push(toProtocolWarning(WARN_APS_OUT_OF_SCOPE));
          }
        } else {
          const apsHeaderMinLength = APS_ENDPOINT_LENGTH + APS_CLUSTER_ID_LENGTH + APS_PROFILE_ID_LENGTH + APS_ENDPOINT_LENGTH + APS_COUNTER_LENGTH;
          if (apsEnd - apsCursor < apsHeaderMinLength) {
            errors.push({ code: 'truncated-frame', message: ERROR_APS_TRUNCATED, offset: apsCursor, length: apsEnd - apsCursor });
          } else {
            fields.push({ id: 'aps-dest-endpoint', name: 'Destination Endpoint', offset: apsCursor, length: APS_ENDPOINT_LENGTH, rawBytes: data.slice(apsCursor, apsCursor + APS_ENDPOINT_LENGTH), rawValue: byteAt(data, apsCursor), valid: true, warnings: [] });
            apsCursor += APS_ENDPOINT_LENGTH;

            clusterId = readUint16Le(data, apsCursor);
            fields.push({ id: 'aps-cluster-id', name: 'Cluster ID', offset: apsCursor, length: APS_CLUSTER_ID_LENGTH, rawBytes: data.slice(apsCursor, apsCursor + APS_CLUSTER_ID_LENGTH), rawValue: toHex(clusterId, 2), physicalValue: ZCL_CLUSTERS.get(clusterId)?.name, valid: true, warnings: [] });
            apsCursor += APS_CLUSTER_ID_LENGTH;

            const profileId = readUint16Le(data, apsCursor);
            fields.push({ id: 'aps-profile-id', name: 'Profile ID', offset: apsCursor, length: APS_PROFILE_ID_LENGTH, rawBytes: data.slice(apsCursor, apsCursor + APS_PROFILE_ID_LENGTH), rawValue: toHex(profileId, 2), valid: true, warnings: [] });
            apsCursor += APS_PROFILE_ID_LENGTH;

            fields.push({ id: 'aps-src-endpoint', name: 'Source Endpoint', offset: apsCursor, length: APS_ENDPOINT_LENGTH, rawBytes: data.slice(apsCursor, apsCursor + APS_ENDPOINT_LENGTH), rawValue: byteAt(data, apsCursor), valid: true, warnings: [] });
            apsCursor += APS_ENDPOINT_LENGTH;

            fields.push({ id: 'aps-counter', name: 'APS Counter', offset: apsCursor, length: APS_COUNTER_LENGTH, rawBytes: data.slice(apsCursor, apsCursor + APS_COUNTER_LENGTH), rawValue: byteAt(data, apsCursor), valid: true, warnings: [] });
            apsCursor += APS_COUNTER_LENGTH;

            if (apsSecurity === 1) {
              const encrypted = data.slice(apsCursor, apsEnd);
              if (encrypted.length > 0) {
                fields.push({ id: 'aps-payload', name: 'APS Payload (encrypted)', offset: apsCursor, length: encrypted.length, rawBytes: encrypted, unit: 'B', valid: true, warnings: [WARN_APS_ENCRYPTED] });
                warnings.push(toProtocolWarning(WARN_APS_ENCRYPTED));
              }
            } else {
              zclPayload = data.slice(apsCursor, apsEnd);
            }
          }
        }

        // ═══════════════════════ ZCL (dar) ═══════════════════════

        if (zclPayload !== undefined && zclPayload.length >= ZCL_MIN_LENGTH) {
          const zclOffset = apsCursor;
          const zclFrameType = readBitsAsNumber(data, zclOffset * 8 + ZCL_FRAME_TYPE_BIT_POSITION, ZCL_FRAME_TYPE_BIT_LENGTH, 'lsb-first');
          fields.push({ id: 'zcl-frame-type', name: 'ZCL Frame Type', offset: zclOffset, length: ZCL_FRAME_TYPE_BIT_LENGTH, rawBytes: data.slice(zclOffset, zclOffset + 1), rawValue: zclFrameType, physicalValue: ZCL_FRAME_TYPE_NAMES.get(zclFrameType), valid: true, warnings: [] });

          const zclMfrSpecific = readBitsAsNumber(data, zclOffset * 8 + ZCL_MFR_SPECIFIC_BIT_POSITION, 1, 'lsb-first');
          fields.push({ id: 'zcl-mfr-specific', name: 'Manufacturer Specific', offset: zclOffset, length: 1, rawBytes: data.slice(zclOffset, zclOffset + 1), rawValue: zclMfrSpecific, valid: true, warnings: [] });

          const zclDirection = readBitsAsNumber(data, zclOffset * 8 + ZCL_DIRECTION_BIT_POSITION, 1, 'lsb-first');
          fields.push({ id: 'zcl-direction', name: 'Direction', offset: zclOffset, length: 1, rawBytes: data.slice(zclOffset, zclOffset + 1), rawValue: zclDirection, physicalValue: zclDirection === 1 ? 'Server to Client' : 'Client to Server', valid: true, warnings: [] });

          const zclDisableDefaultResponse = readBitsAsNumber(data, zclOffset * 8 + ZCL_DISABLE_DEFAULT_RESPONSE_BIT_POSITION, 1, 'lsb-first');
          fields.push({ id: 'zcl-disable-default-response', name: 'Disable Default Response', offset: zclOffset, length: 1, rawBytes: data.slice(zclOffset, zclOffset + 1), rawValue: zclDisableDefaultResponse, valid: true, warnings: [] });

          let zclCursor = zclOffset + ZCL_FCF_LENGTH;
          const zclEnd = zclOffset + zclPayload.length;

          if (zclMfrSpecific === 1) {
            if (zclCursor + ZCL_MFR_CODE_LENGTH <= zclEnd) {
              fields.push({ id: 'zcl-mfr-code', name: 'Manufacturer Code', offset: zclCursor, length: ZCL_MFR_CODE_LENGTH, rawBytes: data.slice(zclCursor, zclCursor + ZCL_MFR_CODE_LENGTH), rawValue: toHex(readUint16Le(data, zclCursor), 2), valid: true, warnings: [] });
              zclCursor += ZCL_MFR_CODE_LENGTH;
            }
          }

          if (zclCursor + ZCL_TSN_LENGTH + ZCL_CMD_ID_LENGTH <= zclEnd) {
            fields.push({ id: 'zcl-tsn', name: 'Transaction Sequence Number', offset: zclCursor, length: ZCL_TSN_LENGTH, rawBytes: data.slice(zclCursor, zclCursor + ZCL_TSN_LENGTH), rawValue: byteAt(data, zclCursor), valid: true, warnings: [] });
            zclCursor += ZCL_TSN_LENGTH;

            const commandId = byteAt(data, zclCursor);
            const commandName = zclFrameType === ZCL_FRAME_TYPE_GLOBAL ? ZCL_GLOBAL_COMMAND_NAMES.get(commandId) : undefined;
            fields.push({ id: 'zcl-command-id', name: 'Command ID', offset: zclCursor, length: ZCL_CMD_ID_LENGTH, rawBytes: data.slice(zclCursor, zclCursor + ZCL_CMD_ID_LENGTH), rawValue: commandId, physicalValue: commandName, valid: true, warnings: [] });
            zclCursor += ZCL_CMD_ID_LENGTH;

            const zclPayloadRest = data.slice(zclCursor, zclEnd);

            if (zclFrameType === ZCL_FRAME_TYPE_CLUSTER_SPECIFIC) {
              if (zclPayloadRest.length > 0) {
                // Gövde hâlâ çözülmez (dosya başı) — yalnız etiket, bilinen cluster'da, adını taşır.
                const clusterName = clusterId === undefined ? undefined : ZCL_CLUSTERS.get(clusterId)?.name;
                fields.push({
                  id: 'zcl-payload',
                  name: clusterName === undefined ? 'ZCL Payload (cluster-specific)' : `ZCL Payload (cluster-specific, ${clusterName})`,
                  offset: zclCursor,
                  length: zclPayloadRest.length,
                  rawBytes: zclPayloadRest,
                  unit: 'B',
                  valid: true,
                  warnings: [WARN_ZCL_CLUSTER_SPECIFIC_NOT_DECODED],
                });
                warnings.push(toProtocolWarning(WARN_ZCL_CLUSTER_SPECIFIC_NOT_DECODED));
              }
            } else if (commandId === ZCL_CMD_DEFAULT_RESP) {
              if (zclPayloadRest.length >= 2) {
                fields.push({ id: 'zcl-response-to-command', name: 'Response to Command ID', offset: zclCursor, length: 1, rawBytes: data.slice(zclCursor, zclCursor + 1), rawValue: byteAt(data, zclCursor), valid: true, warnings: [] });
                fields.push({ id: 'zcl-status', name: 'Status', offset: zclCursor + 1, length: 1, rawBytes: data.slice(zclCursor + 1, zclCursor + 2), rawValue: byteAt(data, zclCursor + 1), physicalValue: byteAt(data, zclCursor + 1) === ZCL_STATUS_SUCCESS ? 'SUCCESS' : undefined, valid: true, warnings: [] });
              }
            } else if (commandId === ZCL_CMD_READ_ATTR_RESP || commandId === ZCL_CMD_REPORT_ATTR) {
              // Attribute isimleri CLUSTER'A GÖRE değişir (dosya başı) — kütüphane bir kez, cluster'a göre alınır.
              const clusterAttributes = clusterId === undefined ? undefined : ZCL_CLUSTERS.get(clusterId)?.attributes;
              let recordCursor = zclCursor;
              let recordIndex = 0;
              while (recordCursor < zclEnd) {
                const attrId = readUint16Le(data, recordCursor);
                const attrName = clusterAttributes?.get(attrId)?.name;
                const attrLabel = attrName === undefined ? toHex(attrId, 2) : `${attrName} (${toHex(attrId, 2)})`;
                let status: number | undefined;
                let valueOffset = recordCursor + 2;
                if (commandId === ZCL_CMD_READ_ATTR_RESP) {
                  if (valueOffset >= zclEnd) break;
                  status = byteAt(data, valueOffset);
                  valueOffset += 1;
                }
                let recordLength = valueOffset - recordCursor;
                let physicalValue: string | undefined;
                if (status === undefined || status === ZCL_STATUS_SUCCESS) {
                  if (valueOffset >= zclEnd) break;
                  const dataType = byteAt(data, valueOffset);
                  const typeInfo = ZCL_DATA_TYPES.get(dataType);
                  if (typeInfo === undefined) {
                    fields.push({ id: `zcl-attr-${String(recordIndex)}`, name: `Attribute ${attrLabel}`, offset: recordCursor, length: valueOffset + 1 - recordCursor, rawBytes: data.slice(recordCursor, valueOffset + 1), rawValue: toHex(attrId, 2), valid: true, warnings: [WARN_ZCL_UNKNOWN_DATA_TYPE] });
                    warnings.push(toProtocolWarning(WARN_ZCL_UNKNOWN_DATA_TYPE));
                    const trailing = data.slice(valueOffset + 1, zclEnd);
                    if (trailing.length > 0) {
                      fields.push({ id: 'zcl-payload', name: 'ZCL Payload (remaining, unknown data type)', offset: valueOffset + 1, length: trailing.length, rawBytes: trailing, unit: 'B', valid: true, warnings: [WARN_ZCL_UNKNOWN_DATA_TYPE] });
                    }
                    break;
                  }
                  const decoded = decodeZclValue(typeInfo.kind, typeInfo.fixedLength, data, valueOffset + 1);
                  if (decoded === undefined) break;
                  recordLength = valueOffset + 1 + decoded.length - recordCursor;
                  physicalValue = `${typeInfo.name} = ${decoded.physicalValue}`;
                } else {
                  physicalValue = `Status ${toHex(status, 1)}`;
                }
                recordIndex += 1;
                fields.push({
                  id: `zcl-attr-${String(recordIndex)}`,
                  name: `Attribute ${attrLabel}`,
                  offset: recordCursor,
                  length: recordLength,
                  rawBytes: data.slice(recordCursor, recordCursor + recordLength),
                  rawValue: toHex(attrId, 2),
                  physicalValue,
                  valid: true,
                  warnings: [],
                });
                recordCursor += recordLength;
              }
            } else if (zclPayloadRest.length > 0) {
              fields.push({ id: 'zcl-payload', name: 'ZCL Payload', offset: zclCursor, length: zclPayloadRest.length, rawBytes: zclPayloadRest, unit: 'B', valid: true, warnings: [WARN_ZCL_GLOBAL_COMMAND_NOT_DECODED] });
              warnings.push(toProtocolWarning(WARN_ZCL_GLOBAL_COMMAND_NOT_DECODED));
            }
          }
        }
      }
    }
  }

  const rawFrame = createRawFrame(data, {
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.channel === undefined ? {} : { channel: options.channel }),
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

export function parseZigbee(data: Uint8Array): ParseResult {
  return parseZigbeeFrame(data, {});
}

function readContextOptions(context: ParseContext | undefined): ZigbeeParseOptions {
  const options: ZigbeeParseOptions = {};
  if (context?.timestamp !== undefined) options.timestamp = context.timestamp;
  if (context?.direction !== undefined) options.direction = context.direction;
  if (context?.channel !== undefined) options.channel = context.channel;
  if (context?.maxFrameLength !== undefined) options.maxFrameLength = context.maxFrameLength;
  if (context?.signal !== undefined) options.signal = context.signal;
  return options;
}

export const zigbeeParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: yeterli uzunluk + Frame Type dar kümede. */
  canParse(data: Uint8Array): boolean {
    if (data.length < MAC_MIN_LENGTH) return false;
    const frameType = readBitsAsNumber(data, MAC_FRAME_TYPE_BIT_POSITION, MAC_FRAME_TYPE_BIT_LENGTH, 'lsb-first');
    return MAC_FRAME_TYPE_NAMES.has(frameType);
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseZigbeeFrame(data, readContextOptions(context));
  },
};

// ───────────────────────── Örnek çerçeveler ─────────────────────────

function fcsFor(bytesWithoutFcs: readonly number[]): number[] {
  const fcs = computeNamedCrc(Uint8Array.from(bytesWithoutFcs), 'CRC16_KERMIT');
  return [Number(fcs & 0xffn), Number((fcs >> 8n) & 0xffn)];
}

function macHeader(options: {
  frameType?: number;
  destAddrMode?: number;
  srcAddrMode?: number;
  panIdCompression?: number;
  frameVersion?: number;
  seq?: number;
}): number[] {
  const frameType = options.frameType ?? MAC_FRAME_TYPE_DATA;
  const destAddrMode = options.destAddrMode ?? MAC_ADDR_MODE_SHORT;
  const srcAddrMode = options.srcAddrMode ?? MAC_ADDR_MODE_SHORT;
  const panIdCompression = options.panIdCompression ?? 1;
  const frameVersion = options.frameVersion ?? MAC_FRAME_VERSION_2006;
  const seq = options.seq ?? 1;
  const byte0 = (frameType & 0x07) | (panIdCompression === 1 ? 0x40 : 0);
  const byte1 = ((destAddrMode & 0x03) << 2) | ((frameVersion & 0x03) << 4) | ((srcAddrMode & 0x03) << 6);
  const bytes = [byte0, byte1, seq];
  const plan = planMacAddressing(destAddrMode, srcAddrMode, panIdCompression, frameVersion);
  if (plan.destPanPresent) bytes.push(0x34, 0x12); // PAN 0x1234 (LE)
  if (destAddrMode === MAC_ADDR_MODE_SHORT) bytes.push(0x00, 0x00); // coordinator 0x0000
  if (plan.srcPanPresent) bytes.push(0x34, 0x12);
  if (srcAddrMode === MAC_ADDR_MODE_SHORT) bytes.push(0x78, 0x56); // 0x5678
  return bytes;
}

function zigbeeFrame(macPayload: readonly number[], macOptions: Parameters<typeof macHeader>[0] = {}): Uint8Array {
  const header = macHeader(macOptions);
  const withoutFcs = [...header, ...macPayload];
  return Uint8Array.from([...withoutFcs, ...fcsFor(withoutFcs)]);
}

function nwkHeader(options: { frameType?: number; security?: number } = {}): number[] {
  const frameType = options.frameType ?? NWK_FRAME_TYPE_DATA;
  const security = options.security ?? 0;
  const byte0 = frameType & 0x03; // protocol version 0, discover route 0
  const byte1 = security === 1 ? 0x02 : 0x00; // multicast=0, security bit
  return [byte0, byte1, 0x00, 0x00, 0x78, 0x56, 0x0a, 0x34];
  // Dest=0x0000, Src=0x5678, Radius=10, Sequence=0x34
}

function apsHeader(options: { destEndpoint?: number; clusterId?: number; profileId?: number; srcEndpoint?: number; counter?: number } = {}): number[] {
  const destEndpoint = options.destEndpoint ?? 1;
  const clusterId = options.clusterId ?? 0x0402; // Temperature Measurement
  const profileId = options.profileId ?? 0x0104; // Home Automation
  const srcEndpoint = options.srcEndpoint ?? 1;
  const counter = options.counter ?? 0x11;
  return [
    APS_FRAME_TYPE_DATA, // FCF: type=Data, delivery=Unicast, security=0, ext header=0
    destEndpoint,
    clusterId & 0xff, (clusterId >> 8) & 0xff,
    profileId & 0xff, (profileId >> 8) & 0xff,
    srcEndpoint,
    counter,
  ];
}

function zclReadAttrRespInt16(attrId: number, value: number, tsn = 1): number[] {
  const unsigned = value < 0 ? value + 0x10000 : value;
  return [
    0x08, // FCF: Global, direction=server→client
    tsn,
    ZCL_CMD_READ_ATTR_RESP,
    attrId & 0xff, (attrId >> 8) & 0xff,
    ZCL_STATUS_SUCCESS,
    0x29, // Int16
    unsigned & 0xff, (unsigned >> 8) & 0xff,
  ];
}

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'temperature-report',
    name: 'protocol.zigbee.example.temperatureReport.name',
    // MAC→NWK→APS(Temperature Measurement)→ZCL Report Attributes, MeasuredValue=2345 (23.45°C, spec 32931-32957 örneğinin katman zinciriyle sarmalanmışı).
    bytes: zigbeeFrame([
      ...nwkHeader(),
      ...apsHeader(),
      0x18, 1, ZCL_CMD_REPORT_ATTR, 0x00, 0x00, 0x29, 0x29, 0x09, // AttrID 0x0000, Int16, raw 29 09 → 2345
    ]),
    description: 'protocol.zigbee.example.temperatureReport.description',
    expectedValid: true,
  },
  {
    id: 'read-attr-response',
    name: 'protocol.zigbee.example.readAttrResponse.name',
    bytes: zigbeeFrame([...nwkHeader(), ...apsHeader(), ...zclReadAttrRespInt16(0x0000, 2345)]),
    description: 'protocol.zigbee.example.readAttrResponse.description',
    expectedValid: true,
  },
  {
    id: 'default-response',
    name: 'protocol.zigbee.example.defaultResponse.name',
    bytes: zigbeeFrame([...nwkHeader(), ...apsHeader(), 0x18, 2, ZCL_CMD_DEFAULT_RESP, ZCL_CMD_REPORT_ATTR, ZCL_STATUS_SUCCESS]),
    description: 'protocol.zigbee.example.defaultResponse.description',
    expectedValid: true,
  },
  {
    id: 'nwk-encrypted',
    name: 'protocol.zigbee.example.nwkEncrypted.name',
    // NWK Security=1 — payload "Encrypted NWK payload" (dosya başı, APS/ZCL'e hiç geçilmez).
    bytes: zigbeeFrame([...nwkHeader({ security: 1 }), 0xaa, 0xbb, 0xcc, 0xdd]),
    description: 'protocol.zigbee.example.nwkEncrypted.description',
    expectedValid: true,
  },
  {
    id: 'cluster-specific-command',
    name: 'protocol.zigbee.example.clusterSpecificCommand.name',
    // ZCL Frame Type=Cluster-specific — gövde dar kapsam dışı, ham+uyarı.
    bytes: zigbeeFrame([...nwkHeader(), ...apsHeader(), 0x01, 3, 0x00, 0xaa, 0xbb]),
    description: 'protocol.zigbee.example.clusterSpecificCommand.description',
    expectedValid: true,
  },
  {
    id: 'mac-command-frame',
    name: 'protocol.zigbee.example.macCommandFrame.name',
    // MAC Frame Type=MAC Command — NWK'ya hiç geçilmez, ham+uyarı.
    bytes: zigbeeFrame([0x04], { frameType: 0b011 }),
    description: 'protocol.zigbee.example.macCommandFrame.description',
    expectedValid: true,
  },
  {
    id: 'fcs-mismatch',
    name: 'protocol.zigbee.example.fcsMismatch.name',
    bytes: (() => {
      const frame = zigbeeFrame([...nwkHeader(), ...apsHeader(), ...zclReadAttrRespInt16(0x0000, 100)]);
      const corrupted = frame.slice();
      corrupted[corrupted.length - 1] = (corrupted[corrupted.length - 1] as number) ^ 0xff;
      return corrupted;
    })(),
    description: 'protocol.zigbee.example.fcsMismatch.description',
    expectedValid: false,
  },
  {
    id: 'truncated-mac-addressing',
    name: 'protocol.zigbee.example.truncatedMacAddressing.name',
    // Header 2 bayt (FCF) + Seq, ama adresleme alanları hiç yok — kısa çerçeve, truncated-frame.
    bytes: (() => {
      const withoutFcs = [0x41, 0x88, 0x01]; // FCF: Data, dest short, src short, pan-compress=1 ama adres baytları YOK
      return Uint8Array.from([...withoutFcs, ...fcsFor(withoutFcs)]);
    })(),
    description: 'protocol.zigbee.example.truncatedMacAddressing.description',
    expectedValid: false,
  },
];

export const zigbeePlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'wireless-iot',
  parser: zigbeeParser,
  documentation: {
    summary: 'protocol.zigbee.documentation.summary',
    layer: 'multi-layer',
  },
  exampleFrames: EXAMPLE_FRAMES,
};

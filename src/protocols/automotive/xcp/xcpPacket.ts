/**
 * XCP (ASAM MCD-1 XCP, "Universal Measurement and Calibration Protocol") —
 * taşıyıcıdan bağımsız CTO (Command Transfer Object) paket çekirdeği.
 *
 * Faz 10, dalga 14b (`docs/brief-faz10-dalga14b.md`). `cipCore.ts`nin
 * `decodeCipMessage(data, start, end, fields, ...)` imzasının BİREBİR
 * emsali: bu dosya kendi `ParseResult`unu ÜRETMEZ, `fields` dizisine yazar —
 * taşıyıcı (CAN burada `xcpOnCan.ts`, Ethernet dalga 14c'de) kendi çerçeve/
 * kimlik alanlarını ekleyip bu çekirdeği İÇİNE gömer.
 *
 * ── KAYNAK UYARISI — İKİ BAĞIMSIZ AÇIK KAYNAK, KODDAN DOĞRULANDI ────────────
 * ASAM MCD-1 XCP spec'i (Part 1-5) ÜCRETLİdir ve bu depoda YOK — dalga 5'in
 * "lisanslı standart, satın alınmaz" kararı geçerli. Aşağıdaki komut kodları,
 * hata/olay kodları ve alan yerleşimleri İKİ BAĞIMSIZ açık kaynak XCP
 * implementasyonundan BAYT BAYT çapraz doğrulandı (2026-08-23):
 *
 *   1. Scapy (GPL-2.0, secdev/scapy) — peer-reviewed, geniş kullanımlı ağ
 *      paketi kütüphanesi.
 *      `contrib/automotive/xcp/xcp.py`:
 *      https://github.com/secdev/scapy/blob/master/scapy/contrib/automotive/xcp/xcp.py
 *      `contrib/automotive/xcp/cto_commands_master.py` (CONNECT/SET_MTA istek alanları):
 *      https://github.com/secdev/scapy/blob/master/scapy/contrib/automotive/xcp/cto_commands_master.py
 *      `contrib/automotive/xcp/cto_commands_slave.py` (hata/olay/servis kodları, CONNECT/GET_STATUS yanıt alanları):
 *      https://github.com/secdev/scapy/blob/master/scapy/contrib/automotive/xcp/cto_commands_slave.py
 *
 *   2. pyxcp (LGPL, christoph2/pyxcp) — gerçek ECU kalibrasyon araçlarında
 *      kullanılan bağımsız Python implementasyonu.
 *      `pyxcp/types.py`:
 *      https://github.com/christoph2/pyxcp/blob/master/pyxcp/types.py
 *      `pyxcp/master/master.py` (SET_MTA'nın gönderdiği ham bayt dizisi
 *      `request(SET_MTA, 0, 0, address_ext, *addr)` — Scapy'nin alan
 *      yerleşimiyle BİREBİR örtüşüyor):
 *      https://github.com/christoph2/pyxcp/blob/master/pyxcp/master/master.py
 *
 * İki kaynak da AYNI komut tablosunu (CONNECT 0xFF … WRITE_DAQ_MULTIPLE
 * 0xC7), AYNI 18 hata kodunu (0x00-0x32) ve AYNI dört yanıt sınıfını
 * (RES/OK=0xFF, ERR=0xFE, EV=0xFD, SERV=0xFC) veriyor — çakışma bulunmadı.
 *
 * pyxcp'nin TEK BAŞINA verdiği ve Scapy'de bulunmayan girdiler (spec'in DAHA
 * SONRAKİ bir revizyonuna ait olduğu pyxcp'nin kendi yorumunda AÇIKÇA
 * yazıyor — çelişki değil kapsam farkı): hata kodu
 * `ERR_RESOURCE_TEMPORARY_NOT_ACCESSIBLE=0x33` ("NEW IN 1.1") ve olay
 * kodları `EV_TIME_SYNC=0x08` … `EV_ECU_STATE_CHANGE=0x0C` ("XCP 1.5
 * Specification"). Bunlar dahil edildi ama TEK KAYNAKLI oldukları aşağıda
 * ayrı işaretli. Yalnız Scapy'de geçen `SERV_RESET`/`SERV_TEXT` isimleri
 * (ikinci kaynakta hiç yok) ise ADLANDIRILMADI — `service_request_code` ham
 * bayt olarak kalır.
 *
 * ── ÇEKİRDEĞİN SINIRI ────────────────────────────────────────────────────────
 * Girer: PID/packet_code çözümü, komut adı/yanıt sınıfı tablosu, hata/olay
 * kodu tablosu, CONNECT/SET_MTA/GET_STATUS'un yapısal alan bölünmesi
 * (adres+adres uzantısı gibi — lookup değil bayt genişliği bölmesi, CIP
 * EPATH'in aynı sınıfı, `cipCore.ts` dosya başı).
 * Girmez: CAN kimliği, Ethernet LEN/CTR başlığı, çerçeve uzunluğu denetimi —
 * taşıyıcının işi.
 *
 * ── DÜZELTME 1: `packetInterpretation` YERİNE `role` — ana brifin (14b)
 *    tahmini KAYNAK DOĞRULAMASIYLA ÇÜRÜDÜ ────────────────────────────────────
 * Ana brif tek bir `packetInterpretation: raw|cto|dto` kanalı öngörmüştü.
 * Kaynak taraması İKİ ayrı ve daha kesin gerçek ortaya çıkardı:
 *
 * 1. **CTO/DTO ayrımı ÇERÇEVEDEN ÇIKAR, kanal GEREKMEZ.** Scapy'nin kendi
 *    `bind_layers` aralıkları PID baytının SAYISAL DEĞERİNE göre otomatik
 *    ayrım yapıyor (istek yönünde 0x00-0xBF DTO/STIM, 0xC0-0xFF komut alanı;
 *    yanıt yönünde 0x00-0xFB DTO, yalnız 0xFC-0xFF sınıflandırılmış paket).
 *    Bu dosya AYNI eşiği kullanır — 12g'nin RTP payload-type kararının TERSİ
 *    yönü: orada ayrım GERÇEKTEN çerçeveden çıkmıyordu, burada SAYISAL ARALIK
 *    ayrımın ta kendisi.
 * 2. **Asıl belirsizlik `role` (komut mu yanıt mı) — BU GERÇEKTEN çerçeveden
 *    çıkmaz.** PID 0xFF hem CONNECT (komut) hem RES (yanıt), PID 0xFE hem
 *    DISCONNECT hem ERR'dir — AYNI bayt, taşıyıcı üstünde HANGİ CAN ID'nin
 *    kullanıldığına göre ayrışır (master→slave vs slave→master, A2L/XCP
 *    transport-layer config, kullanıcı sistem bağlamından bilir).
 *    `devicenet.ts`in `payloadInterpretation` kanalıyla AYNI gerekçe sınıfı.
 *
 * ── DÜZELTME 2: `byteOrder` kanalı, brifin önerisinin AKSİNE, açıldı ───────
 * Ana brif "byte order ilk sürümde AÇILMASIN" demişti (A2L'den geldiği
 * varsayımıyla). Kaynak taraması bu gerekçeyi ÇÜRÜTTÜ: byte order A2L'den
 * DEĞİL, CONNECT komutunun YANITINDAN (`comm_mode_basic` bayrağının bit 0'ı)
 * müzakere edilir — Scapy'nin kendi yorumu "0 stands for Intel/little-endian
 * format, 1 for Motorola/big-endian format", pyxcp'nin
 * `ByteOrder = Enum(BitsInteger(1), INTEL=0, MOTOROLA=1)`ı BİREBİR aynı
 * kodluyor. Bu depoda `parse(data)` SAF ve durumsuzdur (`types.ts`: "aynı
 * girdi aynı sonucu verir") — önceki bir CONNECT yanıtını hatırlayamaz.
 * ÜSTELİK bu tek bir alanı değil HER çok baytlı alanı etkiler (max_dto,
 * session_configuration_id, SET_MTA'nın adresi …) — Microwire'ın "aynı dört
 * bayt, profile göre bambaşka bir şey" kararının aynı sınıfı, A2L nüansı
 * değil temel bir okunabilirlik sorunu. Kanal AÇILDI, varsayılan
 * `little-endian` (rastgele bir arayüz başlangıcı — spec'in dayattığı bir
 * varsayılan YOKTUR, CONNECT ile müzakere edilir).
 *
 * ── UYGULANAN KAPSAM ─────────────────────────────────────────────────────────
 * PID tablosunun TAMAMI (0xC7-0xFF, 57 kod) adlandırılır. Yapısal alan
 * bölünmesi yalnız CONNECT/SET_MTA/GET_STATUS için var (spec `04-otomotiv.
 * md:353`ün somut örneği bunlar, DISCONNECT/SYNCH zaten boş — Scapy: "has no
 * data"); ötekilerin (UPLOAD, DOWNLOAD, DAQ/PGM komutları) parametreleri HAM
 * kalır — A2L olmadan zaten anlamlandırılamaz (`xcp-on-can` kaydının
 * `definitions:['a2l']`i panelsiz kalır, aynı gerekçe `dali.ts`/`lin.ts`
 * emsali). Pozitif yanıtın (RES) gövdesi HANGİ komuta karşılık geldiğini
 * bilmeden çözülemez — Scapy'nin KENDİ mimarisi bunu `CTOResponse.
 * answers(request)` ile ÖNCEKİ isteğe bakarak çözüyor; bu depo tek çerçeve
 * aldığı için (durumsuz sözleşme) RES gövdesi de HAM + uyarı kalır. Yalnız
 * ERR'nin error_code baytı bağlamsızdır (kendi başına anlamlı) ve GERÇEKTEN
 * çözülür.
 */

import { bytesToNumber } from '@/protocol-core/buffers/endianness';
import type { ByteOrder } from '@/protocol-core/buffers/endianness';
import type { ParsedField, ProtocolError, ProtocolWarning } from '@/protocol-core/types';

export type XcpRole = 'command' | 'response';
export type XcpResponseClass = 'positive-response' | 'error' | 'event' | 'service';
export type XcpPacketKind = 'command' | 'response-classified' | 'daq-data' | 'unassigned-command';

/**
 * İstek yönünde (`role: 'command'`) 0x00-0xBF STIM/DAQ verisidir (Scapy:
 * `for pid in range(0, 0xBF + 1): bind_layers(CTORequest, DTO, pid=pid)`);
 * yanıt yönünde (`role: 'response'`) 0x00-0xFB DTO'dur (Scapy:
 * `for pid in range(0, 0xFB + 1): bind_layers(CTOResponse, DTO, pid=pid)`).
 * Sınır SAYISAL ARALIKTIR — decodeOptions kanalı GEREKMEZ (bkz. dosya başı,
 * DÜZELTME 1). Yanıt yönündeki 0x00-0xFB sınırı ayrı bir sabit istemiyor:
 * `XCP_RESPONSE_CLASSES`te bulunmayan HER pid zaten bu aralıktır.
 */
const COMMAND_DAQ_STIM_UPPER_BOUND = 0xbf;

/**
 * Komut kodu tablosu — 57 giriş (0xC7-0xFF), Scapy + pyxcp'te BİREBİR
 * örtüşüyor. Scapy'nin kendi bölümleme yorumları (STANDARD/CAL/PAG/DAQ/PGM)
 * korunuyor.
 */
export const XCP_COMMAND_NAMES: ReadonlyMap<number, string> = new Map([
  // Standard commands
  [0xff, 'CONNECT'],
  [0xfe, 'DISCONNECT'],
  [0xfd, 'GET_STATUS'],
  [0xfc, 'SYNCH'],
  [0xfb, 'GET_COMM_MODE_INFO'],
  [0xfa, 'GET_ID'],
  [0xf9, 'SET_REQUEST'],
  [0xf8, 'GET_SEED'],
  [0xf7, 'UNLOCK'],
  [0xf6, 'SET_MTA'],
  [0xf5, 'UPLOAD'],
  [0xf4, 'SHORT_UPLOAD'],
  [0xf3, 'BUILD_CHECKSUM'],
  [0xf2, 'TRANSPORT_LAYER_CMD'],
  [0xf1, 'USER_CMD'],
  // Calibration commands
  [0xf0, 'DOWNLOAD'],
  [0xef, 'DOWNLOAD_NEXT'],
  [0xee, 'DOWNLOAD_MAX'],
  [0xed, 'SHORT_DOWNLOAD'],
  [0xec, 'MODIFY_BITS'],
  // Page switching commands
  [0xeb, 'SET_CAL_PAGE'],
  [0xea, 'GET_CAL_PAGE'],
  [0xe9, 'GET_PAG_PROCESSOR_INFO'],
  [0xe8, 'GET_SEGMENT_INFO'],
  [0xe7, 'GET_PAGE_INFO'],
  [0xe6, 'SET_SEGMENT_MODE'],
  [0xe5, 'GET_SEGMENT_MODE'],
  [0xe4, 'COPY_CAL_PAGE'],
  // Cyclic data exchange — basic + static configuration commands
  [0xe3, 'CLEAR_DAQ_LIST'],
  [0xe2, 'SET_DAQ_PTR'],
  [0xe1, 'WRITE_DAQ'],
  [0xe0, 'SET_DAQ_LIST_MODE'],
  [0xdf, 'GET_DAQ_LIST_MODE'],
  [0xde, 'START_STOP_DAQ_LIST'],
  [0xdd, 'START_STOP_SYNCH'],
  [0xdc, 'GET_DAQ_CLOCK'],
  [0xdb, 'READ_DAQ'],
  [0xda, 'GET_DAQ_PROCESSOR_INFO'],
  [0xd9, 'GET_DAQ_RESOLUTION_INFO'],
  [0xd8, 'GET_DAQ_LIST_INFO'],
  [0xd7, 'GET_DAQ_EVENT_INFO'],
  // Cyclic data transfer — dynamic configuration commands
  [0xd6, 'FREE_DAQ'],
  [0xd5, 'ALLOC_DAQ'],
  [0xd4, 'ALLOC_ODT'],
  [0xd3, 'ALLOC_ODT_ENTRY'],
  // Flash programming commands
  [0xd2, 'PROGRAM_START'],
  [0xd1, 'PROGRAM_CLEAR'],
  [0xd0, 'PROGRAM'],
  [0xcf, 'PROGRAM_RESET'],
  [0xce, 'GET_PGM_PROCESSOR_INFO'],
  [0xcd, 'GET_SECTOR_INFO'],
  [0xcc, 'PROGRAM_PREPARE'],
  [0xcb, 'PROGRAM_FORMAT'],
  [0xca, 'PROGRAM_NEXT'],
  [0xc9, 'PROGRAM_MAX'],
  [0xc8, 'PROGRAM_VERIFY'],
  [0xc7, 'WRITE_DAQ_MULTIPLE'],
]);

/** Komutlar bu üç sınıftan biri: hiç parametresi yok, yapısal olarak çözülür ya da parametreleri ham kalır. */
const COMMANDS_WITHOUT_PAYLOAD: ReadonlySet<number> = new Set([
  0xfe, // DISCONNECT
  0xfd, // GET_STATUS
  0xfc, // SYNCH
  0xfb, // GET_COMM_MODE_INFO
]);

/** Yanıt sınıfı — Scapy `packet_codes` + pyxcp `Response.type` BİREBİR örtüşüyor. */
export const XCP_RESPONSE_CLASSES: ReadonlyMap<number, XcpResponseClass> = new Map([
  [0xff, 'positive-response'],
  [0xfe, 'error'],
  [0xfd, 'event'],
  [0xfc, 'service'],
]);

/** Hata kodu tablosu. 0x00-0x32 Scapy+pyxcp ORTAK; 0x33 YALNIZ pyxcp (spec 1.1 eki, çelişki değil). */
export const XCP_ERROR_NAMES: ReadonlyMap<number, string> = new Map([
  [0x00, 'ERR_CMD_SYNCH'],
  [0x10, 'ERR_CMD_BUSY'],
  [0x11, 'ERR_DAQ_ACTIVE'],
  [0x12, 'ERR_PGM_ACTIVE'],
  [0x20, 'ERR_CMD_UNKNOWN'],
  [0x21, 'ERR_CMD_SYNTAX'],
  [0x22, 'ERR_OUT_OF_RANGE'],
  [0x23, 'ERR_WRITE_PROTECTED'],
  [0x24, 'ERR_ACCESS_DENIED'],
  [0x25, 'ERR_ACCESS_LOCKED'],
  [0x26, 'ERR_PAGE_NOT_VALID'],
  [0x27, 'ERR_MODE_NOT_VALID'],
  [0x28, 'ERR_SEGMENT_NOT_VALID'],
  [0x29, 'ERR_SEQUENCE'],
  [0x2a, 'ERR_DAQ_CONFIG'],
  [0x30, 'ERR_MEMORY_OVERFLOW'],
  [0x31, 'ERR_GENERIC'],
  [0x32, 'ERR_VERIFY'],
  // Yalnız pyxcp — kendi yorumu "NEW IN 1.1".
  [0x33, 'ERR_RESOURCE_TEMPORARY_NOT_ACCESSIBLE'],
]);

/** Olay kodu tablosu. 0x00-0x07/0xFE/0xFF Scapy+pyxcp ORTAK; 0x08-0x0C YALNIZ pyxcp ("XCP 1.5 Specification"). */
export const XCP_EVENT_NAMES: ReadonlyMap<number, string> = new Map([
  [0x00, 'EV_RESUME_MODE'],
  [0x01, 'EV_CLEAR_DAQ'],
  [0x02, 'EV_STORE_DAQ'],
  [0x03, 'EV_STORE_CAL'],
  // 0x04 iki kaynakta da rezerve (pyxcp'nin kendi yorumu: "# 0x04 reserved").
  [0x05, 'EV_CMD_PENDING'],
  [0x06, 'EV_DAQ_OVERLOAD'],
  [0x07, 'EV_SESSION_TERMINATED'],
  [0x08, 'EV_TIME_SYNC'],
  [0x09, 'EV_STIM_TIMEOUT'],
  [0x0a, 'EV_SLEEP'],
  [0x0b, 'EV_WAKE_UP'],
  [0x0c, 'EV_ECU_STATE_CHANGE'],
  [0xfe, 'EV_USER'],
  [0xff, 'EV_TRANSPORT'],
]);

const CONNECTION_MODE_NAMES: ReadonlyMap<number, string> = new Map([
  [0x00, 'NORMAL'],
  [0x01, 'USER_DEFINED'],
]);

function toByteOrder(order: 'little-endian' | 'big-endian'): ByteOrder {
  return order === 'big-endian' ? 'big' : 'little';
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function toHex(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(2, '0')}`;
}

export interface XcpPacketSummary {
  readonly kind: XcpPacketKind;
  readonly pid: number;
  readonly commandName: string | undefined;
  readonly responseClass: XcpResponseClass | undefined;
  readonly errorCode: number | undefined;
  readonly errorName: string | undefined;
  readonly consumedBytes: number;
}

const EMPTY_SUMMARY: XcpPacketSummary = {
  kind: 'daq-data',
  pid: 0,
  commandName: undefined,
  responseClass: undefined,
  errorCode: undefined,
  errorName: undefined,
  consumedBytes: 0,
};

export const WARN_XCP_DAQ_DATA = 'protocol.xcp.warning.daqData';
export const WARN_XCP_UNASSIGNED_COMMAND = 'protocol.xcp.warning.unassignedCommand';
export const WARN_XCP_COMMAND_PARAMETERS_RAW = 'protocol.xcp.warning.commandParametersRaw';
export const WARN_XCP_RESPONSE_BODY_RAW = 'protocol.xcp.warning.responseBodyRaw';
export const WARN_XCP_EVENT_BODY_RAW = 'protocol.xcp.warning.eventBodyRaw';
export const WARN_XCP_SERVICE_BODY_RAW = 'protocol.xcp.warning.serviceBodyRaw';

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

/**
 * CONNECT komutunu çözer (yapısal): tek bayt, `connection_mode` (Scapy
 * `Connect.fields_desc`).
 */
function decodeConnectCommand(
  data: Uint8Array,
  paramsOffset: number,
  paramsEnd: number,
  fields: ParsedField[],
  fieldIdPrefix: string,
): void {
  if (paramsOffset >= paramsEnd) return;
  const mode = byteAt(data, paramsOffset);
  fields.push({
    id: `${fieldIdPrefix}connection-mode`,
    name: 'Connection Mode',
    offset: paramsOffset,
    length: 1,
    rawBytes: data.slice(paramsOffset, paramsOffset + 1),
    rawValue: mode,
    physicalValue: CONNECTION_MODE_NAMES.get(mode) ?? toHex(mode),
    valid: true,
    warnings: [],
  });
}

/**
 * SET_MTA komutunu çözer (yapısal): reserved(2B) + address_extension(1B) +
 * address(4B, byteOrder'a bağlı) — Scapy `SetMta.fields_desc` VE pyxcp
 * `master.setMta()`nın gönderdiği `request(SET_MTA, 0, 0, address_ext,
 * *addr)` bayt sırasıyla BİREBİR örtüşüyor (dosya başı kaynak uyarısı).
 */
function decodeSetMtaCommand(
  data: Uint8Array,
  paramsOffset: number,
  paramsEnd: number,
  order: ByteOrder,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  fieldIdPrefix: string,
): void {
  const ADDRESS_EXTENSION_OFFSET = 2;
  const ADDRESS_OFFSET = 3;
  const ADDRESS_LENGTH = 4;
  const TOTAL_LENGTH = 7;

  if (paramsEnd - paramsOffset < TOTAL_LENGTH) {
    warnings.push(toProtocolWarning(WARN_XCP_COMMAND_PARAMETERS_RAW));
    return;
  }

  const addressExtensionOffset = paramsOffset + ADDRESS_EXTENSION_OFFSET;
  const addressExtension = byteAt(data, addressExtensionOffset);
  fields.push({
    id: `${fieldIdPrefix}address-extension`,
    name: 'Address Extension',
    offset: addressExtensionOffset,
    length: 1,
    rawBytes: data.slice(addressExtensionOffset, addressExtensionOffset + 1),
    rawValue: addressExtension,
    valid: true,
    warnings: [],
  });

  const addressOffset = paramsOffset + ADDRESS_OFFSET;
  const addressBytes = data.slice(addressOffset, addressOffset + ADDRESS_LENGTH);
  fields.push({
    id: `${fieldIdPrefix}address`,
    name: 'Address',
    offset: addressOffset,
    length: ADDRESS_LENGTH,
    rawBytes: addressBytes,
    rawValue: bytesToNumber(addressBytes, order),
    valid: true,
    warnings: [],
  });
}

/**
 * GET_STATUS pozitif yanıtını çözer (yapısal): current_session_status(1B) +
 * current_resource_protection_status(1B) + reserved(1B) +
 * session_configuration_id(2B, byteOrder'a bağlı) — Scapy
 * `StatusPositiveResponse.fields_desc`.
 */
function decodeGetStatusResponse(
  data: Uint8Array,
  bodyOffset: number,
  bodyEnd: number,
  order: ByteOrder,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  fieldIdPrefix: string,
): void {
  const SESSION_CONFIG_ID_OFFSET = 3;
  const SESSION_CONFIG_ID_LENGTH = 2;
  const TOTAL_LENGTH = 5;

  if (bodyEnd - bodyOffset < TOTAL_LENGTH) {
    warnings.push(toProtocolWarning(WARN_XCP_RESPONSE_BODY_RAW));
    return;
  }

  fields.push({
    id: `${fieldIdPrefix}current-session-status`,
    name: 'Current Session Status',
    offset: bodyOffset,
    length: 1,
    rawBytes: data.slice(bodyOffset, bodyOffset + 1),
    rawValue: byteAt(data, bodyOffset),
    valid: true,
    warnings: [],
  });
  fields.push({
    id: `${fieldIdPrefix}current-resource-protection-status`,
    name: 'Current Resource Protection Status',
    offset: bodyOffset + 1,
    length: 1,
    rawBytes: data.slice(bodyOffset + 1, bodyOffset + 2),
    rawValue: byteAt(data, bodyOffset + 1),
    valid: true,
    warnings: [],
  });

  const sessionIdOffset = bodyOffset + SESSION_CONFIG_ID_OFFSET;
  const sessionIdBytes = data.slice(sessionIdOffset, sessionIdOffset + SESSION_CONFIG_ID_LENGTH);
  fields.push({
    id: `${fieldIdPrefix}session-configuration-id`,
    name: 'Session Configuration ID',
    offset: sessionIdOffset,
    length: SESSION_CONFIG_ID_LENGTH,
    rawBytes: sessionIdBytes,
    rawValue: bytesToNumber(sessionIdBytes, order),
    valid: true,
    warnings: [],
  });
}

/**
 * CONNECT pozitif yanıtını çözer (yapısal): resource(1B) +
 * comm_mode_basic(1B) + max_cto(1B) + max_dto(2B, byteOrder'a bağlı) +
 * protocol_layer_version_msb(1B) + transport_layer_version_msb(1B) — Scapy
 * `ConnectPositiveResponse.fields_desc`. `resource`/`comm_mode_basic`
 * bayrak baytları HAM gösterilir (bit-bit adlandırma bu dalganın kapsamı
 * değil — sekiz isimli bit için jenerik bir "flag lister" yazmak bu dosyanın
 * TEK tüketicisi olurdu, erken soyutlama).
 */
function decodeConnectResponse(
  data: Uint8Array,
  bodyOffset: number,
  bodyEnd: number,
  order: ByteOrder,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  fieldIdPrefix: string,
): void {
  const MAX_DTO_OFFSET = 3;
  const MAX_DTO_LENGTH = 2;
  const PROTOCOL_VERSION_OFFSET = 5;
  const TRANSPORT_VERSION_OFFSET = 6;
  const TOTAL_LENGTH = 7;

  if (bodyEnd - bodyOffset < TOTAL_LENGTH) {
    warnings.push(toProtocolWarning(WARN_XCP_RESPONSE_BODY_RAW));
    return;
  }

  fields.push({
    id: `${fieldIdPrefix}resource`,
    name: 'Resource',
    offset: bodyOffset,
    length: 1,
    rawBytes: data.slice(bodyOffset, bodyOffset + 1),
    rawValue: byteAt(data, bodyOffset),
    valid: true,
    warnings: [],
  });
  fields.push({
    id: `${fieldIdPrefix}comm-mode-basic`,
    name: 'Communication Mode Basic',
    offset: bodyOffset + 1,
    length: 1,
    rawBytes: data.slice(bodyOffset + 1, bodyOffset + 2),
    rawValue: byteAt(data, bodyOffset + 1),
    valid: true,
    warnings: [],
  });
  fields.push({
    id: `${fieldIdPrefix}max-cto`,
    name: 'Max CTO',
    offset: bodyOffset + 2,
    length: 1,
    rawBytes: data.slice(bodyOffset + 2, bodyOffset + 3),
    rawValue: byteAt(data, bodyOffset + 2),
    unit: 'B',
    valid: true,
    warnings: [],
  });

  const maxDtoOffset = bodyOffset + MAX_DTO_OFFSET;
  const maxDtoBytes = data.slice(maxDtoOffset, maxDtoOffset + MAX_DTO_LENGTH);
  fields.push({
    id: `${fieldIdPrefix}max-dto`,
    name: 'Max DTO',
    offset: maxDtoOffset,
    length: MAX_DTO_LENGTH,
    rawBytes: maxDtoBytes,
    rawValue: bytesToNumber(maxDtoBytes, order),
    unit: 'B',
    valid: true,
    warnings: [],
  });

  fields.push({
    id: `${fieldIdPrefix}protocol-layer-version`,
    name: 'Protocol Layer Version (MSB)',
    offset: bodyOffset + PROTOCOL_VERSION_OFFSET,
    length: 1,
    rawBytes: data.slice(bodyOffset + PROTOCOL_VERSION_OFFSET, bodyOffset + PROTOCOL_VERSION_OFFSET + 1),
    rawValue: byteAt(data, bodyOffset + PROTOCOL_VERSION_OFFSET),
    valid: true,
    warnings: [],
  });
  fields.push({
    id: `${fieldIdPrefix}transport-layer-version`,
    name: 'Transport Layer Version (MSB)',
    offset: bodyOffset + TRANSPORT_VERSION_OFFSET,
    length: 1,
    rawBytes: data.slice(bodyOffset + TRANSPORT_VERSION_OFFSET, bodyOffset + TRANSPORT_VERSION_OFFSET + 1),
    rawValue: byteAt(data, bodyOffset + TRANSPORT_VERSION_OFFSET),
    valid: true,
    warnings: [],
  });
}

/**
 * XCP CTO paketini çözer. `offset..packetEnd` PID/packet_code baytıyla
 * başlar. `cipCore.ts`nin `decodeCipMessage` imza deseni: kendi
 * `ParseResult`unu üretmez, `fields`/`warnings`/`errors` dizilerine yazar.
 */
export function decodeXcpPacket(
  data: Uint8Array,
  offset: number,
  packetEnd: number,
  role: XcpRole,
  byteOrder: 'little-endian' | 'big-endian',
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  fieldIdPrefix: string,
): XcpPacketSummary {
  if (offset >= packetEnd) {
    errors.push({
      code: 'truncated-frame',
      message: 'XCP packet is empty — at least a PID byte is required.',
      offset,
      length: 0,
    });
    return EMPTY_SUMMARY;
  }

  const order = toByteOrder(byteOrder);
  const pid = byteAt(data, offset);
  const paramsOffset = offset + 1;

  if (role === 'command') {
    if (pid <= COMMAND_DAQ_STIM_UPPER_BOUND) {
      fields.push({
        id: `${fieldIdPrefix}pid`,
        name: 'PID',
        offset,
        length: 1,
        rawBytes: data.slice(offset, offset + 1),
        rawValue: pid,
        physicalValue: 'STIM (DAQ list data)',
        valid: true,
        warnings: [],
      });
      warnings.push(toProtocolWarning(WARN_XCP_DAQ_DATA));
      return { ...EMPTY_SUMMARY, kind: 'daq-data', pid, consumedBytes: packetEnd - offset };
    }

    const commandName = XCP_COMMAND_NAMES.get(pid);
    if (commandName === undefined) {
      fields.push({
        id: `${fieldIdPrefix}pid`,
        name: 'PID',
        offset,
        length: 1,
        rawBytes: data.slice(offset, offset + 1),
        rawValue: pid,
        physicalValue: `Unassigned (${toHex(pid)})`,
        valid: true,
        warnings: [],
      });
      warnings.push(toProtocolWarning(WARN_XCP_UNASSIGNED_COMMAND));
      return { ...EMPTY_SUMMARY, kind: 'unassigned-command', pid, consumedBytes: packetEnd - offset };
    }

    fields.push({
      id: `${fieldIdPrefix}pid`,
      name: 'PID',
      offset,
      length: 1,
      rawBytes: data.slice(offset, offset + 1),
      rawValue: pid,
      physicalValue: commandName,
      valid: true,
      warnings: [],
    });

    if (pid === 0xff) {
      decodeConnectCommand(data, paramsOffset, packetEnd, fields, fieldIdPrefix);
    } else if (pid === 0xf6) {
      decodeSetMtaCommand(data, paramsOffset, packetEnd, order, fields, warnings, fieldIdPrefix);
    } else if (!COMMANDS_WITHOUT_PAYLOAD.has(pid) && paramsOffset < packetEnd) {
      fields.push({
        id: `${fieldIdPrefix}parameters`,
        name: 'Command Parameters',
        offset: paramsOffset,
        length: packetEnd - paramsOffset,
        rawBytes: data.slice(paramsOffset, packetEnd),
        unit: 'B',
        valid: true,
        warnings: [WARN_XCP_COMMAND_PARAMETERS_RAW],
      });
      warnings.push(toProtocolWarning(WARN_XCP_COMMAND_PARAMETERS_RAW));
    }

    return { ...EMPTY_SUMMARY, kind: 'command', pid, commandName, consumedBytes: packetEnd - offset };
  }

  // role === 'response'
  const responseClass = XCP_RESPONSE_CLASSES.get(pid);
  if (responseClass === undefined) {
    fields.push({
      id: `${fieldIdPrefix}pid`,
      name: 'PID',
      offset,
      length: 1,
      rawBytes: data.slice(offset, offset + 1),
      rawValue: pid,
      physicalValue: 'DTO (DAQ data)',
      valid: true,
      warnings: [],
    });
    warnings.push(toProtocolWarning(WARN_XCP_DAQ_DATA));
    return { ...EMPTY_SUMMARY, kind: 'daq-data', pid, consumedBytes: packetEnd - offset };
  }

  fields.push({
    id: `${fieldIdPrefix}packet-code`,
    name: 'Packet Code',
    offset,
    length: 1,
    rawBytes: data.slice(offset, offset + 1),
    rawValue: pid,
    physicalValue: responseClass,
    valid: true,
    warnings: [],
  });

  if (responseClass === 'error') {
    const errorCode = byteAt(data, paramsOffset);
    const errorName = XCP_ERROR_NAMES.get(errorCode);
    if (paramsOffset < packetEnd) {
      fields.push({
        id: `${fieldIdPrefix}error-code`,
        name: 'Error Code',
        offset: paramsOffset,
        length: 1,
        rawBytes: data.slice(paramsOffset, paramsOffset + 1),
        rawValue: errorCode,
        physicalValue: errorName ?? toHex(errorCode),
        valid: true,
        warnings: [],
      });
    }
    const errorInfoOffset = paramsOffset + 1;
    if (errorInfoOffset < packetEnd) {
      fields.push({
        id: `${fieldIdPrefix}error-info`,
        name: 'Error Info',
        offset: errorInfoOffset,
        length: packetEnd - errorInfoOffset,
        rawBytes: data.slice(errorInfoOffset, packetEnd),
        unit: 'B',
        valid: true,
        warnings: [],
      });
    }
    return {
      ...EMPTY_SUMMARY,
      kind: 'response-classified',
      pid,
      responseClass,
      errorCode,
      errorName,
      consumedBytes: packetEnd - offset,
    };
  }

  if (responseClass === 'positive-response') {
    // Hangi komuta karşılık geldiği bilinmeden gövde çözülemez (dosya başı) —
    // yalnız CONNECT/GET_STATUS yanıtı, sabit uzunluklarından TANINABİLİR
    // olduğu için (7B / 5B) istisnaen çözülür; ötekiler HAM kalır.
    const remaining = packetEnd - paramsOffset;
    if (remaining === 7) {
      decodeConnectResponse(data, paramsOffset, packetEnd, order, fields, warnings, fieldIdPrefix);
    } else if (remaining === 5) {
      decodeGetStatusResponse(data, paramsOffset, packetEnd, order, fields, warnings, fieldIdPrefix);
    } else if (paramsOffset < packetEnd) {
      fields.push({
        id: `${fieldIdPrefix}response-data`,
        name: 'Response Data',
        offset: paramsOffset,
        length: packetEnd - paramsOffset,
        rawBytes: data.slice(paramsOffset, packetEnd),
        unit: 'B',
        valid: true,
        warnings: [WARN_XCP_RESPONSE_BODY_RAW],
      });
      warnings.push(toProtocolWarning(WARN_XCP_RESPONSE_BODY_RAW));
    }
    return { ...EMPTY_SUMMARY, kind: 'response-classified', pid, responseClass, consumedBytes: packetEnd - offset };
  }

  if (responseClass === 'event') {
    if (paramsOffset < packetEnd) {
      const eventCode = byteAt(data, paramsOffset);
      fields.push({
        id: `${fieldIdPrefix}event-code`,
        name: 'Event Code',
        offset: paramsOffset,
        length: 1,
        rawBytes: data.slice(paramsOffset, paramsOffset + 1),
        rawValue: eventCode,
        physicalValue: XCP_EVENT_NAMES.get(eventCode) ?? toHex(eventCode),
        valid: true,
        warnings: [],
      });
      const bodyOffset = paramsOffset + 1;
      if (bodyOffset < packetEnd) {
        fields.push({
          id: `${fieldIdPrefix}event-data`,
          name: 'Event Data',
          offset: bodyOffset,
          length: packetEnd - bodyOffset,
          rawBytes: data.slice(bodyOffset, packetEnd),
          unit: 'B',
          valid: true,
          warnings: [WARN_XCP_EVENT_BODY_RAW],
        });
        warnings.push(toProtocolWarning(WARN_XCP_EVENT_BODY_RAW));
      }
    }
    return { ...EMPTY_SUMMARY, kind: 'response-classified', pid, responseClass, consumedBytes: packetEnd - offset };
  }

  // responseClass === 'service' — `service_request_code`in İSMİ tek kaynaklı
  // (yalnız Scapy), bu yüzden ADLANDIRILMAZ (dosya başı); bayt ham gösterilir.
  if (paramsOffset < packetEnd) {
    fields.push({
      id: `${fieldIdPrefix}service-request-code`,
      name: 'Service Request Code',
      offset: paramsOffset,
      length: 1,
      rawBytes: data.slice(paramsOffset, paramsOffset + 1),
      rawValue: byteAt(data, paramsOffset),
      valid: true,
      warnings: [],
    });
    const bodyOffset = paramsOffset + 1;
    if (bodyOffset < packetEnd) {
      fields.push({
        id: `${fieldIdPrefix}service-data`,
        name: 'Service Data',
        offset: bodyOffset,
        length: packetEnd - bodyOffset,
        rawBytes: data.slice(bodyOffset, packetEnd),
        unit: 'B',
        valid: true,
        warnings: [WARN_XCP_SERVICE_BODY_RAW],
      });
      warnings.push(toProtocolWarning(WARN_XCP_SERVICE_BODY_RAW));
    }
  }
  return { ...EMPTY_SUMMARY, kind: 'response-classified', pid, responseClass, consumedBytes: packetEnd - offset };
}

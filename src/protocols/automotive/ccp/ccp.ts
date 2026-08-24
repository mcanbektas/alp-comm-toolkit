/**
 * CCP (CAN Calibration Protocol, ASAM MCD-1 CCP) — XCP'nin CAN'e özgü,
 * ASAM'ın artık legacy/obsolete ilan ettiği selefi.
 *
 * Faz 10, dalga 14c (`docs/brief-faz10-dalga14c.md`). Ana brifin bulgu 3'ü:
 * XCP **CTO/DTO** kullanırken (spec `:353`), CCP **CRO/DTO** kullanır (spec
 * `:383`) ve CRO'nun XCP'nin CTO'sunda OLMAYAN bir **Counter** alanı vardır.
 * Bu dosya `xcp/` klasörünün İÇİNE DEĞİL `automotive/ccp/` altına bilerek
 * konur — `mqtt.ts`/`mqttSn.ts`in (dalga 12f) ayrı dosya kararıyla AYNI
 * gerekçe: akraba görünen, aynı yerde aynı sayıyı BAŞKA anlamda okuyan iki
 * biçim. `xcpPacket.ts`in komut tablosu BURADA TÜKETİLMEZ, PAYLAŞILMAZ —
 * CRO/DTO ≠ CTO/DTO, ortak bir tablo iki protokolün ayrıştığı her kodu
 * sessizce yanlış çözerdi (12d'nin `networkTimestamp` dersiyle aynı sınıf).
 *
 * ── GİRDİ SÖZLEŞMESİ ─────────────────────────────────────────────────────────
 * 14b ile AYNI: 16 baytlık SocketCAN klasik çerçevesi, `canFrame.ts`/
 * `canClassic.ts`ten AYNI beş sembol (`devicenet.ts` emsali) — CAN veri-bağı
 * motoru İKİNCİ KEZ YAZILMADI. CCP CAN'e özgüdür (spec `:379`), başka
 * taşıyıcısı yoktur; çekirdek/taşıyıcı ayrımına gerek YOK, tek dosya.
 *
 * ── KAYNAK UYARISI — İKİ BAĞIMSIZ AÇIK KAYNAK, KODDAN DOĞRULANDI (2026-08-24) ─
 * ASAM MCD-1 CCP 2.1.0 spec'i ÜCRETLİdir ve bu depoda YOKTUR. Spec özeti
 * yalnız komut ADLARINI veriyor (CONNECT, GET_CCP_VERSION, SET_MTA, UPLOAD,
 * DOWNLOAD, DAQ), sayısal kod VERMİYOR — brief bu yüzden "yetersizse partial,
 * kaynaksız kayıt politikası gereği sormadan uygula" diyordu (2026-08-23
 * kullanıcı kararı). Fiili tarama BEKLENENDEN daha iyi sonuç verdi: aşağıdaki
 * komut/dönüş kodu tabloları ve çerçeve yerleşimi İKİ BAĞIMSIZ açık kaynak
 * implementasyonundan BAYT BAYT / KOD BAYT bazında çapraz doğrulandı ve
 * hiçbir çelişki bulunmadı — bu yüzden kayıt `partial` DEĞİL `ready`dir
 * (brief'in kötümser tahmini ÇÜRÜDÜ, bkz. dosya sonu "KAPSAM" notu):
 *
 *   1. pySART/cccp (GPL-2.0-or-later; dosya başlığı bunu açıkça söylüyor,
 *      GitHub'ın kendi lisans dedektörü depo kökünde ayrı bir LICENSE dosyası
 *      bulamadığı için `null` döndürüyor) — Christoph Schueler'in (pyxcp'nin
 *      de yazarı) "ASAM CAN Calibration Protocol for C" implementasyonu:
 *      `inc/ccp.h` (komut/dönüş kodu enum'ları):
 *      https://github.com/pySART/cccp/blob/master/inc/ccp.h
 *      `src/ccp.c` (CRO/DTO bayt yerleşimi — `CCP_COMMAND=(cmoIn->data[0])`,
 *      `COUNTER_IN=(cmoIn->data[1])`, `Ccp_SetDTOValues`: DATA_OUT(0)=tip,
 *      DATA_OUT(1)=dönüş kodu, DATA_OUT(2)=counter):
 *      https://github.com/pySART/cccp/blob/master/src/ccp.c
 *
 *   2. CanCat (BSD-2-Clause, atlas0fd00m/CanCat) — bağımsız yazar/dil (Python),
 *      araç güvenliği araştırmacısı Rennie deGraaf'ın CAN güvenlik aracı,
 *      `ccp` modülü "leader"/"follower" (CCP'nin master/slave'i) terimleriyle:
 *      `cancatlib/ccp/utils.py` (komut/dönüş kodu tabloları):
 *      https://github.com/atlas0fd00m/CanCat/blob/master/cancatlib/ccp/utils.py
 *      `cancatlib/ccp/ccp_leader.py` (`_constructCRO`, `DTO_TYPE` enum):
 *      https://github.com/atlas0fd00m/CanCat/blob/master/cancatlib/ccp/ccp_leader.py
 *      `cancatlib/ccp/ccp_follower.py` (`_generate_*_CRM`, `CRM_START_VAL`):
 *      https://github.com/atlas0fd00m/CanCat/blob/master/cancatlib/ccp/ccp_follower.py
 *
 * pySART'ın yazarı pyxcp'nin de yazarıdır (christoph2) — ama CanCat'in yazarı
 * (atlas0fd00m) TAMAMEN BAĞIMSIZ, ayrı bir dil/araç/amaçla yazılmış; iki
 * kaynak GERÇEKTEN bağımsız. Çapraz doğrulama sonucu: 28 komut kodunun 28'i,
 * 18 dönüş kodunun 18'i AD ve SAYI olarak BİREBİR örtüşüyor; CRO'nun
 * Command(0)+Counter(1)+Parameters(2-7) yerleşimi ve DTO/CRM'nin
 * 0xFF+ReturnCode(1)+Counter(2)+Data(3-7) yerleşimi HEM C makrolarında HEM
 * Python `_constructCRO`/`_generate_*_CRM`de BİREBİR aynı. CONNECT'in station
 * address'i (Intel/little-endian) ve SET_MTA'nın address'i (Motorola/
 * big-endian, XCP'nin AKSİNE müzakere edilmez, SABİT) ikisi de İKİ kaynakta
 * örtüşüyor.
 *
 * ── ÇÖZÜLMEYEN TEK ŞEY: HANGİ KOMUTUN CEVABI OLDUĞU ─────────────────────────
 * XCP'nin pozitif yanıtından FARKLI olarak CCP'nin CRM'i HER komut için AYNI
 * sabit 8 bayt uzunluğundadır (CONNECT'in yanıtı da GET_CCP_VERSION'ınki de
 * 8 bayt) — XCP'de CONNECT(7B)/GET_STATUS(5B) gibi uzunluktan ayırt etme
 * BURADA YOK. Bu depo tek çerçeve aldığı için (durumsuz sözleşme) CRM'in
 * hangi komutu yanıtladığı GERÇEKTEN bilinemez; bytes[3..7] bu yüzden HER
 * CRM için İSTİSNASIZ HAM kalır + uyarılır (yalnız Return Code'un KENDİSİ
 * bağlamsızdır ve GERÇEKTEN çözülür — `xcpPacket.ts`in ERR error_code'uyla
 * AYNI mantık).
 *
 * ── decodeOptions: CRO mu DTO mu — CAN ID'DEN gelir, içerikten değil ────────
 * `devicenet.ts`in `payloadInterpretation` kanalıyla AYNI gerekçe sınıfı: bir
 * baytın CRO'nun Command kodu mu yoksa DTO'nun DAQ PID'i mi olduğu İÇERİKTEN
 * ayırt edilemez (ikisi de küçük tam sayılar, örtüşebilir) — hangi CAN ID'de
 * geldiğine bağlıdır, kullanıcı sistem bağlamından bilir. Varsayılan `raw`
 * (üç şıkkın İLKİ, `devicenet.ts`in raw varsayılanıyla AYNI emsal): CRO/DTO
 * hiçbiri varsayılmadan tek genel "Data" alanı gösterilir.
 *
 * ── KOŞULSUZ LEGACY UYARISI ──────────────────────────────────────────────────
 * Spec iki kez söylüyor (`:379`, `:506`): ASAM CCP'yi legacy/obsolete ilan
 * etti, XCP "recommended successor". 12h'in Telnet plaintext uyarısıyla
 * (koşulsuz, her başarılı çözümde) BİREBİR aynı desen: her başarılı çözümde
 * `WARN_LEGACY_PROTOCOL` basılır, `related` katalogda (`automotive.ts`)
 * `xcp-on-can`a yönlendirir.
 *
 * ── KAPSAM: NEYİN ÇÖZÜLDÜĞÜ, NEYİN ÇÖZÜLMEDİĞİ ──────────────────────────────
 * Çözülen: çerçeve sınırları (8 bayt sabit), CRO/DTO ayrımı (decodeOptions),
 * Command/Counter alanları, CONNECT'in station address'i, SET_MTA'nın
 * mta-number/address-extension/address'i, CRM'in Return Code'u (18 kod tam
 * tablo), Event/DAQ DTO ayrımı (0xFF/0xFE/diğer). Çözülmeyen (A2L olmadan
 * anlamlandırılamaz, `xcp-on-can`ın aynı sınırı): DAQ verisinin İÇERİĞİ,
 * CRM'in komut-özel yanıt baytları (yukarıdaki gerekçe), CONNECT/SET_MTA
 * DIŞINDAKİ komutların CRO parametreleri.
 */

import { buildCanClassicFrame } from '../can/canClassic';
import {
  CAN_CLASSIC_FRAME_LENGTH,
  CAN_HEADER_LENGTH,
  decodeCanId,
  readUint32Le,
} from '../can/canFrame';
import { bytesToNumber } from '@/protocol-core/buffers/endianness';
import { createRawFrame } from '@/protocol-core/types';
import type {
  DecodeOption,
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

const PROTOCOL_ID = 'ccp';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'CCP';

/** CCP_LSDU_LEN — pySART `ccp.h:10`, CanCat `_constructCRO`nun `len(msg) != 8` denetimi. */
const CCP_FRAME_LENGTH = 8;

/**
 * Komut kodu tablosu — 28 giriş, pySART `Ccp_CommandType` + CanCat
 * `COMMAND_CODES`/`CCP_*` BİREBİR örtüşüyor (dosya başı kaynak uyarısı).
 */
export const CCP_COMMAND_NAMES: ReadonlyMap<number, string> = new Map([
  [0x01, 'CONNECT'],
  [0x02, 'SET_MTA'],
  [0x03, 'DNLOAD'],
  [0x04, 'UPLOAD'],
  [0x05, 'TEST'],
  [0x06, 'START_STOP'],
  [0x07, 'DISCONNECT'],
  [0x08, 'START_STOP_ALL'],
  [0x09, 'GET_ACTIVE_CAL_PAGE'],
  [0x0c, 'SET_S_STATUS'],
  [0x0d, 'GET_S_STATUS'],
  [0x0e, 'BUILD_CHKSUM'],
  [0x0f, 'SHORT_UP'],
  [0x10, 'CLEAR_MEMORY'],
  [0x11, 'SELECT_CAL_PAGE'],
  [0x12, 'GET_SEED'],
  [0x13, 'UNLOCK'],
  [0x14, 'GET_DAQ_SIZE'],
  [0x15, 'SET_DAQ_PTR'],
  [0x16, 'WRITE_DAQ'],
  [0x17, 'EXCHANGE_ID'],
  [0x18, 'PROGRAM'],
  [0x19, 'MOVE'],
  [0x1b, 'GET_CCP_VERSION'],
  [0x20, 'DIAG_SERVICE'],
  [0x21, 'ACTION_SERVICE'],
  [0x22, 'PROGRAM_6'],
  [0x23, 'DNLOAD_6'],
]);

/**
 * Dönüş (Return/Status) kodu tablosu — 18 giriş, pySART `Ccp_ReturnType` +
 * CanCat `COMMAND_RET_CODES` BİREBİR örtüşüyor (dosya başı kaynak uyarısı).
 */
export const CCP_RETURN_CODE_NAMES: ReadonlyMap<number, string> = new Map([
  [0x00, 'ACKNOWLEDGE'],
  [0x01, 'DAQ_PROCESSOR_OVERLOAD'],
  [0x10, 'COMMAND_PROCESSOR_BUSY'],
  [0x11, 'DAQ_PROCESSOR_BUSY'],
  [0x12, 'INTERNAL_TIMEOUT'],
  [0x18, 'KEY_REQUEST'],
  [0x19, 'SESSION_STATUS_REQUEST'],
  [0x20, 'COLD_START_REQUEST'],
  [0x21, 'CAL_DATA_INIT_REQUEST'],
  [0x22, 'DAQ_LIST_INIT_REQUEST'],
  [0x23, 'CODE_UPDATE_REQUEST'],
  [0x30, 'UNKNOWN_COMMAND'],
  [0x31, 'COMMAND_SYNTAX'],
  [0x32, 'PARAMETER_OUT_OF_RANGE'],
  [0x33, 'ACCESS_DENIED'],
  [0x34, 'OVERLOAD'],
  [0x35, 'ACCESS_LOCKED'],
  [0x36, 'RESOURCE_FUNCTION_NOT_AVAILABLE'],
]);

/** DTO'nun ilk baytı — pySART `Ccp_DTOType` (254/255) + CanCat `DTO_TYPE` (0xFE/0xFF) BİREBİR. */
const DTO_TYPE_CRM = 0xff;
const DTO_TYPE_EVENT = 0xfe;

const OPTION_FRAME_INTERPRETATION = 'frameInterpretation';
const INTERPRETATION_RAW = 'raw';
const INTERPRETATION_CRO = 'cro';
const INTERPRETATION_DTO = 'dto';

const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_FRAME_INTERPRETATION,
    label: 'protocol.ccp.option.frameInterpretation',
    kind: 'select',
    defaultValue: INTERPRETATION_RAW,
    description: 'protocol.ccp.option.frameInterpretation.description',
    choices: [
      { value: INTERPRETATION_RAW, label: 'protocol.ccp.option.frameInterpretation.raw' },
      { value: INTERPRETATION_CRO, label: 'protocol.ccp.option.frameInterpretation.cro' },
      { value: INTERPRETATION_DTO, label: 'protocol.ccp.option.frameInterpretation.dto' },
    ],
  },
];

const ERROR_FRAME_TOO_SHORT = 'protocol.ccp.error.frameTooShort';
const ERROR_FRAME_TOO_LONG = 'protocol.ccp.error.frameTooLong';
const ERROR_ABORTED = 'protocol.ccp.error.aborted';
const ERROR_EMPTY_PAYLOAD = 'protocol.ccp.error.emptyPayload';

const WARN_LEGACY_PROTOCOL = 'protocol.ccp.warning.legacyProtocol';
const WARN_SHORT_FRAME = 'protocol.ccp.warning.shortFrame';
const WARN_UNASSIGNED_COMMAND = 'protocol.ccp.warning.unassignedCommand';
const WARN_PARAMETERS_RAW = 'protocol.ccp.warning.parametersRaw';
const WARN_UNKNOWN_RETURN_CODE = 'protocol.ccp.warning.unknownReturnCode';
const WARN_RESPONSE_DATA_RAW = 'protocol.ccp.warning.responseDataRaw';
const WARN_EVENT_DATA_RAW = 'protocol.ccp.warning.eventDataRaw';
const WARN_DAQ_DATA = 'protocol.ccp.warning.daqData';

const SUMMARY_PREFIX = 'protocol.ccp.summary.';

function toProtocolWarning(key: string): ProtocolWarning {
  return { code: key, message: key };
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function toHex(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(2, '0')}`;
}

/**
 * CONNECT'in CRO parametrelerini çözer: station address (2B, Intel/
 * little-endian — CanCat `_gen_2_byte_val`: `struct.pack('<H', ...)`, kendi
 * docstring'i "station address (Intel format)"; pySART
 * `stationAddress = DATA_IN(2) | (DATA_IN(3) << 8)` AYNI sırayı üretiyor).
 * Kalan 4 bayt (offset 4-7) don't-care — HER iki kaynakta da "don't care".
 */
function decodeConnectCro(
  data: Uint8Array,
  paramsOffset: number,
  paramsEnd: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): void {
  const STATION_ADDRESS_LENGTH = 2;
  if (paramsEnd - paramsOffset < STATION_ADDRESS_LENGTH) {
    warnings.push(toProtocolWarning(WARN_PARAMETERS_RAW));
    return;
  }
  const addressBytes = data.slice(paramsOffset, paramsOffset + STATION_ADDRESS_LENGTH);
  fields.push({
    id: 'station-address',
    name: 'Station Address',
    offset: paramsOffset,
    length: STATION_ADDRESS_LENGTH,
    rawBytes: addressBytes,
    rawValue: bytesToNumber(addressBytes, 'little'),
    valid: true,
    warnings: [],
  });
}

/**
 * SET_MTA'nın CRO parametrelerini çözer: mta-number(1B) + address-extension
 * (1B) + address(4B, Motorola/big-endian — CanCat `_gen_4_byte_val`:
 * `struct.pack('>I', ...)`; pySART `(DATA_IN(4)<<24)|(DATA_IN(5)<<16)|
 * (DATA_IN(6)<<8)|DATA_IN(7)` AYNI MSB-önce sırayı üretiyor). XCP'nin
 * SET_MTA'sının AKSİNE (14b, `byteOrder` müzakere edilir) burada bayt sırası
 * SABİTTİR — decodeOptions kanalı GEREKMEZ, iki kaynak da tek bir sıra veriyor.
 */
function decodeSetMtaCro(
  data: Uint8Array,
  paramsOffset: number,
  paramsEnd: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): void {
  const TOTAL_LENGTH = 6;
  if (paramsEnd - paramsOffset < TOTAL_LENGTH) {
    warnings.push(toProtocolWarning(WARN_PARAMETERS_RAW));
    return;
  }

  const mtaNumber = byteAt(data, paramsOffset);
  fields.push({
    id: 'mta-number',
    name: 'MTA Number',
    offset: paramsOffset,
    length: 1,
    rawBytes: data.slice(paramsOffset, paramsOffset + 1),
    rawValue: mtaNumber,
    valid: true,
    warnings: [],
  });

  const extensionOffset = paramsOffset + 1;
  fields.push({
    id: 'address-extension',
    name: 'Address Extension',
    offset: extensionOffset,
    length: 1,
    rawBytes: data.slice(extensionOffset, extensionOffset + 1),
    rawValue: byteAt(data, extensionOffset),
    valid: true,
    warnings: [],
  });

  const addressOffset = paramsOffset + 2;
  const addressBytes = data.slice(addressOffset, addressOffset + 4);
  fields.push({
    id: 'address',
    name: 'Address',
    offset: addressOffset,
    length: 4,
    rawBytes: addressBytes,
    rawValue: bytesToNumber(addressBytes, 'big'),
    valid: true,
    warnings: [],
  });
}

/**
 * CRO yorumu: Command(0) + Counter(1) + Parameters(2-7) — pySART
 * `CCP_COMMAND=(cmoIn->data[0])`/`COUNTER_IN=(cmoIn->data[1])` makroları ve
 * CanCat `_constructCRO(cmd, ctr, cmd_data)` BİREBİR aynı yerleşimi veriyor.
 */
function decodeCroInterpretation(
  data: Uint8Array,
  payloadOffset: number,
  payloadEnd: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): void {
  if (payloadOffset >= payloadEnd) return;

  const command = byteAt(data, payloadOffset);
  const commandName = CCP_COMMAND_NAMES.get(command);
  fields.push({
    id: 'command',
    name: 'Command',
    offset: payloadOffset,
    length: 1,
    rawBytes: data.slice(payloadOffset, payloadOffset + 1),
    rawValue: command,
    physicalValue: commandName ?? `Unassigned (${toHex(command)})`,
    valid: commandName !== undefined,
    warnings: commandName === undefined ? [WARN_UNASSIGNED_COMMAND] : [],
  });
  if (commandName === undefined) {
    warnings.push(toProtocolWarning(WARN_UNASSIGNED_COMMAND));
  }

  const counterOffset = payloadOffset + 1;
  if (counterOffset >= payloadEnd) return;
  fields.push({
    id: 'counter',
    name: 'Counter',
    offset: counterOffset,
    length: 1,
    rawBytes: data.slice(counterOffset, counterOffset + 1),
    rawValue: byteAt(data, counterOffset),
    valid: true,
    warnings: [],
  });

  const paramsOffset = payloadOffset + 2;
  if (command === 0x01) {
    decodeConnectCro(data, paramsOffset, payloadEnd, fields, warnings);
  } else if (command === 0x02) {
    decodeSetMtaCro(data, paramsOffset, payloadEnd, fields, warnings);
  } else if (paramsOffset < payloadEnd) {
    // A2L/komut bağlamı olmadan CONNECT/SET_MTA dışındaki parametreler
    // yapısal olarak çözülemez (dosya başı KAPSAM notu) — xcpPacket.ts'in
    // aynı sınırı.
    fields.push({
      id: 'parameters',
      name: 'Parameters',
      offset: paramsOffset,
      length: payloadEnd - paramsOffset,
      rawBytes: data.slice(paramsOffset, payloadEnd),
      unit: 'B',
      valid: true,
      warnings: [WARN_PARAMETERS_RAW],
    });
    warnings.push(toProtocolWarning(WARN_PARAMETERS_RAW));
  }
}

/**
 * DTO yorumu: ilk bayt CRM(0xFF)/Event(0xFE)/DAQ(diğer) arasında ayrışır —
 * pySART `Ccp_DTOType` (255/254) + CanCat `DTO_TYPE.CRO_TYPE=0xFF`/
 * `EVENT_TYPE=0xFE` BİREBİR. CRM'in bytes[3..7]'si HANGİ komutun cevabı
 * olduğu bilinmeden çözülemez (dosya başı "ÇÖZÜLMEYEN TEK ŞEY") — İSTİSNASIZ
 * ham kalır; yalnız Return Code (bağlamsız, kendi başına anlamlı) çözülür.
 */
function decodeDtoInterpretation(
  data: Uint8Array,
  payloadOffset: number,
  payloadEnd: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
): void {
  if (payloadOffset >= payloadEnd) return;

  const marker = byteAt(data, payloadOffset);

  if (marker === DTO_TYPE_CRM) {
    fields.push({
      id: 'packet-id',
      name: 'Packet ID',
      offset: payloadOffset,
      length: 1,
      rawBytes: data.slice(payloadOffset, payloadOffset + 1),
      rawValue: marker,
      physicalValue: 'Command Return Message (CRM)',
      valid: true,
      warnings: [],
    });

    const returnCodeOffset = payloadOffset + 1;
    if (returnCodeOffset < payloadEnd) {
      const returnCode = byteAt(data, returnCodeOffset);
      const returnCodeName = CCP_RETURN_CODE_NAMES.get(returnCode);
      fields.push({
        id: 'return-code',
        name: 'Return Code',
        offset: returnCodeOffset,
        length: 1,
        rawBytes: data.slice(returnCodeOffset, returnCodeOffset + 1),
        rawValue: returnCode,
        physicalValue: returnCodeName ?? toHex(returnCode),
        valid: returnCodeName !== undefined,
        warnings: returnCodeName === undefined ? [WARN_UNKNOWN_RETURN_CODE] : [],
      });
      if (returnCodeName === undefined) {
        warnings.push(toProtocolWarning(WARN_UNKNOWN_RETURN_CODE));
      }
    }

    const counterOffset = payloadOffset + 2;
    if (counterOffset < payloadEnd) {
      fields.push({
        id: 'counter',
        name: 'Counter',
        offset: counterOffset,
        length: 1,
        rawBytes: data.slice(counterOffset, counterOffset + 1),
        rawValue: byteAt(data, counterOffset),
        valid: true,
        warnings: [],
      });
    }

    const dataOffset = payloadOffset + 3;
    if (dataOffset < payloadEnd) {
      fields.push({
        id: 'response-data',
        name: 'Response Data',
        offset: dataOffset,
        length: payloadEnd - dataOffset,
        rawBytes: data.slice(dataOffset, payloadEnd),
        unit: 'B',
        valid: true,
        warnings: [WARN_RESPONSE_DATA_RAW],
      });
      warnings.push(toProtocolWarning(WARN_RESPONSE_DATA_RAW));
    }
    return;
  }

  if (marker === DTO_TYPE_EVENT) {
    fields.push({
      id: 'packet-id',
      name: 'Packet ID',
      offset: payloadOffset,
      length: 1,
      rawBytes: data.slice(payloadOffset, payloadOffset + 1),
      rawValue: marker,
      physicalValue: 'Event Message',
      valid: true,
      warnings: [],
    });
    const bodyOffset = payloadOffset + 1;
    if (bodyOffset < payloadEnd) {
      fields.push({
        id: 'event-data',
        name: 'Event Data',
        offset: bodyOffset,
        length: payloadEnd - bodyOffset,
        rawBytes: data.slice(bodyOffset, payloadEnd),
        unit: 'B',
        valid: true,
        warnings: [WARN_EVENT_DATA_RAW],
      });
      warnings.push(toProtocolWarning(WARN_EVENT_DATA_RAW));
    }
    return;
  }

  // DAQ verisi: PID kimliği gösterilir, içerik DAQ list/A2L konfigürasyonu
  // olmadan anlamlandırılamaz (xcp-on-can'ın STIM/DAQ ile AYNI sınırı).
  fields.push({
    id: 'packet-id',
    name: 'Packet ID',
    offset: payloadOffset,
    length: 1,
    rawBytes: data.slice(payloadOffset, payloadOffset + 1),
    rawValue: marker,
    physicalValue: 'DAQ data (PID)',
    valid: true,
    warnings: [WARN_DAQ_DATA],
  });
  warnings.push(toProtocolWarning(WARN_DAQ_DATA));
  const bodyOffset = payloadOffset + 1;
  if (bodyOffset < payloadEnd) {
    fields.push({
      id: 'daq-data',
      name: 'DAQ Data',
      offset: bodyOffset,
      length: payloadEnd - bodyOffset,
      rawBytes: data.slice(bodyOffset, payloadEnd),
      unit: 'B',
      valid: true,
      warnings: [],
    });
  }
}

export type CcpFrameMetadata = {
  frameInterpretation: string;
  summaryKey: string;
  summaryParams: Record<string, string>;
};

interface CcpParseOptions {
  timestamp?: number;
  direction?: FrameDirection;
  channel?: string;
  maxFrameLength?: number;
  signal?: AbortSignal;
  frameInterpretation: string;
}

function resolveParseOptions(context: ParseContext | undefined): CcpParseOptions {
  const raw = context?.options?.[OPTION_FRAME_INTERPRETATION];
  const frameInterpretation =
    raw === INTERPRETATION_CRO || raw === INTERPRETATION_DTO ? raw : INTERPRETATION_RAW;
  return {
    ...(context?.timestamp === undefined ? {} : { timestamp: context.timestamp }),
    ...(context?.direction === undefined ? {} : { direction: context.direction }),
    ...(context?.channel === undefined ? {} : { channel: context.channel }),
    ...(context?.maxFrameLength === undefined ? {} : { maxFrameLength: context.maxFrameLength }),
    ...(context?.signal === undefined ? {} : { signal: context.signal }),
    frameInterpretation,
  };
}

function parseCcpFrame(data: Uint8Array, options: CcpParseOptions): ParseResult {
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
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];

  fields.push({
    id: 'can-id',
    name: 'CAN ID',
    offset: 0,
    length: 4,
    rawBytes: data.slice(0, 4),
    rawValue: identity.id,
    physicalValue: identity.extended ? 'Extended / 29-bit' : 'Base / 11-bit',
    valid: true,
    warnings: [],
  });

  const declaredLength = byteAt(data, 4);
  const availableAfterHeader = Math.max(0, data.length - CAN_HEADER_LENGTH);
  const payloadLength = Math.min(declaredLength, CCP_FRAME_LENGTH, availableAfterHeader);

  fields.push({
    id: 'dlc',
    name: 'DLC',
    offset: 4,
    length: 1,
    rawBytes: data.slice(4, 5),
    rawValue: declaredLength,
    physicalValue: payloadLength,
    unit: 'B',
    valid: true,
    warnings: [],
  });

  // Koşulsuz legacy uyarısı — dosya başı, spec `:379`/`:506`, 12h Telnet
  // plaintext uyarısının BİREBİR emsali: her başarılı çözümde basılır.
  warnings.push(toProtocolWarning(WARN_LEGACY_PROTOCOL));

  const payloadOffset = CAN_HEADER_LENGTH;
  const payloadEnd = CAN_HEADER_LENGTH + payloadLength;

  if (payloadLength === 0) {
    errors.push({
      code: 'truncated-frame',
      message: ERROR_EMPTY_PAYLOAD,
      offset: payloadOffset,
      length: 0,
    });
  } else {
    if (payloadLength < CCP_FRAME_LENGTH) {
      // CRO/DTO İKİSİ de sabit 8 bayttır (dosya başı) — kısa payload
      // yapısal olarak eksik bir CCP çerçevesidir.
      warnings.push(toProtocolWarning(WARN_SHORT_FRAME));
    }
    if (options.frameInterpretation === INTERPRETATION_CRO) {
      decodeCroInterpretation(data, payloadOffset, payloadEnd, fields, warnings);
    } else if (options.frameInterpretation === INTERPRETATION_DTO) {
      decodeDtoInterpretation(data, payloadOffset, payloadEnd, fields, warnings);
    } else {
      fields.push({
        id: 'data',
        name: 'Data',
        offset: payloadOffset,
        length: payloadLength,
        rawBytes: data.slice(payloadOffset, payloadEnd),
        unit: 'B',
        valid: true,
        warnings: [],
      });
    }
  }

  const summaryParams: Record<string, string> = {
    canId: identity.id.toString(16).toUpperCase(),
  };

  const metadata: CcpFrameMetadata = {
    frameInterpretation: options.frameInterpretation,
    summaryKey: `${SUMMARY_PREFIX}${options.frameInterpretation}`,
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

export function parseCcp(data: Uint8Array): ParseResult {
  return parseCcpFrame(data, { frameInterpretation: INTERPRETATION_RAW });
}

export const ccpParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /** Ucuz ön eleme: yalnız uzunluk aralığı — CCP'nin CAN ID'si XCP-on-CAN gibi kullanıcı bağlamına bağlıdır. */
  canParse(data: Uint8Array): boolean {
    return data.length >= CAN_HEADER_LENGTH && data.length <= CAN_CLASSIC_FRAME_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseCcpFrame(data, resolveParseOptions(context));
  },
};

/** DONT_CARE_VAL — CanCat `utils.py`: `DONT_CARE_VAL = 0x90`, don't-care baytları için. */
const DONT_CARE = 0x90;

/**
 * Örnek çerçeveler `buildCanClassicFrame`den kurulur (`xcpOnCan.ts`/
 * `devicenet.ts` emsali). CAN ID'ler CCP'nin kendi tanımladığı bir sabit
 * DEĞİLDİR — yalnız gösterim amaçlı, `xcpOnCan.ts`in aynı akla yatkın
 * ID çiftini (0x7E0 komut / 0x7E8 yanıt) kullanır.
 */
const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'connect-cro',
    name: 'protocol.ccp.example.connectCro.name',
    // Command 0x01=CONNECT, Counter 0x20, station address 0x1234 (LE: 34 12), don't-care×4.
    bytes: buildCanClassicFrame(0x7e0, [0x01, 0x20, 0x34, 0x12, DONT_CARE, DONT_CARE, DONT_CARE, DONT_CARE]),
    description: 'protocol.ccp.example.connectCro.description',
    expectedValid: true,
  },
  {
    id: 'connect-crm-ack',
    name: 'protocol.ccp.example.connectCrmAck.name',
    // Packet ID 0xFF=CRM, Return Code 0x00=ACKNOWLEDGE, Counter 0x20 (CRO'nun echo'su), don't-care×5.
    bytes: buildCanClassicFrame(0x7e8, [0xff, 0x00, 0x20, DONT_CARE, DONT_CARE, DONT_CARE, DONT_CARE, DONT_CARE]),
    description: 'protocol.ccp.example.connectCrmAck.description',
    expectedValid: true,
  },
  {
    id: 'set-mta-cro',
    name: 'protocol.ccp.example.setMtaCro.name',
    // Command 0x02=SET_MTA, Counter 0x21, mta-number 0, address-ext 0, address 0x00002000 (BE: 00 00 20 00).
    bytes: buildCanClassicFrame(0x7e0, [0x02, 0x21, 0x00, 0x00, 0x00, 0x00, 0x20, 0x00]),
    description: 'protocol.ccp.example.setMtaCro.description',
    expectedValid: true,
  },
  {
    id: 'unassigned-command-cro',
    name: 'protocol.ccp.example.unassignedCommandCro.name',
    // Command 0x0A — 0x09 (GET_ACTIVE_CAL_PAGE) ile 0x0C (SET_S_STATUS) arasındaki boşlukta, tabloda YOK.
    bytes: buildCanClassicFrame(0x7e0, [0x0a, 0x00, DONT_CARE, DONT_CARE, DONT_CARE, DONT_CARE, DONT_CARE, DONT_CARE]),
    description: 'protocol.ccp.example.unassignedCommandCro.description',
    expectedValid: true,
  },
  {
    id: 'daq-data-dto',
    name: 'protocol.ccp.example.daqDataDto.name',
    // Packet ID 0x02 — 0xFF/0xFE değil, DAQ list PID'i olarak yorumlanır; içerik A2L olmadan çözülmez.
    bytes: buildCanClassicFrame(0x7e8, [0x02, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77]),
    description: 'protocol.ccp.example.daqDataDto.description',
    expectedValid: true,
  },
  {
    id: 'empty-payload',
    name: 'protocol.ccp.example.emptyPayload.name',
    bytes: buildCanClassicFrame(0x7e0, []),
    description: 'protocol.ccp.example.emptyPayload.description',
    expectedValid: false,
  },
];

export const ccpPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'automotive',
  parser: ccpParser,
  documentation: {
    summary: 'protocol.ccp.documentation.summary',
    layer: 'application',
    references: [
      {
        title: 'pySART/cccp — ASAM CAN Calibration Protocol for C (GPL-2.0-or-later)',
        url: 'https://github.com/pySART/cccp',
      },
      {
        title: 'CanCat — cancatlib/ccp leader/follower modules (BSD-2-Clause)',
        url: 'https://github.com/atlas0fd00m/CanCat/tree/master/cancatlib/ccp',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};

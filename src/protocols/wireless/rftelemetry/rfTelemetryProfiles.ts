/**
 * RF Telemetry Custom Frame — ÇERÇEVE PROFİLLERİ (Faz 10 dalga 18e).
 *
 * Bu dosya kaydın "şema"sını üretir. Sabit TEK bir şema DEĞİL, bir
 * ŞEMA ÜRETİCİSİdir: kaydın doğası gereği alan yerleşimi kullanıcının
 * bildirdiği parametrelere (önbelleme uzunluğu, sync uzunluğu, `Length`in neyi
 * saydığı, CRC algoritması ve kapsamı) göre değişir.
 *
 * ## Alan yerleşimi nereden geliyor
 *
 * `docs/spec/ozet/09-kablosuz-iot.md:167-175` §3.9:
 * `Preamble · Sync Word · Device ID · Packet Type · Length · Data · CRC-16`.
 * **Bu bilgi geçerlidir ve KORUNUR.** Spec'in aynı satırdaki SAYISAL örneği
 * (`… C9 21`) korunmaz: keşif turu 17 standart CRC-16'yı ve 65.535 polinomun
 * TAMAMINI (init/refleksiyon/xorout çarpanlarıyla, 6..12 arası tüm bayt
 * aralıklarında) taradı ve `C9 21`i üreten TANINAN bir yapılandırma bulamadı.
 * Aynı bölümün whitening örneği (`A7 39` → `01 10`) de 8.192 dokuz-bitlik LFSR
 * ve 40 BLE kanalının hiçbiriyle üretilemedi. `[KARAR 18-5]`
 *
 * → **Spec'in sayısal örnekleri AÇIKLAYICIDIR, FIXTURE DEĞİLDİR.** Bu dosyanın
 * ürettiği çerçevelerin CRC'leri motorun kendi `computeChecksum`ından gelir.
 * *(Dalga 17'nin "keşfin elle çözdüğü her çerçeve şüphelidir" dersinin
 * dördüncü vakası — ve ilk kez şüpheli olan şey deponun KENDİ spec'i.)*
 *
 * ## `Length`in neyi saydığı TELDE YAZMAZ
 *
 * Aynı bayt dizisi, `Length`in yorumu değişince BAŞKA bir çerçevedir. Üç
 * gelenek de sahada görülür ve hiçbiri çerçeveden çıkarılamaz:
 *
 * | Yorum | `Data` uzunluğu |
 * |---|---|
 * | `payload-only`    | `Length` |
 * | `includes-crc`    | `Length − CRC genişliği` |
 * | `includes-header` | `Length − 3` (Device ID + Packet Type + Length) |
 *
 * Bu, dalga 17'nin SNVT selector dersinin bu kayıttaki karşılığıdır: seçim bir
 * ÖLÇÜM değil, bir BİLDİRİMDİR.
 */

import { checksumWidthBytes } from '@/protocol-core/checksums/algorithmCatalogue';
import type { ChecksumAlgorithm } from '@/protocol-core/checksums/algorithmCatalogue';
import type { Endianness } from '@/protocol-core/encoding/ieee754';
import type { ProtocolFieldSchema, ProtocolSchema } from '@/protocol-core/schemas/protocolSchema';

/** Spec §3.9'un varsayılan profili — `canParse` imzası da bu ikiliye bağlıdır. */
export const SPEC_PREAMBLE_BYTES: readonly number[] = [0xaa, 0xaa, 0xaa];
export const SPEC_SYNC_WORD_BYTES: readonly number[] = [0x2d, 0xd4];

export const DEFAULT_PREAMBLE_LENGTH = SPEC_PREAMBLE_BYTES.length;
export const DEFAULT_SYNC_WORD_LENGTH = SPEC_SYNC_WORD_BYTES.length;
export const DEFAULT_CRC_ALGORITHM: ChecksumAlgorithm = 'CRC16_CCITT_FALSE';

/** `Length` alanının neyi saydığı — telde YOKTUR, kullanıcı bildirir. */
export type LengthFieldSemantics = 'payload-only' | 'includes-crc' | 'includes-header';

/**
 * CRC kapsamının BAŞLADIĞI alan. Bitiş daima `data`dır: kapsamın çerçevenin
 * sonundan geriye doğru büyümesi RF telemetride tek geleneksel biçim ve
 * `ChecksumCoverage` zaten ALAN KİMLİĞİ aralığı alıyor (bayt ofseti değil).
 */
export type CrcCoverageStart = 'syncWord' | 'deviceId' | 'packetType' | 'length' | 'data';

/** Header alanlarının sabit bayt sayısı: Device ID + Packet Type + Length. */
export const HEADER_FIELD_BYTES = 3;

/**
 * Azami çerçeve: 8 baytlık önbelleme + 4 baytlık sync + 3 baytlık header +
 * 255 baytlık `Length` tavanı + 8 baytlık CRC-64 = 278; yuvarlanarak 320.
 * Sabit ŞART (`schemaParser`in koruma bandı): bozuk bir `Length` baytı motoru
 * gigabyte'lık dilim istemeye zorlayamaz.
 */
export const MAXIMUM_FRAME_LENGTH = 320;

export interface RfTelemetryLayout {
  readonly preambleLength: number;
  readonly syncWordLength: number;
  readonly lengthSemantics: LengthFieldSemantics;
  readonly crcAlgorithm: ChecksumAlgorithm;
  readonly crcCoverageStart: CrcCoverageStart;
  readonly crcByteOrder: Endianness;
}

export const DEFAULT_LAYOUT: RfTelemetryLayout = {
  preambleLength: DEFAULT_PREAMBLE_LENGTH,
  syncWordLength: DEFAULT_SYNC_WORD_LENGTH,
  lengthSemantics: 'payload-only',
  crcAlgorithm: DEFAULT_CRC_ALGORITHM,
  crcCoverageStart: 'deviceId',
  crcByteOrder: 'big',
};

/** `Length` baytının çerçevedeki konumu — üç header alanının sonuncusu. */
export function lengthFieldOffset(layout: RfTelemetryLayout): number {
  return layout.preambleLength + layout.syncWordLength + 2;
}

export interface DataLengthResolution {
  readonly dataLength: number;
  /** `Length` yorumu negatif uzunluk verdiyse sebebi; `undefined` ise sorun yok. */
  readonly issue?: string;
}

/**
 * Ham `Length` baytını, seçilen yoruma göre `Data` alanının bayt sayısına
 * çevirir. Negatif sonuç bir HATA'dır: yorum ile çerçeve uyuşmuyordur ve bunu
 * sessizce sıfıra kırpmak yanlış bir çözümü doğru göstermek olurdu.
 */
export function resolveDataLength(
  rawLength: number,
  layout: RfTelemetryLayout,
): DataLengthResolution {
  const crcWidth = layout.crcAlgorithm === 'none' ? 0 : checksumWidthBytes(layout.crcAlgorithm);
  const subtrahend =
    layout.lengthSemantics === 'includes-crc'
      ? crcWidth
      : layout.lengthSemantics === 'includes-header'
        ? HEADER_FIELD_BYTES
        : 0;
  const dataLength = rawLength - subtrahend;
  if (dataLength < 0) {
    return {
      dataLength: 0,
      issue: `Length = ${rawLength}, "${layout.lengthSemantics}" yorumunda ${subtrahend} bayt düşülüyor; negatif yük uzunluğu`,
    };
  }
  return { dataLength };
}

/** CRC alanının tipi: katalogdaki CRC'ler `crc`, basit toplamlar `checksum`. */
function checksumFieldType(algorithm: ChecksumAlgorithm): 'crc' | 'checksum' {
  return algorithm.startsWith('CRC') ? 'crc' : 'checksum';
}

/**
 * Yerleşim + çözülmüş `Data` uzunluğundan bir `ProtocolSchema` üretir.
 *
 * **`framing.startBytes` BİLEREK BOŞTUR.** İki sebep:
 *  1. Önbelleme ve sync sözcüğünün DEĞERİ kullanıcının radyosuna bağlıdır;
 *     `verifyFraming` sabit bir değeri dayatsaydı, 4 baytlık sync kullanan bir
 *     kullanıcı kendi çerçevesini çözemezdi. Varsayılan profilden SAPMA bir
 *     hata değil, bir UYARIDIR ve `rfTelemetry.ts` onu çerçeve uyarısı olarak
 *     düşürür.
 *  2. Bu kayıt `createSchemaParser`i HİÇ KULLANMAZ; `canParse` `rfTelemetry.ts`te
 *     AÇIKÇA yazılıdır. Gerekçe orada, kanıtı `rfTelemetryCanParseRegistry.test.ts`te.
 *     (TARİHÇE: bu maddenin ilk gerekçesi boş `startBytes`in `canParse`i HER ŞEYE
 *     `true` dedirtmesiydi; o mayın 2026-08-27'de KAPANDI. Karar yeniden ölçüldü
 *     ve DEĞİŞMEDİ — bkz. `rfTelemetryCanParseRegistry.test.ts` dosya başı.)
 *
 * `dataLength` `undefined` verilirse `Data` uzunluğunu `lengthFrom: 'length'`
 * ile `Length` alanından alır — **KODLAMA yolu bunu kullanır**:
 * `encodeWithSchema` bu bağı görünce `Length`i kendisi hesaplar (yük bayt
 * sayısı, yani `payload-only` yorumu). ÇÖZME yolunda ise uzunluk AÇIKÇA
 * verilir, çünkü `lengthFrom` ham baytı olduğu gibi alır ve `includes-crc` /
 * `includes-header` yorumlarını ifade edemez.
 */
export function buildRfTelemetrySchema(
  layout: RfTelemetryLayout,
  dataLength: number | undefined,
): ProtocolSchema {
  const fields: ProtocolFieldSchema[] = [];
  let offset = 0;

  if (layout.preambleLength > 0) {
    fields.push({
      id: 'preamble',
      name: 'Preamble',
      type: 'rawBytes',
      offset,
      length: layout.preambleLength,
      color: 0,
    });
    offset += layout.preambleLength;
  }

  if (layout.syncWordLength > 0) {
    fields.push({
      id: 'syncWord',
      name: 'Sync Word',
      type: 'rawBytes',
      offset,
      length: layout.syncWordLength,
      color: 1,
    });
    offset += layout.syncWordLength;
  }

  fields.push(
    { id: 'deviceId', name: 'Device ID', type: 'address', offset, length: 1, color: 2 },
    { id: 'packetType', name: 'Packet Type', type: 'command', length: 1, color: 2 },
    { id: 'length', name: 'Length', type: 'length', length: 1, color: 2 },
    dataLength === undefined
      ? { id: 'data', name: 'Data', type: 'rawBytes', lengthFrom: 'length', color: 3 }
      : { id: 'data', name: 'Data', type: 'rawBytes', length: dataLength, color: 3 },
  );

  if (layout.crcAlgorithm !== 'none') {
    // Kapsam başlangıcı var olmayan bir alanı gösteriyorsa (sync uzunluğu 0
    // seçilmişken `syncWord` istenmesi gibi) sessizce `deviceId`ye düşülür:
    // `parseChecksumField` çözümlenemeyen kapsamda alanı GEÇERSİZ sayar ve
    // kullanıcı "CRC bozuk" sanırdı — oysa bozuk olan yapılandırmadır.
    const declaredStart = layout.crcCoverageStart;
    const startField =
      fields.some((field) => field.id === declaredStart) ? declaredStart : 'deviceId';
    fields.push({
      id: 'crc',
      name: 'CRC',
      type: checksumFieldType(layout.crcAlgorithm),
      algorithm: layout.crcAlgorithm,
      coverage: { startField, endField: 'data' },
      endianness: layout.crcByteOrder,
      color: 1,
    });
  }

  return {
    name: 'RF Telemetry Custom Frame',
    version: '1.0',
    framing: { type: 'none', maximumFrameLength: MAXIMUM_FRAME_LENGTH },
    fields,
  };
}

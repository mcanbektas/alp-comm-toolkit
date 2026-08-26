/**
 * IEC 61162-450 ("LWE" — Lightweight Ethernet) TAG bloğu bölücüsü ve parametre
 * sözlüğü (Faz 10, dalga 16c).
 *
 * ── NEDEN AYRI MODÜL ───────────────────────────────────────────────────────
 * `nmeaSentences.ts`in `nmea0183.ts`ten ayrılma gerekçesinin aynısı: TAG bloğu
 * kendi başına bir dilbilgisidir (kendi sınırlayıcısı, kendi checksum'ı, kendi
 * parametre sözlüğü) ve `iec61162.ts`in işi datagram zarfıdır. İkisini tek
 * dosyaya koymak `modbusPdu.ts`/`modbusRtu.ts` ayrımını bozmakla aynı şey olurdu.
 *
 * ── EN İNCELİKLİ NOKTA: İKİ CHECKSUM, İKİ FARKLI BAYT ARALIĞI ──────────────
 * Aynı datagramda İKİ checksum vardır ve **algoritmaları AYNI, kapsamları
 * FARKLIDIR**:
 *
 *   TAG bloğu   `\s:HE0001*45\`          → XOR("s:HE0001")        = 0x45
 *   Cümle       `$HEROT,+000.05,A*35`    → XOR("HEROT,+000.05,A") = 0x35
 *
 * Yani TAG'in checksum'ı `\` ile `*` ARASINI, cümleninki `$` ile `*` ARASINI
 * kapsar. İkisini tek bir "cümleyi bul, checksum'ını doğrula" fonksiyonuyla
 * çözmeye çalışmak TAG bloğunu ya atlar ya YANLIŞ ARALIKTA hesaplar — ve yanlış
 * aralık hata VERMEDEN yanlış bir PASS/FAIL basar. Bu dosya YALNIZ TAG
 * aralığını bilir; cümle aralığı `iec61162.ts`tedir ve ikisi hiç karışmaz.
 *
 * Üç bağımsız uygulama TAG aralığını aynı şekilde hesaplıyor `[KANIT]`:
 *   · FKIE `maritime-dissector`, `maritime-modules/parser/iec450.lua`
 *     `find_tag_blocks_chcksm_corrupt`: bloğu `[^\\]+` ile ayırır, sonra
 *     `"(.+)%*([%d%u][%d%u])"` ile böler ve `calc_checksum(str)` çağırır
 *     (`checksumcalculator.lua`: sınırlayıcısız düz XOR).
 *   · `PyLWE`, `src/pylwe/parser.py:19-30` — `content, checksum_hex =
 *     tag_str.rsplit("*", 1)` sonra karakter karakter XOR.
 *   · `gosk`, `writer/lwe.go:187-191`.
 * (Üçü de 2026-08-26'da doğrudan indirilip okundu; FKIE'nin dalı `master`.)
 *
 * ── `nmeaChecksum.ts` TÜKETİLİR, KOPYALANMAZ ───────────────────────────────
 * `nmeaXorChecksum`/`formatNmeaChecksum` DOĞRUDAN import edilir
 * (`xcpPacket.ts` sınıfı bir paylaşım). `parseNmeaSentence` KULLANILMAZ: o
 * cümlenin `$` ile BAŞLADIĞINI sabit varsayıyor ve TAG bloğu `\` ile başlıyor.
 * `ais.ts:10-20` birebir aynı durumu yaşamış ve aynı kararı yazmıştır.
 * `nmeaChecksum.ts`e DOKUNULMAZ — dört tüketicisi var.
 *
 * ── 80 BAYTLIK SINIR — İKİ KAYNAK AYNI ŞEYİ İKİ BİÇİMDE SÖYLÜYOR ───────────
 * FKIE `iec450.lua:26-35`: blok İÇERİĞİ (ters bölüler HARİÇ, `*hh` DAHİL)
 * 80 bayttan uzunsa "Tag length exceeded". PyLWE `parser.py:71-74`: blok
 * ters bölülerle BİRLİKTE 82 bayttan uzunsa hata. İkisi AYNI sınırdır
 * (80 + 2 sınırlayıcı) ve çeliştikleri sanılmamalıdır.
 */

import { formatNmeaChecksum, nmeaXorChecksum } from '@/protocol-core/checksums/nmeaChecksum';

/** TAG bloğunun açılış ve kapanış sınırlayıcısı — cümlenin `$`/`!`inden AYRI. */
export const TAG_BLOCK_DELIMITER = '\\';
/** Hem TAG bloğunda hem cümlede checksum'ı ayıran karakter; KAPSAMLARI farklıdır. */
export const CHECKSUM_DELIMITER = '*';
/** FKIE `iec450.lua:31` — blok içeriği (ters bölüler hariç) en çok 80 bayt. */
export const TAG_BLOCK_MAX_CONTENT_LENGTH = 80;
/** NMEA checksum'ı her zaman iki hane BÜYÜK hex'tir. */
const CHECKSUM_HEX_LENGTH = 2;

const HEX_PAIR_PATTERN = /^[0-9A-Fa-f]{2}$/;

/**
 * TAG parametre sözlüğü. Kaynak: gpsd `www/AIVDM.adoc:4862-4920` (*"an opening
 * backslash, followed by multiple comma-separated fields none of which may
 * contain backslashes, followed by an asterisk and NMEA checksum, followed by a
 * closing backslash"*) ve IEC 61162-450 madde 3.25.
 *
 * `name` PROTOKOL VERİSİDİR, çeviriye girmez (CLAUDE.md) — harfin kendisi de
 * öyle. Çeviriye giren tek şey uyarı/hata metinleridir.
 */
export interface LweTagParameterInfo {
  readonly letter: string;
  readonly name: string;
  /** Standart yalnız `s:`i ZORUNLU kılıyor (`PyLWE/src/pylwe/generator.py:25-26`). */
  readonly required: boolean;
  /**
   * `false` ise parametre TANINIR ama içeriği ÇÖZÜLMEZ. Tek örneği `a:`:
   * -450 Ed.2 ile eklendi, **biçimi kamuya açık DEĞİL** — uydurulmuş bir alan
   * tablosu yayınlamak yerine ham bırakılır (dalga 13 dersi 5).
   */
  readonly decoded: boolean;
}

export const LWE_TAG_PARAMETERS: readonly LweTagParameterInfo[] = [
  { letter: 's', name: 'Source (SFI)', required: true, decoded: true },
  { letter: 'n', name: 'Line Count', required: false, decoded: true },
  { letter: 'g', name: 'Sentence Grouping', required: false, decoded: true },
  { letter: 'c', name: 'Timestamp (UNIX)', required: false, decoded: true },
  { letter: 'd', name: 'Destination', required: false, decoded: true },
  { letter: 'r', name: 'Relative Time', required: false, decoded: true },
  { letter: 't', name: 'Text', required: false, decoded: true },
  { letter: 'i', name: 'Text (extended)', required: false, decoded: true },
  { letter: 'a', name: 'Authentication', required: false, decoded: false },
];

const TAG_PARAMETERS_BY_LETTER = new Map(
  LWE_TAG_PARAMETERS.map((parameter) => [parameter.letter, parameter]),
);

export function getTagParameterInfo(letter: string): LweTagParameterInfo | undefined {
  return TAG_PARAMETERS_BY_LETTER.get(letter);
}

/** Tek bir `k:v` parametresi ve TAM CÜMLEDEKİ bayt ofseti. */
export interface LweTagParameter {
  readonly letter: string;
  readonly value: string;
  /** `k:v` token'ının tamamının ofseti (harfin kendisinden değerin sonuna). */
  readonly offset: number;
  readonly length: number;
  readonly info: LweTagParameterInfo | undefined;
}

/**
 * Bölünmüş TAG bloğu. Üç ayrı aralık taşır ve **karıştırılmamaları bu tipin
 * varlık sebebidir**:
 *   · `offset`/`length` — açılış `\`dan kapanış `\`ya kadar TAMAMI,
 *   · `contentOffset`/`contentLength` — ters bölüler HARİÇ içerik (`*hh` dahil),
 *   · `coverageOffset`/`coverageLength` — **checksum'ın KAPSADIĞI** aralık,
 *     yani `\` ile `*` arası.
 */
export interface LweTagBlock {
  readonly offset: number;
  readonly length: number;
  readonly contentOffset: number;
  readonly contentLength: number;
  readonly coverage: string;
  readonly coverageOffset: number;
  readonly coverageLength: number;
  /** Bloğun bildirdiği checksum; `*` hiç yoksa `undefined`. */
  readonly checksumHex: string | undefined;
  readonly checksumOffset: number | undefined;
  /** `coverage` üzerinden YENİDEN hesaplanan değer — gösterilen değil, hesaplanan. */
  readonly calculatedChecksum: string;
  readonly checksumValid: boolean;
  readonly checksumMalformed: boolean;
  readonly exceedsMaxLength: boolean;
  readonly parameters: readonly LweTagParameter[];
}

/**
 * `text[startIndex]` bir açılış `\` ise bloğu böler. Kapanış `\` bulunamazsa
 * `undefined` döner — çağıran bunu "TAG bloğu kapanmamış" hatasına çevirir.
 *
 * `text` datagramın TAMAMIDIR ve indeksleri bayt ofsetiyle birebir örtüşür
 * (`iec61162.ts` girdiyi `String.fromCharCode` ile çeviriyor, `TextDecoder`
 * ile değil — `nmea0183.ts`in ASCII tuzağı notu).
 */
export function splitTagBlock(text: string, startIndex: number): LweTagBlock | undefined {
  if (text.charAt(startIndex) !== TAG_BLOCK_DELIMITER) {
    return undefined;
  }
  const closingIndex = text.indexOf(TAG_BLOCK_DELIMITER, startIndex + 1);
  if (closingIndex === -1) {
    return undefined;
  }

  const contentOffset = startIndex + 1;
  const contentLength = closingIndex - contentOffset;
  const content = text.slice(contentOffset, closingIndex);

  // Checksum'ı SON `*` ayırır: değerlerin içinde `*` geçebilir, checksum en sondadır.
  const starIndex = content.lastIndexOf(CHECKSUM_DELIMITER);
  const hasChecksum = starIndex !== -1;
  const coverage = hasChecksum ? content.slice(0, starIndex) : content;
  const checksumHex = hasChecksum ? content.slice(starIndex + 1) : undefined;
  const calculatedChecksum = formatNmeaChecksum(nmeaXorChecksum(coverage));
  const checksumMalformed =
    checksumHex !== undefined &&
    (checksumHex.length !== CHECKSUM_HEX_LENGTH || !HEX_PAIR_PATTERN.test(checksumHex));

  return {
    offset: startIndex,
    length: closingIndex - startIndex + 1,
    contentOffset,
    contentLength,
    coverage,
    coverageOffset: contentOffset,
    coverageLength: coverage.length,
    checksumHex,
    checksumOffset: hasChecksum ? contentOffset + starIndex + 1 : undefined,
    calculatedChecksum,
    checksumValid:
      checksumHex !== undefined &&
      !checksumMalformed &&
      checksumHex.toUpperCase() === calculatedChecksum,
    checksumMalformed,
    exceedsMaxLength: contentLength > TAG_BLOCK_MAX_CONTENT_LENGTH,
    parameters: parseTagParameters(coverage, contentOffset),
  };
}

/**
 * Checksum'ın KAPSADIĞI metni (yani `*`dan öncesini) virgülle böler ve her
 * `k:v` token'ını ofsetiyle döner. `:` taşımayan token ATLANIR (PyLWE
 * `parse_tags` aynısını yapıyor) — biçimsiz bir parça uydurma bir parametreye
 * çevrilmez.
 */
export function parseTagParameters(coverage: string, coverageOffset: number): LweTagParameter[] {
  const parameters: LweTagParameter[] = [];
  let start = 0;
  for (let index = 0; index <= coverage.length; index += 1) {
    if (index !== coverage.length && coverage.charAt(index) !== ',') {
      continue;
    }
    const token = coverage.slice(start, index);
    const colonIndex = token.indexOf(':');
    if (colonIndex > 0) {
      const letter = token.slice(0, colonIndex);
      parameters.push({
        letter,
        value: token.slice(colonIndex + 1),
        offset: coverageOffset + start,
        length: token.length,
        info: getTagParameterInfo(letter),
      });
    }
    start = index + 1;
  }
  return parameters;
}

/**
 * `c:` parametresinin ÖLÇEĞİ ÇERÇEVEDEN ANLAŞILMAZ — hane sayısından ÇIKARILIR.
 *
 * Gerçek yakalamada `c:1683881316755` (13 hane, milisaniye), gpsd'nin kendi
 * örneğinde `c:1241544035` (10 hane, saniye). **Aynı parametre, iki ölçek.**
 * Çıkarım yapılabildiğinde bile bu bir ÖLÇÜM DEĞİLDİR: çağıran `unit` ATAMAZ
 * (`types.ts:46` — *"`unit` yalnız gerçek fiziksel değere"*) ve
 * `timestampScaleInferred` uyarısını basar. Hane sayısı ikisinden biri değilse
 * `undefined` döner ve HİÇBİR ölçek iddia edilmez.
 */
export interface LweTimestampInference {
  readonly scale: 's' | 'ms';
  readonly iso: string;
}

const UNIX_SECONDS_DIGITS = 10;
const UNIX_MILLISECONDS_DIGITS = 13;
const MILLISECONDS_PER_SECOND = 1000;

export function inferTimestampScale(raw: string): LweTimestampInference | undefined {
  if (!/^\d+$/.test(raw)) {
    return undefined;
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) {
    return undefined;
  }
  if (raw.length === UNIX_SECONDS_DIGITS) {
    return { scale: 's', iso: new Date(value * MILLISECONDS_PER_SECOND).toISOString() };
  }
  if (raw.length === UNIX_MILLISECONDS_DIGITS) {
    return { scale: 'ms', iso: new Date(value).toISOString() };
  }
  return undefined;
}

/**
 * `g:` — CÜMLE gruplaması. **Bu, çok-noktaya-yayın "transmission group"u
 * DEĞİLDİR** ve ikisini karıştırmak bu kaydın en kolay sessiz hatasıdır:
 * çok-noktaya-yayın grubu UDP/IP BAŞLIĞINDADIR, payload'da hiç yoktur
 * (`iec61162.ts` dosya başı). `g:` ise tek bir mantıksal mesajın birden çok
 * cümleye bölünmesini anlatır.
 *
 * gpsd `www/AIVDM.adoc`, birebir: *"The first number is the sentence number,
 * the second is total number of sentences to make up one group. The third
 * number is an identifier for that particular group."*
 */
export function describeSentenceGrouping(raw: string): string | undefined {
  const parts = raw.split('-');
  if (parts.length !== 3) {
    return undefined;
  }
  const [sentence, total, groupId] = parts;
  if (sentence === undefined || total === undefined || groupId === undefined) {
    return undefined;
  }
  if (!/^\d+$/.test(sentence) || !/^\d+$/.test(total) || !/^\d+$/.test(groupId)) {
    return undefined;
  }
  return `sentence ${sentence} of ${total} · group ${groupId}`;
}

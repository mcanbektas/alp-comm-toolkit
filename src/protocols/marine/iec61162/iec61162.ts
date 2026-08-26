/**
 * IEC 61162 — gemi seyir ve telsiz cihazları arasındaki sayısal arayüz ailesi
 * (Faz 10, dalga 16c). **`marine-navigation` domain'ini kapatan kayıt.**
 *
 * ── BU KAYIT `uavcan-compatibility` DEĞİL: KEŞİF HİPOTEZİ ÇÜRÜDÜ ───────────
 * Dalga 16 keşif turunun açık hipotezi şuydu: *"IEC 61162 NMEA'nin standart
 * çatısıdır, kendi teli yoktur; `uavcan-compatibility` (15b) emsali geçerli —
 * sınıflandırıcı parser + `canParse` DAİMA `false`."* **ÇÜRÜDÜ.** Beş
 * profilden **biri (-450) kendi tel biçimini taşıyor** ve o tel BEŞ bağımsız
 * açık kaynak uygulamasında birebir aynı `[KANIT]`:
 *   · FKIE `maritime-dissector`, `maritime-modules/heuristic.lua:85-88`
 *     (`if potential_proto_token ~= "UdPbC" then return false end`) ve
 *     `proto/iec61162450nmea.lua:27-33` (`sub_buffer = buffer(6,-1)`,
 *     yorumu: *"remove token from buffer. Necessary since :string() stops at
 *     \0 bytes"* — altıncı baytın NUL olduğunun kanıtı),
 *   · `ipal_transcriber`, `transcribers/iec450.py:13`
 *     (`if raw[:6] != b"UdPbC\x00" or raw[-2:] != b"\r\n":`),
 *   · `PyLWE`, `src/pylwe/parser.py:60-63` + `generator.py:54`,
 *   · `gosk`, `writer/lwe.go:158`,
 *   · `EsDemo`, `common_library/udp/udp_61162_450.cpp:93,118-120`.
 * Üç gerçek yakalama (`maritime-dissector/tests/*.pcap`) bu dalgada doğrudan
 * indirildi, UDP payload'ları çıkarıldı ve **her iki checksum'ı da bağımsız
 * yeniden hesaplandı**; üçü de `exampleFrames` olarak buradadır.
 *
 * → `canParse` **`true` DÖNER.** Altı baytlık sabit önek deponun en temiz
 * imzasıdır: ana brif TAM registry üzerinde ölçtü (870 örnek) ve çakışma
 * **SIFIR** çıktı. Bekçi `iec61162CanParseRegistry.test.ts` ölçümü kodda
 * TEKRARLAR — `seatalk`/`hdlc-based-marine`in "daima `false`" kararı burada
 * geçerli DEĞİL çünkü bu kaydın kendi teli VAR.
 *
 * ── EN İNCELİKLİ NOKTA: AYNI DATAGRAMDA İKİ CHECKSUM, İKİ FARKLI ARALIK ────
 *   TAG bloğu `\s:HE0001*45\`       → XOR(`s:HE0001`)        = 0x45   (`\`…`*`)
 *   Cümle     `$HEROT,+000.05,A*35` → XOR(`HEROT,+000.05,A`) = 0x35   (`$`…`*`)
 * **Algoritma AYNI (NMEA XOR), kapsam FARKLI.** İkisini tek bir "cümleyi bul,
 * checksum'ını doğrula" fonksiyonuyla çözmek TAG bloğunu ya atlar ya YANLIŞ
 * aralıkta hesaplar — ve yanlış aralık HATA VERMEDEN yanlış bir PASS/FAIL
 * basar. Bu dosyada iki aralık iki AYRI yerde yaşar: TAG aralığı
 * `lweTagBlock.ts`te (`splitTagBlock`), cümle aralığı burada
 * (`splitLwePayloadSentence`). İkisi birbirini hiç çağırmaz ve
 * `tag-checksum-corrupt`/`sentence-checksum-corrupt` örnekleri bunu ekranda
 * kanıtlar: biri FAIL olurken diğeri PASS kalır.
 *
 * **`parseNmeaSentence` (nmeaChecksum.ts) KULLANILMAZ** — `$` başlangıcını
 * SABİT varsayıyor; TAG bloğu `\` ile, kapsülleme cümlesi `!` ile başlıyor.
 * `ais.ts:10-20` birebir aynı durumu yaşamış ve aynı kararı yazmıştır:
 * *"checksum ALGORİTMASI `nmeaChecksum.ts`teki `nmeaXorChecksum`/
 * `formatNmeaChecksum` ile hesaplanır… Yalnız cümle sınırlayıcılarını bulan
 * küçük fonksiyon burada YENİDEN yazıldı."* `nmeaChecksum.ts`e DOKUNULMAZ:
 * dört tüketicisi var (`nmea0183.ts`, `ais.ts`, `algorithmCatalogue.ts`,
 * `CrcCalculatorTool.tsx`).
 *
 * ── ÇOK-NOKTAYA-YAYIN GRUBU PAYLOAD'DA YOKTUR — VE `g:` O DEĞİLDİR ─────────
 * Girdi TEK bir UDP payload'ıdır (`coap.ts`/`sacn.ts` emsali); **UDP/IP
 * başlığı parser'a GİRMEZ.** Bunun sonucu: veri kategorisini belirleyen
 * transmission group (madde 3.24: *"a pair of a multicast address and a port
 * number"*) baytlarda HİÇ YOKTUR. `mil-std-1553`ün "sözcük tipi çerçevede
 * yok" (15g) ve `io-link`in `messageSide`i (13h) ile aynı sınıf.
 *
 * **Tuzak:** TAG bloğunun `g:` parametresi bu grup DEĞİLDİR. `g:` tek bir
 * mantıksal mesajın birden çok cümleye bölünmesini anlatır
 * (`sentence-total-groupid`); transmission group ise ağ katmanındadır. İkisini
 * karıştırmak bu kaydın en kolay sessiz hatasıdır.
 *
 * → `transmissionGroup` seçeneği. Seçilmezse (varsayılan `unknown`) grup alanı
 * **HİÇ BASILMAZ** — `mode-s`in DF'e göre CRC alanını hiç basmaması (15h)
 * emsali; yalnız bilginin nerede olduğunu söyleyen bir uyarı düşer. Seçilirse
 * KOŞULSUZ `groupFromUserNotWire` uyarısı basılır.
 *
 * **[BRİFTE YAZMAYAN KARAR]** Brif "grup adı ve anlamsal kategori basılır"
 * diyordu. Kategorinin DÜZ METİN açıklaması standardın Tablo 4'ündedir ve o
 * tablo paywall arkasında; ikinci elden aktarılmış bir cümleyi "standardın
 * tanımı" diye basmak dalga 13 dersi 5'in (uydurma kaynak) tam hedefidir.
 * Onun yerine **iki bağımsız kaynakta birebir örtüşen TALKER KÜMESİ** basılır
 * (`codekilo/nmea0183-iec61121-450-server/transmissiongroups.json` ve
 * `gosk/writer/lwe.go`in `talkerMulticastMap`i — ikisi de 2026-08-26'da
 * indirildi ve adres/port/talker üçlüsünde birebir aynı). Bu, düz metinden
 * DAHA iyidir çünkü ÖLÇÜLEBİLİR: motor datagramdaki gerçek talker ID'lerini
 * seçilen grubun kümesiyle karşılaştırır ve uyuşmazsa `groupTalkerMismatch`
 * basar — kullanıcının iddiası tel üzerindeki veriyle SINANMIŞ olur.
 *
 * ### `[KAYNAK ANOMALİSİ]` port 60104
 * FKIE'nin gerçek çoklu-cümle yakalaması `192.168.31.1:43339 →
 * 239.192.0.4:60104` hedefliyor — **doğru NAVD adresi ama port 60004 değil,
 * 60104** (bu dalgada pcap indirilip yeniden doğrulandı). Vendor sapması mı
 * testbed konvansiyonu mu ÇÖZÜLEMEDİ. Sonuç: **motor porta GÜVENMEZ**; zaten
 * UDP başlığını hiç görmez.
 *
 * ### `[COULD NOT VERIFY]` — yeniden "keşfedilmesin" diye yazılı
 * · **Port 60101 — hiçbir yerde kanıt YOK, YANLIŞ kabul et** (muhtemelen
 *   yukarıdaki 60104 anomalisinin folkloru).
 * · **60011-60014 ayrı bir aralık DEĞİL** — Tablo 4'te USR3-USR6'dır.
 * · **`239.192.76.x` — sıfır bulgu, muhtemelen yanlış.**
 * · **"239.192.0.5-8 -460 içindir" YANLIŞ** — onlar -450'nin VDRD/RCOM/TIME/
 *   PROP'u; -460 kendi adresi TANIMLAMAZ.
 * · **`UdPbB` diye bir token YOKTUR** — tek `UdPb*` token'ı `UdPbC`dir.
 *
 * ── KAPSAM DIŞI (kullanıcı kararı, 2026-08-26) ────────────────────────────
 * Bu kayıt **`UdPbC`-only** çözer ve rozeti `partial`dir. AÇIKÇA kapsam dışı:
 *   · **`RaUdP`/`RpUdP`/`RrUdP` binary dosya transferi** — `-450`nin İKİNCİ,
 *     tamamen ayrı teli (38 baytlık big-endian başlık, parça birleştirme,
 *     MIME'lı dosya tanımlayıcı). Token üçlüsü `heuristic.lua:109`da.
 *     Motor bu öneki TANIR ve "kapsam dışı" diye AÇIKÇA reddeder — sessizce
 *     "geçersiz sihirli sayı" demez. Yazılmama gerekçesi `[Karar 15h-1]`in
 *     aynısı: domain'i kapatan alt dalgada ikinci bir motor riski artırır;
 *     ayrıca üç token arasındaki anlam farkı kamuya açık DEĞİL (FKIE yalnız
 *     *"message type and transfer mode"* diyor) ve parça birleştirme
 *     ÇERÇEVELER ARASI durumdur (`mavlink.ts`in SEQ-LOSS kararı).
 *   · **Ed.2 §7.4 IEC 61162-3 PGN kapsüllemesi** — beş karakterlik token
 *     bilinmiyor, kamuya açık uygulama yok.
 *   · **Ed.2 §7.6 TCP tabanlı dosya transferi** — ayrı taşıyıcı.
 *   · **`a:` authentication tag'inin İÇERİĞİ** — varlığı doğrulandı, biçimi
 *     kamuya açık DEĞİL. TAG çözücüsü onu TANIR, içeriğini ÇÖZMEZ
 *     (`authTagNotDecoded`). **Yeni kripto yüzeyi AÇILMAZ.**
 *   · **`-460` güvenlik/artıklık katmanı** — Scope'u birebir: *"It does not
 *     introduce new application level protocol requirements to those that are
 *     defined in IEC 61162-450."* Yönlendirme görünümünde anlatılır.
 * Emsal: `ads-b` 1090ES-only, `iec-61850` GOOSE-only, `cc-link-ie`
 * 0x890F-only, `foundation-fieldbus` HSE-only.
 *
 * ── YÖNLENDİRME GÖRÜNÜMÜ — `-1`/`-2`/`-3`/`-460` ─────────────────────────
 * `transportProfile` `450-udpbc` DIŞINDA bir şıkka çevrilirse motor **çerçeve
 * ÇÖZMEZ**; `uavcanCompatibility.ts`in aday tablosu biçiminde bir yönlendirme
 * tablosu basar ve kullanıcıyı kaydı GERÇEKTEN çözen sayfaya yollar
 * (`ipv4.ts`in "üst katmanı şu sayfada çöz" deseni). `canParse` bundan
 * ETKİLENMEZ — `ProtocolParser` sözleşmesinde `canParse` `decodeOptions`
 * almaz ve her zaman `UdPbC` önekine bakar.
 *
 * Yönlendirme tablosunun hiçbir satırı `unit` TAŞIMAZ — "4800 bit/s"
 * belgelenmiş bir varsayılandır, bu çerçeveden ÖLÇÜLMÜŞ bir değer değildir
 * (`types.ts:46`).
 *
 * ── 82 KARAKTER SINIRI DATAGRAMA DEĞİL, CÜMLEYE AİTTİR ────────────────────
 * `NMEA_0183_MAX_SENTENCE_LENGTH = 82` **tek bir cümle** içindir. Bir -450
 * datagramı sekiz cümle taşıyabiliyor (gerçek yakalama, 568 bayt). Sınırı
 * datagrama uygulamak geçerli trafiği reddederdi. Datagramın kendi sınırı
 * ayrıdır: **1472 bayt**, standardın KENDİ yazarlarından (Rødseth,
 * Christensen & Lee — IEC TC80/WG6, ISIS 2011 §5.3): *"The message length is
 * limited to 1472 bytes (the maximum size of the UDP payload in a single
 * Ethernet frame)…"*. Aşılırsa uyarı basılır, HATA değil.
 *
 * ── `c:`İN ÖLÇEĞİ ÇIKARIMDIR, ÖLÇÜM DEĞİL ────────────────────────────────
 * Gerçek yakalamada `c:1683881316755` (13 hane, ms), gpsd'nin örneğinde
 * `c:1241544035` (10 hane, s). Hane sayısından çıkarım yapılır ve
 * `timestampScaleInferred` basılır; **`unit` ATANMAZ** — çıkarılmış bir ölçek
 * gerçek bir ölçüm değildir. Kullanıcı biliyorsa `timestampScale` seçeneğiyle
 * ZORLAYABİLİR (o zaman uyarı yerine "kullanıcı bildirdi" notu düşer).
 *
 * ── ÇOKLU CÜMLE DÜZ ALAN TABLOSUNA NASIL SIĞAR ───────────────────────────
 * `ParsedFrame` DÜZDÜR, `children` YOKTUR (kilitli sözleşme). Sekiz cümlelik
 * bir datagramda hiyerarşi **alan ADLARIYLA** kurulur (12g'nin RTCP çözümü):
 * `TAG 1.1 · Source`, `Sentence 1 · Talker ID`, `TAG 2.1 · Source`, …
 * **`ParsedField.id` çakışması gerçek bir risktir** (`ftp.ts`/`rtcp.ts`
 * vakaları, 15h'te tekrar yaşandı): id'ye offset DEĞİL **sıra numarası** girer
 * ve üstüne `uniqueFieldId` bir Set ile yapısal olarak benzersizliği garanti
 * eder — aynı TAG bloğunda aynı harf iki kez geçse bile.
 *
 * ── `build` SEKMESİ YOK → `encoder` YAZILMAZ ─────────────────────────────
 * Katalog `tabs`ında `'build'` yok; `'definitions'` de yok, panel sorusu hiç
 * doğmuyor.
 */

import { createRawFrame } from '@/protocol-core/types';
import type {
  DecodeOption,
  ExampleFrame,
  ParseContext,
  ParseResult,
  ParsedField,
  ParsedFrame,
  ProtocolError,
  ProtocolParser,
  ProtocolPlugin,
  ProtocolWarning,
} from '@/protocol-core/types';

import { NMEA_0183_MAX_SENTENCE_LENGTH, NMEA_0183_MIN_SENTENCE_LENGTH } from '../nmea/nmea0183';
import { decodeSentenceFields, getSentenceInfo, splitPayloadTokens } from '../nmea/nmeaSentences';
import {
  CHECKSUM_DELIMITER,
  TAG_BLOCK_DELIMITER,
  describeSentenceGrouping,
  inferTimestampScale,
  splitTagBlock,
} from './lweTagBlock';
import type { LweTagBlock } from './lweTagBlock';

/** Kayıt defterindeki ve katalogdaki kimlikle AYNI olmak zorunda: bağ bu string. */
const PROTOCOL_ID = 'iec-61162';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md); katalog kaydıyla birebir aynı. */
const PROTOCOL_DISPLAY_NAME = 'IEC 61162';

const TRANSLATION_KEY_PREFIX = 'protocol.iec61162';

const ERROR_ABORTED = `${TRANSLATION_KEY_PREFIX}.error.aborted`;
const ERROR_EMPTY_DATAGRAM = `${TRANSLATION_KEY_PREFIX}.error.emptyDatagram`;
const ERROR_TOO_SHORT = `${TRANSLATION_KEY_PREFIX}.error.tooShort`;
const ERROR_INVALID_MAGIC = `${TRANSLATION_KEY_PREFIX}.error.invalidMagicToken`;
const ERROR_BINARY_TRANSFER_OUT_OF_SCOPE = `${TRANSLATION_KEY_PREFIX}.error.binaryTransferOutOfScope`;
const ERROR_NO_SENTENCE = `${TRANSLATION_KEY_PREFIX}.error.noSentence`;
const ERROR_UNTERMINATED_TAG_BLOCK = `${TRANSLATION_KEY_PREFIX}.error.unterminatedTagBlock`;
const ERROR_MISSING_TAG_BLOCK = `${TRANSLATION_KEY_PREFIX}.error.missingTagBlock`;
const ERROR_MISSING_SENTENCE_CHECKSUM = `${TRANSLATION_KEY_PREFIX}.error.missingSentenceChecksum`;
const ERROR_TAG_CHECKSUM_MISMATCH = `${TRANSLATION_KEY_PREFIX}.error.tagChecksumMismatch`;
const ERROR_SENTENCE_CHECKSUM_MISMATCH = `${TRANSLATION_KEY_PREFIX}.error.sentenceChecksumMismatch`;
const ERROR_MISSING_TERMINATOR = `${TRANSLATION_KEY_PREFIX}.error.missingTerminator`;

const WARN_FRAME_NOT_DECODED_IN_ROUTING_PROFILE = `${TRANSLATION_KEY_PREFIX}.warning.frameNotDecodedInRoutingProfile`;
const WARN_GROUP_FROM_USER_NOT_WIRE = `${TRANSLATION_KEY_PREFIX}.warning.groupFromUserNotWire`;
const WARN_GROUP_TALKER_MISMATCH = `${TRANSLATION_KEY_PREFIX}.warning.groupTalkerMismatch`;
const WARN_TRANSMISSION_GROUP_UNKNOWN = `${TRANSLATION_KEY_PREFIX}.warning.transmissionGroupUnknown`;
const WARN_DATAGRAM_EXCEEDS_STANDARD_LIMIT = `${TRANSLATION_KEY_PREFIX}.warning.datagramExceedsStandardLimit`;
const WARN_TIMESTAMP_SCALE_INFERRED = `${TRANSLATION_KEY_PREFIX}.warning.timestampScaleInferred`;
const WARN_TIMESTAMP_SCALE_UNKNOWN = `${TRANSLATION_KEY_PREFIX}.warning.timestampScaleUnknown`;
const WARN_AUTH_TAG_NOT_DECODED = `${TRANSLATION_KEY_PREFIX}.warning.authTagNotDecoded`;
const WARN_TAG_BLOCK_MISSING = `${TRANSLATION_KEY_PREFIX}.warning.tagBlockMissing`;
const WARN_SOURCE_PARAMETER_MISSING = `${TRANSLATION_KEY_PREFIX}.warning.sourceParameterMissing`;
const WARN_TAG_BLOCK_EXCEEDS_MAX_LENGTH = `${TRANSLATION_KEY_PREFIX}.warning.tagBlockExceedsMaxLength`;
const WARN_UNKNOWN_TAG_PARAMETER = `${TRANSLATION_KEY_PREFIX}.warning.unknownTagParameter`;
const WARN_ENCAPSULATION_SENTENCE = `${TRANSLATION_KEY_PREFIX}.warning.encapsulationSentence`;
const WARN_SENTENCE_ENVELOPE_ONLY = `${TRANSLATION_KEY_PREFIX}.warning.sentenceEnvelopeOnly`;
const WARN_SENTENCE_EXCEEDS_NMEA_LIMIT = `${TRANSLATION_KEY_PREFIX}.warning.sentenceExceedsNmeaLimit`;
const WARN_MISSING_TERMINATOR = `${TRANSLATION_KEY_PREFIX}.warning.missingTerminator`;

const FIELD_WARN_CHECKSUM_MISMATCH = `${TRANSLATION_KEY_PREFIX}.field.checksumMismatch`;
const FIELD_WARN_TIMESTAMP_SCALE_INFERRED = `${TRANSLATION_KEY_PREFIX}.field.timestampScaleInferred`;
const FIELD_WARN_TIMESTAMP_SCALE_UNKNOWN = `${TRANSLATION_KEY_PREFIX}.field.timestampScaleUnknown`;
const FIELD_WARN_AUTH_NOT_DECODED = `${TRANSLATION_KEY_PREFIX}.field.authNotDecoded`;
const FIELD_WARN_UNKNOWN_PARAMETER = `${TRANSLATION_KEY_PREFIX}.field.unknownParameter`;
const FIELD_WARN_GROUP_FROM_USER_NOT_WIRE = `${TRANSLATION_KEY_PREFIX}.field.groupFromUserNotWire`;
const FIELD_WARN_SENTENCE_NOT_DECODED = `${TRANSLATION_KEY_PREFIX}.field.sentenceNotDecoded`;
const FIELD_WARN_TAG_BLOCK_TOO_LONG = `${TRANSLATION_KEY_PREFIX}.field.tagBlockTooLong`;

/** `55 64 50 62 43 00` = `"UdPbC"` + NUL. Altı bayt, sabit, beş uygulamada aynı. */
export const LWE_MAGIC_TOKEN = Uint8Array.from([0x55, 0x64, 0x50, 0x62, 0x43, 0x00]);
const MAGIC_TOKEN_LENGTH = LWE_MAGIC_TOKEN.length;

/** `-450`nin İKİNCİ teli — TANINIR, çözülmez (`heuristic.lua:109`). */
const BINARY_TRANSFER_TOKENS = ['RaUdP', 'RpUdP', 'RrUdP'] as const;

const SENTENCE_START_STANDARD = '$';
const SENTENCE_START_ENCAPSULATION = '!';
const TERMINATOR = '\r\n';
const TERMINATOR_LENGTH = TERMINATOR.length;
const CHECKSUM_HEX_LENGTH = 2;
const TALKER_LENGTH = 2;

/** ISIS 2011 §5.3 — standardın kendi yazarlarının sınırı. */
const DEFAULT_MAX_DATAGRAM_BYTES = 1472;
const MIN_DATAGRAM_BYTES_OPTION = 32;
const MAX_DATAGRAM_BYTES_OPTION = 65507;

const HEX_PAIR_PATTERN = /^[0-9A-Fa-f]{2}$/;

// ── Transmission group tablosu ─────────────────────────────────────────────
// Adres/port üçüncü kez doğrulandı (2026-08-26, ikisi de doğrudan indirildi):
// `codekilo/nmea0183-iec61121-450-server/transmissiongroups.json` ve
// `gosk/writer/lwe.go:14-45`. `EsDemo/…/udp_61162_450.cpp:64` aynı tabloyu
// FORMÜLLE üretiyor: `udpIp = "239.192.0." + (nGroupIndex+1); udpPort =
// 60001 + nGroupIndex`. Talker kümeleri iki kaynakta birebir örtüşüyor.
// `239.192.0.0/14` IANA "Organization-Local Scope"tur (RFC 2365).

interface TransmissionGroup {
  readonly id: string;
  readonly address: string;
  readonly port: number;
  /** İki bağımsız kaynakta teyitli talker ID kümesi; boşsa kaynaklar da boş. */
  readonly talkers: readonly string[];
}

const TRANSMISSION_GROUP_UNKNOWN = 'unknown';

const TRANSMISSION_GROUPS: readonly TransmissionGroup[] = [
  {
    id: 'MISC',
    address: '239.192.0.1',
    port: 60001,
    talkers: ['BI', 'DU', 'ER', 'II', 'NL', 'RC', 'SG', 'SS', 'UP', 'U0', 'U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U8', 'U9', 'VR', 'YX', 'SI'],
  },
  { id: 'TGTD', address: '239.192.0.2', port: 60002, talkers: ['AI', 'RA'] },
  { id: 'SATD', address: '239.192.0.3', port: 60003, talkers: ['HE', 'HN', 'TI'] },
  {
    id: 'NAVD',
    address: '239.192.0.4',
    port: 60004,
    talkers: ['AG', 'AP', 'DF', 'EC', 'EI', 'GA', 'GP', 'GL', 'GN', 'HC', 'HF', 'IN', 'LC', 'SD', 'SN', 'VD', 'VM', 'VW', 'WI'],
  },
  {
    id: 'VDRD',
    address: '239.192.0.5',
    port: 60005,
    talkers: ['BN', 'FD', 'FE', 'FR', 'FS', 'HD', 'HS', 'WD', 'WL'],
  },
  { id: 'RCOM', address: '239.192.0.6', port: 60006, talkers: ['CD', 'CR', 'CS', 'CT', 'CV', 'CX', 'EP'] },
  { id: 'TIME', address: '239.192.0.7', port: 60007, talkers: ['ZA', 'ZC', 'ZQ', 'ZV'] },
  { id: 'PROP', address: '239.192.0.8', port: 60008, talkers: [] },
  { id: 'USR1', address: '239.192.0.9', port: 60009, talkers: [] },
  { id: 'USR2', address: '239.192.0.10', port: 60010, talkers: [] },
  { id: 'USR3', address: '239.192.0.11', port: 60011, talkers: [] },
  { id: 'USR4', address: '239.192.0.12', port: 60012, talkers: [] },
  { id: 'USR5', address: '239.192.0.13', port: 60013, talkers: [] },
  { id: 'USR6', address: '239.192.0.14', port: 60014, talkers: [] },
  { id: 'USR7', address: '239.192.0.15', port: 60015, talkers: [] },
  { id: 'USR8', address: '239.192.0.16', port: 60016, talkers: [] },
];

const TRANSMISSION_GROUPS_BY_ID = new Map(TRANSMISSION_GROUPS.map((group) => [group.id, group]));

// ── Yönlendirme profilleri ────────────────────────────────────────────────

const PROFILE_450_UDPBC = '450-udpbc';

interface RoutingRow {
  readonly name: string;
  readonly value: string;
}

interface RoutingProfile {
  readonly id: string;
  readonly rows: readonly RoutingRow[];
}

/**
 * `uavcanCompatibility.ts`in aday tablosu biçimi. Değerler PROTOKOL VERİSİDİR
 * (adres, hız, standart adı), çeviriye girmez; çeviriye giren tek metin bu
 * görünümün NEDEN çerçeve çözmediğini söyleyen uyarıdır.
 */
const ROUTING_PROFILES: readonly RoutingProfile[] = [
  {
    id: '61162-1',
    rows: [
      { name: 'Standard', value: 'IEC 61162-1 Ed. 6 (2024)' },
      { name: 'Wire Format', value: 'Printable ASCII sentences — NMEA 0183 itself' },
      { name: 'Talker / Listener Model', value: 'Single talker, multiple listeners' },
      { name: 'Default Data Rate', value: '4800 bit/s (configurable in Ed. 6)' },
      { name: 'Decoder', value: 'marine-navigation/nmea-family/nmea-0183' },
      { name: 'Evidence', value: 'gpsd drivers/driver_nmea0183.c: "Driver for NMEA 0183 protocol, aka IEC 61162-1"' },
    ],
  },
  {
    id: '61162-2',
    rows: [
      { name: 'Standard', value: 'IEC 61162-2 Ed. 2 (2024)' },
      { name: 'Wire Format', value: 'Same sentence format as IEC 61162-1' },
      { name: 'Default Data Rate', value: '38400 bit/s' },
      { name: 'Electrical Layer', value: 'RS-422 (ITU-T V.11)' },
      { name: 'Decoder', value: 'marine-navigation/nmea-family/nmea-0183' },
      {
        name: 'Evidence',
        value:
          'IEC 61162-2:2024 foreword: "the description of the data format protocol has been removed as this information is given in IEC 61162-1"',
      },
    ],
  },
  {
    id: '61162-3',
    rows: [
      { name: 'Standard', value: 'IEC 61162-3' },
      { name: 'Wire Format', value: 'CAN-based instrument network — NMEA 2000' },
      { name: 'Decoder', value: 'marine-navigation/nmea-family/nmea-2000' },
      {
        name: 'Evidence',
        value: 'Wireshark epan/dissectors/packet-nmea2000.c: "standardized as IEC 61162-3" / "Relies on the J1939 dissector"',
      },
    ],
  },
  {
    id: '61162-460',
    rows: [
      { name: 'Standard', value: 'IEC 61162-460 Ed. 1 (2024)' },
      { name: 'Wire Format', value: 'None of its own — safety and redundancy profile over IEC 61162-450' },
      {
        name: 'Node Classes',
        value: '450-Node, 460-Node, 460-Switch, 460-Forwarder, 460-Gateway, 460-Wireless-gateway',
      },
      { name: 'Prioritisation', value: 'CoS / DSCP marking on the same multicast transport' },
      { name: 'Decoder', value: 'This page, "IEC 61162-450 (UdPbC)" transport profile' },
      {
        name: 'Evidence',
        value:
          'IEC 61162-460 Ed. 1 Scope: "It does not introduce new application level protocol requirements to those that are defined in IEC 61162-450."',
      },
    ],
  },
];

const ROUTING_PROFILES_BY_ID = new Map(ROUTING_PROFILES.map((profile) => [profile.id, profile]));

// ── decodeOptions — YEDİ kanal ────────────────────────────────────────────
// Brif BEŞ öngörmüştü; dalga 15'in dersi gereği sayı BÜYÜDÜ. Eklenen ikisi ve
// gerekçeleri:
//   · `timestampScale` — brifin kendi "görünen adaylar" listesindeydi. `c:`in
//     ölçeği ÇERÇEVEDE YOK; hane sayısı ayrım vermiyorsa (10/13 dışında) motor
//     hiçbir şey iddia edemez, ama kullanıcı vendor'unu biliyor olabilir.
//     `mil-std-1553`ün `wordType`ıyla aynı sınıf.
//   · `strictTerminator` — brifin `trailingCrlfRequired`i. ÜÇ kaynak İKİYE
//     BÖLÜNÜYOR: `ipal_transcriber` CRLF'i ŞART koşuyor (`raw[-2:] != b"\r\n"`
//     → reddet) ve FKIE'nin regex'i de öyle, ama PyLWE `rstrip("\r\n")` ile
//     yokluğuna razı. Varsayılan PERMİSİF (`false`): CRLF'siz datagram TAM
//     çözülebiliyorken reddetmek geçerli trafiği atmak olurdu; katı davranış
//     isteyen açar. `ppp.ts`in ACFC varsayımıyla aynı desen.

const OPTION_TRANSPORT_PROFILE = 'transportProfile';
const OPTION_TRANSMISSION_GROUP = 'transmissionGroup';
const OPTION_SENTENCE_DECODING = 'sentenceDecoding';
const OPTION_REQUIRE_TAG_BLOCK = 'requireTagBlock';
const OPTION_MAX_DATAGRAM_BYTES = 'maxDatagramBytes';
const OPTION_TIMESTAMP_SCALE = 'timestampScale';
const OPTION_STRICT_TERMINATOR = 'strictTerminator';

const SENTENCE_DECODING_ENVELOPE_ONLY = 'envelope-only';
const SENTENCE_DECODING_FULL = 'full';

const TIMESTAMP_SCALE_INFER = 'infer';
const TIMESTAMP_SCALE_SECONDS = 'seconds';
const TIMESTAMP_SCALE_MILLISECONDS = 'milliseconds';

const BOOLEAN_TRUE = 'true';
const BOOLEAN_FALSE = 'false';

const BOOLEAN_CHOICES = [
  { value: BOOLEAN_TRUE, label: `${TRANSLATION_KEY_PREFIX}.option.boolean.on` },
  { value: BOOLEAN_FALSE, label: `${TRANSLATION_KEY_PREFIX}.option.boolean.off` },
] as const;

const DECODE_OPTIONS: readonly DecodeOption[] = [
  {
    id: OPTION_TRANSPORT_PROFILE,
    label: `${TRANSLATION_KEY_PREFIX}.option.transportProfile`,
    kind: 'select',
    defaultValue: PROFILE_450_UDPBC,
    description: `${TRANSLATION_KEY_PREFIX}.option.transportProfile.description`,
    choices: [
      { value: PROFILE_450_UDPBC, label: 'IEC 61162-450 (UdPbC)' },
      { value: '61162-1', label: 'IEC 61162-1' },
      { value: '61162-2', label: 'IEC 61162-2' },
      { value: '61162-3', label: 'IEC 61162-3' },
      { value: '61162-460', label: 'IEC 61162-460' },
    ],
  },
  {
    id: OPTION_TRANSMISSION_GROUP,
    label: `${TRANSLATION_KEY_PREFIX}.option.transmissionGroup`,
    kind: 'select',
    defaultValue: TRANSMISSION_GROUP_UNKNOWN,
    description: `${TRANSLATION_KEY_PREFIX}.option.transmissionGroup.description`,
    choices: [
      {
        value: TRANSMISSION_GROUP_UNKNOWN,
        label: `${TRANSLATION_KEY_PREFIX}.option.transmissionGroup.unknown`,
      },
      // Grup adları ve adresleri VERİDİR, çeviriye girmez (CLAUDE.md).
      ...TRANSMISSION_GROUPS.map((group) => ({
        value: group.id,
        label: `${group.id} — ${group.address}:${String(group.port)}`,
      })),
    ],
  },
  {
    id: OPTION_SENTENCE_DECODING,
    label: `${TRANSLATION_KEY_PREFIX}.option.sentenceDecoding`,
    kind: 'select',
    defaultValue: SENTENCE_DECODING_ENVELOPE_ONLY,
    description: `${TRANSLATION_KEY_PREFIX}.option.sentenceDecoding.description`,
    choices: [
      {
        value: SENTENCE_DECODING_ENVELOPE_ONLY,
        label: `${TRANSLATION_KEY_PREFIX}.option.sentenceDecoding.envelopeOnly`,
      },
      { value: SENTENCE_DECODING_FULL, label: `${TRANSLATION_KEY_PREFIX}.option.sentenceDecoding.full` },
    ],
  },
  {
    id: OPTION_REQUIRE_TAG_BLOCK,
    label: `${TRANSLATION_KEY_PREFIX}.option.requireTagBlock`,
    kind: 'select',
    defaultValue: BOOLEAN_TRUE,
    description: `${TRANSLATION_KEY_PREFIX}.option.requireTagBlock.description`,
    choices: BOOLEAN_CHOICES,
  },
  {
    id: OPTION_STRICT_TERMINATOR,
    label: `${TRANSLATION_KEY_PREFIX}.option.strictTerminator`,
    kind: 'select',
    defaultValue: BOOLEAN_FALSE,
    description: `${TRANSLATION_KEY_PREFIX}.option.strictTerminator.description`,
    choices: BOOLEAN_CHOICES,
  },
  {
    id: OPTION_TIMESTAMP_SCALE,
    label: `${TRANSLATION_KEY_PREFIX}.option.timestampScale`,
    kind: 'select',
    defaultValue: TIMESTAMP_SCALE_INFER,
    description: `${TRANSLATION_KEY_PREFIX}.option.timestampScale.description`,
    choices: [
      { value: TIMESTAMP_SCALE_INFER, label: `${TRANSLATION_KEY_PREFIX}.option.timestampScale.infer` },
      { value: TIMESTAMP_SCALE_SECONDS, label: `${TRANSLATION_KEY_PREFIX}.option.timestampScale.seconds` },
      {
        value: TIMESTAMP_SCALE_MILLISECONDS,
        label: `${TRANSLATION_KEY_PREFIX}.option.timestampScale.milliseconds`,
      },
    ],
  },
  {
    id: OPTION_MAX_DATAGRAM_BYTES,
    label: `${TRANSLATION_KEY_PREFIX}.option.maxDatagramBytes`,
    kind: 'number',
    defaultValue: DEFAULT_MAX_DATAGRAM_BYTES,
    min: MIN_DATAGRAM_BYTES_OPTION,
    max: MAX_DATAGRAM_BYTES_OPTION,
    description: `${TRANSLATION_KEY_PREFIX}.option.maxDatagramBytes.description`,
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

function readBoolean(
  options: Record<string, unknown> | undefined,
  optionId: string,
  fallback: boolean,
): boolean {
  return readSelect(options, optionId, fallback ? BOOLEAN_TRUE : BOOLEAN_FALSE) === BOOLEAN_TRUE;
}

/**
 * Panel her tuş vuruşunda `parse` çağırıyor; yarım/bozuk sayı yüzünden çözümün
 * tamamen kaybolması kullanıcıyı ekranda kör bırakır (`psi5.ts`in gerekçesi).
 */
function readClampedNumber(
  options: Record<string, unknown> | undefined,
  optionId: string,
  min: number,
  max: number,
  fallback: number,
): number {
  const raw = options?.[optionId];
  const value = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

// ── Yardımcılar ───────────────────────────────────────────────────────────

function toProtocolWarning(
  code: string,
  message: string,
  offset?: number,
  length?: number,
): ProtocolWarning {
  return {
    code,
    message,
    ...(offset === undefined ? {} : { offset }),
    ...(length === undefined ? {} : { length }),
  };
}

/**
 * Bayt → karakter, `String.fromCharCode` ile birebir (`nmea0183.ts`in ASCII
 * tuzağı notu): `TextDecoder` çok baytlı girdide karakter indeksi ile bayt
 * ofseti eşleşmesini bozardı ve bu motorun TÜM ofsetleri o eşleşmeye dayanıyor.
 */
function bytesToAsciiString(data: Uint8Array): string {
  let text = '';
  for (let index = 0; index < data.length; index += 1) {
    text += String.fromCharCode(data[index] ?? 0);
  }
  return text;
}

/** Örnek çerçeveler için ters yön. */
function asciiToBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    bytes[index] = text.charCodeAt(index) & 0xff;
  }
  return bytes;
}

function hasMagicToken(data: Uint8Array): boolean {
  if (data.length < MAGIC_TOKEN_LENGTH) return false;
  for (let index = 0; index < MAGIC_TOKEN_LENGTH; index += 1) {
    if (data[index] !== LWE_MAGIC_TOKEN[index]) return false;
  }
  return true;
}

/** `-450`nin ikinci (binary) teli. TANINIR, ÇÖZÜLMEZ — kapsam dışı. */
function binaryTransferToken(data: Uint8Array): string | undefined {
  if (data.length < MAGIC_TOKEN_LENGTH) return undefined;
  if (data[5] !== 0x00) return undefined;
  const token = bytesToAsciiString(data.subarray(0, MAGIC_TOKEN_LENGTH - 1));
  return (BINARY_TRANSFER_TOKENS as readonly string[]).includes(token) ? token : undefined;
}

// ── Cümle bölücü — TAG bölücüsünden AYRI, kapsamı `$`/`!` … `*` ───────────

interface LweSentence {
  readonly offset: number;
  /** `$`/`!`den checksum'ın son hanesine kadar (CRLF HARİÇ). */
  readonly length: number;
  readonly startChar: string;
  readonly payload: string;
  readonly payloadOffset: number;
  readonly checksumHex: string | undefined;
  readonly checksumOffset: number | undefined;
  readonly calculatedChecksum: string;
  readonly checksumValid: boolean;
  readonly hasTerminator: boolean;
  /** Bir sonraki kaydın başladığı ofset (terminatör varsa ondan sonrası). */
  readonly nextOffset: number;
}

/**
 * `parseNmeaSentence` YERİNE yazılmış küçük bölücü — `ais.ts`in
 * `splitAisSentence`i ile aynı gerekçe: `$` başlangıcı SABİT DEĞİL, `!` de
 * kabul edilir (IEC 61162'nin "encapsulation sentence" alt kümesi; bu
 * datagramlar AIS taşıyor).
 *
 * Checksum'ın KAPSAMI `$`/`!` ile `*` ARASIDIR — TAG bloğunun `\`…`*`
 * kapsamıyla KARIŞTIRILMAZ. İki kapsamın iki ayrı fonksiyonda yaşamasının
 * sebebi budur.
 */
export function splitLwePayloadSentence(
  text: string,
  startIndex: number,
  xorChecksum: (payload: string) => string,
): LweSentence | undefined {
  const startChar = text.charAt(startIndex);
  if (startChar !== SENTENCE_START_STANDARD && startChar !== SENTENCE_START_ENCAPSULATION) {
    return undefined;
  }
  // Satır sonu cümlenin ÜST SINIRIDIR: `*` aramasının bir sonraki kaydın
  // checksum'ına taşmasını engeller (çoklu-cümle datagramında gerçek risk).
  let lineEnd = text.length;
  for (let index = startIndex; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code === 0x0d || code === 0x0a) {
      lineEnd = index;
      break;
    }
  }

  const starIndex = text.lastIndexOf(CHECKSUM_DELIMITER, lineEnd - 1);
  const payloadOffset = startIndex + 1;
  if (starIndex < payloadOffset) {
    // Checksum sınırlayıcısı yok: cümle satır sonuna kadar ham kalır.
    const payload = text.slice(payloadOffset, lineEnd);
    const hasTerminator = text.slice(lineEnd, lineEnd + TERMINATOR_LENGTH) === TERMINATOR;
    return {
      offset: startIndex,
      length: lineEnd - startIndex,
      startChar,
      payload,
      payloadOffset,
      checksumHex: undefined,
      checksumOffset: undefined,
      calculatedChecksum: xorChecksum(payload),
      checksumValid: false,
      hasTerminator,
      nextOffset: hasTerminator ? lineEnd + TERMINATOR_LENGTH : lineEnd,
    };
  }

  const payload = text.slice(payloadOffset, starIndex);
  const checksumHex = text.slice(starIndex + 1, starIndex + 1 + CHECKSUM_HEX_LENGTH);
  const sentenceEnd = starIndex + 1 + CHECKSUM_HEX_LENGTH;
  const calculated = xorChecksum(payload);
  const hasTerminator = text.slice(sentenceEnd, sentenceEnd + TERMINATOR_LENGTH) === TERMINATOR;
  return {
    offset: startIndex,
    length: sentenceEnd - startIndex,
    startChar,
    payload,
    payloadOffset,
    checksumHex,
    checksumOffset: starIndex + 1,
    calculatedChecksum: calculated,
    checksumValid: HEX_PAIR_PATTERN.test(checksumHex) && checksumHex.toUpperCase() === calculated,
    hasTerminator,
    nextOffset: hasTerminator ? sentenceEnd + TERMINATOR_LENGTH : sentenceEnd,
  };
}

interface LweRecord {
  readonly tagBlocks: readonly LweTagBlock[];
  readonly sentence: LweSentence;
}

// ── Çözüm ─────────────────────────────────────────────────────────────────

interface FieldSink {
  readonly fields: ParsedField[];
  readonly usedIds: Set<string>;
}

/**
 * `ParsedField.id` çakışması bu kaydın kilitli tuzaklarından biridir (sekiz
 * cümle aynı düz tabloyu paylaşıyor). Sıra numarası ADI zaten benzersizleştirir
 * ama garanti YAPISAL olmalı: aynı TAG bloğunda aynı harf iki kez geçerse
 * (standart yasaklamıyor) sessizce çakışırdı.
 */
function uniqueFieldId(sink: FieldSink, base: string): string {
  if (!sink.usedIds.has(base)) {
    sink.usedIds.add(base);
    return base;
  }
  let suffix = 2;
  while (sink.usedIds.has(`${base}-${String(suffix)}`)) suffix += 1;
  const id = `${base}-${String(suffix)}`;
  sink.usedIds.add(id);
  return id;
}

function pushField(sink: FieldSink, field: ParsedField): void {
  sink.fields.push({ ...field, id: uniqueFieldId(sink, field.id) });
}

function routingProfileResult(
  data: Uint8Array,
  profile: RoutingProfile,
  context: ParseContext | undefined,
): ParseResult {
  const sink: FieldSink = { fields: [], usedIds: new Set() };
  profile.rows.forEach((row, index) => {
    pushField(sink, {
      // Yönlendirme satırları BAYTA karşılık gelmez: sıfır uzunluk, sıfır ofset.
      id: `profile-${profile.id}-${String(index + 1)}`,
      name: row.name,
      offset: 0,
      length: 0,
      rawBytes: new Uint8Array(0),
      physicalValue: row.value,
      valid: true,
      warnings: [],
    });
  });

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
    valid: true,
    errors: [],
    warnings: [
      toProtocolWarning('frameNotDecodedInRoutingProfile', WARN_FRAME_NOT_DECODED_IN_ROUTING_PROFILE),
    ],
  };
  // Hiçbir bayt TÜKETİLMEDİ — bu görünüm çerçeve çözmez, yönlendirir.
  return { success: true, frame, consumedBytes: 0 };
}

function parseIec61162Datagram(data: Uint8Array, context?: ParseContext): ParseResult {
  if (context?.signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'parser-timeout', message: ERROR_ABORTED },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  const options = context?.options;
  const transportProfile = readSelect(options, OPTION_TRANSPORT_PROFILE, PROFILE_450_UDPBC);
  if (transportProfile !== PROFILE_450_UDPBC) {
    const profile = ROUTING_PROFILES_BY_ID.get(transportProfile);
    if (profile !== undefined) {
      return routingProfileResult(data, profile, context);
    }
  }

  if (data.length === 0) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_EMPTY_DATAGRAM, offset: 0, length: 0 },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const binaryToken = binaryTransferToken(data);
  if (binaryToken !== undefined) {
    // TANINIR ama ÇÖZÜLMEZ: "geçersiz sihirli sayı" demek kullanıcıyı yanıltırdı.
    return {
      success: false,
      error: {
        code: 'unsupported-encoding',
        message: ERROR_BINARY_TRANSFER_OUT_OF_SCOPE,
        offset: 0,
        length: MAGIC_TOKEN_LENGTH,
        details: { token: binaryToken },
      },
      consumedBytes: 0,
      recoverable: false,
    };
  }

  if (data.length < MAGIC_TOKEN_LENGTH) {
    return {
      success: false,
      error: { code: 'truncated-frame', message: ERROR_TOO_SHORT, offset: 0, length: data.length },
      consumedBytes: 0,
      recoverable: true,
    };
  }
  if (!hasMagicToken(data)) {
    return {
      success: false,
      error: {
        code: 'start-delimiter-not-found',
        message: ERROR_INVALID_MAGIC,
        offset: 0,
        length: MAGIC_TOKEN_LENGTH,
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }

  const sentenceDecoding = readSelect(
    options,
    OPTION_SENTENCE_DECODING,
    SENTENCE_DECODING_ENVELOPE_ONLY,
  );
  const requireTagBlock = readBoolean(options, OPTION_REQUIRE_TAG_BLOCK, true);
  const strictTerminator = readBoolean(options, OPTION_STRICT_TERMINATOR, false);
  const timestampScaleOption = readSelect(options, OPTION_TIMESTAMP_SCALE, TIMESTAMP_SCALE_INFER);
  const maxDatagramBytes = readClampedNumber(
    options,
    OPTION_MAX_DATAGRAM_BYTES,
    MIN_DATAGRAM_BYTES_OPTION,
    MAX_DATAGRAM_BYTES_OPTION,
    DEFAULT_MAX_DATAGRAM_BYTES,
  );
  const groupId = readSelect(options, OPTION_TRANSMISSION_GROUP, TRANSMISSION_GROUP_UNKNOWN);
  const group = TRANSMISSION_GROUPS_BY_ID.get(groupId);

  const text = bytesToAsciiString(data);
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];
  const sink: FieldSink = { fields: [], usedIds: new Set() };

  // Cümlenin checksum'ı için AYNI algoritma, AYRI kapsam (dosya başı).
  const xorChecksum = (payload: string): string => {
    let checksum = 0;
    for (let index = 0; index < payload.length; index += 1) {
      checksum ^= payload.charCodeAt(index);
    }
    return checksum.toString(16).toUpperCase().padStart(CHECKSUM_HEX_LENGTH, '0');
  };

  // ── Kayıtları tara ──────────────────────────────────────────────────────
  const records: LweRecord[] = [];
  let cursor = MAGIC_TOKEN_LENGTH;
  let scanError: ProtocolError | undefined;
  while (cursor < text.length) {
    const tagBlocks: LweTagBlock[] = [];
    while (text.charAt(cursor) === TAG_BLOCK_DELIMITER) {
      const block = splitTagBlock(text, cursor);
      if (block === undefined) {
        scanError = {
          code: 'truncated-frame',
          message: ERROR_UNTERMINATED_TAG_BLOCK,
          offset: cursor,
          length: text.length - cursor,
        };
        break;
      }
      tagBlocks.push(block);
      cursor = block.offset + block.length;
    }
    if (scanError !== undefined) break;

    const sentence = splitLwePayloadSentence(text, cursor, xorChecksum);
    if (sentence === undefined) {
      scanError = {
        code: 'truncated-frame',
        message: ERROR_NO_SENTENCE,
        offset: cursor,
        length: text.length - cursor,
      };
      break;
    }
    records.push({ tagBlocks, sentence });
    if (sentence.nextOffset <= cursor) break; // ilerleme yoksa döngüyü kes
    cursor = sentence.nextOffset;
  }

  if (records.length === 0) {
    return {
      success: false,
      error: scanError ?? {
        code: 'truncated-frame',
        message: ERROR_NO_SENTENCE,
        offset: MAGIC_TOKEN_LENGTH,
        length: Math.max(0, data.length - MAGIC_TOKEN_LENGTH),
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }
  if (requireTagBlock && records.some((record) => record.tagBlocks.length === 0)) {
    // Standart `s:`i ZORUNLU kılıyor; katı mod bunu bir hata sayar.
    return {
      success: false,
      error: {
        code: 'unsupported-encoding',
        message: ERROR_MISSING_TAG_BLOCK,
        offset: MAGIC_TOKEN_LENGTH,
        length: Math.max(0, data.length - MAGIC_TOKEN_LENGTH),
      },
      consumedBytes: 0,
      recoverable: true,
    };
  }
  if (scanError !== undefined) {
    // Kısmi çözüm gösterilir (spec §47) ama çerçeve GEÇERSİZDİR.
    errors.push(scanError);
  }

  // ── Sihirli önek ────────────────────────────────────────────────────────
  pushField(sink, {
    id: 'magic-token',
    name: 'Magic Token',
    offset: 0,
    length: MAGIC_TOKEN_LENGTH,
    rawBytes: data.slice(0, MAGIC_TOKEN_LENGTH),
    rawValue: '55 64 50 62 43 00',
    physicalValue: 'UdPbC + NUL',
    valid: true,
    warnings: [],
  });

  // ── Transmission group — ÇERÇEVEDE YOK, kullanıcıdan gelir ──────────────
  if (group === undefined) {
    warnings.push(toProtocolWarning('transmissionGroupUnknown', WARN_TRANSMISSION_GROUP_UNKNOWN));
  } else {
    pushField(sink, {
      id: 'transmission-group',
      name: 'Transmission Group (from user, NOT on the wire)',
      offset: 0,
      length: 0,
      rawBytes: new Uint8Array(0),
      rawValue: group.id,
      physicalValue: `${group.address}:${String(group.port)}`,
      valid: true,
      warnings: [FIELD_WARN_GROUP_FROM_USER_NOT_WIRE],
    });
    if (group.talkers.length > 0) {
      pushField(sink, {
        id: 'transmission-group-talkers',
        name: 'Transmission Group · Assigned Talkers',
        offset: 0,
        length: 0,
        rawBytes: new Uint8Array(0),
        physicalValue: group.talkers.join(', '),
        valid: true,
        warnings: [FIELD_WARN_GROUP_FROM_USER_NOT_WIRE],
      });
    }
    warnings.push(toProtocolWarning('groupFromUserNotWire', WARN_GROUP_FROM_USER_NOT_WIRE));
  }

  // ── Kayıt kayıt alanlar ────────────────────────────────────────────────
  const observedTalkers = new Set<string>();
  let sawAuthTag = false;
  let sawUnknownParameter = false;
  let sawInferredTimestamp = false;
  let sawUnknownTimestampScale = false;
  let sawTagBlockTooLong = false;
  let sawEncapsulation = false;
  let sawMissingTerminator = false;
  let sawSourceMissing = false;
  let sawOversizedSentence = false;

  records.forEach((record, recordIndex) => {
    const recordNumber = recordIndex + 1;
    let recordHasSource = false;

    record.tagBlocks.forEach((block, blockIndex) => {
      const tagLabel = `TAG ${String(recordNumber)}.${String(blockIndex + 1)}`;
      const idPrefix = `tag-${String(recordNumber)}-${String(blockIndex + 1)}`;

      if (block.exceedsMaxLength) sawTagBlockTooLong = true;

      for (const parameter of block.parameters) {
        if (parameter.letter === 's') recordHasSource = true;
        const info = parameter.info;
        const name =
          info === undefined
            ? `${tagLabel} · ${parameter.letter}: Unknown Parameter`
            : `${tagLabel} · ${parameter.letter}: ${info.name}`;
        const fieldWarnings: string[] = [];
        let physicalValue: string | undefined;

        if (info === undefined) {
          sawUnknownParameter = true;
          fieldWarnings.push(FIELD_WARN_UNKNOWN_PARAMETER);
        } else if (!info.decoded) {
          // `a:` — varlığı doğrulandı, biçimi kamuya açık DEĞİL.
          sawAuthTag = true;
          fieldWarnings.push(FIELD_WARN_AUTH_NOT_DECODED);
        } else if (parameter.letter === 'c') {
          if (timestampScaleOption === TIMESTAMP_SCALE_INFER) {
            const inferred = inferTimestampScale(parameter.value);
            if (inferred === undefined) {
              sawUnknownTimestampScale = true;
              fieldWarnings.push(FIELD_WARN_TIMESTAMP_SCALE_UNKNOWN);
            } else {
              sawInferredTimestamp = true;
              physicalValue = `${inferred.iso} (inferred scale: ${inferred.scale})`;
              fieldWarnings.push(FIELD_WARN_TIMESTAMP_SCALE_INFERRED);
            }
          } else {
            const forced = forceTimestampScale(parameter.value, timestampScaleOption);
            if (forced !== undefined) physicalValue = `${forced} (scale set by user)`;
          }
        } else if (parameter.letter === 'g') {
          // `g:` CÜMLE gruplamasıdır — transmission group DEĞİL (dosya başı).
          physicalValue = describeSentenceGrouping(parameter.value);
        }

        pushField(sink, {
          id: `${idPrefix}-${parameter.letter}`,
          name,
          offset: parameter.offset,
          length: parameter.length,
          rawBytes: data.slice(parameter.offset, parameter.offset + parameter.length),
          rawValue: parameter.value,
          ...(physicalValue === undefined ? {} : { physicalValue }),
          valid: true,
          warnings: fieldWarnings,
        });
      }

      // TAG checksum'ı — kapsamı `\`…`*`, cümleninkiyle KARIŞTIRILMAZ.
      if (block.checksumHex !== undefined && block.checksumOffset !== undefined) {
        pushField(sink, {
          id: `${idPrefix}-checksum`,
          name: `${tagLabel} · Checksum`,
          offset: block.checksumOffset,
          length: block.checksumHex.length,
          rawBytes: data.slice(block.checksumOffset, block.checksumOffset + block.checksumHex.length),
          rawValue: block.checksumHex.toUpperCase(),
          physicalValue: block.checksumValid
            ? `PASS (covers ${String(block.coverageLength)} B)`
            : `FAIL (calculated ${block.calculatedChecksum} over ${String(block.coverageLength)} B)`,
          valid: block.checksumValid,
          warnings: block.checksumValid ? [] : [FIELD_WARN_CHECKSUM_MISMATCH],
        });
        if (!block.checksumValid) {
          errors.push({
            code: 'checksum-mismatch',
            message: ERROR_TAG_CHECKSUM_MISMATCH,
            offset: block.checksumOffset,
            length: block.checksumHex.length,
            details: {
              scope: 'tag-block',
              received: block.checksumHex.toUpperCase(),
              calculated: block.calculatedChecksum,
              coverage: block.coverage,
            },
          });
        }
      }

      if (block.exceedsMaxLength) {
        pushField(sink, {
          id: `${idPrefix}-length`,
          name: `${tagLabel} · Block Length`,
          offset: block.offset,
          length: block.length,
          rawBytes: data.slice(block.offset, block.offset + block.length),
          rawValue: block.contentLength,
          physicalValue: 'exceeds the 80-byte tag block limit',
          valid: false,
          warnings: [FIELD_WARN_TAG_BLOCK_TOO_LONG],
        });
      }
    });

    if (record.tagBlocks.length === 0) {
      sawSourceMissing = true;
    } else if (!recordHasSource) {
      sawSourceMissing = true;
    }

    // ── Cümle ──────────────────────────────────────────────────────────────
    const sentence = record.sentence;
    const sentenceLabel = `Sentence ${String(recordNumber)}`;
    const sentencePrefix = `sentence-${String(recordNumber)}`;
    const isEncapsulation = sentence.startChar === SENTENCE_START_ENCAPSULATION;
    if (isEncapsulation) sawEncapsulation = true;

    pushField(sink, {
      id: `${sentencePrefix}-delimiter`,
      name: `${sentenceLabel} · Start Delimiter`,
      offset: sentence.offset,
      length: 1,
      rawBytes: data.slice(sentence.offset, sentence.offset + 1),
      rawValue: sentence.startChar,
      physicalValue: isEncapsulation ? 'Encapsulation sentence' : 'Standard sentence',
      valid: true,
      warnings: [],
    });

    const tokens = splitPayloadTokens(sentence.payload, sentence.payloadOffset);
    const identifier = tokens[0]?.value ?? '';
    const identifierOffset = tokens[0]?.offset ?? sentence.payloadOffset;
    const talker = identifier.slice(0, TALKER_LENGTH);
    const formatter = identifier.slice(TALKER_LENGTH);
    if (talker.length === TALKER_LENGTH) observedTalkers.add(talker);

    pushField(sink, {
      id: `${sentencePrefix}-talker`,
      name: `${sentenceLabel} · Talker ID`,
      offset: identifierOffset,
      length: Math.min(TALKER_LENGTH, identifier.length),
      rawBytes: data.slice(identifierOffset, identifierOffset + Math.min(TALKER_LENGTH, identifier.length)),
      rawValue: talker,
      valid: talker.length === TALKER_LENGTH,
      warnings: [],
    });

    const formatterOffset = identifierOffset + TALKER_LENGTH;
    const formatterInfo = formatter.length > 0 ? getSentenceInfo(formatter) : undefined;
    pushField(sink, {
      id: `${sentencePrefix}-formatter`,
      name: `${sentenceLabel} · Sentence Formatter`,
      offset: formatterOffset,
      length: formatter.length,
      rawBytes: data.slice(formatterOffset, formatterOffset + formatter.length),
      rawValue: formatter,
      // Cümle adı PROTOKOL VERİSİDİR, çeviriye girmez.
      ...(formatterInfo === undefined ? {} : { physicalValue: formatterInfo.name }),
      valid: formatter.length > 0,
      warnings: [],
    });

    if (sentenceDecoding === SENTENCE_DECODING_FULL && formatter.length > 0) {
      // `nmea0183Parser.parse()` ÇAĞRILMAZ (kendi `ParseResult`unu üretir);
      // alan üreten yardımcı olan `decodeSentenceFields` tüketilir.
      const decoded = decodeSentenceFields(formatter, data, tokens);
      for (const field of decoded.fields) {
        pushField(sink, { ...field, id: `${sentencePrefix}-${field.id}` });
      }
      for (const key of decoded.warnings) {
        warnings.push(toProtocolWarning(key.split('.').pop() ?? key, key));
      }
    } else {
      pushField(sink, {
        id: `${sentencePrefix}-body`,
        name: `${sentenceLabel} · Sentence (raw)`,
        offset: sentence.offset,
        length: sentence.length,
        rawBytes: data.slice(sentence.offset, sentence.offset + sentence.length),
        rawValue: text.slice(sentence.offset, sentence.offset + sentence.length),
        valid: true,
        warnings: [FIELD_WARN_SENTENCE_NOT_DECODED],
      });
    }

    // Cümle checksum'ı — kapsamı `$`/`!`…`*`, TAG'inkiyle KARIŞTIRILMAZ.
    if (sentence.checksumHex === undefined || sentence.checksumOffset === undefined) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_MISSING_SENTENCE_CHECKSUM,
        offset: sentence.offset,
        length: sentence.length,
      });
    } else {
      pushField(sink, {
        id: `${sentencePrefix}-checksum`,
        name: `${sentenceLabel} · Checksum`,
        offset: sentence.checksumOffset,
        length: sentence.checksumHex.length,
        rawBytes: data.slice(
          sentence.checksumOffset,
          sentence.checksumOffset + sentence.checksumHex.length,
        ),
        rawValue: sentence.checksumHex.toUpperCase(),
        physicalValue: sentence.checksumValid
          ? `PASS (covers ${String(sentence.payload.length)} B)`
          : `FAIL (calculated ${sentence.calculatedChecksum} over ${String(sentence.payload.length)} B)`,
        valid: sentence.checksumValid,
        warnings: sentence.checksumValid ? [] : [FIELD_WARN_CHECKSUM_MISMATCH],
      });
      if (!sentence.checksumValid) {
        errors.push({
          code: 'checksum-mismatch',
          message: ERROR_SENTENCE_CHECKSUM_MISMATCH,
          offset: sentence.checksumOffset,
          length: sentence.checksumHex.length,
          details: {
            scope: 'sentence',
            received: sentence.checksumHex.toUpperCase(),
            calculated: sentence.calculatedChecksum,
            coverage: sentence.payload,
          },
        });
      }
    }

    if (sentence.hasTerminator) {
      const terminatorOffset = sentence.offset + sentence.length;
      pushField(sink, {
        id: `${sentencePrefix}-terminator`,
        name: `${sentenceLabel} · Terminator (CR LF)`,
        offset: terminatorOffset,
        length: TERMINATOR_LENGTH,
        rawBytes: data.slice(terminatorOffset, terminatorOffset + TERMINATOR_LENGTH),
        rawValue: '0D 0A',
        valid: true,
        warnings: [],
      });
    } else {
      sawMissingTerminator = true;
    }

    // 82 karakterlik sınır CÜMLEYE aittir, DATAGRAMA değil (dosya başı).
    const sentenceCharacters = sentence.length + (sentence.hasTerminator ? TERMINATOR_LENGTH : 0);
    if (
      sentenceCharacters > NMEA_0183_MAX_SENTENCE_LENGTH ||
      sentenceCharacters < NMEA_0183_MIN_SENTENCE_LENGTH
    ) {
      sawOversizedSentence = true;
    }
  });

  // ── Toplu uyarılar ──────────────────────────────────────────────────────
  if (sentenceDecoding === SENTENCE_DECODING_ENVELOPE_ONLY) {
    warnings.push(toProtocolWarning('sentenceEnvelopeOnly', WARN_SENTENCE_ENVELOPE_ONLY));
  }
  if (sawSourceMissing) {
    warnings.push(toProtocolWarning('sourceParameterMissing', WARN_SOURCE_PARAMETER_MISSING));
  }
  if (records.some((record) => record.tagBlocks.length === 0)) {
    warnings.push(toProtocolWarning('tagBlockMissing', WARN_TAG_BLOCK_MISSING));
  }
  if (sawAuthTag) warnings.push(toProtocolWarning('authTagNotDecoded', WARN_AUTH_TAG_NOT_DECODED));
  if (sawUnknownParameter) {
    warnings.push(toProtocolWarning('unknownTagParameter', WARN_UNKNOWN_TAG_PARAMETER));
  }
  if (sawInferredTimestamp) {
    warnings.push(toProtocolWarning('timestampScaleInferred', WARN_TIMESTAMP_SCALE_INFERRED));
  }
  if (sawUnknownTimestampScale) {
    warnings.push(toProtocolWarning('timestampScaleUnknown', WARN_TIMESTAMP_SCALE_UNKNOWN));
  }
  if (sawTagBlockTooLong) {
    warnings.push(toProtocolWarning('tagBlockExceedsMaxLength', WARN_TAG_BLOCK_EXCEEDS_MAX_LENGTH));
  }
  if (sawEncapsulation) {
    warnings.push(toProtocolWarning('encapsulationSentence', WARN_ENCAPSULATION_SENTENCE));
  }
  if (sawOversizedSentence) {
    warnings.push(toProtocolWarning('sentenceExceedsNmeaLimit', WARN_SENTENCE_EXCEEDS_NMEA_LIMIT));
  }
  if (sawMissingTerminator) {
    if (strictTerminator) {
      errors.push({
        code: 'truncated-frame',
        message: ERROR_MISSING_TERMINATOR,
        offset: Math.max(0, data.length - TERMINATOR_LENGTH),
        length: TERMINATOR_LENGTH,
      });
    } else {
      warnings.push(toProtocolWarning('missingTerminator', WARN_MISSING_TERMINATOR));
    }
  }
  if (data.length > maxDatagramBytes) {
    // ISIS 2011 §5.3 sınırı — UYARIDIR, hata değil: motor yine çözer.
    warnings.push(
      toProtocolWarning(
        'datagramExceedsStandardLimit',
        WARN_DATAGRAM_EXCEEDS_STANDARD_LIMIT,
        maxDatagramBytes,
        data.length - maxDatagramBytes,
      ),
    );
  }
  if (group !== undefined && group.talkers.length > 0 && observedTalkers.size > 0) {
    // Kullanıcının İDDİASI tel üzerindeki veriyle SINANIR (dosya başı).
    const assigned = new Set(group.talkers);
    const foreign = [...observedTalkers].filter((talkerId) => !assigned.has(talkerId));
    if (foreign.length > 0) {
      warnings.push(toProtocolWarning('groupTalkerMismatch', WARN_GROUP_TALKER_MISMATCH));
    }
  }

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

/** `timestampScale` elle zorlandığında ISO metni üretir; çıkarım YAPILMAZ. */
function forceTimestampScale(raw: string, scale: string): string | undefined {
  if (!/^\d+$/.test(raw)) return undefined;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return undefined;
  const milliseconds = scale === TIMESTAMP_SCALE_SECONDS ? value * 1000 : value;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export const iec61162Parser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  /**
   * `true` DÖNER — ve bu ÖLÇÜLMÜŞ bir karardır. Altı baytlık `"UdPbC\0"` öneki
   * sabittir; ana brif TAM registry üzerinde (870 örnek) ölçtü ve çakışma
   * SIFIR çıktı. Bekçi `iec61162CanParseRegistry.test.ts` ölçümü kodda
   * tekrarlar. `decodeOptions` BURAYA GİRMEZ (`ProtocolParser` sözleşmesi):
   * yönlendirme profili seçili olsa bile imza aynı imzadır.
   */
  canParse(data: Uint8Array): boolean {
    return hasMagicToken(data);
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseIec61162Datagram(data, context);
  },
};

// ── Örnekler ──────────────────────────────────────────────────────────────
// İlk üçü FKIE `maritime-dissector`ın GERÇEK `.pcap` yakalamalarıdır: bu
// dalgada doğrudan indirildi, UDP payload'ları çıkarıldı ve her iki checksum'ı
// da bağımsız yeniden hesaplandı. Sonraki ikisi ilk yakalamadan TEK BİR HANE
// bozularak türetildi ve açıklamaları böyle yazar — üretilmiş "gerçek gibi"
// veri YOK. Altıncısı FKIE'nin binary yakalamasının GERÇEK 38 baytlık
// başlığıdır (kapsam dışı telin ekranda görünmesi için).

const SINGLE_SENTENCE_TEXT = 'UdPbC\u0000\\s:HE0001*45\\$HEROT,+000.05,A*35\r\n';
const MULTI_TAG_TEXT = 'UdPbC\u0000\\d:HE0002*51\\\\s:HE0001*45\\$HEROT,+000.05,A*35\r\n';
const MULTI_SENTENCE_TEXT =
  'UdPbC\u0000' +
  '\\s:IN0001,n:881,c:1683881316755*4D\\$INGLL,5416.4774,N,01201.8283,E,084836.75,A,A*7F\r\n' +
  '\\s:IN0001,n:882,c:1683881316755*4E\\$INHCR,,A,V,*49\r\n' +
  '\\s:IN0001,n:883,c:1683881316755*4F\\$INROT,-0.00,A*3C\r\n' +
  '\\s:IN0001,n:884,c:1683881316755*48\\$INVBC,0.0,-0.0,-0.0,-0.0,A,-0.0,-0.0,-0.0,-0.0,A*7D\r\n' +
  '\\s:IN0001,n:885,c:1683881316755*49\\$INVBW,0.0,-0.0,A,-0.0,-0.0,A,-0.0,A,-0.0,A*69\r\n' +
  '\\s:IN0001,n:886,c:1683881316755*4A\\$INVTG,110.9,T,,,0.0,N,,,A*3C\r\n' +
  '\\s:IN0001,n:887,c:1683881316755*4B\\$INVDR,292.6,T,,,0.02,N*60\r\n' +
  '\\s:IN0001,n:888,c:1683881316755*44\\$INOSD,110.9,A,9.0,P,0.0,P,,,N*52\r\n';
/** Aynı datagram, YALNIZ TAG checksum'ının son hanesi bozuk: TAG FAIL, cümle PASS. */
const TAG_CHECKSUM_CORRUPT_TEXT = 'UdPbC\u0000\\s:HE0001*46\\$HEROT,+000.05,A*35\r\n';
/** Aynı datagram, YALNIZ CÜMLE checksum'ının son hanesi bozuk: TAG PASS, cümle FAIL. */
const SENTENCE_CHECKSUM_CORRUPT_TEXT = 'UdPbC\u0000\\s:HE0001*45\\$HEROT,+000.05,A*36\r\n';
/** TAG bloğu HİÇ yok — varsayılan `requireTagBlock: true` bunu reddeder. */
const NO_TAG_BLOCK_TEXT = 'UdPbC\u0000$HEROT,+000.05,A*35\r\n';

/**
 * FKIE `tests/iec-61162-450-binary-type1.pcap`, ikinci datagramın GERÇEK 38
 * baytlık başlığı: token `RrUdP`+NUL, version 2, headerLength 0x0026 = 38,
 * src `EI0001`, dst `VR0001`, msgType 1, blockId 0x00000201 = 513, seq 2,
 * maxSeq 2, device 1, channel 1. Motor bunu TANIR ve KAPSAM DIŞI der.
 */
const BINARY_TRANSFER_HEADER = Uint8Array.from([
  0x52, 0x72, 0x55, 0x64, 0x50, 0x00, 0x00, 0x02, 0x00, 0x26, 0x45, 0x49, 0x30, 0x30, 0x30, 0x31,
  0x56, 0x52, 0x30, 0x30, 0x30, 0x31, 0x00, 0x01, 0x00, 0x00, 0x02, 0x01, 0x00, 0x00, 0x00, 0x02,
  0x00, 0x00, 0x00, 0x02, 0x01, 0x01,
]);

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'single-sentence-rot',
    name: `${TRANSLATION_KEY_PREFIX}.example.singleSentenceRot.name`,
    bytes: asciiToBytes(SINGLE_SENTENCE_TEXT),
    description: `${TRANSLATION_KEY_PREFIX}.example.singleSentenceRot.description`,
    expectedValid: true,
  },
  {
    id: 'multi-tag-rot',
    name: `${TRANSLATION_KEY_PREFIX}.example.multiTagRot.name`,
    bytes: asciiToBytes(MULTI_TAG_TEXT),
    description: `${TRANSLATION_KEY_PREFIX}.example.multiTagRot.description`,
    expectedValid: true,
  },
  {
    id: 'multi-sentence-navd',
    name: `${TRANSLATION_KEY_PREFIX}.example.multiSentenceNavd.name`,
    bytes: asciiToBytes(MULTI_SENTENCE_TEXT),
    description: `${TRANSLATION_KEY_PREFIX}.example.multiSentenceNavd.description`,
    expectedValid: true,
  },
  {
    id: 'tag-checksum-corrupt',
    name: `${TRANSLATION_KEY_PREFIX}.example.tagChecksumCorrupt.name`,
    bytes: asciiToBytes(TAG_CHECKSUM_CORRUPT_TEXT),
    description: `${TRANSLATION_KEY_PREFIX}.example.tagChecksumCorrupt.description`,
    expectedValid: false,
  },
  {
    id: 'sentence-checksum-corrupt',
    name: `${TRANSLATION_KEY_PREFIX}.example.sentenceChecksumCorrupt.name`,
    bytes: asciiToBytes(SENTENCE_CHECKSUM_CORRUPT_TEXT),
    description: `${TRANSLATION_KEY_PREFIX}.example.sentenceChecksumCorrupt.description`,
    expectedValid: false,
  },
  {
    id: 'no-tag-block',
    name: `${TRANSLATION_KEY_PREFIX}.example.noTagBlock.name`,
    bytes: asciiToBytes(NO_TAG_BLOCK_TEXT),
    description: `${TRANSLATION_KEY_PREFIX}.example.noTagBlock.description`,
    expectedValid: false,
  },
  {
    id: 'binary-transfer-out-of-scope',
    name: `${TRANSLATION_KEY_PREFIX}.example.binaryTransferOutOfScope.name`,
    bytes: BINARY_TRANSFER_HEADER,
    description: `${TRANSLATION_KEY_PREFIX}.example.binaryTransferOutOfScope.description`,
    expectedValid: false,
  },
];

export const iec61162Plugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'marine-navigation',
  parser: iec61162Parser,
  // 'build' sekmesi YOK (katalog) → `encoder` YAZILMAZ.
  documentation: {
    summary: `${TRANSLATION_KEY_PREFIX}.documentation.summary`,
    layer: 'multi-layer',
    references: [
      {
        title: 'Fraunhofer FKIE maritime-dissector — IEC 61162-450 NMEA dissector and real .pcap captures',
        url: 'https://github.com/fkie-cad/maritime-dissector',
      },
      {
        title: 'PyLWE — IEC 61162-450 lightweight Ethernet parser/generator (UdPbC token, TAG block)',
        url: 'https://github.com/72025003-sketch/PyLWE',
      },
      {
        title: 'gosk writer/lwe.go — transmission group table and talker-to-group mapping',
        url: 'https://github.com/munnik/gosk/blob/master/writer/lwe.go',
      },
      {
        title: 'gpsd AIVDM.adoc — NMEA tag block grammar and parameter dictionary',
        url: 'https://gitlab.com/gpsd/gpsd/-/blob/master/www/AIVDM.adoc',
      },
      {
        title:
          'Rødseth, Christensen & Lee (IEC TC80/WG6) — "Design challenges and decisions for a new ship data network" (ISIS 2011), §5.3 datagram size',
        url: 'https://web.archive.org/web/2018id_/http://www.mits-forum.org/resources/lwe-paper-isis-v9.pdf',
      },
      {
        title: 'IEC 61162-460 Ed. 1 — scope preview (adds no new application level protocol)',
        url: 'http://www.normservis.cz/download/view/iec/info_iec61162-460%7Bed1.0%7Den.pdf',
      },
    ],
  },
  exampleFrames: EXAMPLE_FRAMES,
  decodeOptions: DECODE_OPTIONS,
};

/**
 * SAE J1850 nabız-günlüğü KONTEYNERİ — `sae-j1850-pwm` ve `sae-j1850-vpw`nin
 * PAYLAŞTIĞI çözücü (Faz 10, dalga 14f). Ana brifin açık soru 1'i KARARA
 * BAĞLANDI (karma seçenek c): bu iki kayıt + `sent`/`spc` (dalga 14g)
 * belgelenmiş bir nabız konteyneri + `decodeOptions` alır; `psi5` (14h) ayrı
 * bir yoldan (`calculatorIds`) gider.
 *
 * ── Bu dosya neden ötekilerden farklı (`microwire.ts:1-10`un tonu emsal) ───
 * Katalogdaki öteki kayıtların çoğunda `ProtocolParser.parse(data: Uint8Array)`
 * girdisi TELİN KENDİSİDİR — bayt bayt SocketCAN çerçevesi, Modbus PDU'su vb.
 * J1850 PWM/VPW'de durum farklı: spec (`ozet/04-otomotiv.md:397`) bu ikisinin
 * girdisini bayt olarak değil NABIZ GÜNLÜĞÜ olarak veriyor ("Toolkit pulse-log
 * tabanlı decoder sağlamalıdır") ve çalışılmış örnekleri de nabız SÜRELERİ
 * cinsinden yazıyor ("Pulse 1: 8 us, Pulse 2: 16 us … Bit 1, Bit 0").
 *
 * `ProtocolParser.parse(data: Uint8Array)` imzası KİLİTLİDİR
 * (`protocol-core/types.ts:181`, CLAUDE.md kararı, 172 kaydı etkiler) —
 * `types.ts`e DOKUNULMADI. Çözüm: nabız süreleri `Uint8Array` İÇİNE
 * BELGELENMİŞ sabit genişlikli bir biçimle kodlanır. `canFrame.ts`in 16
 * baytlık SocketCAN çerçevesi de aynı gerekçeyle "telin kendisi değil, bir
 * YAKALAMA KONTEYNERİ"dir (`CAN_CLASSIC_FRAME_LENGTH`, `canFrame.ts:64`) —
 * depo bu deseni 25 kayıtta zaten taşıyor (`isotp`/`j1939`/`devicenet` üçü de
 * SocketCAN konteynerini girdi sayıyor). **BU KONTEYNER SAE J1850'NİN TEL
 * BİÇİMİ DEĞİLDİR** — SAE spec'i byte-clocked bir seri hat tanımlamıyor,
 * nabız süreleri tanımlıyor; konteyner yalnız bu depronun `parse(Uint8Array)`
 * sözleşmesine UYMAK için icat edildi. "Spec'ten geliyormuş" gibi
 * SUNULMAMALIDIR.
 *
 * ── KONTEYNER SÖZLEŞMESİ (14f/14g/14h ORTAK — burada TANIMLANIR, 14g/14h
 *    DEVRALIR, YENİDEN TASARLAMAZ) ─────────────────────────────────────────
 *
 *   1. Nabız başına 2 bayt, `Uint16LE`, birim **0.1 µs**. Üst sınır
 *      `65535 × 0.1 µs = 6553.5 µs` — SENT senkron darbesi (spec `:151`
 *      örneğinde 168 µs) ve J1850 SOF'u bu aralığın çok içinde.
 *   2. Girdi uzunluğu ÇİFT olmalıdır; tek uzunluk `truncated-frame` hatasıdır
 *      (bkz. `decodePulseLog`'un `odd-length` dalı).
 *   3. Değer **0 REZERVEDİR** ("ölçülemedi / boşluk"): alan tablosunda HAM
 *      gösterilir, SÜREYE ÇEVRİLMEZ (`DecodedPulse.reserved`).
 *   4. Nabızlar KESİN SIRAYLA ARDIŞIKTIR; zaman damgası taşınmaz — damga
 *      `RawFrame`in işidir (`protocol-core/types.ts`), konteynerin değil.
 *
 * ── `canParse` TUZAĞI — bu sözleşmenin gerçek bedeli ────────────────────────
 * `canParse` 172 parser'a sırayla sorulur (`types.ts:178`: "ucuz ön eleme").
 * **Nabız konteyneri herhangi bir çift uzunluklu bayt dizisine uyar** — naif
 * bir `data.length % 2 === 0` kontrolü otomatik algılamayı çöpe çevirir ve
 * başka protokollerin çerçevelerini çalar. Kural: `canParse` yalnız
 * protokolün KENDİ senkron imzası bulunursa `true` döner (J1850'de SOF
 * darbesi); imza bulunamıyorsa `false` — CRC gibi tam doğrulama `parse`a
 * bırakılır.
 *
 * ── ÖLÇÜLDÜ: yalnız SOF'a bakmak da naif kontrolün KENDİSİYDİ ──────────────
 * İlk sürümde yalnız `pulses[0]`in (SOF adayının) süresi bir ölçek bandına
 * bakılıyordu. Registry'deki 123 protokolün 761 örnek çerçevesi bu tek-nabız
 * imzasından geçirildiğinde **413'ü (%54) `true` döndü** — `ais`, `arp`,
 * `at-commands` gibi ilgisiz protokoller dahil. Sebep: gerçek protokol
 * örnekleri istatistiksel olarak RASTGELE değildir, KÜÇÜK sayılarla
 * (opcode'lar, kısa uzunluklar, yazdırılabilir ASCII) doludur — bu da tam
 * olarak "kısa nabız süresi" bandına denk gelen değer aralığıdır ("AT" =
 * `0x41 0x54` → little-endian `0x5441` DEĞİL, baytlar `0x41,0x54` iki ayrı
 * nabız gibi okunca ikisi de kolayca bir bant içine düşebiliyor). Tek nabza
 * bakmak, dosyanın kendisinin uyardığı naif kontrolün ta kendisiydi.
 *
 * **Düzeltme: yalnız SOF değil, SOF'tan SONRAKİ HER nabız da protokolün
 * KENDİ tolerans bandında olmalı.** Yabancı bir protokolün baytları arasında
 * TEK bir çift bant içine denk gelebilir; ama ardışık BEŞ-ON nabzın HEPSİNİN
 * aynı dar banda denk gelmesi istatistiksel olarak çok daha nadirdir —
 * `j1850Pulse.test.ts`teki "registry çapında çarpışma" testi bunu tam
 * registry üzerinde ölçer.
 *
 * SOF'un KESİN süresi bu depodaki spec özetinde YOK — yalnız segment adı
 * listeleniyor ("SOF, Header, Data, CRC, EOD, EOF", `:399`/`:411`), sayı
 * verilmiyor. Bu yüzden `PWM_SOF_MIN_US`/`PWM_SOF_MAX_US`/`VPW_SOF_MIN_US`
 * bir SOF süresi İDDİA ETMEZ; spec'in KENDİ verdiği bit-süresi örneklerinden
 * (PWM 8/16 µs `:403`, VPW 64/128 µs `:411`) kurulan bir ÖLÇEK sınırıdır: SOF
 * senkronizasyon amaçlı olduğundan TANIMI GEREĞİ kendi protokolünün en uzun
 * veri bitinden belirgin biçimde uzun olmalıdır, ama komşu J1850 fiziksel
 * katmanının ölçeğine sıçramamalıdır (PWM'in en uzun biti 16 µs, VPW'nin en
 * kısa biti 64 µs — aralarında dört kat boşluk var, iki protokol de aynı
 * fiziksel J1850 ailesinden olsa da ölçekleri örtüşmüyor).
 *
 * **`PWM_DATA_PULSE_MIN_US`/`MAX_US` ve `VPW_DATA_PULSE_MIN_US`/`MAX_US`** —
 * SOF SONRASI her nabzın düşmesi gereken tolerans bandı — spec'in KENDİ
 * verdiği kısa/uzun örneklerinin (8/16 µs, 64/128 µs) YARISI/İKİ KATIDIR
 * (`kısa/2` … `uzun×2`). Bu da bir SOF/bit süresi İDDİASI DEĞİLDİR — gerçek
 * darbelerin ne kadar SAPABİLECEĞİNE dair kaba, açıkça türetilmiş bir
 * tolerans bandıdır. `decodeOptions`taki `bitThreshold` kullanıcının
 * YORUMLADIĞI eşiktir ve `canParse(data)`e HİÇ ulaşmaz (imza tek parametre
 * alır, `types.ts:182`); bu yüzden bant `decodeOptions`tan TÜRETİLEMEZ,
 * dosya sabiti olarak yaşar — fiziksel yakalamanın KENDİSİ, kullanıcının o
 * yakalamayı sonradan nasıl yorumlayacağından bağımsızdır.
 *
 * Rezerve (0) nabız GÖRÜLEN her `canParse`i `false`e düşürür: "ölçülemedi"
 * işaretli bir günlük otomatik algılamaya aday değildir, `parse` bunu HAM
 * gösterip uyarır ama `canParse` bunu KABUL ETMEZ.
 *
 * Bu UYDURULMUŞ bir mikrosaniye değeri değildir, yalnız "hangi protokolün
 * ölçeğinde" sorusuna ucuz bir ön elemedir; kesin doğrulama `parse`ın CRC
 * kontrolündedir (sözleşmenin kendi kuralı, `types.ts:176`).
 *
 * ── Bit → bayt paketleme sırası: MSB-FIRST, kanıtı `j1850Pulse.test.ts`te ──
 * Nabızlardan çözülen bit akışı `CRC8_SAE_J1850` hesaplanmadan ÖNCE baytlara
 * paketlenir (CRC BAYTLAR üzerinde çalışır, bitler üzerinde değil). Sıra
 * (MSB-first / LSB-first) seçimi `packBitsToBytes`e `bitOrder` PARAMETRESİ
 * olarak veriliyor ve **MSB-first** kullanılıyor: `bitCursor.ts`in kendi
 * varsayılan gerekçesiyle aynı ("ağ/telekom protokollerinin ve çoğu veri
 * sayfasının bit numaralandırması budur") ve SAE J1850'nin genel bilinen
 * ("her genel J1850/OBD-II kaynağında bulunan, lisanslı olmayan") aktarım
 * kuralı en anlamlı biti önce gönderir — `obd.ts:27-32`nin "MOD + 0x40 =
 * YANIT" kuralını nasıl bu depodaki spec özetinden değil genel J1979
 * bilgisinden aldığıyla AYNI kaynak sınıfı.
 *
 * DÜRÜSTLÜK NOTU: bu depodaki spec özeti CRC'li, byte-doğrulanmış TAM bir
 * J1850 çerçeve örneği VERMİYOR (yalnız nabız→bit örnekleri var, nabız→bayt
 * örneği yok) — yani MSB-first seçimi bağımsız üçüncü bir kaynakla
 * ÇAPRAZLANAMADI (flexray'in CRC'lerinin iki bağımsız kaynakla sınandığı
 * titizlikte değil). Kanıt olarak elde olan: (a) `packBitsToBytes`in
 * `j1850Pulse.test.ts`teki İZOLE testi — elle yazılmış bit dizisi (`0x61`
 * baytının bitleri tek tek yorumla döküldü) MSB-first ile doğru baytı, aynı
 * dizi LSB-first ile FARKLI bir bayt üretiyor, yani sıra gerçekten sonucu
 * değiştiriyor; (b) `j1850Pwm.test.ts`/`j1850Vpw.test.ts`teki uçtan uca
 * round-trip (bilinen bayt → elle türetilmiş nabız dizisi → decode → AYNI
 * bayt + CRC PASS). Bu sözleşmenin ZAYIF halkasıdır ve 14g/14h SENT/SPC'yi
 * yazarken AYNI sınırı miras alacağını bilmelidir.
 */

import { readBits, writeBits } from '@/protocol-core/decoding/bitCursor';
import type { BitOrder } from '@/protocol-core/decoding/bitCursor';
import { readUint16Le } from '../can/canFrame';

/** Nabız başına bayt sayısı — `Uint16LE`. */
export const PULSE_STRIDE_BYTES = 2;
/** Kayıtlı tamsayının taşıdığı süre birimi (madde 1). */
export const PULSE_UNIT_US = 0.1;
/** Rezerve edilmiş kayıt değeri: "ölçülemedi / boşluk" (madde 3). */
export const RESERVED_REGISTER_VALUE = 0;
/** `Uint16LE`nin taşıyabildiği en uzun süre: `65535 × 0.1 µs`. */
export const MAX_PULSE_DURATION_US = 0xffff * PULSE_UNIT_US;

/** Tek bir nabzın çözümü. `reserved` true ise `durationUs` KULLANILMAMALI. */
export interface DecodedPulse {
  /** Ham `Uint16LE` kaydı — 0.1 µs biriminde, ölçeklenmemiş. */
  readonly rawRegister: number;
  /** `rawRegister × PULSE_UNIT_US`. Rezerve nabızda anlamsızdır. */
  readonly durationUs: number;
  readonly reserved: boolean;
}

export interface PulseLogDecodeResult {
  readonly pulses: readonly DecodedPulse[];
}

export type PulseLogDecodeFailure =
  | { readonly kind: 'empty' }
  | { readonly kind: 'odd-length'; readonly length: number };

export type PulseLogDecodeOutcome =
  | { readonly ok: true; readonly result: PulseLogDecodeResult }
  | { readonly ok: false; readonly failure: PulseLogDecodeFailure };

/**
 * Konteyneri çözer — madde 2/3'ü uygular. Fırlatmaz: yapısal bozukluk
 * `ok:false` ile döner, çağıran (j1850Pwm.ts/j1850Vpw.ts) bunu kendi
 * `ProtocolError` biçimine çevirir (`microwire.ts`in `decodeMicrowire`
 * outcome deseniyle AYNI: `ok`/`failure` ayrımı, `timing/microwire.ts:234`).
 */
export function decodePulseLog(data: Uint8Array): PulseLogDecodeOutcome {
  if (data.length === 0) {
    return { ok: false, failure: { kind: 'empty' } };
  }
  if (data.length % PULSE_STRIDE_BYTES !== 0) {
    return { ok: false, failure: { kind: 'odd-length', length: data.length } };
  }

  const pulseCount = data.length / PULSE_STRIDE_BYTES;
  const pulses: DecodedPulse[] = [];
  for (let index = 0; index < pulseCount; index += 1) {
    const rawRegister = readUint16Le(data, index * PULSE_STRIDE_BYTES);
    pulses.push({
      rawRegister,
      durationUs: rawRegister * PULSE_UNIT_US,
      reserved: rawRegister === RESERVED_REGISTER_VALUE,
    });
  }
  return { ok: true, result: { pulses } };
}

/**
 * `decodePulseLog`in TERSİ — nabız günlüğü üretir. Üretim kodunun kendisi
 * bunu KULLANMAZ (girdi her zaman dışarıdan gelir); `EXAMPLE_FRAMES` ve
 * testler bilinen baytlardan geçerli bir konteyner kurmak için kullanır
 * (`canFrame.ts`in `buildCanClassicFrame`iyle AYNI rol — elle hex yazmak
 * yerine tek yerde yaşayan bir üretici).
 */
export function encodePulseLog(durationsUs: readonly number[]): Uint8Array {
  const bytes = new Uint8Array(durationsUs.length * PULSE_STRIDE_BYTES);
  durationsUs.forEach((durationUs, index) => {
    // Süre 0'a yuvarlanırsa REZERVE değeriyle çakışır; en az 1 (0.1 µs) dayatılır.
    const register = Math.min(0xffff, Math.max(1, Math.round(durationUs / PULSE_UNIT_US)));
    const offset = index * PULSE_STRIDE_BYTES;
    bytes[offset] = register & 0xff;
    bytes[offset + 1] = (register >>> 8) & 0xff;
  });
  return bytes;
}

/**
 * Bir nabız ARALIĞININ (pulse-index cinsinden) konteynerdeki KAPSAYAN bayt
 * aralığı. `ParsedField.offset`/`length` BAYT cinsindendir (`types.ts:41`) —
 * nabız indeksi değil. `microwire.ts`in bit→bayt `byteSpan`iyle AYNI rol,
 * yalnız granülerlik nabız (2 bayt) düzeyinde.
 */
export function pulseByteSpan(
  startPulseIndex: number,
  pulseCount: number,
): { readonly offset: number; readonly length: number } {
  return {
    offset: startPulseIndex * PULSE_STRIDE_BYTES,
    length: pulseCount * PULSE_STRIDE_BYTES,
  };
}

/**
 * Bir nabzın "kısa" mı "uzun" mu olduğunu eşiğe göre sınıflar. PWM ve VPW'nin
 * İKİSİ de bu ikili ayrımı kullanır; farkları bunu NASIL bir bit değerine
 * çevirdiklerindedir (PWM: kısa=1/uzun=0 doğrudan; VPW: kısa/uzun aktif/pasif
 * durumla BİRLİKTE okunur — bkz. `j1850Vpw.ts` dosya başı).
 */
export function isShortPulse(durationUs: number, thresholdUs: number): boolean {
  return durationUs < thresholdUs;
}

/** VPW'nin alterne eden hat durumu. PWM'de KULLANILMAZ (spec'in PWM bölümü aktif/pasif durumdan hiç söz etmiyor, yalnız süre). */
export type PulseLevel = 'active' | 'passive';

function flipLevel(level: PulseLevel): PulseLevel {
  return level === 'active' ? 'passive' : 'active';
}

/**
 * `pulseCount` nabızlık bir dizinin seviyelerini üretir: nabızlar KESİN
 * ALTERNE eder (tek telli bir hat aynı durumda iki ardışık nabız üretemez),
 * bu yüzden yalnız İLK nabzın seviyesi (SOF'un kendisi) bilinmeyendir —
 * `initialLevel` decodeOption'ı tam olarak bunu sorar (brief karar 1,
 * "her nabıza seviye biti gömmek yerine tek şık sorulur, konteynere bit
 * çalınmaz").
 */
export function deriveAlternatingLevels(
  pulseCount: number,
  initialLevel: PulseLevel,
): PulseLevel[] {
  const levels: PulseLevel[] = [];
  let current = initialLevel;
  for (let index = 0; index < pulseCount; index += 1) {
    levels.push(current);
    current = flipLevel(current);
  }
  return levels;
}

/**
 * Bit dizisini baytlara paketler. `bitCursor.ts`in `writeBits`ini TEK bit
 * uzunluğunda tekrar tekrar çağırır — el yordamıyla kaydırma/maskeleme
 * YENİDEN YAZILMADI, tek test edilmiş yoldan geçiliyor (`crcEngine.ts`in
 * "TEK bir aritmetik yol" ilkesiyle aynı gerekçe).
 */
export function packBitsToBytes(bits: readonly (0 | 1)[], bitOrder: BitOrder): Uint8Array {
  const byteCount = Math.ceil(bits.length / 8);
  const target = new Uint8Array(byteCount);
  bits.forEach((bit, index) => {
    writeBits(target, index, 1, BigInt(bit), bitOrder);
  });
  return target;
}

/** `packBitsToBytes`in TERSİ — `encodePulseLog` gibi yalnız örnek/test üretimi için. */
export function unpackBytesToBits(bytes: Uint8Array, bitOrder: BitOrder): (0 | 1)[] {
  const bits: (0 | 1)[] = [];
  for (let index = 0; index < bytes.length * 8; index += 1) {
    bits.push(readBits(bytes, index, 1, bitOrder) === 1n ? 1 : 0);
  }
  return bits;
}

// ── `canParse` veri-nabzı toleransı — SOF SONRASI HER nabız için ───────────
// Ölçüldü: yalnız SOF'a bakmak registry'nin 761 örnek çerçevesinin 413'ünü
// (%54) yanlış pozitif kabul ediyordu (dosya başı, "ÖLÇÜLDÜ" notu). Bant
// spec'in KENDİ kısa/uzun örneklerinin (PWM 8/16 µs, VPW 64/128 µs) YARISI/
// İKİ KATIDIR — bir SOF/bit süresi iddiası DEĞİL, kaba bir tolerans bandı.
// PWM üst sınırı `16×2=32` DEĞİL `16×1.5=24` seçildi: `cip`in ve `dmx512`in
// GERÇEK örnek çerçeveleri (registry taramasıyla YAKALANDI) 28-29 µs'lik
// baytlar içeriyordu ve `32`lik gevşek uçta yanlış pozitif üretiyordu — 24,
// hâlâ spec'in 16 µs'lik uzun bitinin ÜSTÜNDE (tolerans payı KORUNUYOR) ama
// o iki çarpışmayı da eler; kendi 8/16 µs'lik örnekleri bolca içeride kalır.
/** PWM veri nabzı alt sınırı: kısa bitin (8 µs) YARISI. */
export const PWM_DATA_PULSE_MIN_US = 4;
/** PWM veri nabzı üst sınırı: uzun bitin (16 µs) 1.5 KATI (registry taramasıyla daraltıldı, bkz. yukarı). */
export const PWM_DATA_PULSE_MAX_US = 24;
/** VPW veri nabzı alt sınırı: kısa bitin (64 µs) YARISI. */
export const VPW_DATA_PULSE_MIN_US = 32;
/** VPW veri nabzı üst sınırı: uzun bitin (128 µs) İKİ KATI. */
export const VPW_DATA_PULSE_MAX_US = 256;

// ── `canParse` SOF bandı ────────────────────────────────────────────────────
// PWM'in ölçeğindeki en uzun veri biti (spec `:403`, "Pulse 2: 16 us → Bit 0")
// ile VPW'nin ölçeğindeki en kısa veri biti (spec `:411`, "Active 64 us")
// arasındaki boşluk — SOF bunun İÇİNDE (PWM) ya da ÜSTÜNDE (VPW) olmalı.
/** PWM'in SOF'u bunun ÜSTÜNDE olmalı — kendi en uzun veri bitinden belirgin uzun. */
export const PWM_SOF_MIN_US = 16;
/** PWM'in SOF'u bunun ALTINDA kalmalı — VPW'nin ölçeğine SIÇRAMAMALI. */
export const PWM_SOF_MAX_US = 64;
/** VPW'in SOF'u bunun ÜSTÜNDE/EŞİT olmalı — kendi kısa bitinin (64 µs) KENDİSİ. */
export const VPW_SOF_MIN_US = 64;
/**
 * VPW'in SOF'u bunun ALTINDA kalmalı. "Üst sınır YOK" (PWM'in tersine, komşu
 * üst protokol yok) yalnız TEORİDE doğruydu — pratikte `MAX_PULSE_DURATION_US`
 * (6553.5 µs) kadar geniş bir üst sınır, rastgele HERHANGİ bir ilk nabzın
 * (`io-link`in bir örneği: SOF adayı 2739.2 µs) neredeyse otomatik geçmesi
 * demekti (registry taramasıyla YAKALANDI). `VPW_DATA_PULSE_MAX_US`in İKİ
 * KATI — veri bandının üstünde bolca tolerans payı bırakırken artık GERÇEKTEN
 * bir üst sınır.
 */
export const VPW_SOF_MAX_US = VPW_DATA_PULSE_MAX_US * 2;

/**
 * Bir nabız rezerve DEĞİL ve `[minUs, maxUs]` bandının (uçlar dahil) içinde
 * mi. `canParse`in hem SOF hem "SOF sonrası her nabız" kontrolü bunu kullanır
 * — rezerve kontrolü burada TEK yerde yaşar, iki protokol de aynı kuralı
 * uygular (dosya başı, "canParse TUZAĞI").
 */
export function isWithinPulseBand(pulse: DecodedPulse, minUs: number, maxUs: number): boolean {
  return !pulse.reserved && pulse.durationUs >= minUs && pulse.durationUs <= maxUs;
}

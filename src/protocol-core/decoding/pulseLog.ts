/**
 * Nabız-günlüğü YAKALAMA KONTEYNERİ — `sae-j1850-pwm`/`sae-j1850-vpw` (Faz 10,
 * dalga 14f) ile `sent`/`spc`nin (dalga 14g) PAYLAŞTIĞI çözücü. `psi5` (14h)
 * bu yolu KULLANMAZ, `calculatorIds` ile ayrı gider (ana brifin karar 1'i).
 *
 * ── Buraya TAŞINDI, `j1850/j1850Pulse.ts`ten (dalga 14g karar 1) ───────────
 * Bu dosya başta `protocols/automotive/j1850/j1850Pulse.ts` içinde J1850'ye
 * özel görünerek yazılmıştı; 14g'nin ilk kararı bunun GERÇEKTEN ortak olup
 * olmadığını sordu. Cevap: yalnız KONTEYNERİN KENDİSİ (nabız okuma, uzunluk
 * denetimi, rezerve değer kuralı, bayt-aralığı hesabı) taşındı — bit/nibble
 * TÜRETİMİ protokole özeldir ve TAŞINMADI (12b'nin LLDP/DHCP TLV dersi:
 * "yürüyücü LLDP'ye özel yazıldı, paylaşılan modül AÇILMADI"). Somut olarak:
 *
 *   - TAŞINDI: `decodePulseLog`, `encodePulseLog`, `pulseByteSpan`,
 *     `isWithinPulseBand`, `DecodedPulse` ve ilgili sabitler — J1850 PWM/VPW
 *     ve SENT/SPC'nin HEPSİ bunları AYNI biçimde kullanıyor: nabız oku, süreye
 *     çevir, rezerveyi işaretle, bir aralığın kapsadığı baytı hesapla.
 *   - TAŞINMADI (`j1850/j1850Pulse.ts`te KALDI): `isShortPulse` (J1850'nin
 *     kısa/uzun ikili ayrımı — SENT nibble'ı 0-15 arası SÜREKLİ bir tick
 *     sayımından türer, ikili değil, bu fonksiyonu HİÇ kullanmaz),
 *     `deriveAlternatingLevels`/`PulseLevel` (yalnız VPW'nin aktif/pasif hat
 *     modeli — SENT'in tek yönlü darbe treninde "alterne seviye" kavramı
 *     yoktur), `packBitsToBytes`/`unpackBytesToBits` (J1850 bit akışını
 *     CRC-8 için BAYTA paketler; SENT nibble değerini doğrudan taşır, bit
 *     paketlemeye hiç ihtiyaç duymaz — dosya başı "MSB-first" dürüstlük notu
 *     da bu yüzden yalnız J1850'de kalıyor, SENT/SPC'ye MİRAS GEÇMEZ).
 *
 * `j1850Pulse.ts` bu dosyayı RE-EXPORT ETMEZ — tüketicileri (`j1850Pwm.ts`,
 * `j1850Vpw.ts`) ortak parçayı BURADAN, J1850'ye özel parçayı KENDİ dosyasından
 * ayrı ayrı import eder. Böylece bir modülün gerçekte NEREDE yaşadığı
 * proxy'lerin arkasında gizlenmez (aynı disiplin `decoding/index.ts` barrel'ının
 * yalnızca üst düzey toplu import için var olması, iç tüketimin DOĞRUDAN
 * dosyadan yapılmasıyla aynı).
 *
 * ── `bitCursor.ts`/`berReader.ts` ile AYNI sınıf ────────────────────────────
 * Saf TypeScript, React/DOM/katalog bağımlılığı yok, `ok`/`failure` ayrımlı
 * dönüş (fırlatmaz) — `berReader.ts`in tasarım disipliniyle BİREBİR. Küçük
 * fark: `readUint16Le`, `protocols/automotive/can/canFrame.ts`ten DEĞİL
 * `buffers/endianness.ts`teki `bytesToNumber`den alınır — `protocol-core`
 * `protocols/`e bağımlı OLAMAZ (katman yönü ters döner), oysa J1850'nin
 * özgün dosyası bunu `protocols/` içinden ödünç alıyordu çünkü henüz
 * `protocol-core`a taşınmamıştı.
 *
 * ── KONTEYNER SÖZLEŞMESİ (14f/14g/14h ORTAK) ────────────────────────────────
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
 * **BU KONTEYNER İLGİLİ PROTOKOLLERİN TEL BİÇİMİ DEĞİLDİR** — ne SAE J1850 ne
 * SAE J2716 byte-clocked bir seri hat tanımlar; ikisi de nabız SÜRELERİ
 * tanımlar. Konteyner yalnız bu depronun `parse(Uint8Array)` sözleşmesine
 * (`protocol-core/types.ts:181`, KİLİTLİ) UYMAK için icat edildi — "spec'ten
 * geliyormuş" gibi SUNULMAMALIDIR. `canFrame.ts`in 16 baytlık SocketCAN
 * çerçevesi de aynı gerekçeyle bir YAKALAMA KONTEYNERİdir.
 *
 * ── `canParse` TUZAĞI (kalıcı, tüm tüketiciler için) ────────────────────────
 * Nabız konteyneri herhangi bir çift uzunluklu bayt dizisine uyar — naif bir
 * `data.length % 2 === 0` kontrolü otomatik algılamayı çöpe çevirir. 14f
 * ÖLÇTÜ: yalnız SOF'a (pulses[0]) bakmak registry'nin 761 örnek çerçevesinin
 * 413'ünü (%54) yanlış pozitif kabul ediyordu. Kural her tüketici için AYNI:
 * yalnız İLK nabza değil, protokolün SOF/senkron nabzından SONRAKİ HER nabız
 * da kendi tolerans bandında olmalı (`isWithinPulseBand`, aşağıda) — bant
 * MUTLAK µs de olabilir (J1850) veya SENT'te olduğu gibi tahmini tick süresine
 * ORANLI da olabilir; ikisi de bu tek fonksiyonla ifade edilir.
 */

import { bytesToNumber } from '../buffers/endianness';

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
 * `ok:false` ile döner, çağıran (`j1850Pwm.ts`/`j1850Vpw.ts`/`sent.ts`/
 * `spc.ts`) bunu kendi `ProtocolError` biçimine çevirir (`microwire.ts`in
 * `decodeMicrowire` outcome deseniyle AYNI: `ok`/`failure` ayrımı).
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
    const offset = index * PULSE_STRIDE_BYTES;
    const rawRegister = bytesToNumber(data.slice(offset, offset + PULSE_STRIDE_BYTES), 'little');
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
 * testler bilinen sürelerden geçerli bir konteyner kurmak için kullanır
 * (`canFrame.ts`in `buildCanClassicFrame`iyle AYNI rol).
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
 * Bir nabız rezerve DEĞİL ve `[minUs, maxUs]` bandının (uçlar dahil) içinde
 * mi. Bant MUTLAK (J1850'nin SOF/veri bantları) ya da tahmini bir tick
 * süresinden TÜRETİLMİŞ (SENT/SPC'nin nibble bandı — `sent.ts`teki
 * `sentSignatureFromPulses`) olabilir; fonksiyon ikisi için de aynıdır.
 * `canParse`in "SOF/senkron sonrası HER nabız" kontrolü bunu kullanır —
 * rezerve kontrolü burada TEK yerde yaşar, tüm tüketiciler aynı kuralı uygular.
 */
export function isWithinPulseBand(pulse: DecodedPulse, minUs: number, maxUs: number): boolean {
  return !pulse.reserved && pulse.durationUs >= minUs && pulse.durationUs <= maxUs;
}

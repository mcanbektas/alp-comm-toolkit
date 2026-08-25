/**
 * SAE J1850'YE ÖZEL nabız yorumlama yardımcıları (Faz 10, dalga 14f;
 * konteynerin KENDİSİ dalga 14g karar 1'de `@/protocol-core/decoding/pulseLog`e
 * TAŞINDI). Bu dosyada KALANLAR: bit/nibble TÜRETİMİ — protokole özeldir,
 * `sent`/`spc` (dalga 14g) bunları KULLANMAZ, kendi türetimini kendi dosyasında
 * yazar (12b'nin LLDP/DHCP TLV dersi: "yürüyücü LLDP'ye özel yazıldı, paylaşılan
 * modül AÇILMADI").
 *
 * ── Bu dosya neden ötekilerden farklı (`microwire.ts:1-10`un tonu emsal) ───
 * Katalogdaki öteki kayıtların çoğunda `ProtocolParser.parse(data: Uint8Array)`
 * girdisi TELİN KENDİSİDİR. J1850 PWM/VPW'de durum farklı: girdi nabız
 * SÜRELERİ cinsinden bir YAKALAMA KONTEYNERİdir — konteynerin TAM sözleşmesi
 * (`Uint16LE`, 0.1 µs birim, çift uzunluk, rezerve 0 kuralı) artık
 * `@/protocol-core/decoding/pulseLog.ts` dosya başında yaşıyor, burada
 * TEKRAR EDİLMEZ.
 *
 * ── `j1850Pwm.ts`/`j1850Vpw.ts` bu dosyayı NASIL kullanır ───────────────────
 * İki tüketici de İKİ AYRI yerden import eder — bu dosya konteyneri
 * RE-EXPORT ETMEZ: `decodePulseLog`/`encodePulseLog`/`pulseByteSpan`/
 * `isWithinPulseBand` `@/protocol-core/decoding/pulseLog`den, aşağıdaki
 * J1850'ye özel parçalar (`isShortPulse`, `deriveAlternatingLevels`,
 * `packBitsToBytes`/`unpackBytesToBits`, tolerans bant sabitleri) BURADAN.
 *
 * ── Bit kuralları PROTOKOLE ÖZELDİR (PWM vs VPW karşıtlığı) ─────────────────
 * `isShortPulse` PWM'in kısa/uzun ikili ayrımı için yeterlidir (PWM bölümü
 * aktif/pasif durumdan hiç söz etmiyor). VPW'de bit anlamı SÜRE TEK BAŞINA
 * yetmez, aktif/pasif DURUMLA birlikte okunur (`j1850Vpw.ts` dosya başı) —
 * `deriveAlternatingLevels` bu yüzden var: nabızlar KESİN ALTERNE ettiği için
 * tek bilinmeyen ilk seviyedir (`initialLevel` decodeOption'ı tam bunu sorar).
 *
 * ── Bit → bayt paketleme sırası: MSB-FIRST, kanıtı `j1850Pulse.test.ts`te ──
 * Nabızlardan çözülen bit akışı `CRC8_SAE_J1850` hesaplanmadan ÖNCE baytlara
 * paketlenir (CRC BAYTLAR üzerinde çalışır, bitler üzerinde değil). Sıra
 * (MSB-first / LSB-first) seçimi `packBitsToBytes`e `bitOrder` PARAMETRESİ
 * olarak veriliyor ve **MSB-first** kullanılıyor: `bitCursor.ts`in kendi
 * varsayılan gerekçesiyle aynı ("ağ/telekom protokollerinin ve çoğu veri
 * sayfasının bit numaralandırması budur") ve SAE J1850'nin genel bilinen
 * ("her genel J1850/OBD-II kaynağında bulunan, lisanslı olmayan") aktarım
 * kuralı en anlamlı biti önce gönderir.
 *
 * DÜRÜSTLÜK NOTU: bu depodaki spec özeti CRC'li, byte-doğrulanmış TAM bir
 * J1850 çerçeve örneği VERMİYOR (yalnız nabız→bit örnekleri var, nabız→bayt
 * örneği yok) — yani MSB-first seçimi bağımsız üçüncü bir kaynakla
 * ÇAPRAZLANAMADI. Kanıt olarak elde olan: (a) `packBitsToBytes`in
 * `j1850Pulse.test.ts`teki İZOLE testi — elle yazılmış bit dizisi (`0x61`
 * baytının bitleri tek tek yorumla döküldü) MSB-first ile doğru baytı, aynı
 * dizi LSB-first ile FARKLI bir bayt üretiyor, yani sıra gerçekten sonucu
 * değiştiriyor; (b) `j1850Pwm.test.ts`/`j1850Vpw.test.ts`teki uçtan uca
 * round-trip (bilinen bayt → elle türetilmiş nabız dizisi → decode → AYNI
 * bayt + CRC PASS). Bu sözleşmenin ZAYIF halkasıdır. SENT/SPC bunu MİRAS
 * ALMAZ çünkü nibble değeri (dalga 14g'de tick sayısından doğrudan türer) bit
 * paketlemeye hiç ihtiyaç duymaz — bir bit-sırası varsayımı bile gerekmez.
 */

import { readBits, writeBits } from '@/protocol-core/decoding/bitCursor';
import type { BitOrder } from '@/protocol-core/decoding/bitCursor';

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
// (%54) yanlış pozitif kabul ediyordu (`pulseLog.ts` dosya başı, "ÖLÇÜLDÜ"
// notu). Bant spec'in KENDİ kısa/uzun örneklerinin (PWM 8/16 µs, VPW 64/128
// µs) YARISI/İKİ KATIDIR — bir SOF/bit süresi iddiası DEĞİL, kaba bir
// tolerans bandı. PWM üst sınırı `16×2=32` DEĞİL `16×1.5=24` seçildi: `cip`in
// ve `dmx512`in GERÇEK örnek çerçeveleri (registry taramasıyla YAKALANDI)
// 28-29 µs'lik baytlar içeriyordu ve `32`lik gevşek uçta yanlış pozitif
// üretiyordu — 24, hâlâ spec'in 16 µs'lik uzun bitinin ÜSTÜNDE (tolerans payı
// KORUNUYOR) ama o iki çarpışmayı da eler.
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

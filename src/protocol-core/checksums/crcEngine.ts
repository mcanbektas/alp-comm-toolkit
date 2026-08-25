/**
 * Parametrik CRC motoru — Ross Williams'ın "A Painless Guide to CRC Error Detection
 * Algorithms" makalesindeki beş parametreli modeli (width, poly, init, refin/refout,
 * xorout) uygular. Bu beş parametre herhangi bir CRC varyantını (CRC-4'ten CRC-64'e)
 * tanımlar; bu dosya onları alıp bit-bazlı polinom bölmesiyle sonucu üreten TEK bir
 * `crc()` fonksiyonu sağlar — katalogdaki 18 algoritma da "custom" bir kullanıcı
 * tanımı da aynı yoldan geçer.
 *
 * Neden `bigint`: register genişliği CRC-64'te 64 bite çıkıyor. JavaScript'in
 * bitwise operatörleri (`<<`, `&`, `^`, `>>`) işlenenlerini 32-bit işaretli tam
 * sayıya indirger — 64-bit bir register'da üst bitler sessizce budanır ve sonuç
 * yanlış çıkar. `bigint` genişlikten bağımsız tutarlı davranış garanti eder; bu
 * yüzden width kaç olursa olsun (CRC-4 dahil) TEK bir aritmetik yol kullanılır,
 * "küçük width'lerde number, büyüklerde bigint" gibi bir ayrım YOKTUR — böyle bir
 * ayrım iki ayrı test edilmiş yol demektir, hata payını ikiye katlar.
 *
 * ## Neden `crcBits` var — açık soru 4'ün kararı (Faz 10, dalga 14e)
 *
 * FlexRay'in header CRC'si başlığın TAM 20 biti üzerinden hesaplanır (Sync Frame
 * Indicator + Startup Frame Indicator + Frame ID[11] + Payload Length[7]). 20 bit
 * = 2.5 bayttır; `crc()` ise bayt bayt döner (`for (const byte of bytes)`) ve 8'in
 * katı olmayan girdiyi ALAMAZ. 2.5 baytlık veriyi `crc()`ye vermek hata DEĞİL,
 * sessiz yanlış sonuç üretir.
 *
 * İki şık vardı: (a) bit uzunluğunu parametre alan bir kardeş fonksiyon,
 * (b) çağıranın 20 biti belgelenmiş bir dolgu kuralıyla 3 bayta paketleyip
 * `crc()`ye vermesi. (a) SEÇİLDİ. Gerekçe: bir CRC'nin kaç bit üzerinden koştuğu
 * CRC TANIMININ PARÇASIDIR — polinom ve init kadar tanıma aittir. (b) bunu
 * çağırana devreder ve her çağıran kendi dolgu kuralını uydurur; kural yanlışsa
 * CRC küçük örneklerde doğru görünüp büyüklerde bozulur (12f'in "chunk boyutunu
 * ondalık okumak küçük örneklerde çalışır" tuzağının aynı sınıfı). (b) bir sonraki
 * bayt-hizasız CRC'de aynı kuralın yeniden uydurulmasını da engellemezdi.
 *
 * Ekleme ADDITIVE'dir: `types.ts` sözleşmesine DOKUNMAZ, `protocol-core` yüzeyine
 * yalnız bir dışa aktarım ekler. Emsal `berReader.ts`in 12e'de iki kardeşle
 * büyümesi — "paylaşım gerçekse ayrı modül değil, var olan dosyaya kardeş eklenir".
 *
 * `crc()` artık `crcBits()`e DELEGE EDİYOR, gövdesi kopyalanmadı: yukarıdaki "TEK
 * bir aritmetik yol" ilkesi tam olarak budur. İki CRC çekirdeği iki ayrı test
 * edilmiş yol demek olurdu ve biri diğerinden sessizce ayrışırdı. Katalogdaki
 * `check` fixture'larının tamamı bu delegasyonun bekçisidir.
 */

/** Her byte tam 8 bit taşır; iç bit döngüsünün sınırı ve `reflectByte`'ın genişliği. */
const BITS_PER_BYTE = 8;
/** Bit maskesi/kaydırma adımı olarak kullanılan tek bit — okunabilirlik için adlandırıldı. */
const SINGLE_BIT = 1n;
/** Bir bitin "boş" (sıfır) durumu — `reflectBits` biriktiricisinin başlangıcı. */
const EMPTY_REGISTER = 0n;

/**
 * Bir CRC varyantını tanımlayan beş parametre + register genişliği. `poly` en üst
 * terimi (x^width) İÇERMEZ — kataloglardaki alışılmış gösterim budur (ör. CRC-32
 * için 0x04C11DB7, x^32 örtük).
 */
export interface CrcParams {
  /** Register genişliği, bit cinsinden (katalogda 4..64 arası görülür). */
  readonly width: number;
  /** Üretici polinom, x^width terimi hariç, alt `width` bit. */
  readonly poly: bigint;
  readonly init: bigint;
  /** true ise her giriş byte'ı işlenmeden önce kendi 8 biti içinde ters çevrilir. */
  readonly refin: boolean;
  /** true ise SONUÇ register'ı `width` bit içinde ters çevrilir (xorout'tan ÖNCE). */
  readonly refout: boolean;
  readonly xorout: bigint;
}

/**
 * `value`'nun alt `width` bitini ters çevirir (en düşük anlamlı bit en yükseğe
 * gider, ve tersi). `refout` bunu register'ın TAMAMINA (width bit) uygular;
 * `reflectByte` ise girişte her byte'a AYRI AYRI, sabit 8 bit içinde uygular —
 * ikisi aynı işlemin farklı genişlikteki kullanımı, bu yüzden tek fonksiyon var.
 */
export function reflectBits(value: bigint, width: number): bigint {
  let remaining = value;
  let reflected = EMPTY_REGISTER;
  for (let bitIndex = 0; bitIndex < width; bitIndex++) {
    reflected = (reflected << SINGLE_BIT) | (remaining & SINGLE_BIT);
    remaining >>= SINGLE_BIT;
  }
  return reflected;
}

/** `refin` için: bir byte'ın 8 bitini ters çevirir (bit 0 <-> bit 7, bit 1 <-> bit 6 …). */
export function reflectByte(byte: number): bigint {
  return reflectBits(BigInt(byte), BITS_PER_BYTE);
}

/**
 * Bit-bazlı CRC hesabı: her byte'ın (refin uygulanmışsa ters çevrilmiş hâliyle) 8
 * bitini MSB'den başlayarak tek tek işler. Her adımda gelen bit register'ın o anki
 * en üst bitiyle karşılaştırılır, register bir bit sola kaydırılır, karşılaştırma
 * sonucuna göre `poly` XOR'lanır.
 *
 * Neden bu yöntem ve NEDEN "byte'ı register'ın üstüne XOR'layıp width kez kaydır"
 * yöntemi DEĞİL (birçok CRC referansında görülen kısayol): o kısayol byte'ın 8
 * bitini register'ın üst ucuna `width - 8` kaydırmayla yerleştirir — bu yalnız
 * width >= 8 iken anlamlıdır. CRC-4/5/6/7'de width < 8 olduğundan `width - 8`
 * NEGATİF çıkar ve register zaten bir byte'ın tamamını barındıramaz; o yöntem
 * width < 8 için ayrı bir özel dal gerektirir. Buradaki "gelen biti register'ın üst
 * bitiyle karşılaştır, kaydır, gerekirse XOR'la" yöntemi register genişliğinden
 * TAMAMEN bağımsızdır: aynı kod yolu 4 bitten 64 bite kadar hiçbir dallanma
 * olmadan doğru sonucu verir (aşağıdaki 18 fixture bunun kanıtı).
 */
export function crc(bytes: Uint8Array, params: CrcParams): bigint {
  return crcBits(bytes, bytes.length * BITS_PER_BYTE, params);
}

/**
 * `crc()`nin bit uzunluğu alan kardeşi: `bytes`in İLK `bitLength` bitini işler,
 * gerisini yok sayar. Son bayt kısmiyse yalnız o baytın ÜST `bitLength % 8` biti
 * girer — bu, tel üzerindeki msb-first bit sırasının doğrudan karşılığıdır
 * (`decoding/bitCursor.ts`in varsayılanı da budur, iki modül aynı yönde sayar).
 *
 * `bitLength % 8 === 0` iken sonuç `crc()` ile BİREBİR aynıdır; testte de böyle
 * doğrulanır. Neden var olduğu ve neden dolgu kuralı yerine bu seçildiği dosya
 * başındaki "açık soru 4" notunda.
 *
 * `refin` KISMİ BAYTTA REDDEDİLİR: `refin` bir baytın 8 bitini kendi içinde ters
 * çevirir, elde yalnız 5 biti olan bir bayt için bu işlemin TANIMI YOKTUR. Sessizce
 * bir yorum seçmek (eldeki bitleri ters çevir? sıfırla doldur sonra çevir?) tam da
 * bu fonksiyonun engellemek için var olduğu şeydir, o yüzden atar.
 */
export function crcBits(bytes: Uint8Array, bitLength: number, params: CrcParams): bigint {
  if (!Number.isInteger(bitLength) || bitLength < 0) {
    throw new RangeError(`Bit uzunluğu negatif olmayan tam sayı olmalı: ${bitLength}`);
  }
  const availableBits = bytes.length * BITS_PER_BYTE;
  if (bitLength > availableBits) {
    throw new RangeError(`${bitLength} bit ${bytes.length} baytlık arabelleği aşıyor`);
  }

  const width = BigInt(params.width);
  const topBit = SINGLE_BIT << BigInt(params.width - 1);
  const mask = (SINGLE_BIT << width) - SINGLE_BIT;

  let register = params.init & mask;
  let remainingBits = bitLength;

  for (const byte of bytes) {
    if (remainingBits <= 0) break;
    const bitsFromByte = Math.min(BITS_PER_BYTE, remainingBits);
    if (params.refin && bitsFromByte < BITS_PER_BYTE) {
      throw new RangeError('refin kısmi bayt üzerinde tanımsızdır; bitLength 8’in katı olmalı');
    }
    const inputByte = params.refin ? reflectByte(byte) : BigInt(byte);
    // Kısmi baytta ALT bitler atılır: döngü en üst bitten başlar ve erken durur.
    for (let bitIndex = BITS_PER_BYTE - 1; bitIndex >= BITS_PER_BYTE - bitsFromByte; bitIndex--) {
      const inputBit = (inputByte >> BigInt(bitIndex)) & SINGLE_BIT;
      const topBitWasSet = (register & topBit) !== EMPTY_REGISTER ? SINGLE_BIT : EMPTY_REGISTER;
      register = (register << SINGLE_BIT) & mask;
      if ((topBitWasSet ^ inputBit) === SINGLE_BIT) {
        register ^= params.poly;
      }
    }
    remainingBits -= bitsFromByte;
  }

  if (params.refout) {
    register = reflectBits(register, params.width);
  }

  return (register ^ params.xorout) & mask;
}

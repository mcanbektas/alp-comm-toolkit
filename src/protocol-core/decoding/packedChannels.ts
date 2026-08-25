/**
 * Bit sınırı tanımayan, EŞİT GENİŞLİKLİ, ARDIŞIK kanal okuyucusu — Faz 10 dalga
 * 15c'nin doğurduğu paylaşılan yardımcı (`brief-faz10-dalga15c.md` "Ortak
 * yardımcı — sınır 14g'nin çizdiği yerde").
 *
 * ── Neden `protocol-core`da, `sbus.ts`te DEĞİL ──────────────────────────────
 * İki tüketici ŞİMDİDEN biliniyor: `sbus` (bu dalga, 16×11 bit) ve `crsf`
 * (15d, aynı 16×11 bit paketleme). CRSF bağı ANA THREAD'İN KENDİ ham kaynak
 * turuyla doğrulandı: Betaflight `rx/crsf.c:113-131`in
 * `crsfPayloadRcChannelsPacked_s`i, `rx/sbus_channels.h:30-47`in
 * `sbusChannels_t`siyle BİREBİR aynı bit düzenini taşıyor — yorum satırı bile
 * aynı (`// 176 bits of data (11 bits per channel * 16 channels) = 22 bytes.`).
 * TBS'in kendi spec'i AYRICA doğrulanmadı, iddia Betaflight'a dayanır.
 *
 * Alternatif — yardımcıyı
 * `sbus.ts`te doğurup 15d'de taşımak (14f→14g'nin `pulseLog` yolu) — burada
 * BİLEREK uygulanmadı: 14g'nin taşıma turu (dosya taşı, importları güncelle,
 * testleri taşı) bir maliyetti ve bu sefer iki tüketici baştan belli, taşımayı
 * beklemenin bir gerekçesi yok. `types.ts`e DOKUNULMUYOR — bu additive bir
 * ekleme (`crcBits`in 14e'deki emsali).
 *
 * ── Ne YAPAR ─────────────────────────────────────────────────────────────
 * `bitCursor.ts`in `readBitsAsNumber`ını ARDIŞIK kanallara döngüyle uygular:
 * `offset` baytından başlayarak `channelCount` adet `bitsPerChannel` genişliğinde
 * alanı, aralarında boşluk BIRAKMADAN, `bitOrder`a göre okur. `bitsPerChannel`
 * PARAMETREDİR çünkü CRSF'in 0x17 alt-küme çerçevesi 10/11/12/13 bit
 * kullanabiliyor (`rx/crsf.c:140-143` — ana thread doğruladı; brifin
 * `crsf_protocol.h:141-142` atfı YANLIŞ, o satırlar adres enum'udur).
 * SBUS'un sabit 11 bitine kilitli bir imza burada YAZILMAZ.
 *
 * ── Ne YAPMAZ (bilerek) ──────────────────────────────────────────────────
 * Değerin ANLAMINI türetmez: SBUS'ta ham paketli tam sayı 173–1812 aralığında
 * bir mikrosaniye DEĞİLDİR (kullanıcı kalibrasyonu, spec `:203`), CRSF'te ise
 * merkez 992 civarında ayrı bir formülle (`(x−992)×5/8+1500`) µs'ye çevrilir.
 * Ölçek/normalizasyon fonksiyonu bu dosyaya GİRMEZ — her protokol kendi
 * dosyasında yapar (`pulseLog.ts`in "konteyner TAŞINDI, TÜRETİM TAŞINMADI"
 * kuralı birebir, `:18-24`).
 *
 * ── `BitOrder` UYARISI (devralınan tuzak) ───────────────────────────────────
 * `bitCursor.ts`in varsayılanı `msb-first`tir. SBUS/CRSF'in paketlemesi ise
 * Betaflight/TBS referans C struct'larının little-endian hedefte LSB-FIRST
 * paketlenmesinden gelir (`brief-faz10-dalga15c.md` bulgu 5) — çağıran bunu
 * AÇIKÇA `'lsb-first'` geçmelidir. Yanlış sıra hata VERMEZ, yalnız değer
 * yanlış çıkar; `packedChannels.test.ts` bunu elle hesaplanmış bir fixture'la
 * kanıtlar (motor yazılmadan ÖNCE yazılan test — dalga 15c zorunlu disiplini).
 */

import { readBitsAsNumber } from './bitCursor';
import type { BitOrder } from './bitCursor';

const BITS_PER_BYTE = 8;

/**
 * `offset` baytından başlayan, `channelCount` adet ardışık `bitsPerChannel`
 * bitlik alanı okur ve ham (ölçeklenmemiş) sayı dizisi döner. Alanlar arasında
 * BOŞLUK YOKTUR — kanal `i`, bit konumu `offset*8 + i*bitsPerChannel`den başlar.
 *
 * `bitsPerChannel <= 53` olmalıdır (`readBitsAsNumber`in sınırı) — SBUS'un 11
 * biti ve CRSF'in 10-13 biti bu sınırın çok altında, pratikte hiç sorun değil.
 */
export function readPackedChannels(
  bytes: Uint8Array,
  offset: number,
  channelCount: number,
  bitsPerChannel: number,
  bitOrder: BitOrder,
): number[] {
  const startBit = offset * BITS_PER_BYTE;
  const values: number[] = [];
  for (let index = 0; index < channelCount; index += 1) {
    const bitPosition = startBit + index * bitsPerChannel;
    values.push(readBitsAsNumber(bytes, bitPosition, bitsPerChannel, bitOrder));
  }
  return values;
}

/**
 * Bir kanalın (0 tabanlı `channelIndex`) KAPSAYAN bayt aralığı.
 * `ParsedField.offset`/`length` BAYT cinsindendir (`types.ts`, kilitli
 * sözleşme); 11/12-bit bir alan bayt sınırını aştığından bu hesap gerekir —
 * `microwire.ts`in bit→bayt `byteSpan`iyle AYNI rol. Ardışık iki kanal AYNI
 * baytı paylaşabilir (`ParsedField.id` KENDİ offset'ini değil kanal İNDEKSİNİ
 * taşımalı — devralınan tuzak, `sbus.ts`/`ibus.ts`in id şeması bunu uygular).
 */
export function packedChannelByteSpan(
  offset: number,
  channelIndex: number,
  bitsPerChannel: number,
): { readonly offset: number; readonly length: number } {
  const bitOffset = channelIndex * bitsPerChannel;
  const firstByte = offset + Math.floor(bitOffset / BITS_PER_BYTE);
  const lastByte = offset + Math.floor((bitOffset + bitsPerChannel - 1) / BITS_PER_BYTE);
  return { offset: firstByte, length: lastByte - firstByte + 1 };
}

/**
 * Quad SPI / Octal SPI paylaşılan çekirdek — Command+Address+Data faz ayrımı.
 * Faz 10 dalga 11b. `quadSpi.ts`/`octalSpi.ts` bunun üstüne ince sarmal
 * (`hdlcCore.ts`nin HDLC/SDLC'ye yaptığının aynısı).
 *
 * ── Kapsam kararı: Address 3 bayt SABİT, Dummy HİÇ bayt tüketmez ──────────
 * Spec özeti (`01-fiziksel-arayuzler.md:240`) tek somut örnek veriyor: Command
 * 0xEB (gerçek/bilinen "Fast Read Quad I/O" opcode'u, JEDEC SPI NOR flash
 * konvansiyonu) + Address 0x001234 (3 bayt, BÜYÜK-UÇLU — SPI NOR flash
 * adresleme evrensel konvansiyonu, CRC bayt-sırası kadar standart bir bilgi,
 * ayrıca doğrulanmadı) + Dummy 6 cycle + Data. 4-baytlık adresleme (16MB üstü
 * flash'larda kullanılır) bu dalgada YOK — sabit 3 bayt varsayımı dokümante
 * edilmiş bir sınırlama (Microwire'ın "parametrik olmalı" uyarısıyla aynı
 * sınıf, ama spec'in TEK somut örneği 3 bayt olduğu için ona sadık kalındı).
 *
 * Dummy cycle'lar HİÇ veri taşımaz (hat tri-state) — kaç bayta karşılık
 * geldiği lane genişliğine bağlıdır ve bu bir ZAMANLAMA parametresidir (spec'in
 * "Toolkit girdileri" listesi Dummy Cycles'ı zamanlama hesaplayıcısının girdisi
 * sayıyor, `timing/spi.ts`teki `calculateSpiTransactionTiming`in
 * `dummySeconds` alanı bu yüzden var) — decode'un bayt ayrıştırmasında Dummy'e
 * karşılık gelen bir alan YOK, uydurulmadı.
 */

const COMMAND_LENGTH = 1;
/** Spec'in tek somut örneğine (0x001234) sadık — dosya başı kapsam kararı. */
export const QSPI_ADDRESS_LENGTH = 3;

export interface SpiPhaseSplit {
  readonly command: Uint8Array;
  readonly address: Uint8Array;
  readonly payload: Uint8Array;
}

/** noUncheckedIndexedAccess guard — bayt dizisi erişimi bu guard'dan geçer. */
export function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

const HEX_RADIX = 16;

export function formatHexByte(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(2, '0')}`;
}

/** 3 baytlık büyük-uçlu adres → tek sayı (dosya başı endianness notu). */
export function readAddress24BE(bytes: Uint8Array): number {
  return (byteAt(bytes, 0) << 16) | (byteAt(bytes, 1) << 8) | byteAt(bytes, 2);
}

export function formatHexAddress24(value: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(6, '0')}`;
}

/**
 * Command(1) + Address(sabit `addressLength`) + geri kalan Data olarak böler.
 * Girdi `addressLength`den kısaysa mevcut kısmı döndürür — kısmi capture'ları
 * hatasız gösterebilmek için; SPI ailesinde CRC/bütünlük kontrolü YOK, yapısal
 * zorunluluk (ParseFailure) gerektiren bir alan da yok.
 */
export function splitCommandAddressPayload(bytes: Uint8Array, addressLength: number): SpiPhaseSplit {
  const command = bytes.slice(0, COMMAND_LENGTH);
  const address = bytes.slice(COMMAND_LENGTH, COMMAND_LENGTH + addressLength);
  const payload = bytes.slice(COMMAND_LENGTH + addressLength);
  return { command, address, payload };
}

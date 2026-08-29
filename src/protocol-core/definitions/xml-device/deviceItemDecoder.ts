/**
 * Aygıt tanımındaki bir kalemin ham baytlardan çözülmesi.
 *
 * ── HANGİ KALEM ÇÖZÜLEBİLİR ─────────────────────────────────────────────────
 * Yalnız yerleşimi BİLİNENLER: `bitOffset` + `bitLength` taşıyan kalemler
 * (IODD süreç verisi, GSDML parametre kayıtları). SCL'in veri nesnelerinde
 * bayt yerleşimi YOKTUR — orada "değer" bir yapılandırma girdisidir, telde bir
 * konum değil. Yerleşimsiz kalemde çözüm denemek, olmayan bir hizalama
 * uydurmak olurdu; sonuç `unsupported` döner ve panel nedenini yazar.
 *
 * ── BİT SIRASI ──────────────────────────────────────────────────────────────
 * IO-Link süreç verisi MSB-first sayılır (IODD `bitOffset` en yüksek bitten
 * numaralandırır) ve GSDML parametre kayıtları da bayt hizalı büyük-endian
 * yazılır. Bu yüzden okuma `msb-first`; ayrı bir seçenek AÇILMADI, çünkü iki
 * standart da tek sıra tanımlıyor — seçenek koymak, dosyada olmayan bir
 * belirsizlik varmış gibi gösterirdi.
 */

import { readBits, toSignedBits } from '../../decoding/bitCursor';

import type { DeviceItem } from './deviceDescriptionTypes';

const BITS_PER_BYTE = 8;

/**
 * Biçimlerin tip adları AYRI sözlüklerden geliyor; eşleme burada AÇIKÇA
 * yapılır (`deviceDescriptionTypes.ts`: `dataType` normalize edilmez).
 * Tanınmayan tip ham bit dizisi olarak gösterilir — uydurulmuş bir yorum yok.
 */
type ValueKind = 'unsigned' | 'signed' | 'float' | 'boolean' | 'string' | 'raw';

const TYPE_KINDS: Readonly<Record<string, ValueKind>> = {
  // IODD (IO-Link)
  uintegert: 'unsigned',
  integert: 'signed',
  float32t: 'float',
  booleant: 'boolean',
  stringt: 'string',
  octetstringt: 'raw',
  timet: 'unsigned',
  // GSDML (PROFINET)
  unsigned8: 'unsigned',
  unsigned16: 'unsigned',
  unsigned32: 'unsigned',
  integer8: 'signed',
  integer16: 'signed',
  integer32: 'signed',
  float32: 'float',
  bit: 'boolean',
  bitarea: 'unsigned',
  visiblestring: 'string',
  octetstring: 'raw',
};

/** Tip adında genişlik yazıyorsa (Unsigned16) onu kullan; yoksa `bitLength` gerekir. */
const TYPE_WIDTHS: Readonly<Record<string, number>> = {
  unsigned8: 8,
  integer8: 8,
  bit: 1,
  unsigned16: 16,
  integer16: 16,
  unsigned32: 32,
  integer32: 32,
  float32: 32,
  float32t: 32,
};

export type DeviceItemDecodeResult =
  | {
      readonly success: true;
      readonly rawValue: bigint | number | string;
      /** Sözel karşılık bulunduysa o, yoksa ham değerin kendisi. */
      readonly displayValue: string;
      readonly unit?: string;
    }
  | { readonly success: false; readonly messageKey: string; readonly requiredBytes?: number };

function kindOf(dataType: string): ValueKind {
  return TYPE_KINDS[dataType.toLowerCase()] ?? 'raw';
}

export function itemBitLength(item: DeviceItem): number | undefined {
  return item.bitLength ?? TYPE_WIDTHS[item.dataType.toLowerCase()];
}

/**
 * Kalemin yerleşimi: süreç verisinde konum, parametrede BAŞTAN.
 *
 * Parametre bir çerçevede konumlanmaz — kendi isteğiyle (IO-Link ISDU, PROFINET
 * kayıt okuma) TEK BAŞINA okunur ve yanıtın baytları o parametrenindir. Onun
 * için 0'dan başlamak uydurma bir hizalama değil, biçimin kendi sözleşmesi.
 * Süreç verisi kaleminde ise konum ZORUNLUDUR: yoksa hangi bitin okunacağı
 * gerçekten bilinmiyordur.
 */
function layoutOffset(item: DeviceItem): number | undefined {
  if (item.bitOffset !== undefined) return item.bitOffset;
  return item.group === 'parameter' ? 0 : undefined;
}

/** Panelin "çözüm bölümünü aç" kararı: yerleşim + genişlik ikisi de gerekiyor. */
export function isDecodable(item: DeviceItem): boolean {
  return layoutOffset(item) !== undefined && itemBitLength(item) !== undefined;
}

export function decodeDeviceItem(item: DeviceItem, bytes: Uint8Array): DeviceItemDecodeResult {
  const bitLength = itemBitLength(item);
  const bitOffset = layoutOffset(item);
  if (bitOffset === undefined || bitLength === undefined) {
    return { success: false, messageKey: 'definition.xmlDevice.decode.noLayout' };
  }

  const endBit = bitOffset + bitLength;
  if (endBit > bytes.length * BITS_PER_BYTE) {
    return {
      success: false,
      messageKey: 'definition.xmlDevice.decode.tooShort',
      requiredBytes: Math.ceil(endBit / BITS_PER_BYTE),
    };
  }

  const rawBits = readBits(bytes, bitOffset, bitLength, 'msb-first');
  const kind = kindOf(item.dataType);

  switch (kind) {
    case 'boolean': {
      const value = rawBits !== 0n;
      return finish(item, value ? 1n : 0n, value ? 'true' : 'false');
    }
    case 'signed': {
      const value = toSignedBits(rawBits, bitLength);
      return finish(item, value, String(value));
    }
    case 'float': {
      // 32 bitten farklı genişlikte float tanımlı değil; öyle bir dosya
      // gelirse ham bit dizisi gösterilir.
      if (bitLength !== 32) return finish(item, rawBits, String(rawBits));
      const buffer = new ArrayBuffer(4);
      new DataView(buffer).setUint32(0, Number(rawBits), false);
      const value = new DataView(buffer).getFloat32(0, false);
      return finish(item, value, String(Number(value.toPrecision(9))));
    }
    case 'string': {
      // Metin bayt hizalı okunur; hizasız bir dizge tanımı standartlarda yok.
      const text = decodeAscii(bytes, bitOffset, bitLength);
      return finish(item, text, text);
    }
    case 'raw': {
      const hex = rawBits.toString(16).toUpperCase().padStart(Math.ceil(bitLength / 4), '0');
      return finish(item, rawBits, `0x${hex}`);
    }
    case 'unsigned':
      return finish(item, rawBits, String(rawBits));
  }
}

function decodeAscii(bytes: Uint8Array, bitOffset: number, bitLength: number): string {
  const start = Math.floor(bitOffset / BITS_PER_BYTE);
  const end = start + Math.ceil(bitLength / BITS_PER_BYTE);
  return Array.from(bytes.slice(start, end))
    .filter((byte) => byte !== 0)
    .map((byte) => String.fromCharCode(byte))
    .join('')
    .trim();
}

/** Sözel karşılık VARSA onu gösterir; yoksa sayıyı — karşılığı UYDURMAZ. */
function finish(
  item: DeviceItem,
  raw: bigint | number | string,
  fallback: string,
): DeviceItemDecodeResult {
  const label = item.values?.[String(raw)];
  return {
    success: true,
    rawValue: raw,
    displayValue: label ?? fallback,
    ...(item.unit === undefined ? {} : { unit: item.unit }),
  };
}

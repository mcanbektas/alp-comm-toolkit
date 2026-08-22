/**
 * Microwire — PARAMETRİK transaction motoru. Faz 10, dalga 11 (#11).
 *
 * ── Neden parametrik: spec bunu emrediyor ──────────────────────────────────
 * Spec (`… Platformu.md:2383`) açık: "Toolkit bu protokolü 'SPI ile aynı' kabul
 * etmemeli; cihaz datasheet'indeki Clock edge / Command length / Address length
 * / Word organization / 8-bit-16-bit organization bilgilerine göre transaction
 * oluşturmalıdır." Yani çerçevenin ŞEKLİ bu protokolde bir sabit değil, bir
 * GİRDİDİR. Sabit bir decoder yazmak spec'in yasakladığı şeyi yapmak olurdu.
 *
 * Bu yüzden `decodeMicrowire` bir profil alır; profil ya hazır bir preset'ten
 * ya da kullanıcının panelde girdiği serbest değerlerden gelir
 * (`ProtocolPlugin.decodeOptions` → `ParseContext.options`, `types.ts`).
 *
 * ── Kaynak doğrulaması (iki bağımsız datasheet, TAM tablo okundu) ──────────
 *   1. **Microchip DS20001749K** (93AA46A/B/C, 93LC46A/B/C, 93C46A/B/C),
 *      Tablo 1-3 (x16) ve 1-4 (x8). Buradan: Start Bit=1, Opcode 2 bit,
 *      x16'da Address A5–A0 (6 bit) + Data 16 bit, x8'de Address A6–A0 (7 bit)
 *      + Data 8 bit. Genişletilmiş komutlar (opcode `00`) adres alanının ÜST
 *      İKİ bitiyle ayrılır: `00`=EWDS, `01`=WRAL, `10`=ERAL, `11`=EWEN.
 *   2. **Microchip DS21794F** (93AA56/93LC56/93C56 ailesi), Tablo 1-3/1-4.
 *      Aynı komut kümesi, farklı adres genişliği: x16'da `X A6–A0` (9 değil,
 *      8 bitlik ALAN, üst bit don't-care), x8'de `X A7–A0` (9 bitlik alan).
 *
 * **Bağımsız çapraz doğrulama — clock sayısı:** her iki datasheet komut başına
 * "Req. CLK Cycles" sütunu veriyor ve bu sütun buradaki formülden TÜRETİLMEDİ,
 * onu SINIYOR: `1 (SB) + opcodeBits + addressBits + (veri varsa wordBits)`.
 * 46-x16 READ 25 ✓ / ERASE 9 ✓, 46-x8 READ 18 ✓ / ERASE 10 ✓, 56-x16 READ 27 ✓
 * / ERASE 11 ✓, 56-x8 READ 20 ✓ / ERASE 12 ✓ — sekiz bağımsız sayı, sekizi de
 * tutuyor. `microwire.test.ts` bu tabloyu kalıcı bekçi olarak sabitliyor.
 *
 * ── UYDURULMAYAN ŞEY: 93xx66 preset'i ─────────────────────────────────────
 * 93xx66 (4K bit) ailesinin komut tablosu yukarıdaki iki PDF'in HİÇBİRİNDE
 * yok. "56'nın deseni sürer, adres bir bit büyür" tahmini makul görünüyor ama
 * 56'nın x16'sındaki don't-care bit tam olarak bu tür tahminin nasıl
 * tutmadığını gösteriyor — 46'da yok, 56'da var. Preset LİSTESİNE ALINMADI;
 * 66 kullanıcısı `custom` profiliyle üç değeri kendi girer. (PMBus 1.5 yerine
 * 1.3.1 kullanılması, 1-Wire seri numarası endianness'ı ve ULINEAR16 üssüyle
 * aynı disiplin: kaynağı olmayan sayı basılmaz.)
 *
 * ── KAPSAM DIŞI (gerekçeli) ────────────────────────────────────────────────
 * - **Clock edge (SK polaritesi/fazı).** Spec datasheet girdileri arasında
 *   sayıyor ama bu motor YAKALANMIŞ BİT DİZİSİNİ çözer; edge seçimi yakalamayı
 *   ÜRETEN aracın ayarıdır, aynı bitleri farklı yorumlatmaz. `spi.ts`in CPOL/
 *   CPHA'yı yalnız zamanlama tarafında tutmasıyla aynı ayrım.
 * - **Self-timed write cycle (t_WC), RDY/BSY yoklaması.** Elektriksel/zamansal
 *   davranış; DI hattında bit üretmez.
 * - **93C ailesinin "rising edge of CLK before the last address bit" farkı**
 *   (DS20001749K §2.x): yazma çevriminin ne zaman başladığıyla ilgili, bit
 *   dizilimini değiştirmez.
 */

/** Datasheet'ten okunan transaction şekli. Üç sayı çerçevenin tamamını belirler. */
export interface MicrowireProfile {
  /** Opcode alanının bit genişliği. 93xx ailesinde 2. */
  readonly opcodeBits: number;
  /**
   * Adres alanının CLOCK'LANAN genişliği — don't-care üst bitler DAHİL.
   * 93xx56 x16'da 8'dir ama yalnız alt 7 biti adrestir; ayrım
   * `significantAddressBits` ile taşınır.
   */
  readonly addressBits: number;
  /**
   * Adresin ANLAMLI bit sayısı. Verilmezse `addressBits`e eşit sayılır.
   * Yalnız gösterim/ doğrulama için; çerçeve uzunluğunu `addressBits` belirler.
   */
  readonly significantAddressBits?: number;
  /** Veri sözcüğünün bit genişliği — 8 ya da 16 (spec'in "word organization"ı). */
  readonly wordBits: number;
}

export interface MicrowireProfilePreset extends MicrowireProfile {
  readonly id: string;
  /** Cihaz ailesi + organizasyon; arayüzde şık etiketi olarak basılır (veri, çeviri değil). */
  readonly label: string;
  /** Değerlerin okunduğu belge — kaynaksız preset eklenmez. */
  readonly source: string;
}

/**
 * YALNIZ tam tablosu okunmuş aileler. Sıra kullanıcıya görünen sıradır:
 * en yaygın (46) önce, organizasyon içinde x16 önce (93xx46B "dedicated
 * 16-bit" olarak satılan varyant).
 */
export const MICROWIRE_PROFILE_PRESETS: readonly MicrowireProfilePreset[] = [
  {
    id: '93xx46-x16',
    label: '93xx46B / 46C (ORG=1) — 64 × 16 bit',
    opcodeBits: 2,
    addressBits: 6,
    wordBits: 16,
    source: 'Microchip DS20001749K Table 1-3',
  },
  {
    id: '93xx46-x8',
    label: '93xx46A / 46C (ORG=0) — 128 × 8 bit',
    opcodeBits: 2,
    addressBits: 7,
    wordBits: 8,
    source: 'Microchip DS20001749K Table 1-4',
  },
  {
    id: '93xx56-x16',
    label: '93xx56B / 56C (ORG=1) — 128 × 16 bit',
    opcodeBits: 2,
    addressBits: 8,
    significantAddressBits: 7,
    wordBits: 16,
    source: 'Microchip DS21794F Table 1-3',
  },
  {
    id: '93xx56-x8',
    label: '93xx56A / 56C (ORG=0) — 256 × 8 bit',
    opcodeBits: 2,
    addressBits: 9,
    significantAddressBits: 8,
    wordBits: 8,
    source: 'Microchip DS21794F Table 1-4',
  },
];

/** Serbest profil şıkkının kimliği — preset listesinde YOKTUR, panel ekler. */
export const MICROWIRE_CUSTOM_PROFILE_ID = 'custom';

export type MicrowireCommand =
  | 'READ'
  | 'WRITE'
  | 'ERASE'
  | 'EWEN'
  | 'EWDS'
  | 'ERAL'
  | 'WRAL';

/** Start Bit her komutta 1 bit — datasheet'in SB sütunu. */
export const MICROWIRE_START_BIT_LENGTH = 1;

const OPCODE_READ = 0b10;
const OPCODE_WRITE = 0b01;
const OPCODE_ERASE = 0b11;
const OPCODE_EXTENDED = 0b00;

/** Opcode `00` iken adres alanının ÜST İKİ biti komutu seçer (iki datasheet de aynı). */
const EXTENDED_SELECTOR_BITS = 2;
const EXTENDED_EWDS = 0b00;
const EXTENDED_WRAL = 0b01;
const EXTENDED_ERAL = 0b10;
const EXTENDED_EWEN = 0b11;

/** Adres alanı komutun bir parçası mı, yoksa tamamı don't-care mi. */
const COMMANDS_WITH_ADDRESS: ReadonlySet<MicrowireCommand> = new Set<MicrowireCommand>([
  'READ',
  'WRITE',
  'ERASE',
]);

/** Veri sözcüğü taşıyan komutlar — READ'de yön slave→master, WRITE/WRAL'de master→slave. */
const COMMANDS_WITH_DATA: ReadonlySet<MicrowireCommand> = new Set<MicrowireCommand>([
  'READ',
  'WRITE',
  'WRAL',
]);

export function microwireCommandHasAddress(command: MicrowireCommand): boolean {
  return COMMANDS_WITH_ADDRESS.has(command);
}

export function microwireCommandHasData(command: MicrowireCommand): boolean {
  return COMMANDS_WITH_DATA.has(command);
}

/**
 * Datasheet'in "Req. CLK Cycles" sütununun formülü. Test bunu tablodaki sekiz
 * sayıya karşı sınıyor — formül veriden TÜRETİLMEDİ, veriyle DOĞRULANDI.
 */
export function microwireClockCycles(
  profile: MicrowireProfile,
  command: MicrowireCommand,
): number {
  return (
    MICROWIRE_START_BIT_LENGTH +
    profile.opcodeBits +
    profile.addressBits +
    (microwireCommandHasData(command) ? profile.wordBits : 0)
  );
}

export interface MicrowireTransferTimeInput {
  readonly profile: MicrowireProfile;
  readonly command: MicrowireCommand;
  /** SK frekansı (Hz). */
  readonly clockHz: number;
}

export interface MicrowireTransferTimeResult {
  readonly clockCycles: number;
  readonly transferSeconds: number;
}

export function calculateMicrowireTransferTime(
  input: MicrowireTransferTimeInput,
): MicrowireTransferTimeResult {
  const clockCycles = microwireClockCycles(input.profile, input.command);
  return {
    clockCycles,
    transferSeconds: input.clockHz <= 0 ? Number.POSITIVE_INFINITY : clockCycles / input.clockHz,
  };
}

/** Çözümlenmiş bir alanın bit cinsinden yeri — bayt ofseti YOK, çerçeve bit hizalı. */
export interface MicrowireBitField {
  readonly id: 'startBit' | 'opcode' | 'address' | 'data';
  readonly bitOffset: number;
  readonly bitLength: number;
  readonly value: number;
}

export interface MicrowireDecodeResult {
  readonly command: MicrowireCommand;
  readonly fields: readonly MicrowireBitField[];
  /** `command` adres taşımıyorsa `undefined` — don't-care biti adres diye basmak yalan olurdu. */
  readonly address?: number;
  readonly data?: number;
  /** Start bitinden ÖNCE atlanan sıfır sayısı (datasheet: CS/CLK/DI önce low'dur). */
  readonly leadingIdleBits: number;
  /** Komut bittikten sonra arabellekte kalan bit sayısı. */
  readonly trailingBits: number;
  readonly totalBits: number;
}

export type MicrowireDecodeFailure =
  | { readonly kind: 'no-start-bit' }
  | { readonly kind: 'truncated'; readonly requiredBits: number; readonly availableBits: number };

export type MicrowireDecodeOutcome =
  | { readonly ok: true; readonly result: MicrowireDecodeResult }
  | { readonly ok: false; readonly failure: MicrowireDecodeFailure };

const BITS_PER_BYTE = 8;

/** MSB-first tek bit. Microwire DI hattı en anlamlı bitten sürülür (her iki datasheet). */
function bitAt(data: Uint8Array, index: number): number {
  const byte = data[Math.floor(index / BITS_PER_BYTE)] ?? 0;
  return (byte >> (BITS_PER_BYTE - 1 - (index % BITS_PER_BYTE))) & 1;
}

function readBitRange(data: Uint8Array, start: number, length: number): number {
  let value = 0;
  for (let index = 0; index < length; index += 1) {
    value = (value << 1) | bitAt(data, start + index);
  }
  return value;
}

/** Seçici iki bitliktir; dört değerin dördü de burada karşılanır, boşluk yok. */
const EXTENDED_COMMANDS: ReadonlyMap<number, MicrowireCommand> = new Map([
  [EXTENDED_EWDS, 'EWDS'],
  [EXTENDED_WRAL, 'WRAL'],
  [EXTENDED_ERAL, 'ERAL'],
  [EXTENDED_EWEN, 'EWEN'],
]);

function resolveExtendedCommand(selector: number): MicrowireCommand {
  // Adres alanı iki bitten darsa (yalnız uydurma bir profilde olur) seçici
  // kırpılabilir; o durumda EWDS (seçici 0) dürüst varsayılandır.
  return EXTENDED_COMMANDS.get(selector) ?? 'EWDS';
}

/**
 * Yakalanmış DI baytlarını verilen profile göre çözer.
 *
 * **Start biti aranır, varsayılmaz.** DS20001749K §2.1: "The Start bit is
 * detected by the device if CS and DI are both high … Before a Start condition
 * is detected, CS, CLK and DI should be low." Yani yakalamanın başındaki
 * sıfırlar BEKLENEN durumdur; ilk `1` start bitidir. Kaç bit atlandığı
 * `leadingIdleBits` ile geri bildirilir — sessizce yutulmaz, çünkü çok sayıda
 * öncü sıfır "yakalama yanlış yerden başladı" işareti olabilir.
 */
export function decodeMicrowire(
  data: Uint8Array,
  profile: MicrowireProfile,
): MicrowireDecodeOutcome {
  const totalBits = data.length * BITS_PER_BYTE;

  let startBitIndex = -1;
  for (let index = 0; index < totalBits; index += 1) {
    if (bitAt(data, index) === 1) {
      startBitIndex = index;
      break;
    }
  }
  if (startBitIndex < 0) return { ok: false, failure: { kind: 'no-start-bit' } };

  const opcodeOffset = startBitIndex + MICROWIRE_START_BIT_LENGTH;
  const addressOffset = opcodeOffset + profile.opcodeBits;
  const commandBits = MICROWIRE_START_BIT_LENGTH + profile.opcodeBits + profile.addressBits;

  if (startBitIndex + commandBits > totalBits) {
    return {
      ok: false,
      failure: {
        kind: 'truncated',
        requiredBits: commandBits,
        availableBits: totalBits - startBitIndex,
      },
    };
  }

  const opcode = readBitRange(data, opcodeOffset, profile.opcodeBits);
  const addressField = readBitRange(data, addressOffset, profile.addressBits);

  let command: MicrowireCommand;
  if (opcode === OPCODE_READ) {
    command = 'READ';
  } else if (opcode === OPCODE_WRITE) {
    command = 'WRITE';
  } else if (opcode === OPCODE_ERASE) {
    command = 'ERASE';
  } else {
    // `OPCODE_EXTENDED` (00): komutu adres alanının ÜST İKİ biti seçer.
    // Opcode genişliği serbest profilde 2'den farklı olabilir; o durumda
    // "opcode sıfır" dalı yine buraya düşer ve seçici aynı şekilde okunur.
    void OPCODE_EXTENDED;
    const selector =
      profile.addressBits >= EXTENDED_SELECTOR_BITS
        ? addressField >> (profile.addressBits - EXTENDED_SELECTOR_BITS)
        : addressField;
    command = resolveExtendedCommand(selector);
  }

  const hasData = microwireCommandHasData(command);
  const dataOffset = addressOffset + profile.addressBits;
  const requiredBits = commandBits + (hasData ? profile.wordBits : 0);

  if (hasData && startBitIndex + requiredBits > totalBits) {
    return {
      ok: false,
      failure: {
        kind: 'truncated',
        requiredBits,
        availableBits: totalBits - startBitIndex,
      },
    };
  }

  const fields: MicrowireBitField[] = [
    {
      id: 'startBit',
      bitOffset: startBitIndex,
      bitLength: MICROWIRE_START_BIT_LENGTH,
      value: 1,
    },
    { id: 'opcode', bitOffset: opcodeOffset, bitLength: profile.opcodeBits, value: opcode },
    { id: 'address', bitOffset: addressOffset, bitLength: profile.addressBits, value: addressField },
  ];

  let data_: number | undefined;
  if (hasData) {
    data_ = readBitRange(data, dataOffset, profile.wordBits);
    fields.push({
      id: 'data',
      bitOffset: dataOffset,
      bitLength: profile.wordBits,
      value: data_,
    });
  }

  // Anlamlı adres: 93xx56 x16'nın üst don't-care biti maskelenir. Komut adres
  // taşımıyorsa alan tamamen don't-care/seçicidir — adres BASILMAZ.
  const significantBits = profile.significantAddressBits ?? profile.addressBits;
  const addressMask = significantBits >= 32 ? -1 >>> 0 : (1 << significantBits) - 1;

  return {
    ok: true,
    result: {
      command,
      fields,
      ...(microwireCommandHasAddress(command) ? { address: addressField & addressMask } : {}),
      ...(data_ === undefined ? {} : { data: data_ }),
      leadingIdleBits: startBitIndex,
      trailingBits: totalBits - (startBitIndex + requiredBits),
      totalBits: requiredBits,
    },
  };
}

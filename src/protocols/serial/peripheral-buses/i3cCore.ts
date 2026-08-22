/**
 * I3C çekirdeği — CCC kod haritası, BCR/DCR/PID çözümü. Faz 10, dalga 11 (#11).
 *
 * ── Kaynak: MIPI spec'i kapalı, kernel başlıkları açık ────────────────────
 * MIPI I3C spec'i kamuya açık indirilebilir DEĞİL (PMBus 1.5 ile aynı durum).
 * Bu yüzden sayısal sabitler Linux çekirdeğinin I3C alt sisteminden alındı —
 * GPL-2.0, Cadence Design Systems (Boris Brezillon/Bootlin), MIPI üyesi bir
 * şirketin spec'e göre yazdığı ve on yıldır sahada koşan uygulama:
 *   - `include/linux/i3c/ccc.h`    → CCC kod uzayının TAMAMI (aşağıdaki tablo)
 *   - `include/linux/i3c/device.h` → BCR bit haritası, PID bit alanları, DCR
 *   - `include/linux/i3c/master.h` → `I3C_BROADCAST_ADDR 0x7e`
 * Her sabitin yanında hangi satırdan geldiği yazılı değil; tablo başlığın
 * TAMAMINI kapsıyor ve `i3cCore.test.ts` her girdiyi ayrı ayrı sabitliyor.
 *
 * ── Spec özetinin istediği ve karşılanan ──────────────────────────────────
 * Spec (`… Platformu.md:1959`) dört şey istiyor: (1) PID/BCR/DCR/Static
 * Address/Dynamic Address alanları, (2) Broadcast ve Direct CCC'nin AYRI
 * kategoriler olarak çözülmesi — "CCC ID, yön, hedef ve payload", (3) IBI
 * timeline'ı, (4) bus discovery görünümü. Dördü de karşılanıyor.
 *
 * ── UYDURULMAYAN İKİ ŞEY ──────────────────────────────────────────────────
 * 1. **DCR tablosu.** Çekirdek yalnız TEK bir DCR değerine ad veriyor
 *    (`I3C_DCR_GENERIC_DEVICE = 0`). Sensör sınıfı kodları MIPI'nin ayrı bir
 *    kayıt belgesinde ve o belge açık değil. Bilinmeyen DCR ham bayt olarak
 *    basılır, uydurma bir sınıf adı BASILMAZ.
 * 2. **ENTDAA'da atanan adresin parite bitinin KABLODAKİ yeri.** İki
 *    çekirdek sürücüsü iki ayrı yer gösteriyor: `dw-i3c-master.c:864`
 *    adresi bit 6:0'a koyup pariteyi `BIT(7)`e yazıyor (bu bir DAT REGİSTER
 *    formatı), `svc-i3c-master.c:1075` ham 7-bit adresi donanıma verip
 *    pariteyi donanıma bıraktığı için hiçbir şey söylemiyor. İkisi de kablo
 *    baytını sabitlemiyor. Çözücü I²C adres-baytı konvansiyonunu
 *    (`DA<<1 | parite`) VARSAYAR ve bu varsayımı UYARI olarak basar —
 *    gizlemez. (1-Wire seri numarası endianness'ı → RS-232 gerilim aralığı →
 *    PMBus ULINEAR16 üssü zincirinin devamı.)
 *
 * ── KAPSAM DIŞI (gerekçeli) ───────────────────────────────────────────────
 * - **HDR (DDR/TSP/TSL) çerçeveleme.** Spec HDR'yi yalnız ADIYLA sayıyor, tek
 *   alan tarifi vermiyor; kernel başlığında da yalnız `ENTHDR0..7` giriş
 *   komutu var, HDR çerçevesinin kendisi yok. `ENTHDR` komutu TANINIR ("bus
 *   HDR moduna giriyor" diye çözülür), sonrasındaki HDR trafiği ÇÖZÜLMEZ.
 * - **Hot-Join.** Aynı gerekçe: `ENEC/DISEC`in HJ olay biti çözülür (kaynağı
 *   var), hot-join el sıkışmasının kendisi çözülmez.
 * - **12.5 / 33.3 Mbit/s hız rakamları.** Brief'in Açık Soru #8'i: bu sayılar
 *   MIPI versiyon-bağımlı ve spec özetinin dışında doğrulanamıyor. Hiçbir
 *   yerde SABİT olarak yazılmadı — zamanlama motoru YOK, katalogda `timing`
 *   sekmesi AÇILMADI.
 */

/** `include/linux/i3c/master.h`: `I3C_BROADCAST_ADDR 0x7e`. */
export const I3C_BROADCAST_ADDRESS = 0x7e;

/** `ccc.h`: `I3C_CCC_DIRECT BIT(7)` — kodun 7. biti Direct/Broadcast ayrımıdır. */
export const I3C_CCC_DIRECT_BIT = 0x80;

export type I3cCccKind = 'broadcast' | 'direct';

export interface I3cCccInfo {
  readonly name: string;
  readonly kind: I3cCccKind;
  /** Komut hedeften veri OKUR mu — Direct GET* ailesinde true. */
  readonly reads: boolean;
}

/**
 * `ccc.h`in tamamı. Broadcast ve Direct formu olan komutlar İKİ kez listelenir
 * (aynı ad, farklı kod) — kod uzayı düz bir haritadır, "id + bit7" hesabını
 * çözüm anında tekrar yapmak `SETXTIME`ı kaçırırdı: o komut deseni BOZAR
 * (broadcast 0x28, direct 0x98 — 0x28|0x80 = 0xA8 DEĞİL).
 */
export const I3C_CCC_CODES: ReadonlyMap<number, I3cCccInfo> = new Map<number, I3cCccInfo>([
  // --- Hem broadcast hem direct formu olanlar ---
  [0x00, { name: 'ENEC', kind: 'broadcast', reads: false }],
  [0x01, { name: 'DISEC', kind: 'broadcast', reads: false }],
  [0x02, { name: 'ENTAS0', kind: 'broadcast', reads: false }],
  [0x03, { name: 'ENTAS1', kind: 'broadcast', reads: false }],
  [0x04, { name: 'ENTAS2', kind: 'broadcast', reads: false }],
  [0x05, { name: 'ENTAS3', kind: 'broadcast', reads: false }],
  [0x06, { name: 'RSTDAA', kind: 'broadcast', reads: false }],
  [0x09, { name: 'SETMWL', kind: 'broadcast', reads: false }],
  [0x0a, { name: 'SETMRL', kind: 'broadcast', reads: false }],
  [0x80, { name: 'ENEC', kind: 'direct', reads: false }],
  [0x81, { name: 'DISEC', kind: 'direct', reads: false }],
  [0x82, { name: 'ENTAS0', kind: 'direct', reads: false }],
  [0x83, { name: 'ENTAS1', kind: 'direct', reads: false }],
  [0x84, { name: 'ENTAS2', kind: 'direct', reads: false }],
  [0x85, { name: 'ENTAS3', kind: 'direct', reads: false }],
  [0x86, { name: 'RSTDAA', kind: 'direct', reads: false }],
  [0x89, { name: 'SETMWL', kind: 'direct', reads: false }],
  [0x8a, { name: 'SETMRL', kind: 'direct', reads: false }],

  // --- Yalnız broadcast ---
  [0x07, { name: 'ENTDAA', kind: 'broadcast', reads: true }],
  [0x08, { name: 'DEFSLVS', kind: 'broadcast', reads: false }],
  [0x0b, { name: 'ENTTM', kind: 'broadcast', reads: false }],
  [0x20, { name: 'ENTHDR0', kind: 'broadcast', reads: false }],
  [0x21, { name: 'ENTHDR1', kind: 'broadcast', reads: false }],
  [0x22, { name: 'ENTHDR2', kind: 'broadcast', reads: false }],
  [0x23, { name: 'ENTHDR3', kind: 'broadcast', reads: false }],
  [0x24, { name: 'ENTHDR4', kind: 'broadcast', reads: false }],
  [0x25, { name: 'ENTHDR5', kind: 'broadcast', reads: false }],
  [0x26, { name: 'ENTHDR6', kind: 'broadcast', reads: false }],
  [0x27, { name: 'ENTHDR7', kind: 'broadcast', reads: false }],
  // Deseni BOZAN çift: broadcast 0x28, direct 0x98 (`ccc.h` I3C_CCC_SETXTIME).
  [0x28, { name: 'SETXTIME', kind: 'broadcast', reads: false }],

  // --- Yalnız direct ---
  [0x87, { name: 'SETDASA', kind: 'direct', reads: false }],
  [0x88, { name: 'SETNEWDA', kind: 'direct', reads: false }],
  [0x8b, { name: 'GETMWL', kind: 'direct', reads: true }],
  [0x8c, { name: 'GETMRL', kind: 'direct', reads: true }],
  [0x8d, { name: 'GETPID', kind: 'direct', reads: true }],
  [0x8e, { name: 'GETBCR', kind: 'direct', reads: true }],
  [0x8f, { name: 'GETDCR', kind: 'direct', reads: true }],
  [0x90, { name: 'GETSTATUS', kind: 'direct', reads: true }],
  [0x91, { name: 'GETACCMST', kind: 'direct', reads: true }],
  [0x93, { name: 'SETBRGTGT', kind: 'direct', reads: false }],
  [0x94, { name: 'GETMXDS', kind: 'direct', reads: true }],
  [0x95, { name: 'GETHDRCAP', kind: 'direct', reads: true }],
  [0x98, { name: 'SETXTIME', kind: 'direct', reads: false }],
  [0x99, { name: 'GETXTIME', kind: 'direct', reads: true }],
]);

/** `ccc.h`: `I3C_CCC_VENDOR(id, broadcast) ((id) + ((broadcast) ? 0x61 : 0xe0))`. */
const VENDOR_BROADCAST_BASE = 0x61;
const VENDOR_DIRECT_BASE = 0xe0;

export interface I3cCccLookup {
  readonly code: number;
  readonly name: string;
  readonly kind: I3cCccKind;
  readonly reads: boolean;
  /** Tabloda yok ama satıcı aralığında — ad üretilir, uydurulmuş bir anlam verilmez. */
  readonly vendorDefined: boolean;
  /** Ne tabloda ne satıcı aralığında; kod BASILIR, ad basılmaz. */
  readonly unknown: boolean;
}

export function lookupCcc(code: number): I3cCccLookup {
  const known = I3C_CCC_CODES.get(code);
  if (known !== undefined) {
    return { code, name: known.name, kind: known.kind, reads: known.reads, vendorDefined: false, unknown: false };
  }

  const isDirect = (code & I3C_CCC_DIRECT_BIT) !== 0;
  if (isDirect && code >= VENDOR_DIRECT_BASE) {
    return {
      code,
      name: `Vendor Direct #${String(code - VENDOR_DIRECT_BASE)}`,
      kind: 'direct',
      reads: false,
      vendorDefined: true,
      unknown: false,
    };
  }
  if (!isDirect && code >= VENDOR_BROADCAST_BASE) {
    return {
      code,
      name: `Vendor Broadcast #${String(code - VENDOR_BROADCAST_BASE)}`,
      kind: 'broadcast',
      reads: false,
      vendorDefined: true,
      unknown: false,
    };
  }

  return {
    code,
    name: 'Unknown CCC',
    kind: isDirect ? 'direct' : 'broadcast',
    reads: false,
    vendorDefined: false,
    unknown: true,
  };
}

// --- ENEC / DISEC olay bitleri (`ccc.h` I3C_CCC_EVENT_*) --------------------

const EVENT_SIR = 1 << 0;
const EVENT_MR = 1 << 1;
const EVENT_HJ = 1 << 3;

/** Kabul edilen üç bit; kalan beş bit ayrılmıştır ve ADLANDIRILMAZ. */
export function decodeEventMask(events: number): readonly string[] {
  const names: string[] = [];
  if ((events & EVENT_SIR) !== 0) names.push('SIR (Slave Interrupt Request)');
  if ((events & EVENT_MR) !== 0) names.push('MR (Master Request)');
  if ((events & EVENT_HJ) !== 0) names.push('HJ (Hot-Join)');
  return names;
}

// --- BCR (`device.h` I3C_BCR_*) --------------------------------------------

const BCR_ROLE_MASK = 0b11 << 6;
const BCR_ROLE_MASTER = 1 << 6;
const BCR_HDR_CAP = 1 << 5;
const BCR_BRIDGE = 1 << 4;
const BCR_OFFLINE_CAP = 1 << 3;
const BCR_IBI_PAYLOAD = 1 << 2;
const BCR_IBI_REQ_CAP = 1 << 1;
const BCR_MAX_DATA_SPEED_LIM = 1 << 0;

export interface I3cBcrDecoded {
  /** `device.h` yalnız iki rolü adlandırıyor (`I3C_BCR_I3C_SLAVE`/`_MASTER`). */
  readonly role: 'Target' | 'Controller-capable' | 'Reserved';
  readonly hdrCapable: boolean;
  readonly bridge: boolean;
  readonly offlineCapable: boolean;
  readonly ibiPayload: boolean;
  readonly ibiRequestCapable: boolean;
  readonly maxDataSpeedLimited: boolean;
}

export function decodeBcr(bcr: number): I3cBcrDecoded {
  const roleBits = bcr & BCR_ROLE_MASK;
  return {
    role: roleBits === 0 ? 'Target' : roleBits === BCR_ROLE_MASTER ? 'Controller-capable' : 'Reserved',
    hdrCapable: (bcr & BCR_HDR_CAP) !== 0,
    bridge: (bcr & BCR_BRIDGE) !== 0,
    offlineCapable: (bcr & BCR_OFFLINE_CAP) !== 0,
    ibiPayload: (bcr & BCR_IBI_PAYLOAD) !== 0,
    ibiRequestCapable: (bcr & BCR_IBI_REQ_CAP) !== 0,
    maxDataSpeedLimited: (bcr & BCR_MAX_DATA_SPEED_LIM) !== 0,
  };
}

/** `device.h`: `enum i3c_dcr { I3C_DCR_GENERIC_DEVICE = 0 }` — adlandırılan TEK değer. */
const DCR_GENERIC_DEVICE = 0x00;

export function decodeDcr(dcr: number): string | undefined {
  return dcr === DCR_GENERIC_DEVICE ? 'Generic Device' : undefined;
}

// --- PID (`device.h` I3C_PID_*) --------------------------------------------

export const I3C_PID_BYTE_LENGTH = 6;

export interface I3cPidDecoded {
  readonly raw: bigint;
  /** Bit 47–33, 15 bit. */
  readonly manufacturerId: number;
  /** Bit 32. Kurulduğunda alt 32 bit RASTGELEDİR — part/instance ANLAMSIZDIR. */
  readonly randomLower32: boolean;
  /** Bit 31–16. `randomLower32` iken `undefined` — rastgele biti part id diye basmak yalan olurdu. */
  readonly partId?: number;
  /** Bit 15–12. Aynı gerekçe. */
  readonly instanceId?: number;
  /** Bit 11–0. Aynı gerekçe. */
  readonly extraInfo?: number;
  /** `randomLower32` iken alt 32 bitin ham değeri. */
  readonly randomValue?: number;
}

/** PID kabloda BIG ENDIAN taşınır (`ccc.h`: "48 bits PID in big endian"). */
export function decodePid(bytes: Uint8Array): I3cPidDecoded {
  let raw = 0n;
  for (let index = 0; index < I3C_PID_BYTE_LENGTH; index += 1) {
    raw = (raw << 8n) | BigInt(bytes[index] ?? 0);
  }

  const manufacturerId = Number((raw >> 33n) & 0x7fffn);
  const randomLower32 = ((raw >> 32n) & 1n) === 1n;

  if (randomLower32) {
    return {
      raw,
      manufacturerId,
      randomLower32,
      randomValue: Number(raw & 0xffffffffn),
    };
  }

  return {
    raw,
    manufacturerId,
    randomLower32,
    partId: Number((raw >> 16n) & 0xffffn),
    instanceId: Number((raw >> 12n) & 0xfn),
    extraInfo: Number(raw & 0xfffn),
  };
}

// --- GETSTATUS (`ccc.h` I3C_CCC_STATUS_*) ----------------------------------

const STATUS_PENDING_INT_MASK = 0x000f;
const STATUS_PROTOCOL_ERROR = 1 << 5;
const STATUS_ACTIVITY_MODE_SHIFT = 6;
const STATUS_ACTIVITY_MODE_MASK = 0b11;

export interface I3cStatusDecoded {
  readonly pendingInterrupt: number;
  readonly protocolError: boolean;
  readonly activityMode: number;
}

/** GETSTATUS gövdesi 16 bit big endian (`struct i3c_ccc_getstatus { __be16 status }`). */
export function decodeStatus(status: number): I3cStatusDecoded {
  return {
    pendingInterrupt: status & STATUS_PENDING_INT_MASK,
    protocolError: (status & STATUS_PROTOCOL_ERROR) !== 0,
    activityMode: (status >> STATUS_ACTIVITY_MODE_SHIFT) & STATUS_ACTIVITY_MODE_MASK,
  };
}

// --- Adres baytı -----------------------------------------------------------

/**
 * I3C, I²C ile aynı hatları paylaşır ve adres baytı konvansiyonunu korur:
 * 7-bit adres üstte, R/W biti altta. `i2c.ts`teki `address7Bit` ile aynı hesap,
 * ama o dosya feature değil protokol — feature'lar arası import yasağı burada
 * geçerli değil; yine de kopyalanıyor çünkü iki protokolün adres kavramı
 * zamanla ayrışabilir (I3C'de 0x7E ayrılmıştır, I²C'de değil).
 */
export function i3cAddress7Bit(addressByte: number): number {
  return (addressByte >> 1) & 0x7f;
}

export function i3cIsReadAddress(addressByte: number): boolean {
  return (addressByte & 0x01) === 1;
}

export function i3cIsBroadcastAddress(addressByte: number): boolean {
  return i3cAddress7Bit(addressByte) === I3C_BROADCAST_ADDRESS;
}

/** ENTDAA'da her hedefin gönderdiği tanıtım bloğu: PID(6) + BCR(1) + DCR(1). */
export const I3C_DAA_DESCRIPTOR_LENGTH = I3C_PID_BYTE_LENGTH + 2;

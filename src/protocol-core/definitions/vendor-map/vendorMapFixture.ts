/**
 * Örnek kayıt haritası ve ona ait örnek register baytları.
 *
 * ── KAYNAK: UYDURMA DEĞİL, SENTETİK ─────────────────────────────────────────
 * Bu tablo GERÇEK bir cihazın kılavuzundan alınmış gibi sunulmuyor; öyle
 * sunmak, doğrulanamaz bir kaynağı kaynak diye göstermek olurdu. Tablo,
 * üretici haritalarında fiilen görülen KOLON DESENLERİNİ örneklemek için
 * yazıldı: ölçekli gerilim, işaretli sıcaklık, iki register'a yayılan sayaç,
 * float32 güç, bit ağacı taşıyan durum register'ı, sözlüklü mod alanı ve ASCII
 * seri numarası. Adresler Modbus'un 4xxxx holding register bloğunun tipik
 * yerleşimini izler.
 *
 * Sayısal değerler kendi içinde TUTARLI: aşağıdaki `SAMPLE_VENDOR_MAP_BYTES`
 * her girdinin baytlarını haritadaki ölçekle birlikte doğrulanabilir kılar
 * (bkz. `vendorMapDecoder.test.ts` — aynı sayılar orada bağımsızca yazıldı).
 */

/** Panelin varsayılan örneği: virgül ayraçlı, üstbilgi yorumlu CSV. */
export const SAMPLE_VENDOR_MAP_CSV = `# device: Örnek Enerji Ölçer
# vendor: ALP Comm Toolkit
# revision: 1.0
# wordOrder: high-first
address,name,type,space,length,scale,unit,access,bits,enum,description
40001,Line Voltage,uint16,holding,,0.1,V,r,,,Faz-nötr gerilimi
40002,Board Temperature,int16,holding,,0.1,°C,r,,,Kart üzeri sensör
40003,Active Energy,uint32,holding,,1,Wh,r,,,İki register — yüksek önce
40005,Active Power,float32,holding,,1,W,r,,,IEEE 754 tek duyarlık
40007,Status Word,bitfield,holding,,,,r,0=Ready;1=Fault;3=Overload,,Durum bitleri
40008,Operating Mode,enum,holding,,,,rw,,0=Idle;1=Run;2=Service,Çalışma modu
40009,Serial Number,ascii,holding,4,,,r,,,Sekiz karakter
`;

/**
 * Örnek register baytları — yukarıdaki haritanın girdilerine karşılık gelir.
 * Her biri TEK girdinin baytıdır (çerçevenin tamamı değil); `decodeVendorMap-
 * Entry` sözleşmesi de böyle: adresten bayta inmek çağıranın işi.
 */
export const SAMPLE_VENDOR_MAP_BYTES: Readonly<Record<string, Uint8Array>> = {
  /** 0x08FC = 2300 → ×0.1 = 230.0 V */
  '40001': Uint8Array.from([0x08, 0xfc]),
  /** 0xFEF2 = -270 → ×0.1 = -27.0 °C */
  '40002': Uint8Array.from([0xfe, 0xf2]),
  /** 0x0001_86A0 = 100000 Wh */
  '40003': Uint8Array.from([0x00, 0x01, 0x86, 0xa0]),
  /** 0x44FA_0000 = 2000.0 W */
  '40005': Uint8Array.from([0x44, 0xfa, 0x00, 0x00]),
  /** 0x0009 → bit0 (Ready) ve bit3 (Overload) set */
  '40007': Uint8Array.from([0x00, 0x09]),
  /** 0x0001 → "Run" */
  '40008': Uint8Array.from([0x00, 0x01]),
  /** "ALP-0001" */
  '40009': Uint8Array.from([0x41, 0x4c, 0x50, 0x2d, 0x30, 0x30, 0x30, 0x31]),
};

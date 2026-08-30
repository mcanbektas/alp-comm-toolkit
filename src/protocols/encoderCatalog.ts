/**
 * `ProtocolPlugin.encoder`in ROL DEFTERİ — encoder tüketicilerinin tek girişi.
 *
 * ## Neden ayrı bir defter gerekiyor
 *
 * `ProtocolEncoder<TMessage>` tek bir şey söyler: "bir mesajı bayta çeviririm".
 * SÖYLEMEDİĞİ şey, o mesajın NE olduğudur. Ölçüldüğünde (2026-08-29) 14
 * encoder'ın girdisi iki kümeye düşüyor ve ikisi boru hattının FARKLI
 * aşamalarına ait:
 *
 * - **`payload`** (10 kayıt): yük → çerçevelenmiş bayt. Bir taşıma zarfıdır;
 *   Packet Builder'da çerçeveleme (post-processing) aşamasına düşer.
 * - **`values`** (4 kayıt): alan kimliği → değer eşlemesi (`EncodeValues`) →
 *   çerçeve. Bir üretim yoludur; form doldurulup çerçeve ÜRETİLİR.
 *
 * Bu ayrımı tipe yazmak `protocol-core/types.ts`teki sözleşmeyi açmak olurdu
 * (CLAUDE.md'de kilitli karar). Bunun yerine ayrım BİLDİRİM olarak burada
 * duruyor — `PROTOCOL_CATEGORIES` ↔ `DOMAIN_IDS` ikilisiyle aynı disiplin:
 * kopya bir liste, ama `encoderCatalog.test.ts` iki yönlü karşılaştırıyor.
 * `encoder:` taşıyan her plugin burada olmak, buradaki her kayıt gerçek bir
 * encoder'a denk gelmek zorunda; ayrışma DERLEMEDE değil TESTTE kırmızıya
 * döner ve sessiz kalamaz.
 *
 * ## Neden `pluginId` ile duruyor, plugin'i içe aktarmıyor
 *
 * Registry LAZY (`protocols/index.ts`): her motor kendi chunk'ında. Defter
 * plugin modüllerini statik içe aktarsaydı, rol listesini okumak isteyen ekran
 * 14 motoru da indirirdi. Burada yalnız kimlik ve rol var; motor gerektiğinde
 * `loadProtocolPlugin(pluginId)` ile gelir.
 */

import type { ProtocolSchema } from '@/protocol-core/schemas/protocolSchema';

/** Encoder'ın girdisinin hangi kümeye düştüğü — dosya başındaki iki aile. */
export type EncoderRole = 'payload' | 'values';

interface EncoderEntryBase {
  readonly pluginId: string;
  /**
   * Plugin'in `name` alanıyla BİREBİR aynı. Protokol adı veridir, çeviriye
   * girmez (CLAUDE.md); burada tekrar edilmesinin tek sebebi listeyi motorları
   * indirmeden çizebilmek. Defter testi ikisini karşılaştırır.
   */
  readonly displayName: string;
}

/**
 * Yük → çerçeve. Packet Builder'ın çerçeveleme aşamasında kullanılır.
 */
export interface PayloadEncoderEntry extends EncoderEntryBase {
  readonly role: 'payload';
  /**
   * Aynı baytı üreten YERLEŞİK post-processing dalı varsa kimliği. Tüketici o
   * dalı kullanır ve plugin'i hiç yüklemez: `packetPipeline` bu iki fonksiyonu
   * (`encodeSlip`, `encodeCobsFrame`) zaten `protocol-core/framing`ten doğrudan
   * çağırıyor, ikinci bir yol açmak aynı baytı iki adla listelemek olurdu.
   */
  readonly builtInEquivalent?: 'cobs' | 'slip';
  /**
   * Tek parametreli `encode` sözleşmesinin SABİTLEDİĞİ parametrelerin çeviri
   * anahtarı. Sözleşme `encode(message)` olduğu için blok numarası / mod gibi
   * ikinci parametreler sarmalda sabitlenmiştir (bkz. `xmodem.ts:208`);
   * kullanıcı bunu ekranda görmeli, sürprizle karşılaşmamalı.
   */
  readonly fixedParametersKey?: string;
}

/** Değer eşlemesinden üretilen çerçevenin şeması ve form tohumu. */
export interface ValuesEncoderDefinition {
  /** Formu çizen şema — plugin'in KENDİ şeması, defterde kopyası yok. */
  readonly schema: ProtocolSchema;
  /**
   * Alan yolu → form METNİ. Yalnız encoder'ın kendi varsayılanı olan alanlar
   * için dolar (`rf-telemetry`nin preamble/sync sözcüğü). Değerler plugin'in
   * dışa açtığı sabitlerden TÜRETİLİR; defter bayt kopyalamaz.
   */
  readonly seedValues?: Readonly<Record<string, string>>;
}

/**
 * `EncodeValues` → çerçeve. Packet Builder'da şema tabanlı yolun YANINDA
 * ikinci bir üretim kaynağıdır.
 */
export interface ValuesEncoderEntry extends EncoderEntryBase {
  readonly role: 'values';
  /** Şemayı (ve varsa tohumu) plugin'in kendi modülünden getirir; lazy. */
  readonly load: () => Promise<ValuesEncoderDefinition>;
}

export type EncoderEntry = PayloadEncoderEntry | ValuesEncoderEntry;

/** Bayt dizisini form metnine çevirir — tohum değerleri sabitlerden türetilir. */
function toHexSeed(bytes: readonly number[]): string {
  return bytes.map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join('');
}

/**
 * Defterin kendisi. Sıra ekranda göründüğü sıradır: önce yerleşik karşılığı
 * olanlar, sonra yalnız plugin ile gelenler.
 */
export const ENCODER_CATALOG: readonly EncoderEntry[] = [
  // --- payload ailesi ------------------------------------------------------
  { pluginId: 'cobs', displayName: 'COBS', role: 'payload', builtInEquivalent: 'cobs' },
  { pluginId: 'slip', displayName: 'SLIP', role: 'payload', builtInEquivalent: 'slip' },
  {
    pluginId: 'kiss',
    displayName: 'KISS',
    role: 'payload',
    // Plugin encoder'ı `encodeSlip`in KENDİSİ: KISS komut baytını EKLEMEZ.
    fixedParametersKey: 'builder.encoder.fixed.kiss',
  },
  { pluginId: 'hdlc', displayName: 'HDLC', role: 'payload' },
  { pluginId: 'sdlc', displayName: 'SDLC', role: 'payload' },
  { pluginId: 'ppp', displayName: 'PPP', role: 'payload' },
  { pluginId: 'delimiter-based-protocol', displayName: 'Delimiter-Based Protocol', role: 'payload' },
  // XMODEM/YMODEM'in sarmalı `encodeXmodemBlock`u çağırır ve o fonksiyon
  // 128/1024 DIŞINDAKİ her uzunlukta `RangeError` fırlatır (`xmodemCore.ts:169`
  // — "kullanıcı girdisiyle çağrılmaz" diye yazılmıştı, bu tüketici onu
  // kullanıcı girdisiyle çağıran ilk yerdir). Kısıt gizlenmiyor: not ekranda
  // ÖNCEDEN görünüyor, fırlatınca da paket üretilmiyor.
  {
    pluginId: 'xmodem',
    displayName: 'XMODEM',
    role: 'payload',
    fixedParametersKey: 'builder.encoder.fixed.xmodem',
  },
  {
    pluginId: 'ymodem',
    displayName: 'YMODEM',
    role: 'payload',
    fixedParametersKey: 'builder.encoder.fixed.ymodem',
  },
  {
    pluginId: 'zmodem',
    displayName: 'ZMODEM',
    role: 'payload',
    fixedParametersKey: 'builder.encoder.fixed.zmodem',
  },

  // Modbus'un üç taşıyıcısı AYNI girdiyi alır (adres/unit + PDU) ve yalnız
  // zarfta ayrılır — taşıyıcılar arası dönüşümün (spec §33) dayanağı bu.
  { pluginId: 'modbus-rtu', displayName: 'Modbus RTU', role: 'payload' },
  { pluginId: 'modbus-ascii', displayName: 'Modbus ASCII', role: 'payload' },
  {
    pluginId: 'modbus-tcp',
    displayName: 'Modbus TCP',
    role: 'payload',
    fixedParametersKey: 'builder.encoder.fixed.modbusTcp',
  },

  // --- values ailesi -------------------------------------------------------
  {
    pluginId: 'ascii-protocol',
    displayName: 'ASCII Protocol',
    role: 'values',
    load: async () => {
      const module = await import('./serial/framing/asciiProtocol');
      return { schema: module.ASCII_PROTOCOL_SCHEMA };
    },
  },
  {
    pluginId: 'custom-binary-protocol',
    displayName: 'Custom Binary Protocol',
    role: 'values',
    load: async () => {
      // Şema `protocol-core`un spec fixture'ında: plugin de oradan okuyor.
      const module = await import('@/protocol-core/schemas/specFixture');
      return { schema: module.SPEC_SENSOR_PROTOCOL };
    },
  },
  {
    pluginId: 'length-based-protocol',
    displayName: 'Length-Based Protocol',
    role: 'values',
    load: async () => {
      const module = await import('./serial/framing/lengthBasedProtocol');
      return { schema: module.LENGTH_BASED_PROTOCOL_SCHEMA };
    },
  },
  {
    pluginId: 'rf-telemetry-custom-frame',
    displayName: 'RF Telemetry Custom Frame',
    role: 'values',
    load: async () => {
      // Ağır plugin modülü DEĞİL, yalnız profil modülü yüklenir: şema ve
      // varsayılan baytlar orada, parser orada değil.
      const module = await import('./wireless/rftelemetry/rfTelemetryProfiles');
      return {
        schema: module.buildRfTelemetrySchema(module.DEFAULT_LAYOUT, undefined),
        // `encodeRfTelemetryFrame` bu iki alanı verilmediğinde kendi
        // varsayılanıyla doldurur (`rfTelemetry.ts:625-629`). Form onları BOŞ
        // gösterseydi boş bayt dizisi varsayılanı EZERDİ — tohum bu yüzden var.
        seedValues: {
          preamble: toHexSeed(module.SPEC_PREAMBLE_BYTES),
          syncWord: toHexSeed(module.SPEC_SYNC_WORD_BYTES),
        },
      };
    },
  },
];

export const PAYLOAD_ENCODERS: readonly PayloadEncoderEntry[] = ENCODER_CATALOG.filter(
  (entry): entry is PayloadEncoderEntry => entry.role === 'payload',
);

export const VALUES_ENCODERS: readonly ValuesEncoderEntry[] = ENCODER_CATALOG.filter(
  (entry): entry is ValuesEncoderEntry => entry.role === 'values',
);

export function findEncoderEntry(pluginId: string): EncoderEntry | undefined {
  return ENCODER_CATALOG.find((entry) => entry.pluginId === pluginId);
}

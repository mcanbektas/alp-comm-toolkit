/**
 * Protocol Converter'ın (spec §33) tipleri.
 *
 * Spec'in kendi örneği bu üç parçayı sayar ve dosya da onları ayrı tutar:
 *
 * ```
 * Source:      Modbus Register 40001
 * Transform:   value × 0.1
 * Destination: MQTT Topic: sensors/temperature
 * ```
 *
 * KAYNAK bir ALAN KİMLİĞİDİR, bayt aralığı değil: çevirinin girdisi ham bayt
 * olsaydı kullanıcı her protokolün yerleşimini elle bilmek zorunda kalırdı;
 * oysa alanı zaten kaynak protokolün parser'ı adlandırıyor. Dönüşüm bu yüzden
 * `ParsedFrame` ÜZERİNDE çalışır, `Uint8Array` üzerinde değil.
 */

import type { TranslationKey } from '@/translations';

/** Spec §33'ün "Transform" satırı. `value × k + c`nin dört hâli. */
export type TransformKind = 'none' | 'scale' | 'offset' | 'scaleOffset';

/** Tek bir eşleme satırı: kaynak alan → dönüşüm → hedef ad. */
export interface FieldMapping {
  /** Satır kimliği; kullanıcı verisi değil, listeyi çizmek için. */
  readonly id: string;
  readonly sourceFieldId: string;
  readonly transform: TransformKind;
  /** `scale`/`scaleOffset`te çarpan. Diğerlerinde yok sayılır. */
  readonly factor: number;
  /** `offset`/`scaleOffset`te eklenen. Diğerlerinde yok sayılır. */
  readonly addend: number;
  /**
   * Hedefteki ad: JSON anahtarı, CSV sütunu ya da MQTT topic'i. Kullanıcı
   * verisidir, çeviriye girmez.
   */
  readonly destinationName: string;
}

/**
 * Hedef biçimi. Üçü spec §33'ün örnek dönüşüm listesinden geliyor:
 * "CAN DBC signal → JSON", "J1939 SPN → CSV", "Modbus register → MQTT topic".
 *
 * JSON ve CSV METİN üretir; `mqtt-publish` GERÇEK BAYT üretir ve bunu
 * `mqtt` plugin'inin encoder'ıyla yapar — çevirinin hedef tarafı bu yüzden
 * uydurma değil, monitörün çözdüğü paketin aynısıdır.
 */
export type DestinationKind = 'json' | 'csv' | 'mqtt-publish';

/** Dönüşümden geçmiş tek değer. */
export interface ConvertedValue {
  readonly mappingId: string;
  readonly destinationName: string;
  /** Kaynak alanın adı — çıktının nereden geldiği ekranda görünmeli. */
  readonly sourceFieldName: string;
  /** Sayısal alanlarda dönüşüm uygulanmış değer; metin alanlarında ham metin. */
  readonly value: number | string;
}

/** `mqtt-publish` hedefinde üretilen tek paket. */
export interface ConvertedPacket {
  readonly mappingId: string;
  readonly topic: string;
  readonly bytes: Uint8Array;
}

/**
 * Çevirinin bir sorunu. `messageKey` çeviri anahtarıdır, `params` yer tutucu
 * doldurur — Packet Builder'ın `PacketIssue`siyle aynı disiplin: motor METİN
 * üretmez, anahtar üretir.
 */
export interface ConversionIssue {
  readonly mappingId: string | null;
  readonly messageKey: TranslationKey;
  readonly params?: Readonly<Record<string, string>>;
}

/**
 * Çevirinin tamamı. `issues` DOLU olsa bile `values` üretilir: bir satırın
 * kaynağı kaybolduğunda öbür satırların çıktısını da silmek, kullanıcıya
 * çalışan işi göstermemek olurdu (spec §47: "hatalı veride uygulamayı
 * çökertme").
 */
export interface ConversionOutput {
  readonly values: readonly ConvertedValue[];
  /** JSON/CSV metni; `mqtt-publish` hedefinde paketlerin hex dökümü. */
  readonly text: string;
  readonly packets: readonly ConvertedPacket[];
  readonly issues: readonly ConversionIssue[];
}

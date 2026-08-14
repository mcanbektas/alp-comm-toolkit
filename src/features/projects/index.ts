/**
 * Proje kaydet/yükle özelliğinin dış yüzü — spec §40, §48.
 *
 * Sıra bağımlılık yönünü izler: saf biçim tanımı → onu kullanan panel.
 *
 * TUZAK: `app/store/protocolSchemaStore` bu barrel'ı DEĞİL, doğrudan
 * `./projectFile`ı içe aktarır. Barrel bileşeni de taşıdığı için store buradan
 * çekseydi React'e ve panelin bütün bağımlılıklarına bağlanır, üstelik panel →
 * store → barrel → panel döngüsü kurulurdu.
 */

export * from './projectFile';
export * from './ProjectPanel';

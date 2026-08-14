/**
 * Katalog kaydı ile plugin registry arasındaki tek bağ.
 *
 * Katalog "bu protokol var" der, registry "motoru yüklenebilir" der; ikisini
 * birbirine bağlayan alan `CatalogProtocol.pluginId`. Bu çözümün ayrı bir modülde
 * durmasının sebebi ALIAS kayıtlarıdır: aynı motor birden çok domain sayfasında
 * göründüğü için "kaydın pluginId'sini oku" yetmez, önce kanonik kayda inmek
 * gerekir. Bu kural tek yerde yaşamazsa her çağıran kendi yarım hâlini yazar ve
 * bina sayfası motoru olmayan bir Modbus gösterir.
 */

import { findEntry } from '@/app/catalog';
import type { CatalogEntry, CatalogProtocol, ImplementationStatus } from '@/app/catalog';

/**
 * Katalog erişimi dizi olarak değil FONKSİYON olarak alınır: çözüm yalnız
 * "tam yol → kayıt" aramasına ihtiyaç duyar, ve testler 172 kayıtlık gerçek
 * katalog yerine üç satırlık sahte katalogla koşabilir.
 */
export type CatalogEntryLookup = (path: string) => CatalogEntry | undefined;

/**
 * Kaydın motorunu veren plugin id'si; motor yoksa `null`.
 *
 * Alias kaydı KENDİ `pluginId`'sine bakılmadan kanonik kayda indirilir — alias'ın
 * varlık sebebi motoru paylaşmaktır, ikinci bir kayıt açmak değil. Kanonik kayıtta
 * da alan yoksa protokol henüz `planned` demektir.
 */
export function resolvePluginId(
  protocol: CatalogProtocol,
  catalog: CatalogEntryLookup = findEntry,
): string | null {
  let current = protocol;
  /** Ziyaret edilen alias yolları — katalog testi zinciri yasaklıyor ama bozuk veri sonsuz döngüye çevirmemeli. */
  const visited = new Set<string>();

  while (current.aliasOf !== undefined) {
    const aliasPath = current.aliasOf;
    if (visited.has(aliasPath)) return null;
    visited.add(aliasPath);

    const canonical = catalog(aliasPath);
    // Kırık alias yolu: kayıt var ama işaret ettiği kanonik kayıt yok. Burada
    // fırlatmak sayfayı çökertirdi; motorsuz göstermek doğru davranış.
    if (canonical === undefined) return null;
    current = canonical.protocol;
  }

  return current.pluginId ?? null;
}

/**
 * Rozette gösterilecek olgunluk durumu — alias kaydında KANONİK kaydınki.
 *
 * Neden türetiliyor da alias kaydına yazılmıyor: alias'ın varlık sebebi kanonik
 * kaydı ikinci bir sayfada göstermektir, ikinci bir gerçek kaynağı olmak değil.
 * Ölçüldü (2026-08-14): Modbus motoru bağlandıktan sonra kanonik sayfa "Hazır",
 * bina otomasyonu ve denizcilik alias sayfaları hâlâ "Planlandı" rozeti taşıyordu
 * — ekranda çalışan bir çözümleyicinin altında. Durumu iki yere yazmak bu kaymayı
 * her yeni motorda tekrar üretirdi; NMEA ve J1939'un da alias'ları var.
 */
export function resolveStatus(
  protocol: CatalogProtocol,
  catalog: CatalogEntryLookup = findEntry,
): ImplementationStatus {
  let current = protocol;
  const visited = new Set<string>();

  while (current.aliasOf !== undefined) {
    const aliasPath = current.aliasOf;
    if (visited.has(aliasPath)) return current.status;
    visited.add(aliasPath);

    const canonical = catalog(aliasPath);
    // Kırık alias yolu: kaydın kendi durumu son çare.
    if (canonical === undefined) return current.status;
    current = canonical.protocol;
  }

  return current.status;
}

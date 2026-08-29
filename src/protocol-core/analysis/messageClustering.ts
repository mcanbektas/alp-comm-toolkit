/**
 * Mesaj kümelendirme — spec §35'in "Mesaj kümelendirme" maddesi.
 *
 * ── ALGORİTMA SPEC'TE YOK, SEÇİM BURADA GEREKÇELENİR ──────────────────────
 * Spec yalnız özelliği sayar, yöntemi söylemez. Seçilen yöntem İMZA TABANLI
 * kümeleme: küme anahtarı = (çerçeve uzunluğu) + (birkaç ayırt edici başlık
 * baytının değeri).
 *
 * k-means / hiyerarşik kümeleme bilerek REDDEDİLDİ:
 *
 * · Bayt değerleri metrik uzayda anlamlı değil. 0x05 ile 0x06 arasındaki
 *   "uzaklık" 1, 0x05 ile 0xF0 arasındaki 235'tir; oysa ikisi de yalnızca
 *   FARKLI mesaj tipidir. Öklit uzaklığı burada uydurma bir yakınlık üretir.
 * · Merkez başlangıcı rastgeledir: aynı yakalama aynı kümeleri vermezdi.
 *   Reverse engineering'de kullanıcı kümeyi elle doğruluyor, kararsız çıktı
 *   doğrulanamaz.
 * · k (küme sayısı) önceden bilinmiyor ve protokolde "mesaj tipi sayısı"nın
 *   sürekli bir karşılığı yok.
 * · 100 bin çerçevede tek geçiş şart (§44); k-means her yinelemede bütün
 *   kümeyi dolaşır.
 *
 * İmza yöntemi tek geçişli, deterministik ve AÇIKLANABİLİR: kullanıcı kümenin
 * neden var olduğunu okuyabiliyor ("uzunluk 7 + bayt 2 = 0x10").
 *
 * ── AYIRT EDİCİ BAYT NASIL SEÇİLİR ────────────────────────────────────────
 * Başlık bölgesinde (ilk `headerBytes` bayt) DÜŞÜK ama birden çok değerli
 * sütunlar aranır: sabit bir sütun (tek değer) hiçbir şeyi ayırmaz, yüksek
 * kardinaliteli bir sütun (sayaç, payload) her çerçeveyi kendi kümesine atar.
 * Aday sütunlar önce kardinalitesi küçük olandan sıralanır — mesaj tipi alanı
 * tipik olarak birkaç değer alır.
 *
 * Seçim BÜTÜN küme üzerinde bir kez yapılır (küme başına yeniden seçim, kümenin
 * kendi içindeki sabitleri ayırt edici sanardı).
 *
 * Sayaç sütunları ayrıca ELENİR. Az sayıda çerçevede bir sayaç da "birkaç farklı
 * değer" gösterir ve kardinalite eşiğini geçer; imzaya girerse her çerçeve kendi
 * kümesine düşer. Eleme `counterDetect` ile yapılır — kümeleme kendi sayaç
 * ölçütünü uydurmaz.
 */

import { profileByteColumns } from './byteColumns';
import { detectCounters } from './counterDetect';
import type { AnalysisFrame } from './types';

const DEFAULT_HEADER_BYTES = 4;
const DEFAULT_MAX_SIGNATURE_OFFSETS = 2;
const DEFAULT_MAX_DISTINCT_VALUES = 8;
const MIN_DISTINCT_VALUES = 2;

export interface MessageClusterOptions {
  /** İmza baytlarının aranacağı başlık bölgesi genişliği. */
  readonly headerBytes?: number;
  /** İmzaya girecek azami bayt sayısı. */
  readonly maxSignatureOffsets?: number;
  /** Bu kadar çok farklı değer alan sütun ayırt edici sayılmaz (sayaç/payload). */
  readonly maxDistinctValues?: number;
  /** Çerçeve uzunluğu imzaya girsin mi. Varsayılan açık. */
  readonly includeLength?: boolean;
  /** Seçim atlanır, imza baytları doğrudan verilir (kullanıcı kararı). */
  readonly signatureOffsets?: readonly number[];
}

export interface ClusterSignatureByte {
  readonly offset: number;
  /** Çerçeve o kadar uzun değilse `undefined` — eksiklik de ayırt edicidir. */
  readonly value: number | undefined;
}

export interface MessageCluster {
  /** Kümenin insan tarafından okunabilir kimliği; aynı girdi aynı anahtarı verir. */
  readonly key: string;
  readonly signature: readonly ClusterSignatureByte[];
  /** `includeLength` kapalıysa `undefined`. */
  readonly frameLength: number | undefined;
  /** Girdideki sıraları; küme içi sıra korunur. */
  readonly frameIndices: readonly number[];
  readonly size: number;
}

/**
 * İmzaya girecek bayt konumlarını seçer. Ayırt edici sütun bulunamazsa boş
 * dizi döner — o durumda kümeleme yalnız uzunluğa dayanır (ya da tek küme).
 */
export function selectSignatureOffsets(
  frames: readonly AnalysisFrame[],
  options: MessageClusterOptions = {},
): number[] {
  if (options.signatureOffsets !== undefined) return [...options.signatureOffsets];
  if (frames.length === 0) return [];

  const headerBytes = options.headerBytes ?? DEFAULT_HEADER_BYTES;
  const maxOffsets = options.maxSignatureOffsets ?? DEFAULT_MAX_SIGNATURE_OFFSETS;
  const maxDistinct = options.maxDistinctValues ?? DEFAULT_MAX_DISTINCT_VALUES;

  const profiles = profileByteColumns(frames).filter((profile) => profile.offset < headerBytes);
  const discriminating = profiles.filter(
    (profile) => profile.distinctCount >= MIN_DISTINCT_VALUES && profile.distinctCount <= maxDistinct,
  );

  const counterOffsets = new Set<number>();
  for (const counter of detectCounters(frames)) {
    for (let index = 0; index < counter.width; index++) counterOffsets.add(counter.offset + index);
  }

  const usable = discriminating.filter((profile) => !counterOffsets.has(profile.offset));
  usable.sort((left, right) => left.distinctCount - right.distinctCount || left.offset - right.offset);
  return usable.slice(0, Math.max(0, maxOffsets)).map((profile) => profile.offset).sort((a, b) => a - b);
}

export function clusterMessages(
  frames: readonly AnalysisFrame[],
  options: MessageClusterOptions = {},
): MessageCluster[] {
  if (frames.length === 0) return [];
  const includeLength = options.includeLength ?? true;
  const offsets = selectSignatureOffsets(frames, options);

  const buckets = new Map<string, { signature: ClusterSignatureByte[]; length: number | undefined; indices: number[] }>();

  frames.forEach((frame, index) => {
    const signature: ClusterSignatureByte[] = offsets.map((offset) => ({
      offset,
      value: offset < frame.bytes.length ? frame.bytes[offset] : undefined,
    }));
    const lengthPart = includeLength ? `len=${frame.bytes.length}` : '';
    const bytePart = signature
      .map((entry) => `@${entry.offset}=${entry.value === undefined ? '-' : toHexByte(entry.value)}`)
      .join(' ');
    const key = [lengthPart, bytePart].filter((part) => part.length > 0).join(' ') || 'all';

    const bucket = buckets.get(key);
    if (bucket === undefined) {
      buckets.set(key, {
        signature,
        length: includeLength ? frame.bytes.length : undefined,
        indices: [index],
      });
      return;
    }
    bucket.indices.push(index);
  });

  const clusters: MessageCluster[] = [];
  for (const [key, bucket] of buckets) {
    clusters.push({
      key,
      signature: bucket.signature,
      frameLength: bucket.length,
      frameIndices: bucket.indices,
      size: bucket.indices.length,
    });
  }

  // Büyük küme önce: kullanıcı önce ana trafiği görmeli. Eşitlikte anahtar
  // sırası — çıktı deterministik kalsın diye.
  return clusters.sort((left, right) => right.size - left.size || left.key.localeCompare(right.key));
}

/** Kümenin çerçevelerini girdi sırasıyla verir. */
export function framesOfCluster(
  frames: readonly AnalysisFrame[],
  cluster: MessageCluster,
): AnalysisFrame[] {
  const selected: AnalysisFrame[] = [];
  for (const index of cluster.frameIndices) {
    const frame = frames[index];
    if (frame !== undefined) selected.push(frame);
  }
  return selected;
}

function toHexByte(value: number): string {
  return value.toString(16).padStart(2, '0').toUpperCase();
}

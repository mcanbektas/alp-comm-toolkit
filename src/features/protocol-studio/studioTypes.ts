/**
 * Custom Protocol Studio'nun KATMANLAR ARASI sözleşmesi — spec §9.
 *
 * Ekran, dört panel ve `useProtocolStudio` ancak burada anlaşırlar. Tipleri
 * panellerin kendi dosyalarına dağıtmak yerine tek yerde toplamanın sebebi
 * yön: paneller birbirini TANIMAZ, hepsi yalnız bu dosyaya bakar. Aksi hâlde
 * `FrameViewPanel`'in prop'unu değiştirmek `FieldListPanel`'i içe aktarmayı
 * gerektirirdi ve döngüsel bağımlılık kaçınılmaz olurdu.
 *
 * Bu dosya YALNIZ TİP taşır; tek bir çalışma zamanı değeri bile yoktur. Bütün
 * içe aktarımları `import type` olduğundan derlemede tamamen silinir — zod'u
 * (`schemas/protocolSchema`) ve altı kod üreticisini (`codegen`) buradan içe
 * aktarmak pakete hiçbir bayt eklemez.
 */

import type { ByteRegion } from '@/components/byte-viewer';
import type { ParseResult, SchemaIssue } from '@/protocol-core';
import type { GeneratedArtifact } from '@/protocol-core/codegen';
import type { ProtocolSchema } from '@/protocol-core/schemas/protocolSchema';
import type { DraftIssue, FieldDraft, SchemaDraft } from './schemaDraft';

/**
 * Taslağın alan listesi DIŞINDA kalan her şeyi: ad, sürüm, açıklama,
 * çerçeveleme, varsayılan bayt sırası.
 *
 * Alanlar bilerek dışarıda: onların kendi ekleme/silme/taşıma işlemleri var ve
 * `Partial<SchemaDraft>` kabul eden tek bir `updateMeta` yazılsaydı çağıran
 * yanlışlıkla bütün alan ağacını tek yamayla ezebilirdi.
 */
export type SchemaDraftMeta = Omit<SchemaDraft, 'fields'>;

/**
 * JSON içe aktarmanın sonucu. `boolean` DEĞİL: başarısızlıkta gösterilecek
 * çeviri anahtarı sonucun kendisiyle birlikte taşınmalı, yoksa çağıran hangi
 * mesajı basacağını tahmin etmek zorunda kalır (spec §40 "Error handling").
 */
export type LoadSchemaOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly errorKey: string };

/**
 * Studio'nun bütün durumu ve eylemleri. Ekran bu nesneyi alır ve panellere
 * dağıtır; hesabın hiçbiri bileşende değildir (CLAUDE.md mimari kuralı).
 */
export interface ProtocolStudioApi {
  readonly draft: SchemaDraft;
  readonly selectedDraftId: string | null;
  /** `selectedDraftId` taslakta artık yoksa `null` — silinen alan seçili kalamaz. */
  readonly selectedField: FieldDraft | null;
  /** Taslak şemaya çevrilemiyorsa `null`; yarım şema üretilmez. */
  readonly schema: ProtocolSchema | null;
  /** Taslak katmanının biçim sorunları (boş ad, geçersiz sayı metni…). */
  readonly draftIssues: readonly DraftIssue[];
  /** Şema anlamlı mı: kapsam sırası, çakışan ofset, eksik uzunluk… */
  readonly schemaIssues: readonly SchemaIssue[];
  readonly sampleHex: string;
  /** `sampleHex` çözülemiyorsa boş — bozuk girdi eski baytları yaşatmaz. */
  readonly sampleBytes: Uint8Array;
  readonly hexErrorKey: string | null;
  readonly parseResult: ParseResult | null;
  /** Yalnız başarılı ayrıştırmada dolu; başarısızlıkta boş dizi. */
  readonly regions: readonly ByteRegion[];
  /** Şema varsa altı üreticinin çıktısı, yoksa boş dizi. */
  readonly artifacts: readonly GeneratedArtifact[];
  readonly selectField: (draftId: string | null) => void;
  readonly addField: (parentDraftId: string | null) => void;
  readonly removeField: (draftId: string) => void;
  readonly duplicateField: (draftId: string) => void;
  readonly updateField: (draftId: string, patch: Partial<FieldDraft>) => void;
  readonly moveField: (parentDraftId: string | null, fromIndex: number, toIndex: number) => void;
  readonly updateMeta: (patch: Partial<SchemaDraftMeta>) => void;
  readonly setSampleHex: (hex: string) => void;
  readonly loadSchemaJson: (json: string) => LoadSchemaOutcome;
  readonly resetToSpecFixture: () => void;
}

/**
 * Alan ağacı paneli.
 *
 * Sorunları `draftId`'ye göre gruplanmış ALIR, kendi taramaz: aynı listeyi her
 * satır için baştan süzmek alan sayısıyla karesel maliyet demektir.
 */
export interface FieldListPanelProps {
  readonly draft: SchemaDraft;
  readonly selectedDraftId: string | null;
  readonly issuesByDraftId: ReadonlyMap<string, readonly DraftIssue[]>;
  readonly onSelect: (draftId: string | null) => void;
  readonly onAdd: (parentDraftId: string | null) => void;
  readonly onRemove: (draftId: string) => void;
  readonly onDuplicate: (draftId: string) => void;
  readonly onMove: (parentDraftId: string | null, fromIndex: number, toIndex: number) => void;
}

/** Örnek çerçeve paneli: hex girdisi + renkli bayt görüntüleyici. */
export interface FrameViewPanelProps {
  readonly bytes: Uint8Array;
  readonly regions: readonly ByteRegion[];
  readonly hexInput: string;
  readonly hexErrorKey: string | null;
  readonly selectedRegionId: string | null;
  readonly onHexInputChange: (hex: string) => void;
  readonly onSelectRegion: (regionId: string | null) => void;
}

/** Seçili alanın özellikleri. Alan seçili değilse `field === null` ve panel boş durumu basar. */
export interface FieldPropertiesPanelProps {
  readonly field: FieldDraft | null;
  readonly issues: readonly DraftIssue[];
  readonly onChange: (patch: Partial<FieldDraft>) => void;
}

/** Çıktı paneli: ayrıştırma sonucu, sorunlar ve üretilen kod. */
export interface OutputPanelProps {
  readonly parseResult: ParseResult | null;
  readonly draftIssues: readonly DraftIssue[];
  readonly schemaIssues: readonly SchemaIssue[];
  readonly artifacts: readonly GeneratedArtifact[];
  /** İndirme adı ve başlık için; şema geçersizken de bir ad gösterilmeli. */
  readonly schemaName: string;
}

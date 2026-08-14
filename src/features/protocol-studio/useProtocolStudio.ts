/**
 * Custom Protocol Studio'nun beyni — spec §9.
 *
 * ## Tek yönlü zincir
 *
 * Ekranda dört panel var ama TEK doğruluk kaynağı var: taslak. Geri kalan her
 * şey ondan türetilir ve zincir tek yönlüdür:
 *
 *   draft → schema → (schemaIssues, artifacts, store)
 *                 ↘ parseResult → regions
 *   sampleHex → sampleBytes ↗
 *
 * Türetilenlerin hiçbiri `useState`'te TUTULMAZ. Tutulsaydı iki durum
 * (taslak ve ondan üretilen şema) senkron kalmak zorunda olurdu; senkronu
 * bozan tek bir yol bile "ekranda gördüğüm alan, üretilen kodda yok" sınıfı
 * bir hataya dönüşür. `useMemo` ile türetmek bu sınıfı tamamen kaldırır.
 *
 * ## Maliyet
 *
 * Kullanıcı her tuş vuruşunda taslağı değiştirir; zincirin tamamı bu hızda
 * koşamaz. Bu yüzden pahalı adımlar KENDİ girdilerine bağlanır:
 *
 * - Altı kod üreticisi yalnız `schema` (ve dokümanın örnek çerçevesi için
 *   `sampleBytes`) değişince koşar. Alan ADINI değiştirmek şemayı değiştirir,
 *   ama örnek hex'i düzenlemek üreticileri yeniden çalıştırmaz.
 * - Geçersiz taslakta `schema` `null`'dır; üreticiler ve doğrulayıcı hiç
 *   çağrılmaz. Yarım yazılmış bir protokolde en pahalı iş kendiliğinden durur.
 *
 * ## Store'a yazma
 *
 * Packet Builder aynı protokolü görsün diye şema paylaşılan store'a yazılır —
 * ama YALNIZ geçerliyse ve `useEffect` içinde. Render sırasında yazmak başka
 * bir bileşenin state'ini çizim ortasında değiştirmek demektir (React uyarısı,
 * ve iki ekran birden bağlıyken sonsuz döngü riski).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useProtocolSchemaStore } from '@/app/store/protocolSchemaStore';
import {
  collectSchemaBitRanges,
  parsedFrameToRegions,
} from '@/components/byte-viewer/parsedFieldAdapter';
import type { ByteRegion } from '@/components/byte-viewer/types';
import { bytesToHex, hexToBytes } from '@/protocol-core/buffers/representation';
import {
  generateCParser,
  generateCStruct,
  generateJsonSchemaOutput,
  generateMarkdownDoc,
  generatePythonParser,
  generateTypeScriptParser,
} from '@/protocol-core/codegen';
import type { GeneratedArtifact } from '@/protocol-core/codegen';
import { parseWithSchema } from '@/protocol-core/decoding/schemaParser';
import { parseProtocolSchemaJson } from '@/protocol-core/schemas/protocolSchema';
import { SPEC_SENSOR_FRAME, SPEC_SENSOR_PROTOCOL } from '@/protocol-core/schemas/specFixture';
import type { ParseResult } from '@/protocol-core/types';
import { validateProtocolSchema } from '@/protocol-core/validation/schemaValidation';
import type { SchemaIssue } from '@/protocol-core/validation/schemaValidation';
import {
  addField as appendFieldToDraft,
  createEmptyDraft,
  createFieldDraft,
  draftToSchema,
  duplicateField as duplicateFieldInDraft,
  findFieldDraft,
  moveField as moveFieldInDraft,
  removeField as removeFieldFromDraft,
  schemaToDraft,
  updateField as updateFieldInDraft,
} from './schemaDraft';
import type { FieldDraft, SchemaDraft } from './schemaDraft';
import type { LoadSchemaOutcome, ProtocolStudioApi, SchemaDraftMeta } from './studioTypes';

/** Spec §42'nin "Invalid hexadecimal input" metninin anahtarı. */
const HEX_ERROR_KEY = 'studio.error.invalidHex';
/** İçe aktarılan JSON şema olarak okunamadığında. */
const SCHEMA_JSON_ERROR_KEY = 'studio.error.invalidSchemaJson';

// Boş sonuçlar tek örnek üzerinden verilir: her hesaplamada yeni `[]` üretmek
// panelleri (React.memo) girdi değişmediği hâlde yeniden çizdirirdi.
const EMPTY_BYTES = new Uint8Array(0);
const EMPTY_REGIONS: readonly ByteRegion[] = [];
const EMPTY_ARTIFACTS: readonly GeneratedArtifact[] = [];
const EMPTY_SCHEMA_ISSUES: readonly SchemaIssue[] = [];

interface SampleBytesResult {
  readonly bytes: Uint8Array;
  readonly errorKey: string | null;
}

/**
 * Açılış taslağı store'daki şemadan gelir; Packet Builder'dan ya da önceki
 * oturumdan kalan protokol Studio'da açık bulunur.
 *
 * Store metni doğrulamaz (bkz. `protocolSchemaStore` yorumu), o yüzden burada
 * bozuk çıkabilir. Bozukta boş taslağa düşmek, kullanıcıyı hata ekranıyla
 * karşılamaktan iyidir: eski kayıt zaten kurtarılamaz, çalışmaya devam
 * edilebilir bir yer gerekir.
 */
function createInitialDraft(): SchemaDraft {
  const parsed = parseProtocolSchemaJson(useProtocolSchemaStore.getState().schemaJson);
  return parsed.success ? schemaToDraft(parsed.schema) : createEmptyDraft();
}

function specFixtureHex(): string {
  return bytesToHex(SPEC_SENSOR_FRAME);
}

export function useProtocolStudio(): ProtocolStudioApi {
  const [draft, setDraft] = useState<SchemaDraft>(createInitialDraft);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [sampleHex, setSampleHexState] = useState<string>(specFixtureHex);

  const setSchemaJson = useProtocolSchemaStore((state) => state.setSchemaJson);

  const conversion = useMemo(() => draftToSchema(draft), [draft]);
  const schema = conversion.schema;
  const draftIssues = conversion.issues;

  // Şema `null` iken doğrulayıcı çağrılmaz: zod'u geçmemiş bir nesne için
  // "kapsam sırası yanlış" demek kullanıcıyı ikinci bir hata listesiyle
  // boğar, oysa asıl sorun taslak katmanında zaten raporlandı.
  const validation = useMemo(
    () => (schema === null ? null : validateProtocolSchema(schema)),
    [schema],
  );
  const schemaIssues = validation === null ? EMPTY_SCHEMA_ISSUES : validation.issues;

  const sample = useMemo<SampleBytesResult>(() => {
    if (sampleHex.trim() === '') {
      // Boş girdi hata değil, "henüz örnek yok" demektir.
      return { bytes: EMPTY_BYTES, errorKey: null };
    }
    try {
      return { bytes: hexToBytes(sampleHex), errorKey: null };
    } catch {
      // `hexToBytes` tek hane / alfabe dışı karakteri fırlatarak bildirir ve
      // mesajı İngilizce sabit metindir. Ham metni ekrana taşımak yerine
      // anahtara çeviriyoruz — görünen her metin sözlükten gelir.
      return { bytes: EMPTY_BYTES, errorKey: HEX_ERROR_KEY };
    }
  }, [sampleHex]);

  const sampleBytes = sample.bytes;

  const parseResult = useMemo<ParseResult | null>(() => {
    if (schema === null || sampleBytes.length === 0) {
      return null;
    }
    return parseWithSchema(schema, sampleBytes);
  }, [schema, sampleBytes]);

  const regions = useMemo<readonly ByteRegion[]>(() => {
    if (schema === null || parseResult === null || !parseResult.success) {
      return EMPTY_REGIONS;
    }
    // Bit pencereleri ŞEMADAN toplanır, ayrıştırma sonucundan değil: bir bit
    // alanının etiketi ("flags [3:5]") çerçevede değil tanımda yazar.
    return parsedFrameToRegions(parseResult.frame, {
      bitRanges: collectSchemaBitRanges(schema),
    });
  }, [parseResult, schema]);

  const artifacts = useMemo<readonly GeneratedArtifact[]>(() => {
    if (schema === null) {
      return EMPTY_ARTIFACTS;
    }
    return [
      generateJsonSchemaOutput(schema),
      generateCStruct(schema),
      generateCParser(schema),
      generatePythonParser(schema),
      generateTypeScriptParser(schema),
      // Örnek çerçeve yalnız dokümana basılır; baytlar boşsa bölüm hiç yazılmaz.
      generateMarkdownDoc(schema, { exampleFrame: sampleBytes }),
    ];
  }, [schema, sampleBytes]);

  /**
   * Store'a yazılacak metin. Üretici İKİNCİ kez çağrılmıyor: `artifacts`
   * zaten JSON çıktısını içeriyor ve o dizi `sampleBytes` yüzünden yeniden
   * kurulsa bile buradaki METİN aynı kalır — etkinin bağımlılığı metin
   * olduğundan örnek hex'i düzenlemek store'a gereksiz yazma tetiklemez.
   */
  const publishedJson = useMemo<string | null>(() => {
    if (validation === null || !validation.valid) {
      return null;
    }
    const jsonArtifact = artifacts.find((artifact) => artifact.id === 'json-schema');
    return jsonArtifact === undefined ? null : jsonArtifact.code;
  }, [artifacts, validation]);

  useEffect(() => {
    if (publishedJson === null) {
      return;
    }
    // Aynı metni yeniden yazmak store aboneliklerini ve localStorage'ı boşuna
    // tetikler; `getState` ile okumak ise bu bileşeni store'a ABONE ETMEZ,
    // yoksa her yazma kendi yeniden çizimini doğururdu.
    if (useProtocolSchemaStore.getState().schemaJson === publishedJson) {
      return;
    }
    setSchemaJson(publishedJson);
  }, [publishedJson, setSchemaJson]);

  const selectedField = useMemo(
    () => (selectedDraftId === null ? null : findFieldDraft(draft, selectedDraftId)),
    [draft, selectedDraftId],
  );

  // Seçili alan taslaktan kaybolabilir: silinir, JSON içe aktarılır, fixture'a
  // dönülür. Kimliği her işlemde ayrı ayrı temizlemek yerine tek yerde
  // toparlıyoruz — böylece ileride eklenecek bir işlem bu adımı unutamaz.
  useEffect(() => {
    if (selectedDraftId !== null && selectedField === null) {
      setSelectedDraftId(null);
    }
  }, [selectedDraftId, selectedField]);

  const selectField = useCallback((draftId: string | null) => {
    setSelectedDraftId(draftId);
  }, []);

  const addField = useCallback((parentDraftId: string | null) => {
    // Alan güncelleyicinin DIŞINDA üretilir: React geliştirme kipinde
    // güncelleyiciyi iki kez çağırır ve içeride üretilseydi iki ayrı kimlik
    // doğar, seçtiğimiz kimlik taslaktakiyle tutmazdı.
    const field = createFieldDraft();
    setDraft((current) => appendFieldToDraft(current, parentDraftId, field));
    setSelectedDraftId(field.draftId);
  }, []);

  const removeField = useCallback((draftId: string) => {
    setDraft((current) => removeFieldFromDraft(current, draftId));
  }, []);

  const duplicateField = useCallback((draftId: string) => {
    setDraft((current) => duplicateFieldInDraft(current, draftId));
  }, []);

  const updateField = useCallback((draftId: string, patch: Partial<FieldDraft>) => {
    setDraft((current) => updateFieldInDraft(current, draftId, patch));
  }, []);

  const moveField = useCallback(
    (parentDraftId: string | null, fromIndex: number, toIndex: number) => {
      setDraft((current) => moveFieldInDraft(current, parentDraftId, fromIndex, toIndex));
    },
    [],
  );

  const updateMeta = useCallback((patch: Partial<SchemaDraftMeta>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const setSampleHex = useCallback((hex: string) => {
    setSampleHexState(hex);
  }, []);

  const loadSchemaJson = useCallback((json: string): LoadSchemaOutcome => {
    const parsed = parseProtocolSchemaJson(json);
    if (!parsed.success) {
      // Hangi alanın neden reddedildiği `parsed.issues`'ta duruyor ama içe
      // aktarma tek bir karardır: dosya ya açılır ya açılmaz. Ayrıntı listesi
      // düzeltilecek bir taslak olmadığı için kullanıcıya yardımcı olmaz.
      return { ok: false, errorKey: SCHEMA_JSON_ERROR_KEY };
    }
    setDraft(schemaToDraft(parsed.schema));
    return { ok: true };
  }, []);

  const resetToSpecFixture = useCallback(() => {
    setDraft(schemaToDraft(SPEC_SENSOR_PROTOCOL));
    setSampleHexState(specFixtureHex());
  }, []);

  return useMemo<ProtocolStudioApi>(
    () => ({
      draft,
      selectedDraftId,
      selectedField,
      schema,
      draftIssues,
      schemaIssues,
      sampleHex,
      sampleBytes,
      hexErrorKey: sample.errorKey,
      parseResult,
      regions,
      artifacts,
      selectField,
      addField,
      removeField,
      duplicateField,
      updateField,
      moveField,
      updateMeta,
      setSampleHex,
      loadSchemaJson,
      resetToSpecFixture,
    }),
    [
      addField,
      artifacts,
      draft,
      draftIssues,
      duplicateField,
      loadSchemaJson,
      moveField,
      parseResult,
      regions,
      resetToSpecFixture,
      sample.errorKey,
      sampleBytes,
      sampleHex,
      schema,
      schemaIssues,
      selectField,
      selectedDraftId,
      selectedField,
      setSampleHex,
      updateField,
      updateMeta,
      removeField,
    ],
  );
}

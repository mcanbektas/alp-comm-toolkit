/**
 * Protokol sayfasındaki `decode` sekmesinin gerçek çözümleme paneli (Faz 9).
 *
 * Bugüne kadar sekme 172 protokolün HEPSİNDE aynı sabit dokuz baytı basıyordu;
 * burada ekran ilk kez kayıtlı eklentinin KENDİ parser'ına bağlanır.
 *
 * Panel HESAP YAPMAZ (CLAUDE.md mimari kuralı): baytları eklentinin parser'ı
 * çözümler, bölgeleri `parsedFrameToRegions` üretir, panel yalnız gösterir.
 * Buradaki tek iş üç yükleme durumunu ayırmak, girdiyi toplamak ve sonucu
 * çizmek.
 *
 * Protocol Studio'nun `FrameViewPanel`/`OutputPanel` ikilisi aynı deseni
 * kuruyor ama TEK SATIRI paylaşılmıyor: feature'lar arası import yasak.
 * Paylaşılabilen tek şey sözleşmeler (`protocol-core`) ve sunum bileşenleridir
 * (`components/`) — biçimlendirme yardımcılarının tekrarı bunun bilinen bedeli.
 *
 * Kayıt defteri LAZY'dir (`registry.ts`): parser modülü ancak burada, kullanıcı
 * sekmeye girdiğinde indirilir. Bu yüzden yükleme durumu gerçek bir durumdur,
 * gösterilmesi gerekir; yükleme HATASI da sessizce yutulmaz — motoru olmayan
 * bir sayfa ile motoru inememiş bir sayfa kullanıcı için aynı şey değildir.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { parsedFrameToRegions } from '@/components/byte-viewer';
import type { ByteRegion } from '@/components/byte-viewer';
import { NumberField, SelectField } from '@/components/forms';
import { PacketViewer } from '@/components/packet-viewer';
import { bytesToHex, hexToBytes } from '@/protocol-core/buffers/representation';
import { loadProtocolPlugin } from '@/protocol-core/registry';
import type {
  DecodeOption,
  ParseResult,
  ProtocolError,
  ProtocolPlugin,
} from '@/protocol-core/types';
import type { TranslationKey } from '@/translations';
import { PARSE_ERROR_LABEL_KEYS, translateDiagnostic } from '@/utils/parseDiagnostics';

export interface DecodePanelProps {
  /** Kayıt defteri anahtarı — katalogdaki `pluginId` ile aynı değer. */
  readonly pluginId: string;
}

/**
 * Geçersiz hex girdisinde `ByteViewer`a verilen boş dizi. Modül düzeyinde sabit:
 * her render'da `new Uint8Array()` üretmek viewer'ın `useMemo` bağımlılığını
 * her seferinde tazeler ve düzen boşuna yeniden hesaplanır.
 */
const EMPTY_BYTES = new Uint8Array();

/** `EMPTY_BYTES` ile aynı gerekçe: sabit referans, boşuna `useMemo` tazelemesi yok. */
const EMPTY_DECODE_OPTIONS: readonly DecodeOption[] = [];

/**
 * Form metnini `ParseContext.options` değerlerine çevirir.
 *
 * Sayısal alanda GEÇERSİZ girdi (boş, harf, sınır dışı) sessizce varsayılana
 * düşer — panel burada kullanıcıya hata göstermez, çünkü `parse` her tuş
 * vuruşunda koşuyor ve yarım yazılmış "1" ile "16" arasındaki her ara adım
 * "geçersiz" olurdu. Sınır ihlali gerçekten yanlış bir çözüm ürettiğinde bunu
 * söylemek parser'ın işi (uyarı üretir), panelin değil: panel HESAP YAPMAZ.
 */
function resolveDecodeOptions(
  options: readonly DecodeOption[],
  text: Record<string, string>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const option of options) {
    const raw = text[option.id] ?? String(option.defaultValue);
    if (option.kind === 'select') {
      resolved[option.id] = raw;
      continue;
    }
    const parsed = Number(raw);
    const withinBounds =
      raw.trim() !== '' &&
      Number.isFinite(parsed) &&
      (option.min === undefined || parsed >= option.min) &&
      (option.max === undefined || parsed <= option.max);
    resolved[option.id] = withinBounds ? parsed : Number(option.defaultValue);
  }
  return resolved;
}

/**
 * `bytesToHex` ayraçsız üretir ("AA0510…"); girdi alanında bayt sınırları
 * görünmeli. Boşluk eklemek güvenli: `hexToBytes` boşlukları zaten temizliyor,
 * yani kullanıcı metni olduğu gibi geri verebilir.
 */
function toHexInput(bytes: Uint8Array): string {
  return (bytesToHex(bytes).match(/../g) ?? []).join(' ');
}

/** Bilinmeyen bir `catch` değerinden okunabilir tek satır. */
function toErrorDetail(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * `ParsedField.warnings`, `ProtocolWarning.message` ve `ProtocolError.message`
 * için ortak çeviri kapısı.
 *
 * Sözleşme (spec §7) bu alanları DÜZ METİN diye tanımlıyor, ama çözümleyiciler
 * saf TypeScript'tir ve yerelleştirilmiş metin üretemezler — çeviri anahtarı
 * koyup çeviriyi buraya bırakırlar. İkisi de gelebildiği için körlemesine `t()`
 * çağrılamaz: sözlükte karşılığı olmayan metin olduğu gibi basılır.
 *
 * Tarayıcı turunda görülen kusur buydu: uyarı satırı ekranda ham
 * `protocol.modbus.rtu.warning.roleInferredRequest` olarak duruyordu.
 */
/**
 * Eklentilerin verdiği örnek adı/açıklaması ÇEVİRİ ANAHTARI olabilir:
 * `modbusRtu.ts` böyle yazıldı ("protocol.modbus.rtu.example.…"). Ama spec §7'nin
 * `ExampleFrame` sözleşmesi bunu şart koşmuyor; anahtar yerine düz metin veren
 * bir eklenti de geçerlidir.
 *
 * Ayrım tek yerde, burada yapılır: sözlükte karşılığı olmayan anahtarda `t()`
 * `undefined` döndürür (bkz. `LanguageProvider`), o zaman metnin kendisi basılır.
 * Aksi hâlde biri ekranda ham anahtar, diğeri boşluk görürdü.
 */
function translatePluginText(
  t: (key: TranslationKey) => string,
  text: string,
): string {
  const translated: string | undefined = t(text as TranslationKey);
  return translated === undefined || translated === '' ? text : translated;
}

/**
 * Eklentinin yükleme durumu. Üç dal ayrı tutuluyor: "yükleniyor" ile
 * "yüklenemedi" tek bir `plugin === undefined` ile temsil edilseydi ekran
 * sonsuza kadar iskelet gösterir, kullanıcı neyi beklediğini bilemezdi.
 */
type PluginState =
  | { readonly status: 'loading' }
  | { readonly status: 'failed'; readonly detail: string }
  | { readonly status: 'ready'; readonly plugin: ProtocolPlugin };

/**
 * Girdinin çözümlenmiş hâli. `raw` dalı parser'ı OLMAYAN eklenti içindir:
 * baytlar yine çizilir, yalnız alan bilgisi yoktur — boş kart basmak yasak
 * (spec §50).
 */
type DecodeOutcome =
  | { readonly kind: 'invalid-hex' }
  | { readonly kind: 'raw'; readonly bytes: Uint8Array }
  | { readonly kind: 'crashed'; readonly bytes: Uint8Array; readonly detail: string }
  | { readonly kind: 'parsed'; readonly bytes: Uint8Array; readonly result: ParseResult };


function ParseFailureCard({
  error,
  recoverable,
  consumedBytes,
}: {
  error: ProtocolError;
  recoverable: boolean;
  consumedBytes: number;
}): ReactNode {
  const { t } = useTranslation();

  return (
    <div
      role="alert"
      data-testid="decode-parse-error"
      data-error-code={error.code}
      data-recoverable={String(recoverable)}
      className="flex flex-col gap-2 rounded-token border border-line bg-danger-soft p-3"
    >
      <p className="text-sm font-semibold text-danger">{t('decode.parseError.title')}</p>
      <p className="text-sm text-danger">{t(PARSE_ERROR_LABEL_KEYS[error.code])}</p>
      <p className="text-sm text-text" data-testid="decode-parse-error-message">
        {translateDiagnostic(error.message, t)}
      </p>
      <dl className="flex flex-wrap gap-4">
        {error.offset === undefined ? null : (
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs uppercase tracking-wide text-muted">
              {t('decode.parseError.offset')}
            </dt>
            <dd className="tabular font-mono text-sm text-text">{String(error.offset)}</dd>
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs uppercase tracking-wide text-muted">
            {t('decode.parseError.consumedBytes')}
          </dt>
          <dd className="tabular font-mono text-sm text-text">{String(consumedBytes)}</dd>
        </div>
      </dl>
      <p className={recoverable ? 'text-xs text-warn' : 'text-xs text-danger'}>
        {t(recoverable ? 'decode.parseError.recoverable' : 'decode.parseError.unrecoverable')}
      </p>
    </div>
  );
}

/**
 * Eklenti YÜKLENDİKTEN sonraki ekran. Ayrı bileşen olmasının sebebi durum
 * sıfırlaması: `pluginId` değiştiğinde hex girdisi, seçili örnek ve seçili
 * bölge birlikte gitmeli. `key={plugin.id}` ile remount etmek, üç `useEffect`
 * yazıp senkron tutmaya çalışmaktan hem kısa hem hatasız.
 */
function LoadedDecodeView({ plugin }: { plugin: ProtocolPlugin }): ReactNode {
  const { t } = useTranslation();

  // noUncheckedIndexedAccess: örnek listesi boş olabilir (`exampleFrames`
  // zorunlu ama uzunluğu değil), bu yüzden ilk eleman `undefined` olabilir.
  const firstExample = plugin.exampleFrames[0];

  const [selectedExampleId, setSelectedExampleId] = useState<string>(firstExample?.id ?? '');
  // Ekran BOŞ açılmaz (spec §50): ilk örnek daha ilk render'da yüklüdür.
  const [hexInput, setHexInput] = useState<string>(() =>
    firstExample === undefined ? '' : toHexInput(firstExample.bytes),
  );
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

  const decodeOptions = plugin.decodeOptions ?? EMPTY_DECODE_OPTIONS;
  // Değerler METİN tutulur, sayı değil: `NumberField` boş girdiyi `''` olarak
  // bildirir ve kullanıcı "6"yı silip "8" yazarken arada boş durumdan geçer.
  // Erken sayıya çevirmek o ara adımı 0'a düşürür, alan kullanıcının altından
  // kayar. Sayıya çevirme `parse`a geçmeden, tek yerde yapılır.
  const [optionText, setOptionText] = useState<Record<string, string>>(() =>
    Object.fromEntries(decodeOptions.map((option) => [option.id, String(option.defaultValue)])),
  );

  const parser = plugin.parser;

  const parseOptions = useMemo<Record<string, unknown>>(
    () => resolveDecodeOptions(decodeOptions, optionText),
    [decodeOptions, optionText],
  );

  const outcome = useMemo<DecodeOutcome>(() => {
    let bytes: Uint8Array;
    try {
      bytes = hexToBytes(hexInput);
    } catch {
      // `hexToBytes` tek/çift hane ve alfabe hatasını fırlatarak bildirir;
      // burada tek bir kullanıcı mesajına indirgenir (spec §42).
      return { kind: 'invalid-hex' };
    }

    if (parser === undefined) return { kind: 'raw', bytes };

    try {
      // Seçenek bildirmeyen eklentiye BOŞ nesne değil, hiç `context` geçilmez:
      // bugünkü 171 kaydın çağrı biçimi bit birebir aynı kalsın.
      const result =
        decodeOptions.length === 0
          ? parser.parse(bytes)
          : parser.parse(bytes, { options: parseOptions });
      return { kind: 'parsed', bytes, result };
    } catch (cause) {
      // Spec §47 "hatalı veride uygulamayı çökertme": sözleşme `parse`ın
      // fırlatmamasını söylüyor, ama fırlatan bir eklenti TÜM protokol sayfasını
      // beyaz ekrana çevirmemeli.
      return { kind: 'crashed', bytes, detail: toErrorDetail(cause) };
    }
  }, [hexInput, parser, decodeOptions, parseOptions]);

  const handleOptionChange = useCallback((optionId: string, value: string): void => {
    setOptionText((current) => ({ ...current, [optionId]: value }));
    setSelectedRegionId(null);
  }, []);

  const frame =
    outcome.kind === 'parsed' && outcome.result.success ? outcome.result.frame : undefined;

  const regions = useMemo<readonly ByteRegion[]>(
    // Başarısız çözümlemede bölge YOK: baytlar bölgesiz çizilir ki kullanıcı
    // neyin bozuk olduğuna kendi baksın.
    () => (frame === undefined ? [] : parsedFrameToRegions(frame)),
    [frame],
  );

  const handleExampleChange = useCallback(
    (exampleId: string): void => {
      const example = plugin.exampleFrames.find((candidate) => candidate.id === exampleId);
      if (example === undefined) return;
      setSelectedExampleId(exampleId);
      setHexInput(toHexInput(example.bytes));
      setSelectedRegionId(null);
    },
    [plugin.exampleFrames],
  );

  const toggleRegion = useCallback((regionId: string): void => {
    setSelectedRegionId((current) => (current === regionId ? null : regionId));
  }, []);

  const selectedExample = plugin.exampleFrames.find(
    (candidate) => candidate.id === selectedExampleId,
  );
  const hasHexError = outcome.kind === 'invalid-hex';
  const bytes = outcome.kind === 'invalid-hex' ? EMPTY_BYTES : outcome.bytes;

  return (
    <div className="flex flex-col gap-4" data-testid="decode-panel" data-plugin-id={plugin.id}>
      {/* Eklenti adı protokol verisidir (araç adları gibi), çeviriye girmez. */}
      <h2 className="font-display text-sm font-semibold text-text" data-testid="decode-plugin-name">
        {plugin.name}
      </h2>

      {plugin.exampleFrames.length > 0 ? (
        <div className="flex flex-col gap-1">
          <SelectField
            id="decode-example"
            label={t('decode.example.label')}
            value={selectedExampleId}
            onChange={handleExampleChange}
            options={plugin.exampleFrames.map((example) => ({
              value: example.id,
              label: translatePluginText(t, example.name),
            }))}
          />
          {selectedExample?.description === undefined ? null : (
            <p className="text-xs text-muted" data-testid="decode-example-description">
              {translatePluginText(t, selectedExample.description)}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted" data-testid="decode-examples-empty">
          {t('decode.example.empty')}
        </p>
      )}

      {decodeOptions.length > 0 ? (
        <fieldset
          data-testid="decode-options"
          className="flex flex-col gap-2 rounded-token border border-line bg-raised p-3"
        >
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
            {t('decode.options.legend')}
          </legend>
          <p className="text-xs text-muted" data-testid="decode-options-hint">
            {t('decode.options.hint')}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {decodeOptions.map((option) => {
              const fieldId = `decode-option-${option.id}`;
              const value = optionText[option.id] ?? String(option.defaultValue);
              return (
                <div key={option.id} className="flex flex-col gap-1">
                  {option.kind === 'select' ? (
                    <SelectField
                      id={fieldId}
                      label={t(option.label as TranslationKey)}
                      value={value}
                      onChange={(next: string) => {
                        handleOptionChange(option.id, next);
                      }}
                      options={(option.choices ?? []).map((choice) => ({
                        value: choice.value,
                        label: translatePluginText(t, choice.label),
                      }))}
                    />
                  ) : (
                    <NumberField
                      id={fieldId}
                      label={t(option.label as TranslationKey)}
                      value={value}
                      onChange={(next: string) => {
                        handleOptionChange(option.id, next);
                      }}
                    />
                  )}
                  {option.description === undefined ? null : (
                    <p className="text-xs text-muted">{t(option.description as TranslationKey)}</p>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="decode-hex" className="text-xs font-medium text-muted">
          {t('decode.hexInput.label')}
        </label>
        <textarea
          id="decode-hex"
          rows={3}
          spellCheck={false}
          value={hexInput}
          aria-invalid={hasHexError}
          aria-describedby={hasHexError ? 'decode-hex-error' : undefined}
          className={`w-full rounded-token-sm border bg-surface px-2 py-1.5 font-mono text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            hasHexError ? 'border-danger' : 'border-line'
          }`}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
            setHexInput(event.target.value);
            setSelectedRegionId(null);
          }}
        />
        {hasHexError ? (
          <p id="decode-hex-error" role="alert" data-testid="decode-hex-error" className="text-xs text-danger">
            {t('decode.error.invalidHex')}
          </p>
        ) : (
          // Sayı çeviri şablonuna GÖMÜLMEZ: yer tutuculu anahtar iki dilde ayrı
          // bakım ister, oysa buradaki tek değişken salt rakam.
          <p className="text-xs text-muted" data-testid="decode-byte-count">
            {t('decode.byteCount')}: <span className="tabular text-text">{bytes.length}</span>
          </p>
        )}
      </div>

      {outcome.kind === 'raw' ? (
        <p role="status" data-testid="decode-no-parser" className="rounded-token border border-line bg-raised p-3 text-sm text-warn">
          {t('decode.noParser')}
        </p>
      ) : null}

      {outcome.kind === 'crashed' ? (
        <div
          role="alert"
          data-testid="decode-parser-crashed"
          className="flex flex-col gap-1 rounded-token border border-line bg-danger-soft p-3"
        >
          <p className="text-sm font-semibold text-danger">{t('decode.parserCrashed')}</p>
          <p className="font-mono text-xs text-text">{outcome.detail}</p>
        </div>
      ) : null}

      <PacketViewer
        bytes={bytes}
        regions={regions}
        fields={frame?.fields}
        selectedFieldId={selectedRegionId}
        onSelectField={toggleRegion}
        labels={{
          byteEmpty: t('common.empty'),
          fieldsEmpty: t('decode.fields.empty'),
          tableAriaLabel: t('decode.table.label'),
          columnField: t('decode.column.field'),
          columnOffset: t('decode.column.offset'),
          columnLength: t('decode.column.length'),
          columnRaw: t('decode.column.raw'),
          columnPhysical: t('decode.column.physical'),
          columnValidity: t('decode.column.validity'),
          statusValid: t('decode.status.valid'),
          statusInvalid: t('decode.status.invalid'),
        }}
        translateWarning={(text) => translateDiagnostic(text, t)}
        testIdPrefix="decode"
      />

      {/*
        `success: true` ama `valid: false` mümkün: kısmi çözüm gösterilir, hata
        listesi ayrıca basılır (spec §47). Bu yüzden çerçeve hataları başarısız
        dalın değil, başarılı dalın da parçasıdır.
      */}
      {frame !== undefined && frame.errors.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {frame.errors.map((error, index) => (
            <li
              key={`${error.code}-${String(index)}`}
              data-testid="decode-frame-error"
              data-error-code={error.code}
              className="rounded-token-sm bg-danger-soft px-2 py-1 text-sm text-danger"
            >
              <span className="font-medium">{t(PARSE_ERROR_LABEL_KEYS[error.code])}</span>{' '}
              <span className="text-xs">{translateDiagnostic(error.message, t)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {frame !== undefined && frame.warnings.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {frame.warnings.map((warning, index) => (
            <li
              key={`${warning.code}-${String(index)}`}
              data-testid="decode-frame-warning"
              className="rounded-token-sm border border-line px-2 py-1 text-sm text-warn"
            >
              {translateDiagnostic(warning.message, t)}
            </li>
          ))}
        </ul>
      ) : null}

      {outcome.kind === 'parsed' && !outcome.result.success ? (
        <ParseFailureCard
          error={outcome.result.error}
          recoverable={outcome.result.recoverable}
          consumedBytes={outcome.result.consumedBytes}
        />
      ) : null}
    </div>
  );
}

export function DecodePanel({ pluginId }: DecodePanelProps): ReactNode {
  const { t } = useTranslation();
  const [state, setState] = useState<PluginState>({ status: 'loading' });

  useEffect(() => {
    // `cancelled`: kullanıcı sekme/protokol değiştirdiğinde uçuştaki yükleme
    // iptal edilemez (import() geri alınamaz), ama SONUCU yazılmamalı — yoksa
    // eski protokolün eklentisi yeni sayfanın üstüne düşer.
    let cancelled = false;
    setState({ status: 'loading' });

    loadProtocolPlugin(pluginId).then(
      (plugin) => {
        if (!cancelled) setState({ status: 'ready', plugin });
      },
      (cause: unknown) => {
        if (!cancelled) setState({ status: 'failed', detail: toErrorDetail(cause) });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [pluginId]);

  if (state.status === 'loading') {
    return (
      <p role="status" data-testid="decode-loading" className="text-sm text-muted">
        {t('common.loading')}
      </p>
    );
  }

  if (state.status === 'failed') {
    return (
      <div
        role="alert"
        data-testid="decode-load-error"
        className="flex flex-col gap-1 rounded-token border border-line bg-danger-soft p-3"
      >
        <p className="text-sm font-semibold text-danger">{t('decode.loadFailed')}</p>
        {/* Kimlik ve teknik ayrıntı çeviriye girmez: ikisi de veridir ve hata
            bildiriminde birebir aktarılması gerekir. */}
        <p className="font-mono text-xs text-text" data-testid="decode-load-error-detail">
          {pluginId}: {state.detail}
        </p>
      </div>
    );
  }

  return <LoadedDecodeView key={state.plugin.id} plugin={state.plugin} />;
}

/**
 * CRC Calculator — spec §45 Version 1.0 listesindeki İLERİ yönlü CRC aracı.
 *
 * `ChecksumFinderTool` ile karıştırılmamalı: o araç TERS yönlüdür (veri + gözlenen
 * değer verilir, hangi algoritma olduğu aranır). Buradaki soru ise "bu baytların
 * CRC-16/MODBUS'u nedir" — algoritma seçilir, değer hesaplanır.
 *
 * ## Hesap burada YOK
 *
 * CLAUDE.md'nin tek zorunlu mimari kuralı gereği polinom bölmesi
 * `protocol-core/checksums/crcEngine`de, katalog `crcCatalogue`da, basit toplamlar
 * kendi modüllerinde. Bu dosyadaki modül düzeyi fonksiyonlar YALNIZ biçimlendirme
 * (hex dolgusu, parametre özeti, adım metinleri) yapar; hiçbiri bit işlemez.
 *
 * ## Neden `bigint` yolu ayrı değil
 *
 * `crc()` genişlikten bağımsız olarak her zaman `bigint` döner (CRC-64'ün 64 biti
 * `number`a sığmaz). Basit toplamlar `number` döndürdüğü için TEK noktada
 * `BigInt(...)` ile yükseltilir; ekranda "küçük width'te number, büyükte bigint"
 * gibi iki ayrı biçimlendirme yolu YOKTUR — o ayrım iki kere test edilmesi gereken
 * iki kod yolu demektir.
 */

import { useMemo, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { CheckboxField, NumberField, ResultField, TextField } from '@/components/forms';
import {
  CRC_ALGORITHM_IDS,
  CRC_CATALOGUE,
  adler32,
  crc,
  fletcher16,
  fletcher32,
  hexToBytes,
  lrcChecksum,
  nmeaXorChecksum,
  sum8Checksum,
  xor8Checksum,
} from '@/protocol-core';
import type { CrcAlgorithmId, CrcParams } from '@/protocol-core';
import type { TranslationKey } from '@/translations';

const HEX_RADIX = 16;
const DECIMAL_RADIX = 10;
/** Bir hex hanesi 4 bit taşır — çıktı dolgusunun hane sayısı buradan çıkar. */
const BITS_PER_HEX_DIGIT = 4;
/** `crc()` `1n << BigInt(width - 1)` hesapladığı için width 1'in altına inemez; üst sınır katalogdaki CRC-64. */
const MIN_CRC_WIDTH = 1;
const MAX_CRC_WIDTH = 64;

/** Özel (custom) parametre seçeneğinin kimliği — katalog kimlikleriyle çakışmasın diye ayrı sabit. */
const CUSTOM_ALGORITHM_ID = 'CUSTOM';

/**
 * §42 madde 4 "Örnek veri": spec §43'ün doğrulanmış referans girdisi, ASCII
 * "123456789". Hex karşılığı elle yazıldı çünkü aracın girdisi hex; ASCII biçimi
 * yalnız düğmede gösterilir.
 */
const SAMPLE_ASCII = '123456789';
const SAMPLE_HEX = '31 32 33 34 35 36 37 38 39';

/**
 * Örnek veri bölümünde gösterilecek dört referans. Değerler BURADA YAZILI DEĞİL:
 * aşağıda motordan hesaplanır, böylece tablo motorun gerçek çıktısını gösterir —
 * elle yazılmış bir tablo motor bozulduğunda da doğru görünürdü.
 */
const SAMPLE_REFERENCE_IDS: readonly CrcAlgorithmId[] = ['CRC8', 'CRC16_CCITT_FALSE', 'CRC16_MODBUS', 'CRC32'];

/**
 * §42 madde 7 "Formül". Beş parametreli Ross Williams modelinin sözlü karşılığı;
 * tanımlayıcılar `CrcParams` alan adlarıyla birebir aynı olsun diye çeviriye
 * girmez — bu bir ifade, arayüz metni değil.
 */
const CRC_FORMULA_EXPRESSION = 'crc = reflect_out(divide(init, poly, data)) XOR xorout';

const SIMPLE_ALGORITHM_IDS = ['XOR8', 'SUM8', 'LRC', 'FLETCHER16', 'FLETCHER32', 'ADLER32', 'NMEA_XOR'] as const;

type SimpleAlgorithmId = (typeof SIMPLE_ALGORITHM_IDS)[number];

interface SimpleAlgorithm {
  /** Sonucun bit genişliği — hex dolgusu ve "W bitlik kalan" metni buna bakar. */
  readonly width: number;
  readonly compute: (bytes: Uint8Array) => number;
}

/**
 * CRC olmayan, polinom bölmesi içermeyen toplamlar. `nmeaXorChecksum` metin aldığı
 * için baytlar tek tek karaktere çevrilir: NMEA cümlesi zaten 7-bit ASCII'dir,
 * `String.fromCharCode` bayt değerini birebir korur.
 */
const SIMPLE_ALGORITHMS: Record<SimpleAlgorithmId, SimpleAlgorithm> = {
  XOR8: { width: 8, compute: xor8Checksum },
  SUM8: { width: 8, compute: sum8Checksum },
  LRC: { width: 8, compute: lrcChecksum },
  FLETCHER16: { width: 16, compute: fletcher16 },
  FLETCHER32: { width: 32, compute: fletcher32 },
  ADLER32: { width: 32, compute: adler32 },
  NMEA_XOR: {
    width: 8,
    compute: (bytes: Uint8Array): number =>
      nmeaXorChecksum(Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')),
  },
};

function isCrcAlgorithmId(value: string): value is CrcAlgorithmId {
  return (CRC_ALGORITHM_IDS as readonly string[]).includes(value);
}

function isSimpleAlgorithmId(value: string): value is SimpleAlgorithmId {
  return (SIMPLE_ALGORITHM_IDS as readonly string[]).includes(value);
}

function hexDigitsForWidth(width: number): number {
  return Math.ceil(width / BITS_PER_HEX_DIGIT);
}

/** Genişliğe göre sıfır dolgulu `0x…` gösterimi: CRC-6 sonucu 6 → `0x06`, CRC-32 → 8 hane. */
function formatHexValue(value: bigint, width: number): string {
  return `0x${value.toString(HEX_RADIX).toUpperCase().padStart(hexDigitsForWidth(width), '0')}`;
}

/** §42 madde 7: seçili varyantın parametreleri tek satırda. Değerler ifade, çeviriye girmez. */
function formatCrcParams(params: CrcParams): string {
  return [
    `width=${String(params.width)}`,
    `poly=${formatHexValue(params.poly, params.width)}`,
    `init=${formatHexValue(params.init, params.width)}`,
    `refin=${String(params.refin)}`,
    `refout=${String(params.refout)}`,
    `xorout=${formatHexValue(params.xorout, params.width)}`,
  ].join(' ');
}

/** Basit toplamların polinomu yoktur; özet yalnız genişliği taşır. */
function formatSimpleParams(width: number): string {
  return `width=${String(width)}`;
}

/**
 * `0x` öneki ve boşluklar serbest. Boş metin `undefined` döner — "0" ile "hiç
 * yazılmamış" ayrımı korunmalı, yoksa kullanıcı alanı silince sessizce 0x0
 * hesaplanır.
 */
function parseHexBigInt(text: string): bigint | undefined {
  const stripped = text.trim().replace(/^0x/i, '').replace(/\s+/g, '');
  if (stripped.length === 0 || !/^[0-9a-f]+$/i.test(stripped)) return undefined;
  return BigInt(`0x${stripped}`);
}

interface CustomParamInput {
  readonly width: string;
  readonly poly: string;
  readonly init: string;
  readonly xorout: string;
  readonly refin: boolean;
  readonly refout: boolean;
}

/**
 * Özel parametreleri `crc()`nin beklediği şekle çevirir. Genişliğe SIĞMAYAN
 * poly/init/xorout sessizce maskelenmez, geçersiz sayılır: `crc()` içeride
 * maskeleyeceği için kullanıcı 0x18005 yazıp "CRC-16 hesapladım" sanırdı.
 */
function buildCustomParams(input: CustomParamInput): CrcParams | undefined {
  const width = Number(input.width);
  if (!Number.isInteger(width) || width < MIN_CRC_WIDTH || width > MAX_CRC_WIDTH) return undefined;

  const poly = parseHexBigInt(input.poly);
  const init = parseHexBigInt(input.init);
  const xorout = parseHexBigInt(input.xorout);
  if (poly === undefined || init === undefined || xorout === undefined) return undefined;

  const mask = (1n << BigInt(width)) - 1n;
  if (poly > mask || init > mask || xorout > mask) return undefined;

  return { width, poly, init, refin: input.refin, refout: input.refout, xorout };
}

type SelectedAlgorithm =
  | { readonly kind: 'crc'; readonly params: CrcParams }
  | { readonly kind: 'simple'; readonly width: number; readonly compute: (bytes: Uint8Array) => number }
  | { readonly kind: 'invalidParams' };

function resolveAlgorithm(selection: string, custom: CustomParamInput): SelectedAlgorithm {
  if (selection === CUSTOM_ALGORITHM_ID) {
    const params = buildCustomParams(custom);
    return params === undefined ? { kind: 'invalidParams' } : { kind: 'crc', params };
  }
  if (isCrcAlgorithmId(selection)) {
    return { kind: 'crc', params: CRC_CATALOGUE[selection] };
  }
  if (isSimpleAlgorithmId(selection)) {
    const entry = SIMPLE_ALGORITHMS[selection];
    return { kind: 'simple', width: entry.width, compute: entry.compute };
  }
  // Seçicide olmayan bir değer ancak dışarıdan gelebilir; sessiz yanlış sonuç yerine hata.
  return { kind: 'invalidParams' };
}

interface CrcOutcomeValue {
  readonly kind: 'value';
  readonly value: bigint;
  readonly width: number;
  readonly byteCount: number;
  /** Basit toplamlarda yok — adım listesi ve özet buna bakarak dallanır. */
  readonly params: CrcParams | undefined;
}

type CrcOutcome = CrcOutcomeValue | { readonly kind: 'invalidData' } | { readonly kind: 'invalidParams' };

interface CrcStep {
  readonly id: string;
  readonly labelKey: TranslationKey;
  readonly value: string;
}

/**
 * §42 madde 8 "Adım adım hesap". Burada HESAP YAPILMAZ: `value` çoktan `crc()`den
 * gelmiştir, bu fonksiyon yalnız hangi parametrenin hangi sırada devreye girdiğini
 * anlatan satırları kurar. Sayılar ayrı `value` alanında tutulur ki çeviri metni
 * yer tutucu taşımasın.
 */
function describeCrcSteps(outcome: CrcOutcomeValue): readonly CrcStep[] {
  const steps: CrcStep[] = [
    { id: 'input', labelKey: 'calc.crc.step.input', value: String(outcome.byteCount) },
  ];

  const { params } = outcome;
  if (params !== undefined) {
    steps.push({ id: 'init', labelKey: 'calc.crc.step.init', value: formatHexValue(params.init, params.width) });
    steps.push({ id: 'refin', labelKey: 'calc.crc.step.refin', value: String(params.refin) });
    steps.push({ id: 'poly', labelKey: 'calc.crc.step.poly', value: formatHexValue(params.poly, params.width) });
    steps.push({ id: 'refout', labelKey: 'calc.crc.step.refout', value: String(params.refout) });
    steps.push({ id: 'xorout', labelKey: 'calc.crc.step.xorout', value: formatHexValue(params.xorout, params.width) });
  }

  steps.push({
    id: 'result',
    labelKey: 'calc.crc.step.result',
    value: `${String(outcome.width)} bit · ${formatHexValue(outcome.value, outcome.width)}`,
  });
  return steps;
}

interface SampleReference {
  readonly id: CrcAlgorithmId;
  readonly hex: string;
}

/** Referans tablosu motordan üretilir; sabit değil, hesaplanmış gerçek çıktıdır. */
const SAMPLE_REFERENCES: readonly SampleReference[] = SAMPLE_REFERENCE_IDS.map((id) => {
  const params = CRC_CATALOGUE[id];
  return { id, hex: formatHexValue(crc(hexToBytes(SAMPLE_HEX.replace(/\s+/g, '')), params), params.width) };
});

function fieldLabelClass(): string {
  return 'text-xs font-medium text-muted';
}

interface DocSectionProps {
  readonly testId: string;
  readonly title: string;
  readonly children: ReactNode;
}

/** §42 bölümü — `<details>` bölümü kaldırmadan katlar, `<summary>` klavyeyle açılır. */
function DocSection({ testId, title, children }: DocSectionProps): ReactNode {
  return (
    <details data-testid={testId} className="rounded-token border border-line bg-raised px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-text hover:text-accent">{title}</summary>
      <div className="mt-2 flex flex-col gap-2 text-sm text-muted">{children}</div>
    </details>
  );
}

export function CrcCalculatorTool(): ReactNode {
  const { t } = useTranslation();

  const [hexInput, setHexInput] = useState('');
  const [selection, setSelection] = useState<string>('CRC16_MODBUS');
  // Varsayılan özel parametreler CRC-16/CCITT-FALSE'a denk gelir: kullanıcı
  // "özel"e geçtiğinde boş değil, çalışan ve tanınan bir varyantla başlar.
  const [customWidth, setCustomWidth] = useState('16');
  const [customPoly, setCustomPoly] = useState('1021');
  const [customInit, setCustomInit] = useState('FFFF');
  const [customXorout, setCustomXorout] = useState('0000');
  const [customRefin, setCustomRefin] = useState(false);
  const [customRefout, setCustomRefout] = useState(false);

  const algorithm = useMemo<SelectedAlgorithm>(
    () =>
      resolveAlgorithm(selection, {
        width: customWidth,
        poly: customPoly,
        init: customInit,
        xorout: customXorout,
        refin: customRefin,
        refout: customRefout,
      }),
    [selection, customWidth, customPoly, customInit, customXorout, customRefin, customRefout],
  );

  // `null` = çözümlenemeyen hex, `undefined` = henüz yazılmamış: ikisi ayrı
  // ekran durumu (biri hata gösterir, diğeri sessizce boş kalır).
  const bytes = useMemo<Uint8Array | null | undefined>(() => {
    if (hexInput.trim().length === 0) return undefined;
    try {
      return hexToBytes(hexInput.replace(/[\s,]+/g, ''));
    } catch {
      return null;
    }
  }, [hexInput]);

  const outcome = useMemo<CrcOutcome | undefined>(() => {
    if (bytes === undefined) return undefined;
    if (bytes === null) return { kind: 'invalidData' };
    if (algorithm.kind === 'invalidParams') return { kind: 'invalidParams' };
    if (algorithm.kind === 'crc') {
      return {
        kind: 'value',
        value: crc(bytes, algorithm.params),
        width: algorithm.params.width,
        byteCount: bytes.length,
        params: algorithm.params,
      };
    }
    return {
      kind: 'value',
      value: BigInt(algorithm.compute(bytes)),
      width: algorithm.width,
      byteCount: bytes.length,
      params: undefined,
    };
  }, [bytes, algorithm]);

  const computed = outcome !== undefined && outcome.kind === 'value' ? outcome : undefined;
  const hexText = computed === undefined ? '' : formatHexValue(computed.value, computed.width);
  const decimalText = computed === undefined ? '' : computed.value.toString(DECIMAL_RADIX);
  const widthText = computed === undefined ? '' : String(computed.width);
  const summaryText =
    computed === undefined
      ? ''
      : computed.params === undefined
        ? formatSimpleParams(computed.width)
        : formatCrcParams(computed.params);
  const steps = computed === undefined ? [] : describeCrcSteps(computed);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div data-testid="crc-data-field">
          <TextField
            id="calc-crc-data"
            label={t('calc.field.checksumData')}
            value={hexInput}
            onChange={setHexInput}
            monospace
            multiline
            placeholder={SAMPLE_HEX}
          />
        </div>
        <button
          type="button"
          data-testid="crc-load-sample"
          onClick={() => {
            setHexInput(SAMPLE_HEX);
          }}
          className="self-start rounded-token border border-line bg-raised px-3 py-1.5 text-sm text-text transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {t('calc.crc.loadSample')} <span className="font-mono">{SAMPLE_ASCII}</span>
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="calc-crc-algorithm" className={fieldLabelClass()}>
          {t('calc.field.algorithm')}
        </label>
        <select
          id="calc-crc-algorithm"
          data-testid="crc-algorithm"
          value={selection}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            setSelection(event.target.value);
          }}
          className="w-full rounded-token-sm border border-line bg-surface px-2 py-1.5 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <optgroup label={t('calc.crc.group.crc')} data-testid="crc-group-crc">
            {CRC_ALGORITHM_IDS.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </optgroup>
          <optgroup label={t('calc.crc.group.simple')} data-testid="crc-group-simple">
            {SIMPLE_ALGORITHM_IDS.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </optgroup>
          <optgroup label={t('calc.crc.group.custom')} data-testid="crc-group-custom">
            <option value={CUSTOM_ALGORITHM_ID}>{t('calc.crc.customOption')}</option>
          </optgroup>
        </select>
      </div>

      {selection === CUSTOM_ALGORITHM_ID && (
        <div className="flex flex-col gap-3 rounded-token border border-line bg-raised p-3" data-testid="crc-custom-panel">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1" data-testid="crc-custom-width-field">
              <NumberField id="calc-crc-width" label={t('calc.field.bitWidth')} value={customWidth} onChange={setCustomWidth} />
            </div>
            <div className="flex-1" data-testid="crc-custom-poly-field">
              <TextField id="calc-crc-poly" label={t('calc.crc.customPoly')} value={customPoly} onChange={setCustomPoly} monospace />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1" data-testid="crc-custom-init-field">
              <TextField id="calc-crc-init" label={t('calc.crc.customInit')} value={customInit} onChange={setCustomInit} monospace />
            </div>
            <div className="flex-1" data-testid="crc-custom-xorout-field">
              <TextField id="calc-crc-xorout" label={t('calc.crc.customXorout')} value={customXorout} onChange={setCustomXorout} monospace />
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
            <div data-testid="crc-custom-refin-field">
              <CheckboxField id="calc-crc-refin" label={t('calc.crc.customRefin')} checked={customRefin} onChange={setCustomRefin} />
            </div>
            <div data-testid="crc-custom-refout-field">
              <CheckboxField id="calc-crc-refout" label={t('calc.crc.customRefout')} checked={customRefout} onChange={setCustomRefout} />
            </div>
          </div>
        </div>
      )}

      {algorithm.kind === 'invalidParams' && (
        <p role="alert" data-testid="crc-params-error" className="text-xs text-danger">
          {t('calc.error.invalidInput')}
        </p>
      )}
      {outcome !== undefined && outcome.kind === 'invalidData' && (
        <p role="alert" data-testid="crc-data-error" className="text-xs text-danger">
          {t('calc.error.invalidInput')}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <div data-testid="crc-result-hex">
          <ResultField id="calc-crc-hex" label={t('calc.field.hexOutput')} value={hexText} />
        </div>
        <div data-testid="crc-result-decimal">
          <ResultField id="calc-crc-decimal" label={t('calc.field.decimalOutput')} value={decimalText} />
        </div>
        <div data-testid="crc-result-width">
          <ResultField id="calc-crc-width-out" label={t('calc.field.bitWidth')} value={widthText} />
        </div>
        <div data-testid="crc-result-params">
          <ResultField id="calc-crc-params" label={t('calc.crc.paramsSummary')} value={summaryText} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <DocSection testId="crc-doc-example" title={t('calc.crc.doc.example.title')}>
          <p>{t('calc.crc.doc.example.body')}</p>
          <p className="font-mono text-xs text-text" data-testid="crc-sample-ascii">
            {SAMPLE_ASCII}
          </p>
          <div className="overflow-x-auto rounded-token border border-line">
            <table className="w-full text-left text-sm tabular" data-testid="crc-reference-table">
              <thead className="bg-raised text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">{t('calc.field.algorithm')}</th>
                  <th className="px-3 py-2 font-medium">{t('calc.field.computedHex')}</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_REFERENCES.map((reference) => (
                  <tr key={reference.id} className="border-t border-line" data-testid={`crc-reference-${reference.id}`}>
                    <td className="px-3 py-1.5 font-mono font-medium text-text">{reference.id}</td>
                    <td className="px-3 py-1.5 font-mono">{reference.hex}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DocSection>

        <DocSection testId="crc-doc-formula" title={t('calc.crc.doc.formula.title')}>
          <p>{t('calc.crc.doc.formula.body')}</p>
          <p className="font-mono text-xs text-text" data-testid="crc-formula-expression">
            {CRC_FORMULA_EXPRESSION}
          </p>
          <p className="font-mono text-xs text-text" data-testid="crc-formula-params">
            {summaryText}
          </p>
        </DocSection>

        <DocSection testId="crc-doc-steps" title={t('calc.crc.doc.steps.title')}>
          <p>{t('calc.crc.doc.steps.body')}</p>
          <ol className="flex flex-col gap-1" data-testid="crc-steps">
            {steps.map((step) => (
              <li key={step.id} data-testid={`crc-step-${step.id}`} className="flex flex-wrap items-baseline gap-2">
                <span>{t(step.labelKey)}</span>
                <span className="tabular font-mono text-text">{step.value}</span>
              </li>
            ))}
          </ol>
        </DocSection>

        <DocSection testId="crc-doc-limits" title={t('calc.crc.doc.limits.title')}>
          <ul className="list-disc pl-5">
            <li data-testid="crc-limit-bigint">{t('calc.crc.doc.limits.bigint')}</li>
            <li data-testid="crc-limit-coverage">{t('calc.crc.doc.limits.coverage')}</li>
            <li data-testid="crc-limit-simple">{t('calc.crc.doc.limits.simpleParams')}</li>
          </ul>
        </DocSection>

        <DocSection testId="crc-doc-mistakes" title={t('calc.crc.doc.mistakes.title')}>
          <ul className="list-disc pl-5">
            <li data-testid="crc-mistake-reflect">{t('calc.crc.doc.mistakes.reflect')}</li>
            <li data-testid="crc-mistake-scope">{t('calc.crc.doc.mistakes.scope')}</li>
            <li data-testid="crc-mistake-byteorder">{t('calc.crc.doc.mistakes.byteOrder')}</li>
          </ul>
        </DocSection>
      </div>
    </div>
  );
}

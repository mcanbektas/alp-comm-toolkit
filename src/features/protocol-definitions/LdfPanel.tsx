/**
 * Protokol sayfasındaki `definitions` sekmesinin LDF paneli.
 *
 * `GsdPanel.tsx`in (o da `XifPanel`in, o da `EdsPanel`in) deseni: panel HESAP
 * YAPMAZ (CLAUDE.md mimari kuralı), LDF metnini `parseLdf` çözer, sinyalleri
 * `decodeLdfFrame` çıkarır, checksum modelini `resolveLdfChecksumModel` karara
 * bağlar — panel yalnız gösterir. Ekran BOŞ AÇILMAZ (spec §50): dosya
 * yüklenmeden önce gerçek bir üretici dosyası gösterilir. Kullanıcı verisi
 * YERELDE KALIR (spec §41): `readTextFile` `Blob.text()` ile okur.
 *
 * ── ✅ "ÇÖZ" ALT ARACI VAR — ÖNCEKİ İKİ DALGANIN AKSİNE, ÖLÇÜLEREK ──────────
 * XIF dalgası hex çöz aracını EKLEMEDİ (telde tip yok), GSD dalgası da
 * EKLEMEDİ (dosyada yerleşim yok). Burada karar TERS çıktı ve gerekçesi
 * ölçüldü — üç ayrı ölçüm, üçü de eklemeyi gösteriyor:
 *
 * 1. **LDF HEM tipi HEM yerleşimi taşıyor.** Eksik olan yarım YOK. §9.2.4.1
 *    her sinyalin çerçevedeki bit ofsetini verir, §9.2.6.1 ölçeklemesini
 *    (`physical_value = scale × raw + offset`, denklem 17). Açılış
 *    fixture'ında ÖLÇÜLDÜ: yedi koşulsuz çerçevenin YEDİSİ de tam yerleşim
 *    taşıyor. XIF'te bu oran %14'tü (4/28 NV), GSD'de sıfırdı.
 * 2. **Çerçeve TELDEN adreslenebiliyor ve o adres ZATEN hesaplanıyor.**
 *    `lin.ts` PID'i çözüp `id` alanını (6 bit, 0-59) üretiyor; LDF çerçeve
 *    kimlikleri tam bu aralıkta. Yani "yakalanan çerçeve hangi satır"
 *    sorusunun cevabı uydurma bir eşleşme değil, motorun zaten bastığı alan.
 *    Aşağıdaki tablo PID'i de yazar (`computeLinParity`, TEK kaynak lin.ts).
 * 3. **Yetenek BAŞKA HİÇBİR YERDE YOK — ölçüldü.** `linPlugin`in
 *    `decodeOptions`u YOK ve ürettiği alanlar yalnız `sync · pid · id ·
 *    parity · data · checksum`. `data` TEK bir ayrışmamış blok; hiçbir
 *    sinyal çıkarılmıyor. Yani bu ikinci bir bildirim yeri DEĞİL, o bloğun
 *    tek çözücüsü. (XIF'te çözme yeteneği `lonworks`un `decode` sekmesinde
 *    ZATEN vardı — bu yüzden orada eklemek tekrar olurdu.)
 *
 * ── ÜSTELİK ARAÇ, MOTORUN AÇIKÇA YAZDIĞI BİR BOŞLUĞU KAPATIYOR ──────────────
 * `lin.ts` dosya başında şunu yazıyor: *"Hangi KONVANSİYONUN (klasik / …)
 * kullanıldığı telden OKUNAMAZ — gönderenin yapılandırmasıdır."* LDF TAM
 * OLARAK o yapılandırmadır (§2.3.1.5: model çerçeve kimliği başına, karışan
 * slave düğümün LIN sürümüne göre belirlenir; 60/61 her zaman klasik). Panel
 * bu yüzden her çerçevenin checksum modelini ve o kararın NEREDEN geldiğini
 * KOŞULSUZ yazar. GsdPanel'in "konfigürasyon bu dosyada yazmıyor" uyarısının
 * tam simetriği: burada dosya EKSİK OLANI SÖYLÜYOR.
 *
 * ── AÇILIŞ ÇERÇEVESİ VE ÖRNEK VERİ: İKİSİ DE TÜRETİLİR, SABİT DEĞİL ─────────
 * Panelin ilk hâlinde açılış çerçevesi `frames[0]`, örnek hex ise bir SABİTTİ.
 * İkisi birden yanlıştı: `frames[0]` bu fixture'da 1 baytlık `Motor1_Dynamic`e
 * düşüyor, sabit hex ise 6 baytlık `Motor1State_Cycl`e göre yazılmıştı — ekran
 * 1 baytlık bir çerçeveye 6 bayt gösteriyordu. Daha kötüsü, bir SABİT ancak
 * TEK bir dosyanın TEK bir çerçevesi için doğru olabilir: kullanıcı kendi
 * LDF'ini içe aktardığı anda o baytlar hiçbir şeye uymuyordu.
 *
 * İkisi de artık motor tarafında türetiliyor ve gerekçeleri `ldfParser.ts`te:
 * `chooseDefaultLdfFrame` (teşhis çerçevelerini dışla, en çok sinyalliyi seç,
 * eşitlikte dosya sırası) ve `buildLdfSampleData` (dosyanın kendi
 * `init_value`larını paketle). Panel tarafındaki tek mekanik, elle yazılan
 * hex'i AYRI bir `hexOverride` durumunda tutmak: çerçeve değişince ya da yeni
 * bir dosya gelince override sıfırlanır, böylece eski baytlar yeni çerçeveye
 * karşı asılı kalamaz.
 *
 * ── GERÇEK EMSAL `DbcPanel`DİR ──────────────────────────────────────────────
 * `XifPanel` ve `GsdPanel` başlıkları bu dalgaya kadar "`DbcPanel` de hex çöz
 * aracı taşımaz" diyordu; YANLIŞTI ve 2026-08-31'de ikisi de düzeltildi.
 * `DbcPanel` bir çöz aracı TAŞIR (`dbc-sample-hex` → `decodeDbcMessage` →
 * `dbc-decoded-table`). Ve DBC, LDF'in bu depodaki en yakın yapısal emsali
 * (mesaj → ofset/boy/ölçekli sinyaller). Yani gerçek emsal, aracın VARLIĞINI
 * destekliyor — ölçüt panelin adı değil, üç şartın birden tutması: tip dosyada,
 * yerleşim dosyada, çerçeve telden adreslenebilir.
 */

import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { bytesToHex, hexToBytes } from '@/protocol-core/buffers/representation';
import { SAMPLE_LDF_TEXT } from '@/protocol-core/definitions/ldf/ldfFixture';
import {
  buildLdfSampleData,
  chooseDefaultLdfFrame,
  decodeLdfFrame,
  parseLdf,
  resolveLdfChecksumModel,
} from '@/protocol-core/definitions/ldf/ldfParser';
import type {
  LdfChecksumReason,
  LdfCluster,
  LdfDecodedSignal,
  LdfFrame,
  LdfFrameKind,
  LdfNodeAttributes,
  LdfParseIssue,
  LdfScheduleTable,
  LdfSignal,
} from '@/protocol-core/definitions/ldf/ldfTypes';
import { computeLinParity } from '@/protocols/automotive/lin/lin';
import { isTranslationKey } from '@/translations';
import type { TranslationKey } from '@/translations';
import { readTextFile } from '@/utils/readTextFile';

const EMPTY_GLYPH = '—';
const HEX_RADIX = 16;
const PARITY_SHIFT = 6;

const HEADER_CELL_CLASS =
  'border-b border-line px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted';
const BODY_CELL_CLASS = 'px-2 py-1.5 align-top text-sm text-text';
const FILE_INPUT_CLASS =
  'max-w-full rounded-token-sm border border-line bg-surface px-2 py-1.5 text-sm text-text file:mr-2 file:rounded-token-sm file:border-0 file:bg-raised file:px-2 file:py-1 file:text-sm file:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
const SELECT_CLASS =
  'max-w-full rounded-token-sm border border-line bg-surface px-2 py-1.5 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

/** Çerçeve türü → çeviri anahtarı. Tür adları PROTOKOL TERİMİ, ham basılmaz. */
const FRAME_KIND_KEYS: Readonly<Record<LdfFrameKind, TranslationKey>> = {
  unconditional: 'definition.ldf.kind.unconditional',
  sporadic: 'definition.ldf.kind.sporadic',
  'event-triggered': 'definition.ldf.kind.eventTriggered',
  diagnostic: 'definition.ldf.kind.diagnostic',
};

/** Checksum kararının gerekçesi → çeviri anahtarı. */
const CHECKSUM_REASON_KEYS: Readonly<Record<LdfChecksumReason, TranslationKey>> = {
  reservedDiagnostic: 'definition.ldf.checksum.reason.reservedDiagnostic',
  linOneSlave: 'definition.ldf.checksum.reason.linOneSlave',
  linTwoSlave: 'definition.ldf.checksum.reason.linTwoSlave',
  mixedSlaves: 'definition.ldf.checksum.reason.mixedSlaves',
  clusterVersion: 'definition.ldf.checksum.reason.clusterVersion',
  noSlaveVersion: 'definition.ldf.checksum.reason.noSlaveVersion',
};

/** `LdfParseIssue.messageKey` sözlükte varsa çevrilir — `GsdPanel`inkiyle aynı. */
function translateIssue(key: string, t: (key: TranslationKey) => string): string {
  return isTranslationKey(key) ? t(key) : key;
}

function formatNumber(value: number | undefined): string {
  return value === undefined ? EMPTY_GLYPH : String(value);
}

function formatHexByte(value: number): string {
  return `0x${value.toString(HEX_RADIX).padStart(2, '0').toUpperCase()}`;
}

function formatBytes(bytes: readonly number[] | undefined): string {
  if (bytes === undefined || bytes.length === 0) return EMPTY_GLYPH;
  return bytes.map(formatHexByte).join(' ');
}

/**
 * Korumalı kimlik: 6 bitlik çerçeve kimliği + iki eşlik biti. Formül
 * `lin.ts`ten gelir, burada YENİDEN YAZILMAZ. Teşhis çerçeveleri dahil her
 * kimlik için geçerlidir (0x3C → 0x3C, 0x3D → 0x7D).
 */
function formatProtectedId(frameId: number | undefined): string {
  if (frameId === undefined) return EMPTY_GLYPH;
  return formatHexByte(frameId | (computeLinParity(frameId) << PARITY_SHIFT));
}

function IssueList({ issues }: { readonly issues: readonly LdfParseIssue[] }): ReactNode {
  const { t } = useTranslation();
  if (issues.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1" data-testid="ldf-issue-list">
      {issues.map((issue, index) => (
        <li
          key={`${issue.messageKey}-${String(index)}`}
          data-testid="ldf-issue"
          className="rounded-token-sm border border-line px-2 py-1 text-xs text-warn"
        >
          {issue.line > 0 ? (
            <span className="tabular font-mono">
              {t('definition.ldf.line')} {issue.line}:{' '}
            </span>
          ) : null}
          {translateIssue(issue.messageKey, t)}
          {issue.text === undefined ? null : (
            <span className="font-mono text-muted"> {issue.text}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function SummaryEntry({
  label,
  value,
  testId,
}: {
  readonly label: string;
  readonly value: string;
  readonly testId: string;
}): ReactNode {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="font-mono text-sm text-text" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

function FrameTable({ cluster }: { readonly cluster: LdfCluster }): ReactNode {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <table
        data-testid="ldf-frame-table"
        className="w-full min-w-[62rem] border-collapse"
        aria-label={t('definition.ldf.table.frames')}
      >
        <thead>
          <tr>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.frameId')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.protectedId')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.name')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.kind')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.publisher')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.lengthBytes')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.checksumModel')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.layout')}</th>
          </tr>
        </thead>
        <tbody>
          {cluster.frames.map((frame) => {
            const checksum = resolveLdfChecksumModel(cluster, frame);
            return (
              <tr
                key={`${String(frame.line)}-${frame.name}`}
                data-testid="ldf-frame-row"
                data-frame-name={frame.name}
                className="border-b border-line"
              >
                <td className={`${BODY_CELL_CLASS} tabular font-mono`}>
                  {formatNumber(frame.frameId)}
                </td>
                <td
                  className={`${BODY_CELL_CLASS} tabular font-mono`}
                  data-testid="ldf-frame-protected-id"
                >
                  {formatProtectedId(frame.frameId)}
                </td>
                {/* Çerçeve adı VERİDİR, çevrilmez. */}
                <td className={`${BODY_CELL_CLASS} font-medium`}>{frame.name}</td>
                <td className={BODY_CELL_CLASS}>{t(FRAME_KIND_KEYS[frame.kind])}</td>
                {/* Düğüm adı VERİDİR, çevrilmez. */}
                <td className={BODY_CELL_CLASS}>
                  {frame.publisher === '' ? EMPTY_GLYPH : frame.publisher}
                </td>
                <td className={`${BODY_CELL_CLASS} tabular font-mono`} data-testid="ldf-frame-length">
                  {formatNumber(frame.lengthBytes)}
                </td>
                <td className={BODY_CELL_CLASS} data-testid="ldf-frame-checksum">
                  {t(
                    checksum.model === 'classic'
                      ? 'definition.ldf.checksum.classic'
                      : checksum.model === 'enhanced'
                        ? 'definition.ldf.checksum.enhanced'
                        : 'definition.ldf.checksum.unknown',
                  )}
                  <span className="ml-1 block text-xs text-muted">
                    {t(CHECKSUM_REASON_KEYS[checksum.reason])}
                    {checksum.node === '' ? null : (
                      <span className="font-mono"> ({checksum.node})</span>
                    )}
                  </span>
                </td>
                <td className={BODY_CELL_CLASS} data-testid="ldf-frame-layout">
                  {frame.signals.length === 0 ? (
                    frame.associatedFrames.length === 0 ? (
                      <span className="text-muted">{t('definition.ldf.noSignals')}</span>
                    ) : (
                      // Sporadik/olay tetiklemeli çerçeve kendi sinyalini taşımaz,
                      // ilişkili KOŞULSUZ çerçeveleri sayar (§9.2.4.2 / §9.2.4.3).
                      <span className="font-mono text-xs">{frame.associatedFrames.join(', ')}</span>
                    )
                  ) : (
                    <ul className="flex flex-col gap-0.5">
                      {frame.signals.map((placement) => (
                        <li key={`${placement.name}-${String(placement.offset)}`} className="text-xs">
                          <span className="tabular font-mono">@{placement.offset}</span>{' '}
                          {placement.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SignalTable({
  cluster,
  signals,
  testId,
}: {
  readonly cluster: LdfCluster;
  readonly signals: readonly LdfSignal[];
  readonly testId: string;
}): ReactNode {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <table
        data-testid={testId}
        className="w-full min-w-[52rem] border-collapse"
        aria-label={t('definition.ldf.table.signals')}
      >
        <thead>
          <tr>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.name')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.sizeBits')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.signalKind')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.initValue')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.publisher')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.subscribers')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.encoding')}</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((signal) => (
            <tr
              key={`${String(signal.line)}-${signal.name}`}
              data-testid="ldf-signal-row"
              data-signal-name={signal.name}
              className="border-b border-line"
            >
              {/* Sinyal adı VERİDİR, çevrilmez. */}
              <td className={`${BODY_CELL_CLASS} font-medium`}>{signal.name}</td>
              <td className={`${BODY_CELL_CLASS} tabular font-mono`}>{signal.sizeBits}</td>
              <td className={BODY_CELL_CLASS} data-testid="ldf-signal-kind">
                {t(
                  signal.kind === 'byte-array'
                    ? 'definition.ldf.signalKind.byteArray'
                    : 'definition.ldf.signalKind.scalar',
                )}
              </td>
              <td className={`${BODY_CELL_CLASS} tabular font-mono`}>
                {signal.kind === 'byte-array'
                  ? formatBytes(signal.initBytes)
                  : formatNumber(signal.initValue)}
              </td>
              <td className={BODY_CELL_CLASS}>
                {signal.publisher === '' ? EMPTY_GLYPH : signal.publisher}
              </td>
              <td className={BODY_CELL_CLASS}>
                {signal.subscribers.length === 0 ? EMPTY_GLYPH : signal.subscribers.join(', ')}
              </td>
              {/* Kodlama tipi adı dosyanın kendi verisidir, çevrilmez. */}
              <td className={`${BODY_CELL_CLASS} font-mono text-xs`}>
                {cluster.signalEncodingByName.get(signal.name) ?? EMPTY_GLYPH}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NodeTable({ nodes }: { readonly nodes: readonly LdfNodeAttributes[] }): ReactNode {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <table
        data-testid="ldf-node-table"
        className="w-full min-w-[52rem] border-collapse"
        aria-label={t('definition.ldf.table.nodes')}
      >
        <thead>
          <tr>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.name')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.linProtocol')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.configuredNad')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.productId')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.timing')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.configurableFrames')}</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((node) => (
            <tr
              key={`${String(node.line)}-${node.name}`}
              data-testid="ldf-node-row"
              data-node-name={node.name}
              className="border-b border-line"
            >
              <td className={`${BODY_CELL_CLASS} font-medium`}>{node.name}</td>
              <td className={`${BODY_CELL_CLASS} font-mono`} data-testid="ldf-node-protocol">
                {node.linProtocol === '' ? EMPTY_GLYPH : node.linProtocol}
              </td>
              <td className={`${BODY_CELL_CLASS} tabular font-mono`}>
                {node.configuredNad === undefined ? EMPTY_GLYPH : formatHexByte(node.configuredNad)}
              </td>
              <td className={`${BODY_CELL_CLASS} tabular font-mono text-xs`}>
                {node.supplierId === undefined || node.functionId === undefined
                  ? EMPTY_GLYPH
                  : `${formatHexByte(node.supplierId)} / ${formatHexByte(node.functionId)}${
                      node.variant === undefined ? '' : ` / ${String(node.variant)}`
                    }`}
              </td>
              <td className={`${BODY_CELL_CLASS} tabular font-mono text-xs`}>
                {`P2 ${formatNumber(node.p2Min)} · ST ${formatNumber(node.stMin)}`}
              </td>
              <td className={BODY_CELL_CLASS}>
                {node.configurableFrames.length === 0 ? (
                  EMPTY_GLYPH
                ) : (
                  <ol className="flex flex-col gap-0.5">
                    {node.configurableFrames.map((entry, index) => (
                      <li key={entry.name} className="text-xs">
                        <span className="tabular font-mono text-muted">{index}</span> {entry.name}
                        {entry.messageId === undefined ? null : (
                          <span className="font-mono text-muted">
                            {' '}
                            = {formatHexByte(entry.messageId)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScheduleTables({ tables }: { readonly tables: readonly LdfScheduleTable[] }): ReactNode {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <table
        data-testid="ldf-schedule-table"
        className="w-full min-w-[40rem] border-collapse"
        aria-label={t('definition.ldf.table.schedules')}
      >
        <thead>
          <tr>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.name')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.entryCount')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.cycleTime')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.entries')}</th>
          </tr>
        </thead>
        <tbody>
          {tables.map((table) => (
            <tr
              key={`${String(table.line)}-${table.name}`}
              data-testid="ldf-schedule-row"
              data-schedule-name={table.name}
              className="border-b border-line"
            >
              <td className={`${BODY_CELL_CLASS} font-medium`}>{table.name}</td>
              <td className={`${BODY_CELL_CLASS} tabular font-mono`}>{table.entries.length}</td>
              <td
                className={`${BODY_CELL_CLASS} tabular font-mono`}
                data-testid="ldf-schedule-cycle"
              >
                {table.totalDelayMs}
              </td>
              <td className={BODY_CELL_CLASS}>
                <ol className="flex flex-col gap-0.5">
                  {table.entries.map((entry, index) => (
                    <li key={`${entry.command}-${String(index)}`} className="text-xs">
                      <span className="tabular font-mono text-muted">
                        {formatNumber(entry.delayMs)} ms
                      </span>{' '}
                      {entry.command}
                      {entry.arguments.length === 0 ? null : (
                        <span className="font-mono text-muted">
                          {' '}
                          {'{'}
                          {entry.arguments.join(', ')}
                          {'}'}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DecodedTable({ signals }: { readonly signals: readonly LdfDecodedSignal[] }): ReactNode {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <table
        data-testid="ldf-decoded-table"
        className="w-full min-w-[44rem] border-collapse"
        aria-label={t('definition.ldf.table.decoded')}
      >
        <thead>
          <tr>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.name')}</th>
            <th className={HEADER_CELL_CLASS}>{t('definition.ldf.column.offset')}</th>
            <th className={HEADER_CELL_CLASS}>{t('decode.column.raw')}</th>
            <th className={HEADER_CELL_CLASS}>{t('decode.column.physical')}</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((entry) => (
            <tr
              key={`${entry.placement.name}-${String(entry.placement.offset)}`}
              data-testid="ldf-decoded-row"
              data-signal-name={entry.placement.name}
              className="border-b border-line"
            >
              <td className={`${BODY_CELL_CLASS} font-medium`}>{entry.placement.name}</td>
              <td className={`${BODY_CELL_CLASS} tabular font-mono`}>{entry.placement.offset}</td>
              <td className={`${BODY_CELL_CLASS} tabular font-mono`} data-testid="ldf-decoded-raw">
                {entry.undefinedSignal ? (
                  <span className="text-warn">{t('definition.ldf.decode.signalNotDefined')}</span>
                ) : entry.unalignedByteArray ? (
                  // §2.2.3 çiğnenmiş: okuma UYDURULMAZ.
                  <span className="text-warn">{t('definition.ldf.decode.unaligned')}</span>
                ) : entry.outOfFrame ? (
                  <span className="text-muted">{t('definition.ldf.decode.outOfFrame')}</span>
                ) : entry.bytes !== undefined ? (
                  formatBytes(entry.bytes)
                ) : (
                  formatNumber(entry.rawValue)
                )}
              </td>
              <td className={BODY_CELL_CLASS} data-testid="ldf-decoded-physical">
                {entry.label !== undefined ? (
                  // Etiket dosyanın kendi verisidir, çevrilmez.
                  <span>{entry.label}</span>
                ) : entry.physicalValue === undefined ? (
                  EMPTY_GLYPH
                ) : (
                  <span className="tabular font-mono">
                    {entry.physicalValue}
                    {entry.unit === '' ? '' : ` ${entry.unit}`}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type LdfState =
  | {
      readonly status: 'ready';
      readonly cluster: LdfCluster;
      readonly issues: readonly LdfParseIssue[];
      readonly sample: boolean;
    }
  | { readonly status: 'failed'; readonly issues: readonly LdfParseIssue[] };

function initialState(): LdfState {
  const result = parseLdf(SAMPLE_LDF_TEXT);
  return result.success
    ? { status: 'ready', cluster: result.cluster, issues: result.issues, sample: true }
    : { status: 'failed', issues: result.issues };
}

/** Çözülebilir çerçeve = yerleşim taşıyan çerçeve. Sporadik olanın sinyali yoktur. */
function decodableFrames(cluster: LdfCluster): readonly LdfFrame[] {
  return cluster.frames.filter((frame) => frame.signals.length > 0);
}

/** Baytları girdi kutusunun beklediği boşluklu yazıma çevirir. */
function toHexInput(bytes: Uint8Array): string {
  return (bytesToHex(bytes).match(/.{2}/gu) ?? []).join(' ');
}

export function LdfPanel(): ReactNode {
  const { t } = useTranslation();

  const [state, setState] = useState<LdfState>(initialState);
  const [importErrorKey, setImportErrorKey] = useState<string | null>(null);
  const [selectedFrameName, setSelectedFrameName] = useState<string | null>(null);
  /**
   * Kullanıcının ELLE yazdığı hex. `null` = hiç dokunulmadı, o zaman aşağıdaki
   * TÜRETİLMİŞ değer geçerlidir. Örnek veriyi doğrudan `useState`e koymak,
   * çerçeve değişince ya da başka bir dosya içe aktarılınca eski baytların
   * yeni çerçeveye karşı asılı kalmasına yol açıyordu; ayrım bunu yapısal
   * olarak imkânsız kılıyor (`useEffect` ile senkron tutmaya gerek yok).
   */
  const [hexOverride, setHexOverride] = useState<string | null>(null);

  const cluster = state.status === 'ready' ? state.cluster : null;
  const frames = cluster === null ? [] : decodableFrames(cluster);
  const selectedFrame =
    frames.find((frame) => frame.name === selectedFrameName) ??
    (cluster === null ? undefined : chooseDefaultLdfFrame(cluster));

  /** Dosyanın KENDİ `init_value`larından üretilen örnek veri (motor tarafında). */
  const derivedHex = useMemo(
    () =>
      cluster === null || selectedFrame === undefined
        ? ''
        : toHexInput(buildLdfSampleData(cluster, selectedFrame)),
    [cluster, selectedFrame],
  );
  const sampleHex = hexOverride ?? derivedHex;

  const decoded = useMemo(() => {
    if (cluster === null || selectedFrame === undefined) return null;
    let bytes: Uint8Array;
    try {
      bytes = hexToBytes(sampleHex);
    } catch {
      return { invalidHex: true as const };
    }
    return { invalidHex: false as const, signals: decodeLdfFrame(bytes, cluster, selectedFrame) };
  }, [cluster, selectedFrame, sampleHex]);

  const handleImport = useCallback(async (file: File): Promise<void> => {
    setImportErrorKey(null);
    let text: string;
    try {
      text = await readTextFile(file);
    } catch {
      setImportErrorKey('definition.ldf.error.readFailed');
      return;
    }
    const result = parseLdf(text);
    if (!result.success) {
      // Başarısız içe aktarma ÖNCEKİ kümeyi silmez (`GsdPanel` deseni).
      setImportErrorKey('definition.ldf.error.parseFailed');
      setState((current) =>
        current.status === 'ready'
          ? { ...current, issues: result.issues }
          : { status: 'failed', issues: result.issues },
      );
      return;
    }
    // Yeni küme = yeni çerçeveler: seçim de elle yazılmış hex de SIFIRLANIR,
    // yoksa eski baytlar yepyeni bir dosyaya karşı çözülmeye devam ederdi.
    setSelectedFrameName(null);
    setHexOverride(null);
    setState({ status: 'ready', cluster: result.cluster, issues: result.issues, sample: false });
  }, []);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file === undefined) return;
      void handleImport(file);
    },
    [handleImport],
  );

  return (
    <div className="flex flex-col gap-4" data-testid="ldf-panel">
      <div className="flex flex-col gap-1">
        <label htmlFor="ldf-import" className="text-xs font-medium text-muted">
          {t('definition.ldf.action.import')}
        </label>
        <input
          id="ldf-import"
          data-testid="ldf-import"
          type="file"
          accept=".ldf,text/plain"
          onChange={handleFileChange}
          className={FILE_INPUT_CLASS}
        />
      </div>

      {importErrorKey === null ? null : (
        <p role="alert" data-testid="ldf-import-error" className="text-sm text-danger">
          {t(importErrorKey as TranslationKey)}
        </p>
      )}

      {state.status === 'ready' && state.sample ? (
        <p className="text-xs text-muted" data-testid="ldf-sample-notice">
          {t('definition.ldf.sampleNotice')}
        </p>
      ) : null}

      {cluster === null ? (
        <p
          role="alert"
          data-testid="ldf-load-failed"
          className="rounded-token border border-line bg-danger-soft p-3 text-sm text-danger"
        >
          {t('definition.ldf.error.parseFailed')}
        </p>
      ) : (
        <>
          <dl className="flex flex-wrap gap-4" data-testid="ldf-summary">
            {/* Sürüm dizeleri VERİDİR, sayıya çevrilmez. */}
            <SummaryEntry
              label={t('definition.ldf.protocolVersion')}
              value={cluster.protocolVersion === '' ? EMPTY_GLYPH : cluster.protocolVersion}
              testId="ldf-protocol-version"
            />
            <SummaryEntry
              label={t('definition.ldf.languageVersion')}
              value={cluster.languageVersion === '' ? EMPTY_GLYPH : cluster.languageVersion}
              testId="ldf-language-version"
            />
            <SummaryEntry
              label={t('definition.ldf.speed')}
              value={formatNumber(cluster.speedKbps)}
              testId="ldf-speed"
            />
            <SummaryEntry
              label={t('definition.ldf.master')}
              value={cluster.master.name === '' ? EMPTY_GLYPH : cluster.master.name}
              testId="ldf-master"
            />
            <SummaryEntry
              label={t('definition.ldf.timeBase')}
              value={formatNumber(cluster.master.timeBaseMs)}
              testId="ldf-time-base"
            />
            <SummaryEntry
              label={t('definition.ldf.jitter')}
              value={formatNumber(cluster.master.jitterMs)}
              testId="ldf-jitter"
            />
            <SummaryEntry
              label={t('definition.ldf.slaves')}
              value={cluster.slaves.length === 0 ? EMPTY_GLYPH : cluster.slaves.join(', ')}
              testId="ldf-slaves"
            />
            <SummaryEntry
              label={t('definition.ldf.frameCount')}
              value={String(cluster.frames.length)}
              testId="ldf-frame-count"
            />
            <SummaryEntry
              label={t('definition.ldf.signalCount')}
              value={String(cluster.signals.length)}
              testId="ldf-signal-count"
            />
          </dl>

          {/*
            KOŞULSUZ not — `GsdPanel`in `configurationNotInFile` uyarısının
            SİMETRİĞİ: orada dosya eksik olanı SÖYLEMİYORDU, burada söylüyor.
          */}
          <p
            role="note"
            data-testid="ldf-checksum-note"
            className="rounded-token border border-line bg-raised p-3 text-sm text-text"
          >
            {t('definition.ldf.checksumNote')}
          </p>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-text">{t('definition.ldf.table.frames')}</h3>
            <FrameTable cluster={cluster} />
            <p className="text-xs text-muted" data-testid="ldf-offset-note">
              {t('definition.ldf.offsetNote')}
            </p>
          </section>

          {selectedFrame === undefined ? null : (
            <section className="flex flex-col gap-2" data-testid="ldf-decode-tool">
              <h3 className="text-sm font-semibold text-text">{t('definition.ldf.table.decoded')}</h3>
              <div className="flex flex-wrap gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="ldf-decode-frame" className="text-xs font-medium text-muted">
                    {t('definition.ldf.decode.frameLabel')}
                  </label>
                  <select
                    id="ldf-decode-frame"
                    data-testid="ldf-decode-frame"
                    className={SELECT_CLASS}
                    value={selectedFrame.name}
                    onChange={(event) => {
                      setSelectedFrameName(event.target.value);
                      // Örnek veri yeni çerçeveye göre yeniden türetilsin.
                      setHexOverride(null);
                    }}
                  >
                    {frames.map((frame) => (
                      <option key={frame.name} value={frame.name}>
                        {frame.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="ldf-decode-hex" className="text-xs font-medium text-muted">
                    {t('definition.ldf.decode.hexLabel')}
                  </label>
                  <input
                    id="ldf-decode-hex"
                    data-testid="ldf-decode-hex"
                    type="text"
                    className={`rounded-token-sm border bg-surface px-2 py-1.5 font-mono text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      decoded?.invalidHex === true ? 'border-danger' : 'border-line'
                    }`}
                    value={sampleHex}
                    aria-invalid={decoded?.invalidHex === true}
                    onChange={(event) => {
                      setHexOverride(event.target.value);
                    }}
                  />
                </div>
              </div>
              <p className="text-xs text-muted" data-testid="ldf-decode-scope-note">
                {t('definition.ldf.decode.scopeNote')}
              </p>
              {decoded?.invalidHex === true ? (
                <p role="alert" data-testid="ldf-hex-error" className="text-xs text-danger">
                  {t('decode.error.invalidHex')}
                </p>
              ) : decoded !== null && !decoded.invalidHex ? (
                <DecodedTable signals={decoded.signals} />
              ) : null}
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-text">{t('definition.ldf.table.signals')}</h3>
            <SignalTable cluster={cluster} signals={cluster.signals} testId="ldf-signal-table" />
          </section>

          {cluster.nodeAttributes.length === 0 ? (
            /* LIN 1.3 dosyalarında bu bölüm HİÇ YOKTUR — boş tablo yerine söyle. */
            <p className="text-xs text-muted" data-testid="ldf-no-node-attributes">
              {t('definition.ldf.noNodeAttributes')}
              {cluster.diagnosticAddresses.length === 0 ? null : (
                <span className="font-mono">
                  {' '}
                  {cluster.diagnosticAddresses
                    .map((entry) => `${entry.node} = ${formatHexByte(entry.address)}`)
                    .join(', ')}
                </span>
              )}
            </p>
          ) : (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-text">{t('definition.ldf.table.nodes')}</h3>
              <NodeTable nodes={cluster.nodeAttributes} />
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-text">
              {t('definition.ldf.table.schedules')}
            </h3>
            <ScheduleTables tables={cluster.scheduleTables} />
          </section>

          {cluster.signalGroups.length === 0 ? null : (
            /* §9.2.3.3: LIN 1.3 kalıntısı. Varsa gösterilir, yoksa tablo basılmaz. */
            <p className="text-xs text-muted" data-testid="ldf-signal-groups">
              {t('definition.ldf.signalGroupsNote')}{' '}
              <span className="font-mono">
                {cluster.signalGroups
                  .map((group) => `${group.name} (${String(group.sizeBits)} bit)`)
                  .join(', ')}
              </span>
            </p>
          )}
        </>
      )}

      <IssueList issues={state.issues} />
    </div>
  );
}

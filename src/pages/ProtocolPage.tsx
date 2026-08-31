import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType, KeyboardEvent, ReactElement, ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { WORKSPACE_TABS, findEntry } from '@/app/catalog';
import type { CatalogEntry, DefinitionFormat, WorkspaceTab } from '@/app/catalog';
import { useTranslation } from '@/app/providers/LanguageProvider';
import { useUiStore } from '@/app/store/uiStore';
import { ByteViewer } from '@/components/byte-viewer';
import type { ByteRegion, SeriesColorIndex } from '@/components/byte-viewer';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { findCalculator } from '@/features/calculators';
import { resolvePluginId, resolveStatus } from '@/protocols/pluginBinding';
import type { TranslationKey } from '@/translations';
import { ProtocolBadges } from './FamilyPage';
import { NotFoundPage } from './NotFoundPage';

/** Aktif sekmenin taşındığı sorgu parametresi. */
const TAB_PARAM = 'tab';

const TAB_LABEL_KEYS: Record<WorkspaceTab, TranslationKey> = {
  overview: 'tab.overview',
  live: 'tab.live',
  decode: 'tab.decode',
  build: 'tab.build',
  timing: 'tab.timing',
  data: 'tab.data',
  diagnostics: 'tab.diagnostics',
  definitions: 'tab.definitions',
  examples: 'tab.examples',
};

const DEFINITION_LABEL_KEYS: Record<DefinitionFormat, TranslationKey> = {
  dbc: 'definition.dbc',
  eds: 'definition.eds',
  gsd: 'definition.gsd',
  gsdml: 'definition.gsdml',
  iodd: 'definition.iodd',
  a2l: 'definition.a2l',
  ldf: 'definition.ldf',
  scl: 'definition.scl',
  xif: 'definition.xif',
  dsdl: 'definition.dsdl',
  'vendor-map': 'definition.vendor-map',
  'custom-schema': 'definition.custom-schema',
};

/**
 * Sekme → araç eşleşmesi için aranan parçalar. Katalogdaki araç adları serbest
 * metin olduğu için eşleşme ANAHTAR KELİMEYLE yapılır, sabit bir tabloyla değil;
 * 172 protokolün ~1200 araç adını elle sekmelere bağlamak sürdürülemezdi.
 * Hiçbiri tutmazsa çağıran tam listeye düşer — boş kart basmak yasak.
 */
const TAB_TOOL_KEYWORDS: Record<WorkspaceTab, readonly string[]> = {
  overview: [],
  live: ['live', 'monitor', 'capture', 'sniff', 'stream', 'scope', 'trace', 'terminal'],
  decode: ['decode', 'parse', 'frame', 'telegram', 'packet', 'view', 'field', 'dissect'],
  build: ['build', 'encode', 'generat', 'compose', 'craft', 'request', 'inject', 'send'],
  timing: ['timing', 'baud', 'bit', 'latency', 'jitter', 'bandwidth', 'throughput', 'cycle', 'clock', 'sampl'],
  data: ['data', 'register', 'value', 'log', 'export', 'table', 'chart', 'plot', 'signal', 'record'],
  diagnostics: ['diagnos', 'error', 'fault', 'health', 'statistic', 'warning', 'crc', 'checksum', 'valid'],
  definitions: ['definition', 'dbc', 'eds', 'gsd', 'iodd', 'a2l', 'ldf', 'scl', 'xif', 'dsdl', 'schema', 'map', 'import'],
  examples: ['example', 'sample', 'reference', 'fixture', 'library', 'template', 'preset'],
};

/**
 * Çözümleme paneli TEMBEL: parser modülünü kayıt defterinden `import()` ile
 * çekiyor (`registry.ts` lazy), yani panelin kendisi de ana pakete girmemeli.
 * Yükleme iskeleti AppRouter'daki `LazyFallback` deseninin aynısı.
 */
const DecodePanel = lazy(async () => {
  const module = await import('@/features/protocol-decode/DecodePanel');
  return { default: module.DecodePanel };
});

/**
 * DBC paneli de TEMBEL: tanım dosyası motoru yalnız CAN ailesinin `definitions`
 * sekmesinde gerekiyor, 172 protokolün açılış paketine giremez.
 */
const DbcPanel = lazy(async () => {
  const module = await import('@/features/protocol-definitions/DbcPanel');
  return { default: module.DbcPanel };
});

/** EDS paneli de aynı gerekçeyle TEMBEL: yalnız CANopen'ın `definitions` sekmesinde gerekir. */
const EdsPanel = lazy(async () => {
  const module = await import('@/features/protocol-definitions/EdsPanel');
  return { default: module.EdsPanel };
});

/**
 * Özel şema paneli de TEMBEL. Kapsamı en genişi (`custom-schema` 20 kayıt
 * taşıyor) ama yine de yalnız `definitions` sekmesinde gerekiyor; zod
 * doğrulayıcısı ve şema çözümleyicisi açılış paketine giremez.
 */
const SchemaPanel = lazy(async () => {
  const module = await import('@/features/protocol-definitions/SchemaPanel');
  return { default: module.SchemaPanel };
});

/**
 * Üretici kayıt haritası paneli de TEMBEL. CSV ayrıştırıcısı ve register
 * çözücüsü yalnız `definitions` sekmesinde gerekiyor.
 */
const VendorMapPanel = lazy(async () => {
  const module = await import('@/features/protocol-definitions/VendorMapPanel');
  return { default: module.VendorMapPanel };
});

/** A2L paneli de TEMBEL: belirteçleyici ve dönüşüm motoru yalnız XCP/CCP'nin `definitions` sekmesinde gerekir. */
const A2lPanel = lazy(async () => {
  const module = await import('@/features/protocol-definitions/A2lPanel');
  return { default: module.A2lPanel };
});

/**
 * XML aygıt tanımı paneli (GSDML/IODD/SCL) TEK bileşendir; biçim farkı
 * `format` özelliğiyle taşınır. Tablo `DefinitionFormat`tan bileşene eşlediği
 * için üç ince sarmalayıcı yazılıyor — alternatifi, üç ayrı panel dosyası
 * tutup aynı tabloyu üç kez çizmekti.
 */
const XmlDevicePanel = lazy(async () => {
  const module = await import('@/features/protocol-definitions/XmlDevicePanel');
  return { default: module.XmlDevicePanel };
});

function GsdmlPanel(): ReactNode {
  return <XmlDevicePanel format="gsdml" />;
}

function IoddPanel(): ReactNode {
  return <XmlDevicePanel format="iodd" />;
}

function SclPanel(): ReactNode {
  return <XmlDevicePanel format="scl" />;
}

/** DSDL paneli de TEMBEL: yalnız DroneCAN/Cyphal'ın `definitions` sekmesinde gerekir. */
const DsdlPanel = lazy(async () => {
  const module = await import('@/features/protocol-definitions/DsdlPanel');
  return { default: module.DsdlPanel };
});

/** XIF paneli de TEMBEL: yalnız LonWorks'ün `definitions` sekmesinde gerekir. */
const XifPanel = lazy(async () => {
  const module = await import('@/features/protocol-definitions/XifPanel');
  return { default: module.XifPanel };
});

/**
 * Cellular Initialization Dashboard da TEMBEL, aynı gerekçeyle: yalnız
 * `lte-modem-at`in `data` sekmesinde gerekir (karar 6'yla aynı sınıf iş).
 */
const CellularInitializationDashboard = lazy(async () => {
  const module = await import('@/features/cellular-dashboard/CellularInitializationDashboard');
  return { default: module.CellularInitializationDashboard };
});

/**
 * Tanım biçimi → panel eşlemesi. Dalga 1c'den ÖNCE bu tek satırlık bir
 * `showsDbcPanel` boolean'ıydı; ikinci biçim (EDS) eklenince üçlü ternary'yi
 * büyütmek yerine seçici bir yapıya çevrildi — üçüncü bir biçim geldiğinde
 * yalnız bu tabloya satır eklenir, render dalına dokunulmaz.
 */
const DEFINITION_PANELS: Partial<Record<DefinitionFormat, ComponentType>> = {
  dbc: DbcPanel,
  eds: EdsPanel,
  'custom-schema': SchemaPanel,
  'vendor-map': VendorMapPanel,
  a2l: A2lPanel,
  gsdml: GsdmlPanel,
  iodd: IoddPanel,
  scl: SclPanel,
  dsdl: DsdlPanel,
  xif: XifPanel,
};

/**
 * Spec §43'ün custom binary protocol fixture'ı: `AA 05 10 03 34 12 7F 4F 55`.
 * YALNIZ eklentisi olmayan protokoller için geçici örnek — motoru olan protokol
 * bu sabiti hiç görmez, `DecodePanel` gerçek parser'ın çıktısını basar.
 * Görüntüleyici burada da gerçek: baytlar ve alan sınırları doğrulanmış
 * referans değerlerden geliyor. `AA` başlangıç, `55` bitiş baytı kasıtlı olarak
 * işaretsiz — nötr parçanın da çizildiği görülsün.
 */
const SAMPLE_FRAME_BYTES = new Uint8Array([0xaa, 0x05, 0x10, 0x03, 0x34, 0x12, 0x7f, 0x4f, 0x55]);

/** Alan adları protokol verisidir (araç adları gibi), arayüz metni değil — çeviriye girmez. */
const SAMPLE_FRAME_REGIONS: readonly ByteRegion[] = [
  { id: 'address', name: 'Address', offset: 1, length: 1, colorIndex: 0 },
  { id: 'command', name: 'Command', offset: 2, length: 1, colorIndex: 1 },
  { id: 'length', name: 'Length', offset: 3, length: 1, colorIndex: 2 },
  { id: 'payload', name: 'Payload', offset: 4, length: 3, colorIndex: 3 },
  { id: 'checksum', name: 'Checksum', offset: 7, length: 1, colorIndex: 0 },
];

/** Tailwind kaynağı statik tarar; `text-series-${i}` şablonu üretilen CSS'e girmez. */
const SERIES_TEXT_CLASS: Record<SeriesColorIndex, string> = {
  0: 'text-series-1',
  1: 'text-series-2',
  2: 'text-series-3',
  3: 'text-series-4',
};

function isWorkspaceTab(value: string | null): value is WorkspaceTab {
  return value !== null && (WORKSPACE_TABS as readonly string[]).includes(value);
}

/** URL'deki sekme protokolde yoksa sessizce genel bakışa düşülür — hata sayfası abartı olurdu. */
function resolveActiveTab(requested: string | null, available: readonly WorkspaceTab[]): WorkspaceTab {
  if (isWorkspaceTab(requested) && available.includes(requested)) return requested;
  if (available.includes('overview')) return 'overview';
  return available[0] ?? 'overview';
}

/**
 * Sekmeye düşen araçlar. Eşleşme yoksa BOŞ döner — eskiden tüm listeye
 * düşülüyordu ve ölçüldüğünde 1015 (protokol, sekme) çiftinin 586'sı bu yola
 * giriyordu: dokuz sekme birbirinin aynı içeriğini basıyor, sekme çubuğu
 * anlamını yitiriyordu. Boş sekme, yanlış dolu sekmeden dürüsttür.
 */
function selectToolsForTab(tools: readonly string[], tab: WorkspaceTab): readonly string[] {
  const keywords = TAB_TOOL_KEYWORDS[tab];
  return tools.filter((tool) => {
    const lower = tool.toLocaleLowerCase('en');
    return keywords.some((keyword) => lower.includes(keyword));
  });
}

/** AppRouter'daki `LazyFallback` ile aynı iş; o bileşen dışa verilmiyor. */
function DecodeFallback(): ReactElement {
  const { t } = useTranslation();
  return (
    <p role="status" className="text-sm text-muted">
      {t('common.loading')}
    </p>
  );
}

export function ProtocolPage(): ReactElement {
  const { t } = useTranslation();
  const { domainId, familyId, protocolId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const pushRecentPath = useUiStore((state) => state.pushRecentPath);

  const entry: CatalogEntry | undefined = useMemo(() => {
    if (domainId === undefined || familyId === undefined || protocolId === undefined) return undefined;
    return findEntry(`${domainId}/${familyId}/${protocolId}`);
  }, [domainId, familyId, protocolId]);

  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const tabRefs = useRef(new Map<WorkspaceTab, HTMLButtonElement | null>());

  // Erken `return` hook'lardan ÖNCE gelemez; kayıt yoksa effect kendini eler.
  useEffect(() => {
    if (entry !== undefined) pushRecentPath(entry.path);
  }, [entry, pushRecentPath]);

  if (entry === undefined) return <NotFoundPage />;

  const { domain, family, protocol } = entry;
  const activeTab = resolveActiveTab(searchParams.get(TAB_PARAM), protocol.tabs);
  const canonical = protocol.aliasOf === undefined ? undefined : findEntry(protocol.aliasOf);

  const goToTab = (tab: WorkspaceTab): void => {
    setSearchParams(
      (current) => {
        // Var olan parametreler korunur: derin bağlantılar ileride sekme dışı
        // durum da taşıyacak (seçili alan, zaman aralığı).
        const next = new URLSearchParams(current);
        next.set(TAB_PARAM, tab);
        return next;
      },
      // `replace`: sekme gezinti geçmişine yazılmaz. Aksi hâlde altı sekmeye
      // bakan kullanıcı geri düğmesiyle protokol sayfasından çıkamaz, sekmeler
      // arasında geri geri dolaşır.
      { replace: true },
    );
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const tabs = protocol.tabs;
    const currentIndex = tabs.indexOf(activeTab);
    let nextIndex: number | undefined;

    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    const nextTab = tabs[nextIndex];
    if (nextTab === undefined) return;
    event.preventDefault();
    goToTab(nextTab);
    // Otomatik etkinleştirme: odak da taşınmalı, yoksa klavye kullanıcısı
    // seçtiği sekmeyi kaybeder.
    tabRefs.current.get(nextTab)?.focus();
  };

  const panelId = `tabpanel-${activeTab}`;
  const activeTabId = `tab-${activeTab}`;
  const visibleTools = selectToolsForTab(protocol.tools, activeTab);
  const calculatorIds = protocol.calculatorIds ?? [];
  // Alias kayıtları kanonik kayda inilerek çözülür; `null` = motoru yok.
  const decodePluginId = resolvePluginId(protocol);
  // Rozet de aynı zincirden gelir: alias sayfası çalışan bir çözümleyicinin
  // üstünde "Planlandı" yazmamalı.
  const decodeStatus = resolveStatus(protocol);
  /**
   * Hangi tanım paneli açılacağı kaydın `definitions` listesinden gelir
   * (alias zincirine inilmez — hangi biçimlerin gösterileceği sayfanın kendi
   * verisidir). Motoru olmayan bir biçim (`gsd`, `ldf`, …) listede olsa da
   * `DEFINITION_PANELS`te karşılığı yoksa `undefined` kalır ve "planlandı"
   * dalına düşülür — birden çok biçim varsa (`marine-j1939`'un
   * `['dbc', 'custom-schema']`ı gibi) İLK eşleşen kazanır.
   */
  const DefinitionPanel =
    activeTab === 'definitions'
      ? protocol.definitions?.map((format) => DEFINITION_PANELS[format]).find((panel) => panel !== undefined)
      : undefined;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <Breadcrumbs domain={domain} family={family} protocol={protocol} />

      <header className="flex flex-col gap-2">
        <h1 className="font-display text-xl font-semibold text-text sm:text-2xl">{protocol.name}</h1>
        <ProtocolBadges layer={protocol.layer} status={decodeStatus} />
        <p className="max-w-3xl text-sm text-muted">{protocol.summary}</p>
      </header>

      {protocol.aliasOf !== undefined && canonical !== undefined && (
        <aside className="flex flex-col items-start gap-2 rounded-token border border-line bg-warn-soft p-3 text-sm text-warn">
          <p>{t('protocol.aliasNotice', { name: canonical.protocol.name })}</p>
          <Link
            to={`/${canonical.path}`}
            className="rounded-token-sm font-medium underline focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t('protocol.canonical')}
          </Link>
        </aside>
      )}

      {/* Sekme çubuğu 360px'de kaydırılır; sarmalamak sekme sırasını okunmaz kılıyor. */}
      <div role="tablist" aria-label={t('tab.groupLabel')} className="flex gap-1 overflow-x-auto border-b border-line">
        {protocol.tabs.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              ref={(element) => {
                tabRefs.current.set(tab, element);
              }}
              id={`tab-${tab}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={isActive ? panelId : undefined}
              tabIndex={isActive ? 0 : -1}
              onClick={() => {
                goToTab(tab);
              }}
              onKeyDown={handleTabKeyDown}
              className={`shrink-0 rounded-token-sm px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent ${
                isActive
                  ? 'border-b-2 border-accent font-medium text-accent-strong'
                  : 'text-muted hover:text-text'
              }`}
            >
              {t(TAB_LABEL_KEYS[tab])}
            </button>
          );
        })}
      </div>

      <section id={panelId} role="tabpanel" aria-labelledby={activeTabId} tabIndex={0} className="flex flex-col gap-4">
        {activeTab === 'overview' ? (
          <>
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
                {t('protocol.tools')}
              </h2>
              <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {protocol.tools.map((tool) => (
                  <li
                    key={tool}
                    className="rounded-token-sm border border-line bg-surface px-2 py-1.5 text-sm text-text"
                  >
                    {tool}
                  </li>
                ))}
              </ul>
            </div>

            {protocol.definitions !== undefined && protocol.definitions.length > 0 && (
              <div className="flex flex-col gap-2">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
                  {t('protocol.definitions')}
                </h2>
                <ul className="flex flex-wrap gap-1.5">
                  {protocol.definitions.map((format) => (
                    <li
                      key={format}
                      className="rounded-token-sm border border-line bg-raised px-2 py-1 text-xs text-muted"
                    >
                      {t(DEFINITION_LABEL_KEYS[format])}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {protocol.related !== undefined && protocol.related.length > 0 && (
              <div className="flex flex-col gap-2">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
                  {t('protocol.related')}
                </h2>
                <ul className="flex flex-wrap gap-1.5">
                  {protocol.related.map((relatedPath) => {
                    const target = findEntry(relatedPath);
                    // Kırık referans katalog testinde düşer; burada sessizce atlanır
                    // ki bozuk bir veri satırı tüm sayfayı götürmesin.
                    if (target === undefined) return null;
                    return (
                      <li key={relatedPath}>
                        <Link
                          to={`/${target.path}`}
                          className="block rounded-token-sm border border-line bg-raised px-2 py-1 text-xs text-text hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          {target.protocol.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        ) : (
          <>
            {/*
              Motoru olan protokolde "planlandı" bildirimi BASILMAZ: sekme artık
              gerçekten çalışıyor, uyarı yalanlanmış olurdu. Bildirim ve sabit
              örnek çerçeve yalnız eklentisi olmayan protokollerin dalında kalır.
            */}
            {activeTab === 'decode' && decodePluginId !== null ? (
              <Suspense fallback={<DecodeFallback />}>
                <DecodePanel pluginId={decodePluginId} />
              </Suspense>
            ) : DefinitionPanel !== undefined ? (
              <Suspense fallback={<DecodeFallback />}>
                <DefinitionPanel />
              </Suspense>
            ) : activeTab === 'data' && protocol.pluginId === 'lte-modem-at' ? (
              <Suspense fallback={<DecodeFallback />}>
                <CellularInitializationDashboard />
              </Suspense>
            ) : (
              <>
                <p className="rounded-token border border-line bg-surface p-3 text-sm text-muted">
                  {t('protocol.plannedNotice')}
                </p>

                {activeTab === 'decode' && (
                  <div className="flex flex-col gap-2 overflow-x-auto rounded-token border border-line bg-surface p-3">
                    <ByteViewer
                      bytes={SAMPLE_FRAME_BYTES}
                      regions={SAMPLE_FRAME_REGIONS}
                      selectedRegionId={selectedRegionId}
                      onRegionSelect={(regionId) => {
                        setSelectedRegionId((current) => (current === regionId ? null : regionId));
                      }}
                      emptyLabel={t('common.empty')}
                    />
                    <ul className="flex flex-wrap gap-2 text-xs">
                      {SAMPLE_FRAME_REGIONS.map((region) => (
                        <li
                          key={region.id}
                          className={`font-mono ${SERIES_TEXT_CLASS[region.colorIndex ?? 0]}`}
                        >
                          {region.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {activeTab === 'timing' && calculatorIds.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
                      {t('protocol.relatedCalculators')}
                    </h2>
                    <ul className="flex flex-wrap gap-1.5">
                      {calculatorIds.map((calculatorId) => {
                        const tool = findCalculator(calculatorId);
                        // Ölü id catalog.test.ts'te yakalanır; burada sessizce
                        // atlanır ki bozuk bir veri satırı tüm sekmeyi götürmesin.
                        if (tool === undefined) return null;
                        return (
                          <li key={calculatorId}>
                            <Link
                              to={`/calculators/${calculatorId}`}
                              className="block rounded-token-sm border border-line bg-raised px-2 py-1 text-xs text-text hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
                            >
                              {t(tool.nameKey)}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </>
            )}

            <div className="flex flex-col gap-2">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
                {t('protocol.tools')}
              </h2>
              {visibleTools.length > 0 ? (
                <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {visibleTools.map((tool) => (
                    <li
                      key={tool}
                      className="rounded-token-sm border border-line bg-surface px-2 py-1.5 text-sm text-text"
                    >
                      {tool}
                    </li>
                  ))}
                </ul>
              ) : (
                // Bu sekmede taksonomiden gelen araç yok. Tüm listeye düşmek
                // sekmeleri birbirinin kopyası yapardı; boş olduğunu söylemek dürüst.
                <p className="text-sm text-muted">{t('protocol.noToolsForTab')}</p>
              )}
            </div>
          </>
        )}
      </section>

      <Link
        to={`/${domain.id}/${family.id}`}
        className="self-start rounded-token-sm px-1 text-sm text-muted hover:text-text focus-visible:ring-2 focus-visible:ring-accent"
      >
        {t('protocol.backToFamily')}
      </Link>
    </div>
  );
}

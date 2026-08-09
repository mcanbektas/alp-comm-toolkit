import type { TranslationDictionary } from './tr';

/**
 * İngilizce sözlük. Tipi `tr`den türetildiği için iki sözlüğün sessizce
 * ayrışması MÜMKÜN DEĞİL: `tr`ye eklenip buraya eklenmeyen her anahtar
 * "missing property" derleme hatası, burada olup `tr`de olmayan her anahtar
 * "object literal may only specify known properties" hatası verir. Bu dosyada
 * çalışma zamanı kontrolü ya da fallback yok — olması da gerekmiyor.
 *
 * Anotasyon bilerek `TranslationDictionary`; `satisfies` kullanılırsa eksik
 * anahtar yine yakalanır ama değer tipi literal'e daralır ve `translations`
 * kaydında gereksiz genişleme sorunları çıkar.
 */
export const en: TranslationDictionary = {
  // --- Application shell ---
  'app.title': 'ALP Comm Toolkit',
  'app.tagline': 'A workbench for analysing and building communication protocols',
  'app.skipToContent': 'Skip to content',

  // --- Navigation and search ---
  'nav.home': 'Home',
  'nav.domains': 'Domains',
  'nav.search': 'Search',
  'nav.searchPlaceholder': 'Search protocols, families or domains…',
  'nav.searchHint': 'Press / to open search',
  'nav.noResults': 'No matching entries',
  'nav.resultCount': '{count} results',
  'nav.closeMenu': 'Close menu',
  'nav.openMenu': 'Open menu',

  // --- Theme and language switches ---
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.toggle': 'Toggle theme',
  'lang.label': 'Language',
  'lang.tr': 'Turkish',
  'lang.en': 'English',

  // --- Home page ---
  'home.heading': 'Communication protocol workbench',
  'home.intro':
    'Explore protocols grouped into eight domains: decode frames, build telegrams, and read timing and diagnostic data.',
  'home.domainCount': '{count} domains',
  'home.familyCount': '{count} families',
  'home.protocolCount': '{count} protocols',
  'home.openDomain': 'Open domain',
  'home.exploreDomains': 'Browse the domains',

  // --- Domain page ---
  'domain.familyCount': '{count} families',
  'domain.protocolCount': '{count} protocols',
  'domain.backToHome': 'Back to home',

  // --- Family page ---
  'family.protocolCount': '{count} protocols',
  'family.backToDomain': 'Back to domain',

  // --- Protocol page ---
  'protocol.layer': 'Layer',
  'protocol.status': 'Status',
  'protocol.tools': 'Tools',
  'protocol.related': 'Related protocols',
  'protocol.definitions': 'Definition files',
  'protocol.aliasNotice':
    'This entry mirrors {name} from another domain; both are served by the same engine.',
  'protocol.canonical': 'Go to the canonical entry',
  'protocol.backToFamily': 'Back to family',
  'protocol.plannedNotice':
    'No decoder is wired up for this protocol yet; the page currently shows its scope and tooling.',

  // --- Workspace tabs (names mirror WorkspaceTab in the catalog) ---
  'tab.overview': 'Overview',
  'tab.live': 'Live',
  'tab.decode': 'Decode',
  'tab.build': 'Build',
  'tab.timing': 'Timing',
  'tab.data': 'Data',
  'tab.diagnostics': 'Diagnostics',
  'tab.definitions': 'Definitions',
  'tab.examples': 'Examples',
  'tab.groupLabel': 'Workspace tabs',

  // --- Maturity badges (ImplementationStatus) ---
  'status.planned': 'Planned',
  'status.partial': 'Partial',
  'status.ready': 'Ready',

  // --- Layer labels (ProtocolLayer) ---
  'layer.physical': 'Physical',
  'layer.data-link': 'Data link',
  'layer.network': 'Network',
  'layer.transport': 'Transport',
  'layer.application': 'Application',
  'layer.multi-layer': 'Multi-layer',

  // --- Definition file formats (DefinitionFormat) ---
  'definition.dbc': 'DBC — CAN database',
  'definition.eds': 'EDS — CANopen device description',
  'definition.gsd': 'GSD — PROFIBUS device description',
  'definition.gsdml': 'GSDML — PROFINET device description',
  'definition.iodd': 'IODD — IO-Link device description',
  'definition.a2l': 'A2L — ASAM measurement and calibration',
  'definition.ldf': 'LDF — LIN network description',
  'definition.scl': 'SCL — IEC 61850 station description',
  'definition.xif': 'XIF — LonWorks external interface file',
  'definition.dsdl': 'DSDL — Cyphal data structure language',
  'definition.vendor-map': 'Vendor register map',
  'definition.custom-schema': 'Custom schema',

  // --- Not found and errors ---
  'notFound.title': 'Page not found',
  'notFound.body':
    'This address does not match anything in the catalog. The link may be stale or a protocol id may have changed.',
  'notFound.back': 'Back to home',
  'error.title': 'Something went wrong',
  'error.body': 'This section failed to load. Try again, or move on to another protocol.',
  'error.retry': 'Try again',

  // --- Shared actions ---
  'common.copy': 'Copy',
  'common.copied': 'Copied',
  'common.copyFailed': 'Copy failed',
  'common.export': 'Export',
  'common.back': 'Back',
  'common.loading': 'Loading…',
  'common.empty': 'Nothing to show',
  'common.close': 'Close',
  'common.clear': 'Clear',
};

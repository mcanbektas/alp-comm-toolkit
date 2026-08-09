/**
 * Katalog, uygulamanın navigasyon iskeletidir: 8 domain → 54 aile → 172 protokol.
 * Saf veridir — hiçbir parser, bileşen ya da yan etki içermez. Bir protokolün
 * gerçekten çalışan motoru varsa `pluginId` ile plugin registry'ye bağlanır;
 * yoksa sayfa "planlandı" durumunda görünür.
 */

/** Domain kimlikleri sabittir: rota segmenti olarak da kullanılır (`/comm/<id>`). */
export const DOMAIN_IDS = [
  'interfaces-framing',
  'industrial-automation',
  'automotive',
  'marine-navigation',
  'aerospace-uav',
  'building-automation',
  'network-ethernet',
  'wireless-iot',
] as const;

export type DomainId = (typeof DOMAIN_IDS)[number];

/**
 * Protokol sayfasındaki workspace sekmeleri. Sekme listesi protokol
 * capability'sine göre dinamik kurulur — UART sayfasında `definitions` görünmez,
 * CAN sayfasında görünür (taksonomi §"Dinamik Definitions kuralı").
 */
export const WORKSPACE_TABS = [
  'overview',
  'live',
  'decode',
  'build',
  'timing',
  'data',
  'diagnostics',
  'definitions',
  'examples',
] as const;

export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];

/**
 * `definitions` sekmesinde gösterilen makine-okunur tanım dosyası biçimleri.
 * Protokol hangilerini destekliyorsa yalnız onlar listelenir.
 */
export const DEFINITION_FORMATS = [
  'dbc',
  'eds',
  'gsd',
  'gsdml',
  'iodd',
  'a2l',
  'ldf',
  'scl',
  'xif',
  'dsdl',
  'vendor-map',
  'custom-schema',
] as const;

export type DefinitionFormat = (typeof DEFINITION_FORMATS)[number];

/** Protokolün oturduğu katman — Overview sekmesinde ve filtrelemede kullanılır. */
export type ProtocolLayer =
  | 'physical'
  | 'data-link'
  | 'network'
  | 'transport'
  | 'application'
  | 'multi-layer';

/** Uygulama içi olgunluk. Faz 2'de her şey `planned`; motor geldikçe yükselir. */
export type ImplementationStatus = 'planned' | 'partial' | 'ready';

export interface CatalogProtocol {
  /** Aile içinde benzersiz slug; rota segmenti (`/comm/<domain>/<family>/<id>`). */
  id: string;
  /** Arayüzde görünen ad — İngilizce, spec'teki yazımıyla (ör. "Modbus RTU"). */
  name: string;
  /** Tek cümlelik açıklama. Kart altyazısı ve arama indeksinde kullanılır. */
  summary: string;
  layer: ProtocolLayer;
  status: ImplementationStatus;
  /** Bu protokolde açılacak workspace sekmeleri, spec'teki sırayla. */
  tabs: readonly WorkspaceTab[];
  /**
   * Taksonomideki araç/analiz başlıkları (Frame Decoder, CRC, Timing …).
   * Sayfanın ne vaat ettiğini gösterir; boş bırakılmaz.
   */
  tools: readonly string[];
  /** Yalnız `tabs` içinde `definitions` varsa dolu olur. */
  definitions?: readonly DefinitionFormat[];
  /**
   * Aynı motoru/sayfayı paylaşan ya da hızlı geçiş verilen protokoller.
   * `"<domainId>/<familyId>/<protocolId>"` biçiminde tam yol.
   */
  related?: readonly string[];
  /**
   * Bu protokol başka bir domain'deki kaydın kasıtlı tekrarıysa (CANopen,
   * Modbus, M-Bus, MQTT, CoAP, RTCM, NMEA …) kanonik kaydın tam yolu.
   * Sayım ve arama sonuçlarında tekrarları ayırt etmeye yarar.
   */
  aliasOf?: string;
  /** Plugin registry anahtarı. Motor yazıldığında doldurulur. */
  pluginId?: string;
}

export interface CatalogFamily {
  /** Domain içinde benzersiz slug; rota segmenti. */
  id: string;
  name: string;
  summary: string;
  protocols: readonly CatalogProtocol[];
}

export interface CatalogDomain {
  id: DomainId;
  /** Ana sayfa kartındaki başlık. */
  name: string;
  summary: string;
  /** Kartta gösterilen 4–6 tanınmış protokol adı. */
  highlights: readonly string[];
  families: readonly CatalogFamily[];
}

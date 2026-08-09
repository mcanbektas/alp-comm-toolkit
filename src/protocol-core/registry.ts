/**
 * Lazy protokol eklenti kayıt defteri.
 *
 * Neden lazy: 172 protokolün motoru başlangıç bundle'ına giremez (spec §44 "ana
 * sayfa hızlı açılmalı"). Bu yüzden kayıt anında modül DEĞİL, modülü getiren bir
 * loader saklanır; `import()` ancak kullanıcı o protokole girdiğinde koşar ve
 * Vite kodu ayrı chunk'a böler.
 *
 * Kayıt defteri katalogdan bağımsızdır: katalog "bu protokol var" der, registry
 * "motoru yüklenebilir" der. Bağ, katalogdaki `pluginId` alanıdır.
 */

import type { ProtocolPlugin } from './types';

/**
 * `() => import('./modbus/rtu')` çağrısı modül NAMESPACE'i döndürür; plugin
 * genelde default export'tadır. İki biçim de kabul edilir, çünkü test ve basit
 * kullanımda doğrudan nesne döndürmek daha okunaklı.
 */
export type ProtocolPluginModule = ProtocolPlugin | { readonly default: ProtocolPlugin };

export type ProtocolPluginLoader = () => Promise<ProtocolPluginModule>;

export type ProtocolRegistryErrorCode =
  | 'unknown-protocol'
  | 'duplicate-registration'
  | 'plugin-id-mismatch';

/**
 * Ayrı hata sınıfı: çağıran "protokol yok" ile "modül yüklenemedi (ağ)" durumunu
 * ayırt edebilmeli — ilki rota 404'ü, ikincisi yeniden deneme düğmesi.
 */
export class ProtocolRegistryError extends Error {
  readonly code: ProtocolRegistryErrorCode;

  constructor(code: ProtocolRegistryErrorCode, message: string) {
    super(message);
    this.name = 'ProtocolRegistryError';
    this.code = code;
  }
}

export interface ProtocolRegistry {
  /**
   * Loader kayıt anında ÇAĞRILMAZ. İki kez aynı id kaydetmek hatadır: sessizce
   * üzerine yazmak, hangi parser'ın koştuğunu belirsizleştirir ve yanlış
   * çözümlemeyi sessiz bir hataya dönüştürür.
   */
  registerProtocolPlugin(id: string, loader: ProtocolPluginLoader): void;
  isProtocolRegistered(id: string): boolean;
  /** Alfabetik sıralı: kayıt sırası modül değerlendirme sırasına bağlı, deterministik değil. */
  registeredProtocolIds(): readonly string[];
  /** Senkron erişim — yalnız daha önce yüklenmişse döner, yükleme BAŞLATMAZ. */
  getLoadedPlugin(id: string): ProtocolPlugin | undefined;
  loadProtocolPlugin(id: string): Promise<ProtocolPlugin>;
}

function unwrapPluginModule(loaded: ProtocolPluginModule): ProtocolPlugin {
  // `ProtocolPlugin`'in `default` alanı yok; ayrım bu yüzden tek anahtarla güvenli.
  return 'default' in loaded ? loaded.default : loaded;
}

export function createProtocolRegistry(): ProtocolRegistry {
  const loaders = new Map<string, ProtocolPluginLoader>();
  const loaded = new Map<string, ProtocolPlugin>();
  /**
   * Uçuştaki yüklemeler. Değişmez: aynı id için eşzamanlı N çağrı TEK loader
   * koşturur — aksi hâlde protokol sayfası ile arama önizlemesi aynı anda açılınca
   * modül iki kez indirilir ve iki farklı plugin nesnesi dolaşıma girer.
   */
  const inFlight = new Map<string, Promise<ProtocolPlugin>>();

  const registerProtocolPlugin = (id: string, loader: ProtocolPluginLoader): void => {
    if (loaders.has(id)) {
      throw new ProtocolRegistryError(
        'duplicate-registration',
        `Protocol plugin "${id}" is already registered`,
      );
    }
    loaders.set(id, loader);
  };

  const isProtocolRegistered = (id: string): boolean => loaders.has(id);

  const registeredProtocolIds = (): readonly string[] => [...loaders.keys()].sort();

  const getLoadedPlugin = (id: string): ProtocolPlugin | undefined => loaded.get(id);

  const loadProtocolPlugin = (id: string): Promise<ProtocolPlugin> => {
    const alreadyLoaded = loaded.get(id);
    if (alreadyLoaded !== undefined) {
      return Promise.resolve(alreadyLoaded);
    }

    const pending = inFlight.get(id);
    if (pending !== undefined) {
      return pending;
    }

    const loader = loaders.get(id);
    if (loader === undefined) {
      return Promise.reject(
        new ProtocolRegistryError(
          'unknown-protocol',
          `Protocol plugin "${id}" is not registered (${loaders.size} registered)`,
        ),
      );
    }

    // Loader SENKRON da patlayabilir (bozuk kayıt, `() => { throw … }`). O durumda
    // istisna `loadProtocolPlugin`'den senkron fırlar ve `Promise<…>` sözleşmesi
    // bozulur; çağıran `.catch` kurmuş olduğu için hatayı hiç görmez.
    let started: Promise<ProtocolPluginModule>;
    try {
      started = loader();
    } catch (cause) {
      return Promise.reject(cause instanceof Error ? cause : new Error(String(cause)));
    }

    const request = started
      .then((module) => {
        const plugin = unwrapPluginModule(module);
        if (plugin.id !== id) {
          // Kopyala-yapıştır ile yanlış modüle bağlanmış kayıt sessizce yanlış
          // protokolü çözümler; erken ve gürültülü patlaması gerekir.
          throw new ProtocolRegistryError(
            'plugin-id-mismatch',
            `Protocol plugin registered as "${id}" reports id "${plugin.id}"`,
          );
        }
        loaded.set(id, plugin);
        return plugin;
      })
      .finally(() => {
        // Başarısızlıkta cache'e hiçbir şey yazılmaz; yalnız uçuş kaydı silinir,
        // böylece sonraki deneme loader'ı yeniden koşturur (ağ hatası kalıcı olmasın).
        inFlight.delete(id);
      });

    inFlight.set(id, request);
    return request;
  };

  return {
    registerProtocolPlugin,
    isProtocolRegistered,
    registeredProtocolIds,
    getLoadedPlugin,
    loadProtocolPlugin,
  };
}

/**
 * Uygulama genelindeki tekil defter. Protokol modülleri kendilerini buraya
 * kaydeder; testler global duruma dokunmamak için `createProtocolRegistry()`
 * kullanır.
 */
export const protocolRegistry: ProtocolRegistry = createProtocolRegistry();

export const registerProtocolPlugin: ProtocolRegistry['registerProtocolPlugin'] =
  protocolRegistry.registerProtocolPlugin;
export const isProtocolRegistered: ProtocolRegistry['isProtocolRegistered'] =
  protocolRegistry.isProtocolRegistered;
export const registeredProtocolIds: ProtocolRegistry['registeredProtocolIds'] =
  protocolRegistry.registeredProtocolIds;
export const getLoadedPlugin: ProtocolRegistry['getLoadedPlugin'] =
  protocolRegistry.getLoadedPlugin;
export const loadProtocolPlugin: ProtocolRegistry['loadProtocolPlugin'] =
  protocolRegistry.loadProtocolPlugin;

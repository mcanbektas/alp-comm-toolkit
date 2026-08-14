/**
 * Packet Builder'ın KATMANLAR ARASI sözleşmesi — spec §10.
 *
 * Ekran, dört panel ve `usePacketBuilder` yalnız burada anlaşır. Paneller
 * birbirini TANIMAZ; hepsi tek yönlü olarak bu dosyaya bakar. Tipler panellerin
 * kendi dosyalarına dağıtılsaydı `SendControlPanel`in prop'unu değiştirmek
 * `FieldValueForm`u içe aktarmayı gerektirir, döngüsel bağımlılık kaçınılmaz
 * olurdu (`protocol-studio/studioTypes.ts` ile aynı gerekçe).
 *
 * Bu dosya YALNIZ TİP taşır — tek bir çalışma zamanı değeri bile yok. Bütün
 * içe aktarımları `import type` olduğu için derlemede tamamen silinir; zod'a
 * bağlı `schemas/protocolSchema`yı buradan çekmek pakete bayt eklemez.
 */

import type { PacketTemplate } from '@/features/projects/projectFile';
import type { ProtocolSchema } from '@/protocol-core/schemas/protocolSchema';
import type {
  BuilderFieldDescriptor,
  PacketBuildResult,
  PacketIssue,
  PostProcessing,
} from './packetPipeline';
import type { SendSchedulerConfig, SendSchedulerState } from './sendScheduler';

/**
 * Builder'ın kullanabildiği kaynaklar. `connection/types.ts`in
 * `ByteSourceKind`inden (`'web-serial' | 'simulated'`) AYRI tutuldu: bu tip
 * kullanıcının SEÇTİĞİNİ, o tip kurulan kaynağın ne olduğunu anlatır. İkisini
 * tek tipe indirmek, ileride aynı seçimden farklı bir kaynak (yerel bridge)
 * kurulduğunda ekranı da değiştirmeyi gerektirirdi.
 *
 * WebSocket bilerek YOK: `src/connection/websocket` henüz gerçeklenmedi ve
 * seçilebilir bir değer olarak burada durursa `connect()` sessizce hiçbir şey
 * yapmayan bir dala düşerdi. Panel onu devre dışı bir seçenek olarak gösterir.
 */
export type BuilderSourceKind = 'serial' | 'simulated';

export interface BuilderConnectionState {
  readonly status: 'disconnected' | 'connecting' | 'connected' | 'error';
  /** Bağlanılan/denenen kaynak; hiç denenmediyse `null`. */
  readonly kind: BuilderSourceKind | null;
  /** Kaynak TX destekliyor mu — simülasyon kaynağı yazamaz, gönderim engellenir. */
  readonly canWrite: boolean;
  /** Çeviri anahtarı; ham hata metni ASLA taşınmaz (görünen metin koda gömülmez). */
  readonly errorKey: string | null;
}

/**
 * Builder'ın bütün durumu ve eylemleri. Ekran bu nesneyi alır ve panellere
 * dağıtır; protokol hesabının hiçbiri bileşende değildir (CLAUDE.md mimari
 * kuralı) — hepsi `packetPipeline` ve `sendScheduler` saf modüllerinde.
 */
export interface PacketBuilderApi {
  /** Paylaşılan store'daki tanım çözülemiyorsa `null`; yarım şema üretilmez. */
  readonly schema: ProtocolSchema | null;
  readonly schemaErrorKey: string | null;
  readonly fields: readonly BuilderFieldDescriptor[];
  /** Form değerleri METİN tutulur; sayıya çevirme `buildPacket` sınırında yapılır. */
  readonly values: Readonly<Record<string, string>>;
  /** Şema yoksa `null`. Sorunlar burada; hiçbiri istisnaya dönüşmez. */
  readonly buildResult: PacketBuildResult | null;
  /** Doluysa gönderilecek baytlar formdan DEĞİL bu metinden üretilir (spec §10 "HEX düzenleme"). */
  readonly hexOverride: string | null;
  readonly postProcessing: PostProcessing;
  /** Kabloya çıkacak baytlar; üretilemiyorsa `null` — gönderim de engellenir. */
  readonly outgoingBytes: Uint8Array | null;
  readonly connection: BuilderConnectionState;
  readonly scheduler: SendSchedulerState;
  readonly schedulerConfig: SendSchedulerConfig;
  readonly responseTimeoutMs: number;
  /** Son gönderimin yanıtı; süre dolduysa `null` — bu bir HATA DEĞİL. */
  readonly lastResponse: Uint8Array | null;
  readonly setValue: (path: string, value: string) => void;
  readonly stepValue: (path: string, delta: number) => void;
  readonly randomize: () => void;
  readonly setHexOverride: (hex: string | null) => void;
  readonly setPostProcessing: (mode: PostProcessing) => void;
  readonly setSchedulerConfig: (config: SendSchedulerConfig) => void;
  readonly setResponseTimeoutMs: (ms: number) => void;
  readonly connect: (kind: BuilderSourceKind) => Promise<void>;
  readonly disconnect: () => Promise<void>;
  readonly send: () => void;
  readonly stopSending: () => void;
  readonly reloadSchema: () => void;
  /**
   * Formun o anki değerlerini paylaşılan store'a şablon olarak yazar. Şema
   * yoksa ya da ad boşsa hiçbir şey olmaz: şablon `schemaName` taşımak zorunda
   * (spec §40) ve adsız bir kayıt bir sonraki açılışta sessizce düşerdi.
   */
  readonly saveAsTemplate: (name: string) => void;
  /** Şablonun değerlerini forma TOPTAN yazar; eski değerler korunmaz. */
  readonly applyTemplate: (template: PacketTemplate) => void;
}

/**
 * Bağlantı paneli.
 *
 * Seçili kaynak DIŞARIDAN kontrol edilir (panelin kendi state'i yok): ekran
 * hangi kaynağın seçili olduğunu kaydetmek/geri yüklemek zorunda (spec §40
 * proje dosyası), panel içinde tutulsaydı bu bilgi ekrana hiç ulaşmazdı.
 */
export interface BuilderConnectionPanelProps {
  readonly connection: BuilderConnectionState;
  readonly selectedKind: BuilderSourceKind;
  readonly onSelectedKindChange: (kind: BuilderSourceKind) => void;
  readonly onConnect: () => void;
  readonly onDisconnect: () => void;
}

/**
 * Alan değerleri formu.
 *
 * Sorunları FİLTRELENMEMİŞ alır ve `fieldId` ile kendi eşlemesini yapar: aynı
 * listeyi hem burada hem önizleme panelinde göstermek gerekiyor, iki kez
 * gruplamak yerine tek kaynak dolaşıyor.
 */
export interface FieldValueFormProps {
  readonly fields: readonly BuilderFieldDescriptor[];
  readonly values: Readonly<Record<string, string>>;
  readonly issues: readonly PacketIssue[];
  readonly onValueChange: (path: string, value: string) => void;
  /** `delta` alan tipine göre yorumlanır; motor sınırlara kırpar. */
  readonly onStepValue: (path: string, delta: number) => void;
  readonly onRandomize: () => void;
}

/**
 * Üretilen paket önizlemesi.
 *
 * `bytes` KABLOYA ÇIKACAK hâldir (post-processing uygulanmış). Ham çerçeve
 * bilerek alınmıyor: checksum'un neyin üzerinde hesaplandığını göstermek
 * Studio'nun işi, burada iki farklı bayt dizisi göstermek kullanıcıyı hangisinin
 * gönderileceği konusunda ikilemde bırakırdı.
 */
export interface PacketPreviewPanelProps {
  readonly bytes: Uint8Array | null;
  readonly issues: readonly PacketIssue[];
  /** `null` = HEX düzenleme kapalı; boş metin = açık ama henüz bir şey yazılmadı. */
  readonly hexOverride: string | null;
  readonly onHexOverrideChange: (hex: string | null) => void;
  readonly postProcessing: PostProcessing;
  readonly onPostProcessingChange: (mode: PostProcessing) => void;
}

/** Gönderim denetimi — mod, periyot, tekrar, yanıt bekleme (spec §10). */
export interface SendControlPanelProps {
  readonly config: SendSchedulerConfig;
  readonly onConfigChange: (config: SendSchedulerConfig) => void;
  readonly responseTimeoutMs: number;
  readonly onResponseTimeoutMsChange: (ms: number) => void;
  readonly state: SendSchedulerState;
  /** Bağlantı yazabiliyor ve gönderilecek bayt var mı. */
  readonly canSend: boolean;
  readonly lastResponse: Uint8Array | null;
  readonly onSend: () => void;
  readonly onStop: () => void;
}

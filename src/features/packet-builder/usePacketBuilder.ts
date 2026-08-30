/**
 * Packet Builder'ın beyni — spec §10.
 *
 * ## Tek yönlü zincir
 *
 * Tek doğruluk kaynağı METİN form değerleridir; kalan her şey ondan türetilir:
 *
 *   schemaJson → schema → fields → values
 *                                    ↘ encodeValues → buildResult → outgoingBytes
 *                        hexOverride ↗
 *
 * Türetilenlerin hiçbiri `useState`'te tutulmaz. Tutulsaydı "formda gördüğüm
 * değer, gönderilen pakette yok" sınıfı bir hata mümkün olurdu; `useMemo` ile
 * türetmek bu sınıfı tamamen kaldırır.
 *
 * ## Neden değerler METİN
 *
 * Kullanıcı "1.", "-" ya da boş girdi yazarken ara durum kaybolmamalı
 * (`NumberField` de bu yüzden `string` taşır). Sayıya çevirme tek bir sınırda,
 * `buildPacket` çağrısından hemen önce yapılır; çevrilemeyen değer İSTİSNA
 * DEĞİL, `buildResult.issues`e düşen bir sorundur — form her tuş vuruşunda
 * yeniden kodladığı için tek bir istisna ekranı komple düşürürdü.
 *
 * ## Türetilen alanlar
 *
 * `descriptor.derived` olan alanlar (checksum/crc/uzunluk) `values`e HİÇ
 * konmaz. Konsaydı kodlayıcı zaten üzerine yazacağı için kullanıcıya
 * düzenlenebilirmiş yalanı söylenirdi; form onları salt-okunur gösterir.
 *
 * ## Temizlik (spec §41 "sonsuz loop engelle / cancellation")
 *
 * Zamanlayıcı ve bayt kaynağı unmount'ta KOŞULSUZ kapatılır. Zamanlayıcının
 * nesil sayacı geç çözülen gönderimleri etkisizleştirse de bekleyen
 * `setTimeout`u yalnız `stop()` temizler; açık kalan bir seri port ise
 * uygulamanın ikinci bir yerinden bir daha hiç açılamaz.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useProtocolSchemaStore } from '@/app/store/protocolSchemaStore';
import { createSimulatedSource } from '@/connection/mock/simulatedSource';
import type { PacketTemplate } from '@/features/projects/projectFile';
import { DEFAULT_SERIAL_OPTIONS } from '@/connection/serial/serialOptions';
import { createSerialSource } from '@/connection/serial/serialSource';
import { createWebSocketSource } from '@/connection/websocket/webSocketSource';
import { requestSerialPort } from '@/connection/serial/webSerialTypes';
import type { ByteSource, ByteSourceHandlers, ConnectionError, ConnectionStatus } from '@/connection/types';
import { hexToBytes } from '@/protocol-core/buffers/representation';
import type { EncodeValues } from '@/protocol-core/encoding/schemaEncoder';
import { parseProtocolSchemaJson } from '@/protocol-core/schemas/protocolSchema';
import type { ProtocolSchema } from '@/protocol-core/schemas/protocolSchema';

import { findEncoderEntry } from '@/protocols/encoderCatalog';
import { loadProtocolPlugin } from '@/protocol-core/registry';

import type { BuilderConnectionState, BuilderSourceKind, PacketBuilderApi } from './builderTypes';
import { initialValues, toEncodeValues, toText } from './formValues';
import {
  buildPacket,
  buildPacketWithEncoder,
  describeBuilderFields,
  nextSequenceValues,
  randomizeValues,
  stepFieldValue,
} from './packetPipeline';
import type {
  BuilderFieldDescriptor,
  PacketBuildOptions,
  PacketBuildResult,
  PacketIssue,
  PostProcessing,
} from './packetPipeline';
import { createSendScheduler, SCHEDULER_LIMITS, waitForResponse } from './sendScheduler';
import type { SendScheduler, SendSchedulerConfig, SendSchedulerState } from './sendScheduler';

// --- Çeviri anahtarları ---------------------------------------------------

const INVALID_SCHEMA_KEY = 'builder.error.invalidSchema';
const INVALID_HEX_KEY = 'builder.error.invalidHex';
const CANNOT_WRITE_KEY = 'builder.error.cannotWrite';
const NOTHING_TO_SEND_KEY = 'builder.error.nothingToSend';
const PORT_BUSY_KEY = 'builder.error.portBusy';
const SERIAL_UNSUPPORTED_KEY = 'builder.error.serialUnsupported';
/** Motor chunk'ı inene kadar paket ÜRETİLMEZ: yarım seçimle çerçevesiz bayt göndermek sessiz bir hata olurdu. */
const ENCODER_LOADING_KEY = 'builder.issue.encoderLoading';
const ENCODER_LOAD_FAILED_KEY = 'builder.error.encoderLoadFailed';

/**
 * Bağlantı katmanının kod'u → çeviri anahtarı. Şablonla anahtar üretmek yerine
 * tam literal taşıyan sabit tablo (Tailwind kuralıyla aynı gerekçe: üretilen
 * dizge kaynakta aranamaz).
 */
const CONNECTION_ERROR_KEYS: Readonly<Record<ConnectionError['code'], string>> = {
  unsupported: SERIAL_UNSUPPORTED_KEY,
  'permission-denied': 'builder.error.permissionDenied',
  'open-failed': 'builder.error.openFailed',
  'read-failed': 'builder.error.readFailed',
  'write-failed': 'builder.error.writeFailed',
  'not-connected': 'builder.error.notConnected',
};

/**
 * "Port zaten açık" ailesi. Tarayıcılar bu durumu TEK bir hata koduyla
 * bildirmiyor: Chrome `InvalidStateError: The port is already open.`, bazı
 * sürümler `NetworkError` veriyor. Live Monitor aynı portu tutuyorken Builder
 * bağlanmaya çalıştığında kullanıcı "açma hatası" değil, ASIL sebebi görmeli —
 * ikinci bir sekme/ekran portu tutuyor.
 */
const PORT_BUSY_PATTERN = /already open|already in use|InvalidStateError|NetworkError|busy/i;

/** `requestSerialPort` desteklenmeyen tarayıcıda bu metinle fırlatır. */
const UNSUPPORTED_MESSAGE = 'web-serial-unsupported';

// --- Sabitler -------------------------------------------------------------

const EMPTY_FIELDS: readonly BuilderFieldDescriptor[] = [];

const INITIAL_CONNECTION: BuilderConnectionState = {
  status: 'disconnected',
  kind: null,
  canWrite: false,
  errorKey: null,
};

const INITIAL_SCHEDULER_STATE: SendSchedulerState = {
  running: false,
  sentCount: 0,
  lastErrorKey: null,
};

const INITIAL_SCHEDULER_CONFIG: SendSchedulerConfig = {
  mode: 'once',
  intervalMs: SCHEDULER_LIMITS.defaultIntervalMs,
  count: SCHEDULER_LIMITS.defaultCount,
};

/**
 * Formdan paket üretir.
 *
 * Çevrilemeyen bir alan varsa sonuç `ok: false` ve `framedBytes: null` olur —
 * "eksik alanla üretilmiş" bir paketi göstermek/göndermek, kullanıcının fark
 * etmediği bir alanı sessizce 0 yapmak demekti.
 */
function buildFromForm(
  schema: ProtocolSchema,
  fields: readonly BuilderFieldDescriptor[],
  values: Readonly<Record<string, string>>,
  options: PacketBuildOptions,
  /** Verilirse çerçeveyi ŞEMA değil bu plugin encoder'ı üretir (spec §7 `values` ailesi). */
  encode: ((values: EncodeValues) => Uint8Array) | null,
  extraValues?: EncodeValues,
): PacketBuildResult {
  const { encodeValues, issues } = toEncodeValues(fields, values);
  const merged = extraValues === undefined ? encodeValues : { ...encodeValues, ...extraValues };
  const result =
    encode === null
      ? buildPacket(schema, merged, options)
      : buildPacketWithEncoder(schema, encode, merged, options);

  if (issues.length === 0) {
    return result;
  }
  return {
    ok: false,
    rawFrame: result.rawFrame,
    framedBytes: null,
    issues: [...issues, ...result.issues],
  };
}

/**
 * Yüklenmiş plugin encoder'ları SARMAL içinde tutulur: `useState` çıplak bir
 * fonksiyonu güncelleyici sanar ve onu çağırırdı.
 */
interface LoadedFrameEncoder {
  readonly encode: (payload: Uint8Array) => Uint8Array;
}

interface LoadedValuesEncoder {
  readonly schema: ProtocolSchema;
  readonly encode: (values: EncodeValues) => Uint8Array;
  /** Encoder'ın kendi varsayılanlarının form karşılığı; defterden gelir. */
  readonly seedValues?: Readonly<Record<string, string>>;
}

/**
 * Seçim + yüklenmiş encoder → boru hattı seçenekleri.
 *
 * `null` "çerçeveleyici seçildi ama daha inmedi" demektir ve paket üretimini
 * DURDURUR. Yerleşik dala düşmek, kullanıcının seçtiği zarf olmadan bayt
 * göndermek olurdu.
 */
function resolveBuildOptions(
  postProcessing: PostProcessing,
  framingEncoder: LoadedFrameEncoder | null,
): PacketBuildOptions | null {
  if (postProcessing !== 'plugin') {
    return { postProcessing };
  }
  return framingEncoder === null
    ? null
    : { postProcessing: 'plugin', frameEncoder: framingEncoder.encode };
}

interface ParsedOverride {
  readonly bytes: Uint8Array | null;
  readonly errorKey: string | null;
}

function parseHexOverride(hex: string): ParsedOverride {
  try {
    return { bytes: hexToBytes(hex), errorKey: null };
  } catch {
    return { bytes: null, errorKey: INVALID_HEX_KEY };
  }
}

// --- Hata eşlemesi --------------------------------------------------------

function describeCause(cause: unknown): string {
  if (cause instanceof Error) return `${cause.name} ${cause.message}`;
  return String(cause);
}

/** Kaynak kurulurken fırlatılan istisnayı anahtara çevirir. */
function openErrorKey(cause: unknown): string {
  const description = describeCause(cause);
  if (description.includes(UNSUPPORTED_MESSAGE)) {
    return SERIAL_UNSUPPORTED_KEY;
  }
  if (PORT_BUSY_PATTERN.test(description)) {
    return PORT_BUSY_KEY;
  }
  return CONNECTION_ERROR_KEYS['open-failed'];
}

/**
 * `ByteSource` hata bildirimini anahtara çevirir. Port meşgulse "açma hatası"
 * demek yetmez: aynı portu Live Monitor tutuyor olabilir ve kullanıcının
 * yapması gereken şey (oradan bağlantıyı kes) ancak doğru mesajla anlaşılır.
 */
function connectionErrorKey(error: ConnectionError): string {
  if (error.code === 'open-failed' && PORT_BUSY_PATTERN.test(error.message)) {
    return PORT_BUSY_KEY;
  }
  return CONNECTION_ERROR_KEYS[error.code];
}

function toBuilderStatus(status: ConnectionStatus): BuilderConnectionState['status'] {
  switch (status) {
    case 'connecting':
      return 'connecting';
    case 'connected':
      return 'connected';
    case 'error':
      return 'error';
    // 'closing' kapanış YOLUDUR, ayrı bir kullanıcı durumu değil: panelde
    // "kapanıyor" göstermek, hemen ardından gelen "bağlı değil" ile titrerdi.
    case 'idle':
    case 'closing':
      return 'disconnected';
  }
}

// --- Hook -----------------------------------------------------------------

export function usePacketBuilder(): PacketBuilderApi {
  const schemaJson = useProtocolSchemaStore((state) => state.schemaJson);
  const savePacketTemplate = useProtocolSchemaStore((state) => state.savePacketTemplate);
  /** `reloadSchema` tetiği: metin aynı kalsa bile şemayı yeniden çözmeyi zorlar. */
  const [reloadToken, setReloadToken] = useState(0);

  const parsed = useMemo(
    () => parseProtocolSchemaJson(schemaJson),
    // `reloadToken` bilerek bağımlılık: kullanıcı "yeniden yükle" dediğinde
    // metin değişmemiş olsa da form varsayılanlarına dönmeli.
    [schemaJson, reloadToken],
  );

  const [values, setValues] = useState<Readonly<Record<string, string>>>({});
  const [hexOverride, setHexOverrideState] = useState<string | null>(null);
  const [postProcessing, setPostProcessingState] = useState<PostProcessing>('none');
  /** `payload` ailesi: çerçeveyi saran zarf. Seçim kimlikte, motor state'te. */
  const [framingPluginId, setFramingPluginIdState] = useState<string | null>(null);
  const [framingEncoder, setFramingEncoder] = useState<LoadedFrameEncoder | null>(null);
  /** `values` ailesi: çerçevenin ÜRETİCİSİ. `null` iken şema tabanlı yol koşar. */
  const [encoderPluginId, setEncoderPluginIdState] = useState<string | null>(null);
  const [valuesEncoder, setValuesEncoder] = useState<LoadedValuesEncoder | null>(null);
  const [encoderErrorKey, setEncoderErrorKey] = useState<string | null>(null);

  const storeSchema = parsed.success ? parsed.schema : null;

  /**
   * Formu çizen şema. Plugin encoder seçiliyse onun şeması, değilse store'daki.
   * İkisi aynı anda geçerli olamaz: form tek bir alan kümesi gösterir.
   */
  const schema = valuesEncoder === null ? storeSchema : valuesEncoder.schema;
  // Store'daki metin bozuk olsa bile plugin kaynağı çalışır; o hatayı orada
  // göstermek kullanıcıya çözemeyeceği bir sorun bildirmek olurdu.
  const schemaErrorKey = valuesEncoder !== null || parsed.success ? null : INVALID_SCHEMA_KEY;

  const fields = useMemo(
    () => (schema === null ? EMPTY_FIELDS : describeBuilderFields(schema)),
    [schema],
  );
  const [connection, setConnection] = useState<BuilderConnectionState>(INITIAL_CONNECTION);
  const [schedulerState, setSchedulerState] = useState<SendSchedulerState>(INITIAL_SCHEDULER_STATE);
  const [schedulerConfig, setSchedulerConfigState] = useState<SendSchedulerConfig>(INITIAL_SCHEDULER_CONFIG);
  const [responseTimeoutMs, setResponseTimeoutMsState] = useState(SCHEDULER_LIMITS.defaultResponseTimeoutMs);
  const [lastResponse, setLastResponse] = useState<Uint8Array | null>(null);

  // Şema değişince form baştan kurulur: eski protokolün alan yolları yeni
  // şemada olmayabilir ve orada kalan değerler hiçbir zaman görünmeden
  // kodlayıcıya geçmeye devam ederdi.
  //
  // Tohum en sona yazılır: `initialValues` bayt alanlarını BOŞ bırakır, boş
  // değer ise encoder'ın kendi varsayılanını EZERDİ (bkz. `encoderCatalog.ts`).
  useEffect(() => {
    setValues({ ...initialValues(fields), ...(valuesEncoder?.seedValues ?? {}) });
  }, [fields, valuesEncoder]);

  /**
   * Zarf motorunun yüklenmesi. Kimlik değişirse ESKİ yükleme yok sayılır:
   * yavaş inen bir chunk, kullanıcı çoktan başka bir zarfa geçtikten sonra
   * gelip seçimi geri alırdı.
   */
  useEffect(() => {
    if (framingPluginId === null) {
      setFramingEncoder(null);
      return;
    }

    let cancelled = false;
    setFramingEncoder(null);

    loadProtocolPlugin(framingPluginId)
      .then((plugin) => {
        if (cancelled) return;
        const encoder = plugin.encoder;
        if (encoder === undefined) {
          setEncoderErrorKey(ENCODER_LOAD_FAILED_KEY);
          return;
        }
        setFramingEncoder({ encode: (payload) => encoder.encode(payload) });
        setEncoderErrorKey(null);
      })
      .catch(() => {
        if (!cancelled) setEncoderErrorKey(ENCODER_LOAD_FAILED_KEY);
      });

    return () => {
      cancelled = true;
    };
  }, [framingPluginId]);

  /** Üretici motorun ve şemasının yüklenmesi — ikisi TEK adımda, yarım durum yok. */
  useEffect(() => {
    if (encoderPluginId === null) {
      setValuesEncoder(null);
      setEncoderErrorKey(null);
      return;
    }

    const entry = findEncoderEntry(encoderPluginId);
    if (entry === undefined || entry.role !== 'values') {
      setEncoderErrorKey(ENCODER_LOAD_FAILED_KEY);
      return;
    }

    let cancelled = false;
    setValuesEncoder(null);

    Promise.all([entry.load(), loadProtocolPlugin(encoderPluginId)])
      .then(([definition, plugin]) => {
        if (cancelled) return;
        const encoder = plugin.encoder;
        if (encoder === undefined) {
          setEncoderErrorKey(ENCODER_LOAD_FAILED_KEY);
          return;
        }
        setValuesEncoder({
          schema: definition.schema,
          seedValues: definition.seedValues,
          encode: (encodeValues) => encoder.encode(encodeValues),
        });
        setEncoderErrorKey(null);
      })
      .catch(() => {
        if (!cancelled) setEncoderErrorKey(ENCODER_LOAD_FAILED_KEY);
      });

    return () => {
      cancelled = true;
    };
  }, [encoderPluginId]);

  const sourceRef = useRef<ByteSource | undefined>(undefined);
  /** Gelen bayt paketlerini bekleyenler — `waitForResponse` buraya abone olur. */
  const listenersRef = useRef<Set<(bytes: Uint8Array) => void>>(new Set());

  /**
   * Zamanlayıcının geri çağırımı render'lar arasında SABİT kalmalı (nesil
   * sayacı yeniden kurulan bir scheduler'ı kurtaramaz), ama gönderim anında
   * EN SON değerleri okumalı. İkisini bağdaştıran tek yol: değişenleri ref'te
   * tutmak, geri çağırımı ref üzerinden çağırmak.
   */
  const latestRef = useRef({
    schema,
    fields,
    values,
    hexOverride,
    postProcessing,
    responseTimeoutMs,
    framingEncoder,
    encoderPluginId,
    valuesEncoder,
  });
  useEffect(() => {
    latestRef.current = {
      schema,
      fields,
      values,
      hexOverride,
      postProcessing,
      responseTimeoutMs,
      framingEncoder,
      encoderPluginId,
      valuesEncoder,
    };
  });

  const sendOnceRef = useRef<(index: number) => Promise<void>>(async () => undefined);

  const schedulerRef = useRef<SendScheduler | null>(null);
  if (schedulerRef.current === null) {
    schedulerRef.current = createSendScheduler({
      send: (index) => sendOnceRef.current(index),
      onStateChange: setSchedulerState,
    });
  }
  const scheduler = schedulerRef.current;

  // --- Türetilenler -------------------------------------------------------

  const buildResult = useMemo<PacketBuildResult | null>(() => {
    const options = resolveBuildOptions(postProcessing, framingEncoder);
    /** Motoru inmemiş bir seçim: form dursun, ama kabloya çıkacak bayt OLMASIN. */
    const pending = encoderPluginId !== null && valuesEncoder === null;

    const formResult =
      schema === null
        ? null
        : options === null || pending
          ? {
              ok: false,
              rawFrame: null,
              framedBytes: null,
              issues: [{ fieldId: null, messageKey: ENCODER_LOADING_KEY }],
            }
          : buildFromForm(schema, fields, values, options, valuesEncoder?.encode ?? null);

    if (hexOverride === null) {
      return formResult;
    }

    // HEX düzenleme açıkken kabloya çıkan şey metindir; form sorunları yine de
    // taşınır, çünkü form ekranda durmaya devam ediyor ve sorunları oraya
    // düşmezse kullanıcı düzenlemeyi kapattığında sürprizle karşılaşır.
    const override = parseHexOverride(hexOverride);
    const overrideIssues: readonly PacketIssue[] =
      override.errorKey === null ? [] : [{ fieldId: null, messageKey: override.errorKey }];

    return {
      ok: override.bytes !== null,
      rawFrame: formResult?.rawFrame ?? null,
      framedBytes: override.bytes,
      issues: [...(formResult?.issues ?? []), ...overrideIssues],
    };
  }, [schema, fields, values, postProcessing, framingEncoder, encoderPluginId, valuesEncoder, hexOverride]);

  const outgoingBytes = buildResult?.framedBytes ?? null;

  // --- Form eylemleri -----------------------------------------------------

  const setValue = useCallback((path: string, value: string) => {
    setValues((previous) => {
      if (previous[path] === value) {
        return previous;
      }
      return { ...previous, [path]: value };
    });
  }, []);

  const stepValue = useCallback((path: string, delta: number) => {
    setValues((previous) => {
      const current = latestRef.current;
      if (current.schema === null) {
        return previous;
      }
      const { encodeValues } = toEncodeValues(current.fields, previous);
      const stepped = stepFieldValue(current.schema, encodeValues, path, delta);
      const next = stepped[path];
      if (next === undefined) {
        // Bilinmeyen yol, türetilmiş ya da sayısal olmayan alan: motor girdiyi
        // aynen döndürür, form da dokunmadan kalır.
        return previous;
      }
      const text = toText(next);
      return previous[path] === text ? previous : { ...previous, [path]: text };
    });
  }, []);

  const randomize = useCallback(() => {
    setValues((previous) => {
      const current = latestRef.current;
      if (current.schema === null) {
        return previous;
      }
      const { encodeValues } = toEncodeValues(current.fields, previous);
      const randomized = randomizeValues(current.schema, encodeValues, Math.random);
      if (randomized === encodeValues) {
        // Rastgelelenecek sayısal alan yok — motor girdiyi aynen döndürdü.
        return previous;
      }
      const next = { ...previous };
      for (const field of current.fields) {
        const value = randomized[field.path];
        if (value === undefined || value === encodeValues[field.path]) {
          continue;
        }
        next[field.path] = toText(value);
      }
      return next;
    });
  }, []);

  const setHexOverride = useCallback((hex: string | null) => {
    setHexOverrideState(hex);
  }, []);

  /**
   * Yerleşik dal seçilince plugin zarfı DÜŞER. İki alanı ayrı ayrı yazılabilir
   * bırakmak, "plugin seçili ama kimlik yok" gibi tutarsız bir durumu mümkün
   * kılardı; değişmez tek yerde, burada korunuyor.
   */
  const setPostProcessing = useCallback((mode: Exclude<PostProcessing, 'plugin'>) => {
    setPostProcessingState(mode);
    setFramingPluginIdState(null);
  }, []);

  const setFramingPlugin = useCallback((pluginId: string) => {
    setPostProcessingState('plugin');
    setFramingPluginIdState(pluginId);
  }, []);

  /** `null` şema tabanlı üretime döndürür — ikinci yol, YERİNE GEÇEN yol değil. */
  const setEncoderPlugin = useCallback((pluginId: string | null) => {
    setEncoderPluginIdState(pluginId);
    setHexOverrideState(null);
  }, []);

  /**
   * Yapılandırma HAM saklanır, kırpılmaz. Her tuş vuruşunda kırpmak "50 ms"
   * yazmayı imkânsız kılardı: "5" anında alt sınır 10'a sıçrardı. Güvenli
   * aralığa çekme `scheduler.start` içinde (`clampSchedulerConfig`) zaten var.
   */
  const setSchedulerConfig = useCallback((config: SendSchedulerConfig) => {
    setSchedulerConfigState(config);
  }, []);

  const setResponseTimeoutMs = useCallback((ms: number) => {
    setResponseTimeoutMsState(ms);
  }, []);

  const reloadSchema = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  // --- Şablonlar ----------------------------------------------------------

  /**
   * Şablon şemanın ADIYLA bağlanır, kimliğiyle değil: şemaların kimliği yok
   * (spec §40 `PacketTemplate`). Şema çözülemiyorsa yazacak bir ad da yok ve
   * `schemaName`i boş bırakılmış şablon, dosyaya yazılırsa kendi
   * çözümleyicimizce reddedilirdi — bu yüzden sessiz no-op.
   *
   * Değerler `latestRef`ten değil doğrudan state'ten okunuyor: kaydetme bir
   * kullanıcı jestidir, o anda render edilmiş değerler zaten günceldir.
   */
  const saveAsTemplate = useCallback(
    (name: string) => {
      if (schema === null) {
        return;
      }
      savePacketTemplate(name, schema.name, { ...values });
    },
    [savePacketTemplate, schema, values],
  );

  /**
   * Değerler TOPTAN değiştirilir, mevcutlarla birleştirilmez: birleştirseydik
   * başka bir şemanın şablonu uygulandığında ekranda iki şemanın alanları
   * karışır ve kullanıcı hangi değerin nereden geldiğini bilemezdi.
   *
   * Şemada karşılığı olmayan yollar zararsız: `toEncodeValues` yalnız
   * `fields` üzerinde gezer, tanımadığı anahtarı kodlayıcıya hiç geçirmez.
   */
  const applyTemplate = useCallback((template: PacketTemplate) => {
    setValues({ ...template.values });
  }, []);

  // --- Bağlantı -----------------------------------------------------------

  const handlers = useMemo<ByteSourceHandlers>(
    () => ({
      onChunk: (chunk) => {
        // Kopya üzerinde geziliyor: dinleyici kendini `waitForResponse` içinde
        // aboneliğinden düşürüyor, canlı Set üzerinde gezmek turu bozardı.
        for (const listener of [...listenersRef.current]) {
          listener(chunk);
        }
      },
      onStatus: (status) => {
        setConnection((previous) => ({
          ...previous,
          status: toBuilderStatus(status),
          canWrite: status === 'connected' ? (sourceRef.current?.canWrite ?? false) : previous.canWrite,
        }));
      },
      onError: (error) => {
        setConnection((previous) => ({
          ...previous,
          status: 'error',
          errorKey: connectionErrorKey(error),
        }));
      },
    }),
    [],
  );

  const teardownSource = useCallback(async () => {
    const source = sourceRef.current;
    sourceRef.current = undefined;
    listenersRef.current.clear();
    if (source !== undefined) {
      await source.stop();
    }
  }, []);

  const connect = useCallback(
    async (kind: BuilderSourceKind, webSocketUrl?: string): Promise<void> => {
      scheduler.stop();
      await teardownSource();
      setConnection({ status: 'connecting', kind, canWrite: false, errorKey: null });
      setLastResponse(null);

      let source: ByteSource;
      try {
        if (kind === 'serial') {
          // `requestSerialPort` KULLANICI JESTİ içinden çağrılmalı (spec §41);
          // bu geri çağırım tıklama işleyicisinden senkron başlar.
          const port = await requestSerialPort();
          source = createSerialSource(port, DEFAULT_SERIAL_OPTIONS);
        } else if (kind === 'websocket') {
          source = createWebSocketSource(webSocketUrl ?? '');
        } else {
          source = createSimulatedSource();
        }
      } catch (cause) {
        setConnection({ status: 'error', kind, canWrite: false, errorKey: openErrorKey(cause) });
        return;
      }

      // Referans `start`tan ÖNCE yazılıyor: kaynak `onStatus('connected')`i
      // senkron yayabiliyor ve o an `canWrite` okunabilmeli.
      sourceRef.current = source;

      try {
        await source.start(handlers);
      } catch (cause) {
        sourceRef.current = undefined;
        setConnection({ status: 'error', kind, canWrite: false, errorKey: openErrorKey(cause) });
        return;
      }

      setConnection((previous) => {
        // `start` hata bildirdiyse (handlers.onError) durum zaten 'error';
        // üstüne "bağlandı" yazmak hatayı görünmez kılardı.
        if (previous.status === 'error') return previous;
        // WebSocket'te `start()` soketi AÇMAZ, açılışı BAŞLATIR: "bağlandı"yı
        // `onopen` yazar. Burada zorla yazmak, el sıkışma sürerken bağlanmış
        // gibi göstermek olurdu — seri portta böyle bir aralık yok.
        if (kind === 'websocket') {
          return { ...previous, kind, canWrite: source.canWrite };
        }
        return { status: 'connected', kind, canWrite: source.canWrite, errorKey: null };
      });
    },
    [handlers, scheduler, teardownSource],
  );

  const disconnect = useCallback(async (): Promise<void> => {
    scheduler.stop();
    await teardownSource();
    setConnection(INITIAL_CONNECTION);
  }, [scheduler, teardownSource]);

  // --- Gönderim -----------------------------------------------------------

  const subscribeResponse = useCallback((listener: (bytes: Uint8Array) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  /**
   * Tek gönderim. `index` 0 tabanlı tur numarasıdır ve sequence sayacını
   * ilerletir — sayaç React state'inden okunamaz, çünkü aynı turda yazılan
   * state bir sonraki render'a kadar görünmez ve peş peşe gönderimlerin hepsi
   * aynı sayaçla çıkardı.
   */
  const sendOnce = useCallback(
    async (index: number): Promise<void> => {
      const source = sourceRef.current;
      if (source === undefined || !source.canWrite) {
        throw new Error(CANNOT_WRITE_KEY);
      }

      const current = latestRef.current;
      let bytes: Uint8Array | null;

      if (current.hexOverride !== null) {
        bytes = parseHexOverride(current.hexOverride).bytes;
      } else if (current.schema === null) {
        bytes = null;
      } else {
        const options = resolveBuildOptions(current.postProcessing, current.framingEncoder);
        const pending = current.encoderPluginId !== null && current.valuesEncoder === null;
        if (options === null || pending) {
          // Motor inmeden gönderim: `NOTHING_TO_SEND_KEY` ile durur.
          throw new Error(NOTHING_TO_SEND_KEY);
        }
        const sequenceValues = nextSequenceValues(current.schema, {}, index);
        bytes = buildFromForm(
          current.schema,
          current.fields,
          current.values,
          options,
          current.valuesEncoder?.encode ?? null,
          sequenceValues,
        ).framedBytes;
        // Sayaç formda da görünsün; aksi hâlde gönderilen paketle ekrandaki
        // değer birbirini tutmaz.
        setValues((previous) => applySequenceText(previous, current.fields, sequenceValues));
      }

      if (bytes === null) {
        throw new Error(NOTHING_TO_SEND_KEY);
      }

      await source.write(bytes);

      // Yanıt gelmezse `null` — bu bir HATA DEĞİL, tek yönlü protokoller de var.
      const response = await waitForResponse(subscribeResponse, current.responseTimeoutMs);
      setLastResponse(response);
    },
    [subscribeResponse],
  );

  useEffect(() => {
    sendOnceRef.current = sendOnce;
  }, [sendOnce]);

  const send = useCallback(() => {
    const source = sourceRef.current;
    if (source === undefined || !source.canWrite) {
      setConnection((previous) => ({ ...previous, errorKey: CANNOT_WRITE_KEY }));
      return;
    }
    scheduler.start(schedulerConfig);
  }, [scheduler, schedulerConfig]);

  const stopSending = useCallback(() => {
    scheduler.stop();
  }, [scheduler]);

  // Spec §41: sayfadan çıkarken ne zamanlayıcı ne de port ayakta kalır.
  useEffect(() => {
    return () => {
      scheduler.stop();
      const source = sourceRef.current;
      sourceRef.current = undefined;
      listenersRef.current.clear();
      if (source !== undefined) {
        void source.stop();
      }
    };
  }, [scheduler]);

  return {
    schema,
    schemaErrorKey,
    fields,
    values,
    buildResult,
    hexOverride,
    postProcessing,
    framingPluginId,
    encoderPluginId,
    encoderErrorKey,
    outgoingBytes,
    connection,
    scheduler: schedulerState,
    schedulerConfig,
    responseTimeoutMs,
    lastResponse,
    setValue,
    stepValue,
    randomize,
    setHexOverride,
    setPostProcessing,
    setFramingPlugin,
    setEncoderPlugin,
    setSchedulerConfig,
    setResponseTimeoutMs,
    saveAsTemplate,
    applyTemplate,
    connect,
    disconnect,
    send,
    stopSending,
    reloadSchema,
  };
}

/** Sayaç alanlarının yeni değerini forma yazar; değişen yoksa aynı nesneyi döndürür. */
function applySequenceText(
  previous: Readonly<Record<string, string>>,
  fields: readonly BuilderFieldDescriptor[],
  sequenceValues: EncodeValues,
): Readonly<Record<string, string>> {
  let changed = false;
  const next = { ...previous };

  for (const field of fields) {
    const value = sequenceValues[field.path];
    if (value === undefined) {
      continue;
    }
    const text = toText(value);
    if (next[field.path] === text) {
      continue;
    }
    next[field.path] = text;
    changed = true;
  }

  return changed ? next : previous;
}

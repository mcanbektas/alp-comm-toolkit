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
import { DEFAULT_SERIAL_OPTIONS } from '@/connection/serial/serialOptions';
import { createSerialSource } from '@/connection/serial/serialSource';
import { requestSerialPort } from '@/connection/serial/webSerialTypes';
import type { ByteSource, ByteSourceHandlers, ConnectionError, ConnectionStatus } from '@/connection/types';
import { bytesToHex, hexToBytes } from '@/protocol-core/buffers/representation';
import type { EncodeFieldValue, EncodeValues } from '@/protocol-core/encoding/schemaEncoder';
import { fieldTypeInfo } from '@/protocol-core/schemas/fieldTypes';
import { parseProtocolSchemaJson } from '@/protocol-core/schemas/protocolSchema';
import type { ProtocolSchema } from '@/protocol-core/schemas/protocolSchema';

import type { BuilderConnectionState, BuilderSourceKind, PacketBuilderApi } from './builderTypes';
import {
  buildPacket,
  describeBuilderFields,
  nextSequenceValues,
  randomizeValues,
  stepFieldValue,
} from './packetPipeline';
import type {
  BuilderFieldDescriptor,
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
const INVALID_VALUE_KEY = 'builder.issue.invalidValue';

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

const SAFE_INTEGER_LIMIT = BigInt(Number.MAX_SAFE_INTEGER);

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

// --- Metin ↔ değer dönüşümü ------------------------------------------------

/** Sayısal olmayan (kapsayıcı) alanların formda karşılığı yoktur. */
function isFormField(field: BuilderFieldDescriptor): boolean {
  if (field.derived) {
    return false;
  }
  const kind = fieldTypeInfo(field.type).kind;
  return kind !== 'composite' && kind !== 'derived';
}

function clampToBounds(value: number, minimum: number | null, maximum: number | null): number {
  if (minimum !== null && value < minimum) return minimum;
  if (maximum !== null && value > maximum) return maximum;
  return value;
}

/**
 * Form açılış değerleri. Boş bırakmak yerine anlamlı bir başlangıç yazılıyor:
 * boş formda `buildPacket` de çalışır ama kullanıcı "neden hiçbir şey
 * göremiyorum" sorusuyla karşılaşır. Enum ilk anahtarına, boolean kapalıya,
 * sayısal alan sınır içindeki 0'a düşer.
 */
function initialValues(fields: readonly BuilderFieldDescriptor[]): Record<string, string> {
  const values: Record<string, string> = {};

  for (const field of fields) {
    if (!isFormField(field)) {
      continue;
    }
    const kind = fieldTypeInfo(field.type).kind;

    if (kind === 'enum') {
      const firstKey = field.enumValues === null ? undefined : [...field.enumValues.keys()][0];
      values[field.path] = firstKey ?? '0';
      continue;
    }
    if (kind === 'boolean') {
      values[field.path] = 'false';
      continue;
    }
    if (kind === 'text' || kind === 'bytes') {
      values[field.path] = '';
      continue;
    }
    values[field.path] = String(clampToBounds(0, field.minimum, field.maximum));
  }

  return values;
}

/** Motorun döndürdüğü değeri forma yazılabilir metne çevirir. */
function toText(value: EncodeFieldValue | undefined): string {
  if (value === undefined) return '';
  if (value instanceof Uint8Array) return bytesToHex(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

/**
 * Sayısal metni değere çevirir; çevrilemiyorsa `undefined`.
 *
 * 2^53 üstü tamsayılar `bigint` olarak geçirilir (spec §47) — `Number`a
 * çevrilseydi uint64 bir alanda değer SESSİZCE yuvarlanırdı. Ölçekli alanlar
 * bunun dışında: `schemaEncoder` ölçeği yalnız `number` değerlere uygular,
 * `bigint` geçirmek kalibrasyonu atlardı.
 */
function toNumericValue(field: BuilderFieldDescriptor, text: string): number | bigint | undefined {
  const trimmed = text.trim();
  const unscaled = field.scale === null && field.calibrationOffset === null;

  if (unscaled && /^-?\d+$/.test(trimmed)) {
    const wide = BigInt(trimmed);
    if (wide > SAFE_INTEGER_LIMIT || wide < -SAFE_INTEGER_LIMIT) {
      return wide;
    }
  }

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : undefined;
}

interface ConversionResult {
  readonly encodeValues: EncodeValues;
  readonly issues: readonly PacketIssue[];
}

/**
 * Metin formu `EncodeValues`a çevirir. Çevrilemeyen alan kodlayıcıya HİÇ
 * geçirilmez ve yerine bir sorun üretilir: bozuk metni geçirmek kodlayıcının
 * kendi hata mesajını (yerelleştirilemez, ham) ekrana taşırdı.
 */
function toEncodeValues(
  fields: readonly BuilderFieldDescriptor[],
  values: Readonly<Record<string, string>>,
): ConversionResult {
  const encodeValues: Record<string, EncodeFieldValue> = {};
  const issues: PacketIssue[] = [];

  for (const field of fields) {
    if (!isFormField(field)) {
      continue;
    }
    const text = values[field.path];
    if (text === undefined) {
      continue;
    }
    const kind = fieldTypeInfo(field.type).kind;

    if (kind === 'boolean') {
      encodeValues[field.path] = text === 'true';
      continue;
    }

    if (kind === 'text') {
      encodeValues[field.path] = text;
      continue;
    }

    if (kind === 'bytes') {
      try {
        encodeValues[field.path] = hexToBytes(text);
      } catch {
        // `hexToBytes` tek hane / alfabe dışı karakterde fırlatır; sınır katmanı burası.
        issues.push({ fieldId: field.path, messageKey: INVALID_HEX_KEY });
      }
      continue;
    }

    if (kind === 'enum') {
      // Form enum ANAHTARINI tutar; kullanıcı etiket yazdıysa kodlayıcı çözer
      // ve bilinmeyen etiket için kendi sorununu üretir.
      const numeric = Number(text);
      encodeValues[field.path] = text.trim() !== '' && Number.isFinite(numeric) ? numeric : text;
      continue;
    }

    // integer | float | bits | timestamp
    if (text.trim() === '') {
      // Boş alan bir HATA değil: kodlayıcı 0 yazar. Sorun üretmek, kullanıcı
      // alanı silip yeniden yazarken her tuşta kırmızı uyarı demek olurdu.
      continue;
    }
    const numeric = toNumericValue(field, text);
    if (numeric === undefined) {
      issues.push({ fieldId: field.path, messageKey: INVALID_VALUE_KEY, params: { detail: text } });
      continue;
    }
    encodeValues[field.path] = numeric;
  }

  return { encodeValues, issues };
}

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
  postProcessing: PostProcessing,
  extraValues?: EncodeValues,
): PacketBuildResult {
  const { encodeValues, issues } = toEncodeValues(fields, values);
  const merged = extraValues === undefined ? encodeValues : { ...encodeValues, ...extraValues };
  const result = buildPacket(schema, merged, { postProcessing });

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
  /** `reloadSchema` tetiği: metin aynı kalsa bile şemayı yeniden çözmeyi zorlar. */
  const [reloadToken, setReloadToken] = useState(0);

  const parsed = useMemo(
    () => parseProtocolSchemaJson(schemaJson),
    // `reloadToken` bilerek bağımlılık: kullanıcı "yeniden yükle" dediğinde
    // metin değişmemiş olsa da form varsayılanlarına dönmeli.
    [schemaJson, reloadToken],
  );

  const schema = parsed.success ? parsed.schema : null;
  const schemaErrorKey = parsed.success ? null : INVALID_SCHEMA_KEY;

  const fields = useMemo(
    () => (schema === null ? EMPTY_FIELDS : describeBuilderFields(schema)),
    [schema],
  );

  const [values, setValues] = useState<Readonly<Record<string, string>>>({});
  const [hexOverride, setHexOverrideState] = useState<string | null>(null);
  const [postProcessing, setPostProcessingState] = useState<PostProcessing>('none');
  const [connection, setConnection] = useState<BuilderConnectionState>(INITIAL_CONNECTION);
  const [schedulerState, setSchedulerState] = useState<SendSchedulerState>(INITIAL_SCHEDULER_STATE);
  const [schedulerConfig, setSchedulerConfigState] = useState<SendSchedulerConfig>(INITIAL_SCHEDULER_CONFIG);
  const [responseTimeoutMs, setResponseTimeoutMsState] = useState(SCHEDULER_LIMITS.defaultResponseTimeoutMs);
  const [lastResponse, setLastResponse] = useState<Uint8Array | null>(null);

  // Şema değişince form baştan kurulur: eski protokolün alan yolları yeni
  // şemada olmayabilir ve orada kalan değerler hiçbir zaman görünmeden
  // kodlayıcıya geçmeye devam ederdi.
  useEffect(() => {
    setValues(initialValues(fields));
  }, [fields]);

  const sourceRef = useRef<ByteSource | undefined>(undefined);
  /** Gelen bayt paketlerini bekleyenler — `waitForResponse` buraya abone olur. */
  const listenersRef = useRef<Set<(bytes: Uint8Array) => void>>(new Set());

  /**
   * Zamanlayıcının geri çağırımı render'lar arasında SABİT kalmalı (nesil
   * sayacı yeniden kurulan bir scheduler'ı kurtaramaz), ama gönderim anında
   * EN SON değerleri okumalı. İkisini bağdaştıran tek yol: değişenleri ref'te
   * tutmak, geri çağırımı ref üzerinden çağırmak.
   */
  const latestRef = useRef({ schema, fields, values, hexOverride, postProcessing, responseTimeoutMs });
  useEffect(() => {
    latestRef.current = { schema, fields, values, hexOverride, postProcessing, responseTimeoutMs };
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
    const formResult = schema === null ? null : buildFromForm(schema, fields, values, postProcessing);

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
  }, [schema, fields, values, postProcessing, hexOverride]);

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

  const setPostProcessing = useCallback((mode: PostProcessing) => {
    setPostProcessingState(mode);
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
    async (kind: BuilderSourceKind): Promise<void> => {
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

      setConnection((previous) =>
        // `start` hata bildirdiyse (handlers.onError) durum zaten 'error';
        // üstüne "bağlandı" yazmak hatayı görünmez kılardı.
        previous.status === 'error'
          ? previous
          : { status: 'connected', kind, canWrite: source.canWrite, errorKey: null },
      );
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
        const sequenceValues = nextSequenceValues(current.schema, {}, index);
        bytes = buildFromForm(
          current.schema,
          current.fields,
          current.values,
          current.postProcessing,
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
    setSchedulerConfig,
    setResponseTimeoutMs,
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

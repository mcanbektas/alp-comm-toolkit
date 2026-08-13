/**
 * 9 durumlu akış ayrıştırıcı — spec §8.4 satır 246-264. Bir `FrameExtractor`ı
 * (`../framing/`) SARAR: parça parça gelen baytları biriktirir, her yeni
 * parçada (ya da zaman-tabanlı yöntemler için `tick()` ile) extractor'ı
 * çağırır, `consumedBytes`e göre arabelleği ilerletir ve tam çerçeveleri
 * `../types.ts`teki `RawFrame` biçiminde yayınlar.
 *
 * `createProtocolRegistry()`teki (`../registry.ts`) desenle AYNI: kapatma
 * (closure) yakalayan bir fabrika fonksiyonu, `class` DEĞİL — bu kod
 * tabanında (bkz. araştırma notu) durumlu bir `class` hiç kullanılmamış.
 *
 * `../types.ts`teki `ProtocolParser.parse()`nin SAF kalma zorunluluğunun
 * (aynı girdi aynı sonuç, iç durum biriktirmez) tam simetriği: yarım çerçeve
 * durumu SADECE burada yaşar, `FrameExtractor.extract()` kendisi durum
 * TUTMAZ — her çağrıda arabelleğin GÜNCEL halini baştan alır.
 */

import { createRawFrame } from '../types';
import type { FrameDirection, RawFrame } from '../types';
import type { FrameExtractor, FramingError, FramingPhase } from '../framing/types';
import type { StreamBufferState } from './types';

export interface StreamBufferOptions {
  readonly maxFrameLength: number;
  readonly direction?: FrameDirection;
  readonly channel?: string;
}

export type Unsubscribe = () => void;

export interface StreamBuffer {
  readonly state: StreamBufferState;
  /** Arabellekte biriken, henüz bir çerçeveye dönüşmemiş bayt sayısı — gözlemlenebilirlik/tanı içindir. */
  readonly pendingByteLength: number;
  /**
   * `receivedAt` verilmezse `performance.now()` okunur. Zaman tabanlı
   * yöntemlerin (`tick()`) doğru çalışması için, verilirse, ÇAĞIRANIN
   * `tick(nowMs)`e verdiği değerle AYNI zaman tabanında (yani `performance.now()`
   * kaynaklı) olması gerekir — `Date.now()` NTP düzeltmesiyle geriye
   * sıçrayabilir ve negatif/tutarsız `elapsed` üretir (bkz. `../types.ts`
   * `createRawFrame` üstündeki aynı gerekçe).
   */
  push(chunk: Uint8Array, receivedAt?: number): void;
  /**
   * Zaman tabanlı yöntemler (`inter-character-timeout`, `inter-frame-timeout`,
   * `modbus-silent-interval`) YENİ VERİ olmadan da tetiklenmelidir — çağıran
   * (worker'daki bir zamanlayıcı ya da UI) bunu periyodik çağırır. Veri hiç
   * gelmediyse (`push` hiç çağrılmadıysa) no-op'tur. `nowMs` de `performance.now()`
   * tabanlı olmalı — bkz. `push` üstündeki not.
   */
  tick(nowMs: number): void;
  onFrame(listener: (frame: RawFrame) => void): Unsubscribe;
  onError(listener: (error: FramingError, recoverable: boolean) => void): Unsubscribe;
  onStateChange(listener: (state: StreamBufferState) => void): Unsubscribe;
  reset(): void;
}

/** Savunma amaçlı üst sınır — İYİ davranan her extractor kendi `maxFrameLength` kontrolünü çok daha önce tetikler; bu yalnız gelecekteki/üçüncü taraf bir extractor'ın bunu atlaması ihtimaline karşı (spec §41 "Sonsuz loop engelle"). */
const OVERFLOW_SAFETY_MULTIPLIER = 2;

function phaseToState(phase: FramingPhase): StreamBufferState {
  switch (phase) {
    case 'header':
      return 'READING_HEADER';
    case 'length':
      return 'READING_LENGTH';
    case 'payload':
      return 'READING_PAYLOAD';
    case 'trailer':
      return 'READING_TRAILER';
  }
}

export function createStreamBuffer(extractor: FrameExtractor, options: StreamBufferOptions): StreamBuffer {
  let buffer = new Uint8Array(0);
  let state: StreamBufferState = 'SEARCHING_FOR_FRAME';
  let lastActivityAt: number | undefined;

  const frameListeners = new Set<(frame: RawFrame) => void>();
  const errorListeners = new Set<(error: FramingError, recoverable: boolean) => void>();
  const stateListeners = new Set<(state: StreamBufferState) => void>();

  function setState(next: StreamBufferState): void {
    if (state === next) return;
    state = next;
    for (const listener of stateListeners) listener(state);
  }

  function emitFrame(bytes: Uint8Array): void {
    const init: Parameters<typeof createRawFrame>[1] = {};
    if (options.direction !== undefined) init.direction = options.direction;
    if (options.channel !== undefined) init.channel = options.channel;
    const frame = createRawFrame(bytes, init);
    for (const listener of frameListeners) listener(frame);
  }

  function emitError(error: FramingError, recoverable: boolean): void {
    for (const listener of errorListeners) listener(error, recoverable);
  }

  /**
   * Arabellekte çıkarılabilecek KAÇ çerçeve varsa hepsini işler — tek `push()`
   * birden fazla tam çerçeve taşıyabilir (spec'in kendi kanonik örneğinde bir
   * chunk önceki çerçevenin sonunu VE yeni bir çerçevenin başını birlikte
   * taşıyabiliyordu). Döngü, her adımda arabelleğin KESİNLİKLE küçüldüğü ya da
   * dönüşün `incomplete` olduğu garantisiyle sonlanır — asla sonsuz dönmez.
   */
  function pump(elapsedSinceLastByteMs: number | undefined): void {
    let elapsed = elapsedSinceLastByteMs;

    for (;;) {
      if (buffer.length === 0) {
        setState('SEARCHING_FOR_FRAME');
        return;
      }

      if (buffer.length > options.maxFrameLength * OVERFLOW_SAFETY_MULTIPLIER) {
        const error: FramingError = {
          code: 'buffer-overflow',
          offset: 0,
          message: `Arabellek ${buffer.length} bayta ulaştı (savunma sınırı ${options.maxFrameLength * OVERFLOW_SAFETY_MULTIPLIER}) — extractor kendi sınırını uygulamadı, arabellek temizlendi`,
        };
        setState('FRAME_ERROR');
        emitError(error, false);
        buffer = new Uint8Array(0);
        setState('SEARCHING_FOR_FRAME');
        return;
      }

      const result = extractor.extract(buffer, { maxFrameLength: options.maxFrameLength, elapsedSinceLastByteMs: elapsed });

      if (result.status === 'incomplete') {
        setState(phaseToState(result.phase));
        return;
      }

      setState('VALIDATING_FRAME');

      if (result.status === 'complete') {
        setState('FRAME_COMPLETE');
        const frameBytes = result.frame;
        buffer = buffer.subarray(result.consumedBytes);
        emitFrame(frameBytes);
        setState('SEARCHING_FOR_FRAME');
      } else {
        setState('FRAME_ERROR');
        emitError(result.error, result.recoverable);
        setState('RECOVERING');
        // İlerleme garantisi: `consumedBytes` 0 dönerse (extractor sözleşmeyi
        // ihlal etse bile) en az 1 bayt atlanır — aksi hâlde aynı bozuk bayt
        // sonsuza dek yeniden denenir.
        buffer = buffer.subarray(Math.max(result.consumedBytes, 1));
      }

      // Bu adımdan sonraki tur "yeni veri" gibi ele alınır: zaman-tabanlı
      // yöntemlerin ürettiği tam/hata sonuçları her koşulda arabelleği
      // TAMAMEN tüketir (frame=buffer.slice()), yani döngü zaten `buffer.length
      // === 0` dalına düşüp bir üst satırda döner — `elapsed`in burada ne
      // olduğu bu yüzden sonraki turu etkilemez.
      elapsed = undefined;
    }
  }

  return {
    get state() {
      return state;
    },
    get pendingByteLength() {
      return buffer.length;
    },
    push(chunk: Uint8Array, receivedAt?: number): void {
      const merged = new Uint8Array(buffer.length + chunk.length);
      merged.set(buffer, 0);
      merged.set(chunk, buffer.length);
      buffer = merged;
      lastActivityAt = receivedAt ?? performance.now();
      pump(undefined);
    },
    tick(nowMs: number): void {
      if (lastActivityAt === undefined) return;
      pump(Math.max(nowMs - lastActivityAt, 0));
    },
    onFrame(listener: (frame: RawFrame) => void): Unsubscribe {
      frameListeners.add(listener);
      return () => frameListeners.delete(listener);
    },
    onError(listener: (error: FramingError, recoverable: boolean) => void): Unsubscribe {
      errorListeners.add(listener);
      return () => errorListeners.delete(listener);
    },
    onStateChange(listener: (state: StreamBufferState) => void): Unsubscribe {
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    },
    reset(): void {
      buffer = new Uint8Array(0);
      lastActivityAt = undefined;
      setState('SEARCHING_FOR_FRAME');
    },
  };
}

/**
 * 9 durumlu akış ayrıştırıcı — spec §8.4 satır 260. `../framing/types.ts`teki
 * `FramingPhase` (4 değer: header/length/payload/trailer) bu makinenin
 * "veri bekliyorum" alt-durumlarına eşlenir; `SEARCHING_FOR_FRAME`,
 * `VALIDATING_FRAME`, `FRAME_COMPLETE`, `FRAME_ERROR`, `RECOVERING` ise
 * `streamBuffer.ts`nin KENDİ ürettiği, extractor'dan bağımsız durumlardır.
 */
export const STREAM_BUFFER_STATES = [
  'SEARCHING_FOR_FRAME',
  'READING_HEADER',
  'READING_LENGTH',
  'READING_PAYLOAD',
  'READING_TRAILER',
  'VALIDATING_FRAME',
  'FRAME_COMPLETE',
  'FRAME_ERROR',
  'RECOVERING',
] as const;

export type StreamBufferState = (typeof STREAM_BUFFER_STATES)[number];

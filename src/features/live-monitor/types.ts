/**
 * Live Serial Monitor'ün veri tipleri — spec §8.
 *
 * Kayıtlar tek bir halka arabellekte KARIŞIK tutulur (çerçeve + hata). Ayrı
 * listeler tutulsaydı ekranda zaman sırası kurmak için her turda birleştirme
 * gerekirdi; tek listede sıra zaten doğaldır ve "hata tam olarak hangi iki
 * çerçevenin arasında oldu" bilgisi korunur — sebep-sonuç izlemenin temeli.
 */

import type { FramingErrorCode } from '../../protocol-core/framing/types';
import type { FrameValidity } from '../../protocol-core/statistics/commStatistics';
import type { FrameDirection } from '../../protocol-core/types';

/** Spec §8.2'nin ham bayt görüntüleme kipleri. */
export const DISPLAY_MODES = ['hex', 'ascii', 'utf8', 'decimal', 'binary', 'mixed'] as const;
export type DisplayMode = (typeof DISPLAY_MODES)[number];

/** Spec §8.1 "Timestamp resolution". */
export const TIMESTAMP_RESOLUTIONS = ['ms', 'us'] as const;
export type TimestampResolution = (typeof TIMESTAMP_RESOLUTIONS)[number];

export interface MonitorFrameRecord {
  readonly kind: 'frame';
  /** Oturum başından beri mutlak sıra — halka arabellek eski kaydı düşürse de değişmez. */
  readonly index: number;
  /** Epoch milisaniyesi (`performance.timeOrigin + performance.now()`) — bkz. `connection/types.ts`. */
  readonly timestamp: number;
  readonly direction: FrameDirection;
  readonly bytes: Uint8Array;
  readonly validity: FrameValidity;
  /** Yapılandırılmış sinyal musluklarıyla aynı sırada okunan fiziksel değerler. */
  readonly signals: readonly (number | undefined)[];
}

export interface MonitorErrorRecord {
  readonly kind: 'error';
  readonly index: number;
  readonly timestamp: number;
  readonly code: FramingErrorCode;
  readonly message: string;
  readonly recoverable: boolean;
}

export type MonitorRecord = MonitorFrameRecord | MonitorErrorRecord;

export function isFrameRecord(record: MonitorRecord): record is MonitorFrameRecord {
  return record.kind === 'frame';
}

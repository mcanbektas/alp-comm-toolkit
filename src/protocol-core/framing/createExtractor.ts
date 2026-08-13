/**
 * Spec §8.4'ün 15 yöntemini TEK, serileştirilebilir bir yapılandırma nesnesinden
 * somut bir `FrameExtractor`a çevirir — `../streams/`teki Worker köprüsü VE
 * ileride (Faz 7/8) bir "çerçeveleme yöntemi seç" ekranı bu tek girişi kullanır,
 * her ekranın hangi alt-modülü çağıracağını bilmesi gerekmez.
 *
 * `bit-stuffing` bu union'da BİLEREK YOK: `bitStuffing.ts`nin kendi başlık
 * yorumunda açıklandığı gibi bir `FrameExtractor` üretmiyor (bit-hizasız akış,
 * bu sözleşmenin bayt-arabellek varsayımına uymuyor).
 */

import type { EscapeRule } from './escaping';
import { createEscapedDelimiterExtractor } from './escapedDelimiterFraming';
import { createBoundedDelimiterExtractor, createStartMarkerExtractor } from './delimiterFraming';
import { createFixedLengthExtractor } from './fixedLengthFraming';
import { createLengthFieldExtractor } from './lengthFieldFraming';
import { createTimeoutExtractor } from './timeoutFraming';
import { cobsExtractor } from './cobs';
import { slipExtractor } from './slip';
import { hdlcFlagExtractor } from './hdlcFraming';
import type { FrameExtractor } from './types';

export type FramingMethodConfig =
  | ({ readonly method: 'fixed-length' } & { readonly frameLength: number; readonly startByte?: number })
  | { readonly method: 'start-byte' | 'multiple-start-bytes'; readonly startSequence: readonly number[] }
  | {
      readonly method: 'start-end-delimiter';
      readonly startSequence?: readonly number[];
      readonly endSequence: readonly number[];
      readonly includeDelimitersInFrame?: boolean;
    }
  | { readonly method: 'line-ending'; readonly endSequence: readonly number[] }
  | ({ readonly method: 'length-field' } & {
      readonly startByte?: number;
      readonly headerBytesBeforeLength: number;
      readonly lengthFieldWidth: 1 | 2 | 3 | 4;
      readonly lengthFieldEndianness: 'big' | 'little';
      readonly trailerLength: number;
    })
  | {
      readonly method: 'inter-character-timeout' | 'inter-frame-timeout' | 'modbus-silent-interval';
      readonly timeoutMs: number;
    }
  | { readonly method: 'escape-based' | 'byte-stuffing'; readonly delimiterByte: number; readonly rule: EscapeRule }
  | { readonly method: 'slip' }
  | { readonly method: 'hdlc-flag' }
  | { readonly method: 'cobs' };

export function createExtractorFromConfig(config: FramingMethodConfig): FrameExtractor {
  switch (config.method) {
    case 'fixed-length':
      return createFixedLengthExtractor(config);
    case 'start-byte':
    case 'multiple-start-bytes':
      return createStartMarkerExtractor(config);
    case 'start-end-delimiter':
      return createBoundedDelimiterExtractor(config);
    case 'line-ending':
      return createBoundedDelimiterExtractor({ method: 'line-ending', endSequence: config.endSequence });
    case 'length-field':
      return createLengthFieldExtractor(config);
    case 'inter-character-timeout':
    case 'inter-frame-timeout':
    case 'modbus-silent-interval':
      return createTimeoutExtractor(config);
    case 'escape-based':
    case 'byte-stuffing':
      return createEscapedDelimiterExtractor({ method: config.method, delimiterByte: config.delimiterByte, rule: config.rule });
    case 'slip':
      return slipExtractor;
    case 'hdlc-flag':
      return hdlcFlagExtractor;
    case 'cobs':
      return cobsExtractor;
  }
}

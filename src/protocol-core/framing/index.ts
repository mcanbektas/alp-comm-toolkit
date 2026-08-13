/**
 * Spec §8.4'ün 15 çerçeveleme yöntemi 7 uygulama modülüne damıtılır — her
 * yöntem kendi `FramingMethodId`siyle ayrı listelenir (`types.ts`), ama
 * mekanik olarak AYNI olan yöntemler kod tekrarı yerine tek motoru
 * parametreyle paylaşır:
 *
 * | Yöntem                     | Modül                          |
 * |-----------------------------|--------------------------------|
 * | fixed-length                 | `fixedLengthFraming.ts`        |
 * | start-byte                   | `delimiterFraming.ts` (start-marker) |
 * | multiple-start-bytes         | `delimiterFraming.ts` (start-marker) |
 * | start-end-delimiter          | `delimiterFraming.ts` (bounded)  |
 * | line-ending                  | `delimiterFraming.ts` (bounded, başlangıçsız) |
 * | length-field                 | `lengthFieldFraming.ts`        |
 * | inter-character-timeout      | `timeoutFraming.ts`            |
 * | inter-frame-timeout          | `timeoutFraming.ts`            |
 * | modbus-silent-interval       | `timeoutFraming.ts`            |
 * | escape-based                 | `escapedDelimiterFraming.ts` (kullanıcı tanımlı `EscapeRule`) |
 * | byte-stuffing                | `escapedDelimiterFraming.ts` — spec'te ayrı isim, MEKANİK olarak escape-based'in kendisi |
 * | slip                         | `slip.ts` (`escapedDelimiterFraming` sabit parametreli) |
 * | hdlc-flag                    | `hdlcFraming.ts` (`escapedDelimiterFraming` sabit parametreli, async/PPP-stili) |
 * | cobs                         | `cobs.ts`                      |
 * | bit-stuffing                 | `bitStuffing.ts` — bilerek `FrameExtractor` DEĞİL, bkz. dosya başı yorumu |
 *
 * `bit-stuffing` bu yüzden aşağıda barelli DEĞİL diğerleriyle aynı şekilde:
 * `stuffBits`/`destuffBits` doğrudan `bitStuffing.ts`ten alınır, bir
 * `FrameExtractor` üretmez (gerekçe: dosyanın kendi başlık yorumu).
 */

export * from './types';
export * from './createExtractor';
export * from './escaping';
export * from './escapedDelimiterFraming';
export * from './delimiterFraming';
export * from './lengthFieldFraming';
export * from './fixedLengthFraming';
export * from './timeoutFraming';
export * from './cobs';
export * from './slip';
export * from './hdlcFraming';
export * from './bitStuffing';

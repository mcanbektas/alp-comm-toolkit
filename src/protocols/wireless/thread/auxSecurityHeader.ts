/**
 * IEEE 802.15.4 **Auxiliary Security Header** — Thread'e özel, ÇEKİRDEĞE
 * TAŞINMADI (Faz 10, dalga 18d, `[KARAR 18-1]`).
 *
 * `protocol-core/framing/ieee802154Frame.ts` yalnız KONTEYNERİ çözer ve
 * güvenlik başlığının **VARLIĞINI** bildirir (`securityEnabled`). Baytlarını
 * okumak protokole özeldir: `zigbee` MAC katmanında güvenlik kullanmaz ve bu
 * başlığı hiç ayrıştırmadı; Thread hem MAC katmanında hem MLE mesajının
 * içinde kullanır. Emsal `pulseLog.ts:6-30` — *"yalnız KONTEYNERİN KENDİSİ
 * taşındı; türetme protokole özeldir ve TAŞINMADI."*
 *
 * İKİ yerde görünür ve bu modül İKİSİNE de hizmet eder (bu yüzden `id`/`name`
 * ön eki parametre):
 *   1. **MAC** — `Security Enabled = 1` ise adresleme alanlarının hemen
 *      ardından `[KANIT]` Wireshark `packet-ieee802154.c:3011`:
 *      *"Existence of the Auxiliary Security Header is controlled by the
 *      Security Enabled Field"*.
 *   2. **MLE** — Security Suite `0` ise Security Suite baytının hemen ardından
 *      `[KANIT]` OpenThread `mle.cpp:3575`
 *      (`if (securitySuite == k154Security) { SecurityHeader …; }`).
 *
 * ── ALAN DÜZENİ (IEEE 802.15.4 §7.4.1) ────────────────────────────────────
 * | Security Control | 1 B  | bit 0-2 Security Level · bit 3-4 Key Id Mode ·
 * |                  |      | bit 5 Frame Counter Suppression · bit 6 ASN in Nonce
 * | Frame Counter    | 4 B  | LE; Suppression = 1 ise YOK
 * | Key Identifier   | 0/1/5/9 B | Mode 0 ⇒ 0 · 1 ⇒ 1 · 2 ⇒ 4+1 · 3 ⇒ 8+1
 *
 * ── 🚨 TUZAK — MIC ÇERÇEVENİN SONUNDA, FCS'TEN ÖNCE ───────────────────────
 * MIC uzunluğu Security Level'dan gelir (0→0 · 1→4 · 2→8 · 3→16 · 4→0 ·
 * 5→4 · 6→8 · 7→16) ve MIC yükün İÇİNDE değil, çerçevenin SONUNDA, FCS'ten
 * ÖNCE durur. Yük uzunluğu hesaplanırken MIC çıkarılmazsa şifreli yük 4-16
 * bayt UZUN görünür ve zincir HATA VERMEDEN yanlış yerden okur.
 *
 * ── MIC PASS/FAIL BASILMAZ ────────────────────────────────────────────────
 * MIC AES-CCM* ile ağ anahtarından üretilir; anahtar telde YOKTUR ve bu
 * dalgada şifre çözme YOK. MIC bir ALAN olarak basılır (ofseti ve uzunluğu
 * gerçek bir ölçümdür) ama **PASS/FAIL BASILMAZ** — dalga 13 dersi 3
 * (*"gösterilir ≠ doğrulanır"*) ve `mode-s`in AP alanı emsali. Doğrulanamayan
 * bir şeye "doğrulanamadı" damgası basmak bile olmayan bir ölçümü varmış gibi
 * gösterir.
 */

import type { ParsedField, ProtocolError, ProtocolWarning } from '@/protocol-core/types';

export const SECURITY_CONTROL_LENGTH = 1;
export const FRAME_COUNTER_LENGTH = 4;

const SECURITY_LEVEL_MASK = 0x07;
const KEY_ID_MODE_SHIFT = 3;
const KEY_ID_MODE_MASK = 0x03;
const FRAME_COUNTER_SUPPRESSION_SHIFT = 5;
const ASN_IN_NONCE_SHIFT = 6;

/** §7.4.1.1 Table 9-6 — adlar VERİDİR, çeviriye girmez (CLAUDE.md). */
export const SECURITY_LEVEL_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'None'],
  [1, 'MIC-32'],
  [2, 'MIC-64'],
  [3, 'MIC-128'],
  [4, 'ENC'],
  [5, 'ENC-MIC-32'],
  [6, 'ENC-MIC-64'],
  [7, 'ENC-MIC-128'],
]);

/** §7.4.1.2 Table 9-7 — adlar VERİDİR. */
export const KEY_ID_MODE_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'Implicit'],
  [1, 'Key Index'],
  [2, 'Key Source (4 octets) + Key Index'],
  [3, 'Key Source (8 octets) + Key Index'],
]);

/** Security Level → MIC uzunluğu (bayt). Level 0 ve 4'te MIC YOKTUR. */
export function micLengthForSecurityLevel(level: number): number {
  switch (level & SECURITY_LEVEL_MASK) {
    case 1:
    case 5:
      return 4;
    case 2:
    case 6:
      return 8;
    case 3:
    case 7:
      return 16;
    default:
      return 0;
  }
}

/** Level ≥ 4 ⇒ yük ŞİFRELİ. Level 1-3 yalnız bütünlük (yük AÇIK). */
export function isEncryptedSecurityLevel(level: number): boolean {
  return (level & SECURITY_LEVEL_MASK) >= 4;
}

/** Key Identifier alanının bayt uzunluğu — Mode 0/1/2/3 ⇒ 0/1/5/9. */
export function keyIdentifierLength(mode: number): number {
  switch (mode & KEY_ID_MODE_MASK) {
    case 1:
      return 1;
    case 2:
      return 5;
    case 3:
      return 9;
    default:
      return 0;
  }
}

export interface AuxSecurityHeaderMessages {
  /** Başlık çerçeveye sığmıyor — `truncated-frame`. */
  readonly truncated: string;
  /** MIC anahtarsız doğrulanamaz — bilgilendirme uyarısı. */
  readonly micNotVerifiable: string;
}

export interface AuxSecurityHeader {
  readonly start: number;
  /** Security Control + Frame Counter + Key Identifier toplamı. */
  readonly length: number;
  readonly securityLevel: number;
  readonly keyIdMode: number;
  readonly frameCounterSuppressed: boolean;
  readonly asnInNonce: boolean;
  readonly frameCounter: number | undefined;
  readonly keyIndex: number | undefined;
  readonly micLength: number;
  readonly encrypted: boolean;
  /** Çerçeve başlığı taşıyamadı; ÜST ZİNCİRE GİRİLMEZ. */
  readonly truncated: boolean;
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function toHex(value: number, byteWidth: number): string {
  return `0x${value.toString(16).padStart(byteWidth * 2, '0').toUpperCase()}`;
}

function readUint32Le(data: Uint8Array, offset: number): number {
  return (
    (byteAt(data, offset) |
      (byteAt(data, offset + 1) << 8) |
      (byteAt(data, offset + 2) << 16) |
      (byteAt(data, offset + 3) << 24)) >>>
    0
  );
}

/**
 * Auxiliary Security Header'ı `start`tan itibaren çözer ve alanlarını basar.
 *
 * `limit` = okunabilir bölgenin MUTLAK sonu (MAC'te FCS ofseti, MLE'de UDP
 * yükünün sonu). `securityLevelOverride` `undefined` değilse Security
 * Control'ün seviyesi YERİNE o kullanılır — `securityLevelOverride` kanalı
 * (Frame Counter Suppression / ASN bitleri okumayı belirsizleştirebiliyor ve
 * seviye MIC uzunluğunu, yani yükün NEREDE bittiğini belirliyor).
 */
export function decodeAuxSecurityHeader(
  data: Uint8Array,
  start: number,
  limit: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  messages: AuxSecurityHeaderMessages,
  idPrefix: string,
  namePrefix: string,
  securityLevelOverride?: number,
): AuxSecurityHeader {
  const truncatedResult = (length: number): AuxSecurityHeader => {
    errors.push({
      code: 'truncated-frame',
      message: messages.truncated,
      offset: start,
      length: Math.max(0, limit - start),
    });
    return {
      start,
      length,
      securityLevel: 0,
      keyIdMode: 0,
      frameCounterSuppressed: false,
      asnInNonce: false,
      frameCounter: undefined,
      keyIndex: undefined,
      micLength: 0,
      encrypted: false,
      truncated: true,
    };
  };

  if (start + SECURITY_CONTROL_LENGTH > limit) return truncatedResult(0);

  const control = byteAt(data, start);
  const wireLevel = control & SECURITY_LEVEL_MASK;
  const securityLevel = securityLevelOverride ?? wireLevel;
  const keyIdMode = (control >> KEY_ID_MODE_SHIFT) & KEY_ID_MODE_MASK;
  const frameCounterSuppressed = ((control >> FRAME_COUNTER_SUPPRESSION_SHIFT) & 1) === 1;
  const asnInNonce = ((control >> ASN_IN_NONCE_SHIFT) & 1) === 1;

  fields.push({
    id: `${idPrefix}-control`,
    name: `${namePrefix} · Security Control`,
    offset: start,
    length: SECURITY_CONTROL_LENGTH,
    rawBytes: data.slice(start, start + SECURITY_CONTROL_LENGTH),
    rawValue: toHex(control, 1),
    valid: true,
    warnings: [],
  });

  const levelField: ParsedField = {
    id: `${idPrefix}-level`,
    name: `${namePrefix} · Security Level`,
    offset: start,
    length: SECURITY_CONTROL_LENGTH,
    rawBytes: data.slice(start, start + SECURITY_CONTROL_LENGTH),
    rawValue: securityLevel,
    valid: true,
    warnings: [],
  };
  const levelName = SECURITY_LEVEL_NAMES.get(securityLevel);
  if (levelName !== undefined) levelField.physicalValue = levelName;
  fields.push(levelField);

  const keyIdModeField: ParsedField = {
    id: `${idPrefix}-key-id-mode`,
    name: `${namePrefix} · Key Identifier Mode`,
    offset: start,
    length: SECURITY_CONTROL_LENGTH,
    rawBytes: data.slice(start, start + SECURITY_CONTROL_LENGTH),
    rawValue: keyIdMode,
    valid: true,
    warnings: [],
  };
  const keyIdModeName = KEY_ID_MODE_NAMES.get(keyIdMode);
  if (keyIdModeName !== undefined) keyIdModeField.physicalValue = keyIdModeName;
  fields.push(keyIdModeField);

  fields.push({
    id: `${idPrefix}-frame-counter-suppression`,
    name: `${namePrefix} · Frame Counter Suppression`,
    offset: start,
    length: SECURITY_CONTROL_LENGTH,
    rawBytes: data.slice(start, start + SECURITY_CONTROL_LENGTH),
    rawValue: frameCounterSuppressed ? 1 : 0,
    valid: true,
    warnings: [],
  });

  fields.push({
    id: `${idPrefix}-asn-in-nonce`,
    name: `${namePrefix} · ASN in Nonce`,
    offset: start,
    length: SECURITY_CONTROL_LENGTH,
    rawBytes: data.slice(start, start + SECURITY_CONTROL_LENGTH),
    rawValue: asnInNonce ? 1 : 0,
    valid: true,
    warnings: [],
  });

  let cursor = start + SECURITY_CONTROL_LENGTH;
  let frameCounter: number | undefined;

  if (!frameCounterSuppressed) {
    if (cursor + FRAME_COUNTER_LENGTH > limit) return truncatedResult(cursor - start);
    frameCounter = readUint32Le(data, cursor);
    fields.push({
      id: `${idPrefix}-frame-counter`,
      name: `${namePrefix} · Frame Counter`,
      offset: cursor,
      length: FRAME_COUNTER_LENGTH,
      rawBytes: data.slice(cursor, cursor + FRAME_COUNTER_LENGTH),
      rawValue: frameCounter,
      valid: true,
      warnings: [],
    });
    cursor += FRAME_COUNTER_LENGTH;
  }

  const keyIdLength = keyIdentifierLength(keyIdMode);
  let keyIndex: number | undefined;
  if (keyIdLength > 0) {
    if (cursor + keyIdLength > limit) return truncatedResult(cursor - start);
    if (keyIdLength > 1) {
      fields.push({
        id: `${idPrefix}-key-source`,
        name: `${namePrefix} · Key Source`,
        offset: cursor,
        length: keyIdLength - 1,
        rawBytes: data.slice(cursor, cursor + keyIdLength - 1),
        valid: true,
        warnings: [],
      });
    }
    keyIndex = byteAt(data, cursor + keyIdLength - 1);
    fields.push({
      id: `${idPrefix}-key-index`,
      name: `${namePrefix} · Key Index`,
      offset: cursor + keyIdLength - 1,
      length: 1,
      rawBytes: data.slice(cursor + keyIdLength - 1, cursor + keyIdLength),
      rawValue: keyIndex,
      valid: true,
      warnings: [],
    });
    cursor += keyIdLength;
  }

  const micLength = micLengthForSecurityLevel(securityLevel);
  if (micLength > 0) warnings.push({ code: messages.micNotVerifiable, message: messages.micNotVerifiable });

  return {
    start,
    length: cursor - start,
    securityLevel,
    keyIdMode,
    frameCounterSuppressed,
    asnInNonce,
    frameCounter,
    keyIndex,
    micLength,
    encrypted: isEncryptedSecurityLevel(securityLevel),
    truncated: false,
  };
}

/**
 * MIC alanını basar — **PASS/FAIL BASMAZ** (dosya başı). `end` MIC'in
 * MUTLAK sonu (MAC'te FCS ofseti).
 */
export function pushMic(
  data: Uint8Array,
  end: number,
  micLength: number,
  fields: ParsedField[],
  idPrefix: string,
  namePrefix: string,
  micNotVerifiableKey: string,
): void {
  if (micLength <= 0) return;
  const offset = end - micLength;
  if (offset < 0) return;
  fields.push({
    id: `${idPrefix}-mic`,
    name: `${namePrefix} · MIC`,
    offset,
    length: micLength,
    rawBytes: data.slice(offset, end),
    valid: true,
    warnings: [micNotVerifiableKey],
  });
}

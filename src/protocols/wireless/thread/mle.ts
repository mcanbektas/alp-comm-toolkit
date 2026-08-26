/**
 * MLE (Mesh Link Establishment) **SINIFLANDIRICI** — gövde ÇÖZÜLMEZ
 * (Faz 10, dalga 18d, `[KARAR 18-3]`).
 *
 * `lowpan.ts`i **import ETMEZ** ve etmemelidir (dalga 17'nin `cnip.ts`/
 * `lonTalk.ts` ayrımı emsal); `thread.ts` ikisini sıralar.
 *
 * ── MESAJ BİÇİMİ ──────────────────────────────────────────────────────────
 * ```
 * +-----+------------+---------+-----+       +-----+---------+
 * |  0  | Aux Header | Command | MIC |       | 255 | Command |
 * +-----+------------+---------+-----+       +-----+---------+
 *    ŞİFRELİ (802.15.4 Security)                 ŞİFRESİZ
 * ```
 * `[KANIT]` `draft-kelsey-intarea-mesh-link-establishment-06` §5 + §14.1 IANA
 * alt kaydı; Wireshark `packet-mle.c:209-213`
 * (`{0, "802.15.4 Security"}, {255, "No Security"}`).
 *
 * UDP portu **19788 = `0x4D4C` = ASCII `"ML"`** `[KANIT]` OpenThread
 * `src/core/thread/mle_types.hpp:81` — `constexpr uint16_t kUdpPort = 19788;`
 * (2026-08-26'da kaynaktan DOĞRULANDI).
 *
 * ── 🚨🚨 TUZAK — OpenThread'İN KENDİ YORUMLARI TERS ───────────────────────
 * `openthread/src/core/thread/mle.hpp:1498-1502` (kaynaktan doğrulandı,
 * `main` dalı, 2026-08-26):
 * ```cpp
 * enum SecuritySuite : uint8_t
 * {
 *     k154Security = 0,   // "...MLE message is not secured."   ← YORUM YANLIŞ
 *     kNoSecurity  = 255, // "...MLE message is secured."       ← YORUM YANLIŞ
 * };
 * ```
 * **ADLAR doğru, YORUMLAR takas edilmiş.** Bu modül YORUMA DEĞİL KODA bakar
 * ve KOD üç ayrı yerde aynı şeyi söylüyor (üçü de `mle.cpp`, aynı depo,
 * doğrulandı):
 *   · `:1593` `if (securitySuite == kNoSecurity) { … ReadAtAndAdvanceOffset(command); … }`
 *     — suite **255**'te komut baytı DOĞRUDAN okunuyor ⇒ ŞİFRESİZ.
 *   · `:1616` `VerifyOrExit(securitySuite == k154Security, …)` ardından
 *     `ReadAtAndAdvanceOffset(authData.mSecurityHeader)` — suite **0**'da
 *     Auxiliary Security Header geliyor ⇒ ŞİFRELİ.
 *   · `:3573-3575` gönderim yolunda `Append(securitySuite)` sonrası
 *     `if (securitySuite == k154Security) { SecurityHeader …; Append(…); }`.
 *
 * > **Yorumu kopyalayan bir uygulama ŞİFRELİ çerçeveyi "şifresiz" sanıp
 * > ciphertext'i MLE komutu diye BASARDI — hata VERMEDEN.**
 * > Dalga 17'nin *"YORUM ile KOD ayrışabilir; KOD kazanır"* dersinin ÜÇÜNCÜ
 * > vakası (`LtIpPackets.h:264` ve `packet-lon.c:395`ten sonra).
 *
 * ── ŞİFRESİZ GÖNDERİLEN SADECE İKİ KOMUT VAR ──────────────────────────────
 * `[KANIT]` `mle.cpp:3563-3567` (kaynaktan doğrulandı):
 * ```cpp
 * securitySuite = k154Security;
 * if ((aCommand == kCommandDiscoveryRequest) || (aCommand == kCommandDiscoveryResponse))
 * { securitySuite = kNoSecurity; }
 * ```
 * Yani **Discovery Request (16) ve Discovery Response (17)**. Parent
 * Request/Response, Child ID Request/Response, Advertisement, Link
 * Request/Accept, Data Request/Response, Announce — **hepsi ŞİFRELİ.**
 *
 * **Sonuç:** katalogun *"MLE Message Classifier (Parent Request / Response,
 * Child ID, Advertisement, Link Request)"* vaadi ANAHTAR OLMADAN
 * KARŞILANAMAZ. Şifreli dalda komut tipi çerçevede OKUNAMAZ:
 *   · "şifreli MLE" damgası BASILIR,
 *   · komut tipi UYDURULMAZ (alan HİÇ BASILMAZ),
 *   · MIC bir ALAN olarak basılır ama **PASS/FAIL BASILMAZ**
 *     (`auxSecurityHeader.ts` dosya başı, dalga 13 dersi 3).
 * **Rozetin `partial` olmasının BİRİNCİ sebebi budur.**
 *
 * ── KAPSAM DIŞI ───────────────────────────────────────────────────────────
 *   · **MLE TLV'leri** — şifresiz iki mesajda bile gövde TLV'leri
 *     çözülmez; Thread Network Data / MeshCoP / TMF CoAP TLV'leri
 *     `packet-thread.c`in 202 KB'lık alanıdır, ayrı bir dalga.
 *   · **Şifre çözme** — CLAUDE.md'nin anahtar kuralı.
 */

import type { ParsedField, ProtocolError, ProtocolWarning } from '@/protocol-core/types';

import type { AuxSecurityHeaderMessages } from './auxSecurityHeader';
import { decodeAuxSecurityHeader, pushMic } from './auxSecurityHeader';

/** `[KANIT]` OpenThread `mle_types.hpp:81`. */
export const MLE_UDP_PORT = 19788;

export const MLE_SECURITY_SUITE_802154 = 0;
export const MLE_SECURITY_SUITE_NONE = 255;

/** `[KANIT]` Wireshark `packet-mle.c:209-213` — adlar VERİDİR, çevrilmez. */
export const MLE_SECURITY_SUITE_NAMES: ReadonlyMap<number, string> = new Map([
  [MLE_SECURITY_SUITE_802154, '802.15.4 Security'],
  [MLE_SECURITY_SUITE_NONE, 'No Security'],
]);

export const MLE_COMMAND_DISCOVERY_REQUEST = 16;
export const MLE_COMMAND_DISCOVERY_RESPONSE = 17;

/**
 * `[KANIT]` OpenThread `mle_types.hpp:148-173` (kaynaktan doğrulandı,
 * 2026-08-26) + `draft-kelsey-intarea-mesh-link-establishment-06` §14.1.
 * Adlar VERİDİR, çeviriye girmez.
 *
 * Tablo 0-20'yi kapsar. **Pratikte yalnız 16 ve 17 telde OKUNABİLİR** —
 * ötekiler her zaman Security Suite 0 ile, yani şifreli gönderilir (dosya
 * başı). Tablonun tamamının burada olması bir vaat değil, bir SÖZLÜK: bir gün
 * çözülmüş bir akış beslenirse ya da başka bir yığın şifresiz gönderirse bayt
 * ADLANDIRILABİLSİN diye. 99 (Time Sync) ve 100-103 (P2P) OpenThread'in
 * derleme-zamanı seçenekleriyle gelir ve Thread 1.x tel biçiminin zorunlu
 * parçası DEĞİLDİR — bilerek DIŞARIDA bırakıldı.
 */
export const MLE_COMMAND_NAMES: ReadonlyMap<number, string> = new Map([
  [0, 'Link Request'],
  [1, 'Link Accept'],
  [2, 'Link Accept and Request'],
  [3, 'Link Reject'],
  [4, 'Advertisement'],
  [5, 'Update'],
  [6, 'Update Request'],
  [7, 'Data Request'],
  [8, 'Data Response'],
  [9, 'Parent Request'],
  [10, 'Parent Response'],
  [11, 'Child ID Request'],
  [12, 'Child ID Response'],
  [13, 'Child Update Request'],
  [14, 'Child Update Response'],
  [15, 'Announce'],
  [MLE_COMMAND_DISCOVERY_REQUEST, 'Discovery Request'],
  [MLE_COMMAND_DISCOVERY_RESPONSE, 'Discovery Response'],
  [18, 'Link Metrics Management Request'],
  [19, 'Link Metrics Management Response'],
  [20, 'Link Probe'],
]);

export const ENCRYPTED_PAYLOAD_MARKED = 'marked';
export const ENCRYPTED_PAYLOAD_HEX = 'hex';

export interface MleMessages extends AuxSecurityHeaderMessages {
  readonly unknownSecuritySuite: string;
  readonly encryptedCommandNotReadable: string;
  readonly commandNotDecoded: string;
  readonly tlvsNotDecoded: string;
}

export interface MleOptions {
  readonly encryptedPayloadDisplay: string;
  readonly securityLevelOverride: number | undefined;
}

export interface MleSummary {
  readonly securitySuite: number;
  /** Şifreli dalda `undefined` — komut tipi çerçevede OKUNAMAZ, UYDURULMAZ. */
  readonly command: number | undefined;
  readonly commandName: string | undefined;
  readonly encrypted: boolean;
}

function byteAt(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function hexBytes(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

function warn(warnings: ProtocolWarning[], key: string, offset: number, length: number): void {
  warnings.push({ code: key, message: key, offset, length });
}

/**
 * `start`..`end` arasındaki UDP yükünü MLE olarak sınıflandırır.
 *
 * Çağıran, portun MLE portu olduğunu ZATEN doğrulamıştır (`mlePort` kanalı);
 * bu fonksiyon port kararı VERMEZ.
 */
export function decodeMle(
  data: Uint8Array,
  start: number,
  end: number,
  fields: ParsedField[],
  warnings: ProtocolWarning[],
  errors: ProtocolError[],
  options: MleOptions,
  messages: MleMessages,
): MleSummary | undefined {
  if (start >= end) return undefined;

  const suite = byteAt(data, start);
  const suiteField: ParsedField = {
    id: 'mle-security-suite',
    name: 'MLE · Security Suite',
    offset: start,
    length: 1,
    rawBytes: data.slice(start, start + 1),
    rawValue: suite,
    valid: MLE_SECURITY_SUITE_NAMES.has(suite),
    warnings: [],
  };
  const suiteName = MLE_SECURITY_SUITE_NAMES.get(suite);
  if (suiteName !== undefined) {
    suiteField.physicalValue = suiteName;
  } else {
    suiteField.warnings = [messages.unknownSecuritySuite];
    warn(warnings, messages.unknownSecuritySuite, start, 1);
  }
  fields.push(suiteField);

  let cursor = start + 1;

  if (suite === MLE_SECURITY_SUITE_NONE) {
    // ── ŞİFRESİZ dal — komut baytı DOĞRUDAN okunur (`mle.cpp:1593`) ───────
    if (cursor >= end) return { securitySuite: suite, command: undefined, commandName: undefined, encrypted: false };
    const command = byteAt(data, cursor);
    const commandName = MLE_COMMAND_NAMES.get(command);
    const commandField: ParsedField = {
      id: 'mle-command',
      name: 'MLE · Command',
      offset: cursor,
      length: 1,
      rawBytes: data.slice(cursor, cursor + 1),
      rawValue: command,
      valid: true,
      warnings: [],
    };
    if (commandName !== undefined) commandField.physicalValue = commandName;
    fields.push(commandField);
    cursor += 1;

    if (command !== MLE_COMMAND_DISCOVERY_REQUEST && command !== MLE_COMMAND_DISCOVERY_RESPONSE) {
      // Şifresiz gönderilen SADECE Discovery Request/Response'tur
      // (`mle.cpp:3565-3568`). Başka bir komut şifresiz görünüyorsa ya
      // OpenThread dışı bir yığın ya da bozuk bir çerçeve — bayt gerçektir,
      // ama beklenmedik olduğu SÖYLENİR.
      warn(warnings, messages.commandNotDecoded, cursor - 1, 1);
    }

    if (cursor < end) {
      fields.push({
        id: 'mle-tlvs',
        name: 'MLE · TLVs',
        offset: cursor,
        length: end - cursor,
        rawBytes: data.slice(cursor, end),
        unit: 'B',
        valid: true,
        warnings: [messages.tlvsNotDecoded],
      });
      warn(warnings, messages.tlvsNotDecoded, cursor, end - cursor);
    }
    return { securitySuite: suite, command, commandName, encrypted: false };
  }

  if (suite === MLE_SECURITY_SUITE_802154) {
    // ── ŞİFRELİ dal — Aux Security Header gelir (`mle.cpp:1616`, `:3575`) ──
    const aux = decodeAuxSecurityHeader(
      data,
      cursor,
      end,
      fields,
      warnings,
      errors,
      messages,
      'mle-sec',
      'MLE',
      options.securityLevelOverride,
    );
    if (aux.truncated) {
      return { securitySuite: suite, command: undefined, commandName: undefined, encrypted: true };
    }
    cursor += aux.length;
    const payloadEnd = Math.max(cursor, end - aux.micLength);

    // 🚨 KOMUT TİPİ UYDURULMAZ: `mle-command` alanı bu dalda HİÇ BASILMAZ.
    if (payloadEnd > cursor) {
      const payload = data.slice(cursor, payloadEnd);
      const payloadField: ParsedField = {
        id: 'mle-encrypted-payload',
        name: 'MLE · Encrypted Payload (command type not readable on the wire)',
        offset: cursor,
        length: payload.length,
        rawBytes: payload,
        unit: 'B',
        valid: true,
        warnings: [messages.encryptedCommandNotReadable],
      };
      if (options.encryptedPayloadDisplay === ENCRYPTED_PAYLOAD_HEX) {
        payloadField.physicalValue = hexBytes(payload);
      }
      fields.push(payloadField);
    }
    warn(warnings, messages.encryptedCommandNotReadable, cursor, Math.max(0, payloadEnd - cursor));

    // MIC basılır, PASS/FAIL BASILMAZ.
    pushMic(data, end, aux.micLength, fields, 'mle-sec', 'MLE', messages.micNotVerifiable);

    return { securitySuite: suite, command: undefined, commandName: undefined, encrypted: true };
  }

  // Tanınmayan süit — gövde HAM, hiçbir şey uydurulmaz.
  if (cursor < end) {
    fields.push({
      id: 'mle-unknown-suite-payload',
      name: 'MLE · Payload (unknown security suite)',
      offset: cursor,
      length: end - cursor,
      rawBytes: data.slice(cursor, end),
      unit: 'B',
      valid: false,
      warnings: [messages.unknownSecuritySuite],
    });
  }
  return { securitySuite: suite, command: undefined, commandName: undefined, encrypted: false };
}

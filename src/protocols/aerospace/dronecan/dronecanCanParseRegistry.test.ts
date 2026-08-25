import { describe, expect, it } from 'vitest';

import { createProtocolRegistry } from '@/protocol-core/registry';
import { registerBuiltInProtocols } from '../../index';
import { droneCanParser, droneCanPlugin } from './dronecan';
import type { ExampleFrame } from '@/protocol-core/types';

/**
 * Faz 10 dalga 15a — `j1850CanParseRegistry.test.ts` (14f)/
 * `sentSpcCanParseRegistry.test.ts` (14g)/`psi5CanParseRegistry.test.ts`
 * (14h) DESENİNİN dördüncü uygulaması, ama İKİ YÖNLÜ: DroneCAN aynı 16
 * baytlık SocketCAN konteynerini `isotp`/`j1939`/`canopen`/`devicenet`/`ccp`/
 * `xcpOnCan`/`nmea2000` ile PAYLAŞIYOR (dronecan.ts dosya başı) — bu dalganın
 * ÖLÇÜLMÜŞ en yüksek çakışma riski (brief-faz10-dalga15a.md).
 *
 * ── ÖLÇÜLEN BULGU 1 — İLERİ YÖN (KAPANDI) ───────────────────────────────────
 * İlk sürüm (yalnız brifin verdiği üç ölçüt) `isotp`/`j1939`/`devicenet`/
 * `nmea2000`in TOPLAM 13 örneğini yanlış pozitif kabul ediyordu — 12'si
 * `multi-frame-middle` (SOT=0,EOT=0) roldeydi (14f'in "%54" dersinin bu
 * dalgadaki somut hâli, ÖLÇÜLDÜ 2026-08-25). Kök sebep `canParse`e taşındı
 * ve dört ek, resmî spec'ten türeyen ölçütle KAPATILDI (bkz. `dronecan.ts`
 * `canParse` yorumu): middle rolü hiç kabul edilmez, `multi-frame-first`
 * Toggle=0+DLC=8 ister, anonim mesaj yalnız single-frame olabilir, servis
 * transferinde Source/Destination Node ID 0 olamaz. İlk test bu 13 örneğin
 * ARTIK reddedildiğini bekçiler.
 *
 * ── ÖLÇÜLEN BULGU 2 — TERS YÖN (KAPANMADI, BİLEREK — brif kararı) ──────────
 * Brif: "Kabul ediliyorsa bu bir bulgu olarak brife yazılır, sessizce
 * düzeltilmez." DroneCAN'in KENDİ `canParse`inin ADAY saydığı 6 örnek
 * (`not-extended-rejected` ve `multi-frame-middle` HARİÇ — ikisi zaten
 * dronecan'ın kendi `canParse`inden geçmiyor, "başka biri kabul etti mi"
 * sorusu onlar için anlamsız) `canFrame.ts` ailesine ve tam registry'ye
 * (129 protokol) karşı ÖLÇÜLDÜ (2026-08-25):
 *
 *   `canFrame.ts` ailesinde GERÇEKTEN yapısal ayrım yapan dört komşu
 *   (`canopen`, `devicenet`, `can-2-0a`, `can-xl`) DroneCAN'in 6 adayının
 *   HİÇBİRİNİ kabul etmiyor — CANopen/DeviceNet 11-bit COB-ID'ye kilitli,
 *   CAN XL'in çerçeve biçimi zaten farklı. Bunlar bekçilenir (aşağıdaki
 *   ilk `it`), regresyona karşı.
 *
 *   Geri kalan yedi komşu (`can-2-0b`, `can-fd`, `ccp`, `xcp-on-can`,
 *   `j1939`, `nmea-2000` TAMAMINI; `iso-tp` 4/6'sını) kabul ediyor — ama bu
 *   bir DroneCAN kusuru DEĞİL: `xcpOnCan.ts`/`ccp.ts`nin dosya başları "CAN
 *   ID bazlı ek eleme YAPILAMAZ" diye AÇIKÇA yazıyor (CAN ID kullanıcı/
 *   config tanımlı, yapısal olarak ayrılamaz), `j1939`/`nmea-2000`in
 *   `canParse`i yalnız `extended === true` bakıyor (PDU/PGN doğrulaması
 *   `parse()`e bırakılmış), ham `can-2-0b`/`can-fd` zaten "herhangi bir
 *   geçerli CAN çerçevesi" sayıyor — TANIM gereği. Bu dosyalara dokunmak bu
 *   alt dalganın kapsamı DIŞINDA.
 *
 *   Registrinin GERİ KALANINDA (genel bayt-akışı/çerçeveleme protokolleri:
 *   `arp`/`ascii-protocol`/`at-commands`/`uart`/`rs-232`/`telnet`/
 *   `websocket`/`xmodem`/`spi`/… — 68 protokol, TOPLAM 380 kabul, 6 aday ×
 *   ~63 protokol ortalama) — bunların `canParse`i yapısal bir başlık
 *   DOĞRULAMAZ, yalnız uzunluk aralığına bakar. Bu, o protokollerin KENDİ
 *   tasarım tercihi — bu dalganın kapsamı DIŞINDA, dokunulmadı.
 *
 * SONUÇ: `canParse` bu registride GENEL OLARAK "ucuz ön eleme"dir (spec,
 * `types.ts` — "Tam doğrulamayı burada yapma, parse'a bırak"), mükemmel bir
 * sınıflandırıcı DEĞİL. DroneCAN'in KENDİ payına düşen iş (ileri yön, kendi
 * konteyner-paylaşan komşularını REDDETMEK) yapıldı ve bekçilendi; genel
 * çerçeveleme katmanının — ve bazı config-tanımlı CAN protokollerinin —
 * kendi gevşekliği bu alt dalganın DIŞINDA bırakıldı.
 */

/**
 * `canFrame.ts`in SocketCAN konteynerini paylaşan komşulardan (dronecan.ts
 * dosya başı + main brief "ALTI tüketiciyle kanıtlı" listesi + ham CAN
 * varyantları) yalnız bu DÖRDÜNDE GERÇEK yapısal ayrım var (11-bit'e kilitli
 * ya da farklı çerçeve biçimi) — regresyona karşı SIFIR TOLERANS burada
 * uygulanır (dosya başı ölçüm). Kalanı (`can-2-0b`/`can-fd`/`iso-tp`/`j1939`/
 * `ccp`/`xcp-on-can`/`nmea-2000`) `canParse` düzeyinde ID bazlı eleme
 * YAPMIYOR — bu onların kendi tasarım kararı, aşağıdaki tam-registry
 * ölçümünde yakalanır ama bekçilenmez.
 */
const STRICT_STRUCTURAL_DISCRIMINATOR_IDS = ['canopen', 'devicenet', 'can-2-0a', 'can-xl'];

/** dronecan'ın KENDİ `canParse`inin aday saydığı örnekler — bkz. dosya başı. */
function ownCandidateExamples(): readonly ExampleFrame[] {
  return droneCanPlugin.exampleFrames.filter((example) => droneCanParser.canParse(example.bytes));
}

describe('DroneCAN canParse — registry çapında yanlış pozitif taraması', () => {
  it(
    'dronecan DIŞINDAKİ hiçbir protokolün örnek çerçevesi canParse’i geçmez',
    async () => {
      const registry = createProtocolRegistry();
      registerBuiltInProtocols(registry);

      const ids = registry.registeredProtocolIds();
      const collisions: string[] = [];
      let totalExamples = 0;

      for (const id of ids) {
        if (id === droneCanPlugin.id) continue;
        const plugin = await registry.loadProtocolPlugin(id);
        for (const example of plugin.exampleFrames) {
          totalExamples += 1;
          if (droneCanParser.canParse(example.bytes)) {
            collisions.push(`${id}/${example.id} → dronecan canParse=true (${example.bytes.length} bayt)`);
          }
        }
      }

      // Ölçümün gerçekten TAM registry üzerinde koştuğunun kanıtı — 14f'in
      // ölçtüğü 761'in altına düşerse taramanın kendisi bozulmuş demektir.
      expect(
        totalExamples,
        'registry örnek sayısı beklenenden düşük — tarama gerçekten koştu mu?',
      ).toBeGreaterThan(700);
      expect(collisions, `çarpışmalar (${collisions.length}):\n${collisions.join('\n')}`).toEqual([]);
    },
    20000,
  );

  it(
    'TERS YÖN, GERÇEK yapısal ayrım yapan komşular — canopen/devicenet/can-2-0a/can-xl DroneCAN adaylarının HİÇBİRİNİ kabul etmez',
    async () => {
      const registry = createProtocolRegistry();
      registerBuiltInProtocols(registry);

      const candidates = ownCandidateExamples();
      expect(candidates.length, 'dronecan kendi hiçbir örneğini aday saymıyor — canParse bozuk mu?').toBe(
        6,
      );

      const collisions: string[] = [];
      for (const id of STRICT_STRUCTURAL_DISCRIMINATOR_IDS) {
        const plugin = await registry.loadProtocolPlugin(id);
        for (const example of candidates) {
          if (plugin.parser?.canParse(example.bytes) === true) {
            collisions.push(`dronecan/${example.id} → ${id} canParse=true`);
          }
        }
      }

      expect(collisions, `beklenmeyen kabul (${collisions.length}): ${collisions.join(', ')}`).toEqual([]);
    },
    20000,
  );

  it(
    'TERS YÖN, TAM REGISTRY — ölçülür ve raporlanır, genel çerçeveleme/config-tanımlı-ID protokolleri DÜZELTİLMEZ (bulgu, dosya başı)',
    async () => {
      const registry = createProtocolRegistry();
      registerBuiltInProtocols(registry);

      const ids = registry.registeredProtocolIds();
      const candidates = ownCandidateExamples();
      let checkedPairs = 0;
      let totalCollisions = 0;

      for (const id of ids) {
        if (id === droneCanPlugin.id) continue;
        const plugin = await registry.loadProtocolPlugin(id);
        for (const example of candidates) {
          checkedPairs += 1;
          if (plugin.parser?.canParse(example.bytes) === true) totalCollisions += 1;
        }
      }

      // Taramanın gerçekten tam registry üzerinde koştuğunun kanıtı.
      expect(checkedPairs).toBeGreaterThan(700);
      // Bu bir "geçer/kalır" bekçisi DEĞİL, bir ÖLÇÜMDÜR (dosya başı bulgu
      // 2, ÖLÇÜLDÜ: 380/762 — %50). Sıfıra zorlamak `ccp`/`xcp-on-can`in
      // "ID bazlı eleme YAPILAMAZ" kararını ya da kapsam dışı genel
      // çerçeveleme protokollerini bozardı. Yalnız taramanın koştuğu ve
      // makul bir üst sınırın (tüm çiftlerin) aşılmadığı doğrulanır.
      expect(totalCollisions).toBeLessThanOrEqual(checkedPairs);
    },
    20000,
  );

  it('kendi örnek çerçeveleri beklendiği gibi sınıflanır (multi-frame-middle ve not-extended-rejected BİLEREK canParse’i geçmez)', () => {
    const expectedFalse = new Set(['not-extended-rejected', 'multi-frame-middle']);
    for (const example of droneCanPlugin.exampleFrames) {
      const expected = !expectedFalse.has(example.id);
      expect(droneCanParser.canParse(example.bytes), `dronecan/${example.id}`).toBe(expected);
    }
  });
});

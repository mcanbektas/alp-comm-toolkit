import { describe, expect, it } from 'vitest';

import { createProtocolRegistry } from '@/protocol-core/registry';
import { registerBuiltInProtocols } from '../../index';
import { sbusParser, sbusPlugin } from '../sbus/sbus';
import { ibusParser, ibusPlugin } from '../ibus/ibus';
import type { ExampleFrame } from '@/protocol-core/types';

/**
 * Faz 10 dalga 15c — `sentSpcCanParseRegistry.test.ts` (14g) DESENİNİN
 * SBUS/IBUS için uygulaması: iki kaydı TEK dosyada sınar
 * (`brief-faz10-dalga15c.md` "canParse" bölümü). Derinlik `dronecanCan
 * ParseRegistry.test.ts`ten (15a) alındı — brif bu dalganın en riskli
 * sınıfı olduğunu ve İKİ YÖNÜN de sınanmasını AÇIKÇA istiyor:
 *
 *  1. İLERİ YÖN: registry'deki yabancı örnek çerçeveler sbus/ibus'a
 *     KABUL EDİLMİYOR mu.
 *  2. TERS YÖN: sbus/ibus'un KENDİ örnek çerçeveleri başka bir parser'a
 *     KAÇMIYOR mu.
 *
 * ── ÖLÇÜLEN SONUÇ (2026-08-25) ───────────────────────────────────────────
 * İLERİ YÖN: SIFIR çakışma. Registry'nin 1000+ örnek çerçevesinden HİÇBİRİ
 * SBUS'un (25 bayt + `0x0F` ilk bayt) ya da IBUS'un (31/32 bayt + PASS eden
 * checksum) kriterlerini karşılamıyor — bu, IBUS'un checksum'ının GERÇEKTEN
 * bir eleme görevi gördüğünün de kanıtı (üçüncü test bunu ayrıca doğrudan
 * sınıyor). Bu SIFIR bir varsayım DEĞİL, aşağıdaki testin ölçtüğü bir
 * sonuçtur — `DOCUMENTED_FORWARD_COLLISIONS` boş kaldığı için bekçi sıfırı
 * ZORUNLU kılıyor; ileride yeni bir protokol eklenip çakışma doğarsa bu test
 * KIRMIZI olur ve yeni çakışma burada dosya/satır kaynaklı gerekçeyle
 * belgelenir (dronecan'ın `DOCUMENTED_CROSS_LINE_COLLISIONS` emsali).
 *
 * TERS YÖN: SIFIR DEĞİL, ve brif bunu zaten bekliyordu ("SBUS'ta üçüncü
 * kanıt yok... çakışma sayısını ölç ve raporla, sıfır değilse raporunda
 * yaz"). ÖLÇÜLDÜ: 8 örnek (4 sbus + 4 ibus) × 131 komşu = 1048 çift,
 * **448 çakışma** (sbus'un kendi örnekleri 214 kez, ibus'un kendi örnekleri
 * 234 kez başka bir parser'a "kaçıyor"), **63 BENZERSİZ komşu protokolde**.
 * `dronecanCanParseRegistry.test.ts`in KENDİ ters-yön ölçümüyle (380/762,
 * "%50") AYNI SINIFTA bir sonuç ve AYNI kök sebep: çarpışan komşuların HİÇBİRİ
 * SBUS/IBUS'un paylaştığı bir konteyner değil (dronecan'ın `canFrame.ts`
 * paylaşımının aksine, SBUS/IBUS'un başka HİÇBİR protokolle ortak bir bayt
 * konteyneri yok) — hepsi genel bayt-akışı/seri/ağ protokolleri
 * (`uart`/`rs-232`/`rs-485`/`tcp`/`udp`/`websocket`/`spi`/`i2c`/`hdlc`/
 * `sdlc`/`cobs`/`xmodem`/… ve benzerleri) ve `canParse`leri KENDİ tasarım
 * tercihleri gereği yalnız bir uzunluk aralığına bakıyor, yapısal bir başlık
 * DOĞRULAMIYOR — dronecan dosya başının kendi ifadesiyle "bu, o protokollerin
 * KENDİ tasarım tercihi". Bu düzeltmek bu dalganın (hatta muhtemelen tek bir
 * dalganın) kapsamı DIŞINDA: 63 farklı dosyaya dokunmak gerekirdi. Bu yüzden
 * TERS YÖN testi sıfıra ZORLANMAZ (dronecan'ın 3. testiyle AYNI karar) —
 * yalnız taramanın gerçekten koştuğu doğrulanır ve gerçek sayı burada
 * BELGELENİR. RC ailesinin GERÇEK kardeşleri (`crsf`/`ppm`/`pwm-servo`,
 * henüz bu dalgada YOK) geldiğinde bu ölçüm YENİDEN alınmalı — o zaman
 * paylaşılan bir konteyner (`packedChannels.ts`) olacağı için dronecan'ın
 * `STRICT_STRUCTURAL_DISCRIMINATOR_IDS`ine benzer sıkı bir alt küme
 * anlamlı olabilir; bugün öyle bir "gerçek aile" yok.
 */

/** sbus/ibus DIŞINDAKİ hiçbir protokolün örneğinin geçmemesi gereken ileri-yön çakışma listesi (ÖLÇÜLDÜ: boş — bekçi). */
const DOCUMENTED_FORWARD_COLLISIONS: readonly string[] = [];

function ownExamples(): readonly { readonly source: 'sbus' | 'ibus'; readonly example: ExampleFrame }[] {
  return [
    ...sbusPlugin.exampleFrames.map((example) => ({ source: 'sbus' as const, example })),
    ...ibusPlugin.exampleFrames.map((example) => ({ source: 'ibus' as const, example })),
  ];
}

describe('SBUS/IBUS canParse — registry çapında yanlış pozitif taraması', () => {
  it(
    'sbus/ibus DIŞINDAKİ hiçbir protokolün örnek çerçevesi canParse’i geçmez (İLERİ YÖN, bekçi)',
    async () => {
      const registry = createProtocolRegistry();
      registerBuiltInProtocols(registry);

      const ids = registry.registeredProtocolIds();
      const collisions: string[] = [];
      let totalExamples = 0;

      for (const id of ids) {
        if (id === sbusPlugin.id || id === ibusPlugin.id) continue;
        const plugin = await registry.loadProtocolPlugin(id);
        for (const example of plugin.exampleFrames) {
          totalExamples += 1;
          if (sbusParser.canParse(example.bytes)) {
            collisions.push(`${id}/${example.id} → sbus canParse=true (${String(example.bytes.length)} bayt)`);
          }
          if (ibusParser.canParse(example.bytes)) {
            collisions.push(`${id}/${example.id} → ibus canParse=true (${String(example.bytes.length)} bayt)`);
          }
        }
      }

      // Sağlık kontrolü — taramanın gerçekten TAM registry üzerinde koştuğunun
      // kanıtı (14f'in "sessiz 0 çarpışma" yanıltmasını önleyen ölçüt).
      expect(
        totalExamples,
        'registry örnek sayısı beklenenden düşük — tarama gerçekten koştu mu?',
      ).toBeGreaterThan(700);
      expect(
        collisions.sort(),
        `ileri yön çakışmaları (${String(collisions.length)}):\n${collisions.join('\n')}`,
      ).toEqual([...DOCUMENTED_FORWARD_COLLISIONS].sort());
    },
    20000,
  );

  it(
    'sbus/ibus’un KENDİ örnekleri başka parser’lara KAÇAR — ÖLÇÜLÜR VE RAPORLANIR, sıfıra ZORLANMAZ (TERS YÖN, dosya başı gerekçe)',
    async () => {
      const registry = createProtocolRegistry();
      registerBuiltInProtocols(registry);

      const ids = registry.registeredProtocolIds();
      const candidates = ownExamples();
      const collisions: string[] = [];
      let checkedPairs = 0;

      for (const id of ids) {
        if (id === sbusPlugin.id || id === ibusPlugin.id) continue;
        const plugin = await registry.loadProtocolPlugin(id);
        for (const { source, example } of candidates) {
          checkedPairs += 1;
          if (plugin.parser?.canParse(example.bytes) === true) {
            collisions.push(`${source}/${example.id} → ${id} canParse=true (${String(example.bytes.length)} bayt)`);
          }
        }
      }

      // Sağlık kontrolü — taramanın gerçekten TAM registry üzerinde koştuğunun kanıtı.
      expect(checkedPairs, 'taranan çift sayısı beklenenden düşük — tarama gerçekten koştu mu?').toBeGreaterThan(
        700,
      );
      // Bu bir "geçer/kalır" bekçisi DEĞİL, bir ÖLÇÜMDÜR (dosya başı, dronecan'ın
      // 3. testiyle AYNI karar). Sıfıra zorlamak 63 ilgisiz dosyayı bu dalganın
      // kapsamına sokardı. Yalnız taramanın koştuğu ve makul bir üst sınırın
      // (taranan tüm çiftler) aşılmadığı doğrulanır — ÖLÇÜLEN: 448/1048 (%43),
      // sbus 214, ibus 234, 63 benzersiz komşu (hepsi genel bayt-akışı
      // protokolleri — dosya başı listesi).
      expect(collisions.length, `ters yön çakışma sayısı (dosya başında belgeli): ${String(collisions.length)}`).toBeLessThanOrEqual(
        checkedPairs,
      );
    },
    20000,
  );

  it('IBUS canParse yalnız uzunluğa DEĞİL, checksum PASS’ine de bakar (yasak: yalnız uzunluk kontrolü)', () => {
    // `ia6b-checksum-mismatch` tam 32 bayt ama checksum FAIL — uzunluk-only
    // bir canParse bunu KABUL ederdi, gerçek uygulama REDDETMELİ.
    const checksumMismatch = ibusPlugin.exampleFrames.find(
      (example) => example.id === 'ia6b-checksum-mismatch',
    );
    if (checksumMismatch === undefined) throw new Error('ia6b-checksum-mismatch örneği yok');
    expect(checksumMismatch.bytes.length).toBe(32);
    expect(ibusParser.canParse(checksumMismatch.bytes)).toBe(false);
  });

  it('sbus/ibus kendi örnek çerçeveleri beklendiği gibi sınıflanır (hata-yolu örnekleri BİLEREK canParse’i geçmez)', () => {
    const expectedFalseSbus = new Set(['invalid-start-byte']);
    for (const example of sbusPlugin.exampleFrames) {
      const expected = !expectedFalseSbus.has(example.id);
      expect(sbusParser.canParse(example.bytes), `sbus/${example.id}`).toBe(expected);
    }

    const expectedFalseIbus = new Set(['ia6b-checksum-mismatch']);
    for (const example of ibusPlugin.exampleFrames) {
      const expected = !expectedFalseIbus.has(example.id);
      expect(ibusParser.canParse(example.bytes), `ibus/${example.id}`).toBe(expected);
    }
  });
});

import { describe, expect, it } from 'vitest';

import { createProtocolRegistry } from '@/protocol-core/registry';
import { registerBuiltInProtocols } from '../../index';
import { sbusParser, sbusPlugin } from '../sbus/sbus';
import { ibusParser, ibusPlugin } from '../ibus/ibus';
import { crsfParser, crsfPlugin } from '../crsf/crsf';
import type { ExampleFrame } from '@/protocol-core/types';

/**
 * Faz 10 dalga 15c — `sentSpcCanParseRegistry.test.ts` (14g) DESENİNİN
 * SBUS/IBUS için uygulaması: iki kaydı TEK dosyada sınar
 * (`brief-faz10-dalga15c.md` "canParse" bölümü). Derinlik `dronecanCan
 * ParseRegistry.test.ts`ten (15a) alındı — brif bu dalganın en riskli
 * sınıfı olduğunu ve İKİ YÖNÜN de sınanmasını AÇIKÇA istiyor. Dalga 15d
 * CRSF'i AYNI dosyaya EKLEDİ (yeni dosya AÇILMADI — zorunlu disiplin,
 * `brief-faz10-dalga15d.md` "canParse" bölümü):
 *
 *  1. İLERİ YÖN: registry'deki yabancı örnek çerçeveler sbus/ibus/crsf'e
 *     KABUL EDİLMİYOR mu.
 *  2. TERS YÖN: sbus/ibus/crsf'in KENDİ örnek çerçeveleri başka bir
 *     parser'a KAÇMIYOR mu.
 *
 * ── ÖLÇÜLEN SONUÇ — sbus/ibus (2026-08-25, dalga 15c) ─────────────────────
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
 * BELGELENİR.
 *
 * ── ÖLÇÜLEN SONUÇ — crsf EKLENİNCE (2026-08-25, dalga 15d) ────────────────
 * İLERİ YÖN İLK KOŞUDA (sbus/ibus/crsf DIŞINDAKİ 805 örnek çerçeve üzerinde)
 * SIFIR DEĞİLDİ — İKİ yanlış pozitif bulundu
 * (`modbus-tcp/illegal-data-address-exception`, `xcp-on-ethernet/empty-
 * packet-header-only`), ikisi de AYNI kalıp: `[0x00, 0x02, 0x00, 0x00, …]`.
 * Kök sebep `crsf.ts`teki `CANPARSE_ADDRESS_EVIDENCE` notunda ayrıntılı:
 * `lengthByte=2` (asgari, payload YOK) iken Frame CRC kapsamı TEK bir
 * `Type` baytına iner ve `Type=0x00` iken CRC-8/DVB-S2 TRİVİYAL olarak 0x00
 * üretir — yani `[adres, 0x02, 0x00, 0x00]` üç kanıtı da (adres + uzunluk +
 * CRC PASS) yapısal olarak geçiyordu.
 *
 * İLK DÜZELTME `0x00` adresini kanıttan çıkarmaktı ve ileri yön SIFIRA
 * döndü — AMA ANA THREAD BUNU ÖLÇTÜ VE YETERSİZ BULDU: aynı dejenere kalıp
 * kalan ON adresin (`0x10` … `0xEE`) HEPSİNDE geçmeye devam ediyordu. Yani
 * sıfır sonucu imzanın değil ÖRNEK KÜMESİNİN özelliğiydi — 14f'in "imzayı
 * örnek kümesine uydurma" dersinin birebir tekrarı. Registry taraması bunu
 * göremezdi çünkü registry'de o kalıbın başka bir örneği YOKTU.
 *
 * İLKELİ DÜZELTME (ana thread, 15d doğrulama turu): `canParse`e DÖRDÜNCÜ
 * kanıt eklendi — `Type` `FRAME_TYPE_NAMES` sözlüğünde olmalı. `0x00` bir
 * CRSF çerçeve tipi DEĞİLDİR, dolayısıyla kalıp ADRESTEN BAĞIMSIZ olarak
 * elenir; `0x00` Broadcast adres kanıtına GERİ ALINDI (örnek kümesine
 * uydurulmuş istisnaya artık gerek yok). Tip sözlüğü iki bağımsız kaynakta
 * doğrulanmıştır, yani kanıt kaynağa dayanır. ÖLÇÜLEN ETKİ (ana thread,
 * ajanın GÖRMEDİĞİ veriyle): dejenere kalıp 11 adresin 10'unda kabul →
 * 11'inde RED; 200000 rastgele arabellekte kabul 6 → **0**; 50000 ASCII
 * metinde 0 → 0. Aşağıdaki "dejenere kalıp" describe'ı bunu kalıcı
 * bekçiliyor.
 *
 * TERS YÖN: crsf eklenince 16 örnek (4 sbus + 4 ibus + 8 crsf) × 131 komşu =
 * 2096 çift, **908 çakışma** (sbus 214, ibus 234 — 15c'den DEĞİŞMEDİ — crsf
 * 460), **74 BENZERSİZ komşu protokolde** (63'ü sbus/ibus'tan zaten
 * biliniyordu, crsf 11 YENİ komşu ekledi — kısa 4-9 baytlık örnekleri
 * sbus/ibus'un sabit 25/31/32 baytından FARKLI bir uzunluk aralığını
 * tetikliyor). AYNI kök sebep, AYNI karar: sıfıra ZORLANMAZ (yukarı bak).
 * CRSF'in kendi oranı (460/1048 ≈ %44) sbus/ibus ile AYNI SINIFTA.
 *
 * RC ailesinin son iki kardeşi (`ppm`/`pwm-servo`, henüz bu dalgada YOK)
 * geldiğinde bu ölçüm YENİDEN alınmalı — ikisi `pulseLog.ts` paylaşıyor
 * (`packedChannels.ts` DEĞİL), dronecan'ın `STRICT_STRUCTURAL_DISCRIMINATOR_
 * IDS`ine benzer bir alt küme o zaman anlamlı olabilir.
 */

/** sbus/ibus/crsf DIŞINDAKİ hiçbir protokolün örneğinin geçmemesi gereken ileri-yön çakışma listesi (ÖLÇÜLDÜ: boş — bekçi). */
const DOCUMENTED_FORWARD_COLLISIONS: readonly string[] = [];

function ownExamples(): readonly { readonly source: 'sbus' | 'ibus' | 'crsf'; readonly example: ExampleFrame }[] {
  return [
    ...sbusPlugin.exampleFrames.map((example) => ({ source: 'sbus' as const, example })),
    ...ibusPlugin.exampleFrames.map((example) => ({ source: 'ibus' as const, example })),
    ...crsfPlugin.exampleFrames.map((example) => ({ source: 'crsf' as const, example })),
  ];
}

describe('SBUS/IBUS/CRSF canParse — registry çapında yanlış pozitif taraması', () => {
  it(
    'sbus/ibus/crsf DIŞINDAKİ hiçbir protokolün örnek çerçevesi canParse’i geçmez (İLERİ YÖN, bekçi)',
    async () => {
      const registry = createProtocolRegistry();
      registerBuiltInProtocols(registry);

      const ids = registry.registeredProtocolIds();
      const collisions: string[] = [];
      let totalExamples = 0;

      for (const id of ids) {
        if (id === sbusPlugin.id || id === ibusPlugin.id || id === crsfPlugin.id) continue;
        const plugin = await registry.loadProtocolPlugin(id);
        for (const example of plugin.exampleFrames) {
          totalExamples += 1;
          if (sbusParser.canParse(example.bytes)) {
            collisions.push(`${id}/${example.id} → sbus canParse=true (${String(example.bytes.length)} bayt)`);
          }
          if (ibusParser.canParse(example.bytes)) {
            collisions.push(`${id}/${example.id} → ibus canParse=true (${String(example.bytes.length)} bayt)`);
          }
          if (crsfParser.canParse(example.bytes)) {
            collisions.push(`${id}/${example.id} → crsf canParse=true (${String(example.bytes.length)} bayt)`);
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
    'sbus/ibus/crsf’in KENDİ örnekleri başka parser’lara KAÇAR — ÖLÇÜLÜR VE RAPORLANIR, sıfıra ZORLANMAZ (TERS YÖN, dosya başı gerekçe)',
    async () => {
      const registry = createProtocolRegistry();
      registerBuiltInProtocols(registry);

      const ids = registry.registeredProtocolIds();
      const candidates = ownExamples();
      const collisions: string[] = [];
      let checkedPairs = 0;

      for (const id of ids) {
        if (id === sbusPlugin.id || id === ibusPlugin.id || id === crsfPlugin.id) continue;
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
      // 3. testiyle AYNI karar). Sıfıra zorlamak onlarca ilgisiz dosyayı bu
      // dalganın kapsamına sokardı. Yalnız taramanın koştuğu ve makul bir üst
      // sınırın (taranan tüm çiftler) aşılmadığı doğrulanır. ÖLÇÜLEN (crsf
      // eklendikten sonra, 2026-08-25): 16 örnek (4 sbus + 4 ibus + 8 crsf) ×
      // 131 komşu = 2096 çift, **908 çakışma** (sbus 214, ibus 234 — 15c'den
      // DEĞİŞMEDİ — crsf 460), **74 BENZERSİZ komşu protokolde** (63'ü
      // sbus/ibus'tan zaten biliniyordu, crsf 11 YENİ komşu ekledi — crsf'in
      // 4-9 baytlık kısa örnekleri, sbus/ibus'un sabit 25/31/32 baytından
      // FARKLI bir uzunluk aralığına düşüyor, bu yüzden farklı bir "genel
      // bayt-akışı" alt kümesini tetikliyor). AYNI kök sebep (dosya başı):
      // çarpışan komşuların HİÇBİRİ CRSF'le paylaşılan bir konteyner değil,
      // hepsi yalnız bir uzunluk aralığına bakan genel protokoller. CRSF'in
      // kendi ORANI (460/1048 ≈ %44) sbus (214/524 ≈ %41) ve ibus'la
      // (234/524 ≈ %45) AYNI SINIFTA — üçüncü kanıtın (CRC-8 PASS) checksum'sız
      // komşularda bir eleme görevi GÖREMEYECEĞİ zaten beklenen bir sonuçtu
      // (bu komşular CRC'ye hiç bakmıyor).
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

  it('CRSF canParse yalnız adrese/uzunluğa DEĞİL, Frame CRC-8 PASS’ine de bakar (yasak: adres+uzunluk-only kontrol)', () => {
    // `frame-crc-mismatch`: adres (0xC8) VE uzunluk (26 bayt, dahili tutarlı)
    // ikisi de doğru — YALNIZ Frame CRC baytı bozuk. Adres+uzunluk-only bir
    // canParse bunu KABUL ederdi (crsf.ts dosya başı "canParse — ÜÇ kanıt").
    const frameCrcMismatch = crsfPlugin.exampleFrames.find((example) => example.id === 'frame-crc-mismatch');
    if (frameCrcMismatch === undefined) throw new Error('frame-crc-mismatch örneği yok');
    expect(frameCrcMismatch.bytes[0]).toBe(0xc8);
    expect(crsfParser.canParse(frameCrcMismatch.bytes)).toBe(false);
  });

  it('CRSF canParse Command CRC’ye BAKMAZ — yalnız Frame CRC (üçüncü kanıt tekildir, dosya başı)', () => {
    // `command-crc-mismatch`: Command CRC baytı BOZUK ama Frame CRC (bu bozuk
    // bayt üzerinden yeniden hesaplandığı için) PASS eder — yapısal olarak
    // GEÇERLİ bir CRSF çerçevesi, yalnız komut-özel doğrulaması FAIL.
    // `canParse` bunu KABUL ETMELİ (`parse()`in `frame.valid` sonucu ayrı bir
    // soru — command CRC hatası orada errors[]e girer, aşağıdaki assert onu
    // sınamıyor). Command CRC `canParse` kapısına GİRMEZ (dosya başı, brifin
    // "CRC-8 PASS" tekil ifadesi).
    const commandCrcMismatch = crsfPlugin.exampleFrames.find((example) => example.id === 'command-crc-mismatch');
    if (commandCrcMismatch === undefined) throw new Error('command-crc-mismatch örneği yok');
    expect(commandCrcMismatch.expectedValid).toBe(false);
    expect(crsfParser.canParse(commandCrcMismatch.bytes)).toBe(true);
  });

  it('sbus/ibus/crsf kendi örnek çerçeveleri beklendiği gibi sınıflanır (hata-yolu örnekleri BİLEREK canParse’i geçmez)', () => {
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

    // `command-crc-mismatch` BİLEREK BURADA DEĞİL — Frame CRC PASS ettiği
    // için canParse'i GEÇER (yukarıdaki özel test bunu ayrıca kanıtlıyor).
    const expectedFalseCrsf = new Set(['unrecognized-address', 'frame-crc-mismatch']);
    for (const example of crsfPlugin.exampleFrames) {
      const expected = !expectedFalseCrsf.has(example.id);
      expect(crsfParser.canParse(example.bytes), `crsf/${example.id}`).toBe(expected);
    }
  });
});

/**
 * DEJENERE KALIP REGRESYONU — ana thread'in 15d doğrulama turunda ÖLÇEREK
 * bulduğu zayıflığın kalıcı bekçisi.
 *
 * CRSF'in asgari çerçevesinde (`lengthByte = 2`, Type+CRC, payload YOK) Frame
 * CRC'nin kapsamı TEK bir `Type` baytına iner. `Type = 0x00` iken CRC-8/DVB-S2
 * (init 0x00, xorout 0x00) o tek sıfır baytın CRC'sini de `0x00` üretir, yani
 * `[adres, 0x02, 0x00, 0x00]` üç kanıtı da (adres + uzunluk + CRC PASS)
 * yapısal olarak geçer.
 *
 * İlk düzeltme `0x00` adresini kanıttan çıkarmaktı — GÖZLENEN iki registry
 * çakışmasını kapatıyordu ama SINIFI kapatmıyordu: kalıp kalan on adresin
 * HEPSİNDE geçmeye devam ediyordu. Sıfır çakışma sonucu imzanın değil örnek
 * kümesinin özelliğiydi (14f'in "imzayı örnek kümesine uydurma" dersi).
 *
 * İlkeli düzeltme dördüncü kanıt: `Type` `FRAME_TYPE_NAMES` sözlüğünde
 * olmalı. Bu test sözlükteki HER adres için kalıbın reddedildiğini
 * bekçiliyor — kanıt tekrar gevşetilirse KIRMIZI olur.
 */
describe('CRSF canParse — lengthByte=2 dejenere kalıbı (ana thread ölçümü)', () => {
  const DEGENERATE_ADDRESSES = [0x00, 0x10, 0x80, 0xc0, 0xc2, 0xc4, 0xc8, 0xcc, 0xea, 0xec, 0xee];

  it('bilinen adreslerin HİÇBİRİNDE `[adres, 0x02, 0x00, 0x00]` kabul edilmez', () => {
    const accepted = DEGENERATE_ADDRESSES.filter((address) =>
      crsfParser.canParse(Uint8Array.from([address, 0x02, 0x00, 0x00])),
    );
    expect(
      accepted.map((a) => `0x${a.toString(16)}`),
      'dejenere kalıbı kabul eden adresler (dördüncü kanıt gevşemiş olabilir)',
    ).toEqual([]);
  });

  it('sağlık kontrolü: kalıp GERÇEKTEN üç kanıtı geçiyor — reddi dördüncü kanıttan geliyor', () => {
    // Adres sözlükte, uzunluk tutarlı, ve CRC kapsamı (tek 0x00 baytı) PASS.
    // Yani ilk üç kanıt sağlanıyor; test yalnız "zaten uzunluk elemesi vardı"
    // diye sessizce yeşil gelmiyor.
    const frame = Uint8Array.from([0xc8, 0x02, 0x00, 0x00]);
    expect(frame.length, 'çerçeve tam olarak asgari uzunlukta').toBe(4);
    expect(frame[3], 'tek 0x00 Type baytının CRC-8/DVB-S2 değeri de 0x00').toBe(0x00);
    expect(crsfParser.canParse(frame)).toBe(false);
  });

  it('AYNI asgari uzunlukta ama sözlükteki bir tiple (0x02 GPS) KABUL edilir — kanıt aşırı daraltılmadı', () => {
    // 0x02 GPS sözlükte ve broadcast; CRC tek `0x02` baytı üzerinden hesaplanır.
    let crc = 0x02;
    for (let i = 0; i < 8; i += 1) crc = (crc & 0x80) === 0 ? (crc << 1) & 0xff : ((crc << 1) ^ 0xd5) & 0xff;
    expect(crsfParser.canParse(Uint8Array.from([0xc8, 0x02, 0x02, crc]))).toBe(true);
  });
});

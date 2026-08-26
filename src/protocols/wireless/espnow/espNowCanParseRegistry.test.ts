import { describe, expect, it } from 'vitest';

import { createProtocolRegistry } from '@/protocol-core/registry';

import { registerBuiltInProtocols } from '../../index';
import { espNowParser, espNowPlugin, hasNaiveEspNowSignature } from './espNow';

/**
 * Üç yönlü bekçi (dalga 16c/17 deseni, `lonworksCanParseRegistry.test.ts`
 * emsali, 153 satır): İLERİ (registry'nin TÜMÜNDE 0 çakışma), TERS
 * (reddedilen naif imza AYNI kümede çakışıyor — "yazılsaydı çalardı"
 * kanıtı), KENDİ ÜZERİNDE (kaydın TÜM örnekleri `true` — `canParse`
 * *"biçim bu mu"*dur, *"geçerli mi"* değil, bozuk örnekler dahil).
 *
 * `esp-now`in KENDİ ÜZERİNDE ayağı bir İSTİSNA taşır: `protected` örneği
 * BİLEREK `false` bekler. `docs/brief-faz10-dalga18c.md`nin kendi kabul
 * ölçütü: korumalı bir çerçevede Category baytı şifreli gövdenin İÇİNDEDİR,
 * yani dışarıdan bakan biri çerçevenin ESP-NOW olduğunu ÇERÇEVEDEN BİLEMEZ.
 * Bu bir eksiklik değil protokolün kendisi — testi sessizce ATLAMAK yerine
 * AÇIKÇA `false` bekleyerek sınıyoruz.
 */

interface RegistrySweep {
  readonly registeredProtocols: number;
  readonly totalExamples: number;
  /** BAŞKA kayıtların, `esp-now`in E1 imzasını geçen örnekleri. */
  readonly foreignHits: string[];
  /** BAŞKA kayıtların, REDDEDİLEN naif imzayı (yalnız `b[0] === 0xD0`) geçen örnekleri. */
  readonly naiveForeignHits: string[];
  /** `esp-now`in KENDİ örneklerinden E1'i geçenler. */
  readonly ownHits: string[];
  /** `esp-now`in KENDİ örneklerinden E1'i GEÇMEYENLER (`protected` BEKLENEN tek üye). */
  readonly ownMisses: string[];
}

async function sweepRegistry(): Promise<RegistrySweep> {
  const registry = createProtocolRegistry();
  registerBuiltInProtocols(registry);
  const ids = registry.registeredProtocolIds();

  const foreignHits: string[] = [];
  const naiveForeignHits: string[] = [];
  const ownHits: string[] = [];
  const ownMisses: string[] = [];
  let totalExamples = 0;

  for (const id of ids) {
    const plugin = await registry.loadProtocolPlugin(id);
    const isOwn = id === espNowParser.protocolId;

    for (const example of plugin.exampleFrames) {
      totalExamples += 1;
      const label = `${id}/${example.id}`;

      if (espNowParser.canParse(example.bytes)) {
        if (isOwn) ownHits.push(label);
        else foreignHits.push(label);
      } else if (isOwn) {
        ownMisses.push(label);
      }

      if (!isOwn && hasNaiveEspNowSignature(example.bytes)) {
        naiveForeignHits.push(label);
      }
    }
  }

  return { registeredProtocols: ids.length, totalExamples, foreignHits, naiveForeignHits, ownHits, ownMisses };
}

describe('espNow canParse — registry çapında üç yönlü bekçi', () => {
  it(
    "İLERİ: registry'deki BAŞKA hiçbir örnek E1 imzasını (n≥39, b[0]=0xD0, ToDS=FromDS=0, Category=127, OUI=18:FE:34) geçmez",
    async () => {
      const sweep = await sweepRegistry();
      // Sağlık kontrolü: sayım gerçekten koştu mu (büyümeye TOLERANSLI eşik,
      // ana brifin 899/144 ölçümü SABİTLENMEZ — Explore turunun bulgusu:
      // registry çapı "kaç kayıt" gibi tam sayılar SABİTLENMEZ, yalnız eşik).
      expect(sweep.totalExamples).toBeGreaterThan(880);
      expect(sweep.registeredProtocols).toBeGreaterThanOrEqual(144);
      expect(sweep.foreignHits).toEqual([]);
    },
    30000,
  );

  it(
    'TERS: yalnız b[0] === 0xD0 (E4, REDDEDİLEN naif imza) YAZILSAYDI ÇALARDI — kapsam kararının kanıtı',
    async () => {
      const sweep = await sweepRegistry();
      // Ana brif ölçümü: 3 / 899 (`sae-j1850-vpw`in üç örneği). Eşik olarak
      // tutuluyor ki registry büyüdükçe test KIRILMASIN, yalnız "en az bu
      // kadar çakışma var" garantisi kalsın.
      expect(sweep.naiveForeignHits.length).toBeGreaterThanOrEqual(3);
      expect(sweep.naiveForeignHits.length).toBeGreaterThan(sweep.foreignHits.length);
    },
    30000,
  );

  it(
    "KENDİ ÜZERİNDE: `protected` DIŞINDA esp-now'ın TÜM örnekleri true döner",
    async () => {
      const sweep = await sweepRegistry();
      expect(sweep.ownHits.length).toBe(espNowPlugin.exampleFrames.length - 1);
      expect(sweep.ownMisses).toHaveLength(1);
      expect(sweep.ownMisses).toContain(`${espNowParser.protocolId}/protected`);
    },
    30000,
  );

  it('sınır: E1in her ZORUNLU koşulu tek başına bozulunca canParse false döner', () => {
    const base = espNowPlugin.exampleFrames.find((frame) => frame.id === 'broadcast-single-element');
    if (base === undefined) throw new Error('taban örnek bulunamadı');
    expect(espNowParser.canParse(base.bytes)).toBe(true);

    // n ≥ 39
    expect(espNowParser.canParse(base.bytes.slice(0, 38))).toBe(false);

    // b[0] === 0xD0 (sürüm/tip/alt tip)
    const wrongSubtype = Uint8Array.from(base.bytes);
    wrongSubtype[0] = 0xc0; // Beacon (Yönetim, alt tip 8) — Action DEĞİL
    expect(espNowParser.canParse(wrongSubtype)).toBe(false);

    // ToDS = FromDS = 0
    const toDsSet = Uint8Array.from(base.bytes);
    toDsSet[1] = (toDsSet[1] ?? 0) | 0x01;
    expect(espNowParser.canParse(toDsSet)).toBe(false);

    // b[24] === 0x7F (Category)
    const wrongCategory = Uint8Array.from(base.bytes);
    wrongCategory[24] = 0x00;
    expect(espNowParser.canParse(wrongCategory)).toBe(false);

    // b[25..27] === 18 FE 34 (OUI) — her bayt AYRI AYRI sınanır
    const wrongOuiByte0 = Uint8Array.from(base.bytes);
    wrongOuiByte0[25] = 0x00;
    expect(espNowParser.canParse(wrongOuiByte0)).toBe(false);

    const wrongOuiByte1 = Uint8Array.from(base.bytes);
    wrongOuiByte1[26] = 0x00;
    expect(espNowParser.canParse(wrongOuiByte1)).toBe(false);

    const wrongOuiByte2 = Uint8Array.from(base.bytes);
    wrongOuiByte2[27] = 0x00;
    expect(espNowParser.canParse(wrongOuiByte2)).toBe(false);
  });

  it("tutarlılık: canParse true olan her esp-now örneği gerçekten parse edilebilir", () => {
    for (const example of espNowPlugin.exampleFrames) {
      if (!espNowParser.canParse(example.bytes)) continue;
      const result = espNowParser.parse(example.bytes);
      expect(result.success).toBe(true);
    }
  });
});

import { describe, expect, it } from 'vitest';

import { createProtocolRegistry } from '@/protocol-core/registry';

import { zigbeeParser, zigbeePlugin } from '../zigbee/zigbee';
import { registerBuiltInProtocols } from '../../index';
import {
  hasDispatchOnlySignature,
  hasNaiveThreadSignature,
  threadParser,
  threadPlugin,
} from './thread';

/**
 * DÖRT ayaklı bekçi (dalga 16c/17 deseni + 18d'nin kendi dördüncü ayağı):
 *
 * 1. **İleri** — registry'nin TÜMÜNDE `thread.canParse` 0 çakışma.
 * 2. **Ters** — REDDEDİLEN naif imzalar (yalnız MAC Frame Type, yalnız
 *    6LoWPAN dispatch) AYNI kümede çalar; "yazılsaydı çalardı" kanıtı.
 * 3. **Kendi üzerinde** — `thread`in örnekleri `true`; ÜÇ örnek BİLEREK
 *    `false` bekler ve üçünün de gerekçesi ayrı:
 *      · `lowpan-hc1`      — HC1 `[KARAR 18-3]`ün bilinçli kapsam dışısı,
 *      · `mac-security-mic` — MAC güvenliği açık; 6LoWPAN dispatch baytı
 *        Auxiliary Security Header'ın ARDINDA ve (Level ≥ 4'te) ciphertext'in
 *        İÇİNDE. `esp-now`in `protected` örneğiyle AYNI olgu,
 *      · `fcs-mismatch`    — imza geçerli FCS ister; bozuk FCS'li çerçeve
 *        auto-detection'a girmemelidir.
 *    `canParse` *"biçim bu mu"*dur, *"geçerli mi"* değil — ama FCS bu imzanın
 *    ZORUNLU ayağı olduğu için üçüncüsü de kayıtlı bir OLGUDUR.
 * 4. **🚨 ZİGBEE AYRIMI** — `zigbee` ile `thread` AYNI MAC'i paylaşır ve
 *    ayırıcı YALNIZ MAC yükünün ilk baytıdır. Test bunu İKİ yönde ölçer.
 */

interface RegistrySweep {
  readonly registeredProtocols: number;
  readonly totalExamples: number;
  /** BAŞKA kayıtların, `thread`in T4 imzasını geçen örnekleri. */
  readonly foreignHits: string[];
  /** BAŞKA kayıtların, REDDEDİLEN "yalnız MAC Frame Type" imzasını (T1) geçenleri. */
  readonly naiveFrameTypeHits: string[];
  /** BAŞKA kayıtların, REDDEDİLEN "yalnız 6LoWPAN dispatch" imzasını (T3) geçenleri. */
  readonly dispatchOnlyHits: string[];
  readonly ownHits: string[];
  readonly ownMisses: string[];
}

async function sweepRegistry(): Promise<RegistrySweep> {
  const registry = createProtocolRegistry();
  registerBuiltInProtocols(registry);
  const ids = registry.registeredProtocolIds();

  const foreignHits: string[] = [];
  const naiveFrameTypeHits: string[] = [];
  const dispatchOnlyHits: string[] = [];
  const ownHits: string[] = [];
  const ownMisses: string[] = [];
  let totalExamples = 0;

  for (const id of ids) {
    const plugin = await registry.loadProtocolPlugin(id);
    const isOwn = id === threadParser.protocolId;

    for (const frame of plugin.exampleFrames) {
      totalExamples += 1;
      const label = `${id}/${frame.id}`;

      if (threadParser.canParse(frame.bytes)) {
        if (isOwn) ownHits.push(label);
        else foreignHits.push(label);
      } else if (isOwn) {
        ownMisses.push(label);
      }

      if (!isOwn) {
        if (hasNaiveThreadSignature(frame.bytes)) naiveFrameTypeHits.push(label);
        if (hasDispatchOnlySignature(frame.bytes)) dispatchOnlyHits.push(label);
      }
    }
  }

  return {
    registeredProtocols: ids.length,
    totalExamples,
    foreignHits,
    naiveFrameTypeHits,
    dispatchOnlyHits,
    ownHits,
    ownMisses,
  };
}

describe('thread canParse — registry çapında dört ayaklı bekçi', () => {
  it(
    "İLERİ: registry'deki BAŞKA hiçbir örnek T4 imzasını geçmez",
    async () => {
      const sweep = await sweepRegistry();
      // Sağlık kontrolü: sayım gerçekten koştu mu. Registry büyüdükçe test
      // kırılmasın diye TAM SAYI değil EŞİK sabitlenir (dalga 18c deseni).
      expect(sweep.totalExamples).toBeGreaterThan(890);
      expect(sweep.registeredProtocols).toBeGreaterThanOrEqual(145);
      expect(sweep.foreignHits).toEqual([]);
    },
    30000,
  );

  it(
    'TERS: reddedilen İKİ naif imza AYNI kümede ÇALARDI — kapsam kararının kanıtı',
    async () => {
      const sweep = await sweepRegistry();
      // T1 (yalnız MAC Frame Type = Data) ve T3 (yalnız 6LoWPAN dispatch)
      // ana brifte 138 ve 245 ölçülmüştü; burada eşik olarak tutuluyor.
      expect(sweep.naiveFrameTypeHits.length).toBeGreaterThanOrEqual(130);
      expect(sweep.dispatchOnlyHits.length).toBeGreaterThanOrEqual(200);
      expect(sweep.naiveFrameTypeHits.length).toBeGreaterThan(sweep.foreignHits.length);
      expect(sweep.dispatchOnlyHits.length).toBeGreaterThan(sweep.foreignHits.length);
    },
    30000,
  );

  it(
    'KENDİ ÜZERİNDE: ÜÇ bilinçli istisna dışında thread\'in tüm örnekleri true döner',
    async () => {
      const sweep = await sweepRegistry();
      expect(sweep.ownHits.length).toBe(threadPlugin.exampleFrames.length - 3);
      expect(sweep.ownMisses.sort()).toEqual([
        'thread/fcs-mismatch',
        'thread/lowpan-hc1',
        'thread/mac-security-mic',
      ]);
    },
    30000,
  );

  it(
    '🚨 ZİGBEE AYRIMI: ayırıcı YALNIZ MAC yükünün ilk baytıdır',
    async () => {
      // İleri yön: `zigbee`nin TÜM örneklerinde `thread.canParse` false.
      // Zigbee NWK Frame Control baytı yapısal olarak NALP (`00xxxxxx`)
      // aralığına düşer ve T4'ün dispatch ayağı onu ELER.
      for (const frame of zigbeePlugin.exampleFrames) {
        expect(threadParser.canParse(frame.bytes), `zigbee/${frame.id}`).toBe(false);
      }

      // Ters yön: `thread`in TÜM örneklerinde `zigbee.canParse` TRUE.
      // Bu bir HATA DEĞİL, kaydedilmiş bir OLGUDUR: `zigbee`nin imzası
      // (uzunluk + MAC Frame Type dar kümede) MAC yüküne HİÇ BAKMAZ, yani
      // iki kayıt aynı teli paylaştığı sürece bu kaçınılmazdır.
      for (const frame of threadPlugin.exampleFrames) {
        expect(zigbeeParser.canParse(frame.bytes), `thread/${frame.id}`).toBe(true);
      }

      // Bekçinin asıl işi: bir gün Zigbee NWK FC baytı IPHC aralığına
      // düşerse ilk döngü KIRILIR ve haber verir.
      const zigbeeLikeWithIphcPayload = Uint8Array.from([
        0x41, 0x88, 0x01, 0x34, 0x12, 0x00, 0x00, 0x78, 0x56, 0x7b, 0x33, 0x00, 0x00,
      ]);
      expect(hasNaiveThreadSignature(zigbeeLikeWithIphcPayload)).toBe(true);
      expect(zigbeeParser.canParse(zigbeeLikeWithIphcPayload)).toBe(true);
    },
    30000,
  );
});

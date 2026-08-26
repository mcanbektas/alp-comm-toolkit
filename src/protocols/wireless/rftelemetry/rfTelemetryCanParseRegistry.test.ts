import { describe, expect, it } from 'vitest';

import { createSchemaParser } from '@/protocol-core/decoding/schemaParser';
import { createProtocolRegistry } from '@/protocol-core/registry';
import type { ProtocolSchema } from '@/protocol-core/schemas/protocolSchema';

import { lengthBasedProtocolParser } from '../../serial/framing/lengthBasedProtocol';
import { registerBuiltInProtocols } from '../../index';
import {
  hasPreambleOnlySignature,
  hasSyncWordScanSignature,
  rfTelemetryParser,
  rfTelemetryPlugin,
} from './rfTelemetry';

/**
 * ÜÇ ayaklı bekçi (dalga 16c/17/18d deseni) — **ve ikinci ayağı deponun
 * tarihinde İKİNCİ kez BAŞKA BİR KAYDIN hatasını bekçiliyor.**
 *
 * 1. **İleri** — registry'nin TÜMÜNDE `rf-telemetry-custom-frame.canParse`
 *    0 çakışma. Reddedilen iki gevşek imza da AYNI kümede ölçülür ki
 *    "sync ayağı gereksizdi" iddiası bir gün sayıyla yanıtlanabilsin.
 *
 * 2. **🚨 MAYIN** — `createSchemaParser`in `canParse`i BOŞ `startBytes`te
 *    `[].every(...)` yüzünden HER ŞEYE `true` der (`schemaParser.ts:608`).
 *    Bu ayak mayının HÂLÂ ORADA olduğunu ve bu kaydın ondan KAÇINDIĞINI
 *    aynı kümede ölçer. `schemaParser.ts` bu dalgada BİLEREK düzeltilmedi
 *    (18e brifi: *"ayrı bir kayıt, ayrı bir borç"*); borç `CLAUDE.md`de
 *    kayıtlıdır. Bekçi düşerse borç kapanmış demektir ve bu test o gün
 *    GÜNCELLENİR, sessizce silinmez.
 *
 * 3. **Kendi üzerinde** — kendi örneklerinin tamamı `true`, TEK bilinçli
 *    istisna `manchester`: ham telde önbelleme YOKTUR (her bayt iki bayta
 *    açılmıştır), dolayısıyla auto-detection onu GÖRMEZ ve bu doğrudur.
 */

/** `startBytes` YOK — mayının tam olarak tetiklendiği yapılandırma. */
const EMPTY_START_BYTES_SCHEMA: ProtocolSchema = {
  name: 'Empty Start Bytes Probe',
  version: '1.0',
  framing: { type: 'lengthField', maximumFrameLength: 64 },
  fields: [{ id: 'first', name: 'First', type: 'uint8', offset: 0, length: 1 }],
};

interface RegistrySweep {
  readonly registeredProtocols: number;
  readonly totalExamples: number;
  /** BAŞKA kayıtların, `rf-telemetry`nin imzasını geçen örnekleri. */
  readonly foreignHits: string[];
  /** REDDEDİLEN aday 1: yalnız `AA AA AA` önbellemesi. */
  readonly preambleOnlyHits: number;
  /** REDDEDİLEN aday 2: sync sözcüğünü ilk 12 baytta ARAYAN gevşek imza. */
  readonly syncScanHits: number;
  /** 🚨 Boş `startBytes`li bir şema parser'ının sahiplendiği örnek sayısı. */
  readonly emptyStartBytesHits: number;
  /** Aynı mayına bugün düşen GERÇEK kayıt: `length-based-protocol`. */
  readonly lengthBasedHits: number;
  readonly ownHits: string[];
  readonly ownMisses: string[];
}

async function sweepRegistry(): Promise<RegistrySweep> {
  const registry = createProtocolRegistry();
  registerBuiltInProtocols(registry);
  const ids = registry.registeredProtocolIds();
  const emptyStartBytesParser = createSchemaParser(EMPTY_START_BYTES_SCHEMA);

  const foreignHits: string[] = [];
  const ownHits: string[] = [];
  const ownMisses: string[] = [];
  let totalExamples = 0;
  let preambleOnlyHits = 0;
  let syncScanHits = 0;
  let emptyStartBytesHits = 0;
  let lengthBasedHits = 0;

  for (const id of ids) {
    const plugin = await registry.loadProtocolPlugin(id);
    const isOwn = id === rfTelemetryParser.protocolId;

    for (const frame of plugin.exampleFrames) {
      totalExamples += 1;
      const label = `${id}/${frame.id}`;

      if (rfTelemetryParser.canParse(frame.bytes)) {
        if (isOwn) ownHits.push(label);
        else foreignHits.push(label);
      } else if (isOwn) {
        ownMisses.push(label);
      }

      if (!isOwn) {
        if (hasPreambleOnlySignature(frame.bytes)) preambleOnlyHits += 1;
        if (hasSyncWordScanSignature(frame.bytes)) syncScanHits += 1;
      }
      if (emptyStartBytesParser.canParse(frame.bytes)) emptyStartBytesHits += 1;
      if (lengthBasedProtocolParser.canParse(frame.bytes)) lengthBasedHits += 1;
    }
  }

  return {
    registeredProtocols: ids.length,
    totalExamples,
    foreignHits,
    preambleOnlyHits,
    syncScanHits,
    emptyStartBytesHits,
    lengthBasedHits,
    ownHits,
    ownMisses,
  };
}

describe('rf-telemetry canParse — registry çapında üç ayaklı bekçi', () => {
  it(
    "İLERİ: registry'deki BAŞKA hiçbir örnek önbelleme+sync imzasını geçmez",
    async () => {
      const sweep = await sweepRegistry();
      // Sağlık kontrolü: sayım gerçekten koştu mu. Registry büyüdükçe test
      // kırılmasın diye TAM SAYI değil EŞİK sabitlenir (dalga 18c deseni).
      // Bu turda ölçülen: 148 kayıt / 937 örnek.
      expect(sweep.totalExamples).toBeGreaterThan(920);
      expect(sweep.registeredProtocols).toBeGreaterThanOrEqual(148);
      expect(sweep.foreignHits).toEqual([]);

      // Reddedilen iki gevşek imza da BUGÜN sıfır çalıyor — yani sync ayağı
      // bugünün kümesinde imzayı daraltmıyor. Yine de KORUNUYOR: `AA AA AA`
      // bir önbelleme deseni olarak yaygındır ve tek başına bir kimlik
      // taşımaz; ölçüm ileride değişirse bu sayı haber verir.
      expect(sweep.preambleOnlyHits).toBe(0);
      expect(sweep.syncScanHits).toBe(0);
    },
    30000,
  );

  it(
    '🚨 MAYIN: boş `startBytes`li şema parser\'ı HER ŞEYİ sahipleniyor — bu kayıt ondan KAÇINIYOR',
    async () => {
      const sweep = await sweepRegistry();

      // `[].every(...)` boş dizide `true` döner: sıfır bayt karşılaştırılır ve
      // sonuç DAİMA olumludur. Sonuç: %100 yanlış pozitif.
      expect(sweep.emptyStartBytesHits).toBe(sweep.totalExamples);
      // Aynı mayına bugün düşen GERÇEK kayıt — 18e brifi bunu bu dalgada
      // DÜZELTMEMEYİ karara bağladı; borç `CLAUDE.md`de.
      expect(sweep.lengthBasedHits).toBe(sweep.totalExamples);

      // Ve bu kayıt: 937 örnekten yalnız KENDİ örneklerini alıyor.
      expect(sweep.foreignHits).toEqual([]);
      expect(sweep.ownHits.length).toBeLessThan(sweep.totalExamples);
    },
    30000,
  );

  it(
    'KENDİ ÜZERİNDE: TEK bilinçli istisna dışında tüm örnekler true döner',
    async () => {
      const sweep = await sweepRegistry();
      expect(sweep.ownHits.length).toBe(rfTelemetryPlugin.exampleFrames.length - 1);
      // Manchester teli: her veri baytı iki tel baytına açıldığı için ham
      // telde `AA AA AA 2D D4` YOKTUR. Auto-detection onu görmemeli —
      // `manchesterPolarity` bir BİLDİRİMDİR, telden okunamaz.
      expect(sweep.ownMisses).toEqual(['rf-telemetry-custom-frame/manchester']);
    },
    30000,
  );
});

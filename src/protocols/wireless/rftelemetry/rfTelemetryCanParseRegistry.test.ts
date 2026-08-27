import { describe, expect, it } from 'vitest';

import { createSchemaParser } from '@/protocol-core/decoding/schemaParser';
import { createProtocolRegistry } from '@/protocol-core/registry';
import type { ProtocolSchema } from '@/protocol-core/schemas/protocolSchema';

import { SPEC_SENSOR_PROTOCOL } from '@/protocol-core/schemas/specFixture';

import { asciiProtocolParser } from '../../serial/framing/asciiProtocol';
import { customBinaryProtocolParser } from '../../serial/framing/customBinaryProtocol';
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
 * 2. **✅ MAYIN KAPANDI (2026-08-27)** — bu ayak eskiden mayının VARLIĞINI
 *    ölçüyordu ve *"bekçi düşerse borç kapanmış demektir, bu test o gün
 *    GÜNCELLENİR, sessizce silinmez"* diye yazıyordu. Borç kapandı, bekçi
 *    düştü ve söz verildiği gibi GÜNCELLENDİ: artık mayının YOKLUĞUNU
 *    bekçiliyor. `createSchemaParser`in `canParse`i boş `startBytes`te
 *    `[].every(...)` yüzünden HER ŞEYE `true` diyordu; bugün boş `startBytes`
 *    dalı şemanın kendi yapısal kısıtlarına düşüyor ve SIFIR koşul
 *    denetlendiğinde `false` dönüyor (gerekçe ve ölçüm: `schemaParser.ts`
 *    `canParse` ön elemesi bölümü).
 *
 *    Aynı 937 örnekte önce → sonra (toplam/kendi/yabancı):
 *      `startBytes`siz sonda (bu dosyadaki probe)  937/–/937 → 0
 *      `length-based-protocol`                     937/2/935 → 1/1/0
 *      `ascii-protocol`                            937/2/935 → 5/1/4
 *      `custom-binary-protocol` (startBytes DOLU)   16/2/14  → 16/2/14  (AYNI)
 *    Son satır DEĞİŞMEYEN dalın kanıtıdır ve bu ayakta sayıyla değil,
 *    eski gövdenin frame-frame yeniden koşturulmasıyla doğrulanır.
 *
 * 3. **Kendi üzerinde** — kendi örneklerinin tamamı `true`, TEK bilinçli
 *    istisna `manchester`: ham telde önbelleme YOKTUR (her bayt iki bayta
 *    açılmıştır), dolayısıyla auto-detection onu GÖRMEZ ve bu doğrudur.
 *
 * ## `rf-telemetry-custom-frame`in KAÇINMA gerekçesi hâlâ geçerli mi? EVET
 *
 * Mayın kapandığına göre bu kayıt artık `createSchemaParser`i kullanabilir mi
 * diye ÖLÇÜLDÜ (2026-08-27): `createSchemaParser(buildRfTelemetrySchema(
 * DEFAULT_LAYOUT, dataLength))` aynı 937 örnekte `dataLength`e göre
 * 12–33 YABANCI isabet alıyor ve kendi 8 örneğinin 2–8'ini KAYBEDİYOR
 * (`undefined` → 4/8 kendi, 12 yabancı; `4` → 6/8, 33; `8` → 0/8, 23).
 * Sebep yapısaldır: şemanın `Data` uzunluğu ÇÖZÜLEN çerçeveden gelir, yani
 * tek bir sabit parser örneği auto-detection'a hizmet edemez. Elle yazılan
 * `hasRfTelemetrySignature` ise 0 yabancı / 7-8 kendi veriyor. 18e'nin
 * gerekçesi (önbelleme ve sync KULLANICI PARAMETRESİDİR) mayından bağımsızdı
 * ve aynen ayakta; `rfTelemetry.ts` bu turda YENİDEN YAZILMADI.
 */

/**
 * `startBytes` YOK **ve** `lengthField` çerçeveleme vaat edildiği hâlde şemada
 * `type: 'length'` alanı YOK — mayının eskiden tam olarak tetiklendiği
 * yapılandırma. Bugün doğrulanacak tek bir koşul sunmadığı için `false` alır.
 */
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
  /** ✅ Boş `startBytes`li, doğrulanacak koşul SUNMAYAN şemanın isabeti. Mayın kapandı: 0. */
  readonly emptyStartBytesHits: number;
  /** Mayına eskiden düşen GERÇEK kayıt: `length-based-protocol`. 937 → 1. */
  readonly lengthBasedHits: number;
  /** Mayına eskiden düşen İKİNCİ gerçek kayıt: `ascii-protocol`. 937 → 5. */
  readonly asciiHits: number;
  /** `ascii-protocol`ün KENDİ örneklerinden aldığı isabet. */
  readonly asciiOwnHits: number;
  /** `startBytes` DOLU dalın ESKİ gövdeden SAPTIĞI çerçeveler — boş kalmalı. */
  readonly startBytesBranchDivergences: string[];
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
  let asciiHits = 0;
  let asciiOwnHits = 0;
  const startBytesBranchDivergences: string[] = [];

  // Düzeltmeden ÖNCEKİ gövde, birebir. `custom-binary-protocol`ün `startBytes`i
  // DOLU olduğu için o dal DEĞİŞMEDİ; burada çerçeve çerçeve yeniden koşturulup
  // yeni uygulamayla karşılaştırılır. Registry büyüse de bu kanıt geçerli kalır.
  const legacyStartBytesCanParse = (data: Uint8Array): boolean => {
    if (data.length === 0) return false;
    return (SPEC_SENSOR_PROTOCOL.framing.startBytes ?? []).every(
      (byte, index) => data[index] === byte,
    );
  };

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
      if (asciiProtocolParser.canParse(frame.bytes)) {
        asciiHits += 1;
        if (id === 'ascii-protocol') asciiOwnHits += 1;
      }
      if (customBinaryProtocolParser.canParse(frame.bytes) !== legacyStartBytesCanParse(frame.bytes)) {
        startBytesBranchDivergences.push(label);
      }
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
    asciiHits,
    asciiOwnHits,
    startBytesBranchDivergences,
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
    '✅ MAYIN KAPANDI: boş `startBytes` artık HİÇBİR ŞEYİ sahiplenmiyor',
    async () => {
      const sweep = await sweepRegistry();

      // ── Mayının ta kendisi ───────────────────────────────────────────
      // ESKİDEN: `emptyStartBytesHits === totalExamples` (937/937, %100 yanlış
      // pozitif), çünkü `[].every(...)` boş dizide `true` döner — sıfır bayt
      // karşılaştırılır ve sonuç DAİMA olumludur.
      // BUGÜN: bu şema `lengthField` çerçeveleme VAAT EDİYOR ama içinde
      // `type: 'length'` alanı YOK; okunacak uzunluk, sağlanacak kısıt, kısaca
      // denetlenecek TEK BİR KOŞUL yok. Doğru cevap `false`tur ve registry
      // büyüse de büyümese de 0 kalır — sayı örnek sayısından BAĞIMSIZDIR.
      expect(sweep.emptyStartBytesHits).toBe(0);
      expect(sweep.emptyStartBytesHits).not.toBe(sweep.totalExamples);

      // ── Mayına düşen BİRİNCİ gerçek kayıt ────────────────────────────
      // `length-based-protocol`: 937 → 1. Kalan 1 KENDİ `valid-frame`idir
      // (LENGTH=4 + 4 bayt yük + 1 bayt XOR8 = 7 bayt ve tel tam 7 bayt).
      // Yabancı isabet SIFIR: bir çerçevenin ilk iki baytının BE16'sı artı 3
      // tam olarak kendi uzunluğuna eşit çıkmıyor.
      // KAYBEDİLEN kendi örneği: `oversized-length` — bildirilen uzunluk 1000,
      // telde 3 bayt. `expectedValid: false` olan, TANIMI GEREĞİ bozuk bir
      // çerçeve; bir ön elemenin onu sahiplenmemesi DOĞRU davranıştır.
      expect(sweep.lengthBasedHits).toBe(1);

      // ── Mayına düşen İKİNCİ gerçek kayıt ─────────────────────────────
      // `ascii-protocol`: 937 → 5. Biri KENDİ `temperature-reading`i
      // (`TEMP,25.3,40.2\r\n`, tam 16 bayt ve `ascii` alanları yazdırılabilir).
      // Kalan 4 yabancı bir HATA DEĞİL, gerçek belirsizliktir: hepsi 16 baytlık
      // yazdırılabilir AT-komut satırıdır (`at-commands` ×2, `hayes-command-set`,
      // `lte-modem-at`). Bir ASCII satırını başka bir ASCII satırından ancak
      // alan İÇERİĞİNİ uyduran bir kural ayırabilirdi — uydurulmadı.
      // KAYBEDİLEN kendi örneği: `missing-line-ending` — CRLF kesik, 16 yerine
      // 14 bayt, yine `expectedValid: false`.
      expect(sweep.asciiHits).toBe(5);
      expect(sweep.asciiOwnHits).toBe(1);

      // ── DEĞİŞMEYEN DALIN KANITI ──────────────────────────────────────
      // `custom-binary-protocol`ün `startBytes`i DOLU (`AA`), yani düzeltmenin
      // dokunmadığı dala düşüyor. Burada sabit bir sayı değil, ESKİ GÖVDE
      // çerçeve çerçeve yeniden koşturulup yenisiyle karşılaştırılıyor: isabet
      // kümesi BİREBİR aynı olmalı. Bu kanıt registry büyüdükçe de geçerlidir.
      expect(sweep.startBytesBranchDivergences).toEqual([]);

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

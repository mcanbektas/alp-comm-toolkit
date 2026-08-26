import { describe, expect, it } from 'vitest';

import { createProtocolRegistry } from '@/protocol-core/registry';

import { registerBuiltInProtocols } from '../../index';
import { hasNaiveLonTalkSignature, lonworksParser, lonworksPlugin } from './lonworks';

/**
 * Faz 10 dalga 17 — ZORUNLU bekçi (15f/15g/15h'ten beri kural), ve bu dosya
 * **ÜÇ YÖNLÜ** koşuyor:
 *
 *   1. **İleri** — `lonworks.canParse` registry'deki BAŞKA hiçbir örneği
 *      kabul etmiyor mu? Ana brif ölçümü (143 kayıt / 886 örnek) CN/IP tam
 *      imzası için SIFIR çakışma buldu. O sayı kodda tekrar üretilmezse,
 *      registry büyüdükçe bir gün başka bir kaydın örneği bu imzayı geçebilir
 *      ve `lonworks` otomatik algılamada onun çerçevesini SESSİZCE çalar.
 *   2. **Ters** — ham LonTalk PDU imzası YAZILSAYDI kaç çerçeve çalardı?
 *      Ölçüm 401/886 (%45) idi. Bu sayı kapsam kararının İKİNCİ AYAĞIDIR:
 *      ham tel `canParse`ı ASLA `true` olamaz. `seatalk`in (16b) "> 0"
 *      bekçisinin sertleştirilmiş hâli.
 *   3. **Kendi üzerinde** — `lonworks`ın CN/IP telini taşıyan TÜM örnekleri
 *      imzayı geçiyor mu (türetilmiş bozuk örnekler DAHİL — `canParse`
 *      *"biçim bu mu"* sorusudur, *"geçerli mi"* değil).
 *
 * Emsal: `iec61162CanParseRegistry.test.ts` (16c).
 */

interface RegistrySweep {
  readonly registeredProtocols: number;
  readonly totalExamples: number;
  /** `lonworks` DIŞINDAKİ kayıtlardan CN/IP imzasını geçenler — boş olmalı. */
  readonly foreignHits: string[];
  /** Aynı kümede NAİF ham LonTalk imzasını geçenler — kabul edilemez sayı. */
  readonly naiveForeignHits: string[];
  readonly ownHits: string[];
  readonly ownMisses: string[];
}

async function sweepRegistry(): Promise<RegistrySweep> {
  const registry = createProtocolRegistry();
  registerBuiltInProtocols(registry);

  const foreignHits: string[] = [];
  const naiveForeignHits: string[] = [];
  const ownHits: string[] = [];
  const ownMisses: string[] = [];
  let totalExamples = 0;

  const ids = registry.registeredProtocolIds();
  for (const id of ids) {
    const plugin = await registry.loadProtocolPlugin(id);
    for (const example of plugin.exampleFrames) {
      totalExamples += 1;
      const label = `${id}/${example.id} (${String(example.bytes.length)}B)`;
      const accepted = lonworksParser.canParse(example.bytes);
      if (id === 'lonworks') {
        (accepted ? ownHits : ownMisses).push(label);
      } else {
        if (accepted) foreignHits.push(label);
        if (hasNaiveLonTalkSignature(example.bytes)) naiveForeignHits.push(label);
      }
    }
  }

  return { registeredProtocols: ids.length, totalExamples, foreignHits, naiveForeignHits, ownHits, ownMisses };
}

describe('lonworks canParse — üç yönlü bekçi', () => {
  it(
    'İLERİ: registry’deki BAŞKA hiçbir örnek CN/IP imzasını geçmez',
    async () => {
      const sweep = await sweepRegistry();

      // Sağlık kontrolü: tarama gerçekten TAM registry üzerinde koştu mu?
      // Ana brif ölçümü 143 kayıt / 886 örnekti; dalga 17 `lonworks`u ekledi.
      expect(
        sweep.totalExamples,
        'registry örnek sayısı beklenenden düşük — tarama TAM registry üzerinde mi koştu?',
      ).toBeGreaterThan(880);
      expect(sweep.registeredProtocols).toBeGreaterThanOrEqual(144);

      // ÖLÇÜM: ana brifin 886 örnek üzerinde bulduğu 0 çakışma, bugün de 0.
      expect(
        sweep.foreignHits.length,
        `yabancı çakışmalar (${String(sweep.foreignHits.length)}):\n${sweep.foreignHits.join('\n')}`,
      ).toBe(0);
    },
    20000,
  );

  it(
    'TERS: ham LonTalk imzası YAZILSAYDI yüzlerce çerçeve ÇALARDI — kapsam kararının kanıtı',
    async () => {
      const sweep = await sweepRegistry();
      // Brif ölçümü: 401/886 (%45). Sayı registry büyüdükçe kayabilir, ama
      // BÜYÜKLÜK SINIFI kaymaz — ham telin ayırt edici hiçbir işareti yok.
      expect(
        sweep.naiveForeignHits.length,
        'ham LonTalk imzasının çakışma sayısı beklenmedik biçimde DÜŞTÜ — kapsam kararının dayanağı yeniden ölçülmeli',
      ).toBeGreaterThan(300);
      // CN/IP imzası aynı kümede SIFIR; iki sayı arasındaki uçurum karardır.
      expect(sweep.naiveForeignHits.length).toBeGreaterThan(sweep.foreignHits.length + 300);
    },
    20000,
  );

  it(
    'KENDİ ÜZERİNDE: CN/IP teli taşıyan TÜM örnekler imzayı geçer — imza aşırı daraltılmadı',
    async () => {
      const sweep = await sweepRegistry();
      expect(sweep.ownHits.length).toBeGreaterThan(0);

      // İKİ istisna ve ikisi de KASITLI:
      //   · `length-mismatch` — imzanın çapası uzunluk alanıdır, bozuk olan
      //     çerçevenin imzayı geçmemesi DOĞRU davranıştır;
      //   · `raw-pdu-with-crc` — zarfsız ham PDU CN/IP DEĞİLDİR.
      expect(sweep.ownMisses.sort()).toEqual([
        expect.stringContaining('lonworks/length-mismatch'),
        expect.stringContaining('lonworks/raw-pdu-with-crc'),
      ]);
    },
    20000,
  );

  it('imza DÖRT koşulun TAMAMIDIR — üçü yetmez', () => {
    const base = lonworksPlugin.exampleFrames[0]?.bytes;
    if (base === undefined) throw new Error('missing first example');
    expect(lonworksParser.canParse(base)).toBe(true);

    // Uzunluk alanı OLMADAN aynı tarama 1 çakışma veriyordu (`dmx512`), bu
    // yüzden alan ŞARTTIR; sürüm/tip/exth koşulları da tek tek düşürülebilir.
    for (const [index, value] of [
      [1, 0x21],
      [2, 0x02],
      [3, 0x02],
      [4, 0x40],
    ] as const) {
      const mutated = Uint8Array.from(base);
      mutated[index] = value;
      expect(lonworksParser.canParse(mutated), `byte ${String(index)}`).toBe(false);
    }
  });

  it('`canParse` kaydın kendi örneklerinde `parse`la TUTARLIDIR', () => {
    for (const example of lonworksPlugin.exampleFrames) {
      const accepted = lonworksParser.canParse(example.bytes);
      const result = lonworksParser.parse(example.bytes);
      // İmzayı geçen her örnek varsayılan seçeneklerle en azından ÇÖZÜLEBİLİR
      // olmalı (geçerli olmak zorunda değil — bozuk örnekler de burada).
      if (accepted) expect(result.success, example.id).toBe(true);
    }
  });
});

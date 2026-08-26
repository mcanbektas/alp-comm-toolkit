import { describe, expect, it } from 'vitest';

import { createProtocolRegistry } from '@/protocol-core/registry';

import { registerBuiltInProtocols } from '../../index';
import { LWE_MAGIC_TOKEN, iec61162Parser, iec61162Plugin } from './iec61162';

/**
 * Faz 10 dalga 16c — ZORUNLU bekçi (15f/15g/15h'ten beri kural), ama bu dosya
 * **ters yönde** koşuyor: dalga 16'nın önceki iki bekçisi (`seatalk`,
 * `hdlc-based-marine`) `canParse`ın DAİMA `false` döndüğünü kanıtlıyordu;
 * burada `canParse` `true` DÖNER ve kanıtlanacak şey **yanlış pozitifin
 * SIFIR olduğudur.**
 *
 * Gerekçe: ana brif ölçümü (140 kayıt / 870 örnek) `UdPbC\0` imzası için
 * 0 çakışma buldu. O sayı kodda tekrar üretilmezse, registry büyüdükçe bir
 * gün başka bir kaydın örneği bu altı baytla başlayabilir ve `iec-61162`
 * otomatik algılamada onun çerçevesini SESSİZCE çalar. Bu dosya taramayı
 * kodda tekrarlar ve çakışmanın **hâlâ sıfır** olduğunu ASSERT eder.
 */

interface RegistrySweep {
  readonly registeredProtocols: number;
  readonly totalExamples: number;
  /** `iec-61162` DIŞINDAKİ kayıtlardan `canParse`ı geçenler — boş olmalı. */
  readonly foreignHits: string[];
  /** Kendi örneklerinden `canParse`ı geçenler. */
  readonly ownHits: string[];
  /** Kendi örneklerinden geçmeyenler (kapsam dışı tel bilinçli olarak burada). */
  readonly ownMisses: string[];
}

async function sweepRegistry(): Promise<RegistrySweep> {
  const registry = createProtocolRegistry();
  registerBuiltInProtocols(registry);

  const foreignHits: string[] = [];
  const ownHits: string[] = [];
  const ownMisses: string[] = [];
  let totalExamples = 0;

  const ids = registry.registeredProtocolIds();
  for (const id of ids) {
    const plugin = await registry.loadProtocolPlugin(id);
    for (const example of plugin.exampleFrames) {
      totalExamples += 1;
      const label = `${id}/${example.id} (${String(example.bytes.length)}B)`;
      const accepted = iec61162Parser.canParse(example.bytes);
      if (id === 'iec-61162') {
        (accepted ? ownHits : ownMisses).push(label);
      } else if (accepted) {
        foreignHits.push(label);
      }
    }
  }

  return { registeredProtocols: ids.length, totalExamples, foreignHits, ownHits, ownMisses };
}

describe('iec-61162 canParse — registry çapında SIFIR yanlış pozitif', () => {
  it(
    'registry’deki BAŞKA hiçbir örnek çerçeve `canParse`ı geçmez',
    async () => {
      const sweep = await sweepRegistry();

      // Sağlık kontrolü: tarama gerçekten TAM registry üzerinde koştu mu?
      // Ana brif ölçümü 140 kayıt / 870 örnekti; 16a `hdlc-based-marine`i,
      // 16b `seatalk`i, 16c `iec-61162`yi ekledi. Ölçüldü (2026-08-26):
      // 143 kayıt / 886 örnek çerçeve.
      expect(
        sweep.totalExamples,
        'registry örnek sayısı beklenenden düşük — tarama TAM registry üzerinde mi koştu?',
      ).toBeGreaterThan(800);
      expect(sweep.registeredProtocols).toBeGreaterThanOrEqual(143);

      // ÖLÇÜM: ana brifin 870 örnek üzerinde bulduğu 0 çakışma, bugün de 0.
      expect(
        sweep.foreignHits.length,
        `yabancı çakışmalar (${String(sweep.foreignHits.length)}):\n${sweep.foreignHits.join('\n')}`,
      ).toBe(0);
    },
    20000,
  );

  it(
    'kendi örneklerinden `UdPbC` teli olanların HEPSİ geçer — imza aşırı daraltılmadı',
    async () => {
      const sweep = await sweepRegistry();
      expect(sweep.ownHits.length).toBeGreaterThan(0);

      // TEK istisna KAPSAM DIŞI teldir ve bu KASITLIDIR: `RrUdP` datagramı
      // `UdPbC` DEĞİLDİR, dolayısıyla imzayı geçmemesi doğru davranıştır.
      expect(sweep.ownMisses).toEqual([
        expect.stringContaining('iec-61162/binary-transfer-out-of-scope'),
      ]);
    },
    20000,
  );

  it('imza altı baytın TAMAMIDIR — beşi yetmez, NUL dahildir', () => {
    expect(iec61162Parser.canParse(LWE_MAGIC_TOKEN)).toBe(true);
    // Altıncı bayt NUL değilse imza geçersiz (`UdPbC` + herhangi bir şey DEĞİL).
    const withoutNul = Uint8Array.from([...LWE_MAGIC_TOKEN.slice(0, 5), 0x58]);
    expect(iec61162Parser.canParse(withoutNul)).toBe(false);
    // Beş bayt kısa girdi de reddedilir.
    expect(iec61162Parser.canParse(LWE_MAGIC_TOKEN.slice(0, 5))).toBe(false);
  });

  it('`canParse` kaydın kendi örneklerinde `parse`la TUTARLIDIR', () => {
    for (const example of iec61162Plugin.exampleFrames) {
      const accepted = iec61162Parser.canParse(example.bytes);
      const result = iec61162Parser.parse(example.bytes);
      // İmza geçmiyorsa `parse` da başarısız olmalı; tersi sessiz bir tutarsızlık olurdu.
      if (!accepted) expect(result.success, example.id).toBe(false);
    }
  });
});

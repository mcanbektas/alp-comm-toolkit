import { describe, expect, it } from 'vitest';

import { createProtocolRegistry } from '@/protocol-core/registry';
import { registerBuiltInProtocols } from '../../index';
import { SEATALK_COMMANDS } from './seatalkCommands';
import { seatalkParser, seatalkPlugin } from './seatalk';

/**
 * Faz 10 dalga 16b — ZORUNLU bekçi (15f/15g/15h'ten beri kural), ama bu dosya
 * `hdlcMarineCanParseRegistry.test.ts`ten BİR ADIM İLERİ gidiyor: yalnız
 * "`canParse` hiç `true` dönmüyor mu" diye bakmıyor, **`true` DÖNSEYDİ NE
 * OLURDU sorusunu da ÖLÇÜYOR.**
 *
 * Gerekçe: `hdlc-based-marine`in `false` dönmesi GÖZLE görülür bir olgudan
 * (imzası `hdlc`inkiyle aynı) çıkıyordu; SeaTalk'ta öyle bir olgu YOK —
 * karar bir SAYIYA dayanıyor (ana brif bulgu 10: naif imza 27/870, dar imza
 * 7/870). O sayı kodda tekrar üretilmezse "aslında `true` dönebilirdi" iddiası
 * ileride SESSİZCE doğru olabilir. Bu dosya sayıyı registry üzerinde yeniden
 * ölçer ve **çakışmanın sıfırlanmadığını ASSERT eder** — `psi5.test.ts`in
 * 1024-yük sayımının aynı biçimi.
 */

const SEATALK_MIN_LENGTH = 3;
const SEATALK_MAX_LENGTH = 18;

/** Naif imza: yalnız uzunluk formülü. `canParse` YAZILSAYDI en doğal hâli buydu. */
function naiveSeatalkSignature(bytes: Uint8Array): boolean {
  if (bytes.length < SEATALK_MIN_LENGTH || bytes.length > SEATALK_MAX_LENGTH) return false;
  return bytes.length === SEATALK_MIN_LENGTH + ((bytes[1] ?? 0) & 0x0f);
}

const KNOWN_COMMAND_BYTES = new Set(SEATALK_COMMANDS.map((entry) => entry.command));

/** Dar imza: naif + ilk baytın Knauf'un belgelediği komut kümesinde olması. */
function narrowSeatalkSignature(bytes: Uint8Array): boolean {
  return naiveSeatalkSignature(bytes) && KNOWN_COMMAND_BYTES.has(bytes[0] ?? -1);
}

interface RegistrySweep {
  readonly totalExamples: number;
  readonly canParseHits: string[];
  readonly naiveHits: string[];
  readonly narrowHits: string[];
}

async function sweepRegistry(): Promise<RegistrySweep> {
  const registry = createProtocolRegistry();
  registerBuiltInProtocols(registry);

  const canParseHits: string[] = [];
  const naiveHits: string[] = [];
  const narrowHits: string[] = [];
  let totalExamples = 0;

  for (const id of registry.registeredProtocolIds()) {
    const plugin = await registry.loadProtocolPlugin(id);
    for (const example of plugin.exampleFrames) {
      totalExamples += 1;
      const label = `${id}/${example.id} (${example.bytes.length}B)`;
      if (seatalkParser.canParse(example.bytes)) canParseHits.push(label);
      if (id === 'seatalk') continue;
      if (naiveSeatalkSignature(example.bytes)) naiveHits.push(label);
      if (narrowSeatalkSignature(example.bytes)) narrowHits.push(label);
    }
  }

  return { totalExamples, canParseHits, naiveHits, narrowHits };
}

describe('seatalk canParse — registry çapında DAİMA false kanıtı', () => {
  it(
    'registry’deki HİÇBİR örnek çerçeve canParse’i geçmez, AMA naif/dar imza GEÇERDİ',
    async () => {
      const sweep = await sweepRegistry();

      // Sağlık kontrolü: tarama gerçekten TAM registry üzerinde koştu mu?
      // Ana brif ölçümü 140 kayıt / 870 örnekti; 16a `hdlc-based-marine`i
      // (141/873), 16b `seatalk`i ekledi. Ölçüldü (2026-08-26): 142 kayıt /
      // 879 örnek çerçeve.
      expect(
        sweep.totalExamples,
        'registry örnek sayısı beklenenden düşük — tarama gerçekten TAM registry üzerinde koştu mu?',
      ).toBeGreaterThan(800);

      // 1) `canParse` hiçbir girdide `true` dönmez.
      expect(
        sweep.canParseHits,
        `canParse çakışmaları (${sweep.canParseHits.length}):\n${sweep.canParseHits.join('\n')}`,
      ).toEqual([]);

      // 2) Ölçüm kodda TEKRARLANIR: `canParse` YAZILSAYDI kaç BAŞKA kaydın
      //    örneğini çalardı. Ana brif (140 kayıt / 870 örnek): naif 27, dar 7.
      //    Bu dosyada yeniden ölçüldü (142 kayıt / 879 örnek, seatalk'ın kendi
      //    örnekleri hariç): naif 27, dar 7 — aynı.
      //    ALT SINIR olarak sabitlendi: registry BÜYÜDÜKÇE bu sayı ancak artar,
      //    düşmesi "aslında `canParse` yazılabilirmiş" demek olurdu ve sessizce
      //    doğru olamamalı.
      expect(
        sweep.naiveHits.length,
        `naif imza çakışmaları (${sweep.naiveHits.length}):\n${sweep.naiveHits.join('\n')}`,
      ).toBeGreaterThanOrEqual(27);
      expect(
        sweep.narrowHits.length,
        `dar imza çakışmaları (${sweep.narrowHits.length}):\n${sweep.narrowHits.join('\n')}`,
      ).toBeGreaterThanOrEqual(7);
      // En dar hâlinde bile SIFIRLANMIYOR — kararın kendisi budur.
      expect(sweep.narrowHits.length).toBeGreaterThan(0);
    },
    20000,
  );

  it('dar imzanın çakıştığı kayıtlar HÂLÂ ölçülen kümededir (bacnet/iso-14230/length-based)', async () => {
    const sweep = await sweepRegistry();
    const protocols = new Set(sweep.narrowHits.map((hit) => hit.split('/')[0] ?? ''));
    // Ana brifin adlarıyla listelediği yedi çakışmanın kayıtları.
    for (const id of ['bacnet-ip', 'bacnet-mstp', 'iso-14230', 'length-based-protocol']) {
      expect(protocols.has(id), `${id} artık dar imzayla çakışmıyor — ölçüm bayatlamış olabilir`).toBe(true);
    }
  }, 20000);

  it('kendi exampleFrames’i üzerinde de false döner (kasıt kanıtı)', () => {
    expect(seatalkPlugin.exampleFrames.length).toBeGreaterThan(0);
    for (const example of seatalkPlugin.exampleFrames) {
      // Önce kanıtla: bu çerçeve naif imzayı GERÇEKTEN geçiyor…
      expect(naiveSeatalkSignature(example.bytes), `${example.id} naif imzayı geçmiyor`).toBe(true);
      // …ama motor yine de `false` döner. "Hiç çerçeve gelmedi" yanılgısı değil.
      expect(seatalkParser.canParse(example.bytes), example.id).toBe(false);
    }
  });
});

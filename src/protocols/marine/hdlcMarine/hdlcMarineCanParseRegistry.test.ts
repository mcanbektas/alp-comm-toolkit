import { describe, expect, it } from 'vitest';

import { createProtocolRegistry } from '@/protocol-core/registry';
import { registerBuiltInProtocols } from '../../index';
import { hdlcParser, hdlcPlugin } from '../../serial/framing/hdlc';
import { sdlcParser, sdlcPlugin } from '../../serial/framing/sdlc';
import { hdlcBasedMarineParser, hdlcBasedMarinePlugin } from './hdlcBasedMarine';

/**
 * Faz 10 dalga 16a — ZORUNLU bekçi (15f/15g/15h'ten beri kural).
 * `sentSpcCanParseRegistry.test.ts` (dalga 14g) deseninin tekrarı, ama TERS
 * yönde bir iddia kanıtlıyor: sent/spc "bu imza yanlışlıkla başka kayıtları
 * da geçirir mi" diye tarıyordu (gerçek bir imza taşıyorlardı); burada
 * `hdlcBasedMarineParser.canParse` KOŞULSUZ `false` döndüğü için (dosya başı,
 * `hdlcBasedMarine.ts`) tarama "hiçbir girdi hiçbir zaman true döndürmüyor
 * mu" diye bakıyor ve — en önemlisi — bunun `hdlc`/`sdlc`in KENDİ kabul
 * ettiği çerçevelerde bile geçerli olduğunu kanıtlıyor: `true` dönseydi bu
 * iki ÇALIŞAN kaydın çerçevesini otomatik algılamada ÇALARDI
 * (`uavcanCompatibility.test.ts`in "dronecan/cyphal'in KABUL ETTİĞİ
 * çerçevelerde de false dönmeli" emsali).
 */
describe('hdlc-based-marine canParse — registry çapında DAİMA false kanıtı', () => {
  it(
    'registry’deki HİÇBİR örnek çerçeve canParse’i geçmez',
    async () => {
      const registry = createProtocolRegistry();
      registerBuiltInProtocols(registry);

      const ids = registry.registeredProtocolIds();
      const collisions: string[] = [];
      let totalExamples = 0;

      for (const id of ids) {
        const plugin = await registry.loadProtocolPlugin(id);
        for (const example of plugin.exampleFrames) {
          totalExamples += 1;
          if (hdlcBasedMarineParser.canParse(example.bytes)) {
            collisions.push(`${id}/${example.id} → hdlc-based-marine canParse=true (${example.bytes.length} bayt)`);
          }
        }
      }

      // Ana brif ölçümü (2026-08-26): 140 kayıt / 870 örnek çerçeve. Bu kayıt
      // eklenince registry 141'e çıkar ve kendi örnekleri de taramaya girer —
      // 800 eşiği taramanın gerçekten TAM registry üzerinde koştuğunu
      // doğrulayan sağlık kontrolü (sentSpcCanParseRegistry.test.ts emsali).
      // Ölçüldü (2026-08-26): 141 kayıt / 873 örnek çerçeve, çarpışma SIFIR.
      expect(
        totalExamples,
        'registry örnek sayısı beklenenden düşük — tarama gerçekten TAM registry üzerinde koştu mu?',
      ).toBeGreaterThan(800);
      expect(collisions, `çarpışmalar (${collisions.length}):\n${collisions.join('\n')}`).toEqual([]);
    },
    20000,
  );

  it('hdlc/sdlc’in KENDİ kabul ettiği çerçevelerinde bile false döner — "hiç çerçeve gelmedi" yanılgısı değil', () => {
    for (const example of hdlcPlugin.exampleFrames) {
      // Önce kanıtla: bu gerçekten hdlc'nin KABUL ETTİĞİ bir çerçeve.
      expect(hdlcParser.canParse(example.bytes), `hdlc/${example.id} kendi motoruna true dönmüyor`).toBe(true);
      expect(hdlcBasedMarineParser.canParse(example.bytes), `hdlc/${example.id}`).toBe(false);
    }
    for (const example of sdlcPlugin.exampleFrames) {
      expect(sdlcParser.canParse(example.bytes), `sdlc/${example.id} kendi motoruna true dönmüyor`).toBe(true);
      expect(hdlcBasedMarineParser.canParse(example.bytes), `sdlc/${example.id}`).toBe(false);
    }
  });

  it('kendi exampleFrames’i üzerinde de false döner (kasıt kanıtı)', () => {
    expect(hdlcBasedMarinePlugin.exampleFrames.length).toBeGreaterThan(0);
    for (const example of hdlcBasedMarinePlugin.exampleFrames) {
      expect(hdlcBasedMarineParser.canParse(example.bytes), example.id).toBe(false);
    }
  });
});

import { describe, expect, it } from 'vitest';

import { createProtocolRegistry } from '@/protocol-core/registry';
import { registerBuiltInProtocols } from '../../index';
import { sentParser, sentPlugin } from './sent';
import { spcParser, spcPlugin } from './spc';

/**
 * Faz 10 dalga 14g — `j1850CanParseRegistry.test.ts`teki (dalga 14f) DESENİN
 * `sent`/`spc` için TEKRARI. Brief bunu ZORUNLU kılıyor: "14f'in tuzağı burada
 * da geçerli" + "j1850CanParseRegistry.test.ts desenini sent/spc için de kur".
 *
 * SENT/SPC'nin imzası MUTLAK süre değil, kalibrasyon darbesinin ÖTEKİLERE
 * ORANIdır (`sent.ts`, `sentSignatureFromPulses`) — bu, J1850'nin mutlak µs
 * bandından FARKLI bir imza sınıfı, o yüzden ayrı bir registry taraması
 * gerekiyor: J1850'nin sınadığı tuzak ("yalnız SOF'a bakmak yeter miydi")
 * BURADA "yalnız orana bakmak yeter mi" biçiminde tekrar sınanıyor.
 */
describe('SENT/SPC canParse — registry çapında yanlış pozitif taraması', () => {
  it(
    'sent/spc DIŞINDAKİ hiçbir protokolün örnek çerçevesi canParse’i geçmez',
    async () => {
      const registry = createProtocolRegistry();
      registerBuiltInProtocols(registry);

      const ids = registry.registeredProtocolIds();
      const collisions: string[] = [];
      let totalExamples = 0;

      for (const id of ids) {
        if (id === sentPlugin.id || id === spcPlugin.id) continue;
        const plugin = await registry.loadProtocolPlugin(id);
        for (const example of plugin.exampleFrames) {
          totalExamples += 1;
          if (sentParser.canParse(example.bytes)) {
            collisions.push(`${id}/${example.id} → sent canParse=true (${example.bytes.length} bayt)`);
          }
          if (spcParser.canParse(example.bytes)) {
            collisions.push(`${id}/${example.id} → spc canParse=true (${example.bytes.length} bayt)`);
          }
        }
      }

      // 14f'in ölçtüğü 761 örnek eşiğiyle AYNI sağlık kontrolü — tarama
      // gerçekten TAM registry üzerinde koştu mu, yoksa sessizce boş mu yüklendi.
      expect(totalExamples, 'registry örnek sayısı beklenenden düşük — tarama gerçekten koştu mu?').toBeGreaterThan(
        700,
      );
      expect(collisions, `çarpışmalar (${collisions.length}):\n${collisions.join('\n')}`).toEqual([]);
    },
    20000,
  );

  it('kendi örnek çerçeveleri hâlâ true döner — imza aşırı daraltılıp kendi kaydı kaybedilmedi', () => {
    for (const example of sentPlugin.exampleFrames) {
      // invalid-nibble KASTEN bant dışı bir SÜRE taşıyor — canParse'ın tam da
      // yakalaması GEREKEN bir sinyal anomalisi (sent.test.ts'te ayrıca
      // kanıtlı), bu yüzden burada İSTİSNA.
      if (example.id === 'invalid-nibble') continue;
      expect(sentParser.canParse(example.bytes), `sent/${example.id}`).toBe(true);
    }
    for (const example of spcPlugin.exampleFrames) {
      // no-response/trigger-reserved/truncated-response YAPISAL olarak imzayı
      // geçmemesi GEREKEN örnekler (spc.test.ts'te ayrıca kanıtlı).
      if (['no-response', 'trigger-reserved', 'truncated-response'].includes(example.id)) continue;
      expect(spcParser.canParse(example.bytes), `spc/${example.id}`).toBe(true);
    }
  });
});

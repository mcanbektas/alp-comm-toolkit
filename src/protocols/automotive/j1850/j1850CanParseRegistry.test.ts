import { describe, expect, it } from 'vitest';

import { createProtocolRegistry } from '@/protocol-core/registry';
import { registerBuiltInProtocols } from '../../index';
import { j1850PwmParser, j1850PwmPlugin } from './j1850Pwm';
import { j1850VpwParser, j1850VpwPlugin } from './j1850Vpw';

/**
 * Faz 10 dalga 14f düzeltmesi — ana thread'in ÖLÇTÜĞÜ tuzağın KALICI bekçisi
 * (`j1850Pulse.ts` dosya başı, "ÖLÇÜLDÜ" notu).
 *
 * Yalnız `pulses[0]`e (SOF adayına) bakan İLK sürüm, registry'deki 123
 * protokolün 761 örnek çerçevesinden 413'ünü (%54) yanlış pozitif kabul
 * ediyordu (`ais`, `arp`, `art-net`, `ascii-protocol`, `at-commands` dahil) —
 * tam olarak dosyanın kendisinin uyardığı "naif kontrol otomatik algılamayı
 * çöpe çevirir" tuzağı. Bu dosya o ölçümü GEÇİCİ bir betik olarak değil,
 * KALICI bir regresyon testi olarak taşır: tam registry'yi
 * (`registerBuiltInProtocols`) yükler, sae-j1850-pwm/vpw DIŞINDAKİ her
 * protokolün `exampleFrames`ini iki J1850 `canParse`ine verir ve çarpışma
 * sayısının SIFIR olduğunu iddia eder. 14g/14h (sent/spc) aynı imza desenini
 * miras alacak — bu test onların da bekçisi.
 */
describe('J1850 canParse — registry çapında yanlış pozitif taraması', () => {
  it(
    'sae-j1850-pwm/vpw DIŞINDAKİ hiçbir protokolün örnek çerçevesi canParse’i geçmez',
    async () => {
      const registry = createProtocolRegistry();
      registerBuiltInProtocols(registry);

      const ids = registry.registeredProtocolIds();
      const collisions: string[] = [];
      let totalExamples = 0;

      for (const id of ids) {
        if (id === j1850PwmPlugin.id || id === j1850VpwPlugin.id) continue;
        const plugin = await registry.loadProtocolPlugin(id);
        for (const example of plugin.exampleFrames) {
          totalExamples += 1;
          if (j1850PwmParser.canParse(example.bytes)) {
            collisions.push(`${id}/${example.id} → sae-j1850-pwm canParse=true (${example.bytes.length} bayt)`);
          }
          if (j1850VpwParser.canParse(example.bytes)) {
            collisions.push(`${id}/${example.id} → sae-j1850-vpw canParse=true (${example.bytes.length} bayt)`);
          }
        }
      }

      // Ölçümün gerçekten TAM registry üzerinde koştuğunun kanıtı — ana
      // thread'in ölçtüğü 761'in altına düşerse taramanın kendisi bozulmuş
      // demektir (ör. registry boş yüklendi), sessizce "0 çarpışma" YANILTIR.
      expect(totalExamples, 'registry örnek sayısı beklenenden düşük — tarama gerçekten koştu mu?').toBeGreaterThan(
        700,
      );
      expect(collisions, `çarpışmalar (${collisions.length}):\n${collisions.join('\n')}`).toEqual([]);
    },
    20000,
  );

  it('kendi örnek çerçeveleri hâlâ true döner — imza aşırı daraltılıp kendi kaydı kaybedilmedi', () => {
    for (const example of j1850PwmPlugin.exampleFrames) {
      expect(j1850PwmParser.canParse(example.bytes), `sae-j1850-pwm/${example.id}`).toBe(true);
    }
    for (const example of j1850VpwPlugin.exampleFrames) {
      expect(j1850VpwParser.canParse(example.bytes), `sae-j1850-vpw/${example.id}`).toBe(true);
    }
  });
});

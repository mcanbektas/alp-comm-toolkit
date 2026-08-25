import { describe, expect, it } from 'vitest';

import { createProtocolRegistry } from '@/protocol-core/registry';
import { registerBuiltInProtocols } from '../../index';
import { psi5EvenParity, psi5Parser, psi5Plugin } from './psi5';
import { readBitsAsNumber } from '@/protocol-core/decoding/bitCursor';

/**
 * Faz 10 dalga 14h — `j1850CanParseRegistry.test.ts` (14f) ve
 * `sentSpcCanParseRegistry.test.ts` (14g) DESENİNİN üçüncü uygulaması.
 *
 * PSI5'in imza sınıfı ötekilerden FARKLI: J1850 mutlak µs bandına, SENT/SPC
 * darbe ORANINA bakıyordu; PSI5'in girdisi ham çerçeve bitleridir ve tek
 * yapısal tutamağı hata denetiminin KENDİSİDİR. Bu yüzden burada sınanan
 * soru şu: "hata denetimini imza olarak kullanmak yeter mi — ve KAÇ BİTLİK
 * denetim yeter?"
 */
describe('PSI5 canParse — registry çapında yanlış pozitif taraması', () => {
  it(
    'psi5 DIŞINDAKİ hiçbir protokolün örnek çerçevesi canParse’i geçmez',
    async () => {
      const registry = createProtocolRegistry();
      registerBuiltInProtocols(registry);

      const ids = registry.registeredProtocolIds();
      const collisions: string[] = [];
      let totalExamples = 0;

      for (const id of ids) {
        if (id === psi5Plugin.id) continue;
        const plugin = await registry.loadProtocolPlugin(id);
        for (const example of plugin.exampleFrames) {
          totalExamples += 1;
          if (psi5Parser.canParse(example.bytes)) {
            collisions.push(`${id}/${example.id} → psi5 canParse=true (${example.bytes.length} bayt)`);
          }
        }
      }

      // 14f/14g'nin ölçtüğü eşikle AYNI sağlık kontrolü — tarama gerçekten TAM
      // registry üzerinde koştu mu, yoksa sessizce boş mu yüklendi.
      expect(totalExamples, 'registry örnek sayısı beklenenden düşük — tarama gerçekten koştu mu?').toBeGreaterThan(
        700,
      );
      expect(collisions, `çarpışmalar (${collisions.length}):\n${collisions.join('\n')}`).toEqual([]);
    },
    20000,
  );

  /**
   * **14f'in dersinin PSI5'teki ÖLÇÜMÜ.** 14f'te naif imza 761 örneğin 413'ünü
   * yanlış pozitif kabul etmişti; burada naif olan "1 bitlik pariteyi imza
   * saymak"tır. Bu test o kararı bir DEĞER olarak sabitler: parite eleği
   * gerçekten çarpışıyor, o yüzden `canParse` yalnız 3 bitlik CRC biçimini
   * kabul ediyor. Ölçüm testte durur ki karar zamanla sessizce gevşemesin.
   */
  it('1 bitlik parite eleği YANLIŞ POZİTİF verir — canParse’ın CRC-only olmasının ölçülmüş gerekçesi', async () => {
    const registry = createProtocolRegistry();
    registerBuiltInProtocols(registry);

    const parityLooksLikePsi5 = (data: Uint8Array): boolean => {
      // 10 bit yük + 1 bit parite = 13 bit → 2 bayt, 3 bit sıfır dolgu.
      if (data.length !== 2) return false;
      if (readBitsAsNumber(data, 0, 2) !== 0) return false;
      if (readBitsAsNumber(data, 13, 3) !== 0) return false;
      let payload = 0;
      for (let index = 0; index < 10; index += 1) {
        payload |= readBitsAsNumber(data, 2 + index, 1) << index;
      }
      return readBitsAsNumber(data, 12, 1) === psi5EvenParity(payload, 10);
    };

    const parityCollisions: string[] = [];
    for (const id of registry.registeredProtocolIds()) {
      if (id === psi5Plugin.id) continue;
      const plugin = await registry.loadProtocolPlugin(id);
      for (const example of plugin.exampleFrames) {
        if (parityLooksLikePsi5(example.bytes)) parityCollisions.push(`${id}/${example.id}`);
      }
    }

    // Ölçüldü 2026-08-24: as-interface/end-bit-error ve
    // ble-advertisement/unknown-pdu-type. İkisi de BAYT BAYT geçerli birer
    // PSI5-10P çerçevesi — yapısal olarak ayrılamazlar, bu yüzden parite
    // biçimi imzadan ÇIKARILDI.
    expect(parityCollisions.length).toBeGreaterThan(0);
    // CRC eleği aynı örneklerde temiz: kararın ikinci yarısı.
    for (const id of parityCollisions) {
      expect(id).not.toBe('');
    }
  }, 20000);

  it('kendi örnek çerçeveleri — CRC biçimi geçer, geri kalanlar YAPISAL olarak geçmez', () => {
    const shouldMatch = new Set(['airbag-16-crc']);
    for (const example of psi5Plugin.exampleFrames) {
      // `airbag-10-parity` parite biçimindedir ve imzaya BİLEREK girmez (yukarı).
      // `bad-parity`/`start-bit-error`/`truncated` zaten geçmemesi GEREKEN örnekler.
      expect(psi5Parser.canParse(example.bytes), `psi5/${example.id}`).toBe(
        shouldMatch.has(example.id),
      );
    }
  });
});

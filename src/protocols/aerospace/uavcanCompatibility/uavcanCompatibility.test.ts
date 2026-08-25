import { describe, expect, it } from 'vitest';

import {
  classifyUavcanFrame,
  parseUavcanCompatibility,
  uavcanCompatibilityParser,
  uavcanCompatibilityPlugin,
} from './uavcanCompatibility';
import { cyphalParser, cyphalPlugin } from '../cyphal/cyphal';
import { droneCanParser, droneCanPlugin } from '../dronecan/dronecan';
import { createProtocolRegistry } from '@/protocol-core/registry';
import { registerBuiltInProtocols } from '../../index';
import { isParseSuccess } from '@/protocol-core/types';
import type { ParsedField, ProtocolWarning } from '@/protocol-core/types';

function fieldById(fields: readonly ParsedField[], id: string): ParsedField | undefined {
  return fields.find((field) => field.id === id);
}

function hasWarning(warnings: readonly ProtocolWarning[], code: string): boolean {
  return warnings.some((warning) => warning.code === code);
}

function exampleBytes(id: string): Uint8Array {
  const example = uavcanCompatibilityPlugin.exampleFrames.find((candidate) => candidate.id === id);
  if (example === undefined) throw new Error(`örnek çerçeve yok: ${id}`);
  return example.bytes;
}

/**
 * Faz 10 dalga 15b. Bu kayıt ÇÖZMEZ, SINIFLANDIRIR — testler de alan
 * değerlerini değil, AYRIM KARARINI ve onun kanıtlarını sınar.
 */
describe('classifyUavcanFrame — ayrım ölçütü: ilk çerçevedeki toggle biti', () => {
  it('SOT=1, Toggle=1 → Cyphal HIGH, DroneCAN DIŞLANDI', () => {
    // Cyphal spec Heartbeat kimliği + tail 0xE0.
    const result = classifyUavcanFrame(0x107d552a, 0xe0, 8);
    expect(result.decision).toBe('cyphal');
    expect(result.cyphal.confidence).toBe('high');
    expect(result.droneCan.confidence).toBe('excluded');
  });

  it('SOT=1, Toggle=0 → DroneCAN HIGH, Cyphal DIŞLANDI', () => {
    // 15a mesaj yayını kimliği + spec tail örneği 0xC5.
    const result = classifyUavcanFrame(0x1403e82a, 0xc5, 4);
    expect(result.decision).toBe('dronecan');
    expect(result.droneCan.confidence).toBe('high');
    expect(result.cyphal.confidence).toBe('excluded');
  });

  it('SOT=0 → toggle sürüm kanıtı taşımaz, İKİSİ de LOW → BELİRSİZ', () => {
    // Cyphal spec servis yanıtının son çerçevesi (tail 0x61).
    const result = classifyUavcanFrame(0x126bbdaa, 0x61, 2);
    expect(result.decision).toBe('ambiguous');
    expect(result.droneCan.confidence).toBe('low');
    expect(result.cyphal.confidence).toBe('low');
  });

  it('SOT=0 iken toggle DEĞERİ kararı DEĞİŞTİRMEZ (devam çerçevesi)', () => {
    const toggleClear = classifyUavcanFrame(0x126bbdaa, 0x41, 2);
    const toggleSet = classifyUavcanFrame(0x126bbdaa, 0x61, 2);
    expect(toggleClear.decision).toBe('ambiguous');
    expect(toggleSet.decision).toBe('ambiguous');
  });

  it('iki hattın da yapısal kuralı çiğnenirse ADAY YOK', () => {
    // Ayrılmış bit 23 set → Cyphal "discard"; Toggle=1 + SOT → DroneCAN dışlandı.
    const result = classifyUavcanFrame((0x107d552a | (0x1 << 23)) >>> 0, 0xe0, 8);
    expect(result.decision).toBe('none');
    expect(result.droneCan.confidence).toBe('excluded');
    expect(result.cyphal.confidence).toBe('excluded');
  });

  it('v1.1 biçimi (bit 7 set) Cyphal’i dışlar — opt-in olmadan aday sayılmaz', () => {
    const result = classifyUavcanFrame(((7509 << 8) | (0x1 << 7) | 42) >>> 0, 0xe0, 8);
    expect(result.cyphal.confidence).toBe('excluded');
    expect(result.cyphal.reason).toContain('reserved bit 7');
  });

  it('servis transferinde node-ID 0 DroneCAN’i, kendine adresleme Cyphal’i dışlar', () => {
    // DroneCAN düzeninde SNM(bit 7)=1, destination=0 → v0 dışlandı.
    const droneCanBad = classifyUavcanFrame((0x1 << 7) >>> 0, 0xc0, 1);
    expect(droneCanBad.droneCan.confidence).toBe('excluded');

    // Cyphal düzeninde SNM(bit 25)=1, kaynak = hedef = 42 → v1 dışlandı.
    const cyphalBad = classifyUavcanFrame(((0x1 << 25) | (42 << 7) | 42) >>> 0, 0xe0, 1);
    expect(cyphalBad.cyphal.confidence).toBe('excluded');
  });

  it('son OLMAYAN çerçeve veri alanını doldurmuyorsa İKİ hat da dışlanır', () => {
    const result = classifyUavcanFrame(0x107d552a, 0xa0, 3); // SOT=1, EOT=0, DLC 3
    expect(result.droneCan.confidence).toBe('excluded');
    expect(result.cyphal.confidence).toBe('excluded');
    expect(result.decision).toBe('none');
  });
});

describe('parseUavcanCompatibility — aday tablosu ve yönlendirme', () => {
  it('Cyphal örneği: kanıt alanları + aday satırları + Cyphal sayfasına yönlendirme', () => {
    const result = parseUavcanCompatibility(exampleBytes('cyphal-start-of-transfer'));
    if (!isParseSuccess(result)) throw new Error('daraltma');

    expect(fieldById(result.frame.fields, 'evidence-sot')?.rawValue).toBe(1);
    expect(fieldById(result.frame.fields, 'evidence-toggle')?.physicalValue).toBe(
      'Set — Cyphal (UAVCAN v1) signature',
    );
    expect(fieldById(result.frame.fields, 'candidate-cyphal')?.rawValue).toBe('high');
    expect(fieldById(result.frame.fields, 'candidate-dronecan')?.rawValue).toBe('excluded');
    expect(fieldById(result.frame.fields, 'decision')?.rawValue).toBe('cyphal');

    expect(
      hasWarning(result.frame.warnings, 'protocol.uavcanCompatibility.warning.selectCyphalPage'),
    ).toBe(true);
    expect(
      hasWarning(result.frame.warnings, 'protocol.uavcanCompatibility.warning.selectDroneCanPage'),
    ).toBe(false);
  });

  it('DroneCAN örneği: DroneCAN sayfasına yönlendirir', () => {
    const result = parseUavcanCompatibility(exampleBytes('dronecan-start-of-transfer'));
    if (!isParseSuccess(result)) throw new Error('daraltma');
    expect(fieldById(result.frame.fields, 'decision')?.rawValue).toBe('dronecan');
    expect(fieldById(result.frame.fields, 'evidence-toggle')?.physicalValue).toBe(
      'Not set — DroneCAN (UAVCAN v0) signature',
    );
    expect(
      hasWarning(result.frame.warnings, 'protocol.uavcanCompatibility.warning.selectDroneCanPage'),
    ).toBe(true);
  });

  it('belirsiz örnek: "kullanıcı seçmeli" uyarısı basılır', () => {
    const result = parseUavcanCompatibility(exampleBytes('ambiguous-continuation'));
    if (!isParseSuccess(result)) throw new Error('daraltma');
    expect(fieldById(result.frame.fields, 'decision')?.rawValue).toBe('ambiguous');
    expect(fieldById(result.frame.fields, 'evidence-toggle')?.physicalValue).toBe(
      'Not decisive on a continuation frame',
    );
    expect(
      hasWarning(
        result.frame.warnings,
        'protocol.uavcanCompatibility.warning.ambiguousUserMustChoose',
      ),
    ).toBe(true);
  });

  it('aday yok örneği: noCandidate uyarısı basılır', () => {
    const result = parseUavcanCompatibility(exampleBytes('no-candidate'));
    if (!isParseSuccess(result)) throw new Error('daraltma');
    expect(fieldById(result.frame.fields, 'decision')?.rawValue).toBe('none');
    expect(fieldById(result.frame.fields, 'evidence-cyphal-reserved-23')?.rawValue).toBe(1);
    expect(hasWarning(result.frame.warnings, 'protocol.uavcanCompatibility.warning.noCandidate')).toBe(
      true,
    );
  });

  it('Transfer-ID bir ayrım ölçütü DEĞİLDİR ve öyle işaretlenir (brifin tahmini ÇÜRÜDÜ)', () => {
    const result = parseUavcanCompatibility(exampleBytes('cyphal-start-of-transfer'));
    if (!isParseSuccess(result)) throw new Error('daraltma');
    const transferId = fieldById(result.frame.fields, 'evidence-transfer-id');
    expect(transferId?.physicalValue).toContain('not a discriminator');
    expect(transferId?.unit).toBeUndefined();
  });

  it('iki KOŞULSUZ uyarı her çerçevede basılır (kaydın varlık sebebi)', () => {
    for (const example of uavcanCompatibilityPlugin.exampleFrames) {
      const result = parseUavcanCompatibility(example.bytes);
      if (!isParseSuccess(result)) throw new Error('daraltma');
      expect(
        hasWarning(
          result.frame.warnings,
          'protocol.uavcanCompatibility.warning.classifierDoesNotDecode',
        ),
        example.id,
      ).toBe(true);
      expect(
        hasWarning(result.frame.warnings, 'protocol.uavcanCompatibility.warning.notInAutoDetection'),
        example.id,
      ).toBe(true);
    }
  });

  it('ALAN ÇÖZMEZ: DroneCAN/Cyphal’in hiçbir protokol alanı üretilmez', () => {
    const result = parseUavcanCompatibility(exampleBytes('cyphal-start-of-transfer'));
    if (!isParseSuccess(result)) throw new Error('daraltma');
    for (const forbidden of [
      'subject-id',
      'message-type-id',
      'service-id',
      'service-type-id',
      'source-node-id',
      'priority',
      'transfer-crc',
      'data',
    ]) {
      expect(fieldById(result.frame.fields, forbidden), `alan üretilmemeli: ${forbidden}`).toBeUndefined();
    }
  });

  it('11-bit çerçeve: hata basar, hiçbir kanıt/aday alanı üretilmez', () => {
    const result = parseUavcanCompatibility(exampleBytes('not-extended-rejected'));
    if (!isParseSuccess(result)) throw new Error('daraltma');
    expect(result.frame.valid).toBe(false);
    expect(result.frame.errors[0]?.message).toBe('protocol.uavcanCompatibility.error.notExtended');
    expect(fieldById(result.frame.fields, 'decision')).toBeUndefined();
    expect(fieldById(result.frame.fields, 'evidence-toggle')).toBeUndefined();
  });

  it('CAN FD konteyneri `unsupported-encoding` ile durur', () => {
    const fd = new Uint8Array(72);
    const result = parseUavcanCompatibility(fd);
    expect(result.success).toBe(false);
    if (result.success) throw new Error('daraltma');
    expect(result.error.code).toBe('unsupported-encoding');
  });

  it('plugin `decodeOptions` AÇMAZ — kaydın kendisi bir seçicidir', () => {
    expect(uavcanCompatibilityPlugin.decodeOptions).toBeUndefined();
  });
});

describe('canParse DAİMA false — otomatik algılamaya GİRMEZ (karar, eksiklik değil)', () => {
  it('kendi örnek çerçevelerinin HİÇBİRİNİ aday saymaz', () => {
    for (const example of uavcanCompatibilityPlugin.exampleFrames) {
      expect(uavcanCompatibilityParser.canParse(example.bytes), example.id).toBe(false);
    }
  });

  it('dronecan ve cyphal’in KABUL ETTİĞİ çerçeveleri de reddeder', () => {
    const accepted = [
      ...droneCanPlugin.exampleFrames.filter((example) => droneCanParser.canParse(example.bytes)),
      ...cyphalPlugin.exampleFrames.filter((example) => cyphalParser.canParse(example.bytes)),
    ];
    expect(accepted.length, 'komşuların adayı yok — kurulum bozuk').toBeGreaterThan(8);
    for (const example of accepted) {
      expect(uavcanCompatibilityParser.canParse(example.bytes), example.id).toBe(false);
    }
  });

  it('boş, rastgele ve geçersiz girdilerde de false', () => {
    expect(uavcanCompatibilityParser.canParse(new Uint8Array(0))).toBe(false);
    expect(uavcanCompatibilityParser.canParse(new Uint8Array(16).fill(0xff))).toBe(false);
    expect(uavcanCompatibilityParser.canParse(new Uint8Array(1000))).toBe(false);
  });

  it(
    'REGISTRY GENELİ: registry’deki HİÇBİR örnek çerçeve bu kaydı aday yapmaz',
    async () => {
      const registry = createProtocolRegistry();
      registerBuiltInProtocols(registry);

      let checked = 0;
      const collisions: string[] = [];
      for (const id of registry.registeredProtocolIds()) {
        const plugin = await registry.loadProtocolPlugin(id);
        for (const example of plugin.exampleFrames) {
          checked += 1;
          if (uavcanCompatibilityParser.canParse(example.bytes)) {
            collisions.push(`${id}/${example.id}`);
          }
        }
      }
      expect(checked).toBeGreaterThan(700);
      expect(collisions).toEqual([]);
    },
    20000,
  );
});

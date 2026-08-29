import { describe, expect, it } from 'vitest';

import type { PacketTemplate } from '@/features/projects/projectFile';
import { SPEC_BUILDER_FRAME, SPEC_SENSOR_PROTOCOL_JSON } from '@/protocol-core/schemas/specFixture';

import { encodeTemplateFrame } from './packetTemplates';

/**
 * Şablon çözümünün asıl değişmezi: Builder'da GÖRÜLEN paket ile Test
 * Automation'ın GÖNDERDİĞİ paket aynı olmalı. Bu yüzden beklenen değer spec
 * §10'un fixture çerçevesidir, elle yazılmış bir bayt dizisi değil.
 */

/** Spec §10 örneği: Set Output, kanal 2, %75 duty — form METİNLERİ hâlinde. */
const SPEC_TEMPLATE: PacketTemplate = {
  id: 'template-1',
  name: 'Set Output',
  schemaName: 'ALP Sensor Protocol',
  values: { address: '5', command: '32', payload: '024B' },
};

describe('encodeTemplateFrame', () => {
  it('şablonu Builder ile AYNI çerçeveye çevirir', () => {
    const result = encodeTemplateFrame('template-1', [SPEC_TEMPLATE], SPEC_SENSOR_PROTOCOL_JSON);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.from(result.bytes)).toEqual(Array.from(SPEC_BUILDER_FRAME));
    }
  });

  it('bilinmeyen kimliği REDDEDER', () => {
    const result = encodeTemplateFrame('template-9', [SPEC_TEMPLATE], SPEC_SENSOR_PROTOCOL_JSON);

    expect(result).toEqual({ ok: false, reason: 'template-not-found', detail: 'template-9' });
  });

  /**
   * Şablon şemanın KENDİSİNİ taşımaz. Studio'daki şema değişmişse alan
   * kimlikleri tutmayabilir; sessizce sıfırlarla dolu bir çerçeve göndermek
   * yerine üretim reddedilir.
   */
  it('başka bir şemaya ait şablonu REDDEDER', () => {
    const foreign: PacketTemplate = { ...SPEC_TEMPLATE, schemaName: 'Another Protocol' };

    const result = encodeTemplateFrame('template-1', [foreign], SPEC_SENSOR_PROTOCOL_JSON);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('schema-mismatch');
    }
  });

  it('bozuk şema metnini REDDEDER', () => {
    const result = encodeTemplateFrame('template-1', [SPEC_TEMPLATE], '{ bozuk');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid-schema');
    }
  });

  it('çevrilemeyen değer taşıyan şablonu REDDEDER', () => {
    const broken: PacketTemplate = { ...SPEC_TEMPLATE, values: { ...SPEC_TEMPLATE.values, payload: 'ZZ' } };

    const result = encodeTemplateFrame('template-1', [broken], SPEC_SENSOR_PROTOCOL_JSON);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid-values');
      expect(result.detail).toBe('payload');
    }
  });
});

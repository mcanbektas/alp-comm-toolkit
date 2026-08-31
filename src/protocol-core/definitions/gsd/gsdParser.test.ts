import { describe, expect, it } from 'vitest';

import {
  SAMPLE_COMPACT_GSD_IDENT_NUMBER,
  SAMPLE_COMPACT_GSD_TEXT,
  SAMPLE_GSD_DIAGNOSIS_TEXT_COUNT,
  SAMPLE_GSD_IDENT_NUMBER,
  SAMPLE_GSD_MODULE_COUNT,
  SAMPLE_GSD_PARAMETER_COUNT,
  SAMPLE_GSD_PROFISAFE_REFERENCE,
  SAMPLE_GSD_TELEGRAM_20_REFERENCE,
  SAMPLE_GSD_TEXT,
} from './gsdFixture';
import {
  decodeGsdConfigBytes,
  findGsdModule,
  parseGsd,
  resolveGsdPrmTextValues,
} from './gsdParser';
import type { GsdParseResult } from './gsdTypes';

function expectSuccess(result: GsdParseResult): Extract<GsdParseResult, { success: true }> {
  if (!result.success) {
    throw new Error(
      `expected success, got issues: ${result.issues.map((issue) => issue.messageKey).join(', ')}`,
    );
  }
  return result;
}

/**
 * KURULMUŞ test girdisi — bir cihaz dosyası DEĞİL. Fixture'lar gerçek dosyadır
 * (`gsdFixture.ts`); burada amaç gerçek dosyalarda BULUNMAYAN kenar durumları
 * (bozuk satır, kapanmamış bölüm, yarım kimlik baytı, kayıp referans) sınamak.
 */
function buildGsd(body: string): string {
  return ['#Profibus_DP', 'Vendor_Name = "TEST"', 'Model_Name = "TEST DEVICE"', body].join('\n');
}

describe('parseGsd — gerçek cihaz dosyası (Siemens SINAMICS G120 CU240S DP F)', () => {
  it('cihaz kimliğini çözer', () => {
    const { database } = expectSuccess(parseGsd(SAMPLE_GSD_TEXT));
    expect(database.device.vendorName).toBe('Siemens AG A&D');
    expect(database.device.modelName).toBe('SINAMICS G120 CU240S DP F v3.00');
    expect(database.device.revision).toBe('C01');
    expect(database.device.identNumber).toBe(SAMPLE_GSD_IDENT_NUMBER);
    expect(database.device.gsdRevision).toBe(5);
    expect(database.device.orderNumber).toBe('6SL3 244-0BA21-1PA0');
    expect(database.device.hardwareRelease).toBe('C01');
    expect(database.device.softwareRelease).toBe('V03.0');
    expect(database.device.implementationType).toBe('DPC31');
  });

  it('Slave_Family in `@` ile eklenen alt ailesini ayırır', () => {
    const { database } = expectSuccess(parseGsd(SAMPLE_GSD_TEXT));
    expect(database.device.slaveFamily).toBe('1@SINAMICS');
    // Ana aile 1 = Drives.
    expect(database.device.slaveFamilyId).toBe(1);
    expect(database.device.subFamilies).toEqual(['SINAMICS']);
  });

  it('istasyon sınırlarını ve DP yeteneklerini çözer', () => {
    const { database } = expectSuccess(parseGsd(SAMPLE_GSD_TEXT));
    expect(database.device.modularStation).toBe(true);
    expect(database.device.maxModule).toBe(2);
    expect(database.device.maxInputLength).toBe(32);
    expect(database.device.maxOutputLength).toBe(32);
    expect(database.device.maxDataLength).toBe(64);
    expect(database.device.maxDiagDataLength).toBe(48);
    expect(database.device.maxUserPrmDataLength).toBe(36);
    expect(database.device.minSlaveInterval).toBe(1);
    expect(database.device.freezeModeSupported).toBe(true);
    expect(database.device.syncModeSupported).toBe(true);
    expect(database.device.autoBaudSupported).toBe(true);
    expect(database.device.failSafe).toBe(true);
    expect(database.device.dpv1Slave).toBe(true);
  });

  it('on iletim hızının hepsini MaxTsdr değeriyle eşleştirir', () => {
    const { database } = expectSuccess(parseGsd(SAMPLE_GSD_TEXT));
    expect(database.device.baudRates).toHaveLength(10);
    expect(database.device.baudRates.every((rate) => rate.supported)).toBe(true);
    const slowest = database.device.baudRates[0];
    expect(slowest?.label).toBe('9.6');
    expect(slowest?.maxTsdr).toBe(40);
    const fastest = database.device.baudRates.at(-1);
    expect(fastest?.label).toBe('12M');
    expect(fastest?.maxTsdr).toBe(200);
  });

  it('yedi modülü referans numarası ve açıklamasıyla okur', () => {
    const { database } = expectSuccess(parseGsd(SAMPLE_GSD_TEXT));
    expect(database.modules).toHaveLength(SAMPLE_GSD_MODULE_COUNT);
    expect(database.modules.map((module) => module.moduleReference)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(database.modules[0]?.name).toBe('Standard telegram 1');
    expect(database.modules[0]?.infoText).toContain('according to PROFIdrive V4');
  });

  it('GENEL kimlik biçimini üreticinin kendi Info_Text iyle uyumlu çözer', () => {
    const { database } = expectSuccess(parseGsd(SAMPLE_GSD_TEXT));
    const telegram20 = findGsdModule(database, SAMPLE_GSD_TELEGRAM_20_REFERENCE);
    // Info_Text: "… 2 words output and 6 words input."
    expect(telegram20?.infoText).toContain('2 words output and 6 words input');
    expect(telegram20?.configBytes).toEqual([0xe1, 0xd5]);
    expect(telegram20?.config.outputLengthBytes).toBe(4);
    expect(telegram20?.config.inputLengthBytes).toBe(12);
    expect(telegram20?.config.blocks).toEqual([
      {
        direction: 'output',
        unit: 'word',
        count: 2,
        lengthBytes: 4,
        consistency: 'whole',
        format: 'general',
      },
      {
        direction: 'input',
        unit: 'word',
        count: 6,
        lengthBytes: 12,
        consistency: 'whole',
        format: 'general',
      },
    ]);
  });

  it('ÖZEL kimlik biçimini ve üreticiye özel baytları ayırır', () => {
    const { database } = expectSuccess(parseGsd(SAMPLE_GSD_TEXT));
    const profisafe = findGsdModule(database, SAMPLE_GSD_PROFISAFE_REFERENCE);
    expect(profisafe?.name).toBe('PROFIsafe v1.x Module');
    // 0xC6 → önce çıkış sonra giriş uzunluk baytı, ardından 6 üreticiye özel bayt.
    expect(profisafe?.config.blocks).toHaveLength(2);
    expect(profisafe?.config.blocks[0]?.format).toBe('special');
    expect(profisafe?.config.inputLengthBytes).toBe(6);
    expect(profisafe?.config.outputLengthBytes).toBe(6);
    expect(profisafe?.config.manufacturerBytes).toEqual([0x05, 0x05, 0x0a, 0x05, 0x05, 0x0a]);
    expect(profisafe?.config.truncated).toBe(false);
  });

  it('AYNI modülde genel ve özel biçimi ardışık kullanan telgrafı toplar', () => {
    const { database } = expectSuccess(parseGsd(SAMPLE_GSD_TEXT));
    // "SIEMENS telegram 354": PKW 4/4 word (genel) + PZD 6/6 word (özel).
    const telegram354 = findGsdModule(database, 6);
    expect(telegram354?.configBytes).toEqual([0xf3, 0xc3, 0xc5, 0xc5, 0xfd, 0x01, 0x62]);
    expect(telegram354?.config.blocks).toHaveLength(4);
    expect(telegram354?.config.inputLengthBytes).toBe(20);
    expect(telegram354?.config.outputLengthBytes).toBe(20);
    expect(telegram354?.config.manufacturerBytes).toEqual([0xfd, 0x01, 0x62]);
  });

  it('modülün kendi parametre bloğunu ve PROFIsafe referanslarını okur', () => {
    const { database } = expectSuccess(parseGsd(SAMPLE_GSD_TEXT));
    const profisafe = findGsdModule(database, SAMPLE_GSD_PROFISAFE_REFERENCE);
    expect(profisafe?.extModulePrmDataLength).toBe(14);
    // Hepsi `F_` önekli — ayrı bir güvenlik parametre bloğuna adreslenirler.
    expect(profisafe?.parameterRefs.every((reference) => reference.safety)).toBe(true);
    expect(profisafe?.parameterRefs).toContainEqual({ offset: 2, reference: 10, safety: true });
    expect(profisafe?.parameterConstants[0]).toEqual({
      offset: 0,
      bytes: [0x0e],
      safety: true,
    });
  });

  it('parametre tanımlarını tip, varsayılan ve aralıkla çözer', () => {
    const { database } = expectSuccess(parseGsd(SAMPLE_GSD_TEXT));
    expect(database.parameterDefinitions).toHaveLength(SAMPLE_GSD_PARAMETER_COUNT);

    const sil = database.parameterDefinitions.find((entry) => entry.name === 'F_SIL');
    // `BitArea(2-3) 1 1-1`
    expect(sil?.dataType).toBe('bit-area');
    expect(sil?.bitFrom).toBe(2);
    expect(sil?.bitTo).toBe(3);
    expect(sil?.defaultValue).toBe(1);
    expect(sil?.minValue).toBe(1);
    expect(sil?.maxValue).toBe(1);
    expect(sil?.prmTextReference).toBe(2);

    const watchdog = database.parameterDefinitions.find((entry) => entry.name === 'F_WD_Time');
    // `Unsigned16 100 10-65535` — bit konumu YOK.
    expect(watchdog?.dataType).toBe('unsigned16');
    expect(watchdog?.bitFrom).toBeUndefined();
    expect(watchdog?.defaultValue).toBe(100);
    expect(watchdog?.minValue).toBe(10);
    expect(watchdog?.maxValue).toBe(65535);
    expect(watchdog?.prmTextReference).toBeUndefined();

    const slot = database.parameterDefinitions.find((entry) => entry.name === '[SlotNumber]');
    // `Unsigned8 1 1-254` — ardından TAB ve yorum geliyor, ikisi de kırpılmalı.
    expect(slot?.dataType).toBe('unsigned8');
    expect(slot?.defaultValue).toBe(1);
    expect(slot?.maxValue).toBe(254);

    const crc = database.parameterDefinitions.find((entry) => entry.name === 'F_Par_CRC');
    // `Unsigned16 0x783E 0-65535` — varsayılan HEX yazılmış.
    expect(crc?.defaultValue).toBe(0x783e);
  });

  it('PrmText bloklarını çözer ve yorumlanmış Text satırlarını SAYMAZ', () => {
    const { database } = expectSuccess(parseGsd(SAMPLE_GSD_TEXT));
    // `PrmText=1` bloğunun TAMAMI yorum satırı — hiç yok sayılmalı.
    expect(database.prmTexts.map((entry) => entry.reference)).toEqual([2, 3, 4]);
    const sil = database.prmTexts.find((entry) => entry.reference === 2);
    // Blokta yalnız `Text(1)` açık; `Text(0)`, `Text(2)`, `Text(3)` yorumlu.
    expect(sil?.values).toEqual([{ value: 1, text: 'SIL 2' }]);
  });

  it('parametreyi PrmText seçenekleriyle eşler', () => {
    const { database } = expectSuccess(parseGsd(SAMPLE_GSD_TEXT));
    const [crcLength] = database.parameterDefinitions.filter(
      (entry) => entry.name === 'F_CRC_Length',
    );
    if (crcLength === undefined) throw new Error('F_CRC_Length tanımı bulunamadı');
    expect(resolveGsdPrmTextValues(database, crcLength)).toEqual([
      { value: 1, text: '2 Byte CRC' },
    ]);
  });

  it('PrmText referansı olmayan parametrede BOŞ seçenek listesi döner', () => {
    const { database } = expectSuccess(parseGsd(SAMPLE_GSD_TEXT));
    const [version] = database.parameterDefinitions.filter(
      (entry) => entry.name === 'F_Par_Version',
    );
    if (version === undefined) throw new Error('F_Par_Version tanımı bulunamadı');
    expect(resolveGsdPrmTextValues(database, version)).toEqual([]);
  });

  it('UnitDiagType bloğundaki teşhis metinlerini okur', () => {
    const { database } = expectSuccess(parseGsd(SAMPLE_GSD_TEXT));
    expect(database.diagnosisTexts).toHaveLength(SAMPLE_GSD_DIAGNOSIS_TEXT_COUNT);
    expect(database.diagnosisTexts[0]).toMatchObject({
      code: 64,
      text: 'F add. does not match F_Dest_Add',
      unitDiagType: 129,
    });
  });

  it('cihaz düzeyindeki sabit parametre baytlarını modülünkinden ayırır', () => {
    const { database } = expectSuccess(parseGsd(SAMPLE_GSD_TEXT));
    // `Ext_User_Prm_Data_Const(0..2)` — DP-V1 durum baytları, modül DIŞINDA.
    expect(database.deviceParameterConstants).toHaveLength(3);
    expect(database.deviceParameterConstants[0]).toEqual({
      offset: 0,
      bytes: [0],
      safety: false,
    });
    expect(database.deviceParameterRefs).toHaveLength(0);
  });

  it('gerçek, değiştirilmemiş dosyada HİÇ uyarı üretmez', () => {
    const result = expectSuccess(parseGsd(SAMPLE_GSD_TEXT));
    expect(result.issues).toEqual([]);
  });
});

describe('parseGsd — gerçek dosya, eski söz dizimi (Eurotherm TC Serisi)', () => {
  it('`Endmodule` küçük harfle yazılmış olsa da bölümü kapatır', () => {
    const { database } = expectSuccess(parseGsd(SAMPLE_COMPACT_GSD_TEXT));
    expect(database.modules).toHaveLength(1);
    expect(database.modules[0]?.name).toBe('TC');
    // Bölüm kapanmasaydı dosya sonuna kadar yutulur ve uyarı çıkardı.
    expect(database.modules[0]?.configBytes).toEqual([0x55, 0x63]);
  });

  it('GSD_Revision anahtarı HİÇ YOKKEN dosyayı reddetmez', () => {
    const result = expectSuccess(parseGsd(SAMPLE_COMPACT_GSD_TEXT));
    expect(result.database.device.gsdRevision).toBeUndefined();
    expect(result.database.device.identNumber).toBe(SAMPLE_COMPACT_GSD_IDENT_NUMBER);
    expect(result.issues).toEqual([]);
  });

  it('BASİT parametre biçimini (User_Prm_Data) okur', () => {
    const { database } = expectSuccess(parseGsd(SAMPLE_COMPACT_GSD_TEXT));
    expect(database.parameterDefinitions).toHaveLength(0);
    expect(database.prmTexts).toHaveLength(0);
    expect(database.userPrmData).toEqual([
      0x00, 0x00, 0x11, 0x00, 0x15, 0x00, 0x17, 0x00, 0x18, 0x00, 0x19, 0x00, 0x1a,
    ]);
  });

  it('Module_Reference satırı olmayan modülde undefined bırakır, sıfır UYDURMAZ', () => {
    const { database } = expectSuccess(parseGsd(SAMPLE_COMPACT_GSD_TEXT));
    expect(database.modules[0]?.moduleReference).toBeUndefined();
  });

  it('desteklenmeyen hızı `supported: false` olarak işaretler', () => {
    const { database } = expectSuccess(parseGsd(SAMPLE_COMPACT_GSD_TEXT));
    // Dosya 45.45 kBit/s'i hiç saymıyor; anahtarı YOK.
    const unsupported = database.device.baudRates.find((rate) => rate.label === '45.45');
    expect(unsupported?.supported).toBe(false);
    expect(unsupported?.maxTsdr).toBeUndefined();
    expect(database.device.baudRates.filter((rate) => rate.supported)).toHaveLength(9);
  });

  it('modülün kimlik baytlarını modül adının söylediği gibi çözer', () => {
    const { database } = expectSuccess(parseGsd(SAMPLE_COMPACT_GSD_TEXT));
    // 0x55 → giriş, word, 6 birim; 0x63 → çıkış, word, 4 birim.
    expect(database.modules[0]?.config.inputLengthBytes).toBe(12);
    expect(database.modules[0]?.config.outputLengthBytes).toBe(8);
    // Dosyanın kendi sınırları: giriş 32, çıkış 8 — ikisi de aşılmıyor.
    expect(database.device.maxInputLength).toBe(32);
    expect(database.device.maxOutputLength).toBe(8);
  });
});

describe('decodeGsdConfigBytes', () => {
  it('genel biçimde bayt ve word ayrımını yapar', () => {
    // 0x10 → giriş, bayt, 1 birim.
    expect(decodeGsdConfigBytes([0x10]).inputLengthBytes).toBe(1);
    // 0x50 → giriş, word, 1 birim = 2 bayt.
    expect(decodeGsdConfigBytes([0x50]).inputLengthBytes).toBe(2);
    // 0x21 → çıkış, bayt, 2 birim.
    expect(decodeGsdConfigBytes([0x21]).outputLengthBytes).toBe(2);
  });

  it('genel biçimde giriş+çıkış bitini birlikte okur', () => {
    // 0xF1 → tutarlı, word, giriş VE çıkış, 2 birim.
    const decoded = decodeGsdConfigBytes([0xf1]);
    expect(decoded.inputLengthBytes).toBe(4);
    expect(decoded.outputLengthBytes).toBe(4);
    expect(decoded.blocks.every((block) => block.consistency === 'whole')).toBe(true);
  });

  it('genel biçimde uzunluk alanı 4 bit, özel biçimde 6 bittir', () => {
    // Genel: 0x5F → 0x0F + 1 = 16 word.
    expect(decodeGsdConfigBytes([0x5f]).blocks[0]?.count).toBe(16);
    // Özel: 0x40 (giriş gelir, 0 üretici baytı) + 0x5F → 0x1F + 1 = 32 word.
    expect(decodeGsdConfigBytes([0x40, 0x5f]).blocks[0]?.count).toBe(32);
  });

  it('özel biçimde 0x00 baytı BOŞ YER olarak geçilir', () => {
    // SEW MOVIDRIVE'ın gerçek "4 PD" modülü böyle başlıyor: 0x00, 0xF3.
    const decoded = decodeGsdConfigBytes([0x00, 0xf3]);
    expect(decoded.blocks).toHaveLength(2);
    expect(decoded.inputLengthBytes).toBe(8);
    expect(decoded.outputLengthBytes).toBe(8);
    expect(decoded.truncated).toBe(false);
  });

  it('özel biçimde uzunluk baytı eksikse UZUNLUK UYDURMAZ, truncated der', () => {
    // 0xC3: önce çıkış sonra giriş baytı beklenir; ikincisi yok.
    const decoded = decodeGsdConfigBytes([0xc3, 0xc1]);
    expect(decoded.truncated).toBe(true);
    expect(decoded.blocks).toHaveLength(1);
  });

  it('üreticiye özel baytlar eksikse truncated der', () => {
    // 0xC3 üç üretici baytı bildiriyor ama yalnız biri var.
    const decoded = decodeGsdConfigBytes([0xc3, 0xc1, 0xc1, 0xfd]);
    expect(decoded.truncated).toBe(true);
    expect(decoded.manufacturerBytes).toEqual([]);
  });

  it('boş bayt dizisinde boş çözüm döner', () => {
    const decoded = decodeGsdConfigBytes([]);
    expect(decoded.blocks).toEqual([]);
    expect(decoded.inputLengthBytes).toBe(0);
    expect(decoded.truncated).toBe(false);
  });
});

describe('parseGsd — kenar durumlar', () => {
  it('boş girdi başarısız döner', () => {
    const result = parseGsd('   \n\n  ');
    expect(result.success).toBe(false);
    expect(result.issues[0]?.messageKey).toBe('definition.gsd.issue.emptyInput');
  });

  it('GSD olmayan metni reddeder', () => {
    const result = parseGsd('bu bir GSD dosyasi degil\n');
    expect(result.success).toBe(false);
    expect(result.issues.some((issue) => issue.messageKey === 'definition.gsd.issue.notGsd')).toBe(
      true,
    );
  });

  it('biçim işareti olmasa da Vendor_Name varsa dosyayı kabul eder', () => {
    const result = parseGsd('Vendor_Name = "TEST"\nModule = "M" 0x10\nEndModule\n');
    expect(result.success).toBe(true);
  });

  it('hiç modül yoksa REDDETMEZ, uyarı üretir', () => {
    const result = expectSuccess(parseGsd(buildGsd('Max_Diag_Data_Len = 6')));
    expect(result.database.modules).toHaveLength(0);
    expect(result.issues.map((issue) => issue.messageKey)).toContain(
      'definition.gsd.issue.noModules',
    );
  });

  it('yorumu tırnak İÇİNDEKİ noktalı virgülde kesmez', () => {
    const { database } = expectSuccess(
      parseGsd(buildGsd(['Module = "M" 0x10', 'Info_Text = "a; b; c"', 'EndModule'].join('\n'))),
    );
    expect(database.modules[0]?.infoText).toBe('a; b; c');
  });

  it('CRLF satır sonlarını kırpar', () => {
    const { database } = expectSuccess(
      parseGsd(buildGsd(['Module = "M" 0x10', 'EndModule'].join('\n')).replace(/\n/g, '\r\n')),
    );
    expect(database.modules).toHaveLength(1);
    expect(database.modules[0]?.name).toBe('M');
  });

  it('bozuk satırı bildirir ama dosyayı okumaya devam eder', () => {
    const result = expectSuccess(
      parseGsd(buildGsd(['bu satir bozuk !!', 'Module = "M" 0x10', 'EndModule'].join('\n'))),
    );
    expect(result.issues.map((issue) => issue.messageKey)).toContain(
      'definition.gsd.issue.malformedLine',
    );
    expect(result.database.modules).toHaveLength(1);
  });

  it('bozuk satır uyarısını beşte keser — gürültü basmaz', () => {
    const noise = Array.from({ length: 40 }, (_, index) => `bozuk satir ${String(index)} !!`);
    const result = expectSuccess(
      parseGsd(buildGsd([...noise, 'Module = "M" 0x10', 'EndModule'].join('\n'))),
    );
    const malformed = result.issues.filter(
      (issue) => issue.messageKey === 'definition.gsd.issue.malformedLine',
    );
    expect(malformed).toHaveLength(5);
  });

  it('TANINMAYAN global anahtara uyarı BASMAZ', () => {
    const result = expectSuccess(
      parseGsd(
        buildGsd(
          [
            'Reaction_Delay_12M = 400',
            'DXB_Max_Link_Count = 10',
            'Module = "M" 0x10',
            'EndModule',
          ].join('\n'),
        ),
      ),
    );
    expect(result.issues).toEqual([]);
  });

  it('kapanmamış modül bölümünü bildirir ama modülü yine de kaydeder', () => {
    const result = expectSuccess(parseGsd(buildGsd('Module = "M" 0x10')));
    expect(result.issues.map((issue) => issue.messageKey)).toContain(
      'definition.gsd.issue.unclosedSection',
    );
    expect(result.database.modules).toHaveLength(1);
  });

  it('var olmayan PrmText referansını bildirir', () => {
    const result = expectSuccess(
      parseGsd(
        buildGsd(
          [
            'ExtUserPrmData = 1 "P"',
            'Bit(0) 0 0-1',
            'Prm_Text_Ref = 99',
            'EndExtUserPrmData',
            'Module = "M" 0x10',
            'EndModule',
          ].join('\n'),
        ),
      ),
    );
    const issue = result.issues.find(
      (entry) => entry.messageKey === 'definition.gsd.issue.unknownPrmTextRef',
    );
    expect(issue?.text).toBe('99');
  });

  it('var olmayan parametre tanımına referansı bildirir', () => {
    const result = expectSuccess(
      parseGsd(
        buildGsd(['Module = "M" 0x10', 'Ext_User_Prm_Data_Ref(0) = 7', 'EndModule'].join('\n')),
      ),
    );
    const issue = result.issues.find(
      (entry) => entry.messageKey === 'definition.gsd.issue.unknownPrmDataRef',
    );
    expect(issue?.text).toBe('7');
  });

  it('tekrar eden Module_Reference i bildirir', () => {
    const result = expectSuccess(
      parseGsd(
        buildGsd(
          ['Module = "A" 0x10', '4', 'EndModule', 'Module = "B" 0x20', '4', 'EndModule'].join('\n'),
        ),
      ),
    );
    const issue = result.issues.find(
      (entry) => entry.messageKey === 'definition.gsd.issue.duplicateModuleReference',
    );
    expect(issue?.text).toBe('4');
  });

  it('dosyanın kendi sınırını aşan modülü bildirir', () => {
    const result = expectSuccess(
      parseGsd(
        buildGsd(
          ['Max_Input_Len = 4', 'Max_Output_Len = 4', 'Module = "BIG" 0x5F', 'EndModule'].join('\n'),
        ),
      ),
    );
    // 0x5F → 16 word = 32 bayt giriş, bildirilen 4 baytın çok üstünde.
    const issue = result.issues.find(
      (entry) => entry.messageKey === 'definition.gsd.issue.moduleExceedsLimit',
    );
    expect(issue?.text).toBe('BIG');
  });

  it('yarım kalan kimlik baytlarını bildirir', () => {
    const result = expectSuccess(
      parseGsd(buildGsd(['Module = "M" 0xC3, 0xC1', 'EndModule'].join('\n'))),
    );
    expect(result.issues.map((issue) => issue.messageKey)).toContain(
      'definition.gsd.issue.truncatedConfig',
    );
  });

  it('bölüm anahtarlarını büyük/küçük harfe duyarsız okur', () => {
    const { database } = expectSuccess(
      parseGsd(
        buildGsd(
          [
            'prmtext = 1',
            'TEXT(0) = "kapali"',
            'ENDPRMTEXT',
            'MODULE = "M" 0x10',
            'endmodule',
          ].join('\n'),
        ),
      ),
    );
    expect(database.prmTexts[0]?.values).toEqual([{ value: 0, text: 'kapali' }]);
    expect(database.modules).toHaveLength(1);
  });

  it('Module anahtarını eşitlik işareti OLMADAN da okur', () => {
    // felser.ch in yayımlanmış örneği eşitliksiz yazıyor: `Module "Demo-Module" 0x00`.
    const { database } = expectSuccess(
      parseGsd(buildGsd(['Module "Demo-Module" 0x10', 'EndModule'].join('\n'))),
    );
    expect(database.modules).toHaveLength(1);
    expect(database.modules[0]?.name).toBe('Demo-Module');
    expect(database.modules[0]?.config.inputLengthBytes).toBe(1);
  });

  it('findGsdModule bulunmayan referansta undefined döner', () => {
    const { database } = expectSuccess(parseGsd(SAMPLE_GSD_TEXT));
    expect(findGsdModule(database, 999)).toBeUndefined();
  });
});

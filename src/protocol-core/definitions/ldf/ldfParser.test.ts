import { describe, expect, it } from 'vitest';

import {
  SAMPLE_LDF_ALIGNED_FRAME,
  SAMPLE_LDF_DIAGNOSTIC_SIGNAL_COUNT,
  SAMPLE_LDF_FRAME_COUNT,
  SAMPLE_LDF_NODE_ATTRIBUTE_COUNT,
  SAMPLE_LDF_SCHEDULE_TABLE_COUNT,
  SAMPLE_LDF_SIGNAL_COUNT,
  SAMPLE_LDF_TEXT,
  SAMPLE_LDF_UNALIGNED_FRAME,
  SAMPLE_LDF_UNCONDITIONAL_FRAME_COUNT,
  SAMPLE_LIN13_FRAME_COUNT,
  SAMPLE_LIN13_LDF_TEXT,
  SAMPLE_LIN13_SIGNAL_COUNT,
  SAMPLE_LIN13_UNSIZED_FRAME,
} from './ldfFixture';
import {
  buildLdfSampleData,
  chooseDefaultLdfFrame,
  decodeLdfFrame,
  findLdfFrame,
  findLdfSignal,
  ldfFrameDataLength,
  parseLdf,
  resolveLdfChecksumModel,
  stripLdfComments,
  tokenizeLdf,
} from './ldfParser';
import type { LdfCluster, LdfParseResult } from './ldfTypes';

function expectSuccess(result: LdfParseResult): LdfCluster {
  if (!result.success) {
    throw new Error(
      `expected success, got issues: ${result.issues.map((issue) => issue.messageKey).join(', ')}`,
    );
  }
  return result.cluster;
}

/** Küçük bir geçerli LDF gövdesi kur — TEK bir üretimi sınamak için. */
function wrap(body: string): string {
  return `LIN_description_file;\nLIN_protocol_version = "2.2";\nLIN_language_version = "2.2";\nLIN_speed = 19.2 kbps;\n${body}\n`;
}

const sample = expectSuccess(parseLdf(SAMPLE_LDF_TEXT));
const lin13 = expectSuccess(parseLdf(SAMPLE_LIN13_LDF_TEXT));

describe('parseLdf — gerçek üretici dosyası (Vector DaVinci, koltuk motoru kümesi)', () => {
  it('genel bildirimleri çözer', () => {
    expect(sample.protocolVersion).toBe('2.2');
    expect(sample.languageVersion).toBe('2.2');
    expect(sample.speedKbps).toBe(19.2);
  });

  it('master düğümü zaman tabanı ve seğirmesiyle okur', () => {
    expect(sample.master).toEqual({ name: 'SeatECU', timeBaseMs: 5, jitterMs: 0.1 });
    expect(sample.slaves).toEqual(['Motor1', 'Motor2']);
  });

  it('`Master :` yazımındaki boşluğa takılmaz', () => {
    // Satır tabanlı bir okuyucunun kırılacağı yer: iki noktadan ÖNCE boşluk var.
    expect(SAMPLE_LDF_TEXT).toContain('Master : SeatECU');
    expect(sample.master.name).toBe('SeatECU');
  });

  it('sinyalleri ve teşhis sinyallerini AYRI listelerde tutar', () => {
    expect(sample.signals).toHaveLength(SAMPLE_LDF_SIGNAL_COUNT);
    expect(sample.diagnosticSignals).toHaveLength(SAMPLE_LDF_DIAGNOSTIC_SIGNAL_COUNT);
    // §9.2.3.2: teşhis sinyallerinde yayıncı/abone bilgisi YOKTUR.
    expect(sample.diagnosticSignals.every((signal) => signal.publisher === '')).toBe(true);
    expect(sample.diagnosticSignals.every((signal) => signal.diagnostic)).toBe(true);
  });

  it('bayt dizisini bit boyundan DEĞİL küme parantezinden ayırır', () => {
    const array = findLdfSignal(sample, 'Motor1Position');
    expect(array?.kind).toBe('byte-array');
    expect(array?.sizeBits).toBe(32);
    expect(array?.initBytes).toEqual([0, 0, 0, 0]);
    expect(array?.initValue).toBeUndefined();

    // AYNI dosyada 8 bitlik bir skaler — parantez yok, o yüzden bayt dizisi DEĞİL.
    const scalar = findLdfSignal(sample, 'Motor2Temp');
    expect(scalar?.kind).toBe('scalar');
    expect(scalar?.sizeBits).toBe(8);
    expect(scalar?.initValue).toBe(0);
    expect(scalar?.initBytes).toBeUndefined();
  });

  it('sinyalin yayıncısını ilk, abonelerini kalan adlardan alır', () => {
    const shared = findLdfSignal(sample, 'MotorSpeed');
    expect(shared?.publisher).toBe('SeatECU');
    expect(shared?.subscribers).toEqual(['Motor1', 'Motor2']);
  });

  it('dört çerçeve bölümünü TEK listede toplar ve türünü işaretler', () => {
    expect(sample.frames).toHaveLength(SAMPLE_LDF_FRAME_COUNT);
    const byKind = (kind: string): number =>
      sample.frames.filter((frame) => frame.kind === kind).length;
    expect(byKind('unconditional')).toBe(SAMPLE_LDF_UNCONDITIONAL_FRAME_COUNT);
    expect(byKind('event-triggered')).toBe(1);
    expect(byKind('diagnostic')).toBe(2);
    expect(byKind('sporadic')).toBe(0);
  });

  it('çerçeve kimliğini onluk VE onaltılık yazımdan okur', () => {
    expect(findLdfFrame(sample, 'Motor1State_Cycl')?.frameId).toBe(51);
    // AYNI dosya teşhis çerçevelerini onaltılık yazıyor.
    expect(findLdfFrame(sample, 'MasterReq')?.frameId).toBe(0x3c);
    expect(findLdfFrame(sample, 'SlaveResp')?.frameId).toBe(0x3d);
  });

  it('çerçevenin sinyal yerleşimlerini ofsetiyle sırayla okur', () => {
    const frame = findLdfFrame(sample, 'MotorControl');
    expect(frame?.publisher).toBe('SeatECU');
    expect(frame?.lengthBytes).toBe(2);
    expect(frame?.signals).toEqual([
      { name: 'MotorDirection', offset: 0, line: 92 },
      { name: 'MotorSpeed', offset: 2, line: 93 },
      { name: 'MotorSelection', offset: 12, line: 94 },
    ]);
  });

  it('olay tetiklemeli çerçevenin çarpışma çizelgesini ve ilişkili çerçevelerini okur', () => {
    const etf = findLdfFrame(sample, 'ETF_MotorStates');
    expect(etf?.kind).toBe('event-triggered');
    expect(etf?.frameId).toBe(58);
    expect(etf?.collisionScheduleTable).toBe('ETF_CollisionResolving');
    expect(etf?.associatedFrames).toEqual(['Motor1State_Event', 'Motor2State_Event']);
  });

  it('düğüm özniteliklerini tam okur (`configurable_frames` dahil)', () => {
    expect(sample.nodeAttributes).toHaveLength(SAMPLE_LDF_NODE_ATTRIBUTE_COUNT);
    const motor1 = sample.nodeAttributes.find((node) => node.name === 'Motor1');
    expect(motor1?.linProtocol).toBe('2.2');
    expect(motor1?.configuredNad).toBe(0x2);
    expect(motor1?.initialNad).toBe(0x2);
    expect(motor1?.supplierId).toBe(0x1e);
    expect(motor1?.functionId).toBe(0x1);
    expect(motor1?.variant).toBe(0);
    expect(motor1?.responseErrorSignal).toBe('Motor1LinError');
    expect(motor1?.p2Min).toBe(100);
    expect(motor1?.stMin).toBe(20);
    expect(motor1?.nAsTimeout).toBe(1000);
    expect(motor1?.nCrTimeout).toBe(1000);
    // SIRA korunur: PID atama isteği bu sıraya göre aralık dağıtır (§4.2.5.5).
    expect(motor1?.configurableFrames.map((entry) => entry.name)).toEqual([
      'MotorControl',
      'Motor1State_Cycl',
      'Motor1State_Event',
      'ETF_MotorStates',
      'Motor1_Dynamic',
    ]);
    // 2.1/2.2 lehçesinde mesaj kimliği YOKTUR — sıfır uydurulmaz.
    expect(motor1?.configurableFrames.every((entry) => entry.messageId === undefined)).toBe(true);
  });

  it('`Motor1{` yazımındaki eksik boşluğa takılmaz', () => {
    expect(SAMPLE_LDF_TEXT).toContain('Motor1{');
    expect(sample.nodeAttributes.map((node) => node.name)).toEqual(['Motor1', 'Motor2']);
  });

  it('çizelge tablolarını girdileri ve toplam gecikmesiyle okur', () => {
    expect(sample.scheduleTables).toHaveLength(SAMPLE_LDF_SCHEDULE_TABLE_COUNT);
    const normal = sample.scheduleTables.find((table) => table.name === 'NormalTable');
    expect(normal?.entries.map((entry) => entry.command)).toEqual([
      'MotorControl',
      'Motor1State_Cycl',
      'Motor2State_Cycl',
    ]);
    expect(normal?.totalDelayMs).toBe(150);
    expect(normal?.entries.every((entry) => entry.isFrame)).toBe(true);
  });

  it('düğüm yapılandırma komutunu argümanlarıyla ayırır', () => {
    const init = sample.scheduleTables.find((table) => table.name === 'InitTable');
    const first = init?.entries[0];
    expect(first?.command).toBe('AssignFrameId');
    expect(first?.arguments).toEqual(['Motor1', 'Motor1State_Cycl']);
    expect(first?.isFrame).toBe(false);
    expect(first?.delayMs).toBe(10);
  });

  it('kodlama tiplerini fiziksel ve mantıksal girdileriyle okur', () => {
    const temperature = sample.encodingTypes.find((type) => type.name === 'encTemperature');
    expect(temperature?.entries[0]).toEqual({
      kind: 'physical',
      minValue: 0,
      maxValue: 80,
      scale: 0.5,
      offset: -20,
      unit: 'Degree',
      line: 204,
    });
    expect(temperature?.entries.filter((entry) => entry.kind === 'logical')).toHaveLength(8);
  });

  it('sinyal→kodlama eşlemesini kurar', () => {
    expect([...sample.signalEncodingByName]).toEqual([
      ['MotorSpeed', 'MotorSpeed'],
      ['Motor1Temp', 'encTemperature'],
      ['Motor2Temp', 'encTemperature'],
    ]);
  });

  it('gerçek dosyada TEK uyarı üretir ve o uyarı DOSYANIN KENDİ kusurudur', () => {
    const result = parseLdf(SAMPLE_LDF_TEXT);
    expect(result.success).toBe(true);
    // §2.2.3: bayt dizisindeki her bayt TEK bir çerçeve baytına oturmalıdır.
    // Vector'ün dosyasında `Motor1Temp` 7 bit olduğu için `Motor1Position`
    // bit 7'den başlıyor — kurala UYMUYOR. Uydurulmuş bir uyarı değil.
    expect(result.issues).toEqual([
      { line: 72, messageKey: 'definition.ldf.issue.unalignedByteArray', text: 'Motor1Position' },
    ]);
  });

  it('kardeş çerçevede AYNI yerleşim kurala UYGUN ve uyarı ÜRETMEZ', () => {
    const aligned = findLdfFrame(sample, SAMPLE_LDF_ALIGNED_FRAME);
    expect(aligned?.signals.find((entry) => entry.name === 'Motor2Position')?.offset).toBe(8);
  });
});

describe('parseLdf — LIN 1.3 lehçesi (gerçek dosya)', () => {
  it('`Node_attributes` HİÇ YOKKEN dosyayı reddetmez', () => {
    expect(lin13.protocolVersion).toBe('1.3');
    expect(lin13.nodeAttributes).toHaveLength(0);
    expect(lin13.signals).toHaveLength(SAMPLE_LIN13_SIGNAL_COUNT);
    expect(lin13.frames).toHaveLength(SAMPLE_LIN13_FRAME_COUNT);
  });

  it('`Diagnostic_addresses` bölümünü okur — 1.3 lehçesinin NAD karşılığı', () => {
    expect(lin13.diagnosticAddresses).toEqual([
      { node: 'LSM', address: 1, line: 15 },
      // AYNI bölümde onluk ve onaltılık birlikte kullanılmış.
      { node: 'CPM', address: 2, line: 16 },
    ]);
  });

  it('`Signal_groups` bölümünü okur (§9.2.3.3 kullanımdan kalkmış ama TANIMLI)', () => {
    expect(lin13.signalGroups.map((group) => group.name)).toEqual(['CPMReq', 'CPMResp']);
    expect(lin13.signalGroups[0]?.sizeBits).toBe(64);
    expect(lin13.signalGroups[0]?.members).toHaveLength(8);
  });

  it('boy alanı YAZILMAMIŞ çerçevede uzunluk UYDURMAZ, uyarır', () => {
    const unsized = findLdfFrame(lin13, SAMPLE_LIN13_UNSIZED_FRAME);
    expect(unsized?.frameId).toBe(48);
    expect(unsized?.publisher).toBe('CEM');
    // 1.3'ün kimlikten boy türeten kuralı 2.2A'da YOK — uygulanmıyor.
    expect(unsized?.lengthBytes).toBeUndefined();
    expect(unsized?.signals).toHaveLength(8);

    const issues = parseLdf(SAMPLE_LIN13_LDF_TEXT).issues;
    expect(
      issues.filter((issue) => issue.messageKey === 'definition.ldf.issue.frameLengthMissing'),
    ).toHaveLength(5);
  });

  it('boy alanı YAZILMIŞ çerçevede onu kullanır', () => {
    expect(findLdfFrame(lin13, 'VL1_CEM_Frm1')?.lengthBytes).toBe(3);
  });

  it('BOŞLUKSUZ yazılmış bildirimleri okur', () => {
    // `RearFogLampInd:1,0,CEM,LSM;` — hiçbir alan ayracının etrafında boşluk yok.
    expect(SAMPLE_LIN13_LDF_TEXT).toContain('RearFogLampInd:1,0,CEM,LSM;');
    const signal = findLdfSignal(lin13, 'RearFogLampInd');
    expect(signal?.sizeBits).toBe(1);
    expect(signal?.publisher).toBe('CEM');
    expect(signal?.subscribers).toEqual(['LSM']);
  });
});

describe('resolveLdfChecksumModel — §2.3.1.5', () => {
  it('60/61 kimliğinde KOŞULSUZ klasik der', () => {
    for (const name of ['MasterReq', 'SlaveResp']) {
      const frame = findLdfFrame(sample, name);
      expect(frame).toBeDefined();
      expect(resolveLdfChecksumModel(sample, frame!)).toEqual({
        model: 'classic',
        reason: 'reservedDiagnostic',
        node: '',
      });
    }
  });

  it('LIN 2.x slave yayınlayan çerçevede geliştirilmiş der ve düğümü söyler', () => {
    const frame = findLdfFrame(sample, 'Motor1State_Cycl');
    expect(resolveLdfChecksumModel(sample, frame!)).toEqual({
      model: 'enhanced',
      reason: 'linTwoSlave',
      node: 'Motor1',
    });
  });

  it('master yayınlayan çerçevede slave ABONELERE bakar', () => {
    const frame = findLdfFrame(sample, 'MotorControl');
    const resolution = resolveLdfChecksumModel(sample, frame!);
    expect(resolution.model).toBe('enhanced');
    expect(resolution.reason).toBe('linTwoSlave');
    expect(sample.slaves).toContain(resolution.node);
  });

  it('`Node_attributes` YOKSA kümenin sürümüne düşer — LIN 1.3 dosyasında klasik', () => {
    const frame = findLdfFrame(lin13, 'VL1_CEM_Frm1');
    expect(resolveLdfChecksumModel(lin13, frame!)).toEqual({
      model: 'classic',
      reason: 'clusterVersion',
      node: '',
    });
  });

  it('karışık kümede KLASİK seçer — 1.x slave geliştirilmişi anlamaz', () => {
    const cluster = expectSuccess(
      parseLdf(
        wrap(`Nodes { Master: M, 5 ms, 0.1 ms ; Slaves: Old, New ; }
Signals { S1: 8, 0, M, Old, New ; }
Frames { F: 10, M, 1 { S1, 0 ; } }
Node_attributes {
  Old { LIN_protocol = "1.3" ; configured_NAD = 0x1 ; }
  New { LIN_protocol = "2.2" ; configured_NAD = 0x2 ; }
}
Schedule_tables { T { F delay 10 ms ; } }`),
      ),
    );
    const resolution = resolveLdfChecksumModel(cluster, findLdfFrame(cluster, 'F')!);
    expect(resolution.model).toBe('classic');
    expect(resolution.reason).toBe('mixedSlaves');
    expect(resolution.node).toBe('Old');
  });

  it('hiç sürüm bilgisi yoksa VARSAYIM ÜRETMEZ', () => {
    const cluster: LdfCluster = { ...sample, protocolVersion: '', nodeAttributes: [] };
    const frame = findLdfFrame(cluster, 'Motor1State_Cycl');
    expect(resolveLdfChecksumModel(cluster, frame!)).toEqual({
      model: 'unknown',
      reason: 'noSlaveVersion',
      node: '',
    });
  });
});

describe('decodeLdfFrame — §2.2.3 + §9.2.6.1', () => {
  it('skaler sinyali LSB-first okur ve fiziksel değere çevirir', () => {
    const frame = findLdfFrame(sample, 'Motor1State_Cycl');
    const decoded = decodeLdfFrame(new Uint8Array([0x41, 0x02, 0x03, 0x04, 0x05, 0x01]), sample, frame!);
    const temperature = decoded.find((entry) => entry.signal.name === 'Motor1Temp');
    // 0x41 = 0100_0001; alt 7 bit = 65. physical: 0.5 × 65 + (−20) = 12.5.
    expect(temperature?.rawValue).toBe(65);
    expect(temperature?.physicalValue).toBe(12.5);
    expect(temperature?.unit).toBe('Degree');
  });

  it('bayt sınırını AŞAN skaleri tek parça okur', () => {
    const frame = findLdfFrame(sample, 'MotorControl');
    // 0x07C9 → MotorSpeed 10 bit @ ofset 2 = (0x07C9 >> 2) & 0x3FF = 498.
    const decoded = decodeLdfFrame(new Uint8Array([0xc9, 0x07]), sample, frame!);
    expect(decoded.find((entry) => entry.signal.name === 'MotorDirection')?.rawValue).toBe(1);
    expect(decoded.find((entry) => entry.signal.name === 'MotorSpeed')?.rawValue).toBe(498);
    expect(decoded.find((entry) => entry.signal.name === 'MotorSelection')?.rawValue).toBe(0);
  });

  it('HİZALI bayt dizisini baytları hâlinde verir', () => {
    const frame = findLdfFrame(sample, SAMPLE_LDF_ALIGNED_FRAME);
    const decoded = decodeLdfFrame(
      new Uint8Array([0x02, 0x0a, 0x0b, 0x0c, 0x0d, 0x01]),
      sample,
      frame!,
    );
    const position = decoded.find((entry) => entry.signal.name === 'Motor2Position');
    expect(position?.bytes).toEqual([0x0a, 0x0b, 0x0c, 0x0d]);
    expect(position?.rawValue).toBeUndefined();
    expect(position?.unalignedByteArray).toBe(false);
  });

  it('HİZASIZ bayt dizisinde okuma UYDURMAZ', () => {
    const frame = findLdfFrame(sample, SAMPLE_LDF_UNALIGNED_FRAME);
    const decoded = decodeLdfFrame(
      new Uint8Array([0x41, 0x02, 0x03, 0x04, 0x05, 0x01]),
      sample,
      frame!,
    );
    const position = decoded.find((entry) => entry.signal.name === 'Motor1Position');
    expect(position?.unalignedByteArray).toBe(true);
    expect(position?.bytes).toBeUndefined();
    expect(position?.rawValue).toBeUndefined();
  });

  it('çerçeve KISA geldiğinde sığmayan sinyali işaretler, çökmez', () => {
    const frame = findLdfFrame(sample, 'Motor1State_Cycl');
    const decoded = decodeLdfFrame(new Uint8Array([0x41]), sample, frame!);
    expect(decoded.find((entry) => entry.signal.name === 'Motor1Temp')?.outOfFrame).toBe(false);
    expect(decoded.find((entry) => entry.signal.name === 'Motor1LinError')?.outOfFrame).toBe(true);
  });

  it('mantıksal değer eşleşince etiketi verir', () => {
    const cluster = expectSuccess(
      parseLdf(
        wrap(`Nodes { Master: M, 5 ms, 0.1 ms ; Slaves: S ; }
Signals { Mode: 2, 0, S, M ; }
Frames { F: 10, S, 1 { Mode, 0 ; } }
Node_attributes { S { LIN_protocol = "2.1" ; configured_NAD = 0x1 ; } }
Schedule_tables { T { F delay 10 ms ; } }
Signal_encoding_types { Dig2Bit { logical_value, 0, "off" ; logical_value, 1, "on" ; } }
Signal_representation { Dig2Bit: Mode ; }`),
      ),
    );
    const decoded = decodeLdfFrame(new Uint8Array([0x01]), cluster, findLdfFrame(cluster, 'F')!);
    expect(decoded[0]?.label).toBe('on');
    expect(decoded[0]?.physicalValue).toBeUndefined();
  });

  it('`Signals`ta tanımı olmayan yerleşimi işaretler, çökmez', () => {
    const cluster = expectSuccess(
      parseLdf(
        wrap(`Nodes { Master: M, 5 ms, 0.1 ms ; Slaves: S ; }
Signals { Known: 8, 0, S, M ; }
Frames { F: 10, S, 2 { Known, 0 ; Ghost, 8 ; } }
Schedule_tables { T { F delay 10 ms ; } }`),
      ),
    );
    const decoded = decodeLdfFrame(new Uint8Array([0x11, 0x22]), cluster, findLdfFrame(cluster, 'F')!);
    expect(decoded[1]?.undefinedSignal).toBe(true);
    expect(decoded[1]?.rawValue).toBeUndefined();
  });

  it('kodlama çakışmasında DOSYA SIRASI kazanır', () => {
    // Vector'ün `encTemperature`ı physical 0-80 ile logical 0-7'yi ÇAKIŞTIRIYOR
    // ve fiziksel girdi dosyada ÖNCE geliyor. Uydurulmuş bir öncelik yok.
    const frame = findLdfFrame(sample, SAMPLE_LDF_ALIGNED_FRAME);
    const decoded = decodeLdfFrame(new Uint8Array([0x02, 0, 0, 0, 0, 0]), sample, frame!);
    const temperature = decoded.find((entry) => entry.signal.name === 'Motor2Temp');
    expect(temperature?.physicalValue).toBe(-19);
    expect(temperature?.label).toBeUndefined();
  });
});

describe('parseLdf — söz dizimi kenar durumları', () => {
  it('boş girdi başarısız döner', () => {
    expect(parseLdf('   ')).toEqual({
      success: false,
      issues: [{ line: 0, messageKey: 'definition.ldf.issue.emptyInput' }],
    });
  });

  it('dosya işareti olmayan metni reddeder', () => {
    const result = parseLdf('bu bir LDF dosyasi degil\n');
    expect(result.success).toBe(false);
    expect(result.issues[0]?.messageKey).toBe('definition.ldf.issue.notLdf');
  });

  it('satır YORUMUNU keser ama dize İÇİNDEKİ `//`yi kesmez', () => {
    const stripped = stripLdfComments('a = "http://x" ; // yorum\nb = 1 ;');
    expect(stripped).toContain('"http://x"');
    expect(stripped).not.toContain('yorum');
    // Satır sayısı KORUNUR — hata listesinin dosyayla tutması buna bağlı.
    expect(stripped.split('\n')).toHaveLength(2);
  });

  it('blok yorumunu keser ve satır numarasını kaydırmaz', () => {
    const stripped = stripLdfComments('a /* iki\nsatir */ = 1 ;');
    expect(stripped).not.toContain('satir');
    expect(stripped.split('\n')).toHaveLength(2);
  });

  it('gerçek dosyanın blok yorumlu başlığını atlar', () => {
    // Açılış fixture'ı `/*…*/` çerçeveli bir üretici başlığıyla başlıyor.
    expect(SAMPLE_LDF_TEXT.trimStart().startsWith('/*')).toBe(true);
    expect(sample.protocolVersion).toBe('2.2');
  });

  it('CRLF satır sonlarını sorunsuz okur', () => {
    const cluster = expectSuccess(
      parseLdf(wrap('Nodes { Master: M, 5 ms, 0.1 ms ; Slaves: S ; }').replace(/\n/gu, '\r\n')),
    );
    expect(cluster.master.name).toBe('M');
    expect(cluster.slaves).toEqual(['S']);
  });

  it('büyük/küçük harfe DUYARLIDIR — §9.3 son cümlesi', () => {
    // `signals` küçük harfle bir bölüm DEĞİLDİR; bilinmeyen bölüm sayılır.
    const result = parseLdf(wrap('signals { X: 8, 0, M, S ; }'));
    const cluster = expectSuccess(result);
    expect(cluster.signals).toHaveLength(0);
    expect(result.issues.some((issue) => issue.messageKey === 'definition.ldf.issue.unknownSection')).toBe(
      true,
    );
  });

  it('`Channel_name` ve `LDF_file_revision` okunur, ikincisi UYARI ÜRETMEZ', () => {
    const result = parseLdf(
      `LIN_description_file;\nLIN_protocol_version = "2.2";\nLIN_language_version = "2.2";\nLDF_file_revision ="14.23.01";\nLIN_speed = 19.2 kbps;\nChannel_name = "DB";\n`,
    );
    const cluster = expectSuccess(result);
    expect(cluster.channelName).toBe('DB');
    expect(cluster.fileRevision).toBe('14.23.01');
    expect(result.issues.some((issue) => issue.messageKey === 'definition.ldf.issue.unknownSection')).toBe(
      false,
    );
  });

  it('ISO 17987 sürüm dizesini SAYIYA ÇEVİRMEZ, veri olarak taşır', () => {
    const cluster = expectSuccess(
      parseLdf(
        `LIN_description_file;\nLIN_protocol_version = "ISO17987:2015";\nLIN_language_version = "ISO17987:2015";\nLIN_speed = 19.2 kbps;\n`,
      ),
    );
    expect(cluster.protocolVersion).toBe('ISO17987:2015');
    // Lehçe dizesi 1.x DEĞİL, o yüzden geliştirilmiş checksum tarafına düşer.
    expect(
      resolveLdfChecksumModel({ ...cluster, frames: [] }, {
        name: 'F',
        kind: 'unconditional',
        frameId: 10,
        publisher: '',
        lengthBytes: 1,
        signals: [],
        collisionScheduleTable: '',
        associatedFrames: [],
        line: 1,
      }).model,
    ).toBe('enhanced');
  });

  it('LIN 2.0 lehçesinin `configurable_frames` mesaj kimliğini okur', () => {
    const cluster = expectSuccess(
      parseLdf(
        wrap(`Nodes { Master: M, 5 ms, 0.1 ms ; Slaves: S ; }
Node_attributes {
  S { LIN_protocol = "2.0" ; configured_NAD = 0x20 ;
      product_id = 0x4E4E, 0x4553, 1 ;
      configurable_frames { A=0x000; B = 0x0001; } }
}`),
      ),
    );
    expect(cluster.nodeAttributes[0]?.configurableFrames).toEqual([
      { name: 'A', messageId: 0 },
      { name: 'B', messageId: 1 },
    ]);
    expect(cluster.nodeAttributes[0]?.variant).toBe(1);
  });

  it('`product_id`de variant YOKSA sıfır UYDURMAZ', () => {
    const cluster = expectSuccess(
      parseLdf(
        wrap(`Node_attributes { S { LIN_protocol = "2.2" ; product_id = 0x4A4F, 0x4841 ; } }`),
      ),
    );
    expect(cluster.nodeAttributes[0]?.supplierId).toBe(0x4a4f);
    expect(cluster.nodeAttributes[0]?.functionId).toBe(0x4841);
    expect(cluster.nodeAttributes[0]?.variant).toBeUndefined();
  });

  it('sporadik çerçeveyi ilişkili çerçeveleriyle okur', () => {
    const cluster = expectSuccess(
      parseLdf(wrap('Sporadic_frames { Spor: F1, F2 ; }')),
    );
    const sporadic = findLdfFrame(cluster, 'Spor');
    expect(sporadic?.kind).toBe('sporadic');
    expect(sporadic?.frameId).toBeUndefined();
    expect(sporadic?.associatedFrames).toEqual(['F1', 'F2']);
  });

  it('`bcd_value` ve `ascii_value` gövdesiz girdileri okur', () => {
    const cluster = expectSuccess(
      parseLdf(wrap('Signal_encoding_types { E { bcd_value ; ascii_value ; } }')),
    );
    expect(cluster.encodingTypes[0]?.entries.map((entry) => entry.kind)).toEqual(['bcd', 'ascii']);
  });

  it('tekrar eden çerçeve kimliğini bildirir', () => {
    const result = parseLdf(
      wrap(`Signals { S: 8, 0, M, N ; }
Frames { A: 10, M, 1 { S, 0 ; } B: 10, M, 1 { S, 0 ; } }`),
    );
    expect(
      result.issues.some((issue) => issue.messageKey === 'definition.ldf.issue.duplicateFrameId'),
    ).toBe(true);
  });

  it('çerçeveye SIĞMAYAN sinyali bildirir', () => {
    const result = parseLdf(
      wrap(`Signals { Big: 16, 0, M, N ; }
Frames { A: 10, M, 1 { Big, 0 ; } }`),
    );
    expect(
      result.issues.some((issue) => issue.messageKey === 'definition.ldf.issue.signalOutOfFrame'),
    ).toBe(true);
  });

  it('tanımsız sinyale yapılan yerleşim referansını bildirir', () => {
    const result = parseLdf(wrap('Frames { A: 10, M, 1 { Ghost, 0 ; } }'));
    expect(
      result.issues.some(
        (issue) =>
          issue.messageKey === 'definition.ldf.issue.signalNotDefined' && issue.text === 'Ghost',
      ),
    ).toBe(true);
  });

  it('`Signal_representation`ta var olmayan sinyali bildirir', () => {
    const result = parseLdf(
      wrap(`Signal_encoding_types { E { logical_value, 0, "x" ; } }
Signal_representation { E: Ghost ; }`),
    );
    expect(
      result.issues.some(
        (issue) =>
          issue.messageKey === 'definition.ldf.issue.unknownEncodingSignal' &&
          issue.text === 'Ghost',
      ),
    ).toBe(true);
  });

  it('hiç çerçeve yoksa REDDETMEZ, uyarı üretir', () => {
    const result = parseLdf(wrap('Signals { S: 8, 0, M, N ; }'));
    expect(result.success).toBe(true);
    expect(result.issues.some((issue) => issue.messageKey === 'definition.ldf.issue.noFrames')).toBe(
      true,
    );
  });

  it('aralık dışı hızı bildirir ama dosyayı reddetmez', () => {
    const result = parseLdf(
      `LIN_description_file;\nLIN_protocol_version = "2.2";\nLIN_language_version = "2.2";\nLIN_speed = 250 kbps;\n`,
    );
    expect(result.success).toBe(true);
    expect(
      result.issues.some((issue) => issue.messageKey === 'definition.ldf.issue.speedOutOfRange'),
    ).toBe(true);
  });

  it('kapanmamış bölümü bildirir ama okunanı KORUR', () => {
    const result = parseLdf(wrap('Signals { S: 8, 0, M, N ;'));
    const cluster = expectSuccess(result);
    expect(cluster.signals).toHaveLength(1);
    expect(
      result.issues.some((issue) => issue.messageKey === 'definition.ldf.issue.unclosedSection'),
    ).toBe(true);
  });

  it('bozuk bildirimi bildirir ama dosyayı okumaya DEVAM eder', () => {
    const result = parseLdf(
      wrap(`Signals { ??? BOZUK ; Good: 8, 0, M, N ; }
Nodes { Master: M, 5 ms, 0.1 ms ; Slaves: N ; }`),
    );
    const cluster = expectSuccess(result);
    expect(cluster.master.name).toBe('M');
    expect(cluster.signals.map((signal) => signal.name)).toContain('Good');
    expect(
      result.issues.some((issue) => issue.messageKey === 'definition.ldf.issue.malformedEntry'),
    ).toBe(true);
  });

  it('bozuk bildirim uyarısını beşte keser — gürültü basmaz', () => {
    const broken = Array.from({ length: 20 }, () => '??? BOZUK ;').join('\n');
    const result = parseLdf(wrap(`Signals {\n${broken}\n}`));
    expect(
      result.issues.filter((issue) => issue.messageKey === 'definition.ldf.issue.malformedEntry'),
    ).toHaveLength(5);
  });

  it('bilinmeyen bölüm uyarısını da beşte keser', () => {
    const unknown = Array.from({ length: 12 }, (_value, index) => `Xyz${String(index)} { a ; }`).join('\n');
    const result = parseLdf(wrap(unknown));
    expect(
      result.issues.filter((issue) => issue.messageKey === 'definition.ldf.issue.unknownSection'),
    ).toHaveLength(5);
  });

  it('`composite` bölümünü SESSİZCE atlar — tanınır ama modellenmez', () => {
    const result = parseLdf(
      wrap(`composite { configuration C { Node1 { A, B ; } } }
Signals { S: 8, 0, M, N ; }`),
    );
    const cluster = expectSuccess(result);
    expect(cluster.signals).toHaveLength(1);
    expect(result.issues.some((issue) => issue.messageKey === 'definition.ldf.issue.unknownSection')).toBe(
      false,
    );
  });
});

describe('tokenizeLdf', () => {
  it('noktalama, sözcük ve dizeyi ayırır ve satır numarası taşır', () => {
    const tokens = tokenizeLdf('a = "x y" ;\nb {');
    expect(tokens.map((token) => `${token.kind}:${token.text}:${String(token.line)}`)).toEqual([
      'word:a:1',
      'punct:=:1',
      'string:x y:1',
      'punct:;:1',
      'word:b:2',
      'punct:{:2',
    ]);
  });

  it('bitişik yazılmış alanları ayırır', () => {
    // LIN 1.3 dosyasının gerçek yazımı — hiç boşluk yok.
    expect(tokenizeLdf('S:1,0,CEM,LSM;').map((token) => token.text)).toEqual([
      'S',
      ':',
      '1',
      ',',
      '0',
      ',',
      'CEM',
      ',',
      'LSM',
      ';',
    ]);
  });
});

describe('findLdfFrame / findLdfSignal', () => {
  it('bulunamayanda undefined döner', () => {
    expect(findLdfFrame(sample, 'yok')).toBeUndefined();
    expect(findLdfSignal(sample, 'yok')).toBeUndefined();
  });

  it('teşhis sinyalini de bulur', () => {
    expect(findLdfSignal(sample, 'MasterReqB0')?.diagnostic).toBe(true);
  });
});


describe('chooseDefaultLdfFrame — açılış çerçevesi', () => {
  it('teşhis çerçevelerini DIŞLAR ve en çok sinyalliyi seçer', () => {
    // `frames[0]` 1 sinyalli `Motor1_Dynamic`; teşhis çerçeveleri 8 sinyalli
    // ama anlamları LDF'te değil (spec 1.1.5.3), o yüzden ikisi de seçilmez.
    expect(sample.frames[0]?.name).toBe('Motor1_Dynamic');
    expect(chooseDefaultLdfFrame(sample)?.name).toBe(SAMPLE_LDF_UNALIGNED_FRAME);
  });

  it('eşitlikte DOSYA SIRASINI korur — seçim belirlenimci', () => {
    // Üç çerçeve de 3 sinyalli; dosyada ilk gelen kazanır.
    const threes = sample.frames.filter(
      (frame) => frame.kind === 'unconditional' && frame.signals.length === 3,
    );
    expect(threes).toHaveLength(3);
    expect(chooseDefaultLdfFrame(sample)?.name).toBe(threes[0]?.name);
  });

  it('yalnız teşhis çerçevesi varsa onu seçer, undefined DÖNMEZ', () => {
    const only = { ...sample, frames: sample.frames.filter((frame) => frame.kind === 'diagnostic') };
    expect(chooseDefaultLdfFrame(only)?.name).toBe('MasterReq');
  });

  it('yerleşim taşıyan çerçeve yoksa undefined döner', () => {
    expect(chooseDefaultLdfFrame({ ...sample, frames: [] })).toBeUndefined();
  });

  it('LIN 1.3 dosyasında da bir çerçeve seçer', () => {
    expect(chooseDefaultLdfFrame(lin13)?.name).toBe('VL1_LSM_Frm1');
  });
});

describe('ldfFrameDataLength', () => {
  it('bildirilmiş boyu kullanır', () => {
    expect(ldfFrameDataLength(findLdfFrame(sample, SAMPLE_LDF_UNALIGNED_FRAME)!)).toBe(6);
  });

  it('boy bildirilmemişse yerleşimlerden TÜRETİR ama modeli DEĞİŞTİRMEZ', () => {
    const unsized = findLdfFrame(lin13, SAMPLE_LIN13_UNSIZED_FRAME)!;
    // Model hâlâ "bilmiyorum" diyor; türetme yalnız örnek verinin boyu için.
    expect(unsized.lengthBytes).toBeUndefined();
    expect(ldfFrameDataLength(unsized)).toBe(8);
  });
});

describe('buildLdfSampleData — dosyanın kendi init_value ları', () => {
  it('skaler başlangıç değerini bit ofsetine LSB-first yazar', () => {
    const frame = findLdfFrame(sample, SAMPLE_LDF_UNALIGNED_FRAME)!;
    // `Motor1Temp: 7, 5` → 7 bit @ ofset 0 = 5. Kalanlar sıfır.
    expect(Array.from(buildLdfSampleData(sample, frame))).toEqual([5, 0, 0, 0, 0, 0]);
  });

  it('ürettiği veri KENDİ çözücüsüyle tur atar', () => {
    const frame = findLdfFrame(sample, 'Motor1State_Event')!;
    const decoded = decodeLdfFrame(buildLdfSampleData(sample, frame), sample, frame);
    // `Motor1ErrorCode: 8, 5` ve `Motor1ErrorValue: 8, 1`.
    expect(decoded.find((entry) => entry.signal.name === 'Motor1ErrorCode')?.rawValue).toBe(5);
    expect(decoded.find((entry) => entry.signal.name === 'Motor1ErrorValue')?.rawValue).toBe(1);
  });

  it('çerçevenin bildirdiği boyda veri üretir — sabit uzunluk YOK', () => {
    expect(buildLdfSampleData(sample, findLdfFrame(sample, 'Motor1_Dynamic')!)).toHaveLength(1);
    expect(buildLdfSampleData(sample, findLdfFrame(sample, 'MotorControl')!)).toHaveLength(2);
    expect(buildLdfSampleData(sample, findLdfFrame(sample, 'MasterReq')!)).toHaveLength(8);
  });

  it('HİZASIZ bayt dizisine YAZMAZ — okumayı reddettiği yere yazmak tutarsız olurdu', () => {
    const frame = findLdfFrame(sample, SAMPLE_LDF_UNALIGNED_FRAME)!;
    const data = buildLdfSampleData(sample, frame);
    expect(
      decodeLdfFrame(data, sample, frame).find((entry) => entry.signal.name === 'Motor1Position')
        ?.unalignedByteArray,
    ).toBe(true);
  });

  it('HİZALI bayt dizisinin init dizisini bildirim sırasıyla yazar', () => {
    const cluster = expectSuccess(
      parseLdf(
        wrap(`Nodes { Master: M, 5 ms, 0.1 ms ; Slaves: S ; }
Signals { Arr: 24, {1, 2, 3}, S, M ; }
Frames { F: 10, S, 4 { Arr, 8 ; } }
Schedule_tables { T { F delay 10 ms ; } }`),
      ),
    );
    expect(Array.from(buildLdfSampleData(cluster, findLdfFrame(cluster, 'F')!))).toEqual([
      0, 1, 2, 3,
    ]);
  });

  it('boyunu aşan init_value ı KIRPAR, komşu sinyale sarkmaz', () => {
    const cluster = expectSuccess(
      parseLdf(
        wrap(`Nodes { Master: M, 5 ms, 0.1 ms ; Slaves: S ; }
Signals { Small: 2, 255, S, M ; Next: 6, 0, S, M ; }
Frames { F: 10, S, 1 { Small, 0 ; Next, 2 ; } }
Schedule_tables { T { F delay 10 ms ; } }`),
      ),
    );
    // 255 iki bite sığmaz: alt iki bit yazılır (0b11), üstteki `Next` sıfır kalır.
    expect(Array.from(buildLdfSampleData(cluster, findLdfFrame(cluster, 'F')!))).toEqual([0b11]);
  });

  it('boy bildirmeyen LIN 1.3 çerçevesinde de veri üretir', () => {
    const frame = findLdfFrame(lin13, 'VL1_LSM_Frm1')!;
    expect(buildLdfSampleData(lin13, frame)).toHaveLength(4);
  });
});

import { describe, expect, it } from 'vitest';

import { decodePulseLog } from '@/protocol-core/decoding/pulseLog';
import type { ParseFailure, ParsedField, ParseSuccess, ProtocolError, ProtocolWarning } from '@/protocol-core/types';

import { SENT_PROFILE_CHOICES, buildSentPulseLog, decodeSentNibbles, forceReservedPulse, sentParser, sentPlugin } from './sent';
import { buildSpcPulseLog, parseSpc, spcParser, spcPlugin } from './spc';

function expectSuccess(result: ReturnType<typeof parseSpc>): asserts result is ParseSuccess {
  if (!result.success) throw new Error(`beklenmedik başarısızlık: ${result.error.code} — ${result.error.message}`);
}

function expectFailure(result: ReturnType<typeof parseSpc>): asserts result is ParseFailure {
  if (result.success) throw new Error('beklenmedik başarı');
}

describe('spc, sent’in ÇÖZÜCÜSÜNÜ TÜKETİR — ikinci nibble çözücü YOK', () => {
  it('decodeOptions’ın sensorProfile şıkları sent’in SENT_PROFILE_CHOICES’ıyla AYNI referanstır', () => {
    const option = spcPlugin.decodeOptions?.find((o) => o.id === 'sensorProfile');
    expect(option?.choices).toBe(SENT_PROFILE_CHOICES);
  });

  it('yanıt çerçevesinin alan tablosu decodeSentNibbles’ın ÜRETTİĞİ alanlarla BİREBİR AYNIDIR', () => {
    const bytes = buildSpcPulseLog({ includeResponse: true });
    const result = parseSpc(bytes);
    expectSuccess(result);

    // Aynı fonksiyonu KENDİMİZ çağırıp (startPulseIndex=1, trigger'dan SONRA)
    // parseSpc'nin ürettiği alanlarla karşılaştırıyoruz — spc.ts İKİNCİ bir
    // çözücü yazmışsa buradaki alanlar BİREBİR eşleşmez.
    const decoded = decodePulseLog(bytes);
    if (!decoded.ok) throw new Error('expected ok');
    const expectedFields: ParsedField[] = [];
    const expectedWarnings: ProtocolWarning[] = [];
    const expectedErrors: ProtocolError[] = [];
    decodeSentNibbles(bytes, decoded.result.pulses, 1, 6, expectedFields, expectedWarnings, expectedErrors);

    const responseFields = result.frame.fields.filter((f) => f.id !== 'profile' && f.id !== 'trigger');
    expect(responseFields).toEqual(expectedFields);
    // Uyarılar da (CRC doğrulanmadı, Slow Channel kısmi vb.) AYNI kaynaktan gelmeli.
    for (const warning of expectedWarnings) {
      expect(result.frame.warnings).toContainEqual(warning);
    }
  });
});

describe('parseSpc — tetik + yanıt', () => {
  it('geçerli tetik + yanıt çerçevesini başarıyla çözer', () => {
    const result = parseSpc(buildSpcPulseLog({ includeResponse: true }));
    expectSuccess(result);
    expect(result.frame.valid).toBe(true);
    expect(result.frame.fields[0]?.id).toBe('profile');
    expect(result.frame.fields[1]?.id).toBe('trigger');
    expect(result.frame.fields.some((f) => f.id === 'sync')).toBe(true);
    expect(result.frame.fields.some((f) => f.id === 'crc')).toBe(true);
  });

  it('tetik darbesinin süresi ayrı bir alanda görünür', () => {
    const result = parseSpc(buildSpcPulseLog({ includeResponse: true, triggerDurationUs: 777 }));
    expectSuccess(result);
    expect(result.frame.fields.find((f) => f.id === 'trigger')?.physicalValue).toBe('777.0');
  });

  it('"No response" — tetikten sonra hiç nabız yoksa çerçeve geçersiz işaretlenir (ParseResult yine success)', () => {
    const result = parseSpc(buildSpcPulseLog({ includeResponse: false }));
    expectSuccess(result);
    expect(result.frame.valid).toBe(false);
    expect(result.frame.errors.some((e) => e.message === 'protocol.spc.error.noResponse')).toBe(true);
    expect(result.frame.warnings.some((w) => w.code === 'protocol.spc.warning.noResponse')).toBe(true);
    // Tetik alanı yine de GÖSTERİLİR — kısmi çözüm (types.ts doktrini).
    expect(result.frame.fields.find((f) => f.id === 'trigger')).toBeDefined();
  });

  it('"Trigger too short" vekili — rezerve (0x0000) tetik darbesi geçersiz işaretlenir', () => {
    const bytes = forceReservedPulse(buildSpcPulseLog({ includeResponse: true }), 0);
    const result = parseSpc(bytes);
    expectSuccess(result);
    expect(result.frame.valid).toBe(false);
    expect(result.frame.fields.find((f) => f.id === 'trigger')?.valid).toBe(false);
    expect(result.frame.errors.some((e) => e.message === 'protocol.spc.error.triggerTooShort')).toBe(true);
  });

  it('yarıda kesilmiş yanıt (tam SENT çerçevesi için yetersiz nabız) ParseResult FAILURE döner', () => {
    const result = parseSpc(buildSpcPulseLog({ includeResponse: true, truncateResponse: true }));
    expectFailure(result);
    expect(result.error.code).toBe('truncated-frame');
  });

  it('boş girdi truncated-frame ile başarısız olur', () => {
    const result = parseSpc(new Uint8Array());
    expectFailure(result);
    expect(result.error.code).toBe('truncated-frame');
  });

  it('tek uzunlukta girdi truncated-frame ile başarısız olur', () => {
    const result = parseSpc(new Uint8Array(3));
    expectFailure(result);
  });

  it('maxFrameLength aşılırsa frame-too-long ile başarısız olur', () => {
    const bytes = buildSpcPulseLog({ includeResponse: true });
    const result = spcParser.parse(bytes, { maxFrameLength: 2 });
    expectFailure(result);
    expect(result.error.code).toBe('frame-too-long');
  });

  it('iptal edilmiş sinyal parser-timeout ile başarısız olur', () => {
    const controller = new AbortController();
    controller.abort();
    const bytes = buildSpcPulseLog({ includeResponse: true });
    const result = spcParser.parse(bytes, { signal: controller.signal });
    expectFailure(result);
    expect(result.error.code).toBe('parser-timeout');
  });
});

describe('spcParser.canParse — tetik + sent’in İMZASINI (pulses.slice(1)) kullanır', () => {
  it('kendi örnek çerçeveleri (yanıtlı olanlar) true döner', () => {
    for (const example of spcPlugin.exampleFrames) {
      if (example.id === 'no-response' || example.id === 'trigger-reserved' || example.id === 'truncated-response') {
        continue; // yapısal olarak imzayı GEÇMEMESİ beklenen örnekler.
      }
      expect(spcParser.canParse(example.bytes), example.id).toBe(true);
    }
  });

  it('tetiksiz (yalnız yanıt) bir SENT çerçevesi SPC imzasını GEÇMEZ — trigger konumunda sync bekleniyor', () => {
    const sentOnly = buildSentPulseLog({ statusNibble: 1, dataNibbles: [1, 2, 3, 4, 5, 6], crcNibble: 7 });
    // spc.canParse pulses[0]'ı TETİK sayar, pulses.slice(1)'i imzaya sokar —
    // burada pulses[1]'den itibaren GERÇEK bir SENT imzası yakalanamamalı
    // (status/data nibble'ları senkron darbesi GİBİ mutlak banda düşmüyor).
    expect(spcParser.canParse(sentOnly)).toBe(false);
  });

  it('rezerve tetik darbesi canParse’i false’a düşürür', () => {
    const bytes = forceReservedPulse(buildSpcPulseLog({ includeResponse: true }), 0);
    expect(spcParser.canParse(bytes)).toBe(false);
  });

  it('"No response" örneği canParse’i GEÇMEZ (yalnız tetik, minimum imza kurulamaz)', () => {
    const noResponse = spcPlugin.exampleFrames.find((f) => f.id === 'no-response');
    if (noResponse === undefined) throw new Error('örnek bulunamadı');
    expect(spcParser.canParse(noResponse.bytes)).toBe(false);
  });
});

describe('sent ve spc birbirinin örneklerini YANLIŞ POZİTİF kabul etmez', () => {
  it('sent’in canParse’i spc’nin (yanıtlı) örneklerini true KABUL ETMEZ', () => {
    for (const example of spcPlugin.exampleFrames) {
      if (example.id === 'no-response') continue; // sync'i bile yok, zaten anlamsız.
      expect(sentParser.canParse(example.bytes), example.id).toBe(false);
    }
  });

  it('spc’nin canParse’i sent’in örneklerini true KABUL ETMEZ', () => {
    for (const example of sentPlugin.exampleFrames) {
      expect(spcParser.canParse(example.bytes), example.id).toBe(false);
    }
  });
});

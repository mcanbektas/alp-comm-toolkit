import { describe, expect, it } from 'vitest';

import type { ParsedField, ProtocolError, ProtocolWarning } from '@/protocol-core/types';

import {
  ADDRESS_FORMAT_BROADCAST,
  ADDRESS_FORMAT_MULTICAST,
  ADDRESS_FORMAT_UID,
  ADDRESS_FORMAT_UNICAST,
  FOREIGN_FRAME_LABELS_HIDE,
  FOREIGN_FRAME_LABELS_NUMERIC,
  NEURON_ID_AS_TRANSMITTED,
  NEURON_ID_REVERSED,
  PDU_FORMAT_APDU,
  PDU_FORMAT_AUTHPDU,
  PDU_FORMAT_SPDU,
  PDU_FORMAT_TPDU,
  decodeLonTalkPdu,
  responseCodeCandidates,
} from './lonTalk';
import type { FieldSink, LonTalkDecodeOptions } from './lonTalk';
import { SNVT_RAW } from './snvtTypes';

/**
 * Faz 10 dalga 17 — LonTalk (ISO/IEC 14908-1) PDU'su.
 *
 * Bu dosyanın omurgası **KOŞULLU OFSET ZİNCİRİDİR**: adres uzunluğu adres
 * biçimine VE biçim 2'de bir seçici bite bağlı, domain uzunluğu ayrı bir
 * alana, taşıma okteti PDU biçimine göre var ya da yok. Tek bir yanlış ofset
 * hata VERMEDEN yanlış alan basar, bu yüzden HER DAL ayrı sınanır.
 */

const DEFAULTS: LonTalkDecodeOptions = {
  nvPayloadType: SNVT_RAW,
  neuronIdByteOrder: NEURON_ID_AS_TRANSMITTED,
  foreignFrameCodeLabels: FOREIGN_FRAME_LABELS_NUMERIC,
};

function bytes(hex: string): Uint8Array {
  const parts = hex.trim().split(/\s+/);
  return Uint8Array.from(parts, (part) => Number.parseInt(part, 16) & 0xff);
}

interface Run {
  readonly fields: ParsedField[];
  readonly warnings: ProtocolWarning[];
  readonly errors: ProtocolError[];
  readonly summary: ReturnType<typeof decodeLonTalkPdu>;
}

function run(hex: string, options: Partial<LonTalkDecodeOptions> = {}): Run {
  const data = bytes(hex);
  const sink: FieldSink = { fields: [], usedIds: new Set() };
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];
  const summary = decodeLonTalkPdu(data, 0, sink, warnings, errors, { ...DEFAULTS, ...options });
  return { fields: sink.fields, warnings, errors, summary };
}

function field(result: Run, id: string): ParsedField {
  const found = result.fields.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`missing field ${id}`);
  return found;
}

function offsetOf(result: Run, id: string): number {
  return field(result, id).offset;
}

/** Örnek 1)'in PDU'su: TPDU ACKD + NV, adres biçimi 2a, tek baytlık domain. */
const PDU_TPDU_ACKD_NV = '01 09 01 AA 01 A9 01 03 81 0D 00 CA';

describe('PPDU ve NPDU oktetleri', () => {
  it('ilk bayt TAMAMEN öncelik/alt-yol/backlog`tur — SÜRÜM ORADA DEĞİLDİR', () => {
    const result = run('C5 09 01 AA 01 A9 01 03 81 0D 00 CA');
    expect(field(result, 'lontalk-priority').rawValue).toBe(1);
    expect(field(result, 'lontalk-alt-path').rawValue).toBe(1);
    expect(field(result, 'lontalk-delta-backlog').rawValue).toBe(5);
    // Sürüm İKİNCİ baytın 7:6 bitleridir; ilk bayt 0xC5 olmasına rağmen 0.
    expect(field(result, 'lontalk-npdu-version').rawValue).toBe(0);
  });

  it('NPDU okteti dört alanı MSB-first bölüştürür', () => {
    const result = run(PDU_TPDU_ACKD_NV);
    expect(field(result, 'lontalk-pdu-format').physicalValue).toBe('TPDU');
    expect(field(result, 'lontalk-address-format').physicalValue).toBe('Unicast (2a/2b)');
    expect(field(result, 'lontalk-domain-length').physicalValue).toBe('1 B');
    expect(result.summary.pduFormat).toBe(PDU_FORMAT_TPDU);
    expect(result.summary.addressFormat).toBe(ADDRESS_FORMAT_UNICAST);
  });
});

describe('adres bölümü — Figure 3.2`nin beş dalı', () => {
  it('biçim 2a: seçici biti 1, adres DÖRT bayt', () => {
    const result = run(PDU_TPDU_ACKD_NV);
    expect(result.summary.unicastSelector).toBe(true);
    expect(field(result, 'lontalk-src-subnet').rawValue).toBe(1);
    expect(field(result, 'lontalk-src-node').physicalValue).toContain('42');
    expect(field(result, 'lontalk-dst-subnet').rawValue).toBe(1);
    expect(field(result, 'lontalk-dst-node').physicalValue).toBe('41');
    // Adres 4 bayt → domain +6`da, taşıma okteti +7`de.
    expect(offsetOf(result, 'lontalk-domain')).toBe(6);
    expect(offsetOf(result, 'lontalk-transaction')).toBe(7);
  });

  it('biçim 2b: seçici biti 0, adres ALTI bayt ve +4 DESTINATION SUBNET`tir', () => {
    // Aynı çerçevenin kaynak düğüm baytı 0xAA → 0x2A (MSB temizlendi).
    const result = run('01 09 01 2A 01 A9 07 09 01 03 81 0D 00 CA');
    expect(result.summary.unicastSelector).toBe(false);
    expect(field(result, 'lontalk-src-node').physicalValue).toContain('format 2b');
    // Wireshark burada "destination group" diyor; normatif Figure 3.2 ve
    // go-lon "DstSubnet" diyor ve HAKEM spec`tir.
    expect(field(result, 'lontalk-dst-subnet').offset).toBe(4);
    expect(field(result, 'lontalk-dst-node').physicalValue).toBe('41');
    expect(field(result, 'lontalk-group').rawValue).toBe(7);
    expect(field(result, 'lontalk-group-member').rawValue).toBe(9);
    // Adres 6 bayt → domain +8, taşıma okteti +9.
    expect(offsetOf(result, 'lontalk-domain')).toBe(8);
    expect(offsetOf(result, 'lontalk-transaction')).toBe(9);
  });

  it('biçim 0 (broadcast): adres ÜÇ bayt, üçüncüsü hedef ALT AĞIDIR', () => {
    const result = run('01 01 01 AA 00 01 03');
    expect(result.summary.addressFormat).toBe(ADDRESS_FORMAT_BROADCAST);
    expect(field(result, 'lontalk-dst-subnet').physicalValue).toContain('domain-wide');
    expect(offsetOf(result, 'lontalk-domain')).toBe(5);
  });

  it('biçim 1 (multicast): üçüncü bayt hedef GRUPTUR, alt ağ değil', () => {
    const result = run('01 05 01 AA 2A 01 03');
    expect(result.summary.addressFormat).toBe(ADDRESS_FORMAT_MULTICAST);
    expect(field(result, 'lontalk-dst-group').rawValue).toBe(0x2a);
    expect(result.fields.some((candidate) => candidate.id === 'lontalk-dst-subnet')).toBe(false);
    expect(result.warnings.map((warning) => warning.code)).toContain('decodePathNotVerified');
  });

  it('biçim 3 (UID): adres DOKUZ bayt — go-lon`un domain`i beşte bıraktığı yer', () => {
    const result = run('01 0D 01 AA 01 11 22 33 44 55 66 07 03');
    expect(result.summary.addressFormat).toBe(ADDRESS_FORMAT_UID);
    expect(field(result, 'lontalk-neuron-id').length).toBe(6);
    expect(field(result, 'lontalk-neuron-id').rawValue).toBe('11 22 33 44 55 66');
    // 1+1+1+6 = 9 → domain +11. go-lon burada +5 kalıyor ve domain`i UID`nin
    // ORTASINDAN okuyor; bu assert o hatanın kopyalanmadığını bekçiliyor.
    expect(offsetOf(result, 'lontalk-domain')).toBe(11);
    expect(field(result, 'lontalk-domain').rawValue).toBe('07');
  });

  it('Neuron ID bayt sırası kullanıcı isteğiyle ters çevrilebilir', () => {
    const result = run('01 0D 01 AA 01 11 22 33 44 55 66 07 03', {
      neuronIdByteOrder: NEURON_ID_REVERSED,
    });
    expect(String(field(result, 'lontalk-neuron-id').physicalValue)).toContain('66 55 44 33 22 11');
    // HAM baytlar DEĞİŞMEZ — ters çevirme yalnız görünümdür.
    expect(field(result, 'lontalk-neuron-id').rawValue).toBe('11 22 33 44 55 66');
  });
});

describe('domain uzunluğu — `0/1/2/3 → 0/1/3/6` BAYT', () => {
  it('kod 2 ÜÇ bayttır, iki değil', () => {
    const result = run('01 0A 01 AA 01 A9 AA BB CC 03 81 0D 00 CA');
    expect(field(result, 'lontalk-domain').length).toBe(3);
    expect(field(result, 'lontalk-domain').rawValue).toBe('AA BB CC');
    // İki bayt sayılsaydı taşıma okteti bir bayt geriden okunurdu.
    expect(offsetOf(result, 'lontalk-transaction')).toBe(9);
  });

  it('kod 3 ALTI bayttır', () => {
    const result = run('01 0B 01 AA 01 A9 11 22 33 44 55 66 03');
    expect(field(result, 'lontalk-domain').length).toBe(6);
    expect(offsetOf(result, 'lontalk-transaction')).toBe(12);
  });

  it('kod 0 domain alanını SIFIR uzunlukta basar — alan yine görünür', () => {
    const result = run('01 08 01 AA 01 A9 03');
    expect(field(result, 'lontalk-domain').length).toBe(0);
    expect(field(result, 'lontalk-domain').physicalValue).toContain('domain-wide');
    expect(offsetOf(result, 'lontalk-transaction')).toBe(6);
  });
});

describe('taşıma / oturum / kimlik okteti', () => {
  it('TPDU tipleri adlandırılır ve transaction numarası basılır', () => {
    expect(field(run(PDU_TPDU_ACKD_NV), 'lontalk-tsa-type').physicalValue).toBe('ACKD');
    expect(field(run('01 09 01 A9 01 AA 01 23'), 'lontalk-tsa-type').physicalValue).toBe('ACK');
    // İki çerçeve AYNI transaction numarasını taşır — eşleşmenin kanıtı.
    expect(field(run(PDU_TPDU_ACKD_NV), 'lontalk-transaction').rawValue).toBe(3);
    expect(field(run('01 09 01 A9 01 AA 01 23'), 'lontalk-transaction').rawValue).toBe(3);
  });

  it('SPDU tipleri AYRI bir tablodan gelir (1 UnACKD_RPT SPDU`da YOKTUR)', () => {
    expect(field(run('01 19 01 C9 01 98 01 0B 73 07'), 'lontalk-tsa-type').physicalValue).toBe(
      'REQUEST',
    );
    const response = run('01 19 01 98 01 C9 01 2B 33 07');
    expect(field(response, 'lontalk-tsa-type').physicalValue).toBe('RESPONSE');
    expect(response.summary.pduFormat).toBe(PDU_FORMAT_SPDU);
  });

  it('APDU biçiminde taşıma okteti HİÇ YOKTUR', () => {
    const result = run('00 39 01 C9 01 9D 01 BF FF 00 00 02');
    expect(result.summary.pduFormat).toBe(PDU_FORMAT_APDU);
    expect(result.fields.some((candidate) => candidate.id === 'lontalk-transaction')).toBe(false);
    // APDU domain`in HEMEN ardından başlar: +7.
    expect(offsetOf(result, 'lontalk-apdu-class')).toBe(7);
  });

  it('AuthPDU maskeleri `0xC0`/`0x30`tur — Wireshark`ın gösterim maskeleri DEĞİL', () => {
    // Oktet 0xAB → fmt=2 (adres biçimi yankısı), tip=2 (REPLY), trans=0x0B.
    // Wireshark`ın KAYITLI maskeleri (`0x0c`/`0x02`) okunsaydı tip (0xAB & 0x0C)
    // = 8 çıkardı ve hiçbir ada karşılık gelmezdi; doğru maske `lcs_tsa.c:89`in
    // `BITS3(fmt, 2, pduMsgType, 2, transNum, 4)` satırından gelen `0x30`dur.
    const result = run('01 29 01 AA 01 A9 01 AB 11 22 33 44 55 66 77 88 99');
    expect(result.summary.pduFormat).toBe(PDU_FORMAT_AUTHPDU);
    expect(field(result, 'lontalk-auth-format').physicalValue).toBe('Unicast (2a/2b)');
    expect(field(result, 'lontalk-tsa-type').physicalValue).toBe('REPLY');
    expect(field(result, 'lontalk-transaction').rawValue).toBe(0x0b);
    expect(field(result, 'lontalk-auth-body').length).toBe(9);
    expect(result.warnings.map((warning) => warning.code)).toContain('decodePathNotVerified');
  });

  it('REMINDER `M_Len` + `M_List` okur ve APDU`ya GEÇMEZ', () => {
    const result = run('01 09 01 AA 01 A9 01 43 03 AA BB CC');
    expect(field(result, 'lontalk-tsa-type').physicalValue).toBe('REMINDER');
    expect(field(result, 'lontalk-m-len').rawValue).toBe(3);
    expect(field(result, 'lontalk-m-list').rawValue).toBe('AA BB CC');
    expect(result.fields.some((candidate) => candidate.id === 'lontalk-apdu-class')).toBe(false);
  });

  it('REM/MSG `M_List`in ARDINDAN APDU çözer', () => {
    const result = run('01 09 01 AA 01 A9 01 53 02 AA BB 81 0D 00 CA');
    expect(field(result, 'lontalk-tsa-type').physicalValue).toBe('REM/MSG');
    expect(field(result, 'lontalk-m-list').length).toBe(2);
    expect(field(result, 'lontalk-nv-selector').rawValue).toBe(269);
  });
});

describe('APDU kod uzayı — beş dal `0x00`–`0xFF`i kaplar', () => {
  it('`1dxxxxxx` iki baytlık NV`dir ve selector 14 BİTTİR', () => {
    const result = run(PDU_TPDU_ACKD_NV);
    expect(field(result, 'lontalk-apdu-class').physicalValue).toBe('Network Variable');
    expect(field(result, 'lontalk-nv-direction').physicalValue).toBe('incoming');
    expect(field(result, 'lontalk-nv-selector').rawValue).toBe(0x010d);
    expect(field(result, 'lontalk-nv-selector').length).toBe(2);
    expect(field(result, 'lontalk-nv-payload').rawValue).toBe('00 CA');
    // Selector`ın en büyük değeri 0x3FFF`tir: 14 bit.
    const maximum = run('00 39 01 C9 01 9D 01 BF FF 00');
    expect(field(maximum, 'lontalk-nv-selector').rawValue).toBe(0x3fff);
    expect(field(maximum, 'lontalk-nv-direction').physicalValue).toBe('incoming');
  });

  it('yön biti `d` kod baytının 6. bitidir', () => {
    const outgoing = run('01 09 01 AA 01 A9 01 03 C1 0D 00 CA');
    expect(field(outgoing, 'lontalk-nv-direction').physicalValue).toBe('outgoing');
    expect(field(outgoing, 'lontalk-nv-selector').rawValue).toBe(0x010d);
  });

  it('HER NV çözümünde `nvTypeNotOnWire` KOŞULSUZ basılır', () => {
    for (const hex of [PDU_TPDU_ACKD_NV, '00 39 01 C9 01 9D 01 BF FF 00 00 02']) {
      expect(run(hex).warnings.map((warning) => warning.code)).toContain('nvTypeNotOnWire');
    }
  });

  it('`011xxxxx` ağ yönetimi, `0101xxxx` ağ tanı, `0100xxxx` foreign frame`dir', () => {
    expect(field(run('01 19 01 C9 01 98 01 0B 73 07'), 'lontalk-nm-code').physicalValue).toBe(
      'NM_NV_FETCH',
    );
    expect(field(run('01 19 01 C9 01 98 01 0B 53'), 'lontalk-nd-code').physicalValue).toBe(
      'ND_CLEAR_STATUS',
    );
    expect(field(run('00 39 01 BD 01 8C 01 4D 0C'), 'lontalk-apdu-class').physicalValue).toBe(
      'Foreign Frame',
    );
  });

  it('Foreign Frame kodu gizlenebilir — anlam tablosu hiçbir kaynakta yok', () => {
    const shown = run('00 39 01 BD 01 8C 01 4D 0C');
    expect(field(shown, 'lontalk-foreign-code').rawValue).toBe(0x0d);
    const hidden = run('00 39 01 BD 01 8C 01 4D 0C', {
      foreignFrameCodeLabels: FOREIGN_FRAME_LABELS_HIDE,
    });
    expect(hidden.fields.some((candidate) => candidate.id === 'lontalk-foreign-code')).toBe(false);
    // Sınıf yine basılır: boş kart yasağı.
    expect(field(hidden, 'lontalk-apdu-class').physicalValue).toBe('Foreign Frame');
  });

  it('`NM_MANUAL_SERVICE_REQUEST` kodun ardından 6+8 baytlık kuyruk taşır', () => {
    const result = run('01 19 01 C9 01 98 01 0B 7F 11 22 33 44 55 66 80 00 01 02 03 04 05 06');
    expect(field(result, 'lontalk-nm-code').physicalValue).toBe('NM_MANUAL_SERVICE_REQUEST');
    expect(field(result, 'lontalk-service-neuron-id').length).toBe(6);
    expect(field(result, 'lontalk-program-id').length).toBe(8);
  });
});

describe('NM/ND yanıt kodu ÇAKIŞMASI — `[KARAR 17-5]`', () => {
  it('gerçek yakalamanın `0x33`ü İKİ ADAY birden verir', () => {
    // 0x73 & 0x1F = 0x13, p=1 → 001_10011 = 0x33 (NM başarı yanıtı) ve
    // AYNI bayt ND_CLEAR_STATUS (0x53) yanıtı olarak da geçerlidir.
    const candidates = responseCodeCandidates(0x33);
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toContain('NM_NV_FETCH');
    expect(candidates[1]).toContain('ND_CLEAR_STATUS');
    expect(candidates[0]).toContain('success');
  });

  it('`p` biti temizken iki aday da BAŞARISIZLIK yanıtı olur', () => {
    const candidates = responseCodeCandidates(0x13);
    expect(candidates).toHaveLength(2);
    expect(candidates.every((candidate) => candidate.includes('failure'))).toBe(true);
  });

  it('4. bit temizken ND adayı DÜŞER — biçim `00p1xxxx`tir', () => {
    const candidates = responseCodeCandidates(0x23);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toContain('NM_UPDATE_DOMAIN');
  });

  it('uyarı YALNIZ SPDU RESPONSE içinde basılır', () => {
    const response = run('01 19 01 98 01 C9 01 2B 33 07');
    expect(response.warnings.map((warning) => warning.code)).toContain('responseCodeAmbiguous');
    expect(String(field(response, 'lontalk-app-code').physicalValue)).toContain('NM_NV_FETCH');
    expect(String(field(response, 'lontalk-app-code').physicalValue)).toContain('ND_CLEAR_STATUS');

    // Aynı kod bir TPDU içinde uyarı ÜRETMEZ: çakışma yanıt bağlamına özgüdür.
    const inTpdu = run('01 09 01 AA 01 A9 01 03 33 07');
    expect(inTpdu.warnings.map((warning) => warning.code)).not.toContain('responseCodeAmbiguous');
    expect(field(inTpdu, 'lontalk-app-code').physicalValue).toBe('51');
  });

  it('UYDURMA bir "NM yanıtı" ADI basılmaz — alanın adı Application Code KALIR', () => {
    const response = run('01 19 01 98 01 C9 01 2B 33 07');
    expect(field(response, 'lontalk-app-code').name).toBe('LonTalk · Application Code');
    expect(field(response, 'lontalk-apdu-class').physicalValue).toBe('Application (generic)');
  });
});

describe('SNVT ölçeği — kullanıcı bildirdiğinde', () => {
  it('aynı `00 CA` yükü seçilen tipe göre farklı okunur', () => {
    const asTemp = run(PDU_TPDU_ACKD_NV, { nvPayloadType: 'SNVT_temp' });
    expect(field(asTemp, 'lontalk-nv-scaled').physicalValue).toBe(-253.8);
    expect(field(asTemp, 'lontalk-nv-scaled').unit).toBe('°C');

    const asTempP = run(PDU_TPDU_ACKD_NV, { nvPayloadType: 'SNVT_temp_p' });
    expect(field(asTempP, 'lontalk-nv-scaled').physicalValue).toBe(2.02);

    const asPercent = run(PDU_TPDU_ACKD_NV, { nvPayloadType: 'SNVT_lev_percent' });
    expect(field(asPercent, 'lontalk-nv-scaled').physicalValue).toBe(1.01);
    expect(field(asPercent, 'lontalk-nv-scaled').unit).toBe('%');
  });

  it('tip seçilmezse ölçekli alan HİÇ BASILMAZ — değer HAM kalır', () => {
    const result = run(PDU_TPDU_ACKD_NV);
    expect(result.fields.some((candidate) => candidate.id === 'lontalk-nv-scaled')).toBe(false);
    expect(field(result, 'lontalk-nv-payload').rawValue).toBe('00 CA');
  });

  it('boy uyuşmazsa ölçek UYGULANMAZ ve uyarılır', () => {
    const result = run('00 39 01 C9 01 9D 01 BF FF 00 00 02', { nvPayloadType: 'SNVT_temp' });
    expect(field(result, 'lontalk-nv-scaled').valid).toBe(false);
    expect(String(field(result, 'lontalk-nv-scaled').physicalValue)).toContain('not scaled');
    expect(result.warnings.map((warning) => warning.code)).toContain('nvPayloadLengthMismatch');
  });

  it('boyutsuz tipte `unit` ATANMAZ', () => {
    const result = run(PDU_TPDU_ACKD_NV, { nvPayloadType: 'SNVT_count' });
    expect(field(result, 'lontalk-nv-scaled').physicalValue).toBe(202);
    expect(field(result, 'lontalk-nv-scaled').unit).toBeUndefined();
  });
});

describe('kesik çerçeveler', () => {
  it('taşıma oktetine yer kalmadan biten çerçeve `truncated-frame` basar', () => {
    // Gerçek yakalamanın TEK böyle çerçevesinin PDU'su.
    const result = run('80 00 00 01 00');
    expect(result.errors.map((error) => error.code)).toEqual(['truncated-frame']);
    expect(result.summary.readable).toBe(false);
    // KISMİ çözüm yine gösterilir: adres ve domain alanları basılmış olmalı.
    expect(field(result, 'lontalk-priority').rawValue).toBe(1);
    expect(field(result, 'lontalk-dst-subnet').offset).toBe(4);
  });

  it('adres bölümü sığmazsa okunamaz sayılır', () => {
    expect(run('01 09 01 AA').errors.map((error) => error.code)).toEqual(['truncated-frame']);
  });

  it('domain sığmazsa okunamaz sayılır', () => {
    expect(run('01 0B 01 AA 01 A9 11 22').errors.map((error) => error.code)).toEqual([
      'truncated-frame',
    ]);
  });

  it('iki bayttan kısa PDU okunamaz', () => {
    expect(run('01').errors.map((error) => error.code)).toEqual(['truncated-frame']);
  });
});

describe('alan kimliği benzersizliği', () => {
  it('düz tabloda hiçbir `ParsedField.id` tekrarlamaz', () => {
    for (const hex of [
      PDU_TPDU_ACKD_NV,
      '01 0D 01 AA 01 11 22 33 44 55 66 07 03',
      '01 09 01 AA 01 A9 01 53 02 AA BB 81 0D 00 CA',
      '01 29 01 AA 01 A9 01 AB 11 22 33 44 55 66 77 88 99',
    ]) {
      const result = run(hex);
      const ids = result.fields.map((candidate) => candidate.id);
      expect(new Set(ids).size, hex).toBe(ids.length);
    }
  });
});

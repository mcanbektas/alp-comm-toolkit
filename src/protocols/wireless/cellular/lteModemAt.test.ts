import { describe, expect, it } from 'vitest';

import {
  createCellularInitializationState,
  lteModemAtParser,
  lteModemAtPlugin,
  maskSensitiveIdentifier,
} from './lteModemAt';
import type { ParseFailure, ParseResult, ParseSuccess, ParsedField, ParsedFrame } from '@/protocol-core/types';

function expectSuccess(result: ParseResult): ParseSuccess {
  if (!result.success) {
    throw new Error(`expected success, got error "${result.error.code}"`);
  }
  return result;
}

function expectFailure(result: ParseResult): ParseFailure {
  if (result.success) {
    throw new Error('expected failure, got success');
  }
  return result;
}

function fieldById(frame: ParsedFrame, id: string): ParsedField {
  const field = frame.fields.find((candidate) => candidate.id === id);
  if (field === undefined) {
    throw new Error(`field "${id}" not found among [${frame.fields.map((f) => f.id).join(', ')}]`);
  }
  return field;
}

function hasField(frame: ParsedFrame, id: string): boolean {
  return frame.fields.some((field) => field.id === id);
}

function ascii(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function parse(text: string): ParsedFrame {
  return expectSuccess(lteModemAtParser.parse(ascii(text))).frame;
}

describe('lteModemAtParser — AT+CSQ', () => {
  it('20,99: RSSI dBm’e çevrilir, BER bilinmiyor uyarısı verir', () => {
    const frame = parse('+CSQ: 20,99\r\n');

    expect(fieldById(frame, 'csq-rssi').rawValue).toBe(20);
    expect(fieldById(frame, 'csq-rssi').physicalValue).toBe(-73); // -113 + 2×20
    expect(fieldById(frame, 'csq-rssi').unit).toBe('dBm');
    expect(fieldById(frame, 'csq-ber').rawValue).toBe(99);
    expect(fieldById(frame, 'csq-ber').warnings).toContain('protocol.lteModemAt.warning.csqUnknown');
  });

  it('doygunluk uçları: 0 → −113 dBm (ya da daha az), 31 → −51 dBm (ya da daha fazla)', () => {
    expect(fieldById(parse('+CSQ: 0,0\r\n'), 'csq-rssi').physicalValue).toBe(-113);
    expect(fieldById(parse('+CSQ: 31,0\r\n'), 'csq-rssi').physicalValue).toBe(-51);
  });

  it('BER hiçbir zaman yüzdeye çevrilmez — satıcılar arasında tablo çelişiyor', () => {
    const frame = parse('+CSQ: 15,2\r\n');
    expect(fieldById(frame, 'csq-ber').physicalValue).toBeUndefined();
    expect(fieldById(frame, 'csq-ber').unit).toBeUndefined();
  });
});

describe('lteModemAtParser — AT+COPS?', () => {
  it('alphanumeric biçimde operatör adını çözer, MCC/MNC üretmez', () => {
    const frame = parse('+COPS: 0,0,"Example Operator",7\r\n');

    expect(fieldById(frame, 'cops-mode').physicalValue).toBe('automatic');
    expect(fieldById(frame, 'cops-format').physicalValue).toBe('long alphanumeric');
    expect(fieldById(frame, 'cops-operator').rawValue).toBe('Example Operator');
    expect(hasField(frame, 'cops-mcc')).toBe(false);
    expect(fieldById(frame, 'access-technology').physicalValue).toBe('E-UTRAN');
  });

  it('numeric biçimde MCC/MNC ayrıştırılır', () => {
    const frame = parse('+COPS: 1,2,"90170",2\r\n');

    expect(fieldById(frame, 'cops-mode').physicalValue).toBe('manual');
    expect(fieldById(frame, 'cops-mcc').rawValue).toBe('901');
    expect(fieldById(frame, 'cops-mnc').rawValue).toBe('70');
  });

  it('AcT ≥ 8 satıcı çakışma uyarısı taşır (SIMCom 8=CDMA/HDR ↔ spec 8=EC-GSM-IoT)', () => {
    const collision = fieldById(parse('+COPS: 1,2,"90170",8\r\n'), 'access-technology');
    const stable = fieldById(parse('+COPS: 1,2,"90170",7\r\n'), 'access-technology');

    expect(collision.warnings).toContain('protocol.lteModemAt.warning.accessTechnologyVendorCollision');
    expect(stable.warnings).toEqual([]);
  });

  it('operatör alanı yokken mode dışında hiçbir alan üretmez', () => {
    const frame = parse('+COPS: 0\r\n');

    expect(fieldById(frame, 'cops-mode').physicalValue).toBe('automatic');
    expect(hasField(frame, 'cops-operator')).toBe(false);
    expect(hasField(frame, 'access-technology')).toBe(false);
  });
});

describe('lteModemAtParser — AT+CREG? / AT+CEREG?', () => {
  it('CREG: LAC/hücre kimliği hex’ten ondalığa çevrilir', () => {
    const frame = parse('+CREG: 2,1,"1A2D","0001A2B3",7\r\n');

    expect(fieldById(frame, 'registration-status').physicalValue).toBe('registered, home network');
    expect(fieldById(frame, 'lac').rawValue).toBe('1A2D');
    expect(fieldById(frame, 'lac').physicalValue).toBe(0x1a2d);
    expect(fieldById(frame, 'cell-id').physicalValue).toBe(0x0001a2b3);
    expect(hasField(frame, 'tac')).toBe(false);
  });

  it('CEREG: alan adı tac olur, lac YOK — aynı motor iki farklı alan adı üretir', () => {
    const frame = parse('+CEREG: 2,8,"1A2D","0001A2B3",9\r\n');

    expect(fieldById(frame, 'tac').rawValue).toBe('1A2D');
    expect(hasField(frame, 'lac')).toBe(false);
    expect(fieldById(frame, 'registration-status').physicalValue).toBe('attached for emergency bearer services only');
    expect(fieldById(frame, 'access-technology').physicalValue).toBe('E-UTRAN (NB-S1 mode)');
  });

  it('cause_type/reject_cause YAPISAL çözülür, ANLAMI uydurulmaz', () => {
    const frame = parse('+CEREG: 3,3,"1A2D","0001A2B3",7,0,14\r\n');

    expect(fieldById(frame, 'cause-type').physicalValue).toBe('standart (MM/EMM cause)');
    expect(fieldById(frame, 'reject-cause').rawValue).toBe(14);
    // "EPS services not allowed in this PLMN" gibi bir metin HİÇBİR alanda olmamalı.
    expect(frame.fields.some((field) => typeof field.physicalValue === 'string' && field.physicalValue.includes('PLMN'))).toBe(
      false,
    );
  });

  it('yalnız <n>,<stat> verilince konum alanları üretilmez', () => {
    const frame = parse('+CREG: 0,5\r\n');

    expect(fieldById(frame, 'registration-status').physicalValue).toBe('registered, roaming');
    expect(hasField(frame, 'lac')).toBe(false);
    expect(hasField(frame, 'cell-id')).toBe(false);
  });
});

describe('lteModemAtParser — AT+CGATT?', () => {
  it('0/1 dışında değeri de yapısal olarak taşır, hata üretmez', () => {
    expect(fieldById(parse('+CGATT: 1\r\n'), 'attach-state').physicalValue).toBe('attached');
    expect(fieldById(parse('+CGATT: 0\r\n'), 'attach-state').physicalValue).toBe('detached');
  });
});

describe('lteModemAtParser — AT+CGDCONT?', () => {
  it('altı sabit alanı çözer, boş PDP adresini HİÇ alan üretmeden atlar', () => {
    const frame = parse('+CGDCONT: 1,"IP","example.apn","",0,0\r\n');

    expect(fieldById(frame, 'context-id').rawValue).toBe(1);
    expect(fieldById(frame, 'pdp-type').rawValue).toBe('IP');
    expect(fieldById(frame, 'apn').rawValue).toBe('example.apn');
    expect(hasField(frame, 'pdp-address')).toBe(false);
    expect(fieldById(frame, 'data-compression').physicalValue).toBe('off');
    expect(fieldById(frame, 'header-compression').physicalValue).toBe('off');
  });

  it('dolu PDP adresi varsa alan üretilir', () => {
    const frame = parse('+CGDCONT: 1,"IP","example.apn","10.20.30.40",0,0\r\n');
    expect(fieldById(frame, 'pdp-address').rawValue).toBe('10.20.30.40');
  });

  it('eski (obsolete) PDP türlerinde uyarı verir', () => {
    const frame = parse('+CGDCONT: 1,"X.25","example.apn","",0,0\r\n');
    expect(fieldById(frame, 'pdp-type').warnings).toContain('protocol.lteModemAt.warning.pdpTypeObsolete');
  });

  it('altıdan fazla parametre gelirse kalanı ham+uyarılı tek alanda toplar', () => {
    const frame = parse('+CGDCONT: 1,"IP","example.apn","",0,0,0,0,0,1\r\n');

    expect(fieldById(frame, 'additional-parameters').rawValue).toBe('0,0,0,1');
    expect(fieldById(frame, 'additional-parameters').warnings).toContain(
      'protocol.lteModemAt.warning.cgdcontTailNotDecoded',
    );
  });
});

describe('lteModemAtParser — AT+CPIN?', () => {
  it('bilinen kodu uyarısız taşır', () => {
    expect(fieldById(parse('+CPIN: READY\r\n'), 'pin-status').warnings).toEqual([]);
    expect(fieldById(parse('+CPIN: SIM PIN\r\n'), 'pin-status').rawValue).toBe('SIM PIN');
  });

  it('tanınmayan kodu hata SAYMAZ, yalnız uyarı ekler', () => {
    const frame = parse('+CPIN: VENDOR CUSTOM\r\n');
    expect(fieldById(frame, 'pin-status').rawValue).toBe('VENDOR CUSTOM');
    expect(fieldById(frame, 'pin-status').warnings).toContain('protocol.lteModemAt.warning.cpinUnrecognizedCode');
    expect(frame.valid).toBe(true);
  });
});

describe('lteModemAtParser — AT+CGSN', () => {
  it('prefiksli form (=1) KESİN IMEI olarak çözülür, hassas-veri uyarısı taşır', () => {
    const frame = parse('+CGSN: "490154203237518"\r\n');

    expect(fieldById(frame, 'serial-number').rawValue).toBe('490154203237518');
    expect(fieldById(frame, 'serial-number').warnings).toContain('protocol.lteModemAt.warning.sensitiveExportValue');
  });

  it('çıplak form BELİRSİZ sayısal kimlik sayılır — IMEI mi IMSI mi İDDİA EDİLMEZ', () => {
    const frame = parse('490154203237518\r\n');

    expect(fieldById(frame, 'numeric-identifier').rawValue).toBe('490154203237518');
    expect(fieldById(frame, 'numeric-identifier').warnings).toContain(
      'protocol.lteModemAt.warning.bareIdentifierAmbiguous',
    );
    expect(hasField(frame, 'serial-number')).toBe(false);
  });
});

describe('lteModemAtParser — AT+CIMI', () => {
  it('çıplak IMSI de aynı belirsiz sayısal kimlik yoluna düşer', () => {
    const frame = parse('460023210226023\r\n');
    expect(fieldById(frame, 'numeric-identifier').rawValue).toBe('460023210226023');
  });

  it('5 haneden kısa ya da 15 haneden uzun rakam dizisi kimlik SAYILMAZ', () => {
    expect(hasField(parse('1234\r\n'), 'numeric-identifier')).toBe(false);
    expect(hasField(parse('1234567890123456\r\n'), 'numeric-identifier')).toBe(false);
  });
});

describe('lteModemAtParser — AT+CCLK?', () => {
  it('TS 27.007’nin kendi örneği: "+08" DÖRT değil İKİ saat demektir (94/05/06,22:10:00+08 → GMT+2)', () => {
    // Spec metninden birebir: yıl burada YALNIZ formülü doğrulamak için
    // kullanılıyor, `date` alanının 20xx varsayımı bu girdide "2094" üretir —
    // beklenen (bkz. lteModemAt.ts'teki yorum), gerçek örnek/test fixture'ı
    // güncel bir yıl kullanır.
    const frame = parse('+CCLK: "94/05/06,22:10:00+08"\r\n');

    expect(fieldById(frame, 'timezone-offset').rawValue).toBe('+08');
    expect(fieldById(frame, 'timezone-offset').physicalValue).toBe(2);
    expect(fieldById(frame, 'timezone-offset').unit).toBe('h');
  });

  it('güncel bir tarihte date alanı 20xx olarak doğru kurulur', () => {
    const frame = parse('+CCLK: "26/08/20,14:30:00+08"\r\n');

    expect(fieldById(frame, 'date').rawValue).toBe('26/08/20');
    expect(fieldById(frame, 'date').physicalValue).toBe('2026-08-20');
    expect(fieldById(frame, 'time').rawValue).toBe('14:30:00');
  });

  it('negatif saat dilimi de dörde bölünür', () => {
    const frame = parse('+CCLK: "24/01/15,10:30:00-20"\r\n');
    expect(fieldById(frame, 'timezone-offset').physicalValue).toBe(-5);
  });

  it('saat dilimi verilmezse alan hiç üretilmez', () => {
    const frame = parse('+CCLK: "24/01/15,10:30:00"\r\n');
    expect(hasField(frame, 'timezone-offset')).toBe(false);
  });
});

describe('lteModemAtParser — at-commands geçişkenliği', () => {
  it('OK/ERROR gibi temel satırlar aynen (protocol adı hariç) geçer', () => {
    const frame = parse('OK\r\n');
    expect(frame.protocol).toBe('lte-modem-at');
    expect(fieldById(frame, 'result-code').rawValue).toBe('OK');
  });

  it('boş girdide truncated-frame — hata yolu at-commands’tan devralınır', () => {
    expect(expectFailure(lteModemAtParser.parse(new Uint8Array(0))).error.code).toBe('truncated-frame');
  });

  it('canParse at-commands ile aynı davranır', () => {
    expect(lteModemAtParser.canParse(new Uint8Array(0))).toBe(false);
    expect(lteModemAtParser.canParse(ascii('OK'))).toBe(true);
  });
});

describe('maskSensitiveIdentifier', () => {
  it('yalnız son 4 haneyi görünür bırakır', () => {
    expect(maskSensitiveIdentifier('490154203237518')).toBe('•••••••••••7518');
  });

  it('4 haneden kısa değerde tamamı maskelenir', () => {
    expect(maskSensitiveIdentifier('123')).toBe('•••');
  });

  it('rakam dışı karakterleri (boşluk, tire) yok sayar', () => {
    expect(maskSensitiveIdentifier('490-154-203-237-518')).toBe(maskSensitiveIdentifier('490154203237518'));
  });
});

describe('createCellularInitializationState', () => {
  it('birden çok komut yanıtını tek bir görünümde biriktirir', () => {
    const state = createCellularInitializationState();

    state.ingest(parse('+CGSN: "490154203237518"\r\n'));
    state.ingest(parse('+CPIN: READY\r\n'));
    state.ingest(parse('+COPS: 0,0,"Example Operator",7\r\n'));
    state.ingest(parse('+CREG: 2,1,"1A2D","0001A2B3",7\r\n'));

    expect(state.snapshot).toEqual({
      imei: '490154203237518',
      simStatus: 'READY',
      operatorName: 'Example Operator',
      operatorSelectionMode: 'automatic',
      accessTechnology: 'E-UTRAN',
      registrationStatus: 'registered, home network',
    });
  });

  it('yeni değeri olmayan bir çerçeve önceki alanları SİLMEZ', () => {
    const state = createCellularInitializationState();
    state.ingest(parse('+CGSN: "490154203237518"\r\n'));
    state.ingest(parse('OK\r\n'));

    expect(state.snapshot.imei).toBe('490154203237518');
  });

  it('reset tüm biriktirilen durumu temizler', () => {
    const state = createCellularInitializationState();
    state.ingest(parse('+CGSN: "490154203237518"\r\n'));
    state.reset();

    expect(state.snapshot).toEqual({});
  });
});

describe('lteModemAtPlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır', () => {
    expect(lteModemAtPlugin.id).toBe('lte-modem-at');
    expect(lteModemAtPlugin.category).toBe('wireless-iot');
    expect(lteModemAtPlugin.parser).toBe(lteModemAtParser);
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of lteModemAtPlugin.exampleFrames) {
      const result = lteModemAtParser.parse(example.bytes);
      if (!result.success) {
        throw new Error(`example "${example.id}" failed: ${result.error.code}`);
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.lteModemAt.example. önekli çeviri anahtarıdır', () => {
    for (const example of lteModemAtPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.lteModemAt.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.lteModemAt.example.'), example.id).toBe(true);
    }
  });

  it('on komutun tamamını en az bir örnekte kapsar', () => {
    const ids = lteModemAtPlugin.exampleFrames.map((example) => example.id);
    for (const expected of [
      'csq',
      'cops-alphanumeric',
      'creg-registered',
      'cereg-emergency',
      'cgatt-attached',
      'cgdcont-full',
      'cimi-bare',
      'cgsn-bare',
      'cgsn-prefixed',
      'cclk',
      'cpin-ready',
    ]) {
      expect(ids, expected).toContain(expected);
    }
  });
});

import { describe, expect, it } from 'vitest';

import { parseSmbus, smbusParser, smbusPlugin, transactionName } from './smbus';
import { computeSmbusPec, splitSmbusTransaction } from './smbusCore';

/** Adres 0x5A'nın yazma/okuma bayt karşılıkları — testlerin her yerinde aynı cihaz. */
const ADDR_W = 0xb4;
const ADDR_R = 0xb5;

function withPec(body: number[]): Uint8Array {
  return Uint8Array.from([...body, computeSmbusPec(Uint8Array.from(body))]);
}

describe('computeSmbusPec', () => {
  it("standart CRC-8 check değeri: '123456789' → 0xF4", () => {
    // SMBus 3.1 §5.4'ün C(x)=x8+x2+x+1 polinomunun check değeri. Depodaki
    // `crcEngine.test.ts` de aynı sabiti bağımsızca doğruluyor.
    const bytes = Uint8Array.from([...'123456789'].map((character) => character.charCodeAt(0)));

    expect(computeSmbusPec(bytes)).toBe(0xf4);
  });

  it('Read Word paketinin PEC baytı bağımsız hesapla örtüşüyor', () => {
    // Bağımsız bit-bit referans uygulama (dalga 11i doğrulama turu) aynı 0xBB'yi verdi.
    expect(computeSmbusPec(Uint8Array.from([ADDR_W, 0x8b, ADDR_R, 0xf3, 0x19]))).toBe(0xbb);
  });

  it('kapsam adres baytını İÇERİR — adres değişince PEC değişir', () => {
    const withAddress = computeSmbusPec(Uint8Array.from([ADDR_W, 0x8b]));
    const withoutAddress = computeSmbusPec(Uint8Array.from([0x8b]));

    expect(withAddress).not.toBe(withoutAddress);
  });
});

describe('splitSmbusTransaction — spec özetinin 11 transaction türü', () => {
  it('Quick Command: tek adres baytı', () => {
    expect(splitSmbusTransaction(Uint8Array.from([ADDR_W])).kind).toBe('quick-command');
  });

  it('Send Byte: adres + komut', () => {
    const structure = splitSmbusTransaction(Uint8Array.from([ADDR_W, 0x03]));

    expect(structure.kind).toBe('send-byte');
    expect(structure.commandCode).toBe(0x03);
    expect(structure.writeData).toHaveLength(0);
  });

  it('Receive Byte: adres Read yönünde + tek veri baytı, komut YOK', () => {
    const structure = splitSmbusTransaction(Uint8Array.from([ADDR_R, 0x42]));

    expect(structure.kind).toBe('receive-byte');
    expect(structure.commandCode).toBeUndefined();
    expect(structure.writeData).toEqual(Uint8Array.from([0x42]));
  });

  it('Write Byte: adres + komut + tek veri', () => {
    const structure = splitSmbusTransaction(Uint8Array.from([ADDR_W, 0x00, 0x01]));

    expect(structure.kind).toBe('write-byte');
    expect(structure.writeData).toEqual(Uint8Array.from([0x01]));
  });

  it('Write Word: adres + komut + iki veri', () => {
    expect(splitSmbusTransaction(Uint8Array.from([ADDR_W, 0x21, 0x00, 0x30])).kind).toBe('write-word');
  });

  it('Read Byte: repeated START + tek veri', () => {
    const structure = splitSmbusTransaction(Uint8Array.from([ADDR_W, 0x20, ADDR_R, 0x17]));

    expect(structure.kind).toBe('read-byte');
    expect(structure.repeatedStartOffset).toBe(2);
    expect(structure.readData).toEqual(Uint8Array.from([0x17]));
  });

  it('Read Word: spec özetinin KENDİ örneği (S, Addr+W, Cmd, Sr, Addr+R, DataLow, DataHigh)', () => {
    const structure = splitSmbusTransaction(Uint8Array.from([ADDR_W, 0x8b, ADDR_R, 0xf3, 0x19]));

    expect(structure.kind).toBe('read-word');
    expect(structure.commandCode).toBe(0x8b);
    expect(structure.readData).toEqual(Uint8Array.from([0xf3, 0x19]));
  });

  it('Process Call: komuttan sonra iki bayt yazılır, sonra iki bayt okunur', () => {
    const structure = splitSmbusTransaction(
      Uint8Array.from([ADDR_W, 0x50, 0x11, 0x22, ADDR_R, 0x33, 0x44]),
    );

    expect(structure.kind).toBe('process-call');
    expect(structure.writeData).toEqual(Uint8Array.from([0x11, 0x22]));
    expect(structure.readData).toEqual(Uint8Array.from([0x33, 0x44]));
  });

  it('Block Write: sayaç baytı kendisinden sonraki bayt sayısına eşit', () => {
    const structure = splitSmbusTransaction(
      Uint8Array.from([ADDR_W, 0x44, 0x03, 0xaa, 0xbb, 0xcc]),
    );

    expect(structure.kind).toBe('block-write');
    expect(structure.blockCount).toBe(3);
  });

  it('Block Read: repeated START sonrası sayaç + veri', () => {
    const structure = splitSmbusTransaction(
      Uint8Array.from([ADDR_W, 0x44, ADDR_R, 0x04, 0xde, 0xad, 0xbe, 0xef]),
    );

    expect(structure.kind).toBe('block-read');
    expect(structure.blockCount).toBe(4);
  });

  it('Block Write-Block Read Process Call: iki tarafta da sayaç tutuyor', () => {
    // PMBus COEFFICIENTS (30h) iskeleti: yazma tarafı 2 bayt, okuma tarafı 5 bayt.
    const structure = splitSmbusTransaction(
      Uint8Array.from([ADDR_W, 0x30, 0x02, 0x8b, 0x01, ADDR_R, 0x05, 0x01, 0x00, 0x9c, 0xff, 0x03]),
    );

    expect(structure.kind).toBe('block-write-block-read');
    expect(structure.blockCount).toBe(5);
  });

  it('sınıflandırılamayan şekil sessizce bir türe zorlanmaz', () => {
    // Yön dönmemiş, blok sayacı tutmayan 6 baytlık gövde.
    expect(splitSmbusTransaction(Uint8Array.from([ADDR_W, 0x10, 0x00, 0x00, 0x00, 0x00])).kind).toBe(
      'unknown',
    );
  });
});

describe('splitSmbusTransaction — belirsizlik ve PEC', () => {
  it('Write Word ile Block Write aynı baytlara uyduğunda sabit boyut kazanır, alternatif kaydedilir', () => {
    // count=1 + tek veri baytı = Block Write okuması; aynı baytlar Write Word da olabilir.
    const structure = splitSmbusTransaction(Uint8Array.from([ADDR_W, 0x21, 0x01, 0xab]));

    expect(structure.kind).toBe('write-word');
    expect(structure.alternativeKinds).toEqual(['block-write']);
  });

  it('son bayt gövdenin CRC-8i ise PEC olarak ayrılır ve gövde kısalır', () => {
    const frame = withPec([ADDR_W, 0x8b, ADDR_R, 0xf3, 0x19]);
    const structure = splitSmbusTransaction(frame);

    expect(structure.pec.present).toBe(true);
    expect(structure.pec.received).toBe(0xbb);
    expect(structure.pec.calculated).toBe(0xbb);
    expect(structure.pec.coverageBytes).toBe(5);
    expect(structure.kind).toBe('read-word');
    expect(structure.body).toHaveLength(5);
  });

  it('PEC tutmuyorsa gövde bozulmadan kalır, hesaplanan değer yine raporlanır', () => {
    const structure = splitSmbusTransaction(Uint8Array.from([ADDR_W, 0x00, 0x01]));

    expect(structure.pec.present).toBe(false);
    expect(structure.pec.received).toBeUndefined();
    expect(structure.pec.calculated).toBe(computeSmbusPec(Uint8Array.from([ADDR_W, 0x00, 0x01])));
    expect(structure.pec.coverageBytes).toBe(3);
    expect(structure.kind).toBe('write-byte');
  });
});

describe('parseSmbus', () => {
  it('boş çerçeve kurtarılabilir hata döndürür', () => {
    const result = parseSmbus(new Uint8Array(0));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('truncated-frame');
      expect(result.recoverable).toBe(true);
    }
  });

  it('PEC alanı çerçevenin SON baytına hizalanır (hex viewer renklendirmesi)', () => {
    const frame = withPec([ADDR_W, 0x8b, ADDR_R, 0xf3, 0x19]);
    const result = parseSmbus(frame);

    expect(result.success).toBe(true);
    if (!result.success) return;
    const pecField = result.frame.fields.find((field) => field.id === 'pec');
    expect(pecField?.offset).toBe(5);
    expect(pecField?.length).toBe(1);
    // Alanların toplamı çerçevenin tamamını kapsar — bayt sessizce düşmez.
    const covered = result.frame.fields.reduce((total, field) => total + field.length, 0);
    expect(covered).toBe(frame.length);
  });

  it('çıkarım uyarısı PEC baytını işaret eder', () => {
    const result = parseSmbus(withPec([ADDR_W, 0x8b, ADDR_R, 0xf3, 0x19]));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.frame.warnings.map((warning) => warning.code)).toContain('pec-inferred');
  });

  it('belirsiz şekilde uyarı üretilir', () => {
    const result = parseSmbus(Uint8Array.from([ADDR_W, 0x21, 0x01, 0xab]));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.frame.warnings.map((warning) => warning.code)).toContain('ambiguous-shape');
  });

  it('metadata transaction adını ve PEC panelinin alanlarını taşır', () => {
    const result = parseSmbus(withPec([ADDR_W, 0x8b, ADDR_R, 0xf3, 0x19]));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.frame.rawFrame.metadata).toMatchObject({
      transactionName: 'Read Word',
      pecPresent: true,
      pecCalculated: '0xBB',
      pecReceived: '0xBB',
      pecCoverageBytes: 5,
    });
  });

  it('canParse boş olmayan her diziyi kabul eder (I²C ile aynı: ayırt edici imza yok)', () => {
    expect(smbusParser.canParse(Uint8Array.from([ADDR_W]))).toBe(true);
    expect(smbusParser.canParse(new Uint8Array(0))).toBe(false);
  });
});

describe('smbusPlugin', () => {
  it('örnek çerçevelerin hepsi çözülür', () => {
    for (const example of smbusPlugin.exampleFrames ?? []) {
      const result = smbusParser.parse(example.bytes);
      expect(result.success, example.id).toBe(true);
    }
  });

  it('PEC taşıyan örneklerin sağlaması gerçekten tutuyor (uydurma bayt yok)', () => {
    for (const id of ['read-word-pec', 'block-read-pec']) {
      const example = (smbusPlugin.exampleFrames ?? []).find((frame) => frame.id === id);
      expect(example, id).toBeDefined();
      if (!example) continue;
      const structure = splitSmbusTransaction(example.bytes);
      expect(structure.pec.present, id).toBe(true);
    }
  });

  it('transaction adları veri olarak sabit (çeviri anahtarı değil)', () => {
    expect(transactionName('block-write-block-read')).toBe('Block Write-Block Read Process Call');
  });
});

import { describe, expect, it } from 'vitest';

import {
  MAX_EXPANDED_CHARACTERS,
  UART_8N1,
  bitsPerCharacter,
  buildCharacterFields,
  describeCharacter,
  differentialLines,
  expandUartCharacter,
  formatBinaryByte,
  formatDifferentialLine,
  formatUartLine,
} from './uartLineCore';

describe('expandUartCharacter — spec özetinin KENDİ bit görünümü örneği', () => {
  /**
   * `docs/spec/ozet/01-fiziksel-arayuzler.md:117` (RS-232 bölümü): 9600 8N1,
   * Data=0x41='A' → `Start D0..D7 Stop = 0 1 0 0 0 0 0 1 0 1`. Bu fixture
   * bağımsız olarak da doğrulanabilir: 0x41 = 0b01000001, LSB-first D0..D7 =
   * 1 0 0 0 0 0 1 0.
   */
  it('0x41 için Start(0) + LSB-first veri + Stop(1) üretir', () => {
    const line = expandUartCharacter(0x41, UART_8N1);
    expect(formatBinaryByte(0x41)).toBe('01000001');
    expect(line.startBit).toBe(0);
    expect(line.dataBits).toEqual([1, 0, 0, 0, 0, 0, 1, 0]);
    expect(line.parityBit).toBeUndefined();
    expect(line.stopBits).toEqual([1]);
    expect(line.levels).toEqual([0, 1, 0, 0, 0, 0, 0, 1, 0, 1]);
  });

  it('8N1 karakteri 10 bit sürer (spec formülü)', () => {
    expect(bitsPerCharacter(UART_8N1)).toBe(10);
    expect(expandUartCharacter(0x41, UART_8N1).levels).toHaveLength(10);
  });

  it('hat görünümü start · veri · stop olarak gruplanır', () => {
    expect(formatUartLine(expandUartCharacter(0x41, UART_8N1))).toBe('0 10000010 1');
  });
});

describe('expandUartCharacter — parity ve stop biti varyasyonları', () => {
  // 8N1 dışı konfigürasyonlar bu dalgada UI'a bağlı DEĞİL; çekirdek sıradaki
  // alt-dalga (#5 uart/rs-232/ttl-uart/cmos-uart) için burada sabitlendi.
  it('even parity veri bitlerindeki 1 sayısını çift tamamlar', () => {
    // 0x41 içinde iki adet 1 var (zaten çift) → parity 0.
    expect(expandUartCharacter(0x41, { dataBits: 8, parity: 'even', stopBits: 1 }).parityBit).toBe(
      0,
    );
    // 0x01 içinde tek adet 1 var → parity 1.
    expect(expandUartCharacter(0x01, { dataBits: 8, parity: 'even', stopBits: 1 }).parityBit).toBe(
      1,
    );
  });

  it('odd parity even parity bitinin tersidir', () => {
    expect(expandUartCharacter(0x41, { dataBits: 8, parity: 'odd', stopBits: 1 }).parityBit).toBe(1);
    expect(expandUartCharacter(0x01, { dataBits: 8, parity: 'odd', stopBits: 1 }).parityBit).toBe(0);
  });

  it('8E2 karakteri 12 bit sürer ve hat görünümünde parity ayrı grup olur', () => {
    const config = { dataBits: 8, parity: 'even' as const, stopBits: 2 };
    expect(bitsPerCharacter(config)).toBe(12);
    expect(formatUartLine(expandUartCharacter(0x01, config))).toBe('0 10000000 1 11');
  });

  it('7 veri bitinde yalnız D0..D6 açılır', () => {
    const line = expandUartCharacter(0xff, { dataBits: 7, parity: 'none', stopBits: 1 });
    expect(line.dataBits).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect(line.levels).toHaveLength(9);
  });
});

describe('formatDifferentialLine — spec RS-422 eşlemesi', () => {
  /**
   * Spec özeti (`01-fiziksel-arayuzler.md:113-118`): `UART 1 0 1 1 0` →
   * `Vdiff +V −V +V +V −V`. Yani logic 1 → `+`, logic 0 → `−`.
   */
  it('logic 1 pozitif, logic 0 negatif', () => {
    expect(formatDifferentialLine([1, 0, 1, 1, 0])).toBe('+−++−');
  });

  it('0x41 karakterinin tüm hattını V_AB olarak verir', () => {
    expect(formatDifferentialLine(expandUartCharacter(0x41, UART_8N1).levels)).toBe('−+−−−−−+−+');
  });
});

describe('describeCharacter — alan tablosunda görünen metin', () => {
  it('basılabilir baytta ASCII karşılığını da gösterir', () => {
    expect(describeCharacter(0x41)).toBe("0x41 'A' · 0 10000010 1");
  });

  it('kontrol baytında ASCII sütunu boş kalır', () => {
    expect(describeCharacter(0x0d)).toBe('0x0D · 0 10110000 1');
  });
});

describe('buildCharacterFields', () => {
  it('her bayt için bir alan üretir, offset ve ham bayt doğru', () => {
    const fields = buildCharacterFields(Uint8Array.from([0x4f, 0x4b]));
    expect(fields).toHaveLength(2);
    expect(fields[0]?.id).toBe('char0');
    expect(fields[0]?.name).toBe('Character 1');
    expect(fields[0]?.offset).toBe(0);
    expect(fields[0]?.rawValue).toBe(0x4f);
    expect(fields[1]?.offset).toBe(1);
    expect(fields[1]?.rawBytes).toEqual(Uint8Array.from([0x4b]));
  });

  it('idPrefix/namePrefix/baseOffset ikinci diziyi ayırır (RS-485 echo yolu)', () => {
    const fields = buildCharacterFields(Uint8Array.from([0x01]), UART_8N1, {
      idPrefix: 'echo',
      namePrefix: 'Echo · ',
      baseOffset: 4,
    });
    expect(fields[0]?.id).toBe('echochar0');
    expect(fields[0]?.name).toBe('Echo · Character 1');
    expect(fields[0]?.offset).toBe(4);
  });

  /**
   * Dalga 11a/11b'nin iki hatası da "veri sessizce kayboluyor" sınıfındaydı
   * (onewire CRC kapsama off-by-one'ı, qspiCore kısmi adres baytları). Sınır
   * burada görünür bir alana dönüşüyor mu, testle sabitlendi.
   */
  it('sınırın üstündeki baytlar sessizce düşmez, kalan alanına toplanır', () => {
    const length = MAX_EXPANDED_CHARACTERS + 3;
    const data = Uint8Array.from({ length }, (_unused, index) => index & 0xff);
    const fields = buildCharacterFields(data);

    expect(fields).toHaveLength(MAX_EXPANDED_CHARACTERS + 1);
    const remaining = fields[fields.length - 1];
    expect(remaining?.id).toBe('remaining');
    expect(remaining?.offset).toBe(MAX_EXPANDED_CHARACTERS);
    expect(remaining?.length).toBe(3);
    expect(remaining?.rawBytes).toHaveLength(3);

    const coveredBytes = fields.reduce((total, field) => total + field.length, 0);
    expect(coveredBytes).toBe(length);
  });

  it('sınırın tam üstünde kalan alanı hiç açılmaz', () => {
    const data = new Uint8Array(MAX_EXPANDED_CHARACTERS);
    const fields = buildCharacterFields(data);
    expect(fields).toHaveLength(MAX_EXPANDED_CHARACTERS);
    expect(fields.some((field) => field.id === 'remaining')).toBe(false);
  });
});

describe('differentialLines', () => {
  it('açılan her karakter için bir V_AB dizisi verir', () => {
    expect(differentialLines(Uint8Array.from([0x41, 0x00]))).toEqual([
      '−+−−−−−+−+',
      '−−−−−−−−−+',
    ]);
  });

  it('alan sınırıyla aynı sayıda kalır (uzun yakalamada şişmez)', () => {
    const data = new Uint8Array(MAX_EXPANDED_CHARACTERS + 5);
    expect(differentialLines(data)).toHaveLength(MAX_EXPANDED_CHARACTERS);
  });
});

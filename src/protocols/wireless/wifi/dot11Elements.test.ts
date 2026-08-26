import { describe, expect, it } from 'vitest';

import type { ParsedField, ProtocolError, ProtocolWarning } from '@/protocol-core/types';

import {
  DOT11_ELEMENT_DEFAULT_OPTIONS,
  ELEMENT_NAMES,
  IE_NAME_SET_NONE,
  RSN_SUITE_LABELS_HIDE,
  UNKNOWN_IE_HIDDEN,
  VENDOR_IE_LABEL_ONLY,
  VENDOR_IE_RAW,
  pushDot11Elements,
  walkDot11Elements,
} from './dot11Elements';
import type { Dot11ElementOptions } from './dot11Elements';
import { createFieldSink } from './dot11Frame';

/**
 * Faz 10 dalga 18b — Information Element yürüyücüsünün birim testleri.
 *
 * İki şeyi sınar ve ikincisi bu dalganın BÜTÜN MESELESİDİR:
 *   1. gerçek Beacon'ın ON element'i tek tek doğru ofset/uzunlukla okunuyor mu,
 *   2. **RSN'in iç içe sayaç zinciri bozulduğunda ne oluyor** — sessizce kayan
 *      bir çözüm mü, yoksa hata + uyarı + ham kalan mı.
 */

function hexToBytes(hex: string): Uint8Array {
  const parts = hex.trim().split(/\s+/);
  const bytes = new Uint8Array(parts.length);
  for (let index = 0; index < parts.length; index += 1) {
    bytes[index] = Number.parseInt(parts[index] ?? '0', 16) & 0xff;
  }
  return bytes;
}

/**
 * Gerçek Beacon'ın (144 B) ELEMENT ZİNCİRİ — MAC başlığı (24) ve sabit
 * alanlar (12) SOYULMUŞ, FCS (4) atılmış hâli. Ham kaynak
 * `wpa-Induction.pcap`; `wifi.ts`teki `FRAME_BEACON`un 36..140 aralığı.
 */
const BEACON_ELEMENTS =
  '00 07 43 6f 68 65 72 65 72 01 08 82 84 8b 96 24 30 48 6c 03 01 01 05 04 ' +
  '00 01 00 00 2a 01 02 2f 01 02 30 18 01 00 00 0f ac 02 02 00 00 0f ac 04 ' +
  '00 0f ac 02 01 00 00 0f ac 02 00 00 32 04 0c 12 18 60 dd 06 00 10 18 02 ' +
  '00 04 dd 1c 00 50 f2 01 01 00 00 50 f2 02 02 00 00 50 f2 04 00 50 f2 02 ' +
  '01 00 00 50 f2 02 00 00';

interface Pushed {
  readonly fields: readonly ParsedField[];
  readonly warnings: readonly ProtocolWarning[];
  readonly errors: readonly ProtocolError[];
}

function pushed(bytes: Uint8Array, options?: Partial<Dot11ElementOptions>): Pushed {
  const sink = createFieldSink();
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];
  pushDot11Elements(bytes, sink, warnings, errors, 0, bytes.length, {
    ...DOT11_ELEMENT_DEFAULT_OPTIONS,
    ...options,
  });
  return { fields: sink.fields, warnings, errors };
}

function field(result: Pushed, id: string): ParsedField | undefined {
  return result.fields.find((candidate) => candidate.id === id);
}

function physical(result: Pushed, id: string): string {
  return String(field(result, id)?.physicalValue ?? '');
}

describe('TLV yürüyücüsü — gerçek Beacon`ın ON element`i', () => {
  const bytes = hexToBytes(BEACON_ELEMENTS);

  it('zincir 104 baytı TAM tüketir — brifin elle çözümü UYGULAMADA yeniden çözüldü', () => {
    expect(bytes.length).toBe(104);
    const walk = walkDot11Elements(bytes, 0, bytes.length);
    expect(walk.truncated).toBe(false);
    expect(walk.trailingLength).toBe(0);
    // Bayt toplamı BAĞIMSIZ hesaplanır: Σ(2 + Length) === zincir uzunluğu.
    const consumed = walk.elements.reduce((total, element) => total + 2 + element.length, 0);
    expect(consumed).toBe(104);
  });

  it('ON element, ID`leri ve uzunluklarıyla SIRAYLA okunur', () => {
    const walk = walkDot11Elements(bytes, 0, bytes.length);
    expect(walk.elements.map((element) => `${String(element.id)}/${String(element.length)}`)).toEqual(
      ['0/7', '1/8', '3/1', '5/4', '42/1', '47/1', '48/24', '50/4', '221/6', '221/28'],
    );
    // Ofsetler ARDIŞIK: her element bir öncekinin bittiği yerde başlar.
    let cursor = 0;
    for (const element of walk.elements) {
      expect(element.offset).toBe(cursor);
      expect(element.dataOffset).toBe(cursor + 2);
      expect(element.data.length).toBe(element.length);
      cursor += 2 + element.length;
    }
  });

  it('`start`/`end` MUTLAK ofsettir — çağıran `subarray` vermek zorunda değil', () => {
    const padded = new Uint8Array(bytes.length + 36);
    padded.set(bytes, 36);
    const walk = walkDot11Elements(padded, 36, padded.length);
    expect(walk.elements[0]?.offset).toBe(36);
    expect(walk.elements[0]?.id).toBe(0);
    expect(walk.trailingLength).toBe(0);
  });

  it('SSID, kanal, TIM ve hız listeleri ÇÖZÜLÜR', () => {
    const result = pushed(bytes);
    expect(physical(result, 'ie-0')).toBe('"Coherer"');
    expect(physical(result, 'ie-3')).toBe('channel 1');
    expect(physical(result, 'ie-5')).toContain('DTIM count 0, DTIM period 1');
    // bit7 = basic; değer × 0,5 Mbit/s.
    expect(physical(result, 'ie-1')).toBe('1*, 2*, 5.5*, 11*, 18, 24, 36, 54 Mbit/s (* = basic rate)');
    expect(physical(result, 'ie-50')).toBe('6, 9, 12, 48 Mbit/s (* = basic rate)');
  });

  it('🚨 Element ID 47 ERP Information`dır ve UYDURULMADI — Wireshark kaynağı', () => {
    // `packet-ieee80211.h:408` → TAG_ERP_INFO_OLD 47 (IEEE Std 802.11g/D4.0),
    // `packet-ieee80211.c:63843` onu 42 ile AYNI çözücüye bağlıyor. Brifin
    // `[BEKLENTİ]` işaretli tahmini böylece DOĞRULANDI.
    expect(ELEMENT_NAMES.get(47)).toBe('ERP Information (802.11g/D4.0)');
    const result = pushed(bytes);
    expect(field(result, 'ie-47')?.name).toContain('ERP Information (802.11g/D4.0)');
    // 42 ve 47 aynı Beacon'da AYNI değeri taşıyor ve aynı biçimde çözülüyor.
    expect(physical(result, 'ie-47')).toBe(physical(result, 'ie-42'));
    expect(physical(result, 'ie-42')).toBe('Use Protection');
  });

  it('aynı ID`den iki element ÇAKIŞMAYAN alan kimlikleri alır', () => {
    const result = pushed(bytes);
    expect(field(result, 'ie-221')).toBeDefined();
    expect(field(result, 'ie-221-2')).toBeDefined();
    const ids = result.fields.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('RSN IE (48) — iç içe sayaç zinciri', () => {
  const bytes = hexToBytes(BEACON_ELEMENTS);

  it('ARİTMETİK: 2 + 4 + 2 + 8 + 2 + 4 + 2 = 24 = `IE.Length`', () => {
    const walk = walkDot11Elements(bytes, 0, bytes.length);
    const rsn = walk.elements.find((element) => element.id === 48);
    expect(rsn?.length).toBe(24);
    // Zincirin bileşenleri TEK TEK toplanır; sabit 24 yazmak testi test etmez.
    const version = 2;
    const groupCipher = 4;
    const pairwiseCount = 2;
    const pairwiseSuites = 2 * 4;
    const akmCount = 2;
    const akmSuites = 1 * 4;
    const capabilities = 2;
    expect(
      version + groupCipher + pairwiseCount + pairwiseSuites + akmCount + akmSuites + capabilities,
    ).toBe(rsn?.length);
  });

  it('sürüm, grup şifresi, İKİ pairwise süiti, BİR AKM süiti ve yetenekler basılır', () => {
    const result = pushed(bytes);
    expect(physical(result, 'rsn-version')).toContain('1');
    expect(physical(result, 'rsn-group-cipher')).toBe('TKIP (00-0F-AC:2)');
    expect(physical(result, 'rsn-pairwise-count')).toContain('2 suite(s)');
    expect(physical(result, 'rsn-pairwise-suite')).toBe('CCMP-128 (AES-CCM) (00-0F-AC:4)');
    expect(physical(result, 'rsn-pairwise-suite-2')).toBe('TKIP (00-0F-AC:2)');
    expect(physical(result, 'rsn-akm-count')).toContain('1 suite(s)');
    expect(physical(result, 'rsn-akm-suite')).toBe('PSK (00-0F-AC:2)');
    expect(field(result, 'rsn-capabilities')?.rawValue).toBe('0x0000');
    // Zincir element'in SON baytında biter: hiçbir artık bayt kalmamalı.
    expect(result.warnings.map((warning) => warning.code)).not.toContain('rsnTrailingBytes');
  });

  it('🚨 vendor WPA IE (221 · 00-50-F2 · type 1) AYNI zinciri kullanır — 28 bayt', () => {
    const walk = walkDot11Elements(bytes, 0, bytes.length);
    const wpa = walk.elements.filter((element) => element.id === 221)[1];
    expect(wpa?.length).toBe(28);
    const oui = 3;
    const vendorType = 1;
    expect(oui + vendorType + 2 + 4 + 2 + 2 * 4 + 2 + 1 * 4 + 2).toBe(wpa?.length);

    const result = pushed(bytes);
    expect(physical(result, 'wpa-version')).toContain('1');
    expect(physical(result, 'wpa-group-cipher')).toBe('TKIP (00-50-F2:2)');
    expect(physical(result, 'wpa-akm-suite')).toBe('PSK (00-50-F2:2)');
  });

  it('🚨 AYNI SÜİT NUMARASI, FARKLI OUI: iki IE ayrı ayrı basılır, tablolar KARIŞMAZ', () => {
    const result = pushed(bytes);
    // Numaralar birebir aynı (2 = TKIP, 4 = CCMP) ama OUI FARKLI, ve basılan
    // metin OUI'yi TAŞIYOR. Tek tablo yazılsaydı bu ayrım kaybolurdu.
    expect(physical(result, 'rsn-group-cipher')).toContain('00-0F-AC');
    expect(physical(result, 'wpa-group-cipher')).toContain('00-50-F2');
    expect(physical(result, 'rsn-group-cipher')).not.toBe(physical(result, 'wpa-group-cipher'));
  });

  it('TANINMAYAN OUI tescilli sayılır ve ADI UYDURULMAZ', () => {
    // `00-11-22` kaydı bizde yok; süit tipi 4 RSN tablosunda CCMP-128 ama
    // OUI farklı olduğu için o ad BASILMAMALI.
    const element = hexToBytes('30 14 01 00 00 11 22 04 01 00 00 0f ac 04 01 00 00 0f ac 02 00 00');
    const result = pushed(element);
    expect(physical(result, 'rsn-group-cipher')).toContain('00-11-22:4');
    expect(physical(result, 'rsn-group-cipher')).toContain('proprietary');
    expect(physical(result, 'rsn-group-cipher')).not.toContain('CCMP');
  });

  it('sürüm 1 DEĞİLSE zincire devam EDİLMEZ — yerleşim sürüme bağlı', () => {
    const element = hexToBytes('30 14 02 00 00 0f ac 02 01 00 00 0f ac 04 01 00 00 0f ac 02 00 00');
    const result = pushed(element);
    expect(field(result, 'rsn-version')?.valid).toBe(false);
    expect(result.warnings.map((warning) => warning.code)).toContain('rsnVersionUnsupported');
    expect(field(result, 'rsn-group-cipher')).toBeUndefined();
    expect(field(result, 'rsn-undecoded')).toBeDefined();
  });
});

describe('🚨 BOZUK SAYAÇ — zincir SESSİZCE KAYMAZ', () => {
  /**
   * Gerçek Association Request'in RSN IE'si (`len 20`), Pairwise Count `01 00`
   * → `02 00` yapılmış hâli. Zincir bundan sonra AKM sayacının baytlarını
   * pairwise süiti sanar ve AKM Count'u `ac 02` = 684 okur.
   */
  const brokenPairwise = hexToBytes(
    '30 14 01 00 00 0f ac 02 02 00 00 0f ac 04 01 00 00 0f ac 02 00 00',
  );

  it('sayaç kalan bayttan büyükse HATA + UYARI basılır, ÇÖKMEZ', () => {
    const result = pushed(brokenPairwise);
    expect(result.errors.map((error) => error.code)).toContain('length-mismatch');
    expect(result.warnings.map((warning) => warning.code)).toContain('rsnCounterOverrun');
  });

  it('kalan baytlar HAM bırakılır — uydurma süit BASILMAZ', () => {
    const result = pushed(brokenPairwise);
    const remainder = field(result, 'rsn-undecoded');
    expect(remainder).toBeDefined();
    expect(remainder?.length).toBe(2);
    expect(remainder?.valid).toBe(false);
    expect(String(remainder?.physicalValue)).toContain('684');
    // 684 AKM süiti UYDURULMADI: tek bir `rsn-akm-suite` alanı bile yok.
    expect(field(result, 'rsn-akm-suite')).toBeUndefined();
  });

  it('sayaç 684 okunsa bile alanlar element sınırının DIŞINA taşmaz', () => {
    const result = pushed(brokenPairwise);
    for (const entry of result.fields) {
      expect(entry.offset + entry.length).toBeLessThanOrEqual(brokenPairwise.length);
      expect(entry.rawBytes.length).toBe(entry.length);
    }
  });

  it('PMKID sayacı da AYNI kapıdan geçer', () => {
    // v1 + group + N=0 + M=0 + caps + PMKID Count = 9 → 9 × 16 B istenir,
    // element'te ise 0 bayt kalmıştır.
    const element = hexToBytes('30 0e 01 00 00 0f ac 04 00 00 00 00 00 00 09 00');
    const result = pushed(element);
    expect(physical(result, 'rsn-pmkid-count')).toContain('9 PMKID(s)');
    expect(result.errors.map((error) => error.code)).toContain('length-mismatch');
    expect(field(result, 'rsn-pmkid')).toBeUndefined();
  });

  it('zincir element uzunluğundan AZ tüketirse artık baytlar uyarı basar', () => {
    // v1 + group + N=0 + M=0 + caps = 12; `len` 13 ⇒ TEK bayt ARTIK kalır ve
    // tek bayt ne bir PMKID sayacı (2 B) ne de bir süit (4 B) yapabilir.
    const element = hexToBytes('30 0d 01 00 00 0f ac 04 00 00 00 00 00 00 ff');
    const result = pushed(element);
    expect(result.warnings.map((warning) => warning.code)).toContain('rsnTrailingBytes');
    expect(field(result, 'rsn-undecoded')?.length).toBe(1);
  });
});

describe('bilinmeyen element ve bozuk zincir', () => {
  it('bilinmeyen ID HATA DEĞİLDİR — ham kalır, uyarı basar, AD UYDURULMAZ', () => {
    const element = hexToBytes('fe 03 aa bb cc');
    const result = pushed(element);
    const row = field(result, 'ie-254');
    expect(row?.name).toBe('802.11 · Element 254');
    expect(String(row?.rawValue)).toBe('AA BB CC');
    expect(String(row?.physicalValue)).toContain('not in this release');
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.map((warning) => warning.code)).toContain('unknownElement');
  });

  it('`Length` kalan bayttan büyükse element KABUL EDİLMEZ, kalan ham sayılır', () => {
    const element = hexToBytes('00 07 43 6f 68 65');
    const walk = walkDot11Elements(element, 0, element.length);
    expect(walk.elements).toHaveLength(0);
    expect(walk.truncated).toBe(true);
    expect(walk.trailingLength).toBe(6);

    const result = pushed(element);
    expect(field(result, 'ie-trailing')?.length).toBe(6);
    expect(result.warnings.map((warning) => warning.code)).toContain('elementChainTruncated');
  });

  it('TEK baytlık artık da yakalanır — TLV başlığı iki bayttır', () => {
    const element = hexToBytes('03 01 01 2a');
    const walk = walkDot11Elements(element, 0, element.length);
    expect(walk.elements).toHaveLength(1);
    expect(walk.trailingLength).toBe(1);
  });

  it('beklenen sabit uzunluk tutmazsa UYARI basılır ama element yine basılır', () => {
    // DS Parameter Set 1 bayt olmalı; burada 2.
    const element = hexToBytes('03 02 01 06');
    const result = pushed(element);
    expect(field(result, 'ie-3')?.valid).toBe(false);
    expect(result.warnings.map((warning) => warning.code)).toContain('elementLengthUnexpected');
  });

  it('gizli SSID (`length = 0`) "wildcard" der, BOŞ KART BASMAZ', () => {
    const result = pushed(hexToBytes('00 00'));
    const row = field(result, 'ie-0');
    expect(String(row?.physicalValue)).toContain('wildcard');
    expect(String(row?.physicalValue)).toContain('hidden');
    expect(String(row?.rawValue)).toBe('(empty)');
    expect(row?.length).toBe(2);
  });

  it('UTF-8 olmayan SSID uydurulmaz, ham basılır', () => {
    const result = pushed(hexToBytes('00 02 ff fe'));
    expect(physical(result, 'ie-0')).toContain('not valid UTF-8');
    expect(physical(result, 'ie-0')).toContain('FF FE');
  });

  it('255 uzantı KİMLİĞİ adlandırılır, GÖVDESİ kapsam dışı kalır', () => {
    const result = pushed(hexToBytes('ff 03 23 aa bb'));
    expect(physical(result, 'ie-255')).toContain('HE Capabilities');
    expect(physical(result, 'ie-255')).toContain('OUT OF SCOPE');
  });
});

describe('dört kanal — hepsi GERÇEKTEN farklı çıktı üretir', () => {
  const bytes = hexToBytes(BEACON_ELEMENTS);

  it('`ieNameSet` = none ham TLV görünümü verir ve "tabloda yok" DEMEZ', () => {
    const result = pushed(bytes, { ieNameSet: IE_NAME_SET_NONE });
    expect(field(result, 'ie-0')?.name).toBe('802.11 · Element 0');
    expect(physical(result, 'ie-0')).toContain('naming is turned off');
    // Kullanıcının kendi seçimi "bilinmeyen element" uyarısı olarak geri
    // satılmaz ve RSN zinciri de açılmaz.
    expect(result.warnings.map((warning) => warning.code)).not.toContain('unknownElement');
    expect(field(result, 'rsn-version')).toBeUndefined();
  });

  it('`unknownIeDisplay` = hidden satırları GERÇEKTEN düşürür', () => {
    const shown = pushed(bytes, { ieNameSet: IE_NAME_SET_NONE });
    const hidden = pushed(bytes, {
      ieNameSet: IE_NAME_SET_NONE,
      unknownIeDisplay: UNKNOWN_IE_HIDDEN,
    });
    expect(shown.fields.length).toBe(10);
    expect(hidden.fields).toHaveLength(0);
    expect(hidden.warnings.map((warning) => warning.code)).toContain('hiddenElements');
  });

  it('`rsnSuiteLabels` = hide adı kaldırır ama HAM SEÇİCİYİ bırakır', () => {
    const result = pushed(bytes, { rsnSuiteLabels: RSN_SUITE_LABELS_HIDE });
    expect(physical(result, 'rsn-group-cipher')).toBe('00-0F-AC:2');
    expect(physical(result, 'rsn-group-cipher')).not.toContain('TKIP');
    // Zincirin KENDİSİ hâlâ çözülüyor: kapatılan şey ETİKET, çözüm değil.
    expect(physical(result, 'rsn-pairwise-count')).toContain('2 suite(s)');
  });

  it('`vendorIeProfile` üç şıkkı üç FARKLI çıktı verir', () => {
    const decode = pushed(bytes);
    const labelOnly = pushed(bytes, { vendorIeProfile: VENDOR_IE_LABEL_ONLY });
    const raw = pushed(bytes, { vendorIeProfile: VENDOR_IE_RAW });

    expect(physical(decode, 'ie-221-2')).toContain('WPA');
    expect(field(decode, 'wpa-akm-suite')).toBeDefined();

    // label-only: OUI etiketi DURUYOR ama iç zincir AÇILMIYOR.
    expect(physical(labelOnly, 'ie-221-2')).toContain('Microsoft / Wi-Fi Alliance');
    expect(field(labelOnly, 'wpa-akm-suite')).toBeUndefined();

    // raw: etiket de yok.
    expect(physical(raw, 'ie-221-2')).not.toContain('Microsoft');
    expect(physical(raw, 'ie-221-2')).toContain('raw');
    expect(raw.warnings.map((warning) => warning.code)).toContain('vendorElementRaw');
  });

  it('vendor uyarısı ELEMENT BAŞINA DEĞİL, ÇERÇEVE BAŞINA basılır', () => {
    // Beacon'da İKİ vendor element var; uyarı listesi ikizlenmemeli.
    const raw = pushed(bytes, { vendorIeProfile: VENDOR_IE_RAW });
    const codes = raw.warnings.filter((warning) => warning.code === 'vendorElementRaw');
    expect(codes).toHaveLength(1);
  });
});

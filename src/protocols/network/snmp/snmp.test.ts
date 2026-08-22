import { describe, expect, it } from 'vitest';

import { encodeOid, parseSnmp, snmpParser, snmpPlugin } from './snmp';
import { formatTimeTicks, resolveOidName } from './snmpTypes';
import type { ParseFailure, ParseResult, ParseSuccess, ParsedField, ParsedFrame } from '@/protocol-core/types';

function expectSuccess(result: ParseResult): ParseSuccess {
  if (!result.success) {
    throw new Error(`expected success, got error "${result.error.code}"`);
  }
  return result;
}

function expectFailure(result: ParseResult): ParseFailure {
  if (result.success) {
    throw new Error('expected failure, got a parsed frame');
  }
  return result;
}

function fieldById(frame: ParsedFrame, id: string): ParsedField {
  const found = frame.fields.find((field) => field.id === id);
  if (found === undefined) {
    throw new Error(`field "${id}" not found; got ${frame.fields.map((f) => f.id).join(', ')}`);
  }
  return found;
}

function hasField(frame: ParsedFrame, id: string): boolean {
  return frame.fields.some((field) => field.id === id);
}

function warningCodes(frame: ParsedFrame): string[] {
  return frame.warnings.map((warning) => warning.code);
}

function errorCodes(frame: ParsedFrame): string[] {
  return frame.errors.map((error) => error.code);
}

const TAG_SEQUENCE = 0x30;
const TAG_INTEGER = 0x02;
const TAG_OCTET_STRING = 0x04;
const TAG_NULL = 0x05;
const TAG_OID = 0x06;
const TAG_IP_ADDRESS = 0x40;
const TAG_COUNTER32 = 0x41;
const TAG_TIME_TICKS = 0x43;
const TAG_COUNTER64 = 0x46;
const TAG_NO_SUCH_INSTANCE = 0x81;

const PDU_GET_REQUEST = 0xa0;
const PDU_RESPONSE = 0xa2;
const PDU_TRAP_V1 = 0xa4;
const PDU_GET_BULK = 0xa5;

/** Kısa form TLV — testlerdeki değerlerin hepsi 128 baytın altında. */
function tlv(tag: number, value: readonly number[]): number[] {
  return [tag, value.length, ...value];
}

function sequence(tag: number, children: readonly number[][]): number[] {
  return tlv(tag, children.flat());
}

function integer(value: number): number[] {
  if (value < 0x80) return tlv(TAG_INTEGER, [value]);
  return tlv(TAG_INTEGER, [(value >>> 8) & 0xff, value & 0xff]);
}

function ascii(text: string): number[] {
  return Array.from(text, (character) => character.charCodeAt(0));
}

function communityMessage(version: number, pdu: readonly number[]): Uint8Array {
  return Uint8Array.from(sequence(TAG_SEQUENCE, [integer(version), tlv(TAG_OCTET_STRING, ascii('public')), [...pdu]]));
}

function varbind(oid: string, value: readonly number[]): number[] {
  return sequence(TAG_SEQUENCE, [tlv(TAG_OID, encodeOid(oid)), [...value]]);
}

function varbindList(...pairs: readonly (readonly number[])[]): number[] {
  return sequence(
    TAG_SEQUENCE,
    pairs.map((pair) => [...pair]),
  );
}

const SYS_UP_TIME = '1.3.6.1.2.1.1.3.0';

describe('snmpTypes', () => {
  it('OID adını instance son-arc’ıyla birlikte çözer', () => {
    expect(resolveOidName('1.3.6.1.2.1.1.3')).toBe('sysUpTime');
    // Telde daima instance ekli hâli gelir; tek adımlık geri çekilme.
    expect(resolveOidName('1.3.6.1.2.1.1.3.0')).toBe('sysUpTime.0');
    expect(resolveOidName('1.3.6.1.2.1.99.1.0')).toBeUndefined();
  });

  it('TimeTicks saniyenin YÜZDE BİRİDİR', () => {
    // 360 000 tick = 1 saat, 3 600 saniye DEĞİL.
    expect(formatTimeTicks(360_000n)).toBe('0d 01:00:00.00');
    expect(formatTimeTicks(8_640_050n)).toBe('1d 00:00:00.50');
  });
});

describe('snmpParser', () => {
  it('sürüm alanını sıfır tabanlı okur — 1 SNMPv2c demektir', () => {
    const { frame } = expectSuccess(
      parseSnmp(
        communityMessage(1, sequence(PDU_GET_REQUEST, [integer(1), integer(0), integer(0), varbindList(varbind(SYS_UP_TIME, tlv(TAG_NULL, [])))])),
      ),
    );

    expect(fieldById(frame, 'version').rawValue).toBe(1n);
    expect(fieldById(frame, 'version').physicalValue).toBe('SNMPv2c');
  });

  it('community’yi okur ve düz metin olduğunu uyarır', () => {
    const { frame } = expectSuccess(
      parseSnmp(communityMessage(1, sequence(PDU_GET_REQUEST, [integer(1), integer(0), integer(0), varbindList()]))),
    );

    expect(fieldById(frame, 'community').rawValue).toBe('public');
    expect(warningCodes(frame)).toContain('protocol.snmp.warning.communityInClear');
  });

  it('standart PDU’yu request-id / error-status / error-index olarak çözer', () => {
    const { frame } = expectSuccess(
      parseSnmp(
        communityMessage(1, sequence(PDU_RESPONSE, [integer(0x1234), integer(2), integer(1), varbindList()])),
      ),
    );

    expect(fieldById(frame, 'pdu-type').physicalValue).toBe('Response');
    expect(fieldById(frame, 'request-id').rawValue).toBe(0x1234n);
    expect(fieldById(frame, 'error-status').physicalValue).toBe('noSuchName');
    expect(fieldById(frame, 'error-index').rawValue).toBe(1n);
  });

  it('GetBulk’ta ikinci/üçüncü alan non-repeaters ve max-repetitions’tır', () => {
    const { frame } = expectSuccess(
      parseSnmp(communityMessage(1, sequence(PDU_GET_BULK, [integer(99), integer(0), integer(10), varbindList()]))),
    );

    expect(fieldById(frame, 'non-repeaters').rawValue).toBe(0n);
    expect(fieldById(frame, 'max-repetitions').rawValue).toBe(10n);
    // Aynı konumları "hata alanı" diye basmak yapısal olarak geçerli, anlamca yanlış olurdu.
    expect(hasField(frame, 'error-status')).toBe(false);
    expect(hasField(frame, 'error-index')).toBe(false);
  });

  it('v1 Trap-PDU gövdesi standart PDU’yla hiçbir alanı paylaşmaz', () => {
    const trap = sequence(PDU_TRAP_V1, [
      tlv(TAG_OID, encodeOid('1.3.6.1.4.1.9')),
      tlv(TAG_IP_ADDRESS, [192, 168, 1, 10]),
      integer(2),
      integer(0),
      tlv(TAG_TIME_TICKS, [0x00, 0x00, 0x27, 0x10]),
      varbindList(),
    ]);
    const { frame } = expectSuccess(parseSnmp(communityMessage(0, trap)));

    expect(fieldById(frame, 'pdu-type').physicalValue).toBe('Trap (v1)');
    expect(fieldById(frame, 'enterprise').rawValue).toBe('1.3.6.1.4.1.9');
    expect(fieldById(frame, 'agent-address').rawValue).toBe('192.168.1.10');
    expect(fieldById(frame, 'generic-trap').physicalValue).toBe('linkDown');
    expect(fieldById(frame, 'trap-time-stamp').physicalValue).toBe('0d 00:01:40.00');
    // Ortak gövdenin alanları BURADA OLMAMALI.
    expect(hasField(frame, 'request-id')).toBe(false);
    expect(hasField(frame, 'error-status')).toBe(false);
  });

  it('v2c mesajındaki Trap-PDU’yu sürüm dışı olarak işaretler', () => {
    const trap = sequence(PDU_TRAP_V1, [
      tlv(TAG_OID, encodeOid('1.3.6.1.4.1.9')),
      tlv(TAG_IP_ADDRESS, [10, 0, 0, 1]),
      integer(0),
      integer(0),
      tlv(TAG_TIME_TICKS, [0x00, 0x00, 0x00, 0x01]),
      varbindList(),
    ]);
    const { frame } = expectSuccess(parseSnmp(communityMessage(1, trap)));

    expect(fieldById(frame, 'pdu-type').valid).toBe(false);
    expect(warningCodes(frame)).toContain('protocol.snmp.warning.trapV1Only');
  });

  it('Counter32 İŞARETSİZ okunur', () => {
    const { frame } = expectSuccess(
      parseSnmp(
        communityMessage(
          1,
          sequence(PDU_RESPONSE, [
            integer(1),
            integer(0),
            integer(0),
            varbindList(varbind('1.3.6.1.2.1.2.2.1.10.1', tlv(TAG_COUNTER32, [0xb2, 0xd0, 0x5e, 0x00]))),
          ]),
        ),
      ),
    );

    expect(fieldById(frame, 'varbind-0-type').physicalValue).toBe('Counter32');
    // İşaretli okunsa −1 294 967 296 çıkardı.
    expect(fieldById(frame, 'varbind-0-value').rawValue).toBe(3_000_000_000n);
  });

  it('Counter64’ü yuvarlamadan taşır', () => {
    const { frame } = expectSuccess(
      parseSnmp(
        communityMessage(
          1,
          sequence(PDU_RESPONSE, [
            integer(1),
            integer(0),
            integer(0),
            varbindList(varbind('1.3.6.1.2.1.31.1.1.1.6.1', tlv(TAG_COUNTER64, [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]))),
          ]),
        ),
      ),
    );

    expect(fieldById(frame, 'varbind-0-value').rawValue).toBe(18_446_744_073_709_551_615n);
  });

  it('TimeTicks’i saniye sanmaz, süre olarak biçimler', () => {
    const { frame } = expectSuccess(
      parseSnmp(
        communityMessage(
          1,
          sequence(PDU_RESPONSE, [
            integer(1),
            integer(0),
            integer(0),
            varbindList(varbind(SYS_UP_TIME, tlv(TAG_TIME_TICKS, [0x00, 0x05, 0x7e, 0x40]))),
          ]),
        ),
      ),
    );

    const value = fieldById(frame, 'varbind-0-value');
    expect(value.rawValue).toBe(360_000n);
    expect(value.physicalValue).toBe('0d 01:00:00.00');
    // `unit` verilmez: panel birimi biçimlenmiş süreye yapıştırırdı.
    expect(value.unit).toBeUndefined();
  });

  it('VarBind OID’ini adlandırır, tablonun dışını uyarır', () => {
    const { frame } = expectSuccess(
      parseSnmp(
        communityMessage(
          1,
          sequence(PDU_RESPONSE, [
            integer(1),
            integer(0),
            integer(0),
            varbindList(
              varbind(SYS_UP_TIME, tlv(TAG_TIME_TICKS, [0x00, 0x00, 0x00, 0x01])),
              varbind('1.3.6.1.4.1.9999.1.0', tlv(TAG_NULL, [])),
            ),
          ]),
        ),
      ),
    );

    expect(fieldById(frame, 'varbind-0-oid').physicalValue).toBe('sysUpTime.0');
    expect(fieldById(frame, 'varbind-1-oid').physicalValue).toBeUndefined();
    // MIB kanalı boş — tablonun dışı adlandırılamıyor.
    expect(warningCodes(frame)).toContain('protocol.snmp.warning.oidNotInTable');
  });

  it('v2c istisna etiketlerini uzunluğu sıfır olsa da adlandırır', () => {
    const { frame } = expectSuccess(
      parseSnmp(
        communityMessage(
          1,
          sequence(PDU_RESPONSE, [
            integer(1),
            integer(0),
            integer(0),
            varbindList(varbind('1.3.6.1.2.1.1.9.0', tlv(TAG_NO_SUCH_INSTANCE, []))),
          ]),
        ),
      ),
    );

    expect(fieldById(frame, 'varbind-0-type').physicalValue).toBe('noSuchInstance');
    expect(fieldById(frame, 'varbind-0-value').physicalValue).toBe('noSuchInstance');
    expect(warningCodes(frame)).toContain('protocol.snmp.warning.varbindException');
  });

  it('4 bayt olmayan IpAddress’i adres diye göstermez', () => {
    const { frame } = expectSuccess(
      parseSnmp(
        communityMessage(
          1,
          sequence(PDU_RESPONSE, [
            integer(1),
            integer(0),
            integer(0),
            varbindList(varbind('1.3.6.1.2.1.4.20.1.1.1', tlv(TAG_IP_ADDRESS, [10, 0, 1]))),
          ]),
        ),
      ),
    );

    const value = fieldById(frame, 'varbind-0-value');
    expect(value.valid).toBe(false);
    expect(value.rawValue).toBe('0x0a0001');
    expect(warningCodes(frame)).toContain('protocol.snmp.warning.ipAddressLength');
  });

  it('tanınmayan değer etiketini ham bırakır ve uyarır', () => {
    const { frame } = expectSuccess(
      parseSnmp(
        communityMessage(
          1,
          sequence(PDU_RESPONSE, [
            integer(1),
            integer(0),
            integer(0),
            varbindList(varbind('1.3.6.1.2.1.1.1.0', tlv(0x4f, [0x01, 0x02]))),
          ]),
        ),
      ),
    );

    expect(fieldById(frame, 'varbind-0-value').valid).toBe(false);
    expect(fieldById(frame, 'varbind-0-value').rawValue).toBe('0x0102');
    expect(warningCodes(frame)).toContain('protocol.snmp.warning.unknownValueTag');
  });

  it('tanınmayan sürümde gövdeyi ÇÖZMEZ', () => {
    const { frame } = expectSuccess(
      parseSnmp(Uint8Array.from(sequence(TAG_SEQUENCE, [integer(7), tlv(TAG_OCTET_STRING, ascii('public'))]))),
    );

    expect(warningCodes(frame)).toContain('protocol.snmp.warning.unknownVersion');
    // Hangi şemanın uygulanacağı bilinmiyor: community bile okunmaz.
    expect(hasField(frame, 'community')).toBe(false);
  });

  it('v3 zarfını ve USM parametrelerini anahtar olmadan çözer', () => {
    const bytes = Uint8Array.from(
      sequence(TAG_SEQUENCE, [
        integer(3),
        sequence(TAG_SEQUENCE, [integer(0x3039), integer(0x1000), tlv(TAG_OCTET_STRING, [0x07]), integer(3)]),
        tlv(
          TAG_OCTET_STRING,
          sequence(TAG_SEQUENCE, [
            tlv(TAG_OCTET_STRING, [0x80, 0x00, 0x1f, 0x88]),
            integer(12),
            integer(0x0e10),
            tlv(TAG_OCTET_STRING, ascii('operator')),
            tlv(TAG_OCTET_STRING, [0xaa, 0xbb]),
            tlv(TAG_OCTET_STRING, [0x01, 0x02]),
          ]),
        ),
        tlv(TAG_OCTET_STRING, [0xde, 0xad, 0xbe, 0xef]),
      ]),
    );
    const { frame } = expectSuccess(parseSnmp(bytes));

    expect(fieldById(frame, 'version').physicalValue).toBe('SNMPv3');
    expect(fieldById(frame, 'msg-id').rawValue).toBe(0x3039n);
    expect(fieldById(frame, 'msg-flags').physicalValue).toBe('authFlag, privFlag, reportableFlag');
    expect(fieldById(frame, 'security-level').physicalValue).toBe('authPriv');
    expect(fieldById(frame, 'msg-security-model').physicalValue).toBe('USM');
    expect(fieldById(frame, 'usm-engine-id').rawValue).toBe('0x80001f88');
    expect(fieldById(frame, 'usm-user-name').rawValue).toBe('operator');
    // Anahtar yok: ScopedPDU şifreli bırakılır (spec :377).
    expect(fieldById(frame, 'encrypted-scoped-pdu').physicalValue).toBe('Encrypted');
    expect(warningCodes(frame)).toContain('protocol.snmp.warning.encryptedScopedPdu');
    expect(hasField(frame, 'context-engine-id')).toBe(false);
  });

  it('şifresiz v3 mesajında ScopedPDU ve içindeki PDU çözülür', () => {
    const bytes = Uint8Array.from(
      sequence(TAG_SEQUENCE, [
        integer(3),
        // msgFlags = 0x05: auth + reportable, priv YOK.
        sequence(TAG_SEQUENCE, [integer(1), integer(0x1000), tlv(TAG_OCTET_STRING, [0x05]), integer(3)]),
        tlv(
          TAG_OCTET_STRING,
          sequence(TAG_SEQUENCE, [
            tlv(TAG_OCTET_STRING, [0x80, 0x00, 0x1f, 0x88]),
            integer(1),
            integer(10),
            tlv(TAG_OCTET_STRING, ascii('user')),
            tlv(TAG_OCTET_STRING, []),
            tlv(TAG_OCTET_STRING, []),
          ]),
        ),
        sequence(TAG_SEQUENCE, [
          tlv(TAG_OCTET_STRING, [0x80, 0x00, 0x1f, 0x88]),
          tlv(TAG_OCTET_STRING, []),
          sequence(PDU_GET_REQUEST, [integer(5), integer(0), integer(0), varbindList(varbind(SYS_UP_TIME, tlv(TAG_NULL, [])))]),
        ]),
      ]),
    );
    const { frame } = expectSuccess(parseSnmp(bytes));

    expect(fieldById(frame, 'security-level').physicalValue).toBe('authNoPriv');
    expect(fieldById(frame, 'context-engine-id').rawValue).toBe('0x80001f88');
    expect(fieldById(frame, 'pdu-type').physicalValue).toBe('GetRequest');
    expect(fieldById(frame, 'varbind-0-oid').physicalValue).toBe('sysUpTime.0');
    expect(hasField(frame, 'encrypted-scoped-pdu')).toBe(false);
  });

  it('dış TLV SEQUENCE değilse start-delimiter-not-found döner', () => {
    const failure = expectFailure(parseSnmp(Uint8Array.from([0x02, 0x01, 0x01, 0x04, 0x00])));

    expect(failure.error.code).toBe('start-delimiter-not-found');
    expect(failure.recoverable).toBe(true);
  });

  it('BER hatasını protokol hatasına çevirir', () => {
    // 0x80 uzunluk baytı = belirsiz uzunluk; berReader bunu açıkça reddeder.
    const { frame } = expectSuccess(parseSnmp(Uint8Array.from([0x30, 0x06, 0x02, 0x80, 0x00, 0x00, 0x00, 0x00])));

    expect(frame.valid).toBe(false);
    expect(errorCodes(frame)).toContain('unsupported-encoding');
  });

  it('kısa girdiyi truncated-frame ile reddeder', () => {
    const failure = expectFailure(parseSnmp(Uint8Array.from([0x30, 0x02])));

    expect(failure.error.code).toBe('truncated-frame');
  });

  it('maxFrameLength aşımını frame-too-long ile durdurur', () => {
    const bytes = communityMessage(1, sequence(PDU_RESPONSE, [integer(1), integer(0), integer(0), varbindList()]));
    const failure = expectFailure(snmpParser.parse(bytes, { maxFrameLength: 5 }));

    expect(failure.error.code).toBe('frame-too-long');
  });

  it('iptal edilmiş signal ile parser-timeout döner', () => {
    const controller = new AbortController();
    controller.abort();

    const bytes = communityMessage(1, sequence(PDU_RESPONSE, [integer(1), integer(0), integer(0), varbindList()]));
    expect(expectFailure(snmpParser.parse(bytes, { signal: controller.signal })).error.code).toBe('parser-timeout');
  });

  it('canParse yalnız dış SEQUENCE etiketine bakar', () => {
    expect(snmpParser.canParse(Uint8Array.from([0x30, 0x0a, 0x02, 0x01, 0x01]))).toBe(true);
    expect(snmpParser.canParse(Uint8Array.from([0x02, 0x0a, 0x02, 0x01, 0x01]))).toBe(false);
    expect(snmpParser.canParse(Uint8Array.from([0x30, 0x02]))).toBe(false);
  });
});

describe('snmpPlugin', () => {
  it('örnekleri beyan ettikleri geçerlilikle çözülür', () => {
    for (const example of snmpPlugin.exampleFrames) {
      const result = parseSnmp(example.bytes);
      if (example.expectedValid === false) {
        const invalid = !result.success || !result.frame.valid;
        expect(invalid, `${example.id} geçersiz olmalıydı`).toBe(true);
        continue;
      }
      const { frame } = expectSuccess(result);
      expect(frame.valid, `${example.id} geçerli olmalıydı`).toBe(true);
    }
  });

  it('plugin kimliği ve kategorisi katalogla aynı', () => {
    expect(snmpPlugin.id).toBe('snmp');
    expect(snmpPlugin.category).toBe('network-ethernet');
    expect(snmpPlugin.parser).toBe(snmpParser);
  });
});

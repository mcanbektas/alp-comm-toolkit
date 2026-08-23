import { describe, expect, it } from 'vitest';

import { opcUaParser, opcUaPlugin, parseOpcUa } from './opcua';
import type { ParseFailure, ParseResult, ParseSuccess, ParsedField } from '@/protocol-core/types';

function bytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/\s+/g, '');
  const result = new Uint8Array(cleaned.length / 2);
  for (let index = 0; index < result.length; index++) {
    result[index] = Number.parseInt(cleaned.slice(index * 2, index * 2 + 2), 16);
  }
  return result;
}

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

function field(result: ParseSuccess, id: string): ParsedField {
  const found = result.frame.fields.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(
      `field "${id}" not found; available: ${result.frame.fields.map((f) => f.id).join(', ')}`,
    );
  }
  return found;
}

function example(id: string): Uint8Array {
  const found = opcUaPlugin.exampleFrames.find((frame) => frame.id === id);
  if (found === undefined) throw new Error(`example "${id}" not found`);
  return found.bytes;
}

describe('opc-ua — çerçeve başlığı', () => {
  it('canParse yalnız tanınan üç harfli mesaj tipini kabul eder', () => {
    expect(opcUaParser.canParse(bytes('48 45 4C 46'))).toBe(true);
    expect(opcUaParser.canParse(bytes('4D 53 47 46'))).toBe(true);
    expect(opcUaParser.canParse(bytes('58 59 5A 46'))).toBe(false);
    expect(opcUaParser.canParse(new Uint8Array(0))).toBe(false);
  });

  it('boş tampon kurtarılabilir hata döner', () => {
    const failure = expectFailure(parseOpcUa(new Uint8Array(0)));
    expect(failure.error.code).toBe('truncated-frame');
    expect(failure.recoverable).toBe(true);
  });

  it('tanınmayan mesaj tipi start-delimiter hatası verir', () => {
    const failure = expectFailure(parseOpcUa(example('unknown-message-type')));
    expect(failure.error.code).toBe('start-delimiter-not-found');
    expect(failure.error.details?.['messageType']).toBe('XYZ');
  });

  it('8 bayttan kısa başlık kesik sayılır', () => {
    const failure = expectFailure(parseOpcUa(bytes('48 45 4C 46 20')));
    expect(failure.error.code).toBe('truncated-frame');
  });

  it('MessageSize BAŞLIĞIN KENDİSİNİ de sayar — 8ten küçük olamaz', () => {
    const failure = expectFailure(parseOpcUa(bytes('48 45 4C 46 04 00 00 00')));
    expect(failure.error.code).toBe('length-mismatch');
    expect(failure.error.details?.['messageSize']).toBe(4);
  });

  it('maxFrameLength aşılırsa kurtarılamaz hata döner', () => {
    const failure = expectFailure(parseOpcUa(example('hello'), { maxFrameLength: 16 }));
    expect(failure.error.code).toBe('frame-too-long');
    expect(failure.recoverable).toBe(false);
  });

  it('iptal sinyali parser-timeout ile döner', () => {
    const controller = new AbortController();
    controller.abort();
    const failure = expectFailure(parseOpcUa(example('hello'), { signal: controller.signal }));
    expect(failure.error.code).toBe('parser-timeout');
  });

  it('MessageSize tampondan küçükse fazlalık uyarı basar ve consumedBytes kısılır', () => {
    const padded = new Uint8Array(example('acknowledge').length + 3);
    padded.set(example('acknowledge'));
    const success = expectSuccess(parseOpcUa(padded));
    expect(success.consumedBytes).toBe(example('acknowledge').length);
    expect(success.frame.warnings.map((w) => w.code)).toContain('protocol.opcua.warning.trailingBytes');
  });
});

describe('opc-ua — UACP mesajları', () => {
  it('Hello bütün tampon parametrelerini ve EndpointUrl’i çözer', () => {
    const success = expectSuccess(parseOpcUa(example('hello')));
    expect(field(success, 'message-type').physicalValue).toBe('Hello');
    expect(field(success, 'chunk-type').physicalValue).toBe('Final chunk');
    expect(field(success, 'protocol-version').rawValue).toBe(0);
    expect(field(success, 'receive-buffer-size').rawValue).toBe(65536);
    expect(field(success, 'receive-buffer-size').unit).toBe('B');
    expect(field(success, 'send-buffer-size').rawValue).toBe(65536);
    expect(field(success, 'max-message-size').rawValue).toBe(16777216);
    expect(field(success, 'max-chunk-count').rawValue).toBe(5);
    expect(field(success, 'endpoint-url').physicalValue).toBe('opc.tcp://localhost:4840');
    expect(success.frame.valid).toBe(true);
  });

  it('Acknowledge EndpointUrl TAŞIMAZ — Hello ile aynı sanılamaz', () => {
    const success = expectSuccess(parseOpcUa(example('acknowledge')));
    expect(field(success, 'max-chunk-count').rawValue).toBe(5);
    expect(success.frame.fields.some((f) => f.id === 'endpoint-url')).toBe(false);
  });

  it('Error mesajı StatusCode adını çözer', () => {
    const success = expectSuccess(parseOpcUa(example('error-endpoint-url-invalid')));
    expect(field(success, 'error-code').rawValue).toBe(0x80830000);
    expect(field(success, 'error-code').physicalValue).toBe('BadTcpEndpointUrlInvalid (0x80830000)');
    expect(field(success, 'error-reason').physicalValue).toBe('Endpoint URL invalid');
  });

  it('ReverseHello ServerUri ve EndpointUrl’i sırasıyla çözer', () => {
    const success = expectSuccess(parseOpcUa(example('reverse-hello')));
    expect(field(success, 'server-uri').physicalValue).toBe('urn:demo:server');
    expect(field(success, 'endpoint-url').physicalValue).toBe('opc.tcp://localhost:4840');
  });

  it('null String ile BOŞ String ayrı gösterilir (tuzak 3)', () => {
    const success = expectSuccess(parseOpcUa(example('null-versus-empty-string')));
    expect(field(success, 'server-uri').rawValue).toBe('""');
    expect(field(success, 'server-uri').physicalValue).toBe('');
    expect(field(success, 'endpoint-url').rawValue).toBe('null');
    expect(field(success, 'endpoint-url').physicalValue).toBeUndefined();
  });

  it('gövde kesikse KISMİ alanlar korunur ve çerçeve hatası basılır', () => {
    const success = expectSuccess(parseOpcUa(example('truncated-body')));
    expect(success.frame.valid).toBe(false);
    expect(success.frame.errors[0]?.code).toBe('truncated-frame');
    // Kesilmeden önce okunan alanlar EKRANDA kalır (spec §47).
    expect(field(success, 'send-buffer-size').rawValue).toBe(65536);
  });

  it('MessageSize tampondan büyükse uyarı basılır, çökülmez', () => {
    const success = expectSuccess(parseOpcUa(example('truncated-body')));
    expect(success.frame.warnings.map((w) => w.code)).toContain(
      'protocol.opcua.warning.messageSizeExceedsBuffer',
    );
  });
});

describe('opc-ua — UASC zarfı', () => {
  it('OPN asimetrik güvenlik başlığını çözer ve #None politikasında gövdeyi açar', () => {
    const success = expectSuccess(parseOpcUa(example('open-secure-channel-request-none')));
    expect(field(success, 'secure-channel-id').rawValue).toBe(0);
    expect(field(success, 'security-policy-uri').physicalValue).toBe(
      'http://opcfoundation.org/UA/SecurityPolicy#None',
    );
    expect(field(success, 'sender-certificate').rawValue).toBe('null');
    expect(field(success, 'receiver-certificate-thumbprint').rawValue).toBe('null');
    expect(field(success, 'sequence-number').rawValue).toBe(1);
    expect(field(success, 'request-id').rawValue).toBe(1);
    expect(field(success, 'service-type-id').physicalValue).toBe('OpenSecureChannelRequest');
  });

  it('OPN sertifika alanı DOĞRULANMADIĞINI söyleyen uyarı taşır (kripto sınırı)', () => {
    const success = expectSuccess(parseOpcUa(example('open-secure-channel-request-none')));
    expect(field(success, 'sender-certificate').warnings).toContain(
      'protocol.opcua.warning.certificateNotValidated',
    );
    expect(success.frame.warnings.map((w) => w.code)).toContain(
      'protocol.opcua.warning.certificateNotValidated',
    );
  });

  it('OpenSecureChannelRequest gövdesi SecurityMode ve ömrü çözer', () => {
    const success = expectSuccess(parseOpcUa(example('open-secure-channel-request-none')));
    expect(field(success, 'security-token-request-type').physicalValue).toBe('Issue');
    expect(field(success, 'message-security-mode').physicalValue).toBe('None');
    expect(field(success, 'requested-lifetime').rawValue).toBe(3600000);
    expect(field(success, 'requested-lifetime').unit).toBe('ms');
  });

  it('MSG simetrik başlığı TokenId taşır, SecurityPolicyUri TAŞIMAZ', () => {
    const success = expectSuccess(parseOpcUa(example('read-request')));
    expect(field(success, 'secure-channel-id').rawValue).toBe(1);
    expect(field(success, 'token-id').rawValue).toBe(2);
    expect(success.frame.fields.some((f) => f.id === 'security-policy-uri')).toBe(false);
  });

  it('ChunkType A (Abort) gövdesi servis DEĞİL, StatusCode + Reason taşır', () => {
    const success = expectSuccess(parseOpcUa(example('message-abort-chunk')));
    expect(field(success, 'chunk-type').physicalValue).toBe('Abort (final, message aborted)');
    expect(field(success, 'abort-status').physicalValue).toBe('BadResponseTooLarge (0x80B90000)');
    expect(field(success, 'abort-reason').physicalValue).toBe('Response too large');
    expect(success.frame.fields.some((f) => f.id === 'service-type-id')).toBe(false);
  });

  it('ChunkType C (ara parça) gövdesine servis alanı UYDURULMAZ', () => {
    const success = expectSuccess(parseOpcUa(example('message-intermediate-chunk')));
    expect(field(success, 'chunk-type').physicalValue).toBe('Intermediate chunk');
    // SequenceHeader ara parçada da vardır ve okunur.
    expect(field(success, 'sequence-number').rawValue).toBe(41);
    expect(field(success, 'chunk-body').warnings).toContain(
      'protocol.opcua.warning.intermediateChunkBody',
    );
    expect(success.frame.fields.some((f) => f.id === 'service-type-id')).toBe(false);
  });

  it('tanınmayan chunk baytı ADLANDIRILMAZ ama sessiz de bırakılmaz', () => {
    // MSG + chunk baytı 'X' (0x58): F/C/A hiçbirine uymuyor.
    const success = expectSuccess(
      parseOpcUa(bytes('4D 53 47 58 10 00 00 00 01 00 00 00 02 00 00 00'), {
        options: { bodySecurity: 'plaintext' },
      }),
    );
    const chunk = field(success, 'chunk-type');
    expect(chunk.physicalValue).toBeUndefined();
    expect(chunk.valid).toBe(false);
    expect(chunk.warnings).toContain('protocol.opcua.warning.unknownChunkType');
  });

  it('HEL/ACK/ERR/RHE SequenceHeader TAŞIMAZ — aynı konum farklı anlam', () => {
    const hello = expectSuccess(parseOpcUa(example('hello')));
    expect(hello.frame.fields.some((f) => f.id === 'sequence-number')).toBe(false);
    const message = expectSuccess(parseOpcUa(example('read-request')));
    expect(message.frame.fields.some((f) => f.id === 'sequence-number')).toBe(true);
  });
});

describe('opc-ua — kripto sınırı ve decodeOptions', () => {
  it('auto sezgisi: servis id çözülmeyen gövde ŞİFRELİ sayılır', () => {
    const success = expectSuccess(parseOpcUa(example('message-encrypted-body')));
    const payload = field(success, 'encrypted-payload');
    expect(payload.valid).toBe(false);
    expect(payload.warnings).toContain('protocol.opcua.warning.encryptedPayload');
    // ŞİFRELİ modda SequenceNumber bile OKUNMAZ — sınır SequenceHeader'dadır.
    expect(success.frame.fields.some((f) => f.id === 'sequence-number')).toBe(false);
  });

  it('auto sezgisi: tanınan servis id gövdeyi AÇIK sayar', () => {
    const success = expectSuccess(parseOpcUa(example('read-request')));
    expect(success.frame.fields.some((f) => f.id === 'encrypted-payload')).toBe(false);
    expect(field(success, 'service-type-id').physicalValue).toBe('ReadRequest');
  });

  it('bodySecurity=encrypted açık gövdeyi de şifreli sayar (kullanıcı ezmesi)', () => {
    const success = expectSuccess(
      parseOpcUa(example('read-request'), { options: { bodySecurity: 'encrypted' } }),
    );
    expect(success.frame.fields.some((f) => f.id === 'encrypted-payload')).toBe(true);
    expect(success.frame.fields.some((f) => f.id === 'service-type-id')).toBe(false);
  });

  it('bodySecurity=plaintext şifreli görünen gövdeyi çözmeyi dener', () => {
    const success = expectSuccess(
      parseOpcUa(example('message-encrypted-body'), { options: { bodySecurity: 'plaintext' } }),
    );
    expect(success.frame.fields.some((f) => f.id === 'encrypted-payload')).toBe(false);
    expect(field(success, 'sequence-number')).toBeDefined();
  });

  it('signatureLength gövdenin SONUNU imza olarak ayırır, DOĞRULAMAZ', () => {
    const success = expectSuccess(
      parseOpcUa(example('read-request'), { options: { signatureLength: 8 } }),
    );
    const signature = field(success, 'signature');
    expect(signature.length).toBe(8);
    expect(signature.valid).toBe(false);
    expect(signature.warnings).toContain('protocol.opcua.warning.signatureNotVerified');
  });

  it('signatureLength=0 (varsayılan) imza alanı basmaz', () => {
    const success = expectSuccess(parseOpcUa(example('read-request')));
    expect(success.frame.fields.some((f) => f.id === 'signature')).toBe(false);
  });

  it('geçersiz signatureLength varsayılana düşer', () => {
    const success = expectSuccess(
      parseOpcUa(example('read-request'), { options: { signatureLength: -4 } }),
    );
    expect(success.frame.fields.some((f) => f.id === 'signature')).toBe(false);
  });
});

describe('opc-ua — servis gövdeleri', () => {
  it('ReadRequest NodesToRead girdilerini alan alan çözer', () => {
    const success = expectSuccess(parseOpcUa(example('read-request')));
    expect(field(success, 'read-timestamps-to-return').physicalValue).toBe('Both');
    expect(field(success, 'read-node-count').physicalValue).toBe('1 item(s)');
    const nodeIdField = success.frame.fields.find((f) => f.id.startsWith('read-node-id-'));
    expect(nodeIdField?.rawValue).toBe('ns=2;s=Machine1.Temperature');
    const attributeField = success.frame.fields.find((f) => f.id.startsWith('read-attribute-id-'));
    expect(attributeField?.physicalValue).toBe('Value');
  });

  it('RequestHeader her serviste çözülür ve zaman damgası 1601 epoch’ludur', () => {
    const success = expectSuccess(parseOpcUa(example('read-request')));
    expect(field(success, 'request-timestamp').rawValue).toBe(133485408000000000n);
    expect(field(success, 'request-timestamp').physicalValue).toBe('2024-01-01T00:00:00.000Z');
    expect(field(success, 'request-handle').rawValue).toBe(51);
    expect(field(success, 'request-timeout-hint').unit).toBe('ms');
    expect(field(success, 'request-audit-entry-id').rawValue).toBe('null');
  });

  it('ReadResponse DataValue’yu değer + durum + damga olarak biçimler', () => {
    const success = expectSuccess(parseOpcUa(example('read-response')));
    expect(field(success, 'response-service-result').physicalValue).toBe('Good (0x00000000)');
    const result = success.frame.fields.find((f) => /^read-result-\d+$/.test(f.id));
    expect(result?.physicalValue).toBe('Double=25.73 · Good (0x00000000) · src=2024-01-01T00:00:00.000Z');
  });

  it('WriteRequest WriteValue içindeki DataValue’yu çözer', () => {
    const success = expectSuccess(parseOpcUa(example('write-request')));
    expect(field(success, 'service-type-id').physicalValue).toBe('WriteRequest');
    const nodeIdField = success.frame.fields.find((f) => f.id.startsWith('write-node-id-'));
    expect(nodeIdField?.rawValue).toBe('ns=2;s=Machine1.Setpoint');
    const valueField = success.frame.fields.find((f) => f.id.startsWith('write-value-'));
    expect(valueField?.physicalValue).toBe('Double=42.5');
  });

  it('BrowseRequest BrowseDescription alanlarını çözer', () => {
    const success = expectSuccess(parseOpcUa(example('browse-request')));
    expect(field(success, 'service-type-id').physicalValue).toBe('BrowseRequest');
    expect(field(success, 'browse-view-timestamp').physicalValue).toBeUndefined();
    const browseNode = success.frame.fields.find((f) => f.id.startsWith('browse-node-id-'));
    expect(browseNode?.rawValue).toBe('i=85');
    const direction = success.frame.fields.find((f) => f.id.startsWith('browse-direction-'));
    expect(direction?.physicalValue).toBe('Forward');
  });

  it('CreateSubscriptionRequest yayın aralığını ms biriminde çözer', () => {
    const success = expectSuccess(parseOpcUa(example('create-subscription-request')));
    expect(field(success, 'service-type-id').physicalValue).toBe('CreateSubscriptionRequest');
    expect(field(success, 'subscription-publishing-interval').physicalValue).toBe(100);
    expect(field(success, 'subscription-publishing-interval').unit).toBe('ms');
    expect(field(success, 'subscription-publishing-enabled').physicalValue).toBe('true');
    expect(field(success, 'subscription-priority').rawValue).toBe(0);
  });

  it('KAPSAM DIŞI servis: ad ve header çözülür, gövde HAM kalır', () => {
    const success = expectSuccess(parseOpcUa(example('create-session-request-body-raw')));
    expect(field(success, 'service-type-id').physicalValue).toBe('CreateSessionRequest');
    expect(field(success, 'request-handle').rawValue).toBe(90);
    const body = field(success, 'service-body');
    expect(body.warnings).toContain('protocol.opcua.warning.serviceBodyNotDecoded');
    expect(success.frame.warnings.map((w) => w.code)).toContain(
      'protocol.opcua.warning.serviceBodyNotDecoded',
    );
  });

  it('tanınmayan servis id ADLANDIRILMAZ, uyarı basılır', () => {
    // TypeId FourByte ns=0 i=9999 — SERVICE_NAMES'te yok.
    const body = bytes('4D 53 47 46 1C 00 00 00 01 00 00 00 02 00 00 00 05 00 00 00 07 00 00 00 01 00 0F 27 AA BB');
    const success = expectSuccess(parseOpcUa(body, { options: { bodySecurity: 'plaintext' } }));
    const typeIdField = field(success, 'service-type-id');
    expect(typeIdField.physicalValue).toBeUndefined();
    expect(typeIdField.valid).toBe(false);
    expect(typeIdField.warnings).toContain('protocol.opcua.warning.unknownService');
  });
});

describe('opc-ua — eklenti sözleşmesi', () => {
  it('plugin kimliği, kategorisi ve parser’ı doğru bağlanmıştır', () => {
    expect(opcUaPlugin.id).toBe('opc-ua');
    expect(opcUaPlugin.category).toBe('industrial-automation');
    expect(opcUaPlugin.parser).toBe(opcUaParser);
    // Encoder BİLEREK yok: bu depoda encoder yalnız framing ailesinde var.
    expect(opcUaPlugin.encoder).toBeUndefined();
  });

  it('bütün örnekler expectedValid ile uyumlu çözülür', () => {
    for (const frame of opcUaPlugin.exampleFrames) {
      const result = parseOpcUa(frame.bytes);
      if (frame.expectedValid === false) {
        const invalid = result.success ? !result.frame.valid : true;
        expect(invalid, `${frame.id} geçerli çözülmemeliydi`).toBe(true);
        continue;
      }
      const success = expectSuccess(result);
      expect(success.frame.valid, `${frame.id} geçerli çözülmeliydi`).toBe(true);
      expect(success.frame.fields.length, `${frame.id} alan basmadı`).toBeGreaterThan(0);
    }
  });

  it('alan kimlikleri bir çerçeve içinde TEKİLDİR', () => {
    for (const frame of opcUaPlugin.exampleFrames) {
      const result = parseOpcUa(frame.bytes);
      if (!result.success) continue;
      const ids = result.frame.fields.map((f) => f.id);
      expect(new Set(ids).size, `${frame.id} çakışan alan id'si basıyor`).toBe(ids.length);
    }
  });

  it('decodeOptions iki kanal bildirir ve varsayılanları taşır', () => {
    const options = opcUaPlugin.decodeOptions ?? [];
    expect(options.map((option) => option.id)).toEqual(['bodySecurity', 'signatureLength']);
    expect(options[0]?.defaultValue).toBe('auto');
    expect(options[1]?.defaultValue).toBe(0);
  });

  it('parse SAFtır — aynı girdi aynı sonucu verir', () => {
    const first = expectSuccess(parseOpcUa(example('read-request')));
    const second = expectSuccess(parseOpcUa(example('read-request')));
    expect(first.frame.fields.map((f) => [f.id, f.offset, f.length])).toEqual(
      second.frame.fields.map((f) => [f.id, f.offset, f.length]),
    );
  });
});

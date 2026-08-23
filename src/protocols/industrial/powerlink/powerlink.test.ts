import { describe, expect, it } from 'vitest';

import {
  ERROR_BASIC_HEADER_TRUNCATED,
  WARN_BODY_NOT_DECODED,
  WARN_MESSAGE_TYPE_HIGH_BIT_SET,
  WARN_MESSAGE_TYPE_NOT_NAMED,
  WARN_PADDING_NOT_ZERO,
  WARN_PDO_PAYLOAD_NEEDS_MAPPING,
  WARN_PDO_SIZE_EXCEEDS_FRAME,
  WARN_SOA_FLAGS_PARTIALLY_NAMED,
  WARN_SOA_SERVICE_NOT_NAMED,
  parsePowerlink,
  powerlinkParser,
  powerlinkPlugin,
} from './powerlink';
import {
  WARN_ASND_SERVICE_NOT_NAMED,
  WARN_ERROR_HISTORY_TRAILING_BYTES,
  WARN_IP_FIELD_BYTE_ORDER_CONFLICT,
  WARN_NMT_COMMAND_DATA_NOT_DECODED,
  WARN_NMT_COMMAND_NOT_NAMED,
  WARN_SINGLE_SOURCE_FIELD,
  WARN_STATIC_ERROR_FIELD_NOT_SPLIT,
  decodeAsndPdu,
} from './powerlinkAsnd';
import {
  ERROR_SDO_COMMAND_TRUNCATED,
  ERROR_SDO_SEQUENCE_TRUNCATED,
  WARN_SDO_ABORT_CODE_NOT_NAMED,
  WARN_SDO_COMMAND_LAYER_EMPTY,
  WARN_SDO_COMMAND_NOT_NAMED,
  WARN_SDO_DATA_NEEDS_OBJECT_DICTIONARY,
  WARN_SDO_SEGMENT_SIZE_MISMATCH,
  decodeSdoPdu,
} from './powerlinkSdo';
import {
  NODE_ID_MN,
  byteAt,
  describeNmtState,
  describeNodeId,
  formatHex,
  formatVersionNibbles,
  readUint16Le,
  readUint32Le,
  readUint64Le,
} from './powerlinkFields';
import type {
  ParseFailure,
  ParseResult,
  ParseSuccess,
  ParsedField,
  ParsedFrame,
  ProtocolError,
} from '@/protocol-core/types';

function expectSuccess(result: ParseResult): ParseSuccess {
  if (!result.success) {
    throw new Error(`expected success, got failure ${result.error.code}: ${result.error.message}`);
  }
  return result;
}

function expectFailure(result: ParseResult): ParseFailure {
  if (result.success) throw new Error('expected failure, got success');
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

function exampleBytes(id: string): Uint8Array {
  const example = powerlinkPlugin.exampleFrames.find((candidate) => candidate.id === id);
  if (example === undefined) throw new Error(`example "${id}" not found`);
  return example.bytes;
}

/**
 * `powerlinkAsnd.ts`/`powerlinkSdo.ts`in fonksiyonları tam bir `ParsedFrame`
 * DEĞİL, doğrudan bir `fields` dizisi üretir (`cipCore.ts`/`iec104Asdu.ts` ile
 * aynı desen) — bu yüzden ayrı bir arama yardımcısı.
 */
function fieldIn(fields: readonly ParsedField[], id: string): ParsedField {
  const found = fields.find((field) => field.id === id);
  if (found === undefined) {
    throw new Error(`field "${id}" not found; got ${fields.map((f) => f.id).join(', ')}`);
  }
  return found;
}

const DESTINATION = [0x01, 0x11, 0x1e, 0x00, 0x00, 0x01];
const SOURCE = [0x02, 0x00, 0x00, 0xf0, 0x00, 0x01];

/** Ethernet başlığı + EtherType 0x88AB + MessageType/DestNode/SrcNode + gövde. */
function frame(
  messageType: number,
  destinationNodeId: number,
  sourceNodeId: number,
  body: readonly number[],
  padTo?: number,
): Uint8Array {
  const bytes = [
    ...DESTINATION,
    ...SOURCE,
    0x88,
    0xab,
    messageType,
    destinationNodeId,
    sourceNodeId,
    ...body,
  ];
  if (padTo !== undefined) while (bytes.length < padTo) bytes.push(0x00);
  return Uint8Array.from(bytes);
}

/** Aynı çerçevenin tek VLAN tag'li varyantı (TPID 0x8100 + TCI). */
function vlanFrame(
  messageType: number,
  destinationNodeId: number,
  sourceNodeId: number,
  body: readonly number[],
  padTo?: number,
): Uint8Array {
  const bytes = [
    ...DESTINATION,
    ...SOURCE,
    0x81,
    0x00,
    0xa0,
    0x64,
    0x88,
    0xab,
    messageType,
    destinationNodeId,
    sourceNodeId,
    ...body,
  ];
  if (padTo !== undefined) while (bytes.length < padTo) bytes.push(0x00);
  return Uint8Array.from(bytes);
}

describe('parsePowerlink — Ethernet sınırı ve EtherType', () => {
  it('MAC çiftini ve EtherType 0x88ABi çözer (ethercat.ts/profinet.ts ile aynı sözleşme)', () => {
    const { frame: parsed } = expectSuccess(parsePowerlink(exampleBytes('soc-cycle-start')));
    expect(fieldById(parsed, 'destination-mac').rawValue).toBe('01:11:1E:00:00:01');
    expect(fieldById(parsed, 'destination-mac').physicalValue).toBe('Multicast');
    expect(fieldById(parsed, 'source-mac').rawValue).toBe('02:00:00:F0:00:01');
    expect(fieldById(parsed, 'ethertype').rawValue).toBe(0x88ab);
    expect(fieldById(parsed, 'ethertype').physicalValue).toBe('POWERLINK (EPL V2)');
    expect(parsed.valid).toBe(true);
  });

  it('VLAN tagli cercevede ethertype/message-type ofseti 4 bayt ileride bulunur', () => {
    const { frame: parsed } = expectSuccess(parsePowerlink(vlanFrame(0x01, 0xff, 0xf0, [])));
    // 12 (MAC çifti) + 4 (VLAN tag) = 16 → EtherType, 18 → MessageType.
    expect(fieldById(parsed, 'ethertype').offset).toBe(16);
    expect(fieldById(parsed, 'message-type').offset).toBe(18);
    expect(fieldById(parsed, 'destination-node-id').offset).toBe(19);
    expect(fieldById(parsed, 'source-node-id').offset).toBe(20);
  });

  it('VLAN tagli cercevede temel baslik (3 bayt) eksikse truncated-frame basar', () => {
    // Yalnız MAC çifti + VLAN tag + EtherType (18 bayt) — MessageType bile yok.
    const bytes = Uint8Array.from([...DESTINATION, ...SOURCE, 0x81, 0x00, 0xa0, 0x64, 0x88, 0xab]);
    const { frame: parsed } = expectSuccess(parsePowerlink(bytes));
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('truncated-frame');
    expect(parsed.errors[0]?.message).toBe(ERROR_BASIC_HEADER_TRUNCATED);
    expect(hasField(parsed, 'message-type')).toBe(false);
  });

  it('EtherType POWERLINK değilse gövdeye DOKUNMAZ, kısmi çözüm + hata rozeti basar', () => {
    const bytes = exampleBytes('ethertype-not-powerlink');
    const { frame: parsed } = expectSuccess(parsePowerlink(bytes));
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('start-delimiter-not-found');
    expect(fieldById(parsed, 'ethertype').rawValue).toBe(0x0800);
    expect(hasField(parsed, 'message-type')).toBe(false);
    expect(fieldById(parsed, 'payload').valid).toBe(false);
  });

  it('Ethernet başlığı tamamlanmıyorsa ParseFailure döner (kısmi çerçeve değil)', () => {
    const failure = expectFailure(parsePowerlink(exampleBytes('frame-too-short')));
    expect(failure.error.code).toBe('truncated-frame');
    expect(failure.recoverable).toBe(true);
  });

  it('canParse yalnız 0x88AB EtherTypeına (VLANlı varyant dahil) evet der', () => {
    expect(powerlinkParser.canParse(exampleBytes('soc-cycle-start'))).toBe(true);
    expect(powerlinkParser.canParse(vlanFrame(0x01, 0xff, 0xf0, [], 21))).toBe(true);
    expect(powerlinkParser.canParse(exampleBytes('ethertype-not-powerlink'))).toBe(false);
    expect(powerlinkParser.canParse(exampleBytes('frame-too-short'))).toBe(false);
  });
});

describe('parsePowerlink — MessageType dispatch, node adresleri ve yüksek bit tuzağı', () => {
  it('MessageType/Destination Node ID/Source Node ID ofsetleri 14/15/16da sabit', () => {
    const { frame: parsed } = expectSuccess(parsePowerlink(exampleBytes('soc-cycle-start')));
    expect(fieldById(parsed, 'message-type').offset).toBe(14);
    expect(fieldById(parsed, 'message-type').rawValue).toBe(0x01);
    expect(fieldById(parsed, 'message-type').physicalValue).toBe('Start of Cycle (SoC)');
    expect(fieldById(parsed, 'destination-node-id').offset).toBe(15);
    expect(fieldById(parsed, 'destination-node-id').physicalValue).toBe('Broadcast');
    expect(fieldById(parsed, 'source-node-id').offset).toBe(16);
    expect(fieldById(parsed, 'source-node-id').physicalValue).toBe('Managing Node (MN)');
  });

  it('MessageType baytının 7. biti (W maskeler, O maskelemez) set olunca uyarır ama MASKELENMİŞ değerle dispatch eder', () => {
    const bytes = exampleBytes('soc-cycle-start').slice();
    bytes[14] = 0x01 | 0x80;
    const { frame: parsed } = expectSuccess(parsePowerlink(bytes));
    expect(fieldById(parsed, 'message-type').rawValue).toBe(0x01);
    expect(fieldById(parsed, 'message-type').physicalValue).toBe('Start of Cycle (SoC)');
    expect(warningCodes(parsed)).toContain(WARN_MESSAGE_TYPE_HIGH_BIT_SET);
    // Maskelenmemiş olsaydı 0x81 hiçbir tabloda yok, SoC gövdesi hiç çözülmezdi.
    expect(hasField(parsed, 'soc-nettime-seconds-20')).toBe(true);
  });

  it('adı olmayan MessageType uyarır ve gövdeyi TEK PARÇA ham + WARN_BODY_NOT_DECODED ile basar', () => {
    // 0x02: iki kaynakta da bir etikete karşılık gelmiyor.
    const { frame: parsed } = expectSuccess(parsePowerlink(frame(0x02, 0x01, 0xf0, [0xaa, 0xbb, 0xcc], 60)));
    const messageField = fieldById(parsed, 'message-type');
    expect(messageField.valid).toBe(false);
    expect(messageField.physicalValue).toBe('0x02');
    expect(warningCodes(parsed)).toContain(WARN_MESSAGE_TYPE_NOT_NAMED);
    expect(warningCodes(parsed)).toContain(WARN_BODY_NOT_DECODED);
    // bodyStart = 14 (headerStart) + 3 (BASIC_HEADER_LENGTH) = 17.
    expect(fieldById(parsed, 'payload-17').offset).toBe(17);
  });

  it('AInv adlıdır ama gövdesi kapsam dışıdır: ham + WARN_BODY_NOT_DECODED (boş kart basmak yasak)', () => {
    const { frame: parsed } = expectSuccess(parsePowerlink(exampleBytes('ainv-async-invite')));
    expect(fieldById(parsed, 'message-type').valid).toBe(true);
    expect(fieldById(parsed, 'message-type').physicalValue).toBe('Asynchronous Invite (AInv)');
    expect(warningCodes(parsed)).toContain(WARN_BODY_NOT_DECODED);
    expect(fieldById(parsed, 'payload-17').length).toBe(43);
  });

  it('describeNodeId: MN/CN/Broadcast/Diagnostic/ayrılmış bant ayrımı', () => {
    expect(describeNodeId(0)).toBe('Dynamically assigned');
    expect(describeNodeId(1)).toBe('Controlled Node (CN) 1');
    expect(describeNodeId(239)).toBe('Controlled Node (CN) 239');
    expect(describeNodeId(NODE_ID_MN)).toBe('Managing Node (MN)');
    expect(NODE_ID_MN).toBe(240);
    expect(describeNodeId(241)).toBe('Reserved (241)');
    expect(describeNodeId(253)).toBe('Diagnostic Device');
    expect(describeNodeId(254)).toBe('POWERLINK to legacy Ethernet Router');
    expect(describeNodeId(255)).toBe('Broadcast');
  });
});

describe('parsePowerlink — SoC gövdesi', () => {
  it('NetTime (seconds+nanoseconds) ve 64-bit RelativeTimeı (bigint) çözer', () => {
    const { frame: parsed } = expectSuccess(parsePowerlink(exampleBytes('soc-cycle-start')));
    expect(fieldById(parsed, 'soc-nettime-seconds-20').rawValue).toBe(1_700_000_000);
    expect(fieldById(parsed, 'soc-nettime-seconds-20').unit).toBe('s');
    expect(fieldById(parsed, 'soc-nettime-nanoseconds-24').rawValue).toBe(250_000);
    expect(fieldById(parsed, 'soc-nettime-nanoseconds-24').unit).toBe('ns');
    const relative = fieldById(parsed, 'soc-relative-time-28');
    expect(relative.rawValue).toBe(4_000_000n);
    expect(typeof relative.rawValue).toBe('bigint');
    expect(relative.unit).toBe('µs');
  });

  it('MC (multiplexed cycle completed) ve PS (prescaled slot) bayraklarını ayrı ayrı basar', () => {
    const { frame: off } = expectSuccess(parsePowerlink(exampleBytes('soc-cycle-start')));
    expect(fieldById(off, 'soc-flag-mc-18').physicalValue).toBe('Not set');
    expect(fieldById(off, 'soc-flag-ps-18').physicalValue).toBe('Not set');

    const { frame: on } = expectSuccess(parsePowerlink(exampleBytes('soc-multiplexed-prescaled')));
    expect(fieldById(on, 'soc-flag-mc-18').physicalValue).toBe('Set');
    expect(fieldById(on, 'soc-flag-ps-18').physicalValue).toBe('Set');
  });
});

describe('parsePowerlink — PReq/PRes gövdesi ve 16-bit Size (CANopen paylaşım kararının 3. kanıtı)', () => {
  it('PReq: RD bayrağı, PDOVersion nibble biçimi ve Size alanı ofset 22de 16-bit LE', () => {
    const { frame: parsed } = expectSuccess(parsePowerlink(exampleBytes('preq-poll-request')));
    expect(fieldById(parsed, 'pdo-flag-rd-18').physicalValue).toBe('Data valid');
    expect(fieldById(parsed, 'pdo-version-20').rawValue).toBe(0x10);
    expect(fieldById(parsed, 'pdo-version-20').physicalValue).toBe('1.0');
    const size = fieldById(parsed, 'pdo-size-22');
    expect(size.offset).toBe(22);
    expect(size.length).toBe(2);
    expect(size.rawValue).toBe(36);
    expect(fieldById(parsed, 'pdo-payload-24').length).toBe(36);
    expect(warningCodes(parsed)).toContain(WARN_PDO_PAYLOAD_NEEDS_MAPPING);
  });

  it('PRes: NMTStatus + EN/RD bayrakları ve PR/RS alt alanlarını çözer', () => {
    const { frame: parsed } = expectSuccess(parsePowerlink(exampleBytes('pres-poll-response')));
    expect(fieldById(parsed, 'pres-nmt-status-17').physicalValue).toBe('NMT_CS_OPERATIONAL');
    expect(fieldById(parsed, 'pdo-flag-en-18').physicalValue).toBe('Not set');
    expect(fieldById(parsed, 'pdo-flag-rd-18').physicalValue).toBe('Data valid');
    expect(fieldById(parsed, 'pdo-flag-pr-19').rawValue).toBe(0);
    expect(fieldById(parsed, 'pdo-flag-rs-19').rawValue).toBe(0);
  });

  it('CANopenın ≤8 baytlık DLC sınırı burada geçmez: 200 baytlık PDO çerçevede YAZAN 16-bit alanla taşınır', () => {
    const { frame: parsed } = expectSuccess(parsePowerlink(exampleBytes('pres-large-pdo')));
    expect(fieldById(parsed, 'pdo-size-22').rawValue).toBe(200);
    expect(fieldById(parsed, 'pdo-payload-24').length).toBe(200);
    expect(fieldById(parsed, 'pdo-flag-en-18').physicalValue).toBe('Set');
    expect(fieldById(parsed, 'pdo-flag-pr-19').rawValue).toBe(7);
    expect(parsed.valid).toBe(true);
  });

  it('Size çerçevede olandan büyükse UYDURULMAZ: uyarı + telde olanla kırpılmış yük', () => {
    const { frame: parsed } = expectSuccess(parsePowerlink(exampleBytes('pres-size-exceeds-frame')));
    const size = fieldById(parsed, 'pdo-size-22');
    expect(size.rawValue).toBe(512);
    expect(size.warnings).toContain(WARN_PDO_SIZE_EXCEEDS_FRAME);
    expect(warningCodes(parsed)).toContain(WARN_PDO_SIZE_EXCEEDS_FRAME);
    // Telde yalnız 36 bayt payload alanı vardı (60 bayt çerçeve − 24 ofset).
    expect(fieldById(parsed, 'pdo-payload-24').length).toBe(36);
  });

  it('PDO başlığı (7 bayt) eksikse UYDURULMAZ, truncated-frame basılır', () => {
    // MessageType=PReq(0x03), yalnız 3 bayt gövde (7 gerekiyor).
    const { frame: parsed } = expectSuccess(parsePowerlink(frame(0x03, 0x01, 0xf0, [0x00, 0x00, 0x00])));
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]?.code).toBe('truncated-frame');
    expect(hasField(parsed, 'pdo-size-24')).toBe(false);
  });
});

describe('parsePowerlink — SoA gövdesi ve SyncRequest', () => {
  it('IdentRequest: servis etiketi, hedef node ve POWERLINKVersion nibble biçimi', () => {
    const { frame: parsed } = expectSuccess(parsePowerlink(exampleBytes('soa-ident-request')));
    expect(fieldById(parsed, 'soa-requested-service-id-20').physicalValue).toBe('IdentRequest');
    expect(fieldById(parsed, 'soa-requested-service-target-21').physicalValue).toBe(
      'Controlled Node (CN) 1',
    );
    expect(fieldById(parsed, 'soa-powerlink-version-22').physicalValue).toBe('2.0');
    // DNA AN bitleri hiçbir kaynakta yok → SoA bayt2nin kalanı hep uyarır.
    expect(warningCodes(parsed)).toContain(WARN_SOA_FLAGS_PARTIALLY_NAMED);
  });

  it('adı olmayan RequestedServiceID uyarır ama alan GEÇERLİ formatta gösterilir', () => {
    const bytes = exampleBytes('soa-ident-request').slice();
    bytes[20] = 0x50; // 0xA0-0xFE üretici bandının dışında, tabloda da yok.
    const { frame: parsed } = expectSuccess(parsePowerlink(bytes));
    const service = fieldById(parsed, 'soa-requested-service-id-20');
    expect(service.valid).toBe(false);
    expect(service.physicalValue).toBe('0x50');
    expect(warningCodes(parsed)).toContain(WARN_SOA_SERVICE_NOT_NAMED);
  });

  it('SyncRequest (PollResponse Chaining) alanlarının ofsetlerini kilitler', () => {
    const { frame: parsed } = expectSuccess(parsePowerlink(exampleBytes('soa-sync-request')));
    expect(fieldById(parsed, 'soa-sync-control-24').offset).toBe(24);
    expect(fieldById(parsed, 'soa-sync-pres-time-first-28').rawValue).toBe(20_000);
    expect(fieldById(parsed, 'soa-sync-pres-time-second-32').rawValue).toBe(0);
    expect(fieldById(parsed, 'soa-sync-sync-mn-delay-first-36').rawValue).toBe(1_000);
    expect(fieldById(parsed, 'soa-sync-pres-fallback-timeout-44').rawValue).toBe(400_000);
    const mac = fieldById(parsed, 'soa-sync-destination-mac-48');
    expect(mac.offset).toBe(48);
    expect(mac.length).toBe(6);
    expect(mac.rawValue).toBe('02:00:00:01:00:01');
  });
});

describe('parsePowerlink — ASnd dispatch: IdentResponse ve StatusResponse', () => {
  it('IdentResponse: IdentResponseFlags tek-kaynak uyarısı ve IP alanları BAYT SIRASI ÇAKIŞMASI nedeniyle ham', () => {
    const { frame: parsed } = expectSuccess(parsePowerlink(exampleBytes('asnd-ident-response')));
    expect(fieldById(parsed, 'ires-nmt-status-20').physicalValue).toBe('NMT_CS_OPERATIONAL');
    const flags = fieldById(parsed, 'ires-flags-21');
    expect(flags.warnings).toContain(WARN_SINGLE_SOURCE_FIELD);
    expect(fieldById(parsed, 'ires-feature-flags-24').physicalValue).toBe('0x0000000E');
    expect(fieldById(parsed, 'ires-vendor-id-44').physicalValue).toBe('0x000000AB');
    expect(fieldById(parsed, 'ires-serial-number-56').physicalValue).toBe('0x0000BEEF');

    for (const id of ['ires-ip-address-84', 'ires-subnet-mask-88', 'ires-default-gateway-92']) {
      const field = fieldById(parsed, id);
      expect(field.length, id).toBe(4);
      expect(field.rawValue, id).toBeUndefined();
      expect(field.warnings, id).toContain(WARN_IP_FIELD_BYTE_ORDER_CONFLICT);
    }
    expect(warningCodes(parsed)).toContain(WARN_IP_FIELD_BYTE_ORDER_CONFLICT);
    expect(fieldById(parsed, 'ires-host-name-96').length).toBe(32);
    expect(fieldById(parsed, 'ires-vendor-specific-2-128').length).toBe(48);
  });

  it('adı olmayan ASnd ServiceID: üretici bandı ayrımı ve TEK PARÇA ham gövde', () => {
    const bytes = exampleBytes('asnd-ident-response').slice();
    bytes[17] = 0x10; // Ne tabloda ne 0xA0-0xFE üretici bandında.
    const { frame: parsed } = expectSuccess(parsePowerlink(bytes));
    const service = fieldById(parsed, 'asnd-service-id-17');
    expect(service.valid).toBe(false);
    expect(service.physicalValue).toBe('0x10');
    expect(warningCodes(parsed)).toContain(WARN_ASND_SERVICE_NOT_NAMED);
    expect(hasField(parsed, 'ires-nmt-status-20')).toBe(false);
    const payload = fieldById(parsed, 'asnd-payload-18');
    expect(payload.warnings).toEqual(expect.arrayContaining([expect.any(String)]));
  });

  it('StatusResponse: StaticErrorBitField TEK PARÇA ham (iç kırılım tek kaynaklı) ve hata geçmişi girdileri', () => {
    const { frame: parsed } = expectSuccess(parsePowerlink(exampleBytes('asnd-status-response')));
    const staticError = fieldById(parsed, 'sres-static-error-24');
    expect(staticError.length).toBe(8);
    expect(staticError.warnings).toContain(WARN_STATIC_ERROR_FIELD_NOT_SPLIT);

    expect(fieldById(parsed, 'sres-error-0-entry-mode-32').physicalValue).toBe('Cleared/none');
    expect(fieldById(parsed, 'sres-error-0-entry-status-32').physicalValue).toBe('Status entry');
    expect(fieldById(parsed, 'sres-error-0-code-34').physicalValue).toBe('0x8235');
    expect(fieldById(parsed, 'sres-error-1-entry-mode-52').physicalValue).toBe('Active');
    expect(fieldById(parsed, 'sres-error-1-entry-status-52').physicalValue).toBe('History entry');
    expect(fieldById(parsed, 'sres-error-1-code-54').physicalValue).toBe('0x8245');
  });

  it('hata geçmişi listesi tam bir 20 baytlık girdiye bölünmüyorsa kalanı ham + uyarı basar', () => {
    // ServiceID(1) + flags(2) + NMTStatus(1) + reserved(3) + StaticError(8) = 15,
    // ardından bir tam girdi (20) + 5 fazladan bayt = toplam 40.
    const data = Uint8Array.from([0x02, ...new Array<number>(39).fill(0)]);
    const fields: ParsedField[] = [];
    const warnings: string[] = [];
    const errors: ProtocolError[] = [];
    decodeAsndPdu(data, 0, data.length, false, fields, warnings, errors);
    expect(warnings).toContain(WARN_ERROR_HISTORY_TRAILING_BYTES);
    // listStart = 1 (bodyStart) + 14 (sabit başlık) = 15; 1 girdi (20) → kalan 35te.
    const trailing = fieldIn(fields, 'sres-error-list-trailing-35');
    expect(trailing.length).toBe(5);
  });
});

describe('parsePowerlink — ASnd dispatch: NMTCommand ve adı olmayan servis/komut', () => {
  it('NMTStartNodeı adlandırır, CommandData bölgesini ham + WARN_NMT_COMMAND_DATA_NOT_DECODED ile basar', () => {
    const { frame: parsed } = expectSuccess(parsePowerlink(exampleBytes('asnd-nmt-start-node')));
    expect(fieldById(parsed, 'nmtcmd-command-id-18').physicalValue).toBe('NMTStartNode');
    const data = fieldById(parsed, 'nmtcmd-command-data-20');
    // ASnd çerçeve sonuna kadar tüketir (padding alanı YOK): 60 (frame) - 20 (dataStart) = 40.
    expect(data.length).toBe(40);
    expect(warningCodes(parsed)).toContain(WARN_NMT_COMMAND_DATA_NOT_DECODED);
  });

  it('adı olmayan NMTCommandID uyarır (CommandData yine ham kalır)', () => {
    const bytes = exampleBytes('asnd-nmt-start-node').slice();
    bytes[18] = 0x99; // NMT_COMMAND_LABELS'te yok.
    const { frame: parsed } = expectSuccess(parsePowerlink(bytes));
    const command = fieldById(parsed, 'nmtcmd-command-id-18');
    expect(command.valid).toBe(false);
    expect(command.physicalValue).toBe('0x99');
    expect(warningCodes(parsed)).toContain(WARN_NMT_COMMAND_NOT_NAMED);
    expect(warningCodes(parsed)).toContain(WARN_NMT_COMMAND_DATA_NOT_DECODED);
  });

  it('NMTRequest: RequestedCommandID + RequestedCommandTarget + CommandData ayrı ayrı çözülür', () => {
    const fields: ParsedField[] = [];
    const warnings: string[] = [];
    const errors: ProtocolError[] = [];
    // ServiceID=0x03 (NMTRequest), CommandID=0x28 (NMTResetNode), Target=5, veri [0xaa].
    const data = Uint8Array.from([0x03, 0x28, 0x05, 0xaa]);
    decodeAsndPdu(data, 0, data.length, false, fields, warnings, errors);
    expect(fieldIn(fields, 'nmtreq-command-id-1').physicalValue).toBe('NMTResetNode');
    expect(fieldIn(fields, 'nmtreq-command-target-2').physicalValue).toBe('Controlled Node (CN) 5');
    expect(fieldIn(fields, 'nmtreq-command-data-3').length).toBe(1);
  });

  it('SyncResponse: Latency/SyncNodeNumber/SyncDelay/PResTime alanlarını ns birimiyle çözer', () => {
    const fields: ParsedField[] = [];
    const warnings: string[] = [];
    const errors: ProtocolError[] = [];
    const body = [
      0x00,
      0x00, // reserved(2)
      0x01,
      0x00,
      0x00,
      0x00, // SyncStatus = 1
      0xf4,
      0x01,
      0x00,
      0x00, // Latency = 500 ns
      0x05,
      0x00,
      0x00,
      0x00, // SyncNodeNumber = 5
      0xc8,
      0x00,
      0x00,
      0x00, // SyncDelay = 200 ns
      0xe8,
      0x03,
      0x00,
      0x00, // PResTimeFirst = 1000 ns
      0xd0,
      0x07,
      0x00,
      0x00, // PResTimeSecond = 2000 ns
    ];
    const data = Uint8Array.from([0x06, ...body]);
    decodeAsndPdu(data, 0, data.length, false, fields, warnings, errors);
    expect(fieldIn(fields, 'syncres-sync-status-3').physicalValue).toBe('0x00000001');
    expect(fieldIn(fields, 'syncres-latency-7').rawValue).toBe(500);
    expect(fieldIn(fields, 'syncres-latency-7').unit).toBe('ns');
    expect(fieldIn(fields, 'syncres-sync-node-number-11').rawValue).toBe(5);
    expect(fieldIn(fields, 'syncres-sync-node-number-11').unit).toBeUndefined();
    expect(fieldIn(fields, 'syncres-sync-delay-15').rawValue).toBe(200);
    expect(fieldIn(fields, 'syncres-pres-time-first-19').rawValue).toBe(1000);
    expect(fieldIn(fields, 'syncres-pres-time-second-23').rawValue).toBe(2000);
  });
});

describe('parsePowerlink — SDO via ASnd (Sequence Layer + Command Layer)', () => {
  it('ReceiveCon/SendCon aynı iki biti kullanır ama 0x03ün ANLAMI yönlere göre FARKLIDIR', () => {
    const fields: ParsedField[] = [];
    const warnings: string[] = [];
    const errors: ProtocolError[] = [];
    // Yalnız Sequence Layer (4 bayt); Command Layer YOK → "Sequence only".
    const data = Uint8Array.from([0x03, 0x03, 0x00, 0x00]);
    const summary = decodeSdoPdu(data, 0, data.length, fields, warnings, errors);
    expect(fieldIn(fields, 'sdo-receive-con-0').physicalValue).toBe(
      'Error Response (retransmission request)',
    );
    expect(fieldIn(fields, 'sdo-send-con-1').physicalValue).toBe(
      'Connection valid with acknowledge request',
    );
    expect(warnings).toContain(WARN_SDO_COMMAND_LAYER_EMPTY);
    expect(summary?.label).toBe('Sequence only');
  });

  it('ReceiveSequenceNumber/SendSequenceNumber üst 6 biti doğru maskeler', () => {
    const fields: ParsedField[] = [];
    const warnings: string[] = [];
    const errors: ProtocolError[] = [];
    // 0b11111000 → seq=0b111110=62, con=0b00=0. 0b00000101 → seq=1, con=1.
    const data = Uint8Array.from([0b11111000, 0b00000101, 0x00, 0x00]);
    decodeSdoPdu(data, 0, data.length, fields, warnings, errors);
    expect(fieldIn(fields, 'sdo-receive-sequence-number-0').rawValue).toBe(62);
    expect(fieldIn(fields, 'sdo-send-sequence-number-1').rawValue).toBe(1);
  });

  it('sequence layer 4 bayttan kısaysa UYDURULMAZ: undefined + truncated-frame hatası', () => {
    const fields: ParsedField[] = [];
    const warnings: string[] = [];
    const errors: ProtocolError[] = [];
    const summary = decodeSdoPdu(Uint8Array.from([0x00, 0x00]), 0, 2, fields, warnings, errors);
    expect(summary).toBeUndefined();
    expect(errors[0]?.code).toBe('truncated-frame');
    expect(errors[0]?.message).toBe(ERROR_SDO_SEQUENCE_TRUNCATED);
    expect(fields).toEqual([]);
  });

  it('ReadByIndex isteği (expedited): Command Layer başlığı + Index/Sub-index alt başlığını çözer', () => {
    const { frame: parsed } = expectSuccess(parsePowerlink(exampleBytes('asnd-sdo-read-by-index')));
    expect(fieldById(parsed, 'sdo-transaction-id-23').rawValue).toBe(7);
    expect(fieldById(parsed, 'sdo-flag-response-24').physicalValue).toBe('Request');
    expect(fieldById(parsed, 'sdo-flag-abort-24').physicalValue).toBe('Transfer OK');
    expect(fieldById(parsed, 'sdo-flag-segmentation-24').physicalValue).toBe('Expedited transfer');
    expect(fieldById(parsed, 'sdo-command-id-25').physicalValue).toBe('ReadByIndex');
    expect(fieldById(parsed, 'sdo-object-index-30').physicalValue).toBe('0x1006');
    expect(fieldById(parsed, 'sdo-object-sub-index-32').physicalValue).toBe('0x00');
    expect(warningCodes(parsed)).toContain(WARN_SDO_DATA_NEEDS_OBJECT_DICTIONARY);
  });

  it('Abort: adlandırılmış kod (asnd-sdo-abort örneği) doğru mesajla çözülür', () => {
    const { frame: parsed } = expectSuccess(parsePowerlink(exampleBytes('asnd-sdo-abort')));
    expect(fieldById(parsed, 'sdo-flag-abort-24').physicalValue).toBe('Abort transfer');
    const abort = fieldById(parsed, 'sdo-abort-code-30');
    expect(abort.rawValue).toBe(0x06020000);
    expect(abort.physicalValue).toBe('Object does not exist in the object dictionary');
    expect(abort.valid).toBe(true);
  });

  it('Abort: adı olmayan kod ham hex ile gösterilir ve WARN_SDO_ABORT_CODE_NOT_NAMED taşır', () => {
    const bytes = exampleBytes('asnd-sdo-abort').slice();
    // Abort Code (offset 30, 4 bayt LE) → 0x12345678, hiçbir kaynakta yok.
    bytes[30] = 0x78;
    bytes[31] = 0x56;
    bytes[32] = 0x34;
    bytes[33] = 0x12;
    const { frame: parsed } = expectSuccess(parsePowerlink(bytes));
    const abort = fieldById(parsed, 'sdo-abort-code-30');
    // CIPin adlandırılmamış servis kodu emsali: adsız olmak alanı GEÇERSİZ yapmaz, yalnız uyarır.
    expect(abort.valid).toBe(true);
    expect(abort.physicalValue).toBe('0x12345678');
    expect(warningCodes(parsed)).toContain(WARN_SDO_ABORT_CODE_NOT_NAMED);
  });

  it('Abort payloadı 4 bayttan kısaysa ERROR_SDO_COMMAND_TRUNCATED uyarısıyla "truncated" etiketi döner', () => {
    const fields: ParsedField[] = [];
    const warnings: string[] = [];
    const errors: ProtocolError[] = [];
    // Sequence(4) + Command header(8, Abort biti set) + yalnız 2 baytlık payload.
    const data = Uint8Array.from([
      0x0a, 0x0e, 0x00, 0x00, 0x00, 0x07, 0xc0, 0x02, 0x00, 0x00, 0x00, 0x00, 0xaa, 0xbb,
    ]);
    const summary = decodeSdoPdu(data, 0, data.length, fields, warnings, errors);
    expect(summary?.label).toBe('Abort (truncated)');
    expect(summary?.isAbort).toBe(true);
    expect(warnings).toContain(ERROR_SDO_COMMAND_TRUNCATED);
  });

  it('adı olmayan CommandID: by-index alt başlığı ATLANIR, gövde TEK PARÇA ham', () => {
    const bytes = exampleBytes('asnd-sdo-read-by-index').slice();
    bytes[25] = 0x50; // COMMAND_LABELSte yok; ReadByIndex/WriteByIndex de değil.
    const { frame: parsed } = expectSuccess(parsePowerlink(bytes));
    const command = fieldById(parsed, 'sdo-command-id-25');
    expect(command.valid).toBe(false);
    expect(command.physicalValue).toBe('0x50');
    expect(warningCodes(parsed)).toContain(WARN_SDO_COMMAND_NOT_NAMED);
    expect(hasField(parsed, 'sdo-object-index-30')).toBe(false);
    // payloadStart 30dan (by-index başlığı atlandığı için 34 DEĞİL) veri başlar.
    const commandData = fieldById(parsed, 'sdo-command-data-30');
    expect(commandData.length).toBe(30);
    expect(warningCodes(parsed)).toContain(WARN_SDO_DATA_NEEDS_OBJECT_DICTIONARY);
  });

  it('SegmentSize telde olandan büyükse SÖZÜ tutulmadığı söylenir (WARN_SDO_SEGMENT_SIZE_MISMATCH)', () => {
    const bytes = exampleBytes('asnd-sdo-read-by-index').slice();
    // SegmentSize (offset 26, 2 bayt LE) 4 → 999.
    bytes[26] = 0xe7;
    bytes[27] = 0x03;
    const { frame: parsed } = expectSuccess(parsePowerlink(bytes));
    const segmentSize = fieldById(parsed, 'sdo-segment-size-26');
    expect(segmentSize.rawValue).toBe(999);
    expect(segmentSize.warnings).toContain(WARN_SDO_SEGMENT_SIZE_MISMATCH);
    expect(warningCodes(parsed)).toContain(WARN_SDO_SEGMENT_SIZE_MISMATCH);
  });

  it('Command Layer boşsa (yalnız Sequence Layer) "Sequence only" özetiyle uyarı basar (uçtan uca)', () => {
    // ASnd(0x06) + SDO(0x05) + Sequence Layer(4) + 2 fazladan bayt (8den az).
    const bytes = frame(0x06, 0x01, 0xf0, [0x05, 0x0a, 0x0e, 0x00, 0x00, 0xaa, 0xbb]);
    const { frame: parsed } = expectSuccess(parsePowerlink(bytes));
    expect(warningCodes(parsed)).toContain(WARN_SDO_COMMAND_LAYER_EMPTY);
    expect(hasField(parsed, 'sdo-command-id-22')).toBe(false);
    expect(fieldById(parsed, 'sdo-command-layer-absent-22').length).toBe(2);
  });
});

describe('parsePowerlink — padding, maxFrameLength ve iptal', () => {
  it('Bildirilen bölgeden sonraki bayt sıfır değilse uyarır (ama alan GEÇERLİ kalır — DCPden FARKLI)', () => {
    const bytes = exampleBytes('soc-cycle-start').slice();
    bytes[40] = 0xff; // padding bölgesi [36,60).
    const { frame: parsed } = expectSuccess(parsePowerlink(bytes));
    const padding = fieldById(parsed, 'padding');
    expect(padding.valid).toBe(true);
    expect(padding.warnings).toContain(WARN_PADDING_NOT_ZERO);
    expect(warningCodes(parsed)).toContain(WARN_PADDING_NOT_ZERO);
  });

  it('maxFrameLength aşılırsa frame-too-long ile durur, buffer ayırmaz', () => {
    const failure = expectFailure(
      powerlinkParser.parse(exampleBytes('soc-cycle-start'), { maxFrameLength: 32 }),
    );
    expect(failure.error.code).toBe('frame-too-long');
  });

  it('iptal edilmiş signalda parser-timeout döner, exception fırlatmaz', () => {
    const controller = new AbortController();
    controller.abort();
    const failure = expectFailure(
      powerlinkParser.parse(exampleBytes('soc-cycle-start'), { signal: controller.signal }),
    );
    expect(failure.error.code).toBe('parser-timeout');
  });
});

describe('powerlinkFields — LE okuyucular ve NMT durum etiketleri', () => {
  it('byteAt sınır dışı okumada 0 döner (noUncheckedIndexedAccess guard)', () => {
    const data = Uint8Array.from([5, 6]);
    expect(byteAt(data, 0)).toBe(5);
    expect(byteAt(data, 5)).toBe(0);
  });

  it('readUint16Le/readUint32Le/readUint64Le little-endian okur', () => {
    expect(readUint16Le(Uint8Array.from([0x34, 0x12]), 0)).toBe(0x1234);
    expect(readUint32Le(Uint8Array.from([0x78, 0x56, 0x34, 0x12]), 0)).toBe(0x12345678);
    expect(readUint64Le(Uint8Array.from([5, 0, 0, 0, 0, 0, 0, 0]), 0)).toBe(5n);
    expect(
      readUint64Le(Uint8Array.from([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]), 0),
    ).toBe(2n ** 64n - 1n);
  });

  it('formatHex sabit genişliğe sıfırla doldurur', () => {
    expect(formatHex(255, 2)).toBe('0xFF');
    expect(formatHex(5, 4)).toBe('0x0005');
  });

  it('formatVersionNibbles üst/alt nibble ayrımını yapar', () => {
    expect(formatVersionNibbles(0x21)).toBe('2.1');
    expect(formatVersionNibbles(0x10)).toBe('1.0');
  });

  it('describeNmtState: ortak durumlar rol bağımsız, STOPPED yalnız CN tarafında bilinir', () => {
    expect(describeNmtState(0x00, true)).toEqual({ label: 'NMT_GS_OFF', known: true });
    expect(describeNmtState(0x00, false)).toEqual({ label: 'NMT_GS_OFF', known: true });
    expect(describeNmtState(0xfd, true)).toEqual({ label: 'NMT_MS_OPERATIONAL', known: true });
    expect(describeNmtState(0xfd, false)).toEqual({ label: 'NMT_CS_OPERATIONAL', known: true });
    // MN'den 0x4D (STOPPED) gelmesi W'nin epl_nmt_ms_vals tablosunda YOK.
    expect(describeNmtState(0x4d, false)).toEqual({ label: 'NMT_CS_STOPPED', known: true });
    expect(describeNmtState(0x4d, true)).toEqual({ label: '0x4D', known: false });
    expect(describeNmtState(0x99, false)).toEqual({ label: '0x99', known: false });
  });
});

describe('powerlinkPlugin', () => {
  it('katalogdaki kimlik, kategori ve parser bağını taşır; decodeOptions AÇILMADI', () => {
    expect(powerlinkPlugin.id).toBe('powerlink');
    expect(powerlinkPlugin.category).toBe('industrial-automation');
    expect(powerlinkPlugin.parser).toBe(powerlinkParser);
    expect(powerlinkPlugin.decodeOptions).toBeUndefined();
    expect(powerlinkPlugin.encoder).toBeUndefined();
  });

  it('her örnek çözülür ve expectedValid ile eşleşir', () => {
    for (const example of powerlinkPlugin.exampleFrames) {
      const result = powerlinkParser.parse(example.bytes);
      if (!result.success) {
        expect(example.expectedValid, `example "${example.id}" failed: ${result.error.code}`).toBe(
          false,
        );
        continue;
      }
      expect(result.frame.valid, `example "${example.id}"`).toBe(example.expectedValid ?? true);
    }
  });

  it('her örnek adı/açıklaması protocol.powerlink.example. önekli çeviri anahtarıdır', () => {
    for (const example of powerlinkPlugin.exampleFrames) {
      expect(example.name.startsWith('protocol.powerlink.example.'), example.id).toBe(true);
      expect(example.description?.startsWith('protocol.powerlink.example.'), example.id).toBe(true);
    }
  });
});

import { describe, expect, it } from 'vitest';

import {
  XCP_COMMAND_NAMES,
  XCP_ERROR_NAMES,
  XCP_EVENT_NAMES,
  XCP_RESPONSE_CLASSES,
  decodeXcpPacket,
} from './xcpPacket';
import type { ParsedField, ProtocolError, ProtocolWarning } from '@/protocol-core/types';

function decode(
  bytes: number[],
  role: 'command' | 'response',
  byteOrder: 'little-endian' | 'big-endian' = 'little-endian',
) {
  const data = Uint8Array.from(bytes);
  const fields: ParsedField[] = [];
  const warnings: ProtocolWarning[] = [];
  const errors: ProtocolError[] = [];
  const summary = decodeXcpPacket(data, 0, data.length, role, byteOrder, fields, warnings, errors, '');
  return { summary, fields, warnings, errors };
}

function fieldById(fields: ParsedField[], id: string): ParsedField | undefined {
  return fields.find((field) => field.id === id);
}

describe('XCP_COMMAND_NAMES — komut tablosunun her satırı (Scapy + pyxcp çapraz doğrulaması)', () => {
  const EXPECTED_COMMANDS: ReadonlyArray<[number, string]> = [
    [0xff, 'CONNECT'],
    [0xfe, 'DISCONNECT'],
    [0xfd, 'GET_STATUS'],
    [0xfc, 'SYNCH'],
    [0xfb, 'GET_COMM_MODE_INFO'],
    [0xfa, 'GET_ID'],
    [0xf9, 'SET_REQUEST'],
    [0xf8, 'GET_SEED'],
    [0xf7, 'UNLOCK'],
    [0xf6, 'SET_MTA'],
    [0xf5, 'UPLOAD'],
    [0xf4, 'SHORT_UPLOAD'],
    [0xf3, 'BUILD_CHECKSUM'],
    [0xf2, 'TRANSPORT_LAYER_CMD'],
    [0xf1, 'USER_CMD'],
    [0xf0, 'DOWNLOAD'],
    [0xef, 'DOWNLOAD_NEXT'],
    [0xee, 'DOWNLOAD_MAX'],
    [0xed, 'SHORT_DOWNLOAD'],
    [0xec, 'MODIFY_BITS'],
    [0xeb, 'SET_CAL_PAGE'],
    [0xea, 'GET_CAL_PAGE'],
    [0xe9, 'GET_PAG_PROCESSOR_INFO'],
    [0xe8, 'GET_SEGMENT_INFO'],
    [0xe7, 'GET_PAGE_INFO'],
    [0xe6, 'SET_SEGMENT_MODE'],
    [0xe5, 'GET_SEGMENT_MODE'],
    [0xe4, 'COPY_CAL_PAGE'],
    [0xe3, 'CLEAR_DAQ_LIST'],
    [0xe2, 'SET_DAQ_PTR'],
    [0xe1, 'WRITE_DAQ'],
    [0xe0, 'SET_DAQ_LIST_MODE'],
    [0xdf, 'GET_DAQ_LIST_MODE'],
    [0xde, 'START_STOP_DAQ_LIST'],
    [0xdd, 'START_STOP_SYNCH'],
    [0xdc, 'GET_DAQ_CLOCK'],
    [0xdb, 'READ_DAQ'],
    [0xda, 'GET_DAQ_PROCESSOR_INFO'],
    [0xd9, 'GET_DAQ_RESOLUTION_INFO'],
    [0xd8, 'GET_DAQ_LIST_INFO'],
    [0xd7, 'GET_DAQ_EVENT_INFO'],
    [0xd6, 'FREE_DAQ'],
    [0xd5, 'ALLOC_DAQ'],
    [0xd4, 'ALLOC_ODT'],
    [0xd3, 'ALLOC_ODT_ENTRY'],
    [0xd2, 'PROGRAM_START'],
    [0xd1, 'PROGRAM_CLEAR'],
    [0xd0, 'PROGRAM'],
    [0xcf, 'PROGRAM_RESET'],
    [0xce, 'GET_PGM_PROCESSOR_INFO'],
    [0xcd, 'GET_SECTOR_INFO'],
    [0xcc, 'PROGRAM_PREPARE'],
    [0xcb, 'PROGRAM_FORMAT'],
    [0xca, 'PROGRAM_NEXT'],
    [0xc9, 'PROGRAM_MAX'],
    [0xc8, 'PROGRAM_VERIFY'],
    [0xc7, 'WRITE_DAQ_MULTIPLE'],
  ];

  it.each(EXPECTED_COMMANDS)('0x%s → %s', (pid, name) => {
    expect(XCP_COMMAND_NAMES.get(pid)).toBe(name);
  });

  it('tam olarak 57 komut tanımlar (0xC7-0xFF, Scapy + pyxcp örtüşen kesin küme)', () => {
    expect(XCP_COMMAND_NAMES.size).toBe(EXPECTED_COMMANDS.length);
    expect(EXPECTED_COMMANDS.length).toBe(57);
  });

  it('0xC0-0xC6 aralığı tanımsız kalır (iki kaynakta da isim yok)', () => {
    for (let pid = 0xc0; pid <= 0xc6; pid += 1) {
      expect(XCP_COMMAND_NAMES.get(pid), `0x${pid.toString(16)}`).toBeUndefined();
    }
  });
});

describe('XCP_ERROR_NAMES — hata kodu tablosu', () => {
  const EXPECTED_ERRORS: ReadonlyArray<[number, string]> = [
    [0x00, 'ERR_CMD_SYNCH'],
    [0x10, 'ERR_CMD_BUSY'],
    [0x11, 'ERR_DAQ_ACTIVE'],
    [0x12, 'ERR_PGM_ACTIVE'],
    [0x20, 'ERR_CMD_UNKNOWN'],
    [0x21, 'ERR_CMD_SYNTAX'],
    [0x22, 'ERR_OUT_OF_RANGE'],
    [0x23, 'ERR_WRITE_PROTECTED'],
    [0x24, 'ERR_ACCESS_DENIED'],
    [0x25, 'ERR_ACCESS_LOCKED'],
    [0x26, 'ERR_PAGE_NOT_VALID'],
    [0x27, 'ERR_MODE_NOT_VALID'],
    [0x28, 'ERR_SEGMENT_NOT_VALID'],
    [0x29, 'ERR_SEQUENCE'],
    [0x2a, 'ERR_DAQ_CONFIG'],
    [0x30, 'ERR_MEMORY_OVERFLOW'],
    [0x31, 'ERR_GENERIC'],
    [0x32, 'ERR_VERIFY'],
    [0x33, 'ERR_RESOURCE_TEMPORARY_NOT_ACCESSIBLE'],
  ];

  it.each(EXPECTED_ERRORS)('0x%s → %s', (code, name) => {
    expect(XCP_ERROR_NAMES.get(code)).toBe(name);
  });

  it('tam olarak 19 hata kodu tanımlar (18 çift-kaynaklı + 1 yalnız-pyxcp)', () => {
    expect(XCP_ERROR_NAMES.size).toBe(19);
  });
});

describe('XCP_EVENT_NAMES — olay kodu tablosu', () => {
  const EXPECTED_EVENTS: ReadonlyArray<[number, string]> = [
    [0x00, 'EV_RESUME_MODE'],
    [0x01, 'EV_CLEAR_DAQ'],
    [0x02, 'EV_STORE_DAQ'],
    [0x03, 'EV_STORE_CAL'],
    [0x05, 'EV_CMD_PENDING'],
    [0x06, 'EV_DAQ_OVERLOAD'],
    [0x07, 'EV_SESSION_TERMINATED'],
    [0x08, 'EV_TIME_SYNC'],
    [0x09, 'EV_STIM_TIMEOUT'],
    [0x0a, 'EV_SLEEP'],
    [0x0b, 'EV_WAKE_UP'],
    [0x0c, 'EV_ECU_STATE_CHANGE'],
    [0xfe, 'EV_USER'],
    [0xff, 'EV_TRANSPORT'],
  ];

  it.each(EXPECTED_EVENTS)('0x%s → %s', (code, name) => {
    expect(XCP_EVENT_NAMES.get(code)).toBe(name);
  });

  it('0x04 iki kaynakta da rezerve — tanımsız kalır', () => {
    expect(XCP_EVENT_NAMES.get(0x04)).toBeUndefined();
  });
});

describe('XCP_RESPONSE_CLASSES', () => {
  it('dört yanıt sınıfını doğru eşler', () => {
    expect(XCP_RESPONSE_CLASSES.get(0xff)).toBe('positive-response');
    expect(XCP_RESPONSE_CLASSES.get(0xfe)).toBe('error');
    expect(XCP_RESPONSE_CLASSES.get(0xfd)).toBe('event');
    expect(XCP_RESPONSE_CLASSES.get(0xfc)).toBe('service');
  });
});

describe('decodeXcpPacket — role: command', () => {
  it('CONNECT (0xFF) komut adını ve connection_mode alanını çözer', () => {
    const { summary, fields } = decode([0xff, 0x00], 'command');
    expect(summary.kind).toBe('command');
    expect(summary.commandName).toBe('CONNECT');
    expect(fieldById(fields, 'pid')?.physicalValue).toBe('CONNECT');
    expect(fieldById(fields, 'connection-mode')?.physicalValue).toBe('NORMAL');
  });

  it('CONNECT connection_mode 0x01 → USER_DEFINED', () => {
    const { fields } = decode([0xff, 0x01], 'command');
    expect(fieldById(fields, 'connection-mode')?.physicalValue).toBe('USER_DEFINED');
  });

  it('DISCONNECT/GET_STATUS/SYNCH/GET_COMM_MODE_INFO parametresizdir, ek alan üretmez', () => {
    for (const pid of [0xfe, 0xfd, 0xfc, 0xfb]) {
      const { fields, warnings } = decode([pid], 'command');
      expect(fields).toHaveLength(1); // yalnız PID alanı
      expect(warnings).toHaveLength(0);
    }
  });

  it('SET_MTA (0xF6): reserved+address_extension+address yapısal çözülür (little-endian)', () => {
    // pyxcp master.setMta ile BİREBİR aynı bayt sırası: PID,0,0,ext,addr(LE).
    const { fields } = decode([0xf6, 0x00, 0x00, 0x02, 0x00, 0x10, 0x00, 0x00], 'command');
    expect(fieldById(fields, 'address-extension')?.rawValue).toBe(2);
    expect(fieldById(fields, 'address')?.rawValue).toBe(0x00001000);
  });

  it('SET_MTA big-endian byteOrder ile farklı adres üretir (aynı bayt dizisi)', () => {
    const { fields } = decode([0xf6, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00], 'command', 'big-endian');
    // Big-endian okunuşta 00 10 00 00 → 0x00100000, little-endian'daki 0x00001000'den FARKLI.
    expect(fieldById(fields, 'address')?.rawValue).toBe(0x00100000);
  });

  it('UPLOAD gibi yapısal çözümü olmayan komutlar ham parametre + uyarı üretir', () => {
    const { fields, warnings } = decode([0xf5, 0x04], 'command');
    expect(fieldById(fields, 'parameters')?.rawBytes).toEqual(Uint8Array.from([0x04]));
    expect(warnings.some((w) => w.code === 'protocol.xcp.warning.commandParametersRaw')).toBe(true);
  });

  it('0x00-0xBF aralığı STIM/DAQ verisidir, komut tablosunda aranmaz', () => {
    const { summary, warnings } = decode([0x00, 0x11, 0x22], 'command');
    expect(summary.kind).toBe('daq-data');
    expect(warnings.some((w) => w.code === 'protocol.xcp.warning.daqData')).toBe(true);
  });

  it('0xC0-0xC6 aralığı tanımsız komut olarak işaretlenir, uydurulmaz', () => {
    const { summary, warnings } = decode([0xc3], 'command');
    expect(summary.kind).toBe('unassigned-command');
    expect(warnings.some((w) => w.code === 'protocol.xcp.warning.unassignedCommand')).toBe(true);
  });
});

describe('decodeXcpPacket — role: response', () => {
  it('0xFF pozitif yanıt (RES) olarak sınıflanır, CONNECT gövdesi (7B) yapısal çözülür', () => {
    const { summary, fields } = decode([0xff, 0x05, 0x00, 0x08, 0x08, 0x00, 0x01, 0x01], 'response');
    expect(summary.responseClass).toBe('positive-response');
    expect(fieldById(fields, 'resource')?.rawValue).toBe(0x05);
    expect(fieldById(fields, 'max-cto')?.rawValue).toBe(8);
    expect(fieldById(fields, 'max-dto')?.rawValue).toBe(8);
  });

  it('AYNI PID (0xFF) role=command iken CONNECT, role=response iken RES anlamına gelir', () => {
    const asCommand = decode([0xff, 0x00], 'command');
    const asResponse = decode([0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 'response');
    expect(asCommand.summary.commandName).toBe('CONNECT');
    expect(asCommand.summary.responseClass).toBeUndefined();
    expect(asResponse.summary.responseClass).toBe('positive-response');
    expect(asResponse.summary.commandName).toBeUndefined();
  });

  it('GET_STATUS gövdesi (5B) yapısal çözülür', () => {
    const { fields } = decode([0xff, 0x00, 0x00, 0x00, 0x2a, 0x00], 'response');
    expect(fieldById(fields, 'session-configuration-id')?.rawValue).toBe(0x2a);
  });

  it('0xFE hata yanıtı (ERR) error_code tablosundan adlandırılır', () => {
    const { summary, fields } = decode([0xfe, 0x20], 'response');
    expect(summary.responseClass).toBe('error');
    expect(summary.errorCode).toBe(0x20);
    expect(summary.errorName).toBe('ERR_CMD_UNKNOWN');
    expect(fieldById(fields, 'error-code')?.physicalValue).toBe('ERR_CMD_UNKNOWN');
  });

  it('AYNI PID (0xFE) role=command iken DISCONNECT, role=response iken ERR anlamına gelir', () => {
    const asCommand = decode([0xfe], 'command');
    const asResponse = decode([0xfe, 0x10], 'response');
    expect(asCommand.summary.commandName).toBe('DISCONNECT');
    expect(asResponse.summary.responseClass).toBe('error');
    expect(asResponse.summary.errorName).toBe('ERR_CMD_BUSY');
  });

  it('0xFD olay paketi (EV) event_code tablosundan adlandırılır', () => {
    const { fields } = decode([0xfd, 0x06], 'response');
    expect(fieldById(fields, 'event-code')?.physicalValue).toBe('EV_DAQ_OVERLOAD');
  });

  it('0xFC servis paketi (SERV) kodu HAM kalır (isim tek kaynaklı, adlandırılmaz)', () => {
    const { fields } = decode([0xfc, 0x01], 'response');
    const serviceField = fieldById(fields, 'service-request-code');
    expect(serviceField?.rawValue).toBe(1);
    expect(serviceField?.physicalValue).toBeUndefined();
  });

  it('bilinmeyen pozitif yanıt gövde uzunluğu (ne 7 ne 5 bayt) ham + uyarı üretir', () => {
    const { fields, warnings } = decode([0xff, 0x01, 0x02, 0x03], 'response');
    expect(fieldById(fields, 'response-data')?.rawBytes).toEqual(Uint8Array.from([0x01, 0x02, 0x03]));
    expect(warnings.some((w) => w.code === 'protocol.xcp.warning.responseBodyRaw')).toBe(true);
  });

  it('0x00-0xFB aralığı yanıt yönünde DTO verisidir', () => {
    const { summary, warnings } = decode([0x05, 0x11], 'response');
    expect(summary.kind).toBe('daq-data');
    expect(warnings.some((w) => w.code === 'protocol.xcp.warning.daqData')).toBe(true);
  });
});

describe('decodeXcpPacket — sınır durumları', () => {
  it('boş paket truncated-frame hatası verir', () => {
    const { errors, summary } = decode([], 'command');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.code).toBe('truncated-frame');
    expect(summary.consumedBytes).toBe(0);
  });
});

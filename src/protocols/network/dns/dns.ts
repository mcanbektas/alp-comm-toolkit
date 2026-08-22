/**
 * DNS (RFC 1035) — kaynak tel biçimi motoru `dnsWire.ts`tedir, bu dosya
 * yalnız kimlik/dokümantasyon ve örnek çerçeveleri taşır. Girdi TEK bir DNS
 * mesajıdır (UDP/TCP sarmalayıcısı YOK — `icmp.ts`teki karar 1'in aynısı,
 * motorlar zincir KURMAZ).
 */

import { buildDnsMessage, encodeDomainName, parseDnsMessage, readDnsWireContextOptions } from './dnsWire';
import type { ParseContext, ParseResult, ProtocolParser, ProtocolPlugin } from '@/protocol-core/types';
import type { ExampleFrame } from '@/protocol-core/types';

const PROTOCOL_ID = 'dns';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'DNS';

const MIN_MESSAGE_LENGTH = 12;

export function parseDns(data: Uint8Array): ParseResult {
  return parseDnsMessage(data, { protocolId: PROTOCOL_ID, variant: 'dns' });
}

export const dnsParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  canParse(data: Uint8Array): boolean {
    return data.length >= MIN_MESSAGE_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseDnsMessage(data, readDnsWireContextOptions(PROTOCOL_ID, 'dns', context));
  },
};

const TYPE_A = 1;
const TYPE_CNAME = 5;
const CLASS_IN = 1;

const QUESTION_NAME_OFFSET = 12;

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'simple-query',
    name: 'protocol.dns.example.simpleQuery.name',
    bytes: buildDnsMessage({
      id: 0x1234,
      flags: 0x0100, // QR=0, RD=1
      questions: [{ name: { labels: ['example', 'com'] }, type: TYPE_A, class: CLASS_IN }],
    }),
    description: 'protocol.dns.example.simpleQuery.description',
    expectedValid: true,
  },
  {
    id: 'response-with-answer',
    name: 'protocol.dns.example.responseWithAnswer.name',
    // Spec'in kendi örneği: Flags 0x8180 → QR=1,Opcode=0,AA=0,TC=0,RD=1,RA=1,RCODE=0
    // (08-ag-ethernet.md:141); Answer NAME'i soru adını 0xC00C pointer'ıyla
    // sıkıştırır (spec:306'nın birebir örneği).
    bytes: buildDnsMessage({
      id: 0x1234,
      flags: 0x8180,
      questions: [{ name: { labels: ['example', 'com'] }, type: TYPE_A, class: CLASS_IN }],
      answers: [
        {
          name: { pointerTo: QUESTION_NAME_OFFSET },
          type: TYPE_A,
          class: CLASS_IN,
          ttl: 300,
          rdata: [93, 184, 216, 34],
        },
      ],
    }),
    description: 'protocol.dns.example.responseWithAnswer.description',
    expectedValid: true,
  },
  {
    id: 'cname-chain',
    name: 'protocol.dns.example.cnameChain.name',
    bytes: buildDnsMessage({
      id: 0x0002,
      flags: 0x8180,
      questions: [{ name: { labels: ['www', 'example', 'com'] }, type: TYPE_A, class: CLASS_IN }],
      answers: [
        {
          name: { pointerTo: QUESTION_NAME_OFFSET },
          type: TYPE_CNAME,
          class: CLASS_IN,
          ttl: 60,
          rdata: encodeDomainName(['example', 'com']),
        },
      ],
    }),
    description: 'protocol.dns.example.cnameChain.description',
    expectedValid: true,
  },
  {
    id: 'nxdomain',
    name: 'protocol.dns.example.nxdomain.name',
    bytes: buildDnsMessage({
      id: 0x0003,
      flags: 0x8183, // RCODE=3 NXDOMAIN
      questions: [{ name: { labels: ['nope', 'example'] }, type: TYPE_A, class: CLASS_IN }],
    }),
    description: 'protocol.dns.example.nxdomain.description',
    expectedValid: true,
  },
  {
    id: 'name-loop',
    name: 'protocol.dns.example.nameLoop.name',
    // Soru adı kendi kendini gösteren bir pointer (offset 12 → offset 12) —
    // spec'in "A→B→A parser'ı kilitlememeli" uyarısının en dar örneği (spec:306).
    bytes: Uint8Array.from([
      0x00,
      0x04,
      0x01,
      0x00,
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0xc0,
      0x0c,
    ]),
    description: 'protocol.dns.example.nameLoop.description',
    expectedValid: false,
  },
];

export const dnsPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'network-ethernet',
  parser: dnsParser,
  documentation: {
    summary: 'protocol.dns.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};

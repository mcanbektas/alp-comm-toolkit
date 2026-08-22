/**
 * mDNS (RFC 6762) — "DNS message structure ile UDP multicast üzerinden
 * çalışır" (spec 08-ag-ethernet.md:715): tel biçimi `dns.ts` ile BİREBİR
 * AYNI motoru (`dnsWire.ts`) kullanır, TEK FARK CLASS alanının üst bitinin
 * yorumu (dosya başı `dnsWire.ts`). Girdi TEK bir mDNS mesajıdır (UDP
 * sarmalayıcısı YOK — motorlar zincir KURMAZ).
 *
 * ── mDNS ≠ DNS-SD ────────────────────────────────────────────────────────
 * Katalog kaydının kendi notu (`network-ethernet.ts`): mDNS multicast isim
 * çözümüdür; DNS-SD (`_service._tcp.local` gibi) DNS kayıtlarını kullanarak
 * servis keşfi yapar ve mDNS'in ÜSTÜNDE durur — bu motor mDNS'i çözer,
 * DNS-SD servis kaydı YORUMU yapmaz (TXT/PTR/SRV alan alana çözülür, ama
 * "bu bir DNS-SD servis kaydı" sınıflandırması YOK).
 */

import { buildDnsMessage, parseDnsMessage, readDnsWireContextOptions } from './dnsWire';
import type { ParseContext, ParseResult, ProtocolParser, ProtocolPlugin } from '@/protocol-core/types';
import type { ExampleFrame } from '@/protocol-core/types';

const PROTOCOL_ID = 'mdns';
/** Protokol adı veridir, çeviriye girmez (CLAUDE.md). */
const PROTOCOL_DISPLAY_NAME = 'mDNS';

const MIN_MESSAGE_LENGTH = 12;

export function parseMdns(data: Uint8Array): ParseResult {
  return parseDnsMessage(data, { protocolId: PROTOCOL_ID, variant: 'mdns' });
}

export const mdnsParser: ProtocolParser = {
  protocolId: PROTOCOL_ID,
  displayName: PROTOCOL_DISPLAY_NAME,

  canParse(data: Uint8Array): boolean {
    return data.length >= MIN_MESSAGE_LENGTH;
  },

  parse(data: Uint8Array, context?: ParseContext): ParseResult {
    return parseDnsMessage(data, readDnsWireContextOptions(PROTOCOL_ID, 'mdns', context));
  },
};

const TYPE_A = 1;
const CLASS_IN = 1;
/** RFC 6762 — QU/cache-flush üst biti set edilmiş CLASS. */
const CLASS_IN_TOP_BIT = 0x8001;

const QUESTION_NAME_OFFSET = 12;

const EXAMPLE_FRAMES: ExampleFrame[] = [
  {
    id: 'query-local',
    name: 'protocol.mdns.example.queryLocal.name',
    // Spec'in "Query device.local Type A" örneği (spec:718).
    bytes: buildDnsMessage({
      id: 0x0000, // mDNS sorularında transaction ID kullanılmaz, RFC 6762 §18.1 gereği 0.
      flags: 0x0000, // mDNS sorusu QR=0, Opcode/AA/RD/RA hepsi 0 (RFC 6762 §18).
      questions: [{ name: { labels: ['device', 'local'] }, type: TYPE_A, class: CLASS_IN }],
    }),
    description: 'protocol.mdns.example.queryLocal.description',
    expectedValid: true,
  },
  {
    id: 'unicast-response-requested',
    name: 'protocol.mdns.example.unicastResponseRequested.name',
    // QCLASS'ın üst biti "QU" (unicast-response tercihi, RFC 6762 §5.4).
    bytes: buildDnsMessage({
      id: 0x0000,
      flags: 0x0000,
      questions: [{ name: { labels: ['device', 'local'] }, type: TYPE_A, class: CLASS_IN_TOP_BIT }],
    }),
    description: 'protocol.mdns.example.unicastResponseRequested.description',
    expectedValid: true,
  },
  {
    id: 'response-cache-flush',
    name: 'protocol.mdns.example.responseCacheFlush.name',
    // Yanıtta CLASS'ın üst biti "cache flush" (RFC 6762 §10.2).
    bytes: buildDnsMessage({
      id: 0x0000,
      flags: 0x8400, // QR=1, AA=1 — mDNS yanıtları yetkilidir (RFC 6762 §18.4).
      answers: [
        {
          name: { labels: ['device', 'local'] },
          type: TYPE_A,
          class: CLASS_IN_TOP_BIT,
          ttl: 120,
          rdata: [192, 168, 1, 50],
        },
      ],
    }),
    description: 'protocol.mdns.example.responseCacheFlush.description',
    expectedValid: true,
  },
  {
    id: 'query-with-answer-compressed',
    name: 'protocol.mdns.example.queryWithAnswerCompressed.name',
    bytes: buildDnsMessage({
      id: 0x0000,
      flags: 0x8400,
      questions: [{ name: { labels: ['device', 'local'] }, type: TYPE_A, class: CLASS_IN }],
      answers: [
        {
          name: { pointerTo: QUESTION_NAME_OFFSET },
          type: TYPE_A,
          class: CLASS_IN_TOP_BIT,
          ttl: 120,
          rdata: [192, 168, 1, 50],
        },
      ],
    }),
    description: 'protocol.mdns.example.queryWithAnswerCompressed.description',
    expectedValid: true,
  },
];

export const mdnsPlugin: ProtocolPlugin = {
  id: PROTOCOL_ID,
  name: PROTOCOL_DISPLAY_NAME,
  category: 'network-ethernet',
  parser: mdnsParser,
  documentation: {
    summary: 'protocol.mdns.documentation.summary',
    layer: 'application',
  },
  exampleFrames: EXAMPLE_FRAMES,
};

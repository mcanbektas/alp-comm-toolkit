import type { CatalogDomain } from '../types';

/**
 * Domain 7 — Network & Ethernet: 8 aile / 28 protokol.
 *
 * Bu domain'in ayırt edici kısıtı: protokollerin hiçbiri tarayıcıdan doğrudan
 * *yakalanamaz*. Web Serial/USB/BLE bir NIC'i promiscuous moda alamaz, dolayısıyla
 * varsayılan çalışma biçimi PCAP/HEX içe aktarımı üzerinden `decode`'dur.
 * `live` sekmesi yalnız tarayıcının kendi soketiyle ya da bir köprüyle
 * konuşabildiği uygulama protokollerine verilir (WebSocket, MQTT, CoAP).
 *
 * Alan sözlüğü kaynağı: ozet/08-ag-ethernet.md; ağaç doğrulayıcısı:
 * ozet/11-domain-taksonomisi.md §7.
 */
export const networkEthernetDomain: CatalogDomain = {
  id: 'network-ethernet',
  name: 'Network & Ethernet',
  summary:
    'Ethernet frames, IP datagrams, TCP byte streams and the application protocols above them, analysed layer by layer from a capture.',
  highlights: ['Ethernet II', 'IPv4', 'TCP', 'HTTP', 'MQTT', 'PTP'],
  families: [
    {
      id: 'data-link',
      name: 'Data Link',
      summary:
        'MAC-level framing, VLAN tagging and link-local discovery — the outermost layer of every capture.',
      protocols: [
        {
          // Taksonomi Ethernet II ile 802.3'ü tek "birleşik detay" altında anlatır;
          // katalogda iki yaprak tutuyoruz çünkü fark tek bir alanın YORUMUNDA:
          // MAC'lerden sonraki 2 byte Ethernet II'de EtherType, 802.3'te Length.
          id: 'ethernet-ii',
          name: 'Ethernet II',
          summary:
            'The dominant MAC frame format on wired LANs, where the two bytes after the addresses carry an EtherType that selects the upper-layer parser.',
          layer: 'data-link',
          status: 'ready',
          pluginId: 'ethernet-ii',
          tabs: ['overview', 'decode', 'build', 'timing', 'diagnostics', 'examples'],
          tools: [
            'Frame Decoder',
            'MAC Addresses (Hex / Text / Binary)',
            'EtherType Resolver',
            'Frame Length',
            'FCS Check',
            'Broadcast / Multicast / Unicast Classification',
            'Frame Statistics',
            'Throughput',
            'MAC vs Wire Efficiency',
          ],
          related: [
            'network-ethernet/data-link/ieee-802-3',
            'network-ethernet/data-link/vlan-802-1q',
          ],
        },
        {
          id: 'ieee-802-3',
          name: 'IEEE 802.3',
          summary:
            'The base Ethernet standard family (MAC plus many PHY classes) whose classic frame reads the same two bytes as a payload Length and continues into an LLC/SNAP header.',
          layer: 'data-link',
          status: 'ready',
          pluginId: 'ieee-802-3',
          tabs: ['overview', 'decode', 'build', 'diagnostics', 'examples'],
          tools: [
            'Length vs EtherType Interpretation',
            'LLC / SNAP Chain Decoder',
            'MAC Header Decoder',
            'Frame Length',
            'FCS Check',
            'PHY Class Reference',
          ],
          related: ['network-ethernet/data-link/ethernet-ii'],
        },
        {
          id: 'vlan-802-1q',
          name: 'VLAN 802.1Q',
          summary:
            'A four-byte tag inserted after the MAC addresses that carries priority and VLAN identity, used to segment switched industrial and office networks.',
          layer: 'data-link',
          status: 'ready',
          pluginId: 'vlan-802-1q',
          tabs: ['overview', 'decode', 'build', 'diagnostics', 'examples'],
          tools: [
            'Tag Decoder',
            'TPID / TCI Fields',
            'PCP Priority',
            'DEI Flag',
            'VLAN ID Mapping',
            'Tagged / Untagged Ratio',
            'Stacked VLAN Chain',
            'Unexpected VLAN Warning',
          ],
          related: ['network-ethernet/data-link/ethernet-ii'],
        },
        {
          id: 'arp',
          name: 'ARP',
          summary:
            'The broadcast request/reply exchange that resolves an IPv4 address to a MAC address on the local link.',
          layer: 'data-link',
          status: 'ready',
          pluginId: 'arp',
          tabs: ['overview', 'decode', 'build', 'data', 'diagnostics', 'examples'],
          tools: [
            'Request / Reply Decoder',
            'Operation Semantics',
            'Hardware / Protocol Address Fields',
            'IP-to-MAC Table',
            'Conflict Detector',
          ],
          // Discovery Protocol Dashboard bu dördünü tek ekranda birleştirir (08 §Discovery).
          related: [
            'network-ethernet/addressing-discovery/dhcp',
            'network-ethernet/data-link/lldp',
          ],
        },
        {
          id: 'lldp',
          name: 'LLDP',
          summary:
            'A periodic TLV advertisement by which adjacent switches, PLCs and cameras announce their identity, enabling topology discovery from a capture.',
          layer: 'data-link',
          status: 'ready',
          pluginId: 'lldp',
          tabs: [
            'overview',
            'decode',
            'build',
            'data',
            'diagnostics',
            'definitions',
            'examples',
          ],
          tools: [
            'TLV Decoder',
            'Chassis ID',
            'Port ID',
            'TTL / Neighbor Age',
            'System Name',
            'System Description',
            'System Capabilities',
            'Management Address',
            'Neighbor Table',
            'Topology Builder',
            'Organizationally Specific TLV Lookup',
          ],
          // Organizationally Specific TLV'ler OUI+subtype ile dış veritabanından çözülür.
          definitions: ['vendor-map'],
          related: ['network-ethernet/data-link/arp'],
        },
      ],
    },
    {
      id: 'internet-layer',
      name: 'Internet Layer',
      summary:
        'Addressing, routing and control messaging for both IP versions, including the two very different fragmentation models.',
      protocols: [
        {
          id: 'ipv4',
          name: 'IPv4',
          summary:
            'The connectionless network-layer datagram protocol that defines addressing and fragmentation while explicitly leaving reliability to upper layers.',
          layer: 'network',
          status: 'ready',
          pluginId: 'ipv4',
          tabs: ['overview', 'decode', 'build', 'diagnostics', 'examples'],
          tools: [
            'Header Decoder',
            'Address View',
            'TTL / Hop Analysis',
            'Protocol Field Resolver',
            'Header Checksum Check',
            'DSCP / ECN',
            'Fragmentation Analysis',
            'Fragment Reassembly View',
          ],
          related: [
            'network-ethernet/internet-layer/ipv6',
            'network-ethernet/internet-layer/icmp',
          ],
        },
        {
          id: 'ipv6',
          name: 'IPv6',
          summary:
            'The 128-bit successor to IPv4 with a fixed 40-byte base header, an extension-header chain and source-only fragmentation.',
          layer: 'network',
          status: 'ready',
          pluginId: 'ipv6',
          tabs: ['overview', 'decode', 'build', 'diagnostics', 'examples'],
          tools: [
            'Header Decoder',
            'Address Formatter (Full / Compressed / Prefix)',
            'Flow Label',
            'Next Header Chain',
            'Hop Limit',
            'Extension Header Decoder',
            'Fragment Header',
            'Fragment Reassembly View',
          ],
          related: [
            'network-ethernet/internet-layer/ipv4',
            'network-ethernet/internet-layer/icmpv6',
          ],
        },
        {
          id: 'icmp',
          name: 'ICMP',
          summary:
            'The IPv4 control and error-reporting protocol behind ping and traceroute, carrying echo, unreachable and time-exceeded messages.',
          layer: 'network',
          status: 'ready',
          pluginId: 'icmp',
          tabs: ['overview', 'decode', 'build', 'timing', 'diagnostics', 'examples'],
          tools: [
            'Type / Code Decoder',
            'Echo Request / Reply Matching',
            'RTT',
            'Destination Unreachable',
            'Time Exceeded / Hop Analysis',
            'Original Datagram Correlation',
            'Checksum Check',
          ],
          related: [
            'network-ethernet/internet-layer/ipv4',
            'network-ethernet/internet-layer/icmpv6',
          ],
        },
        {
          // Kaynakta ICMPv6'ya ayrı bölüm var ama araç seti IPv6 + ICMP'den türetiliyor.
          // Tuzak: Neighbor Discovery "IPv6 için ARP" diye sadeleştirilmemeli — kapsamı
          // Router Solicitation/Advertisement ve Redirect'i de içerir.
          id: 'icmpv6',
          name: 'ICMPv6',
          summary:
            'The IPv6 control protocol (Next Header 58) that adds Packet Too Big for Path MTU Discovery and carries the Neighbor Discovery message family.',
          layer: 'network',
          status: 'ready',
          pluginId: 'icmpv6',
          tabs: ['overview', 'decode', 'build', 'timing', 'diagnostics', 'examples'],
          tools: [
            'Type / Code Decoder',
            'Echo Request / Reply Matching',
            'Packet Too Big / Reported MTU',
            'Path MTU Discovery View',
            'Neighbor Discovery Message Family',
            'Parameter Problem',
            'Checksum Check',
          ],
          related: [
            'network-ethernet/internet-layer/ipv6',
            'network-ethernet/internet-layer/icmp',
          ],
        },
      ],
    },
    {
      id: 'transport',
      name: 'Transport',
      summary:
        'Datagram versus byte-stream transport — the distinction that decides how every application parser above is fed.',
      protocols: [
        {
          id: 'udp',
          name: 'UDP',
          summary:
            'A minimal eight-byte connectionless transport that preserves application datagram boundaries and offers no ordering or retransmission.',
          layer: 'transport',
          status: 'ready',
          pluginId: 'udp',
          tabs: ['overview', 'decode', 'build', 'timing', 'diagnostics', 'examples'],
          tools: [
            'Header Decoder',
            'Port Resolver',
            'Length Check',
            'Checksum Check (Pseudo-Header)',
            'Checksum Offload Artifact Hint',
            'Datagram Viewer',
            'Conversation Statistics',
            'Jitter',
          ],
          related: ['network-ethernet/transport/tcp'],
        },
        {
          // Değişmez: TCP paket değil BYTE STREAM verir. Üstteki MQTT/HTTP/Modbus TCP
          // parser'ları ham packet payload'ı değil, retransmission ve gap temizlenmiş
          // reassembled stream'i tüketmek zorunda — aksi halde mesaj sınırları kayar.
          id: 'tcp',
          name: 'TCP',
          summary:
            'The connection-oriented, reliable, ordered byte-stream transport whose reassembled stream — not its individual segments — is what application parsers must consume.',
          layer: 'transport',
          status: 'ready',
          pluginId: 'tcp',
          tabs: ['overview', 'decode', 'build', 'timing', 'diagnostics', 'examples'],
          tools: [
            'Header Decoder',
            'Flag Panel',
            'Three-Way Handshake Check',
            'Sequence Tracking',
            'ACK Tracking',
            'Receive Window / Zero Window',
            'Options Decoder',
            'Retransmission Classification',
            'Out-of-Order Detection',
            'RTT Statistics',
            'Stream Reassembly',
            'Connection State Machine View',
            'Close / Reset Analysis',
          ],
          related: ['network-ethernet/transport/udp'],
        },
      ],
    },
    {
      id: 'addressing-discovery',
      name: 'Addressing & Discovery',
      summary:
        'How a device obtains an address and finds names and services, from DHCP lease negotiation to link-local mDNS.',
      protocols: [
        {
          id: 'dhcp',
          name: 'DHCP',
          summary:
            'The client/server exchange that leases an IP address and network configuration options to a booting host via the DORA flow.',
          layer: 'application',
          status: 'planned',
          tabs: ['overview', 'decode', 'build', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'DORA Flow Tracker',
            'BOOTP Field Decoder',
            'Transaction ID Matching',
            'Address Fields (ciaddr / yiaddr / siaddr / giaddr)',
            'Option Tree',
            'Lease Timeline',
            'Multiple DHCP Server Detection',
          ],
          related: [
            'network-ethernet/data-link/arp',
            'network-ethernet/addressing-discovery/dns',
          ],
        },
        {
          id: 'dns',
          name: 'DNS',
          summary:
            'The unicast resolver query/response protocol whose header, question and resource-record layout is reused by several link-local variants.',
          layer: 'application',
          status: 'planned',
          tabs: ['overview', 'decode', 'build', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Header / Flags Decoder',
            'Question Decoder',
            'Resource Record Viewer',
            'A / AAAA / CNAME / PTR / TXT / SRV Types',
            'Name Compression Resolver',
            'Transaction Matching',
            'Response Time',
            'Response Code Analysis',
            'TTL / Cache Simulation',
          ],
          related: ['network-ethernet/addressing-discovery/mdns'],
        },
        {
          // Tuzak: mDNS ≠ DNS-SD. mDNS multicast isim çözümüdür; DNS-SD ise DNS
          // kayıtları üzerinden servis keşfidir ve mDNS'in üstünde durur.
          id: 'mdns',
          name: 'mDNS',
          summary:
            'DNS-shaped name resolution over UDP multicast on port 5353 within the .local namespace, used by printers, cameras and IoT devices without any DNS server.',
          layer: 'application',
          status: 'planned',
          tabs: ['overview', 'decode', 'build', 'data', 'diagnostics', 'examples'],
          tools: [
            'Query / Response Decoder',
            '.local Namespace View',
            'Probing State Machine',
            'Announcement Tracker',
            'Name Conflict Detector',
            'Resource Record Viewer',
            'Local Service Browser',
          ],
          related: ['network-ethernet/addressing-discovery/dns'],
        },
      ],
    },
    {
      id: 'time-management',
      name: 'Time & Management',
      summary:
        'Clock synchronisation and device management traffic — where delay symmetry assumptions and MIB metadata decide the answer.',
      protocols: [
        {
          // Tuzak: küçük stratum "daha doğru saat" demek değildir; ayrıca delay/offset
          // hesabı yol simetrisi varsayar ve asimetrik ağlarda yanılır.
          id: 'ntp',
          name: 'NTP',
          summary:
            'The four-timestamp client/server time protocol that derives round-trip delay and clock offset from a single request/response pair.',
          layer: 'application',
          status: 'planned',
          tabs: ['overview', 'decode', 'build', 'timing', 'diagnostics', 'examples'],
          tools: [
            'Packet Decoder',
            'LI / VN / Mode Fields',
            'Stratum View',
            'Four-Timestamp Model (T1 / T2 / T3 / T4)',
            'Round Trip Delay',
            'Clock Offset',
            'Clock Drift Trend',
          ],
          related: ['network-ethernet/time-management/ptp'],
        },
        {
          id: 'ptp',
          name: 'PTP',
          summary:
            'IEEE 1588 hardware-assisted synchronisation reaching sub-microsecond accuracy in well-designed networks, used for motion control, power and audio-video bridging.',
          layer: 'application',
          status: 'planned',
          tabs: ['overview', 'decode', 'build', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Message Type Decoder',
            'Clock Types (Grandmaster / Ordinary / Boundary / Transparent)',
            'Sync / Follow_Up / Delay_Req / Delay_Resp Flow',
            'One-Step vs Two-Step Detection',
            'Announce & BMCA Explainer',
            'Mean Path Delay',
            'Offset From Master',
            'Correction Field',
            'Sequence Gap Detection',
          ],
          related: ['network-ethernet/time-management/ntp'],
        },
        {
          id: 'snmp',
          name: 'SNMP',
          summary:
            'The BER-encoded management protocol that reads and writes named object values on switches, UPSs and industrial gateways over GET, SET and TRAP operations.',
          layer: 'application',
          status: 'planned',
          tabs: [
            'overview',
            'decode',
            'build',
            'timing',
            'data',
            'diagnostics',
            'definitions',
            'examples',
          ],
          tools: [
            'SNMPv1 / v2c / v3 Decoder',
            'ASN.1 / BER TLV Tree',
            'PDU Fields',
            'OID Resolver',
            'VarBind Viewer',
            'GET / GET-NEXT / GET-BULK / SET / RESPONSE / TRAP / INFORM / REPORT',
            'MIB Import',
            'SNMPv3 Security View',
          ],
          // MIB, listedeki hazır biçimlerin hiçbiri değil; OID/Name/Syntax/Access
          // metadata'sı toolkit'in kendi şemasına aktarılır.
          definitions: ['custom-schema'],
        },
        {
          id: 'syslog',
          name: 'Syslog',
          summary:
            'The transport-independent event message format whose PRI byte packs facility and severity, used to collect device logs across a plant network.',
          layer: 'application',
          status: 'planned',
          tabs: ['overview', 'decode', 'build', 'data', 'diagnostics', 'examples'],
          tools: [
            'Message Decoder',
            'PRI Facility / Severity Split',
            'Timestamp / Hostname / App-Name / ProcID',
            'Structured Data Tree',
            'Severity Dashboard',
            'Log Statistics',
          ],
        },
      ],
    },
    {
      id: 'web-messaging',
      name: 'Web & Messaging',
      summary:
        'Request/response and publish/subscribe application protocols, the only ones here a browser or bridge can also drive live.',
      protocols: [
        {
          id: 'http',
          name: 'HTTP',
          summary:
            'The text-framed request/response protocol of the web and of most device REST APIs, framed either by Content-Length or by chunked transfer encoding.',
          layer: 'application',
          status: 'planned',
          tabs: ['overview', 'decode', 'build', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Request Viewer',
            'Response Viewer',
            'Method Database',
            'Header Decoder',
            'Status Code Reference',
            'Body Framing (Content-Length / Transfer-Encoding)',
            'Chunked Transfer Reassembly',
            'JSON Viewer (Raw / Pretty / Tree)',
            'Content Viewer',
            'Transaction Matching',
            'Transaction Timing',
          ],
          related: ['network-ethernet/web-messaging/websocket'],
        },
        {
          id: 'websocket',
          name: 'WebSocket',
          summary:
            'A bidirectional frame-based channel opened by an HTTP upgrade handshake, giving dashboards and gateways a persistent socket to a device.',
          layer: 'application',
          status: 'planned',
          tabs: ['overview', 'live', 'decode', 'build', 'data', 'diagnostics', 'examples'],
          tools: [
            'Upgrade Handshake Validator',
            'Sec-WebSocket-Accept Check',
            'Frame Decoder',
            'Opcode Reference',
            'Masking / Unmask View',
            'Fragmentation Reassembly',
            'Ping / Pong Tracking',
            'Close Frame Analysis',
          ],
          related: ['network-ethernet/web-messaging/http'],
        },
        {
          // MQTT'nin KANONİK kaydı burasıdır; wireless-iot/iot-messaging/mqtt
          // bu yola `aliasOf` ile bağlanır. Bu kayda aliasOf yazılmaz.
          id: 'mqtt',
          name: 'MQTT',
          summary:
            'The broker-mediated publish/subscribe protocol of industrial IoT, with three QoS levels, retained messages and a last-will notification on abnormal disconnect.',
          layer: 'application',
          status: 'ready',
          pluginId: 'mqtt',
          tabs: ['overview', 'live', 'decode', 'build', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Control Packet Decoder',
            'Fixed Header / Remaining Length',
            'CONNECT / CONNACK Analyzer',
            'Topic Tree',
            'Wildcard Subscription Semantics',
            'QoS 0 / QoS 1 / QoS 2 Transaction Tracking',
            'Retained Message View',
            'Last Will Correlation',
            'Keep Alive Monitor',
            'MQTT v5 Property Tree',
            'Session Analyzer',
          ],
          related: ['network-ethernet/web-messaging/mqtt-sn'],
        },
        {
          // Tuzak: MQTT-SN 1.2 resmi OASIS Standard DEĞİL, yalnız input specification.
          // Sürüm/profil metadata'sı bunu ayrıca belirtmeli.
          id: 'mqtt-sn',
          name: 'MQTT-SN',
          summary:
            'The MQTT-related messaging protocol for constrained sensor networks, replacing topic strings with numeric topic IDs and reaching the broker through a gateway.',
          layer: 'application',
          status: 'planned',
          tabs: ['overview', 'decode', 'build', 'data', 'diagnostics', 'examples'],
          tools: [
            'Message Decoder',
            'Gateway Discovery (ADVERTISE / SEARCHGW / GWINFO)',
            'Topic Registration (REGISTER / REGACK)',
            'Topic ID Mapping',
            'Publish / Subscribe Flow',
            'Sensor Session View',
            'Profile Metadata',
          ],
          related: ['network-ethernet/web-messaging/mqtt'],
        },
        {
          // CoAP'in KANONİK kaydı burasıdır; wireless-iot/iot-messaging/coap alias'tır.
          id: 'coap',
          name: 'CoAP',
          summary:
            'A REST-style web transfer protocol over UDP for constrained nodes, with its own four-message reliability model and compact binary options.',
          layer: 'application',
          status: 'ready',
          pluginId: 'coap',
          tabs: ['overview', 'live', 'decode', 'build', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Base Header Decoder',
            'Message Types (CON / NON / ACK / RST)',
            'Code Class.Detail Notation',
            'Token vs Message ID Correlation',
            'Option Delta / Length Decoder',
            'Payload Marker',
            'Resource Browser',
            'Observe Tracking',
            'Block Transfer Reassembly',
            'Retransmission / Timeout Analysis',
          ],
          related: ['network-ethernet/transport/udp'],
        },
      ],
    },
    {
      id: 'real-time-media',
      name: 'Real-Time Media',
      summary:
        'Media transport and its quality feedback channel, where sequence gaps and jitter matter more than byte-level integrity.',
      protocols: [
        {
          // Tuzak: RTP timestamp wall clock DEĞİL, payload clock domain'idir; mutlak
          // zamana ancak RTCP Sender Report'un NTP eşlemesiyle bağlanır.
          id: 'rtp',
          name: 'RTP',
          summary:
            'The UDP-borne transport for real-time audio, video and simulation data, providing payload-type identification, sequence numbering and media timestamps.',
          layer: 'application',
          status: 'planned',
          tabs: [
            'overview',
            'decode',
            'build',
            'timing',
            'data',
            'diagnostics',
            'definitions',
            'examples',
          ],
          tools: [
            'Header Decoder',
            'Sequence Number Gap Analysis',
            'Timestamp to Media Time Conversion',
            'SSRC Identity Mapping',
            'Payload Type Resolver',
            'Packet Loss',
            'Jitter Estimator',
            'Late / Out-of-Order Detection',
          ],
          // Dinamik payload type (96+) yalnız SDP / session profili verilirse
          // çözülebilir; profil yoksa codec TAHMİN EDİLMEZ.
          definitions: ['custom-schema'],
          related: [
            'network-ethernet/real-time-media/rtcp',
            'network-ethernet/transport/udp',
          ],
        },
        {
          id: 'rtcp',
          name: 'RTCP',
          summary:
            'The companion control channel that reports delivery quality for an RTP session and maps RTP timestamps onto absolute NTP time.',
          layer: 'application',
          status: 'planned',
          tabs: ['overview', 'decode', 'build', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Common Header Decoder',
            'Compound Packet Tree',
            'Sender Report',
            'Receiver Report',
            'Fraction Lost / Cumulative Lost',
            'Interarrival Jitter',
            'RTP to NTP Timestamp Mapping',
            'Reported RTT',
          ],
          related: ['network-ethernet/real-time-media/rtp'],
        },
      ],
    },
    {
      id: 'file-terminal',
      name: 'File & Terminal',
      summary:
        'Legacy but still ubiquitous transfer and console protocols found in firmware updates and embedded device maintenance.',
      protocols: [
        {
          id: 'tftp',
          name: 'TFTP',
          summary:
            'A lock-step file transfer over UDP where every data block is acknowledged individually, widely used for embedded firmware and boot images.',
          layer: 'application',
          status: 'planned',
          tabs: ['overview', 'decode', 'build', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Packet Decoder (RRQ / WRQ / DATA / ACK / ERROR)',
            'OACK Option Extension',
            'Block Transfer Timeline',
            'Block Size / Final Block Detection',
            'Retry Counter',
            'Session Summary',
            'Error Code Reference',
          ],
          related: ['network-ethernet/transport/udp'],
        },
        {
          id: 'ftp',
          name: 'FTP',
          summary:
            'A text-command file transfer protocol that separates a TCP control session from the data connection it negotiates in active or passive mode.',
          layer: 'application',
          status: 'planned',
          tabs: ['overview', 'decode', 'build', 'timing', 'data', 'diagnostics', 'examples'],
          tools: [
            'Control Session Viewer',
            'Command Parser',
            'Response Code Database',
            'Credential Redaction',
            'Active (PORT / EPRT) vs Passive (PASV / EPSV)',
            'Transfer Timeline',
            'Transaction Tree',
          ],
          related: ['network-ethernet/file-terminal/telnet'],
        },
        {
          id: 'telnet',
          name: 'Telnet',
          summary:
            'A byte-oriented terminal protocol that interleaves plaintext console traffic with IAC option negotiation on the same TCP stream.',
          layer: 'application',
          status: 'planned',
          tabs: ['overview', 'decode', 'build', 'data', 'diagnostics', 'examples'],
          tools: [
            'Text Stream Viewer',
            'IAC Command Decoder',
            'WILL / WONT / DO / DONT Negotiation',
            'Subnegotiation Decoder',
            'IAC Escaping / Byte Transparency',
            'Plaintext Security Warning',
          ],
          related: ['network-ethernet/file-terminal/ftp'],
        },
      ],
    },
  ],
};

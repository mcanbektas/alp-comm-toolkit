# 3.8 Ağ & Ethernet

## Ethernet II

En sık görülen Ethernet MAC frame yorumu. Frame: **Preamble(7B) + SFD(1B) + Dest MAC(6B) + Src MAC(6B) + EtherType(2B) + Payload + FCS(4B)**.

Mantıksal görünüm:

| DST MAC | SRC MAC | TYPE | PAYLOAD | FCS |
|---|---|---|---|---|
| 6 byte | 6 byte | 2 B | ... | 4 B |

Wire üzerinde ayrıca frame öncesinde 7-byte Preamble + 1-byte SFD bulunur.

IEEE 802.3-2022 güncel yayımlanmış temel Ethernet standardıdır; ortak MAC yapısı üzerinden 1 Mbit/s–400 Gbit/s arası çok sayıda PHY sınıfını kapsar. 2026 itibarıyla 802.3 çalışma grubu yeni PHY/hız amendment'larıyla geliştirmeye devam ediyor.

### MAC address
48 bit = 6 byte (örn. `00:11:22:33:44:55`). Toolkit aynı MAC'i **HEX** (`00 11 22 33 44 55`), **Text** (`00:11:22:33:44:55`) ve **Binary** (`00000000 00010001 ...`) olarak gösterebilmelidir.

### Destination türü
Destination MAC: **Unicast / Multicast / Broadcast** sınıflandırması. Broadcast = `FF:FF:FF:FF:FF:FF` → toolkit çıktısı: `Destination: Broadcast`.

### EtherType
Üst protokolü tanımlar: `0x0800`→IPv4, `0x0806`→ARP, `0x86DD`→IPv6, `0x8100`→802.1Q tagged frame. Toolkit `EtherType: 0x0800 → Protocol: IPv4` şeklinde recursive parser'a geçmelidir.

**Örnek çözüm:** `FF FF FF FF FF FF / 00 11 22 33 44 55 / 08 06 / ...` → Destination: Broadcast, Source: `00:11:22:33:44:55`, EtherType `0x0806` → Payload: ARP.

### Ethernet FCS
`FCS Present: YES / NO / Unknown` ayrımı gerekir — birçok NIC/OS capture sırasında FCS'i kaldırır. Capture'da görünmüyorsa **"FCS not captured"** demek, **"FCS missing"** demekten daha doğrudur. Mevcutsa: Received FCS vs Calculated CRC-32 → PASS/FAIL.

## Ethernet Frame Boyutu ve Throughput

```
L_total = L_header + L_payload + L_FCS
L_header (Ethernet II) = 14 byte
L_FCS = 4 byte
```
Minimum data alanı gerekirse padding ile büyütülür. Throughput hesabında yalnız application payload yeterli değildir; wire-time hesabına Preamble+SFD ve Inter-Frame Gap de dahil edilebilir. Analyzer iki ayrı verim gösterebilir: **MAC Efficiency** ve **Wire Efficiency** — böylece küçük UDP paketlerinin beklenenden fazla bant genişliği tükettiği görülür.

## IEEE 802.3

Yalnız bir frame biçimi değil; MAC + çok sayıda PHY standardını kapsayan geniş aile. Güncel temel: **IEEE 802.3-2022**. Ethernet II ile IEEE 802.3 arasındaki fark, MAC/SRC sonrası iki-byte alanın yorumudur: Ethernet II'de **EtherType**, 802.3'te **Length**. Toolkit `Value / Interpretation` ile gösterir:
- `0x0800` → Interpretation: EtherType IPv4
- `0x002E` → Interpretation: IEEE 802.3 Payload Length = 46 bytes

802.3 üstünde LLC/SNAP varsa parser zincirleme geçebilmelidir.

## Ethernet Frame Analyzer

Her frame: Frame #, Timestamp, Captured/Wire bytes, Destination, Source, VLAN, Upper Protocol, FCS durumu. Ek istatistik: Frames/s, Bytes/s, Average/Minimum/Maximum Frame Size, Broadcast/Multicast/Unicast %, FCS Errors.

## VLAN — IEEE 802.1Q

Güncel temel revizyon **IEEE 802.1Q-2022** (yeni maintenance revizyon çalışması sürüyor). VLAN tag normal header'a **4 byte** ekler: `Dest MAC / Src MAC / TPID / TCI / EtherType / Payload / FCS`.

TCI bit yapısı (16 bit):
```
15             13 12 11                 0
+----------------+--+--------------------+
|      PCP       |DEI|       VID          |
+----------------+--+--------------------+
     3 bit       1      12 bit
```

### PCP
Priority Code Point, 3 bit (0–7), trafik priority/class. Toolkit `PCP: 5 → Priority Class: Configured QoS mapping` gösterir; semantic ismi sabitlemek yerine switch/proje QoS mapping'i kullanılmalıdır.

### DEI
Drop Eligible Indicator, 1 bit (0/1); congestion durumunda traffic treatment için kullanılabilir.

### VLAN ID
12 bit VLAN identifier. Toolkit kullanıcı tanımlı VLAN veritabanıyla eşleştirir (örn. `VLAN ID:100 → Name: Automation`).

### Tagged / Untagged traffic
Port bazında Tagged/Untagged Frames oranı tutulur. Beklenen VLAN (örn. 20) ile gözlenen (örn. VLAN 30) uyuşmazsa: **UNEXPECTED VLAN** uyarısı.

### VLAN stacking
Parser tek tag varsaymamalı; stacked tag'ler recursive çözülmelidir: `Ethernet → Outer VLAN → Inner VLAN → IP`. Toolkit: `Tag#1 VID100 / Tag#2 VID20`.

## ARP — Address Resolution Protocol

RFC 826: IPv4 adresi ile local-network MAC adresi arasında mapping. Akış: Host A `192.168.1.10` → `192.168.1.20`'yi arar → **ARP Request** (broadcast `FF:FF:FF:FF:FF:FF`, "Who has 192.168.1.20?") → **ARP Reply** ("192.168.1.20 is at AA:BB:CC:DD:EE:FF").

### ARP frame yapısı
Alanlar: Hardware Type, Protocol Type, Hardware Length, Protocol Length, Operation, Sender Hardware Address, Sender Protocol Address, Target Hardware Address, Target Protocol Address. Operation: `1`=Request, `2`=Reply.

### ARP Request Decoder
Örnek: Sender MAC `00:11:22:33:44:55`, Sender IP `192.168.1.10`, Target MAC `00:00:00:00:00:00`, Target IP `192.168.1.20`, Operation REQUEST → semantic: "Who has 192.168.1.20? Tell 192.168.1.10".

### ARP table
Toolkit capture'dan geçici IP↔MAC tablosu oluşturur.

**Conflict detector:** Aynı IP iki farklı MAC'ten görülürse **IP ADDRESS CONFLICT** (MAC A / MAC B) uyarısı. Tek başına saldırı kanıtı değildir — static change, redundancy veya configuration değişikliği de olabilir.

## IPv4

RFC 791: connectionless datagram network-layer protokolü; addressing ve fragmentation'ı tanımlar, ama reliability/sequencing/retransmission/flow-control **sağlamadığını açıkça belirtir**.

Header alanları: Version, IHL, DSCP/ECN, Total Length, Identification, Flags, Fragment Offset, TTL, Protocol, Header Checksum, Source Address, Destination Address, Options, Payload.

### Version
4 bit, değer = 4 olmalı → Status: IPv4.

### IHL — Internet Header Length
4 bit, 32-bit word sayısı:
```
HeaderLength = IHL × 4 byte
```
IHL=5 → 20 byte; IHL=15 → maksimum 60 byte.

## IPv4 Total Length
Header + Payload toplamı. Örnek: Total Length 60, Header 20 → Payload = 60-20 = 40 byte.

## IPv4 TTL
RFC 791: datagram lifetime'ını sınırlayan mekanizma. Her forwarding hop'ta azaltılır (örn. 64→63). TTL sıfırlanınca paket drop edilir, ICMP Time Exceeded üretilebilir.

## IPv4 Protocol Field
`1`→ICMP, `6`→TCP, `17`→UDP (protocol-number veritabanı). Toolkit `Protocol:17 → Decoded: UDP` sonrası UDP parser'a geçer.

## IPv4 Header Checksum
Yalnız header için checksum. Received vs Calculated → PASS/FAIL. Router TTL'i değiştirdiğinde checksum uygun şekilde güncellenir.

## IPv4 Fragmentation
RFC 791: router/host seviyesinde fragmentation ve reassembly'i Identification, MF (More Fragments) ve Fragment Offset alanlarıyla tanımlar. Fragment Offset birimi 8-byte'tır:
```
Offset_bytes = FragmentOffset × 8
```
Örnek: Fragment Offset 185 → Offset = 1480 byte.

### Fragment Reassembly View
Örnek (Datagram ID `0x1234`): Frag1 offset0/MF1/1480B, Frag2 offset1480/MF1/1480B, Frag3 offset2960/MF0/200B → Reassembled: 3160 byte, Fragments: 3, Missing: 0.

**Error:** Missing Fragment, Overlap, Duplicate Fragment, Timeout — ayrı işaretlenmelidir.

## IPv6
RFC 8200: IPv4'ün devamı, 128-bit adres, sadeleştirilmiş sabit 40-byte base header: Version, Traffic Class, Flow Label, Payload Length, Next Header, Hop Limit, Source Address, Destination Address.

### IPv6 address
128 bit (örn. `2001:db8:1234:5678::10`). Toolkit Full / Compressed / Prefix / Host Portion / Address Type gösterir.

## IPv6 Header
Alanlar yukarıdaki gibi.

#### Flow Label
20-bit, traffic flow identification; toolkit flow-table'da ayrı kolon olarak sunulabilir.

## IPv6 Extension Headers
RFC 8200: Hop-by-Hop, Routing, Fragment, Destination Options gibi opsiyonel bilgiler base header yerine extension-header zincirinde taşınır. Decoder recursive chain gösterir: `IPv6 → Hop-by-Hop → Routing → Fragment → UDP`.

**Loop protection:** Malformed extension zinciri (geçersiz length) parser'ı sonsuz döngüye sokmamalıdır.

## IPv6 Fragmentation
IPv6'da router'lar normal forwarding sırasında **fragment yapmaz**; fragmentation gerekiyorsa **source node** Fragment extension header kullanır (RFC 8200). Fark açıkça gösterilmeli: **IPv4** = "Routers may fragment" vs **IPv6** = "Source performs fragmentation".

## IPv6 Header Checksum
Base header'da IPv4 tarzı checksum **yoktur** → `N/A` gösterilir. Integrity TCP/UDP/ICMPv6 gibi üst protokollere bırakılır.

## ICMP
RFC 792: IP'nin ayrılmaz parçası, control/error reporting. Genel format: Type, Code, Checksum, Message-Specific Data.

## ICMP Echo
Ping akışı: Echo Request (Type 8) → Echo Reply (Type 0) (RFC 792). Alanlar: Type, Code, Checksum, Identifier, Sequence Number, Data. Toolkit Identifier/Sequence eşleştirir, RTT hesaplar (örn. 4 ms).

## ICMP Destination Unreachable
Type 3 (RFC 792); Code alanı nedeni detaylandırır (net/host/protocol/port unreachable). Toolkit original datagram ile correlate eder (örn. UDP `192.168.1.20:55000→192.168.1.30:5000`, Code 3 = Port Unreachable).

## ICMP Time Exceeded
Type 11; traceroute'un temeli (RFC 792, TTL exceeded). Toolkit hop analizi üretebilir: Hop, Router, RTT.

## ICMPv6
IPv6 control/error protokolü, Next Header = 58 (RFC 4443). Format: Type, Code, Checksum, Message Body.

### ICMPv6 temel tipler
RFC 4443: `1` Destination Unreachable, `2` Packet Too Big, `3` Time Exceeded, `4` Parameter Problem, `128` Echo Request, `129` Echo Reply. Packet Too Big, Reported MTU (örn. 1280) taşır — Path MTU Discovery için önemlidir.

## ICMPv6 Neighbor Discovery İlişkisi
ND ayrı RFC'lerde tanımlı olsa da ICMPv6 mesaj ailesini kullanır: Neighbor Solicitation/Advertisement, Router Solicitation/Advertisement, Redirect (ileride ayrı decoder modülleri). **Dikkat:** bunlar birebir "ARP for IPv6" olarak basitleştirilmemeli — ND'nin kapsamı ARP'den geniştir.

## UDP — User Datagram Protocol
RFC 768: connectionless datagram transport; reliability/ordering/retransmission sağlamaz. Header (8 byte): Source Port, Destination Port, Length, Checksum.

### UDP header
```
0               15 16              31
+-----------------+------------------+
| Source Port     | Destination Port |
+-----------------+------------------+
| Length          | Checksum         |
+-----------------+------------------+
| Payload ...                        |
```

## UDP Length
RFC 768: Length = UDP header+data, minimum 8.
```
PayloadLength = UDPLength - 8
```
Örnek: UDP Length 108 → Payload = 100 byte.

## UDP checksum
Pseudo-header + UDP header + payload üzerinden one's-complement checksum (RFC 768). Checksum-offload yapan capture'larda outgoing checksum NIC tarafından henüz tamamlanmamış görünebilir → toolkit "Possible checksum offload artifact" seçeneği sunmalıdır; her bad checksum gerçek wire corruption değildir.

## UDP Conversation
UDP connection-oriented olmasa da 4-tuple (Src IP/Port, Dst IP/Port) bazında pseudo-conversation kurulur. İstatistik: Datagrams, Bytes, Datagrams/s, Bytes/s, Packet Loss (üst protokol sequence varsa), Jitter, Last Activity.

## UDP Datagram Özelliği
UDP **message-oriented** (application datagram boundary korunur), TCP **byte-stream**'dir — toolkit bu ayrımı açıkça göstermelidir.

## TCP — Transmission Control Protocol
Güncel consolidated spesifikasyon **RFC 9293** (RFC 793 + güncellemeler, Internet Standard). TCP: connection-oriented, reliable, ordered, bidirectional, byte-stream.

## TCP Header
Source Port, Destination Port, Sequence Number, Acknowledgment Number, Data Offset, Flags, Window, Checksum, Urgent Pointer, Options, Data. Minimum header 20 byte, Options ile daha uzun.

## TCP Flags
En az: SYN, ACK, FIN, RST, PSH, URG, ECE, CWR. Bit panel örneği: `SYN1 ACK0 FIN0 RST0` → semantic: "Connection establishment request".

## TCP Three-Way Handshake
```
Client                   Server
SYN Seq=X          ----->
                    <-----  SYN+ACK Seq=Y Ack=X+1
ACK Ack=Y+1         ----->
ESTABLISHED
```
Toolkit: Handshake PASS, Client ISN, Server ISN, Handshake Time (örn. 3.4 ms).

**Failed handshake:** ardışık SYN'ler cevapsız kalırsa → "TCP CONNECTION FAILED / No SYN/ACK".

## TCP Sequence Number
Uygulama verisi **byte sequence space** içinde takip edilir. Seq 1000 + Payload 500 byte → sonraki beklenen sequence:
```
1000 + 500 = 1500
```
SYN ve FIN de sequence space'te birer pozisyon tüketir.

## TCP ACK
`ACK=N` → "N'den önceki byte'lar alındı, sonraki beklenen byte N". Görselleştirme: Sender Seq 1000–1499 → Receiver ACK 1500.

## TCP Retransmission
RFC 9293: loss durumunda retransmission ile veri teslimi. Toolkit: aynı Seq/Len tekrar görülür, önceki ACK yoksa **Retransmission** işaretlenir. Sınıflandırma (algoritmik inference): Retransmission, Possible Fast Retransmission, Duplicate ACK, Out Of Order, Duplicate Segment.

## TCP Stream Reassembly
**Kritik** başlık: TCP paket değil, **byte stream** sağlar. Uygulama mesajı `AA BB CC DD EE FF` wire'da `[AA BB]/[CC DD EE]/[FF]` gibi bölünebilir; tersine, tek segment `[Message A][Message B][C'nin parçası]` içerebilir. Bu yüzden MQTT, HTTP, Modbus TCP vb. **Packet Payload** üzerinden değil **Reassembled TCP Stream** üzerinden parse edilmelidir.

Pipeline:
```
TCP Segments → Sequence Ordering → Retransmission Removal → Gap Detection → Byte Stream → Application Framer
```

## TCP Receive Window
Flow control receiver window üzerinden çalışır. Toolkit: Advertised Window, Window Scale, Effective Window, Zero Window, Window Update.

**Zero Window:** Window=0 → "RECEIVER BUFFER FULL / FLOW CONTROL PAUSE".

## TCP RTT
```
RTT = t_ACK - t_segment
```
(segment/ACK eşleştirilebiliyorsa). Toolkit: Minimum/Average/Maximum RTT, Smoothed estimate. Retransmitted paketlerden RTT örneklenirken ambiguity dikkate alınmalıdır.

## TCP Closing
Normal close: FIN/ACK/FIN/ACK (veya eşzamanlı varyasyon) → "CLOSED NORMALLY". RST → "Connection reset" — bu iki durum ayrılmalıdır.

## TCP State Machine View
RFC 9293 connection state machine'i tanımlar. UI zaman çizelgesi:
- Client: `CLOSED → SYN-SENT → ESTABLISHED → FIN-WAIT → TIME-WAIT → CLOSED`
- Server: `LISTEN → SYN-RECEIVED → ESTABLISHED → ...`

## DHCP
RFC 2131: host'lara IP ve network configuration parametreleri sağlayan client/server protokolü. Temel akış (**DORA**): `DHCPDISCOVER → DHCPOFFER → DHCPREQUEST → DHCPACK` (Discover/Offer/Request/Acknowledge).

## DHCP Packet
BOOTP message yapısı temel alınır. Alanlar: `op, htype, hlen, hops, xid, secs, flags, ciaddr, yiaddr, siaddr, giaddr, chaddr, sname, file, options`.

## Transaction ID
`XID` (örn. `0x12345678`) ile Discover/Offer aynı transaction altında eşleştirilir.

## DHCP Address Fields
`ciaddr`=Client IP, `yiaddr`=Your IP/offered adres, `siaddr`=Server-related adres, `giaddr`=Relay Agent Address.

## DHCP Options
Option ağacı örnekleri: `53` DHCP Message Type, `1` Subnet Mask, `3` Router, `6` DNS Servers, `51` Lease Time, `54` Server Identifier, `50` Requested IP Address. Tam IANA DHCP option registry ayrı güncellenebilir veri kaynağı olmalıdır.

## DHCP Lease Timeline
RFC 2131 lease modeli: Lease Start, Duration, Renewal, Rebinding, Expiration. State: `BOUND → RENEWING → REBINDING → EXPIRED`.

## Multiple DHCP Server Detection
Birden çok Offer (örn. Server A + Server B) tek başına hata değildir, sayım gösterilir. Allowlist dışı server → "Unknown DHCP Server" uyarısı.

## DNS — Domain Name System
RFC 1035: message structure, question ve resource-record formatları. Mesaj: Header, Question, Answer, Authority, Additional.

## DNS Header
12-byte: ID, Flags (QR, Opcode, AA, TC, RD, RA, Z/extended, RCODE), QDCOUNT, ANCOUNT, NSCOUNT, ARCOUNT. Örnek: Flags `0x8180` → `QR=1, Opcode=0, AA=0, TC=0, RD=1, RA=1, RCODE=0`.

## DNS Question
QNAME, QTYPE, QCLASS (örn. `sensor.local / A / IN`).

## DNS Resource Record
NAME, TYPE, CLASS, TTL, RDLENGTH, RDATA. Desteklenen tipler: A, AAAA, CNAME, PTR, MX, TXT, SRV, NS, SOA.

## DNS name compression
Domain suffix'leri pointer ile sıkıştırılabilir (örn. `0xC00C → example.com`). Malformed pointer loop (`A→B→A`) parser'ı kilitlememelidir.

## DNS transaction matching
Transaction ID + Source/Destination tuple + Question üzerinden correlate edilir. Örnek Response Time: 12.3 ms.

## DNS Response Code
`NOERROR, FORMERR, SERVFAIL, NXDOMAIN, NOTIMP, REFUSED`.

## DNS TTL / Cache
RR TTL (örn. 300 s) ile cache-age simülasyonu: Received 12:00:00 → Expires 12:05:00.

## NTP — Network Time Protocol
NTPv4, RFC 5905: protocol architecture, state machine, timing algoritmaları. Paket: LI/VN/Mode, Stratum, Poll, Precision, Root Delay, Root Dispersion, Reference ID, Reference/Origin/Receive/Transmit Timestamp.

### NTP İlk Byte
LI, VN, Mode bit field (örn. LI=0, Version=4, Mode=Server).

### NTP Stratum
Stratum 1 = reference-clock'a yakın kaynak; Stratum 2 = stratum-1'den zaman alan server. **Dikkat:** "daha küçük stratum = otomatik olarak daha doğru clock" şeklinde kesin yorum yapılmamalıdır.

## NTP Four-Timestamp Model
```
Client                          Server
T1  Request  ------------------>
                          T2 receive
                          T3 transmit
       Response <-----------------
T4
```
```
Network delay:  δ = (T4 - T1) - (T3 - T2)
Clock offset:   θ = [(T2 - T1) + (T3 - T4)] / 2
```
Toolkit: T1, T2, T3, T4, Round Trip Delay, Clock Offset gösterir.

## NTP Example
`T1=100.000ms, T2=110.000ms, T3=112.000ms, T4=124.000ms` →
```
Delay  = (124-100) - (112-110) = 22 ms
Offset = -1 ms
```
Model path symmetry varsayımından etkilenir.

## NTP Drift / Offset Trend
Zaman serisi offset tablosu (örn. 12:00 +1.2ms, 12:01 +1.5ms, 12:02 +1.9ms) → "Clock drifting" trendi.

## SNMP — Temel Paket Analizi
Network management framework'ü. SNMPv3 architecture (RFC 3411): engine, message processing, security, access-control subsystem'leri. Toolkit full NMS olmak zorunda değil, ama packet analysis güçlü olmalı. Destek: SNMPv1, SNMPv2c, SNMPv3.

## SNMP ASN.1 / BER
Mesajlar ASN.1'in BER kodlamasını kullanır. Toolkit TLV (Type/Length/Value) ağacı gösterir:
```
SEQUENCE
├─ INTEGER version
├─ OCTET STRING community
└─ PDU
```

## SNMPv2c conceptual packet
`Version, Community, PDU{Request ID, Error Status, Error Index, Variable Bindings}`.

## SNMP Operations
`GET, GET-NEXT, GET-BULK, SET, RESPONSE, TRAP, INFORM, REPORT`. Tüm operasyonlar tüm SNMP sürümlerinde aynı değildir — exact version support kontrol edilmeli.

## OID
Object Identifier (örn. `1.3.6.1.2.1...`). MIB veritabanı varsa: Raw OID → Name (örn. `sysUpTime`) → Value.

**MIB import:** OID, Name, Syntax, Access, Description, Enum, Unit metadata'sı parser'a verilir.

## VarBind
OID+Value çifti (örn. OID..., Type `Counter32`, Value `12345`).

## SNMPv3
Paket: `Version, Global Message Data, Security Parameters, Scoped PDU`. RFC 3411 security + access-control subsystem tanımlar. Toolkit: Security Model, Security Level, Engine ID, User, Authentication, Privacy. Anahtar bilinmiyorsa Encrypted ScopedPDU → "Encrypted / Unable to decode payload".

## HTTP — Temel Mesaj Görüntüleme
Semantics: RFC 9110 ailesi; HTTP/1.1 message syntax/parsing/connection management: RFC 9112 (Internet Standard). Toolkit önceliği: **HTTP/1.1 text-message viewer**; HTTP/2, HTTP/3 binary framing ayrı ileri modül.

## HTTP Request
Request Line, Headers, Blank Line, opsiyonel Body. Örnek `GET /api/status HTTP/1.1` + `Host: 192.168.1.20` → Method GET, Target `/api/status`, Version HTTP/1.1, Host `192.168.1.20`.

## HTTP Response
Status Line, Headers, Blank Line, Body. Örnek `HTTP/1.1 200 OK` + JSON body → Status `200 OK`, Content-Type `application/json`, Body JSON.

## HTTP Method
En az: GET, HEAD, POST, PUT, DELETE, OPTIONS, CONNECT, TRACE — registered ek methodlarla genişletilebilir veritabanı.

## HTTP Body Framing
RFC 9112: Content-Length vs Transfer-Encoding framing kuralları.

**Chunked example:** `4\r\nWiki\r\n5\r\npedia\r\n0\r\n\r\n` → Chunk1 4B, Chunk2 5B, Total Body 9B, Reassembled: `Wikipedia`.

## HTTP Transaction Matching
Aynı TCP bağlantısında Request1/Response1, Request2/Response2 eşleştirmesi; pipelining/çoklu bağlantı durumları flow bazında ayrılır.

## HTTP Content Viewer
Content-Type'a göre görüntüleme: `application/json, text/plain, text/html, application/xml, application/octet-stream`. JSON: Raw/Pretty/Tree. Binary: HEX/ASCII/Export.

## WebSocket
RFC 6455: opening handshake sonrası aynı bağlantı üzerinde iki yönlü frame-based iletişim. İki aşama: `HTTP Opening Handshake → WebSocket Frames`.

## WebSocket Handshake
Client: `GET /ws HTTP/1.1`, `Upgrade: websocket`, `Connection: Upgrade`, `Sec-WebSocket-Key`, `Sec-WebSocket-Version: 13`. Server: `HTTP/1.1 101 Switching Protocols`, `Upgrade: websocket`, `Connection: Upgrade`, `Sec-WebSocket-Accept`. Toolkit: Handshake VALID, Upgrade, Protocol, Extensions.

## Sec-WebSocket-Accept
RFC 6455: `Client Key → GUID ekle → SHA-1 → Base64 → Expected Accept`. Received vs Expected → PASS.

## WebSocket Frame
Alanlar: FIN, RSV1, RSV2, RSV3, Opcode, MASK, Payload Length, Extended Payload Length, Masking Key, Payload.
```
0                   1                   2
0 1 2 3 4 5 6 7 8 ...
+-+-+-+-+-+-+-+-+
|F|R|R|R| opcode |
+-+-+-+-+-+-+-+-+
|M| payload len  |
+-+-+-+-+-+-+-+-+
```

## WebSocket Opcode
`Continuation, Text, Binary, Close, Ping, Pong`.

## WebSocket Masking
RFC 6455: client→server frame'ler mask'lenir.
```
Decoded_i = Encoded_i ⊕ Mask_(i mod 4)
```
Toolkit: Masked YES, Mask Key, byte-level unmask görünümü.

## WebSocket Fragmentation
`Text Frame(FIN=0) → Continuation(FIN=0) → Continuation(FIN=1)` tek application message olarak reassemble edilir. Control frame'ler application fragmentation'dan ayrı işlenir.

## MQTT
Client/server publish-subscribe messaging protokolü. Güncel OASIS Standard **MQTT 5.0** (onay: 7 Mart 2019); **MQTT 3.1.1** uyumluluğu pratikte hâlâ önemli. TCP/IP veya ordered/lossless bidirectional transport üzerinde çalışır.
```
Publisher → Broker → Subscriber(s)
```

## MQTT Control Packet
`Fixed Header + Variable Header + Payload`. İlk byte: Packet Type + Flags; ardından Remaining Length (variable-byte encoding). Örnek: PUBLISH, DUP=0, QoS=1, RETAIN=0, Remaining Length.

## MQTT Packet Types
`CONNECT, CONNACK, PUBLISH, PUBACK, PUBREC, PUBREL, PUBCOMP, SUBSCRIBE, SUBACK, UNSUBSCRIBE, UNSUBACK, PINGREQ, PINGRESP, DISCONNECT, AUTH` (AUTH = MQTT v5).

## MQTT Connection
`CONNECT → CONNACK`. Toolkit: Client ID, Protocol Level, Clean Start, Keep Alive, Will Present, Username Present, Authentication, Properties.

## MQTT Topic
PUBLISH örneği: Topic `factory/line1/temperature`, Payload `25.4`; topic tree oluşturulabilir.

**Subscription:** wildcard'lar `factory/+/temperature` (tek seviye) ve `factory/#` (çoklu seviye) semantic gösterilir.

## MQTT QoS 0
At-most-once: `Publisher → PUBLISH → Broker`, ack yok (MQTT5 spesifikasyonu 3 QoS seviyesi tanımlar).

## MQTT QoS 1
At-least-once: `PUBLISH → PUBACK`. Toolkit: Packet ID, PUBLISH t0, PUBACK t1, Ack Latency (örn. 4.3 ms). Duplicate PUBLISH (`DUP=1`) ayrıca gösterilir.

## MQTT QoS 2
Exactly-once handshake: `PUBLISH → PUBREC → PUBREL → PUBCOMP`. Toolkit 4 paketi `QoS2 Transaction #N` altında gruplar.

## MQTT Retained Message
`RETAIN=1` → broker topic'in retained state'ini günceller. Toolkit: `Retained: YES`.

## MQTT Last Will
CONNECT içinde Will Topic, Will Payload, Will QoS, Will Retain gösterilir. Bağlantı anormal biter ve Will publish gözlenirse: `Unexpected Disconnect → Will Published` correlation.

## MQTT v5 Properties
`Reason Code, User Property, Session Expiry, Message Expiry, Response Topic, Correlation Data, Content Type, Topic Alias, Maximum Packet Size, Receive Maximum` vb. Toolkit properties'i TLV-benzeri tree olarak gösterir.

## MQTT Session Analyzer
`Connect → Subscribe → PUBLISH flow → Ping → Disconnect`. Metrik: Connection Duration, Messages, Publish Rate, Subscribe Count, QoS Distribution, Retransmissions, Keepalive State, Last Activity.

## MQTT-SN
Constrained sensor network'ler için MQTT ile ilişkili mesajlaşma protokolü. **Önemli:** MQTT-SN 1.2, OASIS MQTT-SN Subcommittee tarafından input specification olarak kabul edilmiştir; ancak OASIS sayfası bunun MQTT 5 gibi **resmen onaylanmış OASIS Standard olmadığını açıkça belirtir**. Toolkit `Profile: MQTT-SN 1.2` metadata'sını tutar.

## MQTT-SN Architecture
```
Sensor Client --MQTT-SN--> Gateway --MQTT--> Broker
```
Amaç: topic string'lerin ve TCP-oriented varsayımların constrained/non-TCP sensor network'ler üzerindeki maliyetini azaltmak.

## MQTT-SN Message
Conceptual: Length, Message Type, Message-Specific Fields; uzun paketlerde extended length representation profile'a göre desteklenir. Örnek PUBLISH: Topic ID `0x0012`, Message ID `42`, QoS 1, Payload.

## MQTT-SN Gateway Discovery
`ADVERTISE, SEARCHGW, GWINFO`. Toolkit: Gateway Discovered, Gateway ID, Address, Advertisement Duration → topology view.

## MQTT-SN Topic Registration
`REGISTER → REGACK`; numeric Topic ID mapping (örn. `room/temperature ↔ 0x0012`).

## CoAP — Constrained Application Protocol
RFC 7252: constrained node'lar ve low-power/lossy network'ler için web-transfer protokolü. Genellikle UDP üzerinde; REST-benzeri `GET/POST/PUT/DELETE`.

## CoAP Base Header
İlk 4 byte: Version, Type, Token Length, Code, Message ID; ardından Token, Options, `0xFF` Payload Marker, Payload.
```
0 1 2 3 4 5 6 7
+-+-+-+-+-+-+-+-+
|Ver| T |  TKL  |
+-+-+-+-+-+-+-+-+
|     Code      |
+-+-+-+-+-+-+-+-+
|  Message ID   |
+-+-+-+-+-+-+-+-+
```

## CoAP Message Types
`CON` (Confirmable), `NON` (Non-confirmable), `ACK` (Acknowledgement), `RST` (Reset) — RFC 7252 reliability modeli bu dört tip üzerinden kurulur.

## CoAP Confirmable Flow
`Client CON GET(MID100) → Server ACK(MID100)`. Response piggyback edilebilir veya ayrı mesaj olabilir. Toolkit Message ID, Token, Request, Response, Retransmission ilişkilerini takip eder.

## CoAP Code
`Class.Detail` notasyonu (örn. `0.01`=GET, `2.xx`=Success ailesi). Toolkit raw byte + semantic notation birlikte gösterir.

## CoAP Token
Message ID ile aynı işlev değildir: Message ID = network message matching/reliability; Token = request-response correlation.

## CoAP Options
`Uri-Host, Uri-Path, Uri-Query, Content-Format, Accept, ETag, Max-Age, Observe (uzantı varsa), Block options (uzantı varsa)` — güncel registered option veritabanıyla genişletilebilir. Delta/length compact encoding bit/byte düzeyinde açılmalıdır.

## CoAP Payload Marker
`0xFF` payload başlangıcını işaretler: `Options End → FF → Payload`.

## RTP — Real-time Transport Protocol
RFC 3550: real-time audio/video/simulation data için payload-type identification, sequence numbering, timestamping, delivery monitoring; çoğunlukla UDP üzerinde.
```
UDP → RTP → Audio/Video/Data
```

## RTP Header
Version, Padding, Extension, CSRC Count, Marker, Payload Type, Sequence Number, Timestamp, SSRC, CSRC List, Header Extension, Payload.
```
V P X CC
M PT
Sequence
Timestamp
SSRC
```

## RTP Sequence Number
16-bit. `100,101,102,104` → Expected 103, Possible packet loss=1. Wrap durumu (`65534,65535,0,1`) normal kabul edilmelidir.

## RTP Timestamp
Wall clock **değildir** — payload clock domain'ini temsil eder.
```
Time = ΔRTPtimestamp / ClockRate
```
Örnek: Clock 90000 Hz, Timestamp Difference 9000 → 0.1 s. Payload Type/SDP bilgisi gerekir.

## RTP SSRC
32-bit stream identity. Toolkit kullanıcı mapping'i kurabilir (örn. SSRC `0x12345678`=Camera1, `0x87654321`=Microphone1).

## RTP Jitter
RFC 3550 smoothed estimator:
```
Transit_i = Arrival_i - RTPTime_i
D_i = Transit_i - Transit_(i-1)
J_i = J_(i-1) + (|D_i| - J_(i-1)) / 16
```
Toolkit grafikleri: RTP Jitter, Packet Loss, Sequence Gap, Late Packet, Out Of Order.

## RTP Payload
Payload Type (PT) encoding'i belirtir, ama dynamic PT numaraları için SDP/session configuration gerekebilir. Toolkit: `Payload Type:96 → Mapping: Unknown unless SDP/profile supplied` — yanlış codec tahmini yapılmamalıdır.

## RTCP
RFC 3550: RTP'yi delivery quality monitoring ve participant information ile tamamlar. Paket türleri: Sender Report, Receiver Report, Source Description, BYE, APP.

## RTCP Common Header
Version, Padding, Report Count/Subtype, Packet Type, Length. Compound RTCP paketindeki her alt paket ayrı tree node olmalıdır.

## Sender Report — SR
SSRC, NTP Timestamp, RTP Timestamp, Sender Packet Count, Sender Octet Count, Report Blocks — RTP zamanı ile absolute NTP zamanı arasında mapping sağlar (→ Derived Media Timeline).

## Receiver Report — RR
Report block: SSRC, Fraction Lost, Cumulative Lost, Extended Highest Sequence, Interarrival Jitter, LSR, DLSR. Örnek: Loss 1.2%, Jitter 4.6 ms, Reported RTT.

## PTP — Precision Time Protocol
IEEE 1588. **2026 itibarıyla aktif temel standard: IEEE 1588-2019, protocol version PTP v2.1**; BMCA, terminology, management/YANG amendment'ları sonradan yayımlanmıştır. Hedef: doğru tasarlanmış ağlarda sub-microsecond (bazı sistemlerde daha iyi) senkronizasyon.

## PTP Clock Types
`Grandmaster, Ordinary Clock, Boundary Clock, Transparent Clock` — topology üzerinde rolleriyle gösterilir.

## PTP Message Types
En az: `Sync, Follow_Up, Delay_Req, Delay_Resp, Pdelay_Req, Pdelay_Resp, Pdelay_Resp_Follow_Up, Announce, Signaling, Management`.

## One-Step / Two-Step
**Two-step:** `Master → Sync → Follow_Up` (Follow_Up precise origin timestamp taşır). **One-step:** timestamp/correction Sync içinde uygun donanımla doğrudan sağlanır. Toolkit: `Clock Mode: Two-Step`.

## End-to-End PTP Delay
```
Master                         Slave
t1 Sync sent  ---------------->
                        t2 received
                        t3 DelayReq sent
       <---------------- 
t4 DelayReq received, DelayResp -->
```
```
MeanPathDelay      = [(t2-t1) + (t4-t3)] / 2   (symmetric path varsayımı)
OffsetFromMaster   = (t2-t1) - MeanPathDelay
```
Toolkit ayrıca PTP `correctionField` değerlerini profile'a göre hesaba katmalıdır.

## PTP Analyzer
Grandmaster ID, Clock Identity, Domain, Sequence ID, Message Type, Log Message Interval, Correction Field, Port Identity, Two-Step, Offset, Mean Path Delay, Announce State.

**Sequence gaps:** Sync `100,101,103` → "Missing Sync: 102" uyarısı.

## BMCA
Best Master Clock Algorithm; IEEE 1588-2019 ve 1588a-2023 BMCA + enhanced BMCA'yı kapsar. Announce mesajlarından: Priority1, Clock Class, Clock Accuracy, Variance, Priority2, Clock Identity → "Selected Grandmaster" kararı açıklanır.

## TFTP
RFC 1350: UDP üzerinde basit file-transfer; her nonterminal data block ayrı ACK ile onaylanır. Ana paket tipleri: `RRQ, WRQ, DATA, ACK, ERROR`; option extension kullanıldığında `OACK` de desteklenir.

## TFTP Read Flow
```
Client RRQ filename → Server DATA block1 → Client ACK block1 → Server DATA block2 → Client ACK block2 ...
```
Toolkit session: File, Direction, Blocks, Retries, Transferred.

## TFTP Packet
DATA: Opcode, Block Number, Data. ACK: Opcode, Block Number. ERROR: Opcode, Error Code, Error Message, `0x00`.

## TFTP Block Size
Klasik varsayılan: 512 byte. RFC 1350: final DATA paketi normal block size'dan kısa olduğunda transfer sona erer; option extension farklı negotiated block size sağlayabilir. Örnek: Block100 payload512 → "Continue"; son blok payload203 → "Final Block".

## TFTP Retransmission
`DATA25 → No ACK → Timeout → DATA25 retransmitted`. Toolkit: Block, Retries, Transfer Delay.

## FTP Kontrol Mesajları
RFC 959: control connection ile data-transfer connection'ı ayırır. Toolkit kapsamı: **FTP control-message analysis**; full file reconstruction opsiyonel ileri özellik.

## FTP Control Connection
```
Client → TCP Control Connection → FTP Server
```
Komutlar ASCII text: `USER user, PASS password, SYST, PWD, TYPE I, PASV, RETR firmware.bin, QUIT`. Credentials varsayılan olarak redakte edilir: `PASS ********`.

## FTP Responses
3 haneli numeric response code: `220` Server Ready, `331` Password Required, `230` Logged In, `227` Entering Passive Mode, `150` Opening Data Connection, `226` Transfer Complete. Toolkit: Code, Class, Meaning veritabanı.

## Active / Passive FTP
`PORT/EPRT` → active connection; `PASV/EPSV` → passive connection. Timeline: `PASV → Server endpoint sağlar → Client data TCP connection açar → RETR → Data`.

## FTP Transaction Tree
```
Session
├─ Login
├─ Directory operations
├─ Transfer 1
│  ├─ RETR
│  ├─ Data connection
│  └─ 226 Complete
└─ QUIT
```

## Telnet
RFC 854: bidirectional 8-bit byte-oriented terminal iletişim protokolü; text stream ile protocol-control komutlarını aynı TCP stream'de taşır. Özel byte: `IAC = 0xFF` (Interpret As Command).

## Telnet Option Negotiation
Ana komutlar: `WILL, WONT, DO, DONT`. Örnek: Client `IAC DO ECHO` → Server `IAC WILL ECHO` → semantic: "Request: Enable ECHO / Result: Accepted".

## Telnet Subnegotiation
`IAC SB ... IAC SE` arasında option-specific data taşınır (örn. Option: Terminal Type).

## Telnet IAC Escaping
Literal `0xFF` göndermek için `FF FF` escaping gerekir — toolkit byte-transparency görünümü sağlar.

## Telnet Security View
Base protokol encryption sağlamaz. Toolkit uyarısı: "Plaintext protocol / Credentials may be visible in capture" — özellikle eski embedded cihaz entegrasyonlarında yararlıdır.

## Syslog
RFC 5424: transport-independent layered mimari ve standard message format. Mesaj: `PRI, VERSION, TIMESTAMP, HOSTNAME, APP-NAME, PROCID, MSGID, STRUCTURED-DATA, MSG`.

## PRI
```
PRI = Facility × 8 + Severity
```
Örnek PRI=34 → `Facility = ⌊34/8⌋ = 4`, `Severity = 34 mod 8 = 2`.

## Syslog Header
Örnek: `<34>1 2026-08-08T15:00:00Z device1 app 123 ID47 - Motor fault` → PRI 34, Version 1, Timestamp ..., Hostname `device1`, App `app`, Process `123`, Message ID `ID47`, Structured Data None, Message "Motor fault" (RFC 5424 HEADER + STRUCTURED-DATA modeli).

## Syslog Structured Data
Örnek `[temperature sensor="1" value="85.2"]` → tree: `Structured Data ├─ ID temperature ├─ sensor=1 └─ value=85.2`.

## Syslog Severity Dashboard
`Emergency, Alert, Critical, Error, Warning, Notice, Informational, Debug` — sayım (örn. Critical:3, Error:14, Warning:52) + Errors/minute trend grafiği.

## LLDP — Link Layer Discovery Protocol
Adjacent IEEE 802 cihazların topology/connectivity bilgisini duyurması. Yayımlanmış temel: **IEEE 802.1AB-2016** (yeni revizyon projesi 2026 itibarıyla aktif); multiframe LLDPDU desteği için **802.1ABdh-2021** amendment'ı. Router, Switch, Embedded Device, PLC, Industrial Switch komşuluk keşfi için yararlıdır.

## LLDP TLV
LLDPDU = TLV dizisi: Chassis ID, Port ID, TTL, Optional TLVs, End Of LLDPDU. TLV: Type, Length, Value (örn. TLV Type "System Name", Length 8, Value `switch01`).

## Mandatory LLDP TLVs
Chassis ID, Port ID, TTL, End. Neighbor table: `Local Port | Remote System | Remote Port | TTL`.

## Optional LLDP TLV
Port Description, System Name, System Description, System Capabilities, Management Address, Organizationally Specific TLVs (OUI+subtype ile plugin/veritabanı üzerinden decode edilir).

## LLDP TTL
Neighbor TTL (örn. 120 s); update gelmezse Neighbor Age takip edilir (örn. "Last LLDP 130s ago" → State: EXPIRED).

## LLDP Topology Builder
Capture'dan port↔neighbor ilişkilerinden network graph oluşturulur (örn. Switch A port3↔PLC eth0, port4↔Camera eth0).

## mDNS — Multicast DNS
RFC 6762: conventional DNS server olmadan local link üzerinde DNS-benzeri name resolution; DNS message structure ile UDP multicast üzerinden çalışır, `.local.` namespace link-local semantics'e sahiptir. Port: **UDP 5353**.

## mDNS Query
Örnek: Query `device.local` Type A → local multicast'e gönderilir; Response `device.local A 192.168.1.50`. Ayrım: DNS = unicast resolver query; mDNS = link-local multicast.

## .local
RFC 6762: `.local.` domain'i link-local multicast DNS için özel namespace. Toolkit: Hostname `sensor01.local`, Scope: Link Local.

## mDNS Probing
Yeni cihaz hostname/RR kullanmadan önce conflict kontrolü için probe yapar: `Device starts → Random initial delay → Probe → Probe → Probe → Announcement` (RFC 6762 startup probing/announcing/conflict-resolution). Toolkit state: `PROBING → ANNOUNCED`.

## mDNS Conflict
İki cihaz aynı ismi (`device.local`) claim ederse → "NAME CONFLICT" (Responder A / Responder B MAC/IP).

## mDNS Resource Records
Normal DNS yapısı: A, AAAA, PTR, SRV, TXT. DNS Service Discovery etkinse `_service._tcp.local` gibi service record'lar üzerinden local-service browser kurulabilir. **mDNS ≠ DNS-SD**: mDNS = multicast name/resource resolution; DNS-SD = DNS record'ları kullanarak service discovery.

## Ortak Network Packet Tree

Tüm 3.8 protokolleri için drill-down örneği:
```
Frame 152
└─ Ethernet II
   ├─ Destination
   ├─ Source
   ├─ VLAN
   └─ IPv4
      ├─ Source
      ├─ Destination
      ├─ TTL
      └─ TCP
         ├─ Source Port
         ├─ Destination Port
         ├─ Sequence
         └─ MQTT
            ├─ PUBLISH
            ├─ Topic
            └─ Payload
```

## Raw HEX ile Field Senkronizasyonu
Örnek: `45 00 00 3C 12 34 40 00 40 06 ...` — kullanıcı TTL alanına tıklayınca ilgili byte (`[40]`) highlight edilir; Bit görünüm `01000000`, Decimal `64`, Semantic `TTL=64` eşzamanlı gösterilir.

## Flow / Conversation Analyzer
Tüm paketler conversation halinde gruplanır: **Ethernet** MAC A↔MAC B, **IP** IP A↔IP B, **UDP** A:Port↔B:Port, **TCP** Connection, **MQTT** Client↔Broker, **DNS** Query↔Response, **DHCP** Client↔Server.

## Endpoint Table
`IP | MAC | TX | RX` + Protocols, Ports, Hostnames, mDNS Names, LLDP Name, VLAN, Last Seen.

## Port Analyzer
TCP/UDP port veritabanı: Port, Protocol, Observed Application, Configured Application. Örnek: `1883/TCP → MQTT candidate`. **Ancak port numarası tek başına protocol kanıtı değildir** (TCP 1883'te proprietary protokol de bulunabilir). Toolkit: Port-based candidate + Payload validation (PASS) + Confidence (HIGH) birlikte çalışır.

## Protocol Auto-Detection
Sadece port numarasına dayanmamalı:
- **MQTT:** TCP 1883 + valid fixed header + valid remaining length + valid packet flags → confidence yükselir
- **HTTP:** `GET/POST/HTTP/` + valid header syntax
- **DNS:** valid DNS header + count/record structure
- **mDNS:** UDP 5353 + DNS structure + multicast destination

## Checksum Validation Engine
Ortak engine ayrı ayrı gösterir: Ethernet FCS, IPv4 Header Checksum, ICMP Checksum, ICMPv6 Checksum, UDP Checksum, TCP Checksum, Application CRC. Örnek: Ethernet "FCS not captured", IPv4 PASS, UDP PASS, Application "CRC FAIL" → katman bazlı açıklama: "Network transport valid / Application payload integrity failed".

## Pseudo-Header Görünümü
TCP/UDP checksum hesaplaması IP pseudo-header kullanır:
```
IPv4 Pseudo Header
├─ Source IP
├─ Destination IP
├─ Protocol
└─ Length
TCP/UDP Header
Payload
```
IPv6 için uygun IPv6 pseudo-header modeli kullanılmalıdır.

## Packet Length Breakdown
Örnek: Application Payload 100B, TCP 20B, IPv4 20B, Ethernet 14B, FCS 4B.
```
Efficiency = ApplicationPayload / TotalTransmittedBytes × 100
```
İstenirse preamble/SFD ve IFG gibi wire-time overhead da modele eklenebilir.

## Bandwidth Analyzer
```
Bitrate = TotalBits / ObservationTime
```
Örnek: 12 MB / 10 s ≈ 9.6 Mbit/s. Application vs network throughput ayrı hesaplanır: Application 8.5, TCP Payload 8.8, IP 9.1, Ethernet 9.6 Mbit/s.

## Packet Rate
```
PacketRate = PacketCount / Time
```
Örnek: 10000 paket / 10 s = 1000 pps.

## Latency / RTT
Protokol izin verdikçe request-response eşleştirilir: DNS, DHCP, ICMP, MQTT QoS, CoAP, HTTP, NTP, TFTP, SNMP.
```
ResponseTime = t1 - t0
```

## Jitter
```
Period_i = t_i - t_(i-1)
J_i = Period_i - T_expected
```
Örnek: Expected 10ms, Observed `9.8, 10.1, 10.0, 10.4 ms`. RTP gibi protocol-specific jitter algoritması varsa generic formül yerine standard algoritma kullanılmalıdır.

## Packet Loss
Network layer packet loss capture'dan her zaman doğrudan bulunamaz. Sequence number sağlayan protokoller (TCP, RTP, MQTT transaction state, Art-Net, sACN, custom protokoller) üzerinden daha güvenilir inference yapılır. UDP'nin kendisinde sequence yoktur → toolkit `UDP Packet Loss: Unknown` demeyi bilmelidir. Üst application sequence varsa `Application packet loss: N` hesaplanabilir.

## TCP Stream Viewer
Hex + Text ikili görünüm; Segment 1/2/3 ile **Complete Application Data** (tam reassemble edilmiş stream) arasında geçiş.

## UDP Datagram Viewer
Her datagram ayrı entity korunur (Datagram #1, #2, #3...) — TCP gibi tüm payload'lar tek continuous stream haline getirilmemelidir.

## Fragment / Reassembly Center
Tek ekranda ayrı ayrı gösterilir: IPv4 Fragments, IPv6 Fragments, TCP Segments, WebSocket Fragments, CoAP Block Transfers, TFTP Blocks, RTP Packets. Günlük dilde hepsine "parçalama" denebilse de katmanları ve algoritmaları farklıdır.

## Discovery Protocol Dashboard
ARP, DHCP, LLDP, mDNS, DNS trafiği bir arada görülür. Toolkit farklı kaynaklardan logical device identity kurar (örn. Device PLC01: MAC, IPv4, DHCP Server, LLDP Name, mDNS adı). Bu ilişkilendirme **confidence-based** olmalıdır.

## Network Topology Builder
LLDP + ARP + IP trafiğinden topology çıkarılır. Kesin LLDP bilgisi **Confirmed Edge**, traffic inference **Inferred Relationship** olarak ayrı gösterilir.

## Network Error Correlation
Örnek: `Ethernet link returns → DHCP Discover → DHCP ACK → ARP → mDNS announcement → MQTT CONNECT → MQTT CONNACK` (zaman damgalarıyla) → tek "DEVICE NETWORK STARTUP" session olarak gruplanır. Başka örnek root-cause zinciri: `TCP retransmissions → MQTT PUBACK latency increases → Application timeout`.

## Ağ Hata Modeli

Ortak hata/warning sınıfları (sabit kod listesi):

`BAD_FCS, BAD_IP_CHECKSUM, BAD_TCP_CHECKSUM, BAD_UDP_CHECKSUM, IP_FRAGMENT_MISSING, IP_FRAGMENT_OVERLAP, TCP_RETRANSMISSION, TCP_DUP_ACK, TCP_OUT_OF_ORDER, TCP_ZERO_WINDOW, TCP_RESET, TCP_HANDSHAKE_TIMEOUT, ARP_CONFLICT, DHCP_TIMEOUT, MULTIPLE_DHCP_SERVER, DNS_NXDOMAIN, DNS_SERVFAIL, DNS_TIMEOUT, NTP_OFFSET_HIGH, NTP_DELAY_HIGH, SNMP_ERROR, HTTP_MALFORMED, WEBSOCKET_BAD_FRAME, MQTT_MALFORMED, MQTT_QOS_TIMEOUT, MQTT_KEEPALIVE_TIMEOUT, COAP_RETRANSMISSION, COAP_TIMEOUT, RTP_SEQUENCE_GAP, RTP_JITTER_HIGH, PTP_SYNC_LOST, PTP_OFFSET_HIGH, TFTP_RETRY, FTP_ERROR, TELNET_NEGOTIATION_ERROR, SYSLOG_MALFORMED, LLDP_NEIGHBOR_EXPIRED, MDNS_CONFLICT, UNKNOWN_PROTOCOL`

Her hata: Timestamp, Layer, Protocol, Flow, Packet, Severity, Expected, Received, Related Packets, Possible Cause bilgisine sahip olmalıdır.

## Network Layer Drill-Down

- **MQTT:** Temperature 25.4°C → MQTT PUBLISH → Topic `factory/line1/temp` → TCP Byte Stream → TCP Segment → IPv4 Datagram → VLAN 20 → Ethernet Frame → Capture Interface
- **HTTP:** JSON `{"state":"RUN"}` → HTTP Response → TCP → IPv6 → Ethernet
- **mDNS:** PLC01 → A Record → mDNS Response → UDP 5353 → IPv4 Multicast → Ethernet Multicast
- **PTP:** Clock Offset 250 ns → Sync+Follow_Up → PTP → UDP/Ethernet Profile → Ethernet

Amaç: 3.8 bölümünün küçük bir Wireshark-benzeri paket listesi olmaktan çıkıp, Ethernet frame'inden VLAN'a, IP fragment'ından TCP byte stream'ine, DHCP/DNS discovery sürecinden MQTT/CoAP IoT trafiğine, RTP jitter analizinden PTP clock synchronization'a kadar ağdaki iletişimi **byte/bit + transaction + sistem davranışı** seviyesinde açıklayabilen bütünleşik bir **Network Communication Analyzer** olmasıdır.

---

## Dikkat çekenler

- **TCP = byte stream, paket değil** (TCP Stream Reassembly): protokol parser'ları (MQTT/HTTP/Modbus-TCP vb.) ham packet payload'ı değil, retransmission/gap temizlenmiş **reassembled stream**'i işlemeli — aksi halde mesaj sınırları yanlış çözülür.
- **FCS "missing" değil "not captured":** çoğu NIC/OS capture öncesi FCS'i siler; bunu wire corruption gibi göstermek yanlış teşhise yol açar. Aynı mantık UDP checksum-offload artifact'i için de geçerli.
- **Port numarası protokol kanıtı değildir:** Port Analyzer ve Auto-Detection, port + payload validation + confidence skorunu birlikte kullanmalı (örn. TCP 1883'te MQTT olmayan bir protokol de olabilir).
- **IPv4 vs IPv6 fragmentation felsefe farkı:** IPv4'te router'lar fragment edebilir; IPv6'da yalnız source node, Fragment extension header ile fragment eder — router'lar normal forwarding'de asla fragment yapmaz.
- **ICMPv6 Neighbor Discovery, ARP'nin IPv6 karşılığı olarak basitçe adlandırılmamalı** — kapsamı ARP'den geniş (Router Solicitation/Advertisement, Redirect dahil).
- **mDNS ≠ DNS-SD:** mDNS multicast isim çözümü sağlar, DNS-SD ise DNS kayıtlarıyla servis keşfidir; toolkit bu ikisini karıştırmamalı.
- **MQTT-SN henüz resmi OASIS Standard değil:** MQTT-SN 1.2 yalnızca "input specification" statüsünde — MQTT 5.0'ın aksine resmi onaylı standart değil; toolkit bunu profil metadata'sında ayrıca belirtmeli.
- **NTP stratum küçüklüğü = doğruluk garantisi değildir**; benzer şekilde PTP/NTP delay hesapları **path symmetry varsayımına** dayanır ve asimetrik ağlarda yanılabilir.
- **ARP/mDNS "conflict" tespitleri tek başına saldırı kanıtı sayılmamalı** — static IP değişikliği, redundancy veya yeniden yapılandırma da aynı belirtiyi verebilir.
- **Standart sürüm çapaları (2026 itibarıyla):** Ethernet IEEE 802.3-2022, VLAN IEEE 802.1Q-2022, TCP RFC 9293, HTTP/1.1 RFC 9110/9112, MQTT 5.0 (7 Mart 2019 OASIS onayı), PTP IEEE 1588-2019 (v2.1) + 1588a-2023, LLDP IEEE 802.1AB-2016 + 802.1ABdh-2021 amendment — toolkit'in "Protocol + Revision/Profile" yaklaşımını doğrular.
- **UDP'de packet loss varsayılan olarak "Unknown"** gösterilmeli; yalnız TCP/RTP/MQTT gibi sequence taşıyan protokollerde güvenilir loss inference mümkündür.

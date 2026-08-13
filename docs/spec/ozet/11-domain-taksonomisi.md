# 11 — Domain Taksonomisi (COMMUNICATION DOMAINS)

**Kaynak:** satır 40075–42975, "ALP Comm Toolkit — Geniş Kapsamlı Haberleşme Analiz ve Protokol Geliştirme Platformu.md"

Bu bölüm, uygulamanın **navigasyon/routing iskeletini** tanımlar: 8 ana Communication Domain, her domain altında protokol aileleri, her ailede protokoller, her protokolde analiz araçları.

Genel hiyerarşi:

```
Communication Domains
      ↓
Domain
      ↓
Protocol Family
      ↓
Protocol / Interface
      ↓
Analyzer / Decoder / Calculator / Builder / Monitor
```

8 domain:

1. Interfaces & Framing
2. Industrial Automation
3. Automotive
4. Marine & Navigation
5. Aerospace & UAV
6. Building Automation
7. Network & Ethernet
8. Wireless & IoT

---

## 1. INTERFACES & FRAMING

Temel haberleşme arayüzleri ve genel-purpose frame/stream protokolleri. Aileler: Serial Interfaces, Peripheral Buses, Host & Network Interfaces, Vehicle/Field Physical Layers, Framing & Stream Protocols.

### 1.1 Serial Interfaces (8 protokol)

- **UART** — Overview; Configuration (Baud Rate, Data Bits, Parity, Stop Bits, Bit Order, Flow Control); Frame Visualizer (Start Bit, Data Bits, Parity Bit, Stop Bits); Live UART Monitor; UART Decoder; UART Packet Builder; Timing Calculator (Bit Time, Character Time, Packet Time, Throughput, Efficiency); Baud Error Calculator; Oversampling Analyzer; Error Analyzer (Parity Error, Framing Error, Overrun, Break, Timeout); Examples
- **TTL UART** — Logic-Level Configuration (1.8V, 2.5V, 3.3V, 5V); Logic Compatibility (VIH, VIL, VOH, VOL); UART Frame View; Live Monitor; Level Compatibility Calculator; Error/Warning View
- **CMOS UART** — Supply Voltage; Logic Thresholds; TX→RX Compatibility; RX→TX Compatibility; Level Translation Check; UART Frame View; Live Monitor
- **RS-232** — Overview; UART↔RS-232 Layer View; Signal View (TXD, RXD, RTS, CTS, DTR, DSR, DCD); DTE/DCE Analyzer; Null-Modem Helper; DB9 Pinout Helper; Frame Decoder; Live Monitor; Timing Calculator; Error Analyzer
- **RS-422** — Differential Signal View; TX+/TX-; RX+/RX-; Full-Duplex Analyzer; Voltage Difference Calculator; Termination Helper; Live Decoder; Timing; Diagnostics
- **RS-485** — Physical Layer; Half-Duplex; Full-Duplex; A/B Differential View; DE/RE Timing; Driver Turnaround; Termination Calculator; Bias/Fail-Safe Calculator; Unit Load/Node Calculator; Cable Delay Calculator; Bus Timing; Live Monitor; Collision/Turnaround Analyzer; Diagnostics. **Related Protocols (hızlı geçiş):** Modbus RTU, Modbus ASCII, BACnet MS/TP, PROFIBUS, Custom RS-485
- **Current Loop** — Digital Current Loop; Loop Voltage; Loop Current; Cable Resistance; Receiver Burden; Ohm's Law Calculator; Diagnostics
- **4–20 mA** — Current→Engineering Value; Engineering Value→Current; Shunt Resistor Calculator; ADC Voltage Calculator; Compliance Voltage; Cable Resistance; Live Zero; Sensor Range; Fault Detection; Trend View

### 1.2 Peripheral Buses (9 protokol — 2 alt aile)

**SPI Family:** SPI, Quad SPI, Octal SPI, Microwire
**I²C Family:** I²C, I3C, SMBus, PMBus, 1-Wire

- **SPI** — Configuration (Clock Frequency, CPOL, CPHA, Mode 0–3, Bit Order); Signal View (SCLK, MOSI, MISO, CS); Timing Diagram; Transfer Decoder; Register Transaction Decoder; Packet Builder; Transfer Time Calculator; Setup/Hold Analyzer; CS Timing; Throughput Calculator; Error Analyzer
- **Quad SPI** — IO0–IO3; Command Phase; Address Phase; Dummy Cycles; Data Phase; Read Transaction; Write Transaction; Throughput Calculator; Memory Transaction Viewer
- **Octal SPI** — IO0–IO7; SDR; DDR; DQS; Command; Address; Dummy; Data; XIP; Memory Transaction Analyzer; Throughput Calculator
- **Microwire** — Command Decoder; Opcode; Address; Data; Read; Write; EEPROM Transaction View; Timing
- **I²C** — Signal View (SDA, SCL); START/STOP; Address Decoder (7-bit, 10-bit); Read/Write Bit; ACK/NACK; Register Transaction; Repeated START; Clock Stretch; Arbitration; Bus Scanner; Timing Calculator; Pull-Up Calculator; Bus Capacitance; Bus Utilization; Live Decoder; Transaction Builder; Error Analyzer
- **I3C** — Device Discovery; Static Address; Dynamic Address; ENTDAA; CCC Commands; SDR Traffic; HDR Traffic; IBI; Hot-Join; Legacy I²C Devices; Device Table; Diagnostics
- **SMBus** — Quick Command; Send Byte; Receive Byte; Read Byte; Write Byte; Read Word; Write Word; Block Read; Block Write; PEC; Timeout; Transaction Decoder
- **PMBus** — Device Explorer; Command Browser; READ_VOUT; READ_IOUT; READ_TEMPERATURE; STATUS; Linear11 Decoder; Linear16 Decoder; Direct Format Decoder; Telemetry Dashboard; Fault Decoder; Command Builder
- **1-Wire** — Reset Pulse; Presence Pulse; ROM Commands; 64-bit ROM ID; Search ROM; Device Tree; Scratchpad; Read/Write Slot; Parasite Power; Timing Analyzer

### 1.3 Host & Network Interfaces (3 protokol)

- **USB** — Device Enumeration; Descriptors (Device, Configuration, Interface, Endpoint, String); Control Transfer; Bulk Transfer; Interrupt Transfer; Isochronous Transfer; Endpoint Explorer; PID Decoder; Setup Packet; Error Analyzer
- **Ethernet Interface** *(fiziksel/interface görünüm — paket protokolleri Domain 7'de)* — Link Status; PHY; Speed; Duplex; Auto-Negotiation; MII; RMII; GMII; RGMII; MDIO/MDC; PHY Register Viewer
- **Single Pair Ethernet** — 10BASE-T1S; 10BASE-T1L; 100BASE-T1; 1000BASE-T1; PLCA; PHY Configuration; Link Status; Diagnostics

### 1.4 Vehicle / Field Physical Layers (3 protokol)

- **CAN PHY** — CANH/CANL; Differential Voltage; Dominant/Recessive; Termination; Split Termination; Bus Topology; Propagation Delay; Transceiver Delay; Physical Diagnostics
- **LIN PHY** — Single-Wire Signal; Dominant/Recessive; Wake-Up; Break; Transceiver View; Physical Diagnostics
- **FlexRay PHY** — Channel A; Channel B; Differential Signal; Passive Bus; Active Star; Hybrid Topology; Physical Diagnostics

### 1.5 Framing & Stream Protocols (17 protokol — 5 alt aile)

**Custom Framing (4):**
- Custom Binary Protocol — Header, Address, Command, Length, Payload, CRC, Parser Builder, Packet Builder
- ASCII Protocol
- Delimiter-Based Protocol
- Length-Based Protocol

**Encapsulation & Escaping (6):**
- SLIP — Encode, Decode, Escape View
- COBS — Encode, Decode, Overhead Calculator
- HDLC — Flag, Bit Stuffing, Address, Control, Payload, FCS
- SDLC
- PPP
- KISS

**Data Transfer Protocols (3):** XMODEM, YMODEM, ZMODEM — her biri ortak **Transfer Session**: Blocks, Sequence, ACK/NAK, CRC, Retry, Progress, Errors

**Navigation Binary Protocols (2):** UBX, RTCM — *Marine ve Aerospace kategorilerinden cross-link alır*

**Command Protocols (2):**
- AT Commands — Command Parser, Response Parser, URC, State Machine, Command Console
- Hayes Command Set — Basic Commands, Dial Commands, S Registers, Result Codes

**Domain 1 toplamı: 8 + 9 + 3 + 3 + 17 = 40 protokol**

---

## 2. INDUSTRIAL AUTOMATION

Aileler: Modbus, Classic Fieldbus, Industrial Ethernet, CIP & CAN-Based, Sensors & Device Integration, Process Instrumentation, Metering, SCADA & Utility.

### 2.1 Modbus (3 protokol)

- **Modbus RTU** — Frame Decoder; Request/Response; Function Codes; Register Viewer; Register Map; Data Type Decoder; Word/Byte Order; CRC; Timing; Polling; Exception Decoder; Packet Builder; Master Simulator; Slave Simulator
- **Modbus ASCII** — ASCII Frame; HEX Conversion; LRC; Request/Response; Register Map; Builder
- **Modbus TCP** — MBAP Header; Transaction ID; Unit ID; TCP Stream Reassembly; Register Decoder; Request/Response; Connection Statistics

### 2.2 Classic Fieldbus (4 protokol)

- **PROFIBUS DP** — Station Explorer; Telegram Decoder; Master/Slave; Cyclic I/O; Parameterization; Configuration; Diagnostics; Timing; GSD Explorer
- **CC-Link** — Station Explorer; Cyclic Communication; Remote Inputs; Remote Outputs; Remote Registers; Diagnostics; Network Timing
- **AS-Interface** — Master; Device Address; Input/Output Bits; Cyclic Poll; Parameter Data; Diagnostics; ASi-5
- **FOUNDATION Fieldbus** — H1; HSE; Device Explorer; Resource Block; Transducer Block; Function Blocks; Publisher/Subscriber; Diagnostics

### 2.3 Industrial Ethernet (6 protokol)

- **PROFINET** — Device Discovery/DCP; IO Controller; IO Device; Cyclic I/O; Slot/Subslot; Alarms; Diagnostics; Timing/Jitter; GSDML Explorer
- **EtherCAT** — Ethernet Frame; EtherCAT Datagram; Command; Addressing; Working Counter; Slave States; Distributed Clocks; PDO; Mailbox (CoE, FoE, EoE, SoE, AoE); Diagnostics
- **EtherNet/IP** — Encapsulation; Session; CIP; Explicit Messaging; Implicit I/O; Assemblies; RPI; Sequence/Jitter; EDS
- **CC-Link IE** — IE Field; IE Controller; IE Field Basic; IE TSN; Cyclic Communication; Transient Communication; Network Diagnostics
- **Sercos III** — Communication Cycle; Real-Time Telegrams; Drive Data; Device Parameters; State/Phase; Timing
- **POWERLINK** — Managing Node; Controlled Nodes; Isochronous Phase; Asynchronous Phase; PDO; SDO; NMT; Diagnostics

### 2.4 CIP & CAN-Based Industrial (3 protokol)

- **CIP** — Object; Class; Instance; Attribute; Service; Path Decoder; Status; Device Profiles
- **DeviceNet** — Node Explorer; CAN Frame; CIP Layer; I/O Messaging; Explicit Messaging; Diagnostics
- **CANopen** — Node Explorer; Object Dictionary; NMT; PDO; SDO; SYNC; EMCY; Heartbeat; EDS; CiA Profiles

### 2.5 Sensors & Device Integration (1 protokol)

- **IO-Link** — Master/Port Explorer; Process Data; Parameter Data; Events; Diagnostics; Device Identity; IODD Explorer

### 2.6 Process Instrumentation (1 protokol)

- **HART** — 4–20 mA; Digital Frame; Device Address; Commands; Universal Commands; Common Practice; Device-Specific; Device Status; Burst Mode; Analog/Digital Compare

### 2.7 Metering (2 protokol)

- **M-Bus**, **Wireless M-Bus** — ortak **Meter Browser**: Device Identity, Telegram, Data Records, Energy, Volume, Flow, Temperature, Diagnostics

### 2.8 SCADA & Utility (5 protokol)

- **OPC UA** — Endpoint Discovery; Secure Channel; Session; Address Space; Browse; Read; Write; Method; Subscription; Monitored Items; Security; Certificates
- **IEC 60870-5-101** — Link Layer; ASDU; Type ID; Cause; Common Address; IOA; Quality; Timestamp; Commands
- **IEC 60870-5-104** — TCP Session; APCI; I-Format; S-Format; U-Format; Sequence Numbers; ASDU; Session Timeline
- **DNP3** — Data Link; Transport; Application; Objects; Variations; Classes; Unsolicited; Confirm; IIN; Events
- **IEC 61850** — Information Model; SCL Explorer; MMS (Association, Read, Write, Reports, Control); GOOSE (Publisher, Dataset, stNum, sqNum, Retransmission, Diagnostics)

**Domain 2 toplamı: 3 + 4 + 6 + 3 + 1 + 1 + 2 + 5 = 25 protokol**

---

## 3. AUTOMOTIVE

Aileler: CAN Family, Vehicle Network Protocols, Sensor Interfaces, Legacy Diagnostics, Diagnostics, Automotive Ethernet, Calibration.

### 3.1 CAN Family (4 protokol)

- **CAN 2.0A / CAN 2.0B** *(birleşik "Classical CAN" görünümü)* — Frame Decoder; Arbitration; CAN ID; DLC; Data; Bit Stuffing; CRC; ACK; Timing; Bus Load; Period/Jitter; Error Frames
- **CAN FD** — FDF; BRS; ESI; DLC Mapping; 64-byte Payload; Nominal Timing; Data Timing; CRC; Bus Load
- **CAN XL** — Priority ID; Acceptance Field; SDT; VCID; DLC; Large Payload; Frame Inspector

### 3.2 Vehicle Network Protocols (6 protokol)

Aile ağacı: J1939, CANopen, LIN, FlexRay, SAE J1850 PWM, SAE J1850 VPW *(CANopen'in detayı 2.4'te; SAE J1850 PWM/VPW bu aralıkta ayrı "###" almıyor — bkz. Dikkat çekenler)*

- **J1939** — 29-bit ID; Priority; PGN; Source Address; Destination; SPN; Physical Values; Address Claim; Transport Protocol; DM1/DM2; DTC
- **LIN** — Break; Sync; PID; Parity; Data; Checksum; Schedule Table; Nodes; LDF
- **FlexRay** — Channel A/B; Communication Cycle; Static Segment; Dynamic Segment; Frame Decoder; Cycle Count; CRC; Timing

### 3.3 Automotive Sensor Interfaces (3 protokol)

- **SENT** — Sync Pulse; Tick Time; Status Nibble; Data Nibbles; CRC; Fast Channel; Slow Channel; Pulse Analyzer
- **SPC** — Trigger Pulse; Request; Response Delay; SENT Response; Diagnostics
- **PSI5** — Sensor Channels; Sync; Slots; Data; Parity; CRC; Sensor Status

### 3.4 Legacy Diagnostics (3 protokol)

Aile ağacı: K-Line, ISO 9141, ISO 14230 KWP2000 — *bu aralıkta detay alt başlığı yok, sadece aile listesi*

### 3.5 Diagnostics (4 protokol)

- **ISO-TP** — Single Frame; First Frame; Consecutive Frame; Flow Control; Block Size; STmin; Reassembly; Timing
- **UDS** — Sessions; Services; DID; DTC; Security Access; Routine Control; Programming; Positive Response; Negative Response; NRC Decoder
- **OBD-II** — Modes; PID Browser; Live Data; DTC; Freeze Frame; Vehicle Information
- **DoIP** — Vehicle Discovery; Routing Activation; Logical Addresses; Diagnostic Messages; Alive Check; TCP Session; UDS Decoder

### 3.6 Automotive Ethernet (2 protokol)

- **Automotive Ethernet** — 100BASE-T1; 1000BASE-T1; VLAN; IP; UDP/TCP; Traffic Matrix; Bandwidth
- **SOME/IP** — Service; Method; Event; Request/Response; Session; Payload; Service Discovery

### 3.7 Calibration (3 protokol)

Aile ağacı: XCP on CAN, XCP on Ethernet, CCP — bu aralıkta yalnız birleşik **### XCP** detayı var (CCP'ye ayrı detay yok): CTO; DTO; Commands; DAQ; Measurement; Calibration; A2L; Event Channels; Timing

**Domain 3 toplamı: 4 + 6 + 3 + 3 + 4 + 2 + 3 = 25 protokol**

---

## 4. MARINE & NAVIGATION

Aileler: NMEA Family, AIS, GNSS & Corrections, Marine Machinery, Legacy/Proprietary Marine.

### 4.1 NMEA Family (3 protokol)

- **NMEA 0183** — Sentence Monitor; Talker ID; Formatter; Fields; Checksum; Coordinate Converter; GGA; RMC; GSA; GSV; VTG; HDT/HDG; DPT/DBT; MWV; ROT; Rate/Freshness
- **NMEA 2000** — CAN Frame; PGN; Source/Destination; Device Explorer; Fast Packet; Reassembly; Navigation; Engine; Electrical; PGN Statistics
- **IEC 61162** — alt varyantlar: IEC 61162-1, IEC 61162-2, IEC 61162-3, IEC 61162-450, IEC 61162-460

### 4.2 AIS (1 protokol)

- **AIS** — AIVDM; AIVDO; Fragment Reassembly; 6-bit Decoder; Message Types; MMSI; Position; SOG/COG; Heading; Static/Voyage Data; Target Table; Target Freshness

### 4.3 GNSS & Corrections (3 protokol)

Aile ağacı: GPS NMEA, GNSS UBX, RTCM

- **GNSS dashboard** — Position; Fix; Satellites; HDOP; Altitude; Velocity; COG; Time; Accuracy
- **RTCM** — Stream Decoder; Message Type; Station; Constellation; Epoch; CRC; Message Rate; Correction Age

### 4.4 Marine Machinery (2 protokol)

Aile ağacı: Marine J1939, Marine Modbus — *detay verilmemiş*

### 4.5 Legacy / Proprietary Marine (2 protokol)

Aile ağacı: SeaTalk, HDLC-Based Marine — *detay verilmemiş*

**Domain 4 toplamı: 3 + 1 + 3 + 2 + 2 = 11 protokol**

---

## 5. AEROSPACE & UAV

Aileler: UAV Telemetry, Distributed UAV Networks, RC & Control Links, Avionics Data Buses, Surveillance, GNSS & Navigation.

### 5.1 UAV Telemetry (1 protokol, 2 versiyon)

- **MAVLink** (MAVLink 1, MAVLink 2) — Frame Decoder; System/Component; Message Browser; HEARTBEAT; ATTITUDE; GPS; Position; Battery; Commands; ACK; Parameters; Mission; CRC; Signing; Packet Loss; Message Rate

### 5.2 Distributed UAV Networks (3 öğe)

Aile ağacı: UAVCAN v0/DroneCAN, Cyphal, UAVCAN Compatibility

- **DroneCAN** — Node Explorer; CAN ID; Transfer Type; Tail Byte; Transfer ID; Multi-Frame; CRC; DSDL; ESC; GNSS; Node Status
- **Cyphal** — Node Explorer; Subjects; Services; Heartbeat; DSDL; Cyphal/CAN; Cyphal/UDP; Cyphal/Serial

### 5.3 RC & Control Links (5 protokol)

- **SBUS** — Serial Configuration; Frame; 16 Channels; Packed Bits; Flags; Frame Lost; Failsafe; RC Monitor
- **IBUS** — Frame; Channels; Checksum; Telemetry; RC Monitor
- **CRSF** — Frame; RC Channels; Link Statistics; GPS; Battery; Telemetry; Device Info; CRC; Baud Negotiation
- **PPM / PWM Servo** *(birleşik "Pulse Control")* — Pulse Width; Frame Period; Frequency; Channel Decode; Normalization; Jitter; Failsafe

### 5.4 Avionics Data Buses (2 protokol)

- **ARINC 429** — 32-bit Word; Label; SDI; Data; SSM; Parity; BNR; BCD; Discrete; Label Rate
- **MIL-STD-1553** — BC; RT; BM; Command Word; Status Word; Data Word; Transactions; RT/Subaddress; Mode Codes; Bus A/B; Timing

### 5.5 Surveillance (2 protokol)

- **ADS-B** — Aircraft Table; ICAO Address; Callsign; Position; Altitude; Velocity; Heading; CPR; Message Age; CRC
- **Mode-S** — DF; Short Frame; Extended Frame; ICAO; Payload; Parity/CRC; DF17→ADS-B

### 5.6 GNSS & Navigation (3 protokol)

GPS UBX, RTCM, NMEA — *Marine'deki ortak parser'ı kullanır, ancak "Flight Navigation Dashboard" gösterir*

**Domain 5 toplamı: 1 + 3 + 5 + 2 + 2 + 3 = 16 protokol**

---

## 6. BUILDING AUTOMATION

Aileler: BACnet, KNX, DALI, Metering, Modbus Building, LonWorks, Lighting Networks.

### 6.1 BACnet (2 protokol)

- **Common BACnet** (paylaşılan) — Device Explorer; Object Explorer; Properties; Who-Is/I-Am; ReadProperty; WriteProperty; COV; Priority Array; Alarm; Event; Trend; Schedule
- **BACnet MS/TP** — MAC; Token; Token Rotation; Frame; CRC; RS-485 Diagnostics
- **BACnet/IP** — BVLL; UDP; BBMD; Foreign Device; Broadcast; Device Discovery

### 6.2 KNX (1 protokol)

- **KNX** — Individual Address; Group Address; Group Objects; Datapoint Types; GroupValueRead; GroupValueWrite; GroupValueResponse; Group Monitor; ETS Import

### 6.3 DALI (1 protokol)

- **DALI** — Device Explorer; Short Address; Groups; Scenes; Dimming; Queries; Control Commands; Device Types; DT6; DT8; Fault Monitor

### 6.4 Metering (1 protokol)

- **M-Bus** — Meter Browser; Primary Address; Secondary Address; Telegram; DIF/VIF; Energy; Volume; Temperature

### 6.5 Modbus Building (2 protokol)

Modbus RTU, Modbus TCP — Industrial Modbus parser'ını paylaşır, üzerine eklenenler: HVAC Register Map, AHU Dashboard, VFD Dashboard, Chiller Dashboard, Boiler Dashboard, Polling Optimizer

### 6.6 LonWorks (1 protokol)

- **LonWorks** — Device; Network Variables; SNVT; Configuration Properties; XIF Import; Gateway Mapping

### 6.7 Lighting Networks (3 protokol)

- **DMX512** — Universe; Break; MAB; Start Code; Slots; Fixture Profile; 8-bit Channel; 16-bit Channel; Refresh Rate
- **Art-Net** — Node Discovery; ArtPoll; ArtPollReply; ArtDmx; Universe; Sequence; ArtSync; Gateway Mapping
- **sACN** — Source/CID; Universe; Priority; Sequence; DMX Data; Synchronization; Multiple Source Monitor

**Domain 6 toplamı: 2 + 1 + 1 + 1 + 2 + 1 + 3 = 11 protokol**

---

## 7. NETWORK & ETHERNET

Aileler: Data Link, Internet Layer, Transport, Addressing & Discovery, Time & Management, Web & Messaging, Real-Time Media, File & Terminal Protocols.

### 7.1 Data Link (5 protokol)

Aile ağacı: Ethernet II, IEEE 802.3, VLAN 802.1Q, ARP, LLDP

- **Ethernet** *(Ethernet II + IEEE 802.3 birleşik detay)* — MAC Addresses; EtherType; Frame Length; FCS; Broadcast; Multicast; Throughput; Frame Statistics
- **VLAN** — TPID; PCP; DEI; VID; Tagged; Untagged; Stacked VLAN
- **ARP** — Request; Reply; IP↔MAC Map; Conflict Detector
- **LLDP** — Chassis ID; Port ID; TTL; System Name; Capabilities; Management Address; Topology

### 7.2 Internet Layer (4 protokol)

Aile ağacı: IPv4, IPv6, ICMP, ICMPv6 *(ICMPv6'ya ayrı detay yok)*

- **IPv4** — Header; Addresses; TTL; Protocol; Checksum; DSCP/ECN; Fragmentation; Reassembly
- **IPv6** — Header; Addresses; Flow Label; Next Header; Hop Limit; Extension Headers; Fragment Header; Reassembly
- **ICMP** — Echo; RTT; Destination Unreachable; Time Exceeded; Error Correlation

### 7.3 Transport (2 protokol)

- **UDP** — Ports; Length; Checksum; Datagram View; Conversation; Statistics
- **TCP** — Header; Flags; Three-Way Handshake; Sequence; ACK; Window; Options; Retransmissions; Out-of-Order; RTT; Stream Reassembly; Connection State; Close/Reset

### 7.4 Addressing & Discovery (3 protokol)

- **DHCP** — Discover; Offer; Request; ACK; Options; Lease; Server Detection
- **DNS** — Query; Response; Resource Records; A; AAAA; CNAME; PTR; TXT; SRV; Compression; TTL; Response Time
- **mDNS** — .local; Query; Response; Probing; Announcements; Conflict; Local Services

### 7.5 Time & Management (4 protokol)

- **NTP** — Packet; Stratum; T1/T2/T3/T4; Delay; Offset; Clock Drift
- **PTP** — Grandmaster; Ordinary Clock; Boundary Clock; Transparent Clock; Sync; Follow_Up; Delay_Req; Delay_Resp; Announce; BMCA; Offset; Path Delay
- **SNMP** — SNMPv1; SNMPv2c; SNMPv3; ASN.1/BER; OID; VarBind; GET; SET; TRAP; MIB Import; Security
- **Syslog** — Facility; Severity; Timestamp; Host; Application; Structured Data; Log Statistics

### 7.6 Web & Messaging (5 protokol)

- **HTTP** — Request; Response; Methods; Headers; Status Codes; Body; Chunked Transfer; JSON Viewer; Transaction Timing
- **WebSocket** — Upgrade Handshake; Text Frame; Binary Frame; Mask; Fragmentation; Ping/Pong; Close
- **MQTT** — CONNECT; CONNACK; PUBLISH; SUBSCRIBE; Topics; QoS 0; QoS 1; QoS 2; Retained; Last Will; Keep Alive; MQTT v5 Properties
- **MQTT-SN** — Gateway Discovery; Topic Registration; Publish; Subscribe; Sensor Session
- **CoAP** — CON; NON; ACK; RST; GET; POST; PUT; DELETE; Token; Options; Resources; Observe

### 7.7 Real-Time Media (2 protokol)

- **RTP** — Sequence; Timestamp; SSRC; Payload Type; Packet Loss; Jitter
- **RTCP** — Sender Report; Receiver Report; Packet Loss; Jitter; RTP↔NTP Mapping

### 7.8 File & Terminal (3 protokol)

- **TFTP** — RRQ; WRQ; DATA; ACK; ERROR; Block Transfer; Retries
- **FTP** — Control Session; Commands; Responses; Active; Passive; Transfer Timeline
- **Telnet** — Text Stream; IAC; WILL; WONT; DO; DONT; Subnegotiation

**Domain 7 toplamı: 5 + 4 + 2 + 3 + 4 + 5 + 2 + 3 = 28 protokol**

---

## 8. WIRELESS & IoT

Aileler: Bluetooth LE, Mesh & Smart Home, LoRa/LPWAN, Wi-Fi Wireless, Custom RF, Wireless Metering, IoT Messaging, Cellular IoT.

### 8.1 Bluetooth LE (2 protokol)

- **BLE Advertisement** — Device Scanner; Advertising Channels; PDU Type; Address; AD Structures; Flags; Name; UUID; Manufacturer Data; Service Data; RSSI; Advertisement Rate; Privacy/Address Rotation
- **BLE GATT** — Services; Characteristics; Descriptors; Handles; UUIDs; Properties; Read; Write; Notification; Indication; CCCD; Custom Schema

### 8.2 Mesh & Smart Home (3 protokol)

- **Zigbee** — Network Graph; Coordinator; Router; End Device; MAC; NWK; APS; ZCL; Endpoints; Clusters; Attributes; Commands; Join; Security
- **Thread** — Leader; Router; End Device; Sleepy End Device; Border Router; IPv6; 6LoWPAN; MLE; Fragmentation; Topology
- **Matter** — Node; Fabric; Endpoint; Cluster; Attribute; Command; Event; Read; Write; Subscribe; Invoke; Commissioning; Sessions; Security; TLV

### 8.3 LoRa / LPWAN (2 protokol)

- **LoRa** — Frequency; Bandwidth; Spreading Factor; Coding Rate; Preamble; RSSI; SNR; Symbol Time; Data Rate; Time on Air; Link Budget; Airtime Calculator
- **LoRaWAN** — Device; Gateway; Network Server; MHDR; DevAddr; Frame Counter; MIC; OTAA; ABP; Class A; Class B; Class C; ADR; Regional Parameters; Duty Cycle

### 8.4 Wi-Fi Wireless (2 protokol)

- **Wi-Fi** *(Wi-Fi Frame Analyzer)* — Management Frames; Control Frames; Data Frames; Beacon; Probe; Authentication; Association; Information Elements; BSSID; RSSI; Channel; Retry; Connection Timeline
- **ESP-NOW** — Action Frame; Espressif OUI; Peer; Unicast; Broadcast; Payload; ESP-NOW v1; ESP-NOW v2; Security; Device Graph

### 8.5 Custom RF (1 protokol)

- **RF Telemetry Custom Frame** — Preamble; Sync Word; Device ID; Packet Type; Sequence; Length; Payload; CRC; Whitening; Manchester; Unknown RF Analyzer

### 8.6 Wireless Metering (1 protokol)

- **Wireless M-Bus** — RF Mode; Device Identity; Telegram; Meter Records; Security; Encryption; Meter Dashboard

### 8.7 IoT Messaging (2 protokol)

*Parser Network & Ethernet kategorisindeki aynı engine'i kullanmalı; burada sadece IoT-oriented ekranlar eklenir.*

- **MQTT** — Device Clients; Topic Tree; Sensor Payloads; Publish Rate; Device Health
- **CoAP** — Resource Tree; Sensor Resources; Observe; Device Health

### 8.8 Cellular IoT (3 protokol)

- **NB-IoT** — SIM; Registration; Operator; Cell; Signal; RSRP; RSRQ; SINR; PSM; eDRX; PDP/PDN; Socket; Connection Timeline
- **LTE Modem AT** — AT Console; Command Parser; Response; URC; SIM; Network Registration; Signal; Data Session; Socket; SMS; Errors; Boot Timeline
- **GNSS Modem** — GNSS Control; GNSS Status; NMEA; Position; Fix; Satellites; TTFF; Fix Loss

**Domain 8 toplamı: 2 + 3 + 2 + 2 + 1 + 1 + 2 + 3 = 16 protokol**

---

## TOPLAM PROTOKOL SAYISI

| Domain | Aile sayısı | Protokol sayısı |
|---|---|---|
| 1. Interfaces & Framing | 5 | 40 |
| 2. Industrial Automation | 8 | 25 |
| 3. Automotive | 7 | 25 |
| 4. Marine & Navigation | 5 | 11 |
| 5. Aerospace & UAV | 6 | 16 |
| 6. Building Automation | 7 | 11 |
| 7. Network & Ethernet | 8 | 28 |
| 8. Wireless & IoT | 8 | 16 |
| **TOPLAM** | **54** | **172** |

*(Not: 172 rakamı taksonomi ağaçlarındaki yaprak protokol/arayüz adı sayısıdır; domain'ler arası kasıtlı tekrarlar — CANopen, Modbus RTU/TCP, M-Bus/Wireless M-Bus, MQTT, CoAP, RTCM, NMEA, HDLC vb. — dahil edilmiştir çünkü doküman bunları farklı domain sayfalarında ayrı workspace olarak sunuyor. Bkz. Dikkat çekenler.)*

---

## ORTAK PROTOKOL SAYFASI YAPISI

Bütün protokollerde birebir aynı sekmeler görünmemeli; ama mümkün olan protokollerde ortak workspace düzeni şu olmalıdır:

```
Protocol Page

Overview
├── Protocol Summary
├── Layer
├── Topology
├── Common Uses
└── Related Protocols

Live
├── Connection
├── Capture
├── RX / TX
└── Statistics

Decode
├── Raw
├── HEX
├── Binary
├── Fields
├── Protocol Tree
└── Validation

Build / Send
├── Packet Builder
├── Encoder
├── Send
└── Templates

Timing
├── Frame Time
├── Message Rate
├── Bus Load
├── Latency
└── Jitter

Data
├── Signals
├── Registers
├── Objects
├── Parameters
└── Physical Values

Diagnostics
├── Errors
├── Warnings
├── Timeouts
├── Sequence Problems
└── Statistics

Definitions
├── DBC
├── EDS
├── GSD
├── GSDML
├── IODD
├── A2L
├── LDF
├── SCL
├── Vendor Maps
└── Custom Schema

Examples
├── Example Frames
├── Example Transactions
└── Test Data
```

**Dinamik Definitions kuralı** — protokol sayfalarının sekmeleri **protocol capability'ye göre dinamik oluşturulmalıdır**:

- UART sayfasında `DBC` **görünmez**
- CAN sayfasında `DBC` **görünür**
- CANopen sayfasında `EDS` **görünür**
- PROFINET sayfasında `GSDML` **görünür**
- IO-Link sayfasında `IODD` **görünür**
- XCP sayfasında `A2L` **görünür**
- LIN sayfasında `LDF` **görünür**
- IEC 61850 sayfasında `SCL` **görünür**

---

## ANA SAYFADA COMMUNICATION DOMAINS GÖRÜNÜMÜ

Ana sayfada sekiz kart, bu sekiz kategori **Communication Domains** bölümünün tamamını oluşturmalıdır:

```
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│ Interfaces & Framing │  │ Industrial Automation│  │ Automotive           │  │ Marine & Navigation  │
│ UART • SPI • I²C     │  │ Modbus • PROFINET    │  │ CAN • J1939 • UDS    │  │ NMEA • AIS • RTCM    │
│ RS-485 • HDLC • AT   │  │ EtherCAT • OPC UA    │  │ LIN • DoIP • XCP     │  │ NMEA 2000 • GNSS     │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘  └──────────────────────┘

┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│ Aerospace & UAV      │  │ Building Automation  │  │ Network & Ethernet   │  │ Wireless & IoT       │
│ MAVLink • DroneCAN   │  │ BACnet • KNX • DALI  │  │ TCP/IP • HTTP • MQTT │  │ BLE • Zigbee • Matter│
│ ARINC • ADS-B        │  │ DMX • M-Bus          │  │ DNS • PTP • RTP      │  │ LoRaWAN • ESP-NOW    │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘  └──────────────────────┘
```

---

## Dikkat çekenler

1. **Belgede iki ayrı, çakışan "3.x" numaralandırma sistemi var.** (a) Erken/detaylı bölüm "3. Desteklenecek haberleşme katmanları" (satır 57) → 3.1 Fiziksel arayüzler, 3.2 Seri/frame protokolleri, 3.3 Endüstriyel, **3.4 Otomotiv protokolleri** (satır 10213), 3.5 Denizcilik, 3.6 Havacılık, 3.7 Bina otomasyonu, 3.8 Ağ/Ethernet, 3.9 Kablosuz/IoT — 8 domain'in TAMAMINI kapsayan 9 alt bölümlü teknik spesifikasyon (satır 57–37320 arası). (b) Bu taksonomi bölümündeki "3. AUTOMOTIVE" (satır 41179) kendi iç **3.1–3.7** numaralandırmasını kullanıyor (CAN Family … Calibration), sadece Automotive'e özel. Aynı "3.4" etiketi bir yerde tüm Otomotiv domain'ini, diğer yerde sadece "Legacy Diagnostics"i (K-Line/ISO 9141/ISO 14230) işaret ediyor — çapraz referans veren biri için karışıklık riski taşıyor.

2. **Protokol seti örtüşmesi tam.** Erken "3.4 Otomotiv protokolleri" bölümünde ayrı ayrı başlık alan 25 protokol (CAN 2.0A, CAN 2.0B, CAN FD, CAN XL, J1939, CANopen, LIN, FlexRay, SENT, SPC, PSI5, K-Line, ISO 9141, ISO 14230, ISO-TP, UDS, OBD-II, DoIP, Automotive Ethernet, SOME/IP, XCP on CAN, XCP on Ethernet, CCP, SAE J1850 PWM, SAE J1850 VPW) taksonomideki Domain 3'ün 25 protokolüyle isim ve kapsam olarak birebir örtüşüyor; sadece 7 aileye yeniden gruplanmış. İçerik tutarlı.

3. **Taksonomi bölümünde detay (`###`) eksik kalan Automotive protokolleri.** Erken bölümde kendi başlığı ve alan kırılımıyla (ör. Pulse Analyzer, Frame analyzer, Bit pulse view) anlatılan **SAE J1850 PWM**, **SAE J1850 VPW**, **CCP**, **K-Line**, **ISO 9141**, **ISO 14230** — bu taksonomi aralığında (40075–42975) sadece aile ağacında isim olarak geçiyor, kendi ayrı "###" alt başlıkları yok: 3.4 Legacy Diagnostics'in hiç detay bölümü yok; 3.7 Calibration'da yalnız birleşik "### XCP" var (CCP'ye ayrı yok); 3.2'de J1939/LIN/FlexRay detaylandırılmış ama SAE J1850 PWM/VPW değil. Muhtemelen taksonomi bilinçli olarak yalnız navigasyon iskeletini gösteriyor ve alan detayları erken bölümde kalıyor — ama bu, iki bölüm arasında "detay derinliği" tutarsızlığı olarak not edilmeli.

4. **CANopen iki domain'de çift listeleniyor:** hem 2.4 CIP & CAN-Based Industrial hem 3.2 Vehicle Network Protocols altında görünüyor. Erken bölümün kendi metni (satır 11155) bunu açıkça gerekçelendiriyor ("CANopen automotive dışında da yaygın... elektrikli araç, special vehicle, robotics ve auxiliary ECU sistemlerinde görülebilir") — yani hata değil, kasıtlı çapraz link. Ama toplam protokol sayımını etkiliyor (172 rakamı domain-bazlı tekrarları da içeriyor).

5. **Diğer kasıtlı paylaşım/çapraz-link noktaları** (belgenin kendi notuyla doğrulanmış, hata değil): RS-485 → Modbus RTU/ASCII, BACnet MS/TP, PROFIBUS, Custom RS-485 hızlı geçişi; Navigation Binary (UBX, RTCM) → Marine/Aerospace cross-link; Modbus Building (6.5) → Industrial Modbus (2.1) parser'ını paylaşır; GNSS & Navigation (5.6) → Marine (4.3) parser'ını paylaşır; IoT Messaging (8.7) → Network & Ethernet (7.6) engine'ini paylaşır; Metering ailesi (M-Bus/Wireless M-Bus) 3 ayrı domain'de tekrar ediyor (Industrial 2.7, Building 6.4, Wireless 8.6).

6. **Küçük isim/format tutarsızlıkları:**
   - Erken bölüm "ISO 14230 — KWP2000" yazıyor; taksonomi aile ağacı tire olmadan "ISO 14230 KWP2000" yazıyor (kozmetik).
   - 7.2 Internet Layer aile ağacında **ICMPv6** listeleniyor ama sadece IPv4/IPv6/ICMP için "###" detay var; ICMPv6'ya ayrı detay bu aralıkta yok.
   - 5.2 Distributed UAV Networks aile ağacındaki üçüncü öğe **"UAVCAN Compatibility"** — kardeşleri (DroneCAN, Cyphal) gibi bağımsız bir protokol değil, bir uyumluluk/köprü özelliği; taksonomi yaprağı olarak farklı bir kategoriye giriyor, protokol sayımında (172) yine de bir öğe olarak sayıldı.
   - 4.3 GNSS & Corrections'da **GPS NMEA** aile ağacında var ama kendi ayrı detay bölümü yok (muhtemelen NMEA 0183 decoder'ını paylaşıyor — RS-485/Modbus paylaşım deseniyle tutarlı, muhtemelen kasıtlı).
   - 7.1 Data Link aile ağacı **Ethernet II** ve **IEEE 802.3**'ü iki ayrı öğe olarak listeliyor ama detay bölümünde tek birleşik "### Ethernet" var (CAN 2.0A/2.0B ve PPM/PWM'de görülen "birleştirilmiş kardeş" deseniyle tutarlı, muhtemelen kasıtlı bir yazım kısayolu).

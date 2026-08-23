/**
 * PROFINET FrameID sınıflandırıcısı — bu ailenin DISPATCH ALANI.
 *
 * PROFINET tek bir tel biçimi DEĞİL, EtherType 0x8892'nin altında FrameID (2
 * bayt, big-endian) ile ayrışan bir AİLEdir. Gövdenin nasıl okunacağını —
 * hatta çerçevenin SONUNDA 4 baytlık APDU Status olup olmadığını — yalnız bu
 * iki bayt belirler. Bu yüzden sınıflandırma ayrı bir modüldür: `profinet.ts`
 * önce burayı çağırır, sonra gövdeye dokunur.
 *
 * ── KAYNAK UYARISI ──────────────────────────────────────────────────────────
 * PI (PROFIBUS & PROFINET International) spec'leri (IEC 61158-6-10) üyelik/ücret
 * arkasındadır ve bu depoda YOKTUR. Aralık tablosu İKİ bağımsız, kamuya açık
 * kaynaktan çapraz teyitle alındı (KOD KOPYALANMADI, yalnız format bilgisi
 * doğrulandı):
 *   1. **Wireshark PROFINET eklentisi** (GPL-2.0-or-later),
 *      `plugins/epan/profinet/packet-pn-rt.c` — `dissect_pn_rt()` içindeki
 *      FrameID kaskadı aralıkların TAMAMINI metinle birlikte verir; `packet-pn.h`
 *      DCP FrameID'lerini sabit olarak yazar (0xFEFC…0xFEFF).
 *      https://github.com/wireshark/wireshark/tree/master/plugins/epan/profinet
 *   2. **p-net** (RT-Labs AB, GPLv3/ticari çift lisans) — `src/common/pf_alarm.c`
 *      `PF_FRAME_ID_ALARM_HIGH 0xfc01` / `PF_FRAME_ID_ALARM_LOW 0xfe01`;
 *      `src/common/pf_dcp.c` `PF_DCP_HELLO_FRAME_ID 0xfefc` /
 *      `PF_DCP_GET_SET_FRAME_ID 0xfefd` / `PF_DCP_ID_REQ_FRAME_ID 0xfefe` /
 *      `PF_DCP_ID_RES_FRAME_ID 0xfeff`.
 *      https://github.com/rtlabs-com/p-net
 *
 * TEK KAYNAKLI OLDUĞU İÇİN ADLANDIRILMADI (ethercat.ts'in 0xFF/"EXT" emsali):
 * 0xFC41, 0xFE41 (alarm "with security"), 0xFE02 (RSI), 0xFE03 (SXP), 0xFE42
 * (RSI with security) yalnız Wireshark'ta geçiyor; p-net'in kümesinde YOK.
 * Bunlar `reserved` sayılır, gövdeleri ham kalır. Ayrıca "with security"
 * varyantları kripto sınırının ötesindedir: zarf açılır, doğrulama/şifre çözme
 * YAPILMAZ (CLAUDE.md "kullanıcı verisi yerelde kalır" + dalga 12 emsali).
 *
 * ── WIRESHARK'IN KENDİ KASKADINDAKİ TUTARSIZLIK ─────────────────────────────
 * `packet-pn-rt.c`de 0xFF22 dalının KOŞULU `u16FrameID <= 0xFF22` iken YORUMU
 * "0xFF22-0xFF3F: Reserved" der; sonraki dal 0xFF23-0xFF3F'i "Delay" olarak
 * etiketler. Burada YORUMDAKİ aralık esas alındı (0xFF22-0xFF3F reserved,
 * 0xFF40-0xFF43 Delay) çünkü yorum spec aralığını, koşul ise bir off-by-one'ı
 * tarif ediyor.
 *
 * ── TIME-AWARE (TSN) BELİRSİZLİĞİ — KANAL AÇILMADI ─────────────────────────
 * Wireshark 0x0100-0x3FFF bandını `isTimeAware` bayrağına göre İKİ FARKLI
 * şekilde okur (RT_CLASS_3 vs RT_CLASS_STREAM). O bayrak ÇERÇEVEDE YOKTUR:
 * `packet-pn-rt.c:718` onu `conversation_get_proto_data(...)` ile ÖNCEKİ
 * çerçevelerden kurulmuş oturum durumundan alır. Bu motor tek çerçeve çözer
 * (ethercat.ts'in "analyzer sınırı" emsali), dolayısıyla klasik (time-aware
 * OLMAYAN) okuma uygulanır ve bandın TSN profilinde başka anlama geldiği
 * `tsnAmbiguous` ile işaretlenip kullanıcıya UYARI olarak basılır.
 * `decodeOptions` kanalı AÇILMADI: kanal ancak kullanıcının BİLEBİLECEĞİ bir
 * parametre için anlamlıdır; burada bilgi tek çerçevede değil oturumdadır ve
 * uyarı doğru olanı söyler (dalga 12f'nin "kanal gereksizdi" dersi).
 */

/** FrameID'nin ait olduğu tel-biçimi sınıfı — gövde çözümü buna dallanır. */
export type ProfinetFrameClass =
  /** Döngüsel I/O: gövdenin SONUNDA APDU Status var. */
  | 'rt-cyclic'
  /** DCP (Discovery and basic Configuration Protocol) — bu motorda tam çözülür. */
  | 'dcp'
  /** Asenkron PN-IO alarmı (RTA PDU) — bu motorda tam çözülür. */
  | 'alarm'
  /** PTCP (Precision Time Control Protocol) — ayrı tel biçimi, gövde ham. */
  | 'ptcp'
  /** RT parçalama (fragmentation) çerçevesi — ayrı tel biçimi, gövde ham. */
  | 'fragmentation'
  /** Spec'in ayırdığı ya da iki kaynakta teyitlenmeyen bant — gövde ham. */
  | 'reserved';

export interface FrameIdClassification {
  readonly frameClass: ProfinetFrameClass;
  /** Aralığın kaynaklardaki adı. Protokol adları veridir, çeviriye girmez. */
  readonly label: string;
  /**
   * TRUE ise gövdenin son 4 baytı APDU Status'tur (CycleCounter + DataStatus +
   * TransferStatus) ve konumu ancak ÇERÇEVE SONUNDAN GERİ SAYILARAK bulunur.
   */
  readonly cyclic: boolean;
  /** 0x0100-0x3FFF: time-aware (TSN) profilinde bu bant başka anlama gelir. */
  readonly tsnAmbiguous: boolean;
  /** Alarm önceliği — yalnız `frameClass === 'alarm'` iken doludur. */
  readonly alarmPriority?: 'high' | 'low';
}

/** DCP FrameID'leri — iki kaynakta da bu dört sabit birebir aynı. */
export const FRAME_ID_DCP_HELLO = 0xfefc;
export const FRAME_ID_DCP_GET_SET = 0xfefd;
export const FRAME_ID_DCP_IDENTIFY_REQUEST = 0xfefe;
export const FRAME_ID_DCP_IDENTIFY_RESPONSE = 0xfeff;

/** Alarm FrameID'leri — iki kaynakta da teyitli. */
export const FRAME_ID_ALARM_HIGH = 0xfc01;
export const FRAME_ID_ALARM_LOW = 0xfe01;

/** Döngüsel çerçevenin sonundaki sabit kuyruk: 2 + 1 + 1. */
export const APDU_STATUS_LENGTH = 4;

function reserved(label: string, tsnAmbiguous = false): FrameIdClassification {
  return { frameClass: 'reserved', label, cyclic: false, tsnAmbiguous };
}

function ptcp(label: string): FrameIdClassification {
  return { frameClass: 'ptcp', label, cyclic: false, tsnAmbiguous: false };
}

function cyclic(label: string, tsnAmbiguous = false): FrameIdClassification {
  return { frameClass: 'rt-cyclic', label, cyclic: true, tsnAmbiguous };
}

/**
 * FrameID → sınıf. Sıralama ÖNEMLİdir: özel tek değerler (DCP, alarm) kendi
 * bantlarının genel "reserved" kuralından ÖNCE eşleşmelidir.
 */
export function classifyFrameId(frameId: number): FrameIdClassification {
  if (frameId === FRAME_ID_DCP_HELLO) {
    return { frameClass: 'dcp', label: 'DCP Hello', cyclic: false, tsnAmbiguous: false };
  }
  if (frameId === FRAME_ID_DCP_GET_SET) {
    return { frameClass: 'dcp', label: 'DCP Get/Set', cyclic: false, tsnAmbiguous: false };
  }
  if (frameId === FRAME_ID_DCP_IDENTIFY_REQUEST) {
    return {
      frameClass: 'dcp',
      label: 'DCP Identify multicast request',
      cyclic: false,
      tsnAmbiguous: false,
    };
  }
  if (frameId === FRAME_ID_DCP_IDENTIFY_RESPONSE) {
    return {
      frameClass: 'dcp',
      label: 'DCP Identify response',
      cyclic: false,
      tsnAmbiguous: false,
    };
  }
  if (frameId === FRAME_ID_ALARM_HIGH) {
    return {
      frameClass: 'alarm',
      label: 'Acyclic PN-IO Alarm, high priority',
      cyclic: false,
      tsnAmbiguous: false,
      alarmPriority: 'high',
    };
  }
  if (frameId === FRAME_ID_ALARM_LOW) {
    return {
      frameClass: 'alarm',
      label: 'Acyclic PN-IO Alarm, low priority',
      cyclic: false,
      tsnAmbiguous: false,
      alarmPriority: 'low',
    };
  }

  if (frameId <= 0x001f) return reserved('0x0000-0x001F: Reserved');
  if (frameId <= 0x0021) return ptcp('0x0020-0x0021: PTCP Sync (with follow up)');
  if (frameId <= 0x007f) return reserved('0x0022-0x007F: Reserved');
  if (frameId <= 0x0081) return ptcp('0x0080-0x0081: PTCP Sync (without follow up)');
  if (frameId <= 0x00ff) return reserved('0x0082-0x00FF: Reserved');
  if (frameId <= 0x06ff) {
    return cyclic('0x0100-0x06FF: RT_CLASS_3, non redundant', true);
  }
  if (frameId <= 0x0fff) {
    return cyclic('0x0700-0x0FFF: RT_CLASS_3, redundant', true);
  }
  // 0x1000-0x3FFF time-aware profilde RT_CLASS_STREAM'dir; klasik okumada ayrılmış.
  if (frameId <= 0x3fff) return reserved('0x1000-0x3FFF: Reserved', true);
  if (frameId <= 0x7fff) return reserved('0x4000-0x7FFF: Reserved');
  if (frameId <= 0xbbff) return cyclic('0x8000-0xBBFF: RT_CLASS_1, unicast');
  if (frameId <= 0xbfff) return cyclic('0xBC00-0xBFFF: RT_CLASS_1, multicast');
  if (frameId <= 0xf7ff) return cyclic('0xC000-0xF7FF: Real-Time, unicast, cyclic');
  if (frameId <= 0xfbff) return cyclic('0xF800-0xFBFF: Real-Time, multicast, cyclic');
  if (frameId <= 0xfdff) return reserved('0xFC00-0xFDFF: Reserved');
  if (frameId <= 0xfeff) return reserved('0xFE00-0xFEFF: Reserved');
  if (frameId <= 0xff01) return ptcp('0xFF00-0xFF01: PTCP Announce');
  if (frameId <= 0xff1f) return reserved('0xFF02-0xFF1F: Reserved');
  if (frameId <= 0xff21) return ptcp('0xFF20-0xFF21: PTCP Follow Up');
  if (frameId <= 0xff3f) return reserved('0xFF22-0xFF3F: Reserved');
  if (frameId <= 0xff43) return ptcp('0xFF40-0xFF43: PTCP Delay');
  if (frameId <= 0xff7f) return reserved('0xFF44-0xFF7F: Reserved');
  if (frameId <= 0xff8f) {
    return {
      frameClass: 'fragmentation',
      label: '0xFF80-0xFF8F: Real-Time fragmentation',
      cyclic: false,
      tsnAmbiguous: false,
    };
  }
  return reserved('0xFF90-0xFFFF: Reserved');
}

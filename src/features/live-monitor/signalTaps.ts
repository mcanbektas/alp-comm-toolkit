/**
 * Sinyal muslukları — çerçevenin bayt konumundan sayısal bir ölçüm okur
 * (spec §37: "Her sayısal alan grafiğe eklenebilmeli").
 *
 * Protokol motorları henüz yok (katalogdaki 172 kaydın hepsi `planned`), bu
 * yüzden alan çıkarımı genel bir musluk yapılandırmasıyla yapılıyor: konum,
 * genişlik, bayt sırası, işaret, ölçek ve ofset. Bu uydurma bir ara katman
 * değil — CAN/Modbus/J1939 sinyal tanımlarının hepsi tam olarak bu beş
 * parametreyle ifade edilir, protokol motorları geldiğinde musluklar onlardan
 * ÜRETİLEBİLİR.
 */

import { bytesToNumber, toSignedInt } from '../../protocol-core/buffers/endianness';
import { toPhysicalValue } from '../../protocol-core/buffers/physicalValue';
import {
  SIMULATED_HEADER_LENGTH,
} from '../../connection/mock/simulatedProtocol';

export const SIGNAL_BYTE_LENGTHS = [1, 2, 4] as const;
export type SignalByteLength = (typeof SIGNAL_BYTE_LENGTHS)[number];

export interface SignalTap {
  readonly id: string;
  readonly label: string;
  /** Çerçeve başından itibaren bayt konumu — çerçeve baytları başlık dahil tamamıdır. */
  readonly byteOffset: number;
  readonly byteLength: SignalByteLength;
  readonly endianness: 'big' | 'little';
  readonly signed: boolean;
  /** Fiziksel değer = ham × scale + offset. */
  readonly scale: number;
  readonly offset: number;
  readonly unit: string;
  /** Grafik rengi için tasarım token'ı adı, ör. `--series-1`. */
  readonly colorToken: string;
  /**
   * Hangi düşey eksene çizileceği. Büyüklük mertebesi farklı sinyaller (25 °C
   * ile 1500 rpm) tek eksende çizilirse küçük olanı düz çizgiye yapışır ve
   * okunamaz; ikinci eksen bunu çözer. Verilmezse sol eksen.
   */
  readonly axis?: 'left' | 'right';
}

/**
 * Musluğu okur. Çerçeve kısaysa `undefined` döner — çerçeve KISA olabilir
 * (uzunluk alanı değişken), bu bir hata değil "bu çerçevede bu sinyal yok"tur.
 */
export function readSignalValue(bytes: Uint8Array, tap: SignalTap): number | undefined {
  if (tap.byteOffset < 0 || tap.byteOffset + tap.byteLength > bytes.length) {
    return undefined;
  }
  const slice = bytes.subarray(tap.byteOffset, tap.byteOffset + tap.byteLength);
  const raw = bytesToNumber(slice, tap.endianness);
  const value = tap.signed ? toSignedInt(raw, tap.byteLength * 8) : raw;
  return toPhysicalValue(value, tap.scale, tap.offset);
}

export function readSignalValues(
  bytes: Uint8Array,
  taps: readonly SignalTap[],
): (number | undefined)[] {
  return taps.map((tap) => readSignalValue(bytes, tap));
}

/**
 * Simülasyon protokolünün muslukları. Konumlar `simulatedProtocol.ts`teki
 * payload düzeninden türetilir; başlık uzunluğu oradan içe aktarılıyor ki
 * çerçeve düzeni değişirse musluklar sessizce kaymasın.
 */
export const SIMULATED_SIGNAL_TAPS: readonly SignalTap[] = [
  {
    id: 'temperature',
    label: 'Temperature',
    byteOffset: SIMULATED_HEADER_LENGTH,
    byteLength: 2,
    endianness: 'big',
    signed: true,
    scale: 0.1,
    offset: 0,
    unit: '°C',
    colorToken: '--series-1',
    axis: 'left',
  },
  {
    id: 'voltage',
    label: 'Voltage',
    byteOffset: SIMULATED_HEADER_LENGTH + 2,
    byteLength: 2,
    endianness: 'big',
    signed: false,
    scale: 0.001,
    offset: 0,
    unit: 'V',
    colorToken: '--series-2',
    // Sıcaklıkla aynı mertebede (25 ile 12) — aynı eksende okunabilirler.
    axis: 'left',
  },
  {
    id: 'rpm',
    label: 'RPM',
    byteOffset: SIMULATED_HEADER_LENGTH + 4,
    byteLength: 2,
    endianness: 'big',
    signed: false,
    scale: 1,
    offset: 0,
    unit: 'rpm',
    colorToken: '--series-3',
    // İki mertebe büyük; sol eksende kalsaydı diğer ikisini düz çizgiye ezerdi.
    axis: 'right',
  },
];

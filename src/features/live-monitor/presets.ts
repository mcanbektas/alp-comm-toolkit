/**
 * Çerçeveleme hazır ayarları.
 *
 * Neden hazır ayar, neden tam bir çerçeveleme editörü değil: 15 yöntemin
 * tamamını (kaçış kuralları, bit doldurma, çok baytlı başlangıç dizileri…)
 * düzenletmek Custom Protocol Studio'nun işi (plan Faz 7). Monitörün ihtiyacı
 * "hattaki veriyi hemen çerçeveleyebilmek"; aşağıdaki beş ayar seri hatta
 * fiilen karşılaşılan biçimleri kapsıyor ve her biri Faz 6'nın gerçek
 * motorlarına bağlanıyor — görsel bir seçim listesi değil.
 *
 * Her ayar çerçeveleme + doğrulama + sinyal musluklarını BİRLİKTE taşır; üçü
 * birbirinden bağımsız seçilseydi (ör. SLIP + Modbus CRC) sessizce anlamsız
 * yapılandırmalar kurulabilirdi.
 */

import { SIMULATED_FRAMING_CONFIG } from '../../connection/mock/simulatedProtocol';
import type { FramingMethodConfig } from '../../protocol-core/framing/createExtractor';
import type { TranslationKey } from '../../translations';
import {
  DEFAULT_FRAME_VALIDATION,
  SIMULATED_FRAME_VALIDATION,
  type FrameValidationConfig,
} from './frameValidation';
import { SIMULATED_SIGNAL_TAPS, type SignalTap } from './signalTaps';

export interface FramingPreset {
  readonly id: string;
  readonly labelKey: TranslationKey;
  readonly framing: FramingMethodConfig;
  readonly validation: FrameValidationConfig;
  readonly taps: readonly SignalTap[];
  /** Bu ayar zaman tabanlı mı — arayüz "veri dursa da çerçeve kapanır"ı bilmeli. */
  readonly timeBased: boolean;
}

const NO_TAPS: readonly SignalTap[] = [];

const SIMULATED_PRESET: FramingPreset = {
  id: 'simulated',
  labelKey: 'monitor.framing.simulated',
  framing: SIMULATED_FRAMING_CONFIG,
  validation: SIMULATED_FRAME_VALIDATION,
  taps: SIMULATED_SIGNAL_TAPS,
  timeBased: false,
};

export const FRAMING_PRESETS: readonly FramingPreset[] = [
  SIMULATED_PRESET,
  {
    id: 'line-ending',
    labelKey: 'monitor.framing.lineEnding',
    framing: { method: 'line-ending', endSequence: [0x0d, 0x0a] },
    validation: DEFAULT_FRAME_VALIDATION,
    taps: NO_TAPS,
    timeBased: false,
  },
  {
    id: 'modbus-rtu',
    labelKey: 'monitor.framing.modbusRtu',
    // 3.5 karakterlik sessizlik: 9600 8N1'de ≈ 3.65 ms. Spec §8.4 "Modbus
    // silent interval". Baud değişirse bu süre de değişmeli — hazır ayar
    // yaygın düşük hızları kapsayan güvenli bir üst değer kullanıyor.
    framing: { method: 'modbus-silent-interval', timeoutMs: 4 },
    validation: {
      algorithm: 'CRC16_MODBUS',
      // Modbus RTU CRC'yi düşük bayt önce gönderir.
      endianness: 'little',
      trailingBytesAfterChecksum: 0,
      skipLeadingBytes: 0,
    },
    taps: NO_TAPS,
    timeBased: true,
  },
  {
    id: 'slip',
    labelKey: 'monitor.framing.slip',
    framing: { method: 'slip' },
    validation: DEFAULT_FRAME_VALIDATION,
    taps: NO_TAPS,
    timeBased: false,
  },
  {
    id: 'cobs',
    labelKey: 'monitor.framing.cobs',
    framing: { method: 'cobs' },
    validation: DEFAULT_FRAME_VALIDATION,
    taps: NO_TAPS,
    timeBased: false,
  },
];

export const DEFAULT_PRESET_ID = SIMULATED_PRESET.id;

export function findPreset(id: string): FramingPreset {
  return FRAMING_PRESETS.find((preset) => preset.id === id) ?? SIMULATED_PRESET;
}

import { create } from 'zustand';

/**
 * Protocol Converter'ın (spec §33) ürettiği bir paketi Packet Builder'a
 * taşıyan tek yönlü, GEÇİCİ köprü — `protocolSchemaStore.ts` ile aynı gerekçe
 * (Studio yazar, Builder okur; iki ekran ayrı rota, ortak React atası yok).
 *
 * KALICI DEĞİL, `uiStore.ts` ile aynı gerekçe: bekleyen bir aktarım bir kerelik
 * bir gezinme sinyalidir, yeniden yüklemeden sonra korunmayı hak etmiyor —
 * localStorage'a yazılmıyor.
 *
 * TÜKET-VE-SİL: Builder ekranı `pendingHex`i okuyup `builder.setHexOverride`e
 * uyguladıktan hemen sonra `clearPendingPacket` çağırır. Silmezse ekrana
 * sonradan dönüldüğünde (geri tuşu, sekme değişimi) ESKİ paket sessizce
 * yeniden uygulanırdı.
 */
export interface ConverterHandoffState {
  readonly pendingHex: string | null;
  /** Ekranda gösterilecek etiket (ör. MQTT topic'i) — veridir, çeviriye girmez. */
  readonly pendingLabel: string | null;
  readonly setPendingPacket: (hex: string, label: string) => void;
  readonly clearPendingPacket: () => void;
}

export const useConverterHandoffStore = create<ConverterHandoffState>()((set) => ({
  pendingHex: null,
  pendingLabel: null,
  setPendingPacket: (hex, label) => set({ pendingHex: hex, pendingLabel: label }),
  clearPendingPacket: () => set({ pendingHex: null, pendingLabel: null }),
}));

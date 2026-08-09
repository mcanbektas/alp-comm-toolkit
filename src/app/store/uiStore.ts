import { create } from 'zustand';

/**
 * Kabuğun geçici arayüz durumu. KALICI DEĞİL: burada tutulanların hiçbiri
 * yeniden yüklemeden sonra korunmayı hak etmiyor (menü açıklığı ekran
 * genişliğine, arama sorgusu o anki niyete bağlı). Kalıcı olan tek iki tercih —
 * dil ve tema — kendi provider'larında, kendi localStorage anahtarlarıyla durur.
 */

/**
 * Son ziyaret listesinin üst sınırı. Liste kenar çubuğuna sığmalı; sınırsız
 * büyürse gezinme yardımcısı olmaktan çıkıp ikinci bir katalog olur.
 */
export const MAX_RECENT_PATHS = 8;

export interface UiState {
  /**
   * Kenar çubuğu açık mı. Tek bayrak hem masaüstü daraltmasını hem mobil
   * overlay'i yönetir; kırılım noktası değişince kabuk bunu kendi
   * varsayılanına döndürür (masaüstünde açık, mobilde kapalı).
   */
  sidebarOpen: boolean;
  /** Başlıktaki global aramanın canlı sorgusu. */
  searchQuery: string;
  /** En son açılan protokollerin `"<domain>/<family>/<protocol>"` yolları, yeniden eskiye. */
  recentPaths: readonly string[];

  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSearchQuery: (query: string) => void;
  clearSearchQuery: () => void;
  /** Aynı yol tekrar açılırsa listede çoğalmaz, başa taşınır. */
  pushRecentPath: (path: string) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  // Başlangıçta kapalı: modül yüklenirken `window` ölçmek SSR ve testte
  // farklı sonuç verirdi. Masaüstünde açılma kararını kabuk, kırılım
  // noktasını izleyerek mount'ta veriyor.
  sidebarOpen: false,
  searchQuery: '',
  recentPaths: [],

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSearchQuery: (query) => set({ searchQuery: query }),
  clearSearchQuery: () => set({ searchQuery: '' }),

  pushRecentPath: (path) =>
    set((state) => {
      // Aynı yol zaten baştaysa yeni dizi üretme: protokol sayfası her
      // render'da bunu çağırabiliyor, kimliği korumak gereksiz abonelik
      // uyandırmalarını (ve sonsuz effect döngüsünü) engelliyor.
      if (state.recentPaths[0] === path) return state;
      const withoutDuplicate = state.recentPaths.filter((existing) => existing !== path);
      return { recentPaths: [path, ...withoutDuplicate].slice(0, MAX_RECENT_PATHS) };
    }),
}));

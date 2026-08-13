import { lazy, Suspense } from 'react';
import type { ReactElement } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { AppShell } from '@/components/layout/AppShell';
import { CalculatorPage } from '@/pages/CalculatorPage';
import { CalculatorsPage } from '@/pages/CalculatorsPage';
import { DomainPage } from '@/pages/DomainPage';
import { FamilyPage } from '@/pages/FamilyPage';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProtocolPage } from '@/pages/ProtocolPage';

/**
 * Canlı monitör TEMBEL yüklenir: grafik kütüphanesi ana paketin yarısından
 * fazlasını tutuyor ve monitöre hiç girmeyen kullanıcı onu indirmemeli. Aynı
 * gerekçe protokol kayıt defterinin lazy olmasının gerekçesiyle bir (bkz.
 * `registry.ts`).
 */
const LiveMonitorPage = lazy(async () => {
  const module = await import('@/pages/LiveMonitorPage');
  return { default: module.LiveMonitorPage };
});

function LazyFallback(): ReactElement {
  const { t } = useTranslation();
  return <p className="p-4 text-sm text-muted">{t('common.loading')}</p>;
}

/**
 * Rota ağacı router'dan AYRI dışa verilir: testler `MemoryRouter` ile aynı
 * ağacı bağlar, uygulama `BrowserRouter` ile. Router'ı buraya gömmek testleri
 * gerçek adres çubuğuna bağımlı kılardı.
 *
 * Kabuk (`AppShell`) düzen rotasıdır; sayfalar `<Outlet/>` içine girer, böylece
 * gezinmede başlık ve kenar çubuğu yeniden mount edilmez.
 */
export function AppRoutes(): ReactElement {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="calculators" element={<CalculatorsPage />} />
        <Route path="calculators/:toolId" element={<CalculatorPage />} />
        {/* Sabit rotalar `:domainId` yakalayıcısından ÖNCE gruplanır — RRv7 statik
            segmenti dinamikten üstün sıralar, ama sıra bozulursa hata değil
            sessiz yanlış eşleşme olur. */}
        <Route
          path="live-monitor"
          element={
            <Suspense fallback={<LazyFallback />}>
              <LiveMonitorPage />
            </Suspense>
          }
        />
        <Route path=":domainId" element={<DomainPage />} />
        <Route path=":domainId/:familyId" element={<FamilyPage />} />
        <Route path=":domainId/:familyId/:protocolId" element={<ProtocolPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export function AppRouter(): ReactElement {
  return (
    // `basename` Vite'ın `BASE_URL`inden gelir: Faz 4'te uygulama `/comm` altına
    // taşınınca rotalar yeniden yazılmadan kayar. Sabit '/' yazmak o taşımada
    // her bağlantıyı kırardı.
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AppRoutes />
    </BrowserRouter>
  );
}

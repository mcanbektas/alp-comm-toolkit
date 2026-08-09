import type { ReactElement } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { DomainPage } from '@/pages/DomainPage';
import { FamilyPage } from '@/pages/FamilyPage';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProtocolPage } from '@/pages/ProtocolPage';

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

import { lazy, Suspense } from 'react';
import type { ReactElement } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { detectInitialLanguage, useTranslation } from '@/app/providers/LanguageProvider';
import { loadProtocolStrings } from '@/translations';
import { AppShell } from '@/components/layout/AppShell';
import { CalculatorPage } from '@/pages/CalculatorPage';
import { CalculatorsPage } from '@/pages/CalculatorsPage';
import { DomainPage } from '@/pages/DomainPage';
import { FamilyPage } from '@/pages/FamilyPage';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';

/**
 * Canlı monitör TEMBEL yüklenir: grafik kütüphanesi ana paketin yarısından
 * fazlasını tutuyor ve monitöre hiç girmeyen kullanıcı onu indirmemeli. Aynı
 * gerekçe protokol kayıt defterinin lazy olmasının gerekçesiyle bir (bkz.
 * `registry.ts`).
 */
/**
 * `protocol.*` metinleri KENDİ CHUNK'INDA (bkz. `translations/trProtocols.ts`)
 * ve yalnız parser çıktısı basan ekranlarda okunuyor. Yükleme o ekranların LAZY
 * SINIRINA bağlandı: sayfa inerken sözlük de iner, böylece ekranda ham anahtar
 * görünen bir aralık oluşmaz.
 *
 * Dil, sayfa inerken KAYITLI TERCİHTEN okunuyor; sonradan değiştirilirse yeni
 * dilin namespace'ini `loadDictionary` peşinden getiriyor (`translations/
 * index.ts`) — rota sınırı ikinci kez koşmadığı için o yol gerekli.
 */
async function withProtocolStrings<T>(load: Promise<T>): Promise<T> {
  const [module] = await Promise.all([load, loadProtocolStrings(detectInitialLanguage())]);
  return module;
}

const ProtocolPage = lazy(async () => {
  const module = await withProtocolStrings(import('@/pages/ProtocolPage'));
  return { default: module.ProtocolPage };
});

const LiveMonitorPage = lazy(async () => {
  const module = await withProtocolStrings(import('@/pages/LiveMonitorPage'));
  return { default: module.LiveMonitorPage };
});

/**
 * Studio ve Packet Builder de TEMBEL: ikisi de `schemas/protocolSchema` üzerinden
 * zod'u DEĞER olarak çeker (ölçüldü: ana paket 239 → 309 kB). Protokol tanımıyla
 * hiç uğraşmayan kullanıcı o 70 kB'ı indirmemeli — `protocol-core/index.ts`
 * barrel'ının zod'u dışarıda tutma gerekçesiyle aynı.
 */
const ProtocolStudioPage = lazy(async () => {
  const module = await import('@/pages/ProtocolStudioPage');
  return { default: module.ProtocolStudioPage };
});

const PacketBuilderPage = lazy(async () => {
  const module = await import('@/pages/PacketBuilderPage');
  return { default: module.PacketBuilderPage };
});

const LogAnalyzerPage = lazy(async () => {
  const module = await withProtocolStrings(import('@/pages/LogAnalyzerPage'));
  return { default: module.LogAnalyzerPage };
});

/**
 * Bilinmeyen protokol analizi de TEMBEL: on analiz motoru, sanallaştırılmış
 * sütun tablosu ve kendi Worker'ı ana pakete binmemeli — Log Analyzer ile aynı
 * gerekçe.
 */
const ReverseEngineeringPage = lazy(async () => {
  const module = await withProtocolStrings(import('@/pages/ReverseEngineeringPage'));
  return { default: module.ReverseEngineeringPage };
});

const TestAutomationPage = lazy(async () => {
  const module = await import('@/pages/TestAutomationPage');
  return { default: module.TestAutomationPage };
});

/**
 * Protocol Converter da TEMBEL: kaynak motoru kullanıcının seçimine göre
 * iniyor, ekranın kendisi de ana pakete binmemeli (öteki araçlarla aynı
 * gerekçe).
 */
const ProtocolConverterPage = lazy(async () => {
  const module = await withProtocolStrings(import('@/pages/ProtocolConverterPage'));
  return { default: module.ProtocolConverterPage };
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
        <Route
          path="protocol-studio"
          element={
            <Suspense fallback={<LazyFallback />}>
              <ProtocolStudioPage />
            </Suspense>
          }
        />
        <Route
          path="packet-builder"
          element={
            <Suspense fallback={<LazyFallback />}>
              <PacketBuilderPage />
            </Suspense>
          }
        />
        <Route
          path="log-analyzer"
          element={
            <Suspense fallback={<LazyFallback />}>
              <LogAnalyzerPage />
            </Suspense>
          }
        />
        <Route
          path="reverse-engineering"
          element={
            <Suspense fallback={<LazyFallback />}>
              <ReverseEngineeringPage />
            </Suspense>
          }
        />
        <Route
          path="test-automation"
          element={
            <Suspense fallback={<LazyFallback />}>
              <TestAutomationPage />
            </Suspense>
          }
        />
        <Route
          path="protocol-converter"
          element={
            <Suspense fallback={<LazyFallback />}>
              <ProtocolConverterPage />
            </Suspense>
          }
        />
        <Route path=":domainId" element={<DomainPage />} />
        <Route path=":domainId/:familyId" element={<FamilyPage />} />
        <Route
          path=":domainId/:familyId/:protocolId"
          element={
            <Suspense fallback={<LazyFallback />}>
              <ProtocolPage />
            </Suspense>
          }
        />
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

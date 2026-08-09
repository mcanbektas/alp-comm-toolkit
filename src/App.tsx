import type { ReactElement } from 'react';

import { LanguageProvider } from '@/app/providers/LanguageProvider';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { AppRouter } from '@/app/router/AppRouter';

/**
 * Sağlayıcı sırası: tema en dışta, çünkü dilden bağımsız ve `<html>`
 * attribute'unu ilk boyada ayarlaması gerekiyor. Router en içte — gezinme
 * hiçbir sağlayıcıyı yeniden mount etmemeli.
 */
export function App(): ReactElement {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppRouter />
      </LanguageProvider>
    </ThemeProvider>
  );
}

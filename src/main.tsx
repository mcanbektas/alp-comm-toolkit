import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { registerBuiltInProtocols } from './protocols';
import './styles/index.css';

// Kayıt React ağacının DIŞINDA: defter bir modül seviyesi tekildir, bileşen
// yaşam döngüsüne bağlı değildir. Provider/efekt içine konsaydı StrictMode'un
// çift koşusu ve her yeniden bağlanma kaydı tekrarlardı; üstelik ilk render
// sırasında okuyan bir bileşen defteri boş bulurdu. Loader'lar kayıtta
// çalışmadığı için maliyeti üç Map yazımıdır.
registerBuiltInProtocols();

const container = document.getElementById('root');
if (container === null) {
  // Sessiz boş sayfa yerine gürültülü hata: kök düğüm yoksa index.html bozulmuştur.
  throw new Error('Root element #root not found in index.html.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

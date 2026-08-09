import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import './styles/index.css';

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

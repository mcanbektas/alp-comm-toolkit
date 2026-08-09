import { Component } from 'react';
import type { ErrorInfo, ReactElement, ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';

/**
 * Render hatasını yakalayıp uygulamayı beyaz ekrana düşmekten korur.
 * Spec §47: "hatalı veride uygulamayı çökertme" — bozuk bir protokol kaydı ya da
 * beklenmedik bir bayt dizisi tek bir sayfayı düşürebilir, tüm SPA'yı değil.
 *
 * Sınıf bileşeni olmak zorunda: React'te `componentDidCatch`in hook karşılığı yok.
 * Görünen metin çeviriden gelmeli ama sınıf bileşeni hook çağıramaz — bu yüzden
 * gövde ayrı bir fonksiyon bileşenine (`ErrorFallback`) taşındı.
 */

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Değeri değişince sınır sıfırlanır. Rota yolu verilirse gezinme hatayı temizler. */
  resetKey?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function ErrorFallback({ error, onRetry }: { error: Error; onRetry: () => void }): ReactElement {
  const { t } = useTranslation();

  return (
    <div role="alert" className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="font-display text-xl font-semibold text-text">{t('error.title')}</h1>
      <p className="mt-2 text-sm text-muted">{t('error.body')}</p>

      {/* Teknik ayrıntı gizli değil ama öne de çıkmıyor: kullanıcıyı korkutmadan
          hata raporuna kopyalanabilsin. */}
      <pre className="mt-4 overflow-x-auto rounded-token-sm border border-line bg-surface p-3 font-mono text-xs text-muted">
        {error.message}
      </pre>

      <button
        type="button"
        onClick={onRetry}
        className="mt-6 rounded-token-sm bg-accent px-4 py-2 text-sm font-medium text-on-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
      >
        {t('error.retry')}
      </button>
    </div>
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidUpdate(previous: ErrorBoundaryProps): void {
    // Hata bir sayfaya özgüyse gezinme onu temizlemeli; yoksa kullanıcı
    // "yeniden dene"ye basmadan hiçbir yere gidemez.
    if (this.state.error !== null && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Uzak bir hata toplayıcıya GÖNDERİLMEZ (spec §41: veri yerelde kalır).
    // Konsol, geliştiricinin bileşen yığınını görebildiği tek yer.
    console.error('ErrorBoundary yakaladı:', error, info.componentStack);
  }

  private readonly handleRetry = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (error !== null) {
      return <ErrorFallback error={error} onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

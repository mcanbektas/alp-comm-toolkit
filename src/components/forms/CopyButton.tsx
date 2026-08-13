import type { ReactElement } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { useClipboard } from './useClipboard';

export interface CopyButtonProps {
  value: string;
  disabled?: boolean;
}

export function CopyButton({ value, disabled = false }: CopyButtonProps): ReactElement {
  const { t } = useTranslation();
  const { status, copy } = useClipboard();

  const label = status === 'copied' ? t('common.copied') : status === 'failed' ? t('common.copyFailed') : t('common.copy');

  return (
    <button
      type="button"
      disabled={disabled || value.length === 0}
      onClick={() => {
        void copy(value);
      }}
      className="shrink-0 rounded-token-sm border border-line bg-raised px-2 py-1 text-xs text-text hover:border-line-strong hover:text-accent focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}

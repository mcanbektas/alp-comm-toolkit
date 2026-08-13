import type { ReactElement } from 'react';

import { CopyButton } from './CopyButton';

export interface ResultFieldProps {
  id: string;
  label: string;
  value: string;
  error?: string;
  monospace?: boolean;
}

/** Salt-okunur hesap çıktısı — kopyalama düğmesi gömülü. Girdi alanları için `TextField`. */
export function ResultField({ id, label, value, error, monospace = true }: ResultFieldProps): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      <div className="flex items-start gap-2">
        <output
          id={id}
          className={`min-h-[2.25rem] flex-1 whitespace-pre-wrap break-all rounded-token-sm border border-line bg-raised px-2 py-1.5 text-sm text-text ${
            monospace ? 'font-mono' : ''
          }`}
        >
          {error === undefined ? value : ''}
        </output>
        <CopyButton value={value} disabled={error !== undefined} />
      </div>
      {error !== undefined && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

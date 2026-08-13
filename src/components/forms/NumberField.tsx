import type { ChangeEvent, ReactElement } from 'react';

export interface NumberFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  step?: number;
  suffix?: string;
}

/**
 * Değer bilerek `string` tutulur (`number` değil): kullanıcı "1." ya da boş
 * girdi yazarken ara durumu kaybetmeden gösterebilmek için — sayısal ayrıştırma
 * çağıranın işi (`Number(value)`/`Number.parseFloat`).
 */
export function NumberField({ id, label, value, onChange, placeholder, error, step, suffix }: NumberFieldProps): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
        {suffix !== undefined && <span className="text-muted"> ({suffix})</span>}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange(event.target.value);
        }}
        placeholder={placeholder}
        className={`w-full rounded-token-sm border bg-surface px-2 py-1.5 text-sm text-text placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          error !== undefined ? 'border-danger' : 'border-line'
        }`}
      />
      {error !== undefined && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

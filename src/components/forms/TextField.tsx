import type { ChangeEvent, ReactElement } from 'react';

export interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  monospace?: boolean;
  multiline?: boolean;
}

/** Serbest metin/hex girdisi — sayı alanları için `NumberField`, seçim için `SelectField`. */
export function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
  monospace = false,
  multiline = false,
}: TextFieldProps): ReactElement {
  const inputClass = `w-full rounded-token-sm border bg-surface px-2 py-1.5 text-sm text-text placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
    error !== undefined ? 'border-danger' : 'border-line'
  } ${monospace ? 'font-mono' : ''}`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
            onChange(event.target.value);
          }}
          placeholder={placeholder}
          rows={3}
          className={inputClass}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            onChange(event.target.value);
          }}
          placeholder={placeholder}
          className={inputClass}
        />
      )}
      {error !== undefined && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

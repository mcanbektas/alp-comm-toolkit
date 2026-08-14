import type { ChangeEvent, ReactElement } from 'react';

export interface CheckboxFieldProps {
  readonly id: string;
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly description?: string;
  readonly disabled?: boolean;
}

/**
 * Görünen her metin dışarıdan gelir; primitif çeviri sözlüğüne bakmaz.
 *
 * Gerçek `<input type="checkbox">` kullanılır (div + rol taklidi değil): klavye,
 * ekran okuyucu ve form sıfırlama davranışını tarayıcıdan bedavaya alır.
 */
export function CheckboxField({
  id,
  label,
  checked,
  onChange,
  description,
  disabled = false,
}: CheckboxFieldProps): ReactElement {
  // aria-describedby yalnız gerçekten var olan bir düğümü göstermeli; yoksa
  // ekran okuyucu boş bir referans okumaya çalışır.
  const descriptionId = `${id}-description`;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-describedby={description !== undefined ? descriptionId : undefined}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            onChange(event.target.checked);
          }}
          className="mt-0.5 size-4 shrink-0 rounded-token-sm border border-line bg-surface accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
        />
        <label
          htmlFor={id}
          className={`text-xs font-medium ${disabled ? 'cursor-not-allowed text-muted opacity-50' : 'cursor-pointer text-text'}`}
        >
          {label}
        </label>
      </div>
      {description !== undefined && (
        <p id={descriptionId} className="pl-6 text-xs text-muted">
          {description}
        </p>
      )}
    </div>
  );
}

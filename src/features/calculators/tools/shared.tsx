import type { ReactElement } from 'react';

/**
 * Hesap araçlarının ortak sunum parçaları. `timingTools.tsx` içinde doğmuşlardı;
 * ikinci kullanıcı (`loraTools.tsx`) gelince kopyalamak yerine buraya alındı —
 * sonuç tablosunun hizası ve saniye biçimlemesi araçlar arasında AYNI kalmalı,
 * iki kopya sessizce ayrışır.
 */

/** Sayısal hesap çıktıları için ortak tablo — bu ekranlarda kopyalama gerekmez, sonuçlar okunur/karşılaştırılır. */
export function StatTable({ rows }: { rows: ReadonlyArray<readonly [string, string]> }): ReactElement {
  return (
    <div className="overflow-x-auto rounded-token border border-line">
      <table className="w-full text-left text-sm tabular">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-line last:border-0">
              <th scope="row" className="px-3 py-2 font-normal text-muted">
                {label}
              </th>
              <td className="px-3 py-2 font-mono font-medium text-text">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ErrorNotice({ message }: { message: string }): ReactElement {
  return <p className="text-xs text-danger">{message}</p>;
}

/** Büyüklüğe göre ns/µs/ms/s seçer — LoRa ToA'sı ms, UART biti ns mertebesindedir. */
export function formatSeconds(value: number): string {
  if (value < 1e-6) return `${(value * 1e9).toFixed(2)} ns`;
  if (value < 1e-3) return `${(value * 1e6).toFixed(2)} µs`;
  if (value < 1) return `${(value * 1e3).toFixed(3)} ms`;
  return `${value.toFixed(6)} s`;
}

export function SectionSwitch<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
}): ReactElement {
  return (
    <div role="group" className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => {
            onChange(option.value);
          }}
          className={`rounded-token-sm border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-accent ${
            value === option.value
              ? 'border-accent bg-accent-soft font-medium text-accent-strong'
              : 'border-line text-muted hover:text-text'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CheckboxField } from './CheckboxField';

describe('CheckboxField', () => {
  it('binds the label to a real checkbox input', () => {
    render(<CheckboxField id="crc-append" label="Append CRC" checked={false} onChange={vi.fn()} />);

    const input = screen.getByLabelText('Append CRC');

    expect(input).toHaveAttribute('type', 'checkbox');
    expect(input).toHaveAttribute('id', 'crc-append');
  });

  it('reflects the checked prop', () => {
    render(<CheckboxField id="crc-append" label="Append CRC" checked onChange={vi.fn()} />);

    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('reflects the unchecked prop', () => {
    render(<CheckboxField id="crc-append" label="Append CRC" checked={false} onChange={vi.fn()} />);

    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('reports true when an unchecked box is clicked', () => {
    const onChange = vi.fn();
    render(<CheckboxField id="crc-append" label="Append CRC" checked={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole('checkbox'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('reports false when a checked box is clicked', () => {
    const onChange = vi.fn();
    render(<CheckboxField id="crc-append" label="Append CRC" checked onChange={onChange} />);

    fireEvent.click(screen.getByRole('checkbox'));

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('describes the input with the description text', () => {
    render(
      <CheckboxField
        id="crc-append"
        label="Append CRC"
        checked={false}
        onChange={vi.fn()}
        description="Two bytes are added to the frame tail."
      />,
    );

    expect(screen.getByRole('checkbox')).toHaveAccessibleDescription(
      'Two bytes are added to the frame tail.',
    );
  });

  it('leaves aria-describedby off when no description is given', () => {
    render(<CheckboxField id="crc-append" label="Append CRC" checked={false} onChange={vi.fn()} />);

    expect(screen.getByRole('checkbox')).not.toHaveAttribute('aria-describedby');
  });

  it('shows the description text next to the box', () => {
    render(
      <CheckboxField
        id="crc-append"
        label="Append CRC"
        checked={false}
        onChange={vi.fn()}
        description="Two bytes are added to the frame tail."
      />,
    );

    expect(screen.getByText('Two bytes are added to the frame tail.')).toBeInTheDocument();
  });

  // Etkileşimin engellenmesi native `disabled`a bırakılmıştır; jsdom disabled bir
  // input'a gönderilen sentetik click'i yine de işlediği için burada yalnız
  // niteliğin taşındığı doğrulanabilir, tarayıcı davranışı değil.
  it('marks the input as disabled', () => {
    render(
      <CheckboxField id="crc-append" label="Append CRC" checked={false} onChange={vi.fn()} disabled />,
    );

    expect(screen.getByRole('checkbox')).toBeDisabled();
  });
});

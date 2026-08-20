import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { LANGUAGE_STORAGE_KEY, LanguageProvider } from '@/app/providers/LanguageProvider';

import { CellularInitializationDashboard } from './CellularInitializationDashboard';

/**
 * `DecodePanel.test.tsx`la aynı disiplin: motor SAHTELENMEDİ (`vi.mock` yok).
 * `lteModemAtParser`/`createCellularInitializationState` zaten 9c'de test
 * edilmiş gerçek motor — burada sınanan panelin girdi→snapshot köprüsüdür.
 */

function renderDashboard(): void {
  render(
    <LanguageProvider>
      <CellularInitializationDashboard />
    </LanguageProvider>,
  );
}

function fieldValue(fieldId: string): string {
  const field = screen
    .getAllByTestId('cellular-dashboard-field')
    .find((candidate) => candidate.dataset['fieldId'] === fieldId);
  if (field === undefined) throw new Error(`Alan yok: ${fieldId}`);
  return field.querySelector('dd')?.textContent ?? '';
}

function sessionInput(): HTMLTextAreaElement {
  const node = screen.getByLabelText(/AT oturumu/);
  if (!(node instanceof HTMLTextAreaElement)) {
    throw new Error('Oturum girdisi bir textarea değil');
  }
  return node;
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'tr');
});

describe('CellularInitializationDashboard default session', () => {
  it('never opens empty: the default AT session is preloaded and parsed', () => {
    renderDashboard();
    expect(screen.getByTestId('cellular-dashboard-summary')).toBeInTheDocument();
    expect(screen.queryByTestId('cellular-dashboard-empty')).not.toBeInTheDocument();
  });

  it('reads IMEI from the prefixed AT+CGSN=1 response, not the bare-numeric field', () => {
    renderDashboard();
    expect(fieldValue('imei')).toBe('490154203237518');
    expect(fieldValue('numericIdentifierCandidate')).toBe('—');
  });

  it('accumulates fields from separate AT transactions into one snapshot', () => {
    renderDashboard();
    expect(fieldValue('simStatus')).toBe('READY');
    expect(fieldValue('operatorName')).toBe('Example Operator');
    expect(fieldValue('operatorSelectionMode')).toBe('automatic');
    expect(fieldValue('accessTechnology')).toBe('E-UTRAN');
    expect(fieldValue('registrationStatus')).toBe('registered, home network');
    expect(fieldValue('pdpAddress')).toBe('10.45.12.8');
  });

  it('counts every recognized line, including echoes and final result codes', () => {
    renderDashboard();
    expect(screen.getByTestId('cellular-dashboard-line-count')).toHaveTextContent('15');
  });
});

describe('CellularInitializationDashboard reactivity', () => {
  it('recomputes the snapshot from scratch when the session text changes', () => {
    renderDashboard();
    fireEvent.change(sessionInput(), {
      target: { value: 'AT+CPIN?\n+CPIN: SIM PIN\nOK' },
    });

    expect(fieldValue('simStatus')).toBe('SIM PIN');
    // Önceki oturumdan kalan IMEI YOK: sıfırdan hesaplama, sızıntı yapmaz.
    expect(fieldValue('imei')).toBe('—');
  });

  it('shows the empty state when the session has no recognizable field', () => {
    renderDashboard();
    fireEvent.change(sessionInput(), { target: { value: '' } });

    expect(screen.getByTestId('cellular-dashboard-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('cellular-dashboard-summary')).not.toBeInTheDocument();
    expect(screen.getByTestId('cellular-dashboard-line-count')).toHaveTextContent('0');
  });

  it('skips unparseable lines instead of crashing the panel', () => {
    renderDashboard();
    fireEvent.change(sessionInput(), {
      target: { value: 'AT+CPIN?\n+CPIN: READY\nOK\n\n   \nthis is not an AT line at all but plain prose' },
    });

    expect(fieldValue('simStatus')).toBe('READY');
  });
});

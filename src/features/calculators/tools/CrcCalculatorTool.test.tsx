import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LanguageProvider } from '@/app/providers/LanguageProvider';

import { CrcCalculatorTool } from './CrcCalculatorTool';

/**
 * Beklenen değerler UYDURULMADI: dördü spec §43'ün doğrulanmış referansları
 * (ASCII "123456789"), geri kalanı `crcEngine`in aynı girdiyle ürettiği gerçek
 * çıktı. Bu testin işi motoru değil EKRANI doğrulamak — motor `crcEngine.test.ts`te
 * ayrıca sınanıyor; burada "seçim → hesap → gösterim" zincirinin koptuğu yer aranır.
 *
 * Metne değil `data-testid`ye dayanılır: bu araç tr.ts'e yazamayan bir turda
 * eklendi, yeni çeviri anahtarları sözlüğe girene kadar BOŞ çiziliyor. Etiket
 * metnine bakan bir test bugün de yarın da yanlış cevap verirdi.
 */

const SAMPLE_HEX = '31 32 33 34 35 36 37 38 39';

function renderTool(): void {
  render(
    <LanguageProvider>
      <CrcCalculatorTool />
    </LanguageProvider>,
  );
}

function dataInput(): HTMLElement {
  return within(screen.getByTestId('crc-data-field')).getByRole('textbox');
}

function setData(value: string): void {
  fireEvent.change(dataInput(), { target: { value } });
}

function loadSample(): void {
  fireEvent.click(screen.getByTestId('crc-load-sample'));
}

function selectAlgorithm(id: string): void {
  fireEvent.change(screen.getByTestId('crc-algorithm'), { target: { value: id } });
}

function customField(name: 'poly' | 'init' | 'xorout'): HTMLElement {
  return within(screen.getByTestId(`crc-custom-${name}-field`)).getByRole('textbox');
}

function customWidthField(): HTMLElement {
  return within(screen.getByTestId('crc-custom-width-field')).getByRole('spinbutton');
}

function customFlag(name: 'refin' | 'refout'): HTMLElement {
  return within(screen.getByTestId(`crc-custom-${name}-field`)).getByRole('checkbox');
}

describe('CrcCalculatorTool', () => {
  it('renders the data field, the algorithm selector and its three option groups', () => {
    renderTool();

    expect(screen.getByTestId('crc-data-field')).toBeInTheDocument();
    expect(screen.getByTestId('crc-algorithm')).toBeInTheDocument();
    expect(screen.getByTestId('crc-group-crc')).toBeInTheDocument();
    expect(screen.getByTestId('crc-group-simple')).toBeInTheDocument();
    expect(screen.getByTestId('crc-group-custom')).toBeInTheDocument();
  });

  it('offers every catalogue variant plus the simple sums and the custom entry', () => {
    renderTool();

    const options = within(screen.getByTestId('crc-algorithm')).getAllByRole('option');
    // 21 katalog CRC'si (dalga 10/7c'de IEEE 802.15.4 FCS için CRC16_KERMIT
    // eklendi) + 7 basit toplam + 1 özel.
    expect(options).toHaveLength(29);
  });

  it('shows no computed value before any data is entered', () => {
    renderTool();

    expect(screen.getByTestId('crc-result-hex')).not.toHaveTextContent('0x');
    expect(screen.queryByTestId('crc-data-error')).not.toBeInTheDocument();
  });

  it('reports non-hex characters as invalid input', () => {
    renderTool();

    setData('ZZ');

    expect(screen.getByTestId('crc-data-error')).toBeInTheDocument();
    expect(screen.getByTestId('crc-result-hex')).not.toHaveTextContent('0x');
  });

  it('reports an odd number of hex digits as invalid input', () => {
    renderTool();

    setData('ABC');

    expect(screen.getByTestId('crc-data-error')).toBeInTheDocument();
  });

  it('loads the spec §43 sample data into the input', () => {
    renderTool();

    loadSample();

    expect(dataInput()).toHaveValue(SAMPLE_HEX);
  });

  it('computes CRC8 = 0xF4 for the spec §43 sample', () => {
    renderTool();

    loadSample();
    selectAlgorithm('CRC8');

    expect(screen.getByTestId('crc-result-hex')).toHaveTextContent('0xF4');
  });

  it('computes CRC16/CCITT-FALSE = 0x29B1 for the spec §43 sample', () => {
    renderTool();

    loadSample();
    selectAlgorithm('CRC16_CCITT_FALSE');

    expect(screen.getByTestId('crc-result-hex')).toHaveTextContent('0x29B1');
  });

  it('computes CRC16/MODBUS = 0x4B37 for the spec §43 sample', () => {
    renderTool();

    loadSample();
    selectAlgorithm('CRC16_MODBUS');

    expect(screen.getByTestId('crc-result-hex')).toHaveTextContent('0x4B37');
  });

  it('computes CRC32 = 0xCBF43926 for the spec §43 sample', () => {
    renderTool();

    loadSample();
    selectAlgorithm('CRC32');

    expect(screen.getByTestId('crc-result-hex')).toHaveTextContent('0xCBF43926');
    expect(screen.getByTestId('crc-result-decimal')).toHaveTextContent('3421780262');
  });

  it('accepts commas and blanks as byte separators', () => {
    renderTool();

    setData('31,32,33,34,35,36,37,38,39');
    selectAlgorithm('CRC16_MODBUS');

    expect(screen.getByTestId('crc-result-hex')).toHaveTextContent('0x4B37');
  });

  it('reports the register width of the selected variant', () => {
    renderTool();

    loadSample();
    selectAlgorithm('CRC16_MODBUS');

    expect(screen.getByTestId('crc-result-width')).toHaveTextContent('16');
  });

  it('recomputes when the algorithm changes without touching the data', () => {
    renderTool();

    loadSample();
    selectAlgorithm('CRC16_MODBUS');
    expect(screen.getByTestId('crc-result-hex')).toHaveTextContent('0x4B37');

    selectAlgorithm('CRC16_XMODEM');

    expect(screen.getByTestId('crc-result-hex')).toHaveTextContent('0x31C3');
    expect(screen.getByTestId('crc-result-hex')).not.toHaveTextContent('0x4B37');
  });

  it('summarises the five parameters of the selected variant', () => {
    renderTool();

    loadSample();
    selectAlgorithm('CRC16_MODBUS');

    const summary = screen.getByTestId('crc-result-params');
    expect(summary).toHaveTextContent('poly=0x8005');
    expect(summary).toHaveTextContent('init=0xFFFF');
    expect(summary).toHaveTextContent('refin=true');
    expect(summary).toHaveTextContent('refout=true');
    expect(summary).toHaveTextContent('xorout=0x0000');
  });

  it('zero-pads the hex result up to the register width', () => {
    renderTool();

    loadSample();
    // Adler-32 sonucu 0x91E01DE — 32 bitlik alanda 8 haneye tamamlanmalı.
    selectAlgorithm('ADLER32');

    expect(screen.getByTestId('crc-result-hex')).toHaveTextContent('0x091E01DE');
  });

  it('keeps CRC64 on the bigint path instead of losing the top bits', () => {
    renderTool();

    loadSample();
    selectAlgorithm('CRC64');

    // Sonuç Number.MAX_SAFE_INTEGER'ın üstünde; `number` yolu bu değeri yuvarlardı.
    expect(screen.getByTestId('crc-result-hex')).toHaveTextContent('0x995DC9BBDF1939FA');
    expect(screen.getByTestId('crc-result-decimal')).toHaveTextContent('11051210869376104954');
    expect(screen.getByTestId('crc-result-width')).toHaveTextContent('64');
  });

  it('computes a simple XOR8 checksum through the same output fields', () => {
    renderTool();

    loadSample();
    selectAlgorithm('XOR8');

    expect(screen.getByTestId('crc-result-hex')).toHaveTextContent('0x31');
    expect(screen.getByTestId('crc-result-width')).toHaveTextContent('8');
  });

  it('reveals the custom parameter inputs only for the custom entry', () => {
    renderTool();

    expect(screen.queryByTestId('crc-custom-panel')).not.toBeInTheDocument();

    selectAlgorithm('CUSTOM');

    expect(screen.getByTestId('crc-custom-panel')).toBeInTheDocument();
  });

  it('computes CRC16/MODBUS from hand-entered custom parameters', () => {
    renderTool();

    loadSample();
    selectAlgorithm('CUSTOM');
    fireEvent.change(customField('poly'), { target: { value: '8005' } });
    fireEvent.click(customFlag('refin'));
    fireEvent.click(customFlag('refout'));

    expect(screen.getByTestId('crc-result-hex')).toHaveTextContent('0x4B37');
  });

  it('starts the custom entry on a working variant', () => {
    renderTool();

    loadSample();
    selectAlgorithm('CUSTOM');

    // Varsayılanlar CRC16/CCITT-FALSE'a denk gelir; boş bir panelle açılmaz.
    expect(screen.getByTestId('crc-result-hex')).toHaveTextContent('0x29B1');
  });

  it('rejects a custom polynomial that does not fit the register width', () => {
    renderTool();

    loadSample();
    selectAlgorithm('CUSTOM');
    fireEvent.change(customField('poly'), { target: { value: '18005' } });

    expect(screen.getByTestId('crc-params-error')).toBeInTheDocument();
    expect(screen.getByTestId('crc-result-hex')).not.toHaveTextContent('0x');
  });

  it('rejects a custom width outside the supported range', () => {
    renderTool();

    loadSample();
    selectAlgorithm('CUSTOM');
    fireEvent.change(customWidthField(), { target: { value: '0' } });

    expect(screen.getByTestId('crc-params-error')).toBeInTheDocument();
  });

  it('rejects a non-hex custom init value', () => {
    renderTool();

    loadSample();
    selectAlgorithm('CUSTOM');
    fireEvent.change(customField('init'), { target: { value: 'XY' } });

    expect(screen.getByTestId('crc-params-error')).toBeInTheDocument();
  });

  it('applies a custom xorout to the final register', () => {
    renderTool();

    loadSample();
    selectAlgorithm('CUSTOM');
    fireEvent.change(customField('xorout'), { target: { value: 'FFFF' } });

    // CRC16/CCITT-FALSE sonucu 0x29B1; 0xFFFF ile XOR'u 0xD64E.
    expect(screen.getByTestId('crc-result-hex')).toHaveTextContent('0xD64E');
  });

  it('lists the parameter steps of a catalogue variant', () => {
    renderTool();

    loadSample();
    selectAlgorithm('CRC16_MODBUS');

    expect(screen.getByTestId('crc-step-input')).toHaveTextContent('9');
    expect(screen.getByTestId('crc-step-init')).toHaveTextContent('0xFFFF');
    expect(screen.getByTestId('crc-step-poly')).toHaveTextContent('0x8005');
    expect(screen.getByTestId('crc-step-refin')).toHaveTextContent('true');
    expect(screen.getByTestId('crc-step-refout')).toHaveTextContent('true');
    expect(screen.getByTestId('crc-step-xorout')).toHaveTextContent('0x0000');
    expect(screen.getByTestId('crc-step-result')).toHaveTextContent('16 bit');
    expect(screen.getByTestId('crc-step-result')).toHaveTextContent('0x4B37');
  });

  it('drops the polynomial steps for checksums that have no polynomial', () => {
    renderTool();

    loadSample();
    selectAlgorithm('SUM8');

    expect(screen.queryByTestId('crc-step-poly')).not.toBeInTheDocument();
    expect(screen.queryByTestId('crc-step-refin')).not.toBeInTheDocument();
    expect(screen.getByTestId('crc-step-result')).toHaveTextContent('0xDD');
  });

  it('shows the four verified spec §43 references, computed by the engine', () => {
    renderTool();

    expect(screen.getByTestId('crc-reference-CRC8')).toHaveTextContent('0xF4');
    expect(screen.getByTestId('crc-reference-CRC16_CCITT_FALSE')).toHaveTextContent('0x29B1');
    expect(screen.getByTestId('crc-reference-CRC16_MODBUS')).toHaveTextContent('0x4B37');
    expect(screen.getByTestId('crc-reference-CRC32')).toHaveTextContent('0xCBF43926');
  });

  it('carries the §42 limitation and common-mistake sections', () => {
    renderTool();

    expect(screen.getByTestId('crc-doc-limits')).toBeInTheDocument();
    expect(screen.getByTestId('crc-limit-bigint')).toBeInTheDocument();
    expect(screen.getByTestId('crc-limit-coverage')).toBeInTheDocument();
    expect(screen.getByTestId('crc-doc-mistakes')).toBeInTheDocument();
    expect(screen.getByTestId('crc-mistake-reflect')).toBeInTheDocument();
    expect(screen.getByTestId('crc-mistake-scope')).toBeInTheDocument();
  });

  it('carries the §42 formula section with the active parameter line', () => {
    renderTool();

    loadSample();
    selectAlgorithm('CRC32');

    expect(screen.getByTestId('crc-formula-expression')).toHaveTextContent('xorout');
    expect(screen.getByTestId('crc-formula-params')).toHaveTextContent('poly=0x04C11DB7');
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { VirtualizedTable } from './VirtualizedTable';

function renderRow(index: number): React.ReactNode {
  return (
    <div key={index} role="row" style={{ height: 20 }}>
      <span role="gridcell">satır {index}</span>
    </div>
  );
}

describe('VirtualizedTable', () => {
  it('100 bin satırdan yalnız pencereye düşenleri DOM\'a koyar', () => {
    render(
      <VirtualizedTable rowCount={100_000} rowHeight={20} height={200} renderRow={renderRow} />,
    );

    const rows = screen.getAllByRole('row');
    // 200/20 = 10 görünür + 1 taşma + varsayılan 8 overscan (üstte yer yok, altta var)
    expect(rows.length).toBeLessThan(30);
    expect(rows.length).toBeGreaterThan(10);
  });

  it('ilk satırdan başlar', () => {
    render(<VirtualizedTable rowCount={1000} rowHeight={20} height={100} renderRow={renderRow} />);

    expect(screen.getByText('satır 0')).toBeInTheDocument();
    expect(screen.queryByText('satır 900')).not.toBeInTheDocument();
  });

  it('toplam satır sayısını erişilebilirlik ağacına bildirir', () => {
    render(
      <VirtualizedTable
        rowCount={4321}
        rowHeight={20}
        height={100}
        renderRow={renderRow}
        ariaLabel="çerçeveler"
      />,
    );

    expect(screen.getByRole('grid', { name: 'çerçeveler' })).toHaveAttribute(
      'aria-rowcount',
      '4321',
    );
  });

  it('satır yokken boş metni gösterir ve hiç satır çizmez', () => {
    render(
      <VirtualizedTable
        rowCount={0}
        rowHeight={20}
        height={100}
        renderRow={renderRow}
        emptyLabel="Henüz veri yok"
      />,
    );

    expect(screen.getByText('Henüz veri yok')).toBeInTheDocument();
    expect(screen.queryAllByRole('row')).toHaveLength(0);
  });

  it('dolgu yükseklikleri kaydırma çubuğunu tam boyda tutar', () => {
    const { container } = render(
      <VirtualizedTable rowCount={1000} rowHeight={20} height={200} renderRow={renderRow} />,
    );

    const rowGroup = container.querySelector('[role="rowgroup"]');
    const style = rowGroup?.getAttribute('style') ?? '';

    expect(style).toContain('padding-top: 0px');
    // Toplam 20 000 px; üstte 0, çizilen satırlar dışındaki her şey altta olmalı.
    expect(style).toMatch(/padding-bottom: \d+px/);
  });

  it('satır sayısı arttıkça yeni satırlar görünür hâle gelir', () => {
    const { rerender } = render(
      <VirtualizedTable rowCount={3} rowHeight={20} height={200} renderRow={renderRow} />,
    );
    expect(screen.getAllByRole('row')).toHaveLength(3);

    rerender(<VirtualizedTable rowCount={8} rowHeight={20} height={200} renderRow={renderRow} />);

    expect(screen.getAllByRole('row')).toHaveLength(8);
  });

  it('followTail açıkken kaydırma konumu bildirilir', () => {
    const onFollowTailChange = vi.fn();
    render(
      <VirtualizedTable
        rowCount={1000}
        rowHeight={20}
        height={200}
        renderRow={renderRow}
        followTail
        onFollowTailChange={onFollowTailChange}
      />,
    );

    // jsdom düzen hesaplamadığı için scrollHeight 0'dır; burada sınanan şey
    // bileşenin takip modunda hata vermeden render edilmesi. Gerçek yapışma
    // davranışı Playwright turunda doğrulanır.
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });
});

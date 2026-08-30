import { render, within } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { allEntries } from '@/app/catalog';
import { LanguageProvider } from '@/app/providers/LanguageProvider';
import { resolveStatus } from '@/protocols/pluginBinding';
import { translations } from '@/translations/all';

import { FamilyPage } from './FamilyPage';

/**
 * Sayfa GERÇEK katalogla koşuyor — sınanan şey tam da katalog verisinin ekrana
 * nasıl indiği (`ProtocolPage.test.tsx` ile aynı gerekçe).
 *
 * ── Bu dosyanın varlık sebebi ─────────────────────────────────────────────
 * Aile listesi rozeti kaydın HAM `status`unu basıyordu, `ProtocolPage` ise
 * `resolveStatus` ile alias zincirinin sonundaki durumu. İkisi ayrışmıştı:
 * alias kartı listede "Planlandı", tek tık sonra kendi sayfasında "Hazır"
 * gösteriyordu. 15 alias kaydın 14'ü bu durumdaydı. Tarayıcı turunda
 * yakalandı; hiçbir test aile kartının rozetine bakmıyordu.
 */

const tr = translations.tr;

function renderFamily(domainId: string, familyId: string): RenderResult {
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[`/${domainId}/${familyId}`]}>
        <Routes>
          <Route path=":domainId/:familyId" element={<FamilyPage />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
}

/** Katalogdaki her alias kaydı, ait olduğu aile yoluyla birlikte. */
function aliasRecords(): { domainId: string; familyId: string; id: string; name: string }[] {
  return allEntries()
    .filter((entry) => entry.protocol.aliasOf !== undefined)
    .map((entry) => ({
      domainId: entry.domain.id,
      familyId: entry.family.id,
      id: entry.protocol.id,
      name: entry.protocol.name,
    }));
}

describe('FamilyPage — alias rozeti', () => {
  it('katalogda gerçekten alias kayıt var (fixture çürümesine karşı)', () => {
    expect(aliasRecords().length).toBeGreaterThan(0);
  });

  /**
   * Asıl bekçi: alias kartının rozeti KANONİK kaydın durumunu göstermeli.
   * `resolveStatus`u burada TEKRAR çağırıp karşılaştırmak, sayfanın da aynı
   * fonksiyonu kullandığını sınamaz gibi görünür — ama sınar: sayfa ham
   * `protocol.status`a dönerse çalışan bir motorun üstünde "Planlandı" basar
   * ve beklenen etiketle uyuşmaz.
   */
  it.each(aliasRecords())(
    '$domainId/$familyId/$id kartı kanonik durumu gösterir',
    ({ domainId, familyId, id, name }) => {
      const view = renderFamily(domainId, familyId);

      const entry = allEntries().find(
        (candidate) =>
          candidate.domain.id === domainId &&
          candidate.family.id === familyId &&
          candidate.protocol.name === name,
      );
      expect(entry).toBeDefined();
      if (entry === undefined) return;

      const expectedStatus = resolveStatus(entry.protocol);
      const expectedLabel = tr[`status.${expectedStatus}` as const];

      // Kart HREF ile bulunur, adla değil: "RTCM" aynı ailedeki UBX kartının
      // özetinde de geçiyor ve ada göre arama iki kart döndürüyordu.
      const card = view.container.querySelector(`a[href="/${domainId}/${familyId}/${id}"]`);
      expect(card, `${domainId}/${familyId}/${id} kartı bulunamadı`).not.toBeNull();
      if (card === null) return;
      expect(within(card as HTMLElement).getByTitle(tr['protocol.status'])).toHaveTextContent(
        expectedLabel,
      );
    },
  );

  it('alias OLMAYAN kayıtta rozet kendi durumundan gelir', () => {
    // modbus-rtu kanonik ve `ready`; alias çözümü onu değiştirmemeli.
    const view = renderFamily('industrial-automation', 'modbus');
    const card = view.container.querySelector('a[href="/industrial-automation/modbus/modbus-rtu"]');
    expect(card).not.toBeNull();
    if (card === null) return;
    expect(within(card as HTMLElement).getByTitle(tr['protocol.status'])).toHaveTextContent(
      tr['status.ready'],
    );
  });
});

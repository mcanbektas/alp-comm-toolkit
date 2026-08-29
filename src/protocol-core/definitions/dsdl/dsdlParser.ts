/**
 * DSDL ayrıştırıcısı — satır tabanlı.
 *
 * A2L'in aksine DSDL GERÇEKTEN satır tabanlıdır: dilin kendi grameri her
 * bildirimi tek satıra koyar (Cyphal Specification §3.7 "Each statement shall
 * be terminated by a line break"). Bu yüzden burada belirteçleyiciye gerek yok
 * ve satır numarası doğal olarak korunuyor.
 *
 * ── YERLEŞİM NEREYE KADAR BİLİNİR ───────────────────────────────────────────
 * Alanlar sırayla, dolgusuz, bit düzeyinde paketlenir. Konum ancak KENDİNDEN
 * ÖNCEKİLERİN hepsi sabit genişlikteyse bilinir. Değişken uzunluklu bir dizi
 * (`uint8[<=50]`) ya da bileşik tip (`uavcan.node.Health.1.0`) geçildiği anda
 * sonraki alanların konumu telin İÇERİĞİNE bağlanır — dosyadan çıkmaz. O
 * andan itibaren `bitOffset` verilmez; tahmin etmek, panelin yanlış bitleri
 * okuyup dolu ve yanlış bir sonuç göstermesi demekti.
 */

import type {
  DsdlArraySpec,
  DsdlConstant,
  DsdlField,
  DsdlParseIssue,
  DsdlParseResult,
  DsdlPrimitive,
  DsdlSection,
  DsdlSectionKind,
} from './dsdlTypes';

/** `uint16`, `int7`, `float32`, `bool`, `void3` — genişlik ADIN İÇİNDEDİR. */
const PRIMITIVE_PATTERN = /^(uint|int|float|void)(\d+)?$|^(bool)$/;

/** `saturated`/`truncated` yalnız TAŞMA davranışını söyler, genişliği değil. */
const CAST_MODES = new Set(['saturated', 'truncated']);

const FLOAT_WIDTHS = new Set([16, 32, 64]);

function parsePrimitive(typeName: string): DsdlPrimitive | undefined {
  const match = PRIMITIVE_PATTERN.exec(typeName);
  if (match === null) return undefined;

  if (match[3] === 'bool') return { kind: 'bool', bitLength: 1 };

  const keyword = match[1];
  const width = Number(match[2]);
  if (keyword === undefined || !Number.isFinite(width) || width <= 0) return undefined;

  if (keyword === 'float') {
    // `float8` diye bir tip yok; yazan dosya bozuktur ve genişliği uydurmak
    // yerine tip "bileşik/bilinmeyen" sayılır.
    return FLOAT_WIDTHS.has(width) ? { kind: 'float', bitLength: width } : undefined;
  }
  if (keyword === 'void') return { kind: 'void', bitLength: width };
  return { kind: keyword === 'uint' ? 'unsigned' : 'signed', bitLength: width };
}

/** `uint8[<=50]` / `uint8[4]` — köşeli parantez varsa dizi. */
function parseArraySpec(typeText: string): { base: string; array?: DsdlArraySpec } {
  const match = /^(.+?)\[\s*(<=)?\s*(\d+)\s*\]$/.exec(typeText);
  if (match?.[1] === undefined || match[3] === undefined) return { base: typeText };
  return {
    base: match[1].trim(),
    array: { mode: match[2] === undefined ? 'fixed' : 'variable', capacity: Number(match[3]) },
  };
}

/**
 * Değişken uzunluklu dizinin uzunluk alanı: azami eleman sayısını gösterecek
 * en dar bit sayısı (Cyphal §3.7.5). Kapasite 50 ise 6 bit, 255 ise 8.
 */
function lengthPrefixBits(capacity: number): number {
  return Math.max(1, Math.ceil(Math.log2(capacity + 1)));
}

interface SectionAccumulator {
  kind: DsdlSectionKind;
  fields: DsdlField[];
  constants: DsdlConstant[];
  directives: string[];
  /** Bir sonraki alanın bit konumu; bilinmez olduysa `undefined`. */
  cursor: number | undefined;
}

function newSection(kind: DsdlSectionKind): SectionAccumulator {
  return { kind, fields: [], constants: [], directives: [], cursor: 0 };
}

/** Satır sonundaki `# yorum` ayrılır; satırın tamamı yorumsa gövde boş kalır. */
function splitComment(line: string): { body: string; comment?: string } {
  const hash = line.indexOf('#');
  if (hash === -1) return { body: line.trim() };
  return { body: line.slice(0, hash).trim(), comment: line.slice(hash + 1).trim() };
}

export function parseDsdl(text: string): DsdlParseResult {
  const issues: DsdlParseIssue[] = [];
  const sections: SectionAccumulator[] = [newSection('message')];
  let isService = false;

  const lines = text.split(/\r?\n/);
  for (const [index, rawLine] of lines.entries()) {
    const line = index + 1;
    const { body, comment } = splitComment(rawLine);
    if (body === '') continue;

    if (body === '---') {
      // Servis: ilk bölüm istek, ikincisi yanıt olur. Üçüncü bir ayraç
      // dilde YOKTUR; varsa dosya bozuktur ve sessizce üçüncü bölüm
      // uydurmak, olmayan bir yapıyı varmış gibi göstermek olurdu.
      if (isService) {
        issues.push({ line, messageKey: 'definition.dsdl.issue.extraServiceSeparator' });
        continue;
      }
      isService = true;
      const first = sections[0];
      if (first !== undefined) first.kind = 'request';
      sections.push(newSection('response'));
      continue;
    }

    const section = sections[sections.length - 1];
    if (section === undefined) continue;

    if (body.startsWith('@')) {
      section.directives.push(body);
      continue;
    }

    // Sabit: `<tip> AD = değer`. Sabitler TELDE YER KAPLAMAZ, imleci
    // ilerletmezler — alan sanıp ofset kaydırmak bütün yerleşimi bozardı.
    const constantMatch = /^(.+?)\s+([A-Za-z_]\w*)\s*=\s*(.+)$/.exec(body);
    if (constantMatch?.[1] !== undefined && constantMatch[2] !== undefined && constantMatch[3] !== undefined) {
      section.constants.push({
        typeText: constantMatch[1].trim(),
        name: constantMatch[2],
        value: constantMatch[3].trim(),
      });
      continue;
    }

    const parts = body.split(/\s+/).filter((part) => part !== '');
    const withoutCast = CAST_MODES.has(parts[0] ?? '') ? parts.slice(1) : parts;
    const typeText = withoutCast[0];
    if (typeText === undefined) {
      issues.push({ line, messageKey: 'definition.dsdl.issue.badField', text: body });
      continue;
    }

    const { base, array } = parseArraySpec(typeText);
    const primitive = parsePrimitive(base);
    const name = withoutCast[1] ?? '';

    // `void5` tek başına gelir: dolgu alanının adı YOKTUR.
    if (name === '' && primitive?.kind !== 'void') {
      issues.push({ line, messageKey: 'definition.dsdl.issue.fieldWithoutName', text: body });
    }

    const bitLength = fixedBitLength(primitive, array);
    const field: DsdlField = {
      name,
      typeText: withoutCast.slice(0, 1).join(' '),
      ...(primitive === undefined ? {} : { primitive }),
      ...(array === undefined ? {} : { array }),
      ...(section.cursor === undefined ? {} : { bitOffset: section.cursor }),
      ...(bitLength === undefined ? {} : { bitLength }),
      ...(comment === undefined || comment === '' ? {} : { comment }),
    };
    section.fields.push(field);

    // İmleç yalnız sabit genişlikte ilerler; bir kez bilinmez olduysa geri
    // dönmez, çünkü sonraki her alan da içeriğe bağlıdır.
    section.cursor =
      section.cursor === undefined || bitLength === undefined ? undefined : section.cursor + bitLength;
  }

  const built: DsdlSection[] = sections.map((section) => ({
    kind: section.kind,
    fields: section.fields,
    constants: section.constants,
    directives: section.directives,
  }));

  if (built.every((section) => section.fields.length === 0 && section.constants.length === 0)) {
    issues.push({ line: 0, messageKey: 'definition.dsdl.issue.empty' });
    return { success: false, issues };
  }

  return { success: true, definition: { sections: built, isService }, issues };
}

/**
 * Sabit genişlik:
 * - ilkel alan → tipin genişliği,
 * - sabit dizi → eleman × kapasite,
 * - değişken dizi → BİLİNMEZ (uzunluk teldedir; yalnız uzunluk ÖNEKİ sabittir
 *   ama alanın tamamı değil),
 * - bileşik tip → BİLİNMEZ (tanımı başka dosyada).
 */
function fixedBitLength(
  primitive: DsdlPrimitive | undefined,
  array: DsdlArraySpec | undefined,
): number | undefined {
  if (primitive === undefined) return undefined;
  if (array === undefined) return primitive.bitLength;
  if (array.mode === 'fixed') return primitive.bitLength * array.capacity;
  return undefined;
}

/** Değişken dizinin uzunluk önekini panel gösterebilsin diye dışa açılır. */
export { lengthPrefixBits };

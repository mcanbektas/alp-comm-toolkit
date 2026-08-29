/**
 * Küçük, bağımlılıksız XML okuyucu — aygıt tanım dosyaları (GSDML, IODD, SCL)
 * için.
 *
 * ── NEDEN `DOMParser` DEĞİL ─────────────────────────────────────────────────
 * Tarayıcıda `DOMParser` var, ama iki sebeple kullanılmadı:
 *
 * 1. `protocol-core` TAŞINABİLİR olmak zorunda: aynı kod Web Worker içinde de
 *    koşuyor (`src/workers/`) ve `DOMParser` worker bağlamında YOKTUR. Motorun
 *    bir bağlamda çalışıp ötekinde `undefined is not a constructor` ile
 *    düşmesi, ancak üretimde görülecek bir arıza olurdu.
 * 2. `DOMParser` hatalı XML'de İSTİSNA ATMAZ; tarayıcıya göre değişen bir
 *    `<parsererror>` düğümü üretir. Sözleşmesi tarayıcı-bağımlı olan bir
 *    ayrıştırıcının üstüne kararlı bir sorun listesi kurulamaz.
 *
 * ── KAPSAM ──────────────────────────────────────────────────────────────────
 * Aygıt tanım dosyalarının ihtiyacı kadarı: öğeler, öznitelikler, metin
 * içeriği, kendi kendini kapatan etiketler, yorumlar, XML bildirimi, CDATA ve
 * beş standart varlık (`&lt; &gt; &amp; &quot; &apos;`) + sayısal başvurular.
 * DTD, işleme yönergesi ve ad uzayı ÇÖZÜMLEMESİ kapsam dışı — ad uzayı öneki
 * etiket adında olduğu gibi kalır ve `localName` ile eşleşme yapılır, çünkü
 * bu dosyalar aynı öğeyi bazen önekli bazen öneksiz yazıyor.
 */

export interface XmlElement {
  /** Önekli tam ad (`IODevice`, `xs:element`). */
  readonly name: string;
  /** Ad uzayı öneki atılmış hâli — eşleşmeler bunun üstünden yapılır. */
  readonly localName: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children: readonly XmlElement[];
  /** Doğrudan metin içeriği (alt öğelerinki DEĞİL), kırpılmış. */
  readonly text: string;
  /** 1-tabanlı satır — sorun mesajları kullanıcıyı dosyada bulabilmeli. */
  readonly line: number;
}

export type XmlParseResult =
  | { readonly success: true; readonly root: XmlElement }
  | { readonly success: false; readonly line: number; readonly messageKey: string };

const ENTITIES: Readonly<Record<string, string>> = {
  lt: '<',
  gt: '>',
  amp: '&',
  quot: '"',
  apos: "'",
};

/** `&amp;`, `&#39;`, `&#x27;` — üçü de çözülür; tanınmayan varlık AYNEN kalır. */
export function decodeXmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|\w+);/gi, (match, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (body.startsWith('#')) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[body.toLowerCase()] ?? match;
  });
}

function localNameOf(name: string): string {
  const colon = name.indexOf(':');
  return colon === -1 ? name : name.slice(colon + 1);
}

interface MutableElement {
  name: string;
  localName: string;
  attributes: Record<string, string>;
  children: MutableElement[];
  text: string;
  line: number;
}

function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match = pattern.exec(source);
  while (match !== null) {
    const key = match[1];
    const value = match[3] ?? match[4] ?? '';
    if (key !== undefined) attributes[key] = decodeXmlEntities(value);
    match = pattern.exec(source);
  }
  return attributes;
}

/**
 * Ayrıştırma. Hata durumunda İSTİSNA ATMAZ, `success: false` döner: dosya
 * kullanıcıdan geliyor ve bozuk bir dosya panelin çökmesi değil, sorun
 * listesinde bir satır olmalı (spec §47).
 */
export function parseXml(text: string): XmlParseResult {
  const stack: MutableElement[] = [];
  let root: MutableElement | null = null;
  let index = 0;
  let line = 1;

  const countLines = (chunk: string): void => {
    line += (chunk.match(/\n/g) ?? []).length;
  };

  while (index < text.length) {
    const open = text.indexOf('<', index);
    if (open === -1) break;

    // Etiketler arası metin, İÇİNDE bulunduğumuz öğenin metnidir.
    const between = text.slice(index, open);
    if (between.trim() !== '' && stack.length > 0) {
      const current = stack[stack.length - 1];
      if (current !== undefined) current.text += decodeXmlEntities(between).trim();
    }
    countLines(between);

    if (text.startsWith('<!--', open)) {
      const end = text.indexOf('-->', open);
      const stop = end === -1 ? text.length : end + 3;
      countLines(text.slice(open, stop));
      index = stop;
      continue;
    }
    if (text.startsWith('<![CDATA[', open)) {
      const end = text.indexOf(']]>', open);
      const stop = end === -1 ? text.length : end;
      const content = text.slice(open + 9, stop);
      const current = stack[stack.length - 1];
      // CDATA içeriği HAM metindir: varlık çözümü uygulanmaz, tanım gereği.
      if (current !== undefined) current.text += content.trim();
      countLines(text.slice(open, stop));
      index = stop + 3;
      continue;
    }
    if (text.startsWith('<?', open) || text.startsWith('<!', open)) {
      // XML bildirimi, DOCTYPE, işleme yönergesi: atlanır.
      const end = text.indexOf('>', open);
      const stop = end === -1 ? text.length : end + 1;
      countLines(text.slice(open, stop));
      index = stop;
      continue;
    }

    const close = text.indexOf('>', open);
    if (close === -1) {
      return { success: false, line, messageKey: 'definition.xmlDevice.issue.unterminatedTag' };
    }

    const raw = text.slice(open + 1, close);
    const tagLine = line;
    countLines(text.slice(open, close + 1));
    index = close + 1;

    if (raw.startsWith('/')) {
      const name = raw.slice(1).trim();
      const current = stack.pop();
      if (current === undefined || current.name !== name) {
        return { success: false, line: tagLine, messageKey: 'definition.xmlDevice.issue.mismatchedTag' };
      }
      if (stack.length === 0) root = current;
      continue;
    }

    const selfClosing = raw.endsWith('/');
    const body = selfClosing ? raw.slice(0, -1) : raw;
    const nameMatch = /^([\w:.-]+)/.exec(body.trim());
    const name = nameMatch?.[1];
    if (name === undefined) {
      return { success: false, line: tagLine, messageKey: 'definition.xmlDevice.issue.badTag' };
    }

    const element: MutableElement = {
      name,
      localName: localNameOf(name),
      attributes: parseAttributes(body.slice(body.indexOf(name) + name.length)),
      children: [],
      text: '',
      line: tagLine,
    };

    const parent = stack[stack.length - 1];
    if (parent !== undefined) parent.children.push(element);

    if (selfClosing) {
      if (stack.length === 0) root = element;
    } else {
      stack.push(element);
    }
  }

  // Sıra önemli: kapanmamış öğe varsa kök de atanmamış olur ve "kök yok"
  // demek kullanıcıyı yanlış yere bakmaya gönderirdi — asıl sorun eksik
  // kapanış etiketidir.
  if (stack.length > 0) {
    return { success: false, line, messageKey: 'definition.xmlDevice.issue.unclosedElement' };
  }
  if (root === null) {
    return { success: false, line, messageKey: 'definition.xmlDevice.issue.noRoot' };
  }

  return { success: true, root };
}

/** Ad uzayı önekini YOK SAYARAK doğrudan çocukları süzer. */
export function childrenNamed(element: XmlElement, localName: string): readonly XmlElement[] {
  return element.children.filter((child) => child.localName === localName);
}

export function firstChild(element: XmlElement, localName: string): XmlElement | undefined {
  return element.children.find((child) => child.localName === localName);
}

/**
 * Ağacın TAMAMINDA verilen adı arar. Aygıt tanım dosyalarında aynı öğe
 * dosyadan dosyaya farklı derinlikte duruyor (GSDML sürümleri arasında bile),
 * bu yüzden yol sabitlemek yerine ada göre iniliyor.
 */
export function descendantsNamed(element: XmlElement, localName: string): XmlElement[] {
  const found: XmlElement[] = [];
  const visit = (node: XmlElement): void => {
    for (const child of node.children) {
      if (child.localName === localName) found.push(child);
      visit(child);
    }
  };
  visit(element);
  return found;
}

/** Öznitelik okuma; yoksa `undefined` — boş dizge ile karıştırılmaz. */
export function attribute(element: XmlElement, name: string): string | undefined {
  const direct = element.attributes[name];
  if (direct !== undefined) return direct;
  // Bazı dosyalar özniteliği önekli yazıyor (`xsi:type`); önek yok sayılır.
  const entry = Object.entries(element.attributes).find(([key]) => localNameOf(key) === name);
  return entry?.[1];
}

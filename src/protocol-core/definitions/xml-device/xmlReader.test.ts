import { describe, expect, it } from 'vitest';

import {
  attribute,
  childrenNamed,
  decodeXmlEntities,
  descendantsNamed,
  firstChild,
  parseXml,
} from './xmlReader';

function parse(text: string) {
  const result = parseXml(text);
  if (!result.success) throw new Error(`ayrıştırılamadı: ${result.messageKey}`);
  return result.root;
}

describe('decodeXmlEntities', () => {
  it('beş standart varlığı ve sayısal başvuruları çözer', () => {
    expect(decodeXmlEntities('a &lt; b &amp;&amp; c &gt; d')).toBe('a < b && c > d');
    expect(decodeXmlEntities('&#65;&#x42;')).toBe('AB');
  });

  it('tanınmayan varlığı AYNEN bırakır — sessizce silmez', () => {
    expect(decodeXmlEntities('&nbsp;x')).toBe('&nbsp;x');
  });
});

describe('parseXml', () => {
  it('öğe, öznitelik ve metni okur', () => {
    const root = parse('<Device id="7" name="ACME"><Name>Sıcaklık</Name></Device>');
    expect(root.localName).toBe('Device');
    expect(root.attributes).toEqual({ id: '7', name: 'ACME' });
    expect(firstChild(root, 'Name')?.text).toBe('Sıcaklık');
  });

  it('kendi kendini kapatan etiketi çocuk olarak ekler', () => {
    const root = parse('<A><B x="1"/><B x="2"/></A>');
    expect(childrenNamed(root, 'B').map((child) => child.attributes['x'])).toEqual(['1', '2']);
  });

  it('XML bildirimini, yorumu ve DOCTYPE’ı atlar', () => {
    const root = parse('<?xml version="1.0"?>\n<!-- yorum -->\n<!DOCTYPE A>\n<A><B/></A>');
    expect(root.localName).toBe('A');
    expect(root.children).toHaveLength(1);
  });

  it('CDATA içeriğini HAM alır', () => {
    const root = parse('<A><![CDATA[ a < b & c ]]></A>');
    expect(root.text).toBe('a < b & c');
  });

  it('ad uzayı önekini `localName` ile ayırır ama tam adı korur', () => {
    const root = parse('<iodd:IODevice xmlns:iodd="x"><iodd:DeviceIdentity/></iodd:IODevice>');
    expect(root.localName).toBe('IODevice');
    expect(root.name).toBe('iodd:IODevice');
    expect(firstChild(root, 'DeviceIdentity')).toBeDefined();
  });

  it('önekli özniteliği önek olmadan da bulur', () => {
    const root = parse('<A xsi:type="Unsigned8"/>');
    expect(attribute(root, 'type')).toBe('Unsigned8');
  });

  it('`descendantsNamed` derinlikten bağımsız bulur', () => {
    const root = parse('<A><B><C><Item id="1"/></C></B><Item id="2"/></A>');
    expect(descendantsNamed(root, 'Item').map((item) => item.attributes['id'])).toEqual(['1', '2']);
  });

  it('satır numarasını korur', () => {
    const root = parse('<A>\n\n  <B/>\n</A>');
    expect(firstChild(root, 'B')?.line).toBe(3);
  });

  it('kapanmayan öğede İSTİSNA ATMAZ, sorun döner', () => {
    const result = parseXml('<A><B></A>');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.messageKey).toBe('definition.xmlDevice.issue.mismatchedTag');
  });

  it('kapanmamış kök öğeyi bildirir', () => {
    const result = parseXml('<A><B/>');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.messageKey).toBe('definition.xmlDevice.issue.unclosedElement');
  });

  it('XML olmayan girdide kök bulunamadığını söyler', () => {
    const result = parseXml('düz metin');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.messageKey).toBe('definition.xmlDevice.issue.noRoot');
  });
});

/**
 * GSDML / IODD / SCL okuyucuları ve biçim seçimi.
 *
 * ── BİÇİM KÖK ÖĞEDEN SEÇİLİR ────────────────────────────────────────────────
 * Uzantıdan değil: kullanıcı dosyayı `.xml` olarak kaydetmiş olabilir, ya da
 * `GSDML-V2.35-ACME-…xml` adını değiştirmiş olabilir. Kök öğe ise standardın
 * kendi imzasıdır ve değiştirilemez.
 *
 * ── ÜÇ OKUYUCU, TEK MODEL ───────────────────────────────────────────────────
 * Her okuyucu KENDİ standardının yolunu bilir ama ortak modele yazar
 * (`deviceDescriptionTypes.ts`). Ortak olmayan kimlik alanları `identity`
 * listesinde etiketiyle taşınır.
 *
 * ── METİN ÇÖZÜMLEMESİ ───────────────────────────────────────────────────────
 * GSDML ve IODD adları doğrudan yazmaz, METİN KİMLİĞİ (`textId`) ile
 * gösterir; asıl metin dosyanın sonundaki dil listesindedir. Çözümlenmezse
 * tabloda ham `TI_1234` gibi kimlikler görünürdü — kullanıcı için okunaksız.
 * Karşılığı bulunamayan kimlik SİLİNMEZ, olduğu gibi basılır: eksik çeviri
 * dosyanın gerçeğidir, gizlenmemeli.
 */

import type {
  DeviceDescription,
  DeviceDescriptionIssue,
  DeviceDescriptionResult,
  DeviceIdentityEntry,
  DeviceItem,
} from './deviceDescriptionTypes';
import { attribute, descendantsNamed, firstChild, parseXml } from './xmlReader';
import type { XmlElement } from './xmlReader';

/** `0x1A` ve ondalık — GSDML VendorID'yi hex, IODD index'i ondalık yazar. */
function parseNumber(text: string | undefined): number | undefined {
  if (text === undefined || text.trim() === '') return undefined;
  const hex = /^0x([0-9a-f]+)$/i.exec(text.trim());
  if (hex?.[1] !== undefined) return Number.parseInt(hex[1], 16);
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

/** `TextId` → metin sözlüğü; GSDML ve IODD aynı deseni farklı öğe adlarıyla kuruyor. */
function collectTexts(root: XmlElement, idAttribute: string): Map<string, string> {
  const texts = new Map<string, string>();
  for (const text of descendantsNamed(root, 'Text')) {
    const id = attribute(text, idAttribute) ?? attribute(text, 'id') ?? attribute(text, 'TextId');
    const value = attribute(text, 'Value') ?? attribute(text, 'value') ?? text.text;
    if (id !== undefined && value !== '') texts.set(id, value);
  }
  return texts;
}

function resolveText(texts: Map<string, string>, id: string | undefined): string {
  if (id === undefined) return '';
  return texts.get(id) ?? id;
}

function optional<K extends string, V>(key: K, value: V | undefined): Record<K, V> | Record<string, never> {
  return value === undefined || value === '' ? {} : ({ [key]: value } as Record<K, V>);
}

/* ── GSDML — PROFINET aygıt tanımı ─────────────────────────────────────────
 *
 * Kaynak: PROFIBUS & PROFINET International, "GSDML Specification for PROFINET
 * IO" V2.35 — `ISO15745Profile` kökü, `DeviceIdentity` kimliği,
 * `ParameterRecordDataItem/Ref` parametre kalemleri, `ExternalTextList` metin
 * listesi.
 */
function readGsdml(root: XmlElement, issues: DeviceDescriptionIssue[]): DeviceDescription {
  const texts = collectTexts(root, 'TextId');
  const identity = firstChild(root, 'ProfileBody')
    ? descendantsNamed(root, 'DeviceIdentity')[0]
    : descendantsNamed(root, 'DeviceIdentity')[0];

  const vendorName = identity === undefined ? '' : resolveText(texts, attribute(identity, 'VendorName'));
  const infoText = identity === undefined ? undefined : firstChild(identity, 'InfoText');
  const deviceName = resolveText(texts, infoText === undefined ? undefined : attribute(infoText, 'TextId'));

  const entries: DeviceIdentityEntry[] = [];
  const vendorId = identity === undefined ? undefined : attribute(identity, 'VendorID');
  const deviceId = identity === undefined ? undefined : attribute(identity, 'DeviceID');
  if (vendorId !== undefined) entries.push({ label: 'VendorID', value: vendorId });
  if (deviceId !== undefined) entries.push({ label: 'DeviceID', value: deviceId });
  const family = descendantsNamed(root, 'Family')[0];
  const mainFamily = family === undefined ? undefined : attribute(family, 'MainFamily');
  if (mainFamily !== undefined) entries.push({ label: 'MainFamily', value: mainFamily });

  const items: DeviceItem[] = [];
  for (const record of descendantsNamed(root, 'ParameterRecordDataItem')) {
    const recordIndex = attribute(record, 'Index') ?? '';
    for (const ref of descendantsNamed(record, 'Ref')) {
      const name = resolveText(texts, attribute(ref, 'TextId'));
      if (name === '') {
        issues.push({ line: ref.line, messageKey: 'definition.xmlDevice.issue.itemWithoutName' });
      }
      const byteOffset = parseNumber(attribute(ref, 'ByteOffset'));
      const bitOffsetInByte = parseNumber(attribute(ref, 'BitOffset')) ?? 0;
      const bitLength = parseNumber(attribute(ref, 'BitLength'));

      items.push({
        // Kimlik hem kayıt hem de kalem numarasını taşır: aynı `ID` farklı
        // kayıtlarda tekrar edebiliyor.
        id: `${recordIndex}/${attribute(ref, 'ID') ?? String(items.length)}`,
        name: name === '' ? (attribute(ref, 'ID') ?? '') : name,
        group: 'parameter',
        dataType: attribute(ref, 'DataType') ?? '',
        ...optional('bitOffset', byteOffset === undefined ? undefined : byteOffset * 8 + bitOffsetInByte),
        ...optional('bitLength', bitLength),
        ...optional('defaultValue', attribute(ref, 'DefaultValue')),
        ...optional('values', readGsdmlValueList(ref, texts)),
      });
    }
  }

  return {
    format: 'gsdml',
    vendor: vendorName,
    device: deviceName,
    identity: entries,
    items,
  };
}

/** `Assign` öğeleri: ham içerik → sözel karşılık. */
function readGsdmlValueList(
  ref: XmlElement,
  texts: Map<string, string>,
): Record<string, string> | undefined {
  const assigns = descendantsNamed(ref, 'Assign');
  if (assigns.length === 0) return undefined;
  const values: Record<string, string> = {};
  for (const assign of assigns) {
    const content = attribute(assign, 'Content');
    if (content === undefined) continue;
    values[content] = resolveText(texts, attribute(assign, 'TextId'));
  }
  return Object.keys(values).length === 0 ? undefined : values;
}

/* ── IODD — IO-Link aygıt tanımı ───────────────────────────────────────────
 *
 * Kaynak: IO-Link Community, "IO Device Description (IODD)" V1.1 — `IODevice`
 * kökü, `DeviceIdentity` kimliği, `Variable` parametreleri,
 * `ProcessDataIn/Out` süreç verisi, `ExternalTextCollection` metin listesi.
 */
function readIodd(root: XmlElement, issues: DeviceDescriptionIssue[]): DeviceDescription {
  const texts = collectTexts(root, 'id');
  const identity = descendantsNamed(root, 'DeviceIdentity')[0];

  const vendorName = identity === undefined ? '' : (attribute(identity, 'vendorName') ?? '');
  const deviceElement = descendantsNamed(root, 'DeviceVariantCollection')[0];
  const variant = deviceElement === undefined ? undefined : descendantsNamed(deviceElement, 'DeviceVariant')[0];
  const deviceName =
    variant === undefined ? '' : resolveText(texts, attribute(firstChild(variant, 'Name') ?? variant, 'textId'));

  const entries: DeviceIdentityEntry[] = [];
  const vendorId = identity === undefined ? undefined : attribute(identity, 'vendorId');
  const deviceId = identity === undefined ? undefined : attribute(identity, 'deviceId');
  if (vendorId !== undefined) entries.push({ label: 'vendorId', value: vendorId });
  if (deviceId !== undefined) entries.push({ label: 'deviceId', value: deviceId });

  const items: DeviceItem[] = [];

  for (const variable of descendantsNamed(root, 'Variable')) {
    const index = attribute(variable, 'index');
    if (index === undefined) {
      issues.push({ line: variable.line, messageKey: 'definition.xmlDevice.issue.itemWithoutId' });
      continue;
    }
    const datatype = firstChild(variable, 'Datatype');
    const nameElement = firstChild(variable, 'Name');

    items.push({
      id: index,
      name: resolveText(texts, nameElement === undefined ? undefined : attribute(nameElement, 'textId')),
      group: 'parameter',
      // `xsi:type="UIntegerT"` — önek yok sayılarak okunur.
      dataType: datatype === undefined ? '' : (attribute(datatype, 'type') ?? ''),
      ...optional('bitLength', datatype === undefined ? undefined : parseNumber(attribute(datatype, 'bitLength'))),
      ...optional('access', attribute(variable, 'accessRights')),
      ...optional('defaultValue', attribute(variable, 'defaultValue')),
      ...optional('values', readIoddValueList(variable, texts)),
    });
  }

  // Süreç verisi: `RecordItem`ların bitOffset'i çerçevedeki yeri verir ve
  // çözümü mümkün kılan tek bilgidir.
  //
  // ── SAYIM YÖNÜ ÇEVRİLİR ───────────────────────────────────────────────────
  // IODD `bitOffset`i süreç verisinin EN DÜŞÜK bitinden (sağdan) sayar; ortak
  // model ise baştan sayar (`DeviceItem.bitOffset`). Çevirmek için toplam
  // uzunluk gerekir ve o yalnız BURADA biliniyor:
  //   baştan = toplam − ioddOfset − uzunluk
  // Çevirmeyen bir okuyucu 32 bitlik bir süreç verisinde ilk kalemi son
  // kalemin yerinden okurdu — çökme yok, sessizce yanlış sayı.
  for (const direction of ['ProcessDataIn', 'ProcessDataOut']) {
    for (const processData of descendantsNamed(root, direction)) {
      const datatype = firstChild(processData, 'Datatype');
      const totalBits =
        parseNumber(attribute(processData, 'bitLength')) ??
        (datatype === undefined ? undefined : parseNumber(attribute(datatype, 'bitLength')));

      for (const record of descendantsNamed(processData, 'RecordItem')) {
        const simple = firstChild(record, 'SimpleDatatype');
        const nameElement = firstChild(record, 'Name');
        const bitLength = simple === undefined ? undefined : parseNumber(attribute(simple, 'bitLength'));
        const ioddOffset = parseNumber(attribute(record, 'bitOffset'));

        // Toplam uzunluk yazmıyorsa yön çevrilemez. Ham değeri "baştan" gibi
        // kullanmak yerine yerleşim BİLİNMİYOR sayılır: panel o kalemde çözüm
        // bölümünü açmaz ve neden açmadığını söyler.
        const fromStart =
          totalBits === undefined || ioddOffset === undefined || bitLength === undefined
            ? undefined
            : totalBits - ioddOffset - bitLength;
        if (fromStart === undefined && ioddOffset !== undefined) {
          issues.push({ line: record.line, messageKey: 'definition.xmlDevice.issue.unknownProcessDataLength' });
        }

        items.push({
          id: `${direction}.${attribute(record, 'subindex') ?? String(items.length)}`,
          name: resolveText(texts, nameElement === undefined ? undefined : attribute(nameElement, 'textId')),
          group: 'process-data',
          dataType: simple === undefined ? '' : (attribute(simple, 'type') ?? ''),
          ...optional('bitOffset', fromStart !== undefined && fromStart >= 0 ? fromStart : undefined),
          ...optional('bitLength', bitLength),
        });
      }
    }
  }

  return { format: 'iodd', vendor: vendorName, device: deviceName, identity: entries, items };
}

function readIoddValueList(
  variable: XmlElement,
  texts: Map<string, string>,
): Record<string, string> | undefined {
  const singles = descendantsNamed(variable, 'SingleValue');
  if (singles.length === 0) return undefined;
  const values: Record<string, string> = {};
  for (const single of singles) {
    const value = attribute(single, 'value');
    if (value === undefined) continue;
    const nameElement = firstChild(single, 'Name');
    values[value] = resolveText(texts, nameElement === undefined ? undefined : attribute(nameElement, 'textId'));
  }
  return Object.keys(values).length === 0 ? undefined : values;
}

/* ── SCL — IEC 61850 istasyon/aygıt tanımı ─────────────────────────────────
 *
 * Kaynak: IEC 61850-6 — `SCL` kökü, `IED` aygıtı, `LDevice/LN` mantıksal
 * düğümleri, `DOI/DAI/Val` yapılandırılmış değerleri.
 *
 * SCL ötekilerden farklı: burada "veri kalemi" bir çerçevedeki bayt DEĞİL,
 * aygıtın veri modelindeki bir yoldur. Bu yüzden `bitOffset` YOK ve panel bu
 * biçimde çözüm bölümünü açmaz — açsaydı, olmayan bir bayt yerleşimi varmış
 * gibi görünürdü.
 */
function readScl(root: XmlElement, issues: DeviceDescriptionIssue[]): DeviceDescription {
  const ied = descendantsNamed(root, 'IED')[0];
  if (ied === undefined) {
    issues.push({ line: root.line, messageKey: 'definition.xmlDevice.issue.noIed' });
  }

  const entries: DeviceIdentityEntry[] = [];
  const configVersion = ied === undefined ? undefined : attribute(ied, 'configVersion');
  const type = ied === undefined ? undefined : attribute(ied, 'type');
  if (type !== undefined) entries.push({ label: 'type', value: type });
  if (configVersion !== undefined) entries.push({ label: 'configVersion', value: configVersion });

  const items: DeviceItem[] = [];
  for (const logicalDevice of descendantsNamed(root, 'LDevice')) {
    const ldInst = attribute(logicalDevice, 'inst') ?? '';
    for (const node of [...descendantsNamed(logicalDevice, 'LN0'), ...descendantsNamed(logicalDevice, 'LN')]) {
      const lnName = `${attribute(node, 'prefix') ?? ''}${attribute(node, 'lnClass') ?? ''}${
        attribute(node, 'inst') ?? ''
      }`;
      for (const doi of descendantsNamed(node, 'DOI')) {
        const doName = attribute(doi, 'name') ?? '';
        const dais = descendantsNamed(doi, 'DAI');
        if (dais.length === 0) {
          items.push({
            id: `${ldInst}/${lnName}.${doName}`,
            name: doName,
            group: 'data-object',
            dataType: attribute(node, 'lnType') ?? '',
          });
          continue;
        }
        for (const dai of dais) {
          const daName = attribute(dai, 'name') ?? '';
          const value = firstChild(dai, 'Val');
          items.push({
            id: `${ldInst}/${lnName}.${doName}.${daName}`,
            name: `${doName}.${daName}`,
            group: 'data-object',
            dataType: attribute(node, 'lnType') ?? '',
            ...optional('defaultValue', value?.text),
            ...optional('description', attribute(doi, 'desc')),
          });
        }
      }
    }
  }

  return {
    format: 'scl',
    vendor: ied === undefined ? '' : (attribute(ied, 'manufacturer') ?? ''),
    device: ied === undefined ? '' : (attribute(ied, 'name') ?? ''),
    identity: entries,
    items,
  };
}

/**
 * Biçim kök öğeden seçilir ve ilgili okuyucuya verilir. Kök tanınmıyorsa
 * "belki GSDML'dir" diye denemek yok: yanlış okuyucu boş bir tablo üretip
 * dosyayı "boş" gibi gösterirdi.
 */
export function parseDeviceDescription(text: string): DeviceDescriptionResult {
  const parsed = parseXml(text);
  if (!parsed.success) {
    return { success: false, issues: [{ line: parsed.line, messageKey: parsed.messageKey }] };
  }

  const issues: DeviceDescriptionIssue[] = [];
  const rootName = parsed.root.localName;

  let description: DeviceDescription;
  if (rootName === 'ISO15745ProfileContainer' || rootName === 'ISO15745Profile') {
    description = readGsdml(parsed.root, issues);
  } else if (rootName === 'IODevice') {
    description = readIodd(parsed.root, issues);
  } else if (rootName === 'SCL') {
    description = readScl(parsed.root, issues);
  } else {
    return {
      success: false,
      issues: [
        { line: parsed.root.line, messageKey: 'definition.xmlDevice.issue.unknownFormat', text: rootName },
      ],
    };
  }

  if (description.items.length === 0) {
    issues.push({ line: 0, messageKey: 'definition.xmlDevice.issue.noItems' });
    return { success: false, issues };
  }

  return { success: true, description, issues };
}

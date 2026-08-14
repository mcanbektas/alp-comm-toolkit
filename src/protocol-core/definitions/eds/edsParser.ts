/**
 * EDS metin çözümleyicisi — `.eds` dosyası (INI biçimi) → `EdsDatabase`.
 *
 * `dbcParser.ts`in HOŞGÖRÜLÜ deseninin BİREBİR karşılığı: tanımadığı bölümü
 * yok sayıp uyarı üretir, dosyayı reddetmez (spec §47 "hatalı veride
 * uygulamayı çökertme").
 *
 * Desteklenen bölümler: `[FileInfo]`, `[DeviceInfo]`, Object Dictionary
 * girdileri (`[XXXX]` / `[XXXXsubYY]`, X hex hane). Bilinçli SESSİZCE atlanan
 * (uyarı değil — bunlar EDS'in normal iskeletidir, DBC'nin `NS_`/`BS_` liste
 * gövdelerini atlamasıyla aynı gerekçe): `[MandatoryObjects]`,
 * `[OptionalObjects]`, `[ManufacturerObjects]`, `[Comments]`, `[DummyUsage]`,
 * `[DeviceComissioning]` — bunlar yalnız HANGİ index'lerin var olduğunu SAYAR,
 * asıl alanlar zaten kendi `[XXXX]` bölümünde ayrıca durur; ikinci kez
 * okumak gereksiz kopya olurdu.
 *
 * TUZAK — SATIR SONU: DBC gibi EDS dosyaları da çoğunlukla Windows'ta
 * üretilir. `\r` kırpılmazsa `ParameterName` değerleri görünmez karakterle biter.
 */

import type {
  EdsDatabase,
  EdsObject,
  EdsParseIssue,
  EdsParseResult,
} from './edsTypes';

const ISSUE_TEXT_LIMIT = 120;
const HEX_RADIX = 16;
const DECIMAL_RADIX = 10;

/**
 * Sorun sebepleri ÇEVİRİ ANAHTARIDIR (CLAUDE.md): görünen hiçbir metin koda
 * gömülmez. Yer tutucu yok; satır numarası ve ham metin ayrı alanlarda taşınır.
 */
const ISSUE_EMPTY_INPUT = 'definition.eds.issue.emptyInput';
const ISSUE_NO_OBJECTS = 'definition.eds.issue.noObjects';
const ISSUE_MALFORMED_LINE = 'definition.eds.issue.malformedLine';
const ISSUE_UNSUPPORTED_SECTION = 'definition.eds.issue.unsupportedSection';
const ISSUE_DUPLICATE_OBJECT = 'definition.eds.issue.duplicateObject';

/** Sessizce atlanan (uyarı YOK) yapısal liste bölümleri — dosya başı. */
const STRUCTURAL_LIST_SECTIONS = new Set([
  'mandatoryobjects',
  'optionalobjects',
  'manufacturerobjects',
  'comments',
  'dummyusage',
  'devicecomissioning',
]);

const SECTION_PATTERN = /^\[([^\]]*)\]$/;
/** `[XXXX]` ya da `[XXXXsubYY]` — X hex hane (index), Y ondalık hane (sub-index). */
const OBJECT_SECTION_PATTERN = /^([0-9A-Fa-f]{4})(?:sub([0-9]+))?$/i;
const KEY_VALUE_PATTERN = /^([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.*)$/;

type SectionKind = 'file-info' | 'device-info' | 'object' | 'skip' | 'none';

interface ObjectAccumulator {
  index: number;
  subIndex: number | undefined;
  parameterName: string;
  objectType: number | undefined;
  dataType: number | undefined;
  accessType: string | undefined;
  defaultValue: string | undefined;
  lowLimit: string | undefined;
  highLimit: string | undefined;
  pdoMapping: boolean | undefined;
}

function clip(text: string): string {
  const trimmed = text.trim();
  return trimmed.length <= ISSUE_TEXT_LIMIT ? trimmed : `${trimmed.slice(0, ISSUE_TEXT_LIMIT)}…`;
}

/** `0x...` hex ya da ondalık — DBC'nin `parseNumber`ıyla aynı hoşgörü, fallback yok (tespit edilemezse `undefined`). */
function parseEdsNumber(text: string): number | undefined {
  const trimmed = text.trim();
  const value = /^0x/i.test(trimmed)
    ? Number.parseInt(trimmed.slice(2), HEX_RADIX)
    : Number.parseInt(trimmed, DECIMAL_RADIX);
  return Number.isFinite(value) ? value : undefined;
}

function toObject(accumulator: ObjectAccumulator): EdsObject {
  return {
    index: accumulator.index,
    subIndex: accumulator.subIndex,
    parameterName: accumulator.parameterName,
    objectType: accumulator.objectType,
    dataType: accumulator.dataType,
    accessType: accumulator.accessType,
    defaultValue: accumulator.defaultValue,
    lowLimit: accumulator.lowLimit,
    highLimit: accumulator.highLimit,
    pdoMapping: accumulator.pdoMapping,
  };
}

function applyObjectKey(accumulator: ObjectAccumulator, key: string, value: string): void {
  switch (key.toLowerCase()) {
    case 'parametername':
      accumulator.parameterName = value;
      return;
    case 'objecttype':
      accumulator.objectType = parseEdsNumber(value);
      return;
    case 'datatype':
      accumulator.dataType = parseEdsNumber(value);
      return;
    case 'accesstype':
      accumulator.accessType = value.toLowerCase();
      return;
    case 'defaultvalue':
      accumulator.defaultValue = value;
      return;
    case 'lowlimit':
      accumulator.lowLimit = value;
      return;
    case 'highlimit':
      accumulator.highLimit = value;
      return;
    case 'pdomapping':
      accumulator.pdoMapping = value.trim() === '1';
      return;
    default:
      // SubNumber, CompactSubObj, ObjFlags, satıcı uzantıları… sinyal çözümünü
      // etkilemez, DBC'nin `BA_`sını sessizce atlamasıyla aynı gerekçe.
      return;
  }
}

/**
 * EDS metnini çözer. Fırlatmaz; bozuk satırlar `issues` olarak döner.
 *
 * `success: false` yalnız HİÇ Object Dictionary girdisi çıkarılamadığında
 * verilir — o durumda ekranda gösterilecek bir veritabanı yoktur.
 */
export function parseEds(text: string): EdsParseResult {
  const issues: EdsParseIssue[] = [];

  if (text.trim() === '') {
    return { success: false, issues: [{ line: 0, messageKey: ISSUE_EMPTY_INPUT }] };
  }

  const objects: ObjectAccumulator[] = [];
  const objectsByKey = new Map<string, ObjectAccumulator>();
  let fileName = '';
  let description = '';
  let vendorName = '';
  let productName = '';
  let section: SectionKind = 'none';
  let currentObject: ObjectAccumulator | null = null;
  const reportedUnsupported = new Set<string>();

  const rawLines = text.split('\n');
  for (let index = 0; index < rawLines.length; index += 1) {
    // CRLF tuzağı: `\r` kırpılmazsa değerler görünmez karakter taşır.
    const line = (rawLines[index] ?? '').replace(/\r$/, '');
    const trimmed = line.trim();
    const lineNumber = index + 1;
    if (trimmed === '' || trimmed.startsWith(';')) continue;

    const sectionMatch = SECTION_PATTERN.exec(trimmed);
    if (sectionMatch !== null) {
      const name = sectionMatch[1] ?? '';
      const lower = name.toLowerCase();
      currentObject = null;

      if (lower === 'fileinfo') {
        section = 'file-info';
        continue;
      }
      if (lower === 'deviceinfo') {
        section = 'device-info';
        continue;
      }

      const objectMatch = OBJECT_SECTION_PATTERN.exec(name);
      if (objectMatch !== null) {
        const objIndex = Number.parseInt(objectMatch[1] ?? '0', HEX_RADIX);
        const objSubIndex =
          objectMatch[2] === undefined ? undefined : Number.parseInt(objectMatch[2], DECIMAL_RADIX);
        const key = `${String(objIndex)}-${String(objSubIndex)}`;
        const accumulator: ObjectAccumulator = {
          index: objIndex,
          subIndex: objSubIndex,
          parameterName: '',
          objectType: undefined,
          dataType: undefined,
          accessType: undefined,
          defaultValue: undefined,
          lowLimit: undefined,
          highLimit: undefined,
          pdoMapping: undefined,
        };
        if (objectsByKey.has(key)) {
          issues.push({ line: lineNumber, messageKey: ISSUE_DUPLICATE_OBJECT, text: clip(trimmed) });
        } else {
          objectsByKey.set(key, accumulator);
        }
        objects.push(accumulator);
        currentObject = accumulator;
        section = 'object';
        continue;
      }

      if (STRUCTURAL_LIST_SECTIONS.has(lower)) {
        section = 'skip';
        continue;
      }

      section = 'skip';
      if (!reportedUnsupported.has(lower)) {
        reportedUnsupported.add(lower);
        issues.push({ line: lineNumber, messageKey: ISSUE_UNSUPPORTED_SECTION, text: clip(name) });
      }
      continue;
    }

    const kvMatch = KEY_VALUE_PATTERN.exec(trimmed);
    if (kvMatch === null) {
      if (section !== 'skip' && section !== 'none') {
        issues.push({ line: lineNumber, messageKey: ISSUE_MALFORMED_LINE, text: clip(trimmed) });
      }
      continue;
    }
    const key = kvMatch[1] ?? '';
    const value = (kvMatch[2] ?? '').trim();

    switch (section) {
      case 'file-info':
        if (key.toLowerCase() === 'filename') fileName = value;
        else if (key.toLowerCase() === 'description') description = value;
        continue;
      case 'device-info':
        if (key.toLowerCase() === 'vendorname') vendorName = value;
        else if (key.toLowerCase() === 'productname') productName = value;
        continue;
      case 'object':
        if (currentObject !== null) applyObjectKey(currentObject, key, value);
        continue;
      case 'skip':
      case 'none':
        continue;
      default:
        continue;
    }
  }

  if (objects.length === 0) {
    return { success: false, issues: [...issues, { line: 0, messageKey: ISSUE_NO_OBJECTS }] };
  }

  const database: EdsDatabase = {
    fileInfo: { fileName, description },
    deviceInfo: { vendorName, productName },
    objects: objects.map(toObject),
  };
  return { success: true, database, issues };
}

/** Index/sub-index çiftine göre Object Dictionary girdisi arar. */
export function findEdsObject(
  database: EdsDatabase,
  index: number,
  subIndex: number | undefined,
): EdsObject | undefined {
  return database.objects.find((object) => object.index === index && object.subIndex === subIndex);
}

/**
 * GSD metin çözümleyicisi — `.gsd` dosyası → `GsdDatabase`.
 *
 * `edsParser.ts`/`xifParser.ts`in HOŞGÖRÜLÜ deseninin karşılığı: tanımadığı
 * satırı yok sayıp gerektiğinde uyarı üretir, dosyayı reddetmez (spec §47
 * "hatalı veride uygulamayı çökertme"). Bölüm makinesi pyprofibus'un dört
 * durumuyla aynı (global · PrmText · ExtUserPrmData · Module) ve bir beşincisi
 * eklendi: `UnitDiagType`.
 *
 * ── TANINMAYAN GLOBAL ANAHTAR İÇİN UYARI ÜRETİLMEZ ──────────────────────────
 * pyprofibus tanımadığı her satıra "Ignored unknown line" basıyor. Burada bu
 * BİLEREK yapılmadı: GSD'nin anahtar sözcük dağarcığı iki yüzün üstünde ve her
 * revizyonda büyüyor (S'in listesinde yalnız `Reaction_Delay_*` ve `Isochron_*`
 * aileleri onlarca satır tutuyor). Bu motor dağarcığın panelde gösterilen
 * altkümesini modelliyor; modellenmeyen HER anahtara uyarı basmak gerçek bir
 * dosyada yüzlerce satırlık gürültü üretirdi ve gerçek sorunları görünmez
 * yapardı. Uyarı yalnız GERÇEK sorunlara ayrıldı: bozuk satır, kapanmamış
 * bölüm, çözülemeyen kimlik baytı, var olmayan tanıma referans, sınırı aşan
 * modül, tekrar eden modül referansı.
 *
 * ── TUZAK 1: BÖLÜM KAPATICILARI BÜYÜK/KÜÇÜK HARFE DUYARSIZ ──────────────────
 * ÖLÇÜLDÜ: Eurotherm TC3001'in gerçek dosyası bloğu `EndModule` ile DEĞİL
 * `Endmodule` ile kapatıyor. Duyarlı bir karşılaştırma o dosyada bölümü hiç
 * kapatmaz ve dosyanın geri kalanını modülün içine yutar. Anahtar sözcükler
 * bu yüzden BAŞTAN SONA küçük harfe indirilerek karşılaştırılıyor.
 *
 * ── TUZAK 2: YORUM `;` TIRNAĞIN İÇİNDE OLABİLİR ─────────────────────────────
 * `;` satırın kalanını yorum yapar ama bir dize DEĞERİNİN içinde geçebilir
 * (`Info_Text="… , v1.x"` gibi metinler ayraç taşıyor). Yorum bu yüzden
 * karakter karakter, TIRNAK DURUMU izlenerek kırpılır — kaba bir
 * `replace(/;.*$/)` gerçek `Info_Text`leri ortadan keserdi.
 *
 * ── TUZAK 3: SATIR SONU VE AYRAÇ ────────────────────────────────────────────
 * GSD dosyaları Windows araçlarıyla üretilir; ölçüldü, elde edilen 14 dosyanın
 * 11'i CRLF taşıyor ve bazıları alan ayracı olarak TAB kullanıyor
 * (`DPV1_Slave \t = 1`). `\r` kırpılmazsa `EndModule` karşılaştırması ve dize
 * değerleri görünmez karakterle bozulur.
 *
 * ── KİMLİK BAYTI: KONUMLA DEĞİL, BAYT BAYT YÜRÜNEREK ────────────────────────
 * Modülün konfigürasyon baytları SABİT UZUNLUKLU DEĞİLDİR: genel biçimli bir
 * bayt kendi başına yeterlidir, özel biçimli bir bayt kendinden sonra 0-2
 * uzunluk baytı ve 0-15 üreticiye özel bayt tüketir ve ikisi AYNI modülde
 * ardışık kullanılabilir (PROFIdrive'ın PKW+PZD telgrafları böyledir). Bu
 * yüzden diziye konumla değil YÜRÜYEREK bakılır; baytlar bir bildirimin
 * ortasında biterse `truncated` işaretlenir ve uzunluk UYDURULMAZ.
 */

import type {
  GsdBaudRate,
  GsdConfigDecode,
  GsdDatabase,
  GsdDevice,
  GsdDiagnosisText,
  GsdExtUserPrmData,
  GsdIoBlock,
  GsdModule,
  GsdParseIssue,
  GsdParseResult,
  GsdPrmDataConst,
  GsdPrmDataRef,
  GsdPrmDataType,
  GsdPrmText,
  GsdPrmTextValue,
} from './gsdTypes';

const ISSUE_TEXT_LIMIT = 120;
const DECIMAL_RADIX = 10;
const HEX_RADIX = 16;
/** Bozuk satır uyarısı sel olmasın: ilk bu kadarı basılır, sonrası susar. */
const MALFORMED_LINE_LIMIT = 5;

/**
 * Sorun sebepleri ÇEVİRİ ANAHTARIDIR (CLAUDE.md): görünen hiçbir metin koda
 * gömülmez. Satır numarası ve ham metin ayrı alanlarda taşınır.
 */
const ISSUE_EMPTY_INPUT = 'definition.gsd.issue.emptyInput';
const ISSUE_NOT_GSD = 'definition.gsd.issue.notGsd';
const ISSUE_NO_MODULES = 'definition.gsd.issue.noModules';
const ISSUE_MALFORMED_LINE = 'definition.gsd.issue.malformedLine';
const ISSUE_UNCLOSED_SECTION = 'definition.gsd.issue.unclosedSection';
const ISSUE_TRUNCATED_CONFIG = 'definition.gsd.issue.truncatedConfig';
const ISSUE_UNKNOWN_PRM_TEXT_REF = 'definition.gsd.issue.unknownPrmTextRef';
const ISSUE_UNKNOWN_PRM_DATA_REF = 'definition.gsd.issue.unknownPrmDataRef';
const ISSUE_MODULE_EXCEEDS_LIMIT = 'definition.gsd.issue.moduleExceedsLimit';
const ISSUE_DUPLICATE_MODULE_REFERENCE = 'definition.gsd.issue.duplicateModuleReference';

/** Biçim işareti — dosyanın GSD olduğunu söyleyen tek kesin kanıt. */
const FORMAT_MARKER = '#profibus_dp';

/**
 * `Anahtar = Değer`. Anahtarda nokta (`MaxTsdr_9.6`), `@` (değerde) ve rakamla
 * başlama (`9.6_supp`, `24V_Pins`) GERÇEK dosyalarda var — kalıp buna göre.
 */
const KEY_VALUE_PATTERN = /^([A-Za-z0-9_.]+)\s*(?:\(\s*(0x[0-9A-Fa-f]+|\d+)\s*\))?\s*=\s*(.*)$/;

/**
 * `Module = "ad" baytlar` — ad tırnaklı, baytlar virgül/boşlukla ayrık.
 *
 * `=` İSTEĞE BAĞLI: elde edilen 14 gerçek dosyanın hepsi `=` yazıyor ama F'nin
 * yayımlanmış örneği eşitliksiz (`Module "Demo-Module" 0x00`). Bir karakterlik
 * hoşgörü, yazımı böyle olan bir dosyanın bütün modüllerini kaybetmeye yeğdir.
 */
const MODULE_PATTERN = /^Module\s*=?\s*"([^"]*)"\s*(.*)$/i;

/** `ExtUserPrmData = n "ad"`. */
const EXT_USER_PRM_DATA_PATTERN = /^ExtUserPrmData\s*=\s*(0x[0-9A-Fa-f]+|\d+)\s*"([^"]*)"\s*$/i;

/** Tip satırı: `Bit(0) 0 0-1` · `BitArea(2-3) 1 1-1` · `Unsigned16 100 10-65535`. */
const PRM_TYPE_PATTERN =
  /^(Bit|BitArea|Unsigned8|Unsigned16|Unsigned32|Signed8|Signed16|Signed32)\s*(?:\(\s*(\d+)\s*(?:-\s*(\d+)\s*)?\))?\s*(\S+)?\s*(?:(\S+)\s*-\s*(\S+))?\s*$/i;

/** Çıplak tam sayı satırı — modül bloğunda `Module_Reference`. */
const BARE_INTEGER_PATTERN = /^\d+$/;

const PRM_DATA_TYPE_BY_KEYWORD: Readonly<Record<string, GsdPrmDataType>> = {
  bit: 'bit',
  bitarea: 'bit-area',
  unsigned8: 'unsigned8',
  unsigned16: 'unsigned16',
  unsigned32: 'unsigned32',
  signed8: 'signed8',
  signed16: 'signed16',
  signed32: 'signed32',
};

/**
 * GSD'nin hız etiketleri. Anahtarlar `<etiket>_supp` ve `MaxTsdr_<etiket>`
 * olarak kurulur; sıra hız sırasıdır ve tabloda da bu sırayla gösterilir.
 */
const BAUD_RATE_LABELS: readonly string[] = [
  '9.6',
  '19.2',
  '45.45',
  '93.75',
  '187.5',
  '500',
  '1.5M',
  '3M',
  '6M',
  '12M',
];

function clip(text: string): string {
  const trimmed = text.trim();
  return trimmed.length <= ISSUE_TEXT_LIMIT ? trimmed : `${trimmed.slice(0, ISSUE_TEXT_LIMIT)}…`;
}

/**
 * Yorumu kırpar. `;` satırın kalanını yorum yapar AMA çift tırnak içindeyken
 * yapmaz — gerçek `Info_Text` değerleri ayraç taşıyor (dosya başı, tuzak 2).
 */
function stripComment(line: string): string {
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (character === ';' && !inQuotes) return line.slice(0, index);
  }
  return line;
}

/** `0x…` ya da ondalık; ikisi de değilse `undefined`. Değer UYDURULMAZ. */
function parseNumber(token: string | undefined): number | undefined {
  if (token === undefined) return undefined;
  const trimmed = token.trim();
  if (trimmed === '') return undefined;
  const isHex = /^0x[0-9A-Fa-f]+$/.test(trimmed);
  if (!isHex && !/^[-+]?\d+$/.test(trimmed)) return undefined;
  const value = Number.parseInt(trimmed, isHex ? HEX_RADIX : DECIMAL_RADIX);
  return Number.isFinite(value) ? value : undefined;
}

/** Boolean anahtarlar GSD'de 0/1'dir; başka bir değer `undefined` bırakılır. */
function parseBoolean(token: string | undefined): boolean | undefined {
  const value = parseNumber(token);
  return value === undefined ? undefined : value !== 0;
}

/** Tırnaklı değerin içini alır; tırnaksızsa değerin kendisini döndürür. */
function parseQuoted(value: string): string {
  const match = /^"([^"]*)"/.exec(value.trim());
  return match === null ? value.trim() : (match[1] ?? '');
}

/** `0x01, 0x02 0x03` → `[1, 2, 3]`. Sayıya çevrilemeyen belirteç ATLANIR. */
function parseByteList(value: string): readonly number[] {
  const bytes: number[] = [];
  for (const token of value.split(/[\s,]+/)) {
    if (token === '') continue;
    const parsed = parseNumber(token);
    if (parsed !== undefined) bytes.push(parsed & 0xff);
  }
  return bytes;
}

/**
 * Modülün kimlik (konfigürasyon) baytlarını çözer.
 *
 * S'in bit haritası — GENEL biçim:
 *   bit 7    tutarlılık: 0 bayt/word başına · 1 bildirilen uzunluğun tamamı
 *   bit 6    0 bayt · 1 word
 *   bit 5-4  00 ÖZEL biçim · 01 giriş · 10 çıkış · 11 giriş+çıkış
 *   bit 3-0  uzunluk − 1 (0000 = 1 birim … 1111 = 16 birim)
 *
 * ÖZEL biçim — ilk bayt:
 *   bit 7-6  00 boş yer · 01 sonraki bayt GİRİŞİ tarif eder · 10 sonraki bayt
 *            ÇIKIŞI tarif eder · 11 önce ÇIKIŞ sonra GİRİŞ baytı gelir
 *   bit 5-4  00 (özel biçim işareti)
 *   bit 3-0  ardından gelen üreticiye özel bayt sayısı
 * ve her uzunluk baytı:
 *   bit 7    tutarlılık · bit 6  0 bayt / 1 word · bit 5-0  uzunluk − 1
 *            (0 = 1 birim … 63 = 64 birim — GENEL biçimden DAHA GENİŞ alan)
 *
 * Dışa açık: birim testleri bu çözümü tek başına sınayabilsin diye.
 */
export function decodeGsdConfigBytes(bytes: readonly number[]): GsdConfigDecode {
  const blocks: GsdIoBlock[] = [];
  const manufacturerBytes: number[] = [];
  let cursor = 0;
  let truncated = false;

  const pushBlock = (
    direction: GsdIoBlock['direction'],
    lengthByte: number,
    format: GsdIoBlock['format'],
  ): void => {
    // Genel biçimde uzunluk 4 bit, özelde 6 bit — alan genişliği biçime bağlı.
    const countMask = format === 'special' ? 0x3f : 0x0f;
    const count = (lengthByte & countMask) + 1;
    const unit = (lengthByte & 0x40) === 0 ? 'byte' : 'word';
    blocks.push({
      direction,
      unit,
      count,
      lengthBytes: unit === 'word' ? count * 2 : count,
      consistency: (lengthByte & 0x80) === 0 ? 'unit' : 'whole',
      format,
    });
  };

  while (cursor < bytes.length) {
    const identifier = bytes[cursor] ?? 0;
    const ioSelector = (identifier >> 4) & 0x03;

    if (ioSelector !== 0) {
      // Genel biçim: tek bayt hem yönü hem uzunluğu taşır.
      if ((ioSelector & 0x01) !== 0) pushBlock('input', identifier, 'general');
      if ((ioSelector & 0x02) !== 0) pushBlock('output', identifier, 'general');
      cursor += 1;
      continue;
    }

    // Özel biçim.
    const manufacturerLength = identifier & 0x0f;
    const directionSelector = (identifier >> 6) & 0x03;
    cursor += 1;

    const directions: GsdIoBlock['direction'][] =
      directionSelector === 1
        ? ['input']
        : directionSelector === 2
          ? ['output']
          : directionSelector === 3
            ? ['output', 'input']
            : [];

    for (const direction of directions) {
      const lengthByte = bytes[cursor];
      if (lengthByte === undefined) {
        truncated = true;
        break;
      }
      cursor += 1;
      pushBlock(direction, lengthByte, 'special');
    }
    if (truncated) break;

    if (cursor + manufacturerLength > bytes.length) {
      truncated = true;
      break;
    }
    manufacturerBytes.push(...bytes.slice(cursor, cursor + manufacturerLength));
    cursor += manufacturerLength;
  }

  const sum = (direction: GsdIoBlock['direction']): number =>
    blocks
      .filter((block) => block.direction === direction)
      .reduce((total, block) => total + block.lengthBytes, 0);

  return {
    blocks,
    manufacturerBytes,
    inputLengthBytes: sum('input'),
    outputLengthBytes: sum('output'),
    truncated,
  };
}

/** Ayrıştırma sırasında biriken, henüz dondurulmamış modül. */
interface ModuleDraft {
  name: string;
  configBytes: readonly number[];
  moduleReference: number | undefined;
  preset: boolean;
  infoText: string;
  extModulePrmDataLength: number | undefined;
  parameterRefs: GsdPrmDataRef[];
  parameterConstants: GsdPrmDataConst[];
  line: number;
}

/** Ayrıştırma sırasında biriken parametre tanımı. */
interface PrmDataDraft {
  reference: number;
  name: string;
  dataType: GsdPrmDataType | undefined;
  rawType: string;
  bitFrom: number | undefined;
  bitTo: number | undefined;
  defaultValue: number | undefined;
  minValue: number | undefined;
  maxValue: number | undefined;
  prmTextReference: number | undefined;
  line: number;
}

type Section = 'global' | 'prm-text' | 'ext-user-prm-data' | 'module' | 'unit-diag';

/** Tip satırını çözer; tanınmazsa tip `undefined` kalır, ham satır saklanır. */
function applyTypeLine(draft: PrmDataDraft, line: string): boolean {
  const match = PRM_TYPE_PATTERN.exec(line.trim());
  if (match === null) return false;

  const keyword = (match[1] ?? '').toLowerCase();
  const dataType = PRM_DATA_TYPE_BY_KEYWORD[keyword];
  const bitFrom = parseNumber(match[2]);
  // `Bit(n)` tek bit kaplar: bitiş de `n`dir. `BitArea(a-b)`de `b` ayrı gelir.
  const bitTo = parseNumber(match[3]) ?? bitFrom;

  draft.dataType = dataType;
  draft.rawType = line.trim();
  draft.bitFrom = bitFrom;
  draft.bitTo = bitTo;
  draft.defaultValue = parseNumber(match[4]);
  draft.minValue = parseNumber(match[5]);
  draft.maxValue = parseNumber(match[6]);
  return true;
}

/**
 * GSD metnini çözer. Fırlatmaz; bozuk satırlar `issues` olarak döner.
 *
 * `success: false` yalnız dosya bir GSD DEĞİLSE verilir (`gsdTypes.ts`teki
 * `GsdParseResult` gerekçesi: `#Profibus_DP` işareti kesin bir dosya tipi
 * kanıtıdır, modül sayısı değil).
 */
export function parseGsd(text: string): GsdParseResult {
  const issues: GsdParseIssue[] = [];

  if (text.trim() === '') {
    return { success: false, issues: [{ line: 0, messageKey: ISSUE_EMPTY_INPUT }] };
  }

  // CRLF tuzağı (dosya başı, tuzak 3).
  const lines = text.split('\n').map((line) => line.replace(/\r$/, ''));

  const globals = new Map<string, string>();
  const prmTexts: GsdPrmText[] = [];
  const parameterDefinitions: GsdExtUserPrmData[] = [];
  const modules: GsdModule[] = [];
  const diagnosisTexts: GsdDiagnosisText[] = [];
  const deviceParameterRefs: GsdPrmDataRef[] = [];
  const deviceParameterConstants: GsdPrmDataConst[] = [];
  let userPrmData: readonly number[] = [];

  let formatMarkerSeen = false;
  let malformedCount = 0;
  let section: Section = 'global';

  let prmTextDraft: { reference: number; values: GsdPrmTextValue[]; line: number } | null = null;
  let prmDataDraft: PrmDataDraft | null = null;
  let moduleDraft: ModuleDraft | null = null;
  let unitDiagType: number | undefined;

  const reportMalformed = (lineNumber: number, raw: string): void => {
    if (malformedCount >= MALFORMED_LINE_LIMIT) return;
    malformedCount += 1;
    issues.push({ line: lineNumber, messageKey: ISSUE_MALFORMED_LINE, text: clip(raw) });
  };

  const closePrmText = (): void => {
    if (prmTextDraft === null) return;
    prmTexts.push({
      reference: prmTextDraft.reference,
      values: prmTextDraft.values,
      line: prmTextDraft.line,
    });
    prmTextDraft = null;
  };

  const closePrmData = (): void => {
    if (prmDataDraft === null) return;
    parameterDefinitions.push({ ...prmDataDraft });
    prmDataDraft = null;
  };

  const closeModule = (): void => {
    if (moduleDraft === null) return;
    const config = decodeGsdConfigBytes(moduleDraft.configBytes);
    if (config.truncated) {
      issues.push({
        line: moduleDraft.line,
        messageKey: ISSUE_TRUNCATED_CONFIG,
        text: clip(moduleDraft.name),
      });
    }
    modules.push({
      name: moduleDraft.name,
      configBytes: moduleDraft.configBytes,
      moduleReference: moduleDraft.moduleReference,
      preset: moduleDraft.preset,
      infoText: moduleDraft.infoText,
      extModulePrmDataLength: moduleDraft.extModulePrmDataLength,
      parameterRefs: moduleDraft.parameterRefs,
      parameterConstants: moduleDraft.parameterConstants,
      config,
      line: moduleDraft.line,
    });
    moduleDraft = null;
  };

  /** Bir bölüm açılırken öncekinin kapanmadığını fark ederse uyarır. */
  const closeAnyOpenSection = (lineNumber: number): void => {
    if (prmTextDraft !== null || prmDataDraft !== null || moduleDraft !== null) {
      issues.push({ line: lineNumber, messageKey: ISSUE_UNCLOSED_SECTION });
    }
    closePrmText();
    closePrmData();
    closeModule();
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? '';
    const line = stripComment(rawLine).trim();
    const lineNumber = index + 1;
    if (line === '') continue;

    const lowered = line.toLowerCase();

    // Biçim işareti — bölümden bağımsız, dosyanın herhangi bir yerinde olabilir.
    if (lowered === FORMAT_MARKER) {
      formatMarkerSeen = true;
      continue;
    }

    // ── Bölüm kapatıcıları: BÜYÜK/KÜÇÜK HARFE DUYARSIZ (dosya başı, tuzak 1) ─
    if (lowered === 'endprmtext') {
      closePrmText();
      section = 'global';
      continue;
    }
    if (lowered === 'endextuserprmdata') {
      closePrmData();
      section = 'global';
      continue;
    }
    if (lowered === 'endmodule') {
      closeModule();
      section = 'global';
      continue;
    }
    if (lowered === 'endunitdiagtype') {
      unitDiagType = undefined;
      section = 'global';
      continue;
    }
    // Alan sınırı satırları taşıyıcıdır, değer taşımaz — sessizce geçilir.
    if (lowered === 'x_unit_diag_area_end') continue;

    // ── Modül bloğu açılışı ────────────────────────────────────────────────
    const moduleMatch = MODULE_PATTERN.exec(line);
    if (moduleMatch !== null) {
      closeAnyOpenSection(lineNumber);
      moduleDraft = {
        name: moduleMatch[1] ?? '',
        configBytes: parseByteList(moduleMatch[2] ?? ''),
        moduleReference: undefined,
        preset: false,
        infoText: '',
        extModulePrmDataLength: undefined,
        parameterRefs: [],
        parameterConstants: [],
        line: lineNumber,
      };
      section = 'module';
      continue;
    }

    // ── ExtUserPrmData bloğu açılışı ───────────────────────────────────────
    const prmDataMatch = EXT_USER_PRM_DATA_PATTERN.exec(line);
    if (prmDataMatch !== null) {
      closeAnyOpenSection(lineNumber);
      prmDataDraft = {
        reference: parseNumber(prmDataMatch[1]) ?? 0,
        name: prmDataMatch[2] ?? '',
        dataType: undefined,
        rawType: '',
        bitFrom: undefined,
        bitTo: undefined,
        defaultValue: undefined,
        minValue: undefined,
        maxValue: undefined,
        prmTextReference: undefined,
        line: lineNumber,
      };
      section = 'ext-user-prm-data';
      continue;
    }

    const keyValue = KEY_VALUE_PATTERN.exec(line);
    const key = (keyValue?.[1] ?? '').toLowerCase();
    const argument = keyValue?.[2];
    const value = keyValue?.[3] ?? '';

    // ── PrmText bloğu açılışı ──────────────────────────────────────────────
    if (keyValue !== null && key === 'prmtext' && argument === undefined) {
      closeAnyOpenSection(lineNumber);
      prmTextDraft = { reference: parseNumber(value) ?? 0, values: [], line: lineNumber };
      section = 'prm-text';
      continue;
    }

    // ── UnitDiagType bloğu açılışı ─────────────────────────────────────────
    if (keyValue !== null && key === 'unitdiagtype' && argument === undefined) {
      closeAnyOpenSection(lineNumber);
      unitDiagType = parseNumber(value);
      section = 'unit-diag';
      continue;
    }

    if (keyValue === null) {
      // Modül bloğundaki ÇIPLAK tam sayı `Module_Reference`tır (S).
      if (section === 'module' && moduleDraft !== null && BARE_INTEGER_PATTERN.test(line)) {
        moduleDraft.moduleReference = parseNumber(line);
        continue;
      }
      // ExtUserPrmData bloğunda tip satırı `=` taşımaz.
      if (section === 'ext-user-prm-data' && prmDataDraft !== null) {
        if (applyTypeLine(prmDataDraft, line)) continue;
      }
      reportMalformed(lineNumber, rawLine);
      continue;
    }

    switch (section) {
      case 'prm-text': {
        // `Text(0) = "…"` — anahtar büyük/küçük harf karışık gelir (`TEXT`).
        if (key === 'text' && prmTextDraft !== null) {
          prmTextDraft.values.push({ value: parseNumber(argument) ?? 0, text: parseQuoted(value) });
          continue;
        }
        reportMalformed(lineNumber, rawLine);
        continue;
      }

      case 'ext-user-prm-data': {
        if (prmDataDraft === null) continue;
        if (key === 'prm_text_ref') {
          prmDataDraft.prmTextReference = parseNumber(value);
          continue;
        }
        // Tanınmayan anahtar sessizce geçilir (dosya başı gerekçesi).
        continue;
      }

      case 'unit-diag': {
        if (key === 'x_value') {
          diagnosisTexts.push({
            code: parseNumber(argument) ?? 0,
            text: parseQuoted(value),
            unitDiagType,
            line: lineNumber,
          });
        }
        continue;
      }

      case 'module': {
        if (moduleDraft === null) continue;
        switch (key) {
          case 'info_text':
            moduleDraft.infoText = parseQuoted(value);
            continue;
          case 'preset':
            moduleDraft.preset = parseBoolean(value) ?? false;
            continue;
          case 'ext_module_prm_data_len':
          case 'f_ext_module_prm_data_len':
            moduleDraft.extModulePrmDataLength = parseNumber(value);
            continue;
          case 'ext_user_prm_data_ref':
          case 'f_ext_user_prm_data_ref':
            moduleDraft.parameterRefs.push({
              offset: parseNumber(argument) ?? 0,
              reference: parseNumber(value) ?? 0,
              safety: key.startsWith('f_'),
            });
            continue;
          case 'ext_user_prm_data_const':
          case 'f_ext_user_prm_data_const':
            moduleDraft.parameterConstants.push({
              offset: parseNumber(argument) ?? 0,
              bytes: parseByteList(value),
              safety: key.startsWith('f_'),
            });
            continue;
          default:
            continue;
        }
      }

      case 'global':
      default: {
        switch (key) {
          case 'unit_diag_bit':
            diagnosisTexts.push({
              code: parseNumber(argument) ?? 0,
              text: parseQuoted(value),
              unitDiagType: undefined,
              line: lineNumber,
            });
            continue;
          case 'user_prm_data':
            userPrmData = parseByteList(value);
            continue;
          case 'ext_user_prm_data_ref':
          case 'f_ext_user_prm_data_ref':
            deviceParameterRefs.push({
              offset: parseNumber(argument) ?? 0,
              reference: parseNumber(value) ?? 0,
              safety: key.startsWith('f_'),
            });
            continue;
          case 'ext_user_prm_data_const':
          case 'f_ext_user_prm_data_const':
            deviceParameterConstants.push({
              offset: parseNumber(argument) ?? 0,
              bytes: parseByteList(value),
              safety: key.startsWith('f_'),
            });
            continue;
          default:
            // Global anahtarlar haritaya konur; tanınmayan anahtar UYARI ÜRETMEZ.
            globals.set(key, value.trim());
            continue;
        }
      }
    }
  }

  if (prmTextDraft !== null || prmDataDraft !== null || moduleDraft !== null) {
    issues.push({ line: lines.length, messageKey: ISSUE_UNCLOSED_SECTION });
    closePrmText();
    closePrmData();
    closeModule();
  }

  const vendorName = parseQuoted(globals.get('vendor_name') ?? '');
  if (!formatMarkerSeen && vendorName === '') {
    // Dosya bir GSD DEĞİL: ne biçim işareti ne de üretici adı var.
    return { success: false, issues: [...issues, { line: 0, messageKey: ISSUE_NOT_GSD }] };
  }

  const slaveFamilyRaw = globals.get('slave_family') ?? '';
  const familyParts = slaveFamilyRaw.split('@');

  const baudRates: GsdBaudRate[] = BAUD_RATE_LABELS.map((label) => ({
    label,
    supported: (parseBoolean(globals.get(`${label.toLowerCase()}_supp`)) ?? false) === true,
    maxTsdr: parseNumber(globals.get(`maxtsdr_${label.toLowerCase()}`)),
  }));

  const device: GsdDevice = {
    vendorName,
    modelName: parseQuoted(globals.get('model_name') ?? ''),
    revision: parseQuoted(globals.get('revision') ?? ''),
    hardwareRelease: parseQuoted(globals.get('hardware_release') ?? ''),
    softwareRelease: parseQuoted(globals.get('software_release') ?? ''),
    orderNumber: parseQuoted(globals.get('ordernumber') ?? ''),
    infoText: parseQuoted(globals.get('info_text') ?? ''),
    implementationType: parseQuoted(globals.get('implementation_type') ?? ''),
    identNumber: parseNumber(globals.get('ident_number')),
    gsdRevision: parseNumber(globals.get('gsd_revision')),
    protocolIdent: parseNumber(globals.get('protocol_ident')),
    stationType: parseNumber(globals.get('station_type')),
    slaveFamily: slaveFamilyRaw,
    slaveFamilyId: parseNumber(familyParts[0]),
    subFamilies: familyParts.slice(1).filter((part) => part !== ''),
    modularStation: parseBoolean(globals.get('modular_station')),
    maxModule: parseNumber(globals.get('max_module')),
    maxInputLength: parseNumber(globals.get('max_input_len')),
    maxOutputLength: parseNumber(globals.get('max_output_len')),
    maxDataLength: parseNumber(globals.get('max_data_len')),
    maxDiagDataLength: parseNumber(globals.get('max_diag_data_len')),
    minSlaveInterval: parseNumber(globals.get('min_slave_intervall')),
    maxUserPrmDataLength: parseNumber(globals.get('max_user_prm_data_len')),
    freezeModeSupported: parseBoolean(globals.get('freeze_mode_supp')),
    syncModeSupported: parseBoolean(globals.get('sync_mode_supp')),
    autoBaudSupported: parseBoolean(globals.get('auto_baud_supp')),
    failSafe: parseBoolean(globals.get('fail_safe')),
    dpv1Slave: parseBoolean(globals.get('dpv1_slave')),
    baudRates,
  };

  // ── Tutarlılık denetimleri ────────────────────────────────────────────────
  if (modules.length === 0) {
    issues.push({ line: 0, messageKey: ISSUE_NO_MODULES });
  }

  const prmTextReferences = new Set(prmTexts.map((entry) => entry.reference));
  for (const definition of parameterDefinitions) {
    if (
      definition.prmTextReference !== undefined &&
      !prmTextReferences.has(definition.prmTextReference)
    ) {
      issues.push({
        line: definition.line,
        messageKey: ISSUE_UNKNOWN_PRM_TEXT_REF,
        text: String(definition.prmTextReference),
      });
    }
  }

  const definitionReferences = new Set(parameterDefinitions.map((entry) => entry.reference));
  const checkRefs = (refs: readonly GsdPrmDataRef[], line: number): void => {
    for (const reference of refs) {
      if (definitionReferences.has(reference.reference)) continue;
      issues.push({
        line,
        messageKey: ISSUE_UNKNOWN_PRM_DATA_REF,
        text: String(reference.reference),
      });
    }
  };
  checkRefs(deviceParameterRefs, 0);

  const seenModuleReferences = new Set<number>();
  for (const module of modules) {
    checkRefs(module.parameterRefs, module.line);

    if (module.moduleReference !== undefined) {
      if (seenModuleReferences.has(module.moduleReference)) {
        issues.push({
          line: module.line,
          messageKey: ISSUE_DUPLICATE_MODULE_REFERENCE,
          text: String(module.moduleReference),
        });
      }
      seenModuleReferences.add(module.moduleReference);
    }

    // Tek bir modül dosyanın kendi bildirdiği sınırı aşamaz — aşıyorsa dosya
    // kendi kendisiyle çelişiyordur, motor değil.
    const overInput =
      device.maxInputLength !== undefined && module.config.inputLengthBytes > device.maxInputLength;
    const overOutput =
      device.maxOutputLength !== undefined &&
      module.config.outputLengthBytes > device.maxOutputLength;
    if (overInput || overOutput) {
      issues.push({
        line: module.line,
        messageKey: ISSUE_MODULE_EXCEEDS_LIMIT,
        text: clip(module.name),
      });
    }
  }

  const database: GsdDatabase = {
    device,
    prmTexts,
    parameterDefinitions,
    modules,
    diagnosisTexts,
    userPrmData,
    deviceParameterRefs,
    deviceParameterConstants,
  };
  return { success: true, database, issues };
}

/** Modül referansına göre modül arar (`findEdsObject` deseni). */
export function findGsdModule(database: GsdDatabase, reference: number): GsdModule | undefined {
  return database.modules.find((module) => module.moduleReference === reference);
}

/**
 * Bir parametre tanımının seçenek metinlerini çözer.
 *
 * `Prm_Text_Ref` yoksa ya da gösterdiği blok yoksa BOŞ döner — uydurma seçenek
 * üretilmez. Panel bu durumda ham varsayılan/aralık değerlerini gösterir.
 */
export function resolveGsdPrmTextValues(
  database: GsdDatabase,
  definition: GsdExtUserPrmData,
): readonly GsdPrmTextValue[] {
  if (definition.prmTextReference === undefined) return [];
  return (
    database.prmTexts.find((entry) => entry.reference === definition.prmTextReference)?.values ?? []
  );
}

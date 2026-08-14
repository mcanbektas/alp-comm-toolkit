/**
 * Spec §40'ın proje dosyası: kaydetme ve yükleme biçiminin tek tanımı.
 *
 * ## Neden `formatVersion` sarmalayıcısı
 *
 * §40 sürüm alanını dosyanın KÖKÜNDE, yükün dışında istiyor. Sebebi pratiktir:
 * yükün şekli sürümden sürüme değişebilir, ama sürümü okuyabilmek için önce
 * yükü çözümlemek gerekmemeli. Bu yüzden `parseProjectFile` sürümü, `project`
 * nesnesine hiç bakmadan doğrular.
 *
 * ## `savedAt`i modül ÜRETMEZ
 *
 * Zaman damgasını çağıran verir. `new Date()` burada çağrılsaydı serileştirme
 * saf olmaktan çıkar, testi ya saati sahtelemeye ya çıktının bir parçasını
 * görmezden gelmeye zorlardı. Çağıran zaten `toISOString()` üretebiliyor.
 *
 * ## Bilinmeyen alanlar
 *
 * §40 "Unknown field handling" istiyor. Seçim: bilinmeyen alanlar REDDEDİLMEZ,
 * SESSİZCE DÜŞÜRÜLÜR. Çözümleme tanıdığı alanlardan yeni bir nesne kurar; yani
 * ileri bir sürümün eklediği alanla kaydedilmiş bir dosya (aynı formatVersion
 * ile) hâlâ açılır, ama yeniden kaydedilirse o alanlar kaybolur. Katı ret,
 * kullanıcıyı dosyasından tamamen etmek olurdu.
 *
 * ## Gizlilik
 *
 * Proje dosyası kullanıcı verisidir; üretimi ve okunması tamamen istemcide olur,
 * sunucuya gönderilmez (spec §41).
 */

/** Bu modülün ürettiği tek sürüm. Okuma tarafı ileri sürümü ayrı hata olarak bildirir. */
export const PROJECT_FORMAT_VERSION = 1;

/** Packet Builder'da hazırlanmış, alan kimliğinden METİN değerine eşleme taşıyan şablon. */
export interface PacketTemplate {
  readonly id: string;
  readonly name: string;
  /** Şablonun bağlı olduğu şemanın `name` alanı — şema kimliği yok, ad taşınır. */
  readonly schemaName: string;
  /**
   * Değerler METİN olarak saklanır: kullanıcı alanları onaltılık, ondalık ya da
   * yarım yazılmış hâlde girebiliyor; sayıya çevirmek bu ayrımı ve girdinin
   * kendisini kaybettirirdi. Yorum ve dönüştürme Builder'ın işidir.
   */
  readonly values: Record<string, string>;
}

export interface ProjectPayload {
  readonly name: string;
  readonly description?: string;
  /** ISO 8601 metin. Çağıran üretir (bkz. dosya başı). */
  readonly savedAt: string;
  /** Şema JSON METİNLERİ — çözümlenmiş nesneler değil; store da metin saklıyor. */
  readonly protocols: readonly string[];
  readonly packetTemplates: readonly PacketTemplate[];
}

export interface ProjectFile {
  readonly formatVersion: 1;
  readonly project: ProjectPayload;
}

export type ProjectParseResult =
  | { readonly ok: true; readonly project: ProjectPayload }
  | { readonly ok: false; readonly errorKey: string; readonly detail?: string };

/**
 * İki boşluk girintili JSON: proje dosyası kullanıcının sürüm kontrolüne
 * koyabileceği bir metindir, tek satırlık çıktı `diff`i okunmaz hâle getirir.
 */
export function serializeProject(payload: ProjectPayload): string {
  const file: ProjectFile = { formatVersion: PROJECT_FORMAT_VERSION, project: payload };
  return JSON.stringify(file, null, 2);
}

function failure(errorKey: string, detail?: string): ProjectParseResult {
  return detail === undefined ? { ok: false, errorKey } : { ok: false, errorKey, detail };
}

/** JSON nesnesi mi — dizi ve `null` da `typeof 'object'` olduğundan ikisi de elenir. */
function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

/**
 * `Array.isArray` `unknown`ı `any[]`e daraltıyor — yani elemanlar sessizce
 * `any` oluyor. Bu sarmalayıcı daraltmayı `readonly unknown[]`te tutar, böylece
 * her eleman elle daraltılmak zorunda kalır.
 */
function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return isUnknownArray(value) && value.every((entry) => typeof entry === 'string');
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isJsonObject(value)) return false;
  for (const entry of Object.values(value)) {
    if (typeof entry !== 'string') return false;
  }
  return true;
}

type TemplateParseResult =
  | { readonly ok: true; readonly template: PacketTemplate }
  | { readonly ok: false; readonly detail: string };

/** Hata ayrıntısı dizinle birlikte verilir; 40 şablonluk dosyada hangisi bozuk, bilinsin. */
function parsePacketTemplate(value: unknown, index: number): TemplateParseResult {
  if (!isJsonObject(value)) return { ok: false, detail: `packetTemplates[${index}]` };
  if (!isNonEmptyString(value['id'])) return { ok: false, detail: `packetTemplates[${index}].id` };
  if (!isNonEmptyString(value['name'])) {
    return { ok: false, detail: `packetTemplates[${index}].name` };
  }
  if (!isNonEmptyString(value['schemaName'])) {
    return { ok: false, detail: `packetTemplates[${index}].schemaName` };
  }
  if (!isStringRecord(value['values'])) {
    return { ok: false, detail: `packetTemplates[${index}].values` };
  }

  return {
    ok: true,
    template: {
      id: value['id'],
      name: value['name'],
      schemaName: value['schemaName'],
      values: value['values'],
    },
  };
}

/**
 * `formatVersion` kapısı. Sürüm hatası ÜÇE ayrılıyor çünkü kullanıcının yapması
 * gereken şey her birinde farklı: "bu dosya proje dosyası değil", "uygulamayı
 * güncelle", "bu sürüm artık desteklenmiyor".
 */
function checkFormatVersion(raw: unknown): ProjectParseResult | undefined {
  if (raw === undefined) return failure('projects.error.missingVersion');
  if (typeof raw !== 'number' || !Number.isInteger(raw)) {
    return failure('projects.error.versionNotNumber', String(raw));
  }
  if (raw > PROJECT_FORMAT_VERSION) return failure('projects.error.futureVersion', String(raw));
  if (raw !== PROJECT_FORMAT_VERSION) {
    return failure('projects.error.unsupportedVersion', String(raw));
  }
  return undefined;
}

/**
 * Güvenilmeyen metni proje yüküne çevirir. Dosya kullanıcıdan ya da paylaşılan
 * bir projeden gelir; içeriğe GÜVENİLMEZ, her alan tek tek daraltılır (spec §40
 * "Schema validation, Version check, Error handling").
 *
 * Burada YALNIZ biçim doğrulanır. `protocols` metinlerinin gerçekten geçerli
 * şema olup olmadığına bakılmaz — o `parseProtocolSchemaJson`ın işi ve bu modül
 * zod'a bağlanmamalı (şema doğrulayıcısı bilerek ana barrel dışında tutuluyor).
 * Bozuk bir şema yüzünden bütün projeyi reddetmek de yanlış olurdu.
 */
export function parseProjectFile(text: string): ProjectParseResult {
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch (cause) {
    return failure(
      'projects.error.invalidJson',
      cause instanceof Error ? cause.message : String(cause),
    );
  }

  if (!isJsonObject(decoded)) return failure('projects.error.notAnObject');

  const versionFailure = checkFormatVersion(decoded['formatVersion']);
  if (versionFailure !== undefined) return versionFailure;

  const project = decoded['project'];
  if (!isJsonObject(project)) return failure('projects.error.missingProject');

  if (!isNonEmptyString(project['name'])) return failure('projects.error.invalidName');

  const description = project['description'];
  if (description !== undefined && typeof description !== 'string') {
    return failure('projects.error.invalidDescription');
  }

  const savedAt = project['savedAt'];
  // Yalnız "çözümlenebilir tarih" aranıyor, katı ISO profili değil: damgayı
  // çağıran `toISOString()` ile üretiyor, buradaki kontrol elle bozulmuş ya da
  // tamamen eksik değeri yakalamak için.
  if (!isNonEmptyString(savedAt) || Number.isNaN(Date.parse(savedAt))) {
    return failure('projects.error.invalidSavedAt');
  }

  const protocols = project['protocols'];
  if (!isStringArray(protocols)) return failure('projects.error.invalidProtocols');

  const rawTemplates = project['packetTemplates'];
  if (!isUnknownArray(rawTemplates)) return failure('projects.error.invalidPacketTemplates');

  const packetTemplates: PacketTemplate[] = [];
  for (const [index, rawTemplate] of rawTemplates.entries()) {
    const parsed = parsePacketTemplate(rawTemplate, index);
    if (!parsed.ok) return failure('projects.error.invalidPacketTemplate', parsed.detail);
    packetTemplates.push(parsed.template);
  }

  return {
    ok: true,
    // Yeniden kuruluyor, gelen nesne olduğu gibi verilmiyor: bilinmeyen alanlar
    // böylece düşer ve dönen değerin tipi çalışma zamanında da doğrudur.
    project: {
      name: project['name'],
      ...(description === undefined ? {} : { description }),
      savedAt,
      protocols,
      packetTemplates,
    },
  };
}

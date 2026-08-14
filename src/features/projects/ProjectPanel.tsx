/**
 * Proje kaydet/yükle paneli — spec §48'in "Proje JSON olarak kaydedilebilmeli"
 * kabul kriterinin ekran karşılığı.
 *
 * ## Neden iki ekranın ortak bileşeni
 *
 * Proje = ŞEMA + PAKET ŞABLONLARI. Şemayı Studio, şablonları Builder üretir;
 * kaydetme ikisinin de işi ama iki ayrı kopya iki ayrı dosya biçimi demekti.
 * Panel tek yerde durur, ekranlar yalnız yerleştirir.
 *
 * ## `new Date()` BURADA çağrılır
 *
 * Zaman damgası saf modülde (`projectFile`) ve store'da bilerek üretilmiyor;
 * ikisi de damgayı çağırandan alıyor. Saati okuyan tek yer bu bileşen: saf
 * tarafın testi saati sahtelemek zorunda kalmasın diye.
 *
 * ## Bu panel şemayı DOĞRULAMAZ
 *
 * `parseProjectFile` yalnız biçimi denetler. Yüklenen metnin geçerli bir şema
 * olup olmadığına Studio karar verir; bozuk bir şema yüzünden bütün projeyi
 * reddetmek kullanıcıyı dosyasından tamamen ederdi.
 *
 * ## Gizlilik
 *
 * Dosya tamamen istemcide üretilir ve okunur; hiçbir bayt sunucuya gitmez
 * (spec §41, CLAUDE.md "kullanıcı verisi yerelde kalır").
 */

import { useCallback, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { useProtocolSchemaStore } from '@/app/store/protocolSchemaStore';
import type { TranslationKey } from '@/translations';
import { downloadTextFile } from '@/utils/downloadTextFile';
import { readTextFile } from '@/utils/readTextFile';

import { parseProjectFile, serializeProject } from './projectFile';
import type { PacketTemplate } from './projectFile';

export interface ProjectPanelProps {
  readonly className?: string;
  /**
   * Verilmezse "uygula" düğmesi HİÇ çizilmez. Studio'nun şablon uygulayacak bir
   * formu yok; orada düğmeyi devre dışı göstermek "burada bir gün çalışacak"
   * yalanı olurdu (boş kart basmak yasak — CLAUDE.md).
   */
  readonly onApplyTemplate?: (template: PacketTemplate) => void;
}

/**
 * Panelin metin anahtarları.
 *
 * Değerler `string` olarak tutulup çağrı yerinde `as TranslationKey` ile
 * daraltılıyor — ekranların geri kalanındaki desenin aynısı (bkz.
 * `ProtocolStudioScreen`'deki `importErrorKey`). Sözlük bu anahtarları
 * kazandığında tek satır bile değişmez; tablo aynı zamanda "bu ekran hangi
 * metinleri istiyor" sorusunun tek adresi.
 */
type PanelTextKey =
  | 'privacy'
  | 'nameLabel'
  | 'save'
  | 'loadLabel'
  | 'loadedLabel'
  | 'templatesTitle'
  | 'templatesEmpty'
  | 'templateSchemaLabel'
  | 'applyTemplate'
  | 'removeTemplate';

const TEXT_KEYS: Readonly<Record<PanelTextKey, string>> = {
  privacy: 'projects.panel.privacy',
  nameLabel: 'projects.panel.nameLabel',
  save: 'projects.action.save',
  loadLabel: 'projects.action.load',
  loadedLabel: 'projects.panel.loadedLabel',
  templatesTitle: 'projects.panel.templatesTitle',
  templatesEmpty: 'projects.panel.templatesEmpty',
  templateSchemaLabel: 'projects.panel.templateSchemaLabel',
  applyTemplate: 'projects.action.applyTemplate',
  removeTemplate: 'projects.action.removeTemplate',
};

/** Dosya okunamadı — içerik HİÇ görülmedi; biçim reddiyle aynı şey değil. */
const FILE_READ_ERROR_KEY = 'projects.error.fileReadFailed';

/** İndirme başarısız (Blob URL yok): sessiz kalmak veri kaybını gizlerdi. */
const DOWNLOAD_ERROR_KEY = 'projects.error.downloadFailed';

/** Dosya adı sonekı ve MIME — kimliktir, çeviriye girmez. */
const FILE_NAME_SUFFIX = '.alp-comm-project.json';
const MIME_JSON = 'application/json';

const FALLBACK_SLUG = 'project';

/**
 * Türkçe harflerin ASCII karşılığı. Sabit tablo, üretilen dizge değil: "ş" için
 * `normalize('NFD')` denemesi "ş"i "s + çengel"e ayırmıyor (birleşik nokta) ve
 * ad sessizce boşalıyordu.
 */
const ASCII_FOLDING: Readonly<Record<string, string>> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  â: 'a',
  î: 'i',
  û: 'u',
};

/**
 * Proje adından dosya adı üretir. Ad kullanıcıdan geldiği için boşluk, Türkçe
 * harf ve yol ayıracı içerebilir; `/` bir indirme adında dizin gibi
 * yorumlanabildiğinden alfanümerik dışındaki her şey tireye iner.
 */
function slugifyProjectName(name: string): string {
  const folded = [...name.toLocaleLowerCase('tr')]
    .map((character) => ASCII_FOLDING[character] ?? character)
    .join('');
  const slug = folded.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug === '' ? FALLBACK_SLUG : slug;
}

interface PanelError {
  readonly errorKey: string;
  readonly detail?: string;
}

const PRIMARY_BUTTON_CLASS =
  'rounded-token border border-line-strong bg-accent px-3 py-1.5 text-sm text-on-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50';

const SMALL_BUTTON_CLASS =
  'rounded-token-sm border border-line bg-surface px-2 py-1 text-xs text-text transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

const INPUT_CLASS =
  'w-full rounded-token-sm border border-line bg-surface px-2 py-1.5 text-sm text-text placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

const FILE_INPUT_CLASS =
  'max-w-full rounded-token-sm border border-line bg-surface px-2 py-1.5 text-sm text-text file:mr-2 file:rounded-token-sm file:border-0 file:bg-raised file:px-2 file:py-1 file:text-sm file:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

export function ProjectPanel({ className, onApplyTemplate }: ProjectPanelProps): ReactNode {
  const { t } = useTranslation();

  const packetTemplates = useProtocolSchemaStore((state) => state.packetTemplates);
  const applyProject = useProtocolSchemaStore((state) => state.applyProject);
  const buildProjectPayload = useProtocolSchemaStore((state) => state.buildProjectPayload);
  const removePacketTemplate = useProtocolSchemaStore((state) => state.removePacketTemplate);

  const [projectName, setProjectName] = useState('');
  const [error, setError] = useState<PanelError | null>(null);
  /** Son yüklenen projenin adı — VERİDEN gelir, çeviriden değil. */
  const [loadedName, setLoadedName] = useState<string | null>(null);

  /** Sözlüğe daraltma tek noktada; çağrı yerleri anahtar adıyla okunur kalsın. */
  const text = useCallback(
    (key: PanelTextKey): string => t(TEXT_KEYS[key] as TranslationKey),
    [t],
  );

  const trimmedName = projectName.trim();

  const handleSave = useCallback((): void => {
    const name = projectName.trim();
    if (name === '') {
      // Düğme zaten kapalı; bu ikinci kapı klavye/otomasyon yolundan gelen
      // çağrıya karşı. Adsız proje dosyası kendi çözümleyicimizce reddedilirdi.
      return;
    }
    // Saati okuyan TEK yer burası (bkz. dosya başı).
    const serialized = serializeProject(buildProjectPayload(name, new Date().toISOString()));
    try {
      downloadTextFile(`${slugifyProjectName(name)}${FILE_NAME_SUFFIX}`, serialized, MIME_JSON);
      setError(null);
    } catch {
      setError({ errorKey: DOWNLOAD_ERROR_KEY });
    }
  }, [buildProjectPayload, projectName]);

  const handleLoadFile = useCallback(
    async (file: File): Promise<void> => {
      let raw: string;
      try {
        raw = await readTextFile(file);
      } catch {
        setError({ errorKey: FILE_READ_ERROR_KEY });
        setLoadedName(null);
        return;
      }

      const outcome = parseProjectFile(raw);
      if (!outcome.ok) {
        setError({ errorKey: outcome.errorKey, detail: outcome.detail });
        // Eski "yüklendi" satırı kalsaydı reddedilen dosya yüklenmiş görünürdü.
        setLoadedName(null);
        return;
      }

      applyProject(outcome.project);
      setError(null);
      setLoadedName(outcome.project.name);
      // Proje adı kutusu yüklenen adla dolar: kullanıcının bir sonraki
      // kaydetmesi aynı ada gitsin, dosya adı sessizce değişmesin.
      setProjectName(outcome.project.name);
    },
    [applyProject],
  );

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0];
      // Girdi sıfırlanır: aynı dosya ikinci kez seçildiğinde de olay doğsun.
      event.target.value = '';
      if (file === undefined) {
        return;
      }
      void handleLoadFile(file);
    },
    [handleLoadFile],
  );

  return (
    <div
      data-testid="project-panel"
      className={className === undefined ? 'flex flex-col gap-3' : `flex flex-col gap-3 ${className}`}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <label htmlFor="project-name" className="text-xs font-medium text-muted">
            {text('nameLabel')}
          </label>
          <input
            id="project-name"
            data-testid="project-name"
            type="text"
            value={projectName}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setProjectName(event.target.value);
            }}
            className={INPUT_CLASS}
          />
        </div>

        <button
          type="button"
          data-testid="project-save"
          className={PRIMARY_BUTTON_CLASS}
          disabled={trimmedName === ''}
          onClick={handleSave}
        >
          {text('save')}
        </button>

        <div className="flex flex-col gap-1">
          <label htmlFor="project-load" className="text-xs font-medium text-muted">
            {text('loadLabel')}
          </label>
          <input
            id="project-load"
            data-testid="project-load"
            type="file"
            accept="application/json,.json"
            onChange={handleFileChange}
            className={FILE_INPUT_CLASS}
          />
        </div>
      </div>

      {loadedName === null ? null : (
        <p className="text-xs text-muted" data-testid="project-loaded">
          {text('loadedLabel')}{' '}
          <span className="font-medium text-text" data-testid="project-loaded-name">
            {loadedName}
          </span>
        </p>
      )}

      {error === null ? null : (
        <p
          role="alert"
          data-testid="project-error"
          className="rounded-token border border-line bg-danger-soft p-3 text-sm text-danger"
        >
          {/* `errorKey` sözleşmede düz `string`; sözlük anahtarına daraltıldığı tek yer burası. */}
          <span data-testid="project-error-message">{t(error.errorKey as TranslationKey)}</span>
          {error.detail === undefined ? null : (
            <span className="font-mono text-xs" data-testid="project-error-detail">
              {' ('}
              {error.detail}
              {')'}
            </span>
          )}
        </p>
      )}

      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <h3 className="font-display text-xs font-semibold uppercase tracking-wide text-muted">
          {text('templatesTitle')}
        </h3>

        {packetTemplates.length === 0 ? (
          <p className="text-xs text-muted" data-testid="project-templates-empty">
            {text('templatesEmpty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="project-templates">
            {packetTemplates.map((template: PacketTemplate) => (
              <li
                key={template.id}
                data-testid={`project-template-${template.id}`}
                className="flex flex-wrap items-center gap-2 rounded-token border border-line bg-raised px-3 py-2"
              >
                <span
                  className="text-sm font-medium text-text"
                  data-testid={`project-template-name-${template.id}`}
                >
                  {template.name}
                </span>
                <span className="text-xs text-muted">
                  {text('templateSchemaLabel')}{' '}
                  <span data-testid={`project-template-schema-${template.id}`}>
                    {template.schemaName}
                  </span>
                </span>

                <span className="ml-auto flex items-center gap-2">
                  {onApplyTemplate === undefined ? null : (
                    <button
                      type="button"
                      data-testid={`project-template-apply-${template.id}`}
                      className={SMALL_BUTTON_CLASS}
                      onClick={() => {
                        onApplyTemplate(template);
                      }}
                    >
                      {text('applyTemplate')}
                    </button>
                  )}
                  <button
                    type="button"
                    data-testid={`project-template-remove-${template.id}`}
                    className={SMALL_BUTTON_CLASS}
                    onClick={() => {
                      removePacketTemplate(template.id);
                    }}
                  >
                    {text('removeTemplate')}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted" data-testid="project-privacy">
        {text('privacy')}
      </p>
    </div>
  );
}

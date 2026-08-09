import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import { searchCatalog } from '@/app/catalog';
import type { CatalogEntry } from '@/app/catalog';
import { useTranslation } from '@/app/providers/LanguageProvider';
import { useUiStore } from '@/app/store/uiStore';

/**
 * Açılır listede gösterilen en fazla sonuç. `searchCatalog` daha fazlasını
 * döndürebilir; kesme burada yapılır çünkü sınır görsel bir karardır —
 * klavyeyle 30 satır gezmek arama kutusunu kullanılmaz kılar.
 */
const MAX_SEARCH_RESULTS = 8;

/** Global kısayol: arama kutusunu odaklar (`nav.searchHint` bunu duyurur). */
const SEARCH_HOTKEY = '/';

/** Kısayolun bastırılacağı öğeler — kullanıcı metin yazarken '/' harftir, kısayol değil. */
const TEXT_ENTRY_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return TEXT_ENTRY_TAGS.has(target.tagName) || target.isContentEditable;
}

export function SearchBox(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const searchQuery = useUiStore((state) => state.searchQuery);
  const setSearchQuery = useUiStore((state) => state.setSearchQuery);
  const clearSearchQuery = useUiStore((state) => state.clearSearchQuery);

  const inputId = useId();
  const listId = useId();
  const optionIdPrefix = useId();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo<readonly CatalogEntry[]>(
    () => searchCatalog(searchQuery, MAX_SEARCH_RESULTS),
    [searchQuery],
  );

  // Sorgu değişince vurgu ilk satıra döner: aksi hâlde eski indeks yeni ve
  // daha kısa listede sınır dışında kalır, Enter yanlış kayda gider.
  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery]);

  const close = useCallback((): void => {
    setIsOpen(false);
    setActiveIndex(0);
  }, []);

  // Dışarı tıklama listeyi kapatır. `pointerdown` seçildi, `click` değil:
  // tıklama hedefi bir bağlantıysa gezinme başlamadan önce kapanmalı.
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent): void => {
      const container = containerRef.current;
      if (container !== null && event.target instanceof Node && !container.contains(event.target)) {
        close();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen, close]);

  useEffect(() => {
    const handleHotkey = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== SEARCH_HOTKEY || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      // Varsayılan engellenmezse '/' karakteri kutuya yazılır ve Firefox'un
      // hızlı arama çubuğu açılır.
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', handleHotkey);
    return () => {
      window.removeEventListener('keydown', handleHotkey);
    };
  }, []);

  const goToEntry = useCallback(
    (entry: CatalogEntry): void => {
      close();
      inputRef.current?.blur();
      navigate(`/${entry.path}`);
    },
    [close, navigate],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      // Liste kapalıyken Escape sorguyu temizler: iki kademeli kaçış,
      // kullanıcıyı fareye zorlamadan başlangıç durumuna döndürür.
      if (isOpen) close();
      else clearSearchQuery();
      return;
    }

    if (results.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setIsOpen(true);
        setActiveIndex((index) => (index + 1) % results.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setIsOpen(true);
        setActiveIndex((index) => (index - 1 + results.length) % results.length);
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(results.length - 1);
        break;
      case 'Enter': {
        const entry = results[activeIndex];
        if (entry === undefined) break;
        event.preventDefault();
        goToEntry(entry);
        break;
      }
      default:
        break;
    }
  };

  const isListVisible = isOpen && searchQuery.trim().length > 0;
  const activeOptionId =
    isListVisible && results.length > 0 ? `${optionIdPrefix}-${activeIndex}` : undefined;

  return (
    <div ref={containerRef} className="relative w-full">
      <label htmlFor={inputId} className="sr-only">
        {t('nav.search')}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="search"
        role="combobox"
        autoComplete="off"
        aria-expanded={isListVisible}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeOptionId}
        aria-describedby={`${inputId}-hint`}
        placeholder={t('nav.searchPlaceholder')}
        value={searchQuery}
        onChange={(event) => {
          setSearchQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className="w-full rounded-token border border-line bg-surface px-3 py-2 text-sm text-text placeholder:text-muted focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
      />
      <p id={`${inputId}-hint`} className="sr-only">
        {t('nav.searchHint')}
      </p>

      {searchQuery.length > 0 && (
        <button
          type="button"
          onClick={() => {
            clearSearchQuery();
            close();
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-token-sm px-2 py-1 text-xs text-muted hover:text-text focus-visible:ring-2 focus-visible:ring-accent"
        >
          {t('common.clear')}
        </button>
      )}

      {isListVisible && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-token border border-line bg-raised shadow-lg">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted">{t('nav.noResults')}</p>
          ) : (
            <>
              <p className="border-b border-line px-3 py-1.5 text-xs text-muted">
                {t('nav.resultCount', { count: results.length })}
              </p>
              <ul id={listId} role="listbox" aria-label={t('nav.search')} className="max-h-80 overflow-y-auto">
                {results.map((entry, index) => (
                  <li
                    key={entry.path}
                    id={`${optionIdPrefix}-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    // Fare imleci vurguyu da taşır ki klavye ve fare tek bir
                    // "etkin satır" kavramını paylaşsın.
                    onMouseEnter={() => {
                      setActiveIndex(index);
                    }}
                    onClick={() => {
                      goToEntry(entry);
                    }}
                    className={`cursor-pointer px-3 py-2 ${
                      index === activeIndex ? 'bg-accent-soft text-accent-strong' : 'text-text'
                    }`}
                  >
                    <span className="block text-sm font-medium">{entry.protocol.name}</span>
                    <span className="block text-xs text-muted">
                      {entry.domain.name} · {entry.family.name}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

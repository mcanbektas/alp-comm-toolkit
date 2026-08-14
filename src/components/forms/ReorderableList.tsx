import { useState } from 'react';
import type { DragEvent, ReactElement, ReactNode } from 'react';

export interface ReorderableListProps<T> {
  readonly items: readonly T[];
  readonly getKey: (item: T) => string;
  readonly renderItem: (item: T, index: number) => ReactNode;
  readonly onReorder: (fromIndex: number, toIndex: number) => void;
  readonly ariaLabel: string;
  readonly moveUpLabel: string;
  readonly moveDownLabel: string;
  readonly disabled?: boolean;
}

/**
 * Sürükle-bırak ile sıralanan liste. Görünen her metin (aria etiketleri dahil)
 * prop olarak gelir; primitif çeviri sözlüğüne bakmaz.
 *
 * Sürükleme tek başına erişilebilir değildir — klavye ve dokunmatik kullanıcı
 * sürükleyemez — bu yüzden her öge ayrıca iki taşıma butonu taşır. Butonlar
 * süslemesi değil, birincil erişim yoludur; kaldırılırsa liste klavyeyle
 * sıralanamaz hâle gelir.
 *
 * Bileşen sırayı kendi tutmaz: `onReorder` çağrılır, yeni `items` dışarıdan gelir.
 */
export function ReorderableList<T,>({
  items,
  getKey,
  renderItem,
  onReorder,
  ariaLabel,
  moveUpLabel,
  moveDownLabel,
  disabled = false,
}: ReorderableListProps<T>): ReactElement {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const clearDragState = (): void => {
    setDragIndex(null);
    setDropIndex(null);
  };

  /** Yer değişimi olmayan bırakma (aynı indekse) çağıranı boşuna güncellemesin. */
  const requestMove = (fromIndex: number, toIndex: number): void => {
    if (disabled || fromIndex === toIndex) {
      return;
    }
    onReorder(fromIndex, toIndex);
  };

  const handleDragStart = (event: DragEvent<HTMLLIElement>, index: number, item: T): void => {
    setDragIndex(index);
    // jsdom'da DragEvent yok, testte dataTransfer gelmeyebilir; ayrıca Firefox
    // setData çağrılmadan sürüklemeyi hiç başlatmaz.
    const transfer: DataTransfer | null | undefined = event.dataTransfer;
    if (transfer) {
      transfer.effectAllowed = 'move';
      transfer.setData('text/plain', getKey(item));
    }
  };

  const handleDragOver = (event: DragEvent<HTMLLIElement>, index: number): void => {
    if (dragIndex === null) {
      return;
    }
    // preventDefault yoksa tarayıcı bırakmayı reddeder — drop hiç tetiklenmez.
    event.preventDefault();
    const transfer: DataTransfer | null | undefined = event.dataTransfer;
    if (transfer) {
      transfer.dropEffect = 'move';
    }
    setDropIndex(index);
  };

  const handleDrop = (event: DragEvent<HTMLLIElement>, index: number): void => {
    event.preventDefault();
    if (dragIndex !== null) {
      requestMove(dragIndex, index);
    }
    clearDragState();
  };

  const lastIndex = items.length - 1;

  return (
    <ul role="list" aria-label={ariaLabel} className="flex flex-col gap-1">
      {items.map((item, index) => {
        const isDragged = dragIndex === index;
        const isDropTarget = dragIndex !== null && dropIndex === index && !isDragged;

        return (
          <li
            key={getKey(item)}
            draggable={!disabled}
            data-drop-target={isDropTarget}
            data-dragging={isDragged}
            onDragStart={(event) => {
              handleDragStart(event, index, item);
            }}
            onDragOver={(event) => {
              handleDragOver(event, index);
            }}
            onDrop={(event) => {
              handleDrop(event, index);
            }}
            onDragEnd={clearDragState}
            className={`flex items-center gap-2 rounded-token-sm border border-line bg-surface px-2 py-1.5 text-sm text-text ${
              isDropTarget ? 'ring-2 ring-accent' : ''
            } ${isDragged ? 'opacity-50' : ''} ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-grab'}`}
          >
            <div className="min-w-0 grow">{renderItem(item, index)}</div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label={moveUpLabel}
                disabled={disabled || index === 0}
                onClick={() => {
                  requestMove(index, index - 1);
                }}
                className="rounded-token-sm border border-line bg-raised px-1.5 py-0.5 text-xs text-text hover:border-line-strong hover:text-accent focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {/* Yön oku dile bağlı değil; erişilebilir ad aria-label'dan gelir. */}
                <span aria-hidden="true">↑</span>
              </button>
              <button
                type="button"
                aria-label={moveDownLabel}
                disabled={disabled || index === lastIndex}
                onClick={() => {
                  requestMove(index, index + 1);
                }}
                className="rounded-token-sm border border-line bg-raised px-1.5 py-0.5 text-xs text-text hover:border-line-strong hover:text-accent focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span aria-hidden="true">↓</span>
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ReorderableList } from './ReorderableList';

interface FieldRow {
  readonly id: string;
  readonly name: string;
}

const ROWS: readonly FieldRow[] = [
  { id: 'sof', name: 'SOF' },
  { id: 'length', name: 'Length' },
  { id: 'payload', name: 'Payload' },
];

const MOVE_UP = 'Move up';
const MOVE_DOWN = 'Move down';

/** noUncheckedIndexedAccess altında indeksleme `undefined` döner; testte kaçak yerine patla. */
function at(nodes: readonly HTMLElement[], index: number): HTMLElement {
  const node = nodes[index];
  if (node === undefined) {
    throw new Error(`node ${String(index)} was not rendered`);
  }
  return node;
}

function renderList(
  onReorder: (fromIndex: number, toIndex: number) => void,
  overrides: { readonly items?: readonly FieldRow[]; readonly disabled?: boolean } = {},
): ReactElement {
  const { items = ROWS, disabled = false } = overrides;

  return (
    <ReorderableList<FieldRow>
      items={items}
      getKey={(row) => row.id}
      renderItem={(row, index) => `${String(index)}:${row.name}`}
      onReorder={onReorder}
      ariaLabel="Frame fields"
      moveUpLabel={MOVE_UP}
      moveDownLabel={MOVE_DOWN}
      disabled={disabled}
    />
  );
}

describe('ReorderableList', () => {
  it('labels the list and renders one item per entry', () => {
    render(renderList(vi.fn()));

    expect(screen.getByRole('list', { name: 'Frame fields' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(ROWS.length);
  });

  it('renders each item through renderItem with its index', () => {
    render(renderList(vi.fn()));

    expect(screen.getAllByRole('listitem').map((node) => node.textContent)).toEqual([
      '0:SOF↑↓',
      '1:Length↑↓',
      '2:Payload↑↓',
    ]);
  });

  it('moves an item up by one when its up button is clicked', () => {
    const onReorder = vi.fn();
    render(renderList(onReorder));

    fireEvent.click(at(screen.getAllByRole('button', { name: MOVE_UP }), 1));

    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(1, 0);
  });

  it('moves an item down by one when its down button is clicked', () => {
    const onReorder = vi.fn();
    render(renderList(onReorder));

    fireEvent.click(at(screen.getAllByRole('button', { name: MOVE_DOWN }), 0));

    expect(onReorder).toHaveBeenCalledWith(0, 1);
  });

  it('disables the up button on the first item and the down button on the last', () => {
    render(renderList(vi.fn()));

    expect(
      screen.getAllByRole('button', { name: MOVE_UP }).map((node) => node.hasAttribute('disabled')),
    ).toEqual([true, false, false]);
    expect(
      screen.getAllByRole('button', { name: MOVE_DOWN }).map((node) => node.hasAttribute('disabled')),
    ).toEqual([false, false, true]);
  });

  it('reorders from the dragged index to the dropped index', () => {
    const onReorder = vi.fn();
    render(renderList(onReorder));
    const items = screen.getAllByRole('listitem');

    fireEvent.dragStart(at(items, 0));
    fireEvent.dragOver(at(items, 2));
    fireEvent.drop(at(items, 2));

    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(0, 2);
  });

  it('ignores a drop on the dragged item itself', () => {
    const onReorder = vi.fn();
    render(renderList(onReorder));
    const source = at(screen.getAllByRole('listitem'), 1);

    fireEvent.dragStart(source);
    fireEvent.dragOver(source);
    fireEvent.drop(source);

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('ignores a drop that never started with a drag', () => {
    const onReorder = vi.fn();
    render(renderList(onReorder));

    fireEvent.drop(at(screen.getAllByRole('listitem'), 2));

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('marks the hovered drop target while a drag is in flight', () => {
    render(renderList(vi.fn()));
    const items = screen.getAllByRole('listitem');
    const source = at(items, 0);
    const target = at(items, 1);

    fireEvent.dragStart(source);
    fireEvent.dragOver(target);

    expect(target).toHaveClass('ring-2', 'ring-accent');
    expect(target).toHaveAttribute('data-drop-target', 'true');
    expect(source).toHaveAttribute('data-dragging', 'true');
  });

  it('never marks the dragged item as its own drop target', () => {
    render(renderList(vi.fn()));
    const source = at(screen.getAllByRole('listitem'), 0);

    fireEvent.dragStart(source);
    fireEvent.dragOver(source);

    expect(source).toHaveAttribute('data-drop-target', 'false');
    expect(source).not.toHaveClass('ring-accent');
  });

  it('clears the drag marks when the drag ends without a drop', () => {
    render(renderList(vi.fn()));
    const items = screen.getAllByRole('listitem');
    const source = at(items, 0);
    const target = at(items, 1);

    fireEvent.dragStart(source);
    fireEvent.dragOver(target);
    fireEvent.dragEnd(source);

    expect(target).toHaveAttribute('data-drop-target', 'false');
    expect(source).toHaveAttribute('data-dragging', 'false');
  });

  it('keeps items draggable only while enabled', () => {
    const { unmount } = render(renderList(vi.fn()));
    expect(at(screen.getAllByRole('listitem'), 0)).toHaveAttribute('draggable', 'true');
    unmount();

    render(renderList(vi.fn(), { disabled: true }));
    expect(at(screen.getAllByRole('listitem'), 0)).toHaveAttribute('draggable', 'false');
  });

  it('reorders neither by button nor by drop while disabled', () => {
    const onReorder = vi.fn();
    render(renderList(onReorder, { disabled: true }));
    const items = screen.getAllByRole('listitem');

    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    fireEvent.dragStart(at(items, 0));
    fireEvent.drop(at(items, 2));

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('renders an empty labelled list without items', () => {
    render(renderList(vi.fn(), { items: [] }));

    expect(screen.getByRole('list', { name: 'Frame fields' })).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});

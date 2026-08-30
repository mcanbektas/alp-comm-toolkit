import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProtocolTree } from './ProtocolTree';
import type { ProtocolTreeNode } from './ProtocolTree';

const NODES: readonly ProtocolTreeNode[] = [
  {
    id: 'group-mac',
    label: 'MAC',
    children: [
      { id: 'mac-frame-control', label: 'Frame Control' },
      { id: 'mac-sequence', label: 'Sequence Number' },
    ],
  },
  { id: 'checksum', label: 'Checksum' },
];

describe('ProtocolTree', () => {
  it('renders group labels and leaf labels', () => {
    render(
      <ProtocolTree
        nodes={NODES}
        selectedNodeId={null}
        onSelectNode={() => {}}
        emptyLabel="empty"
        testIdPrefix="test"
      />,
    );

    expect(screen.getByText('MAC')).toBeInTheDocument();
    expect(screen.getByText('Frame Control')).toBeInTheDocument();
    expect(screen.getByText('Sequence Number')).toBeInTheDocument();
    expect(screen.getByText('Checksum')).toBeInTheDocument();
  });

  it('nests leaves under their group in the DOM', () => {
    render(
      <ProtocolTree
        nodes={NODES}
        selectedNodeId={null}
        onSelectNode={() => {}}
        emptyLabel="empty"
        testIdPrefix="test"
      />,
    );

    const group = screen.getByTestId('test-tree-group');
    expect(within(group).getByText('Frame Control')).toBeInTheDocument();
    expect(within(group).getByText('Sequence Number')).toBeInTheDocument();
  });

  it('groups render open by default — içerik ek etkileşim olmadan görünür', () => {
    render(
      <ProtocolTree
        nodes={NODES}
        selectedNodeId={null}
        onSelectNode={() => {}}
        emptyLabel="empty"
        testIdPrefix="test"
      />,
    );

    const group = screen.getByTestId('test-tree-group');
    expect(group).toHaveAttribute('open');
  });

  it('marks the selected leaf and calls onSelectNode with its id', () => {
    const onSelectNode = vi.fn();
    render(
      <ProtocolTree
        nodes={NODES}
        selectedNodeId="mac-sequence"
        onSelectNode={onSelectNode}
        emptyLabel="empty"
        testIdPrefix="test"
      />,
    );

    const leaves = screen.getAllByTestId('test-tree-leaf');
    const selected = leaves.find((leaf) => leaf.dataset['nodeId'] === 'mac-sequence');
    expect(selected).toHaveAttribute('aria-pressed', 'true');

    const checksum = leaves.find((leaf) => leaf.dataset['nodeId'] === 'checksum');
    expect(checksum).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByText('Checksum'));
    expect(onSelectNode).toHaveBeenCalledWith('checksum');
  });

  it('shows the empty label and no tree when nodes is empty', () => {
    render(
      <ProtocolTree
        nodes={[]}
        selectedNodeId={null}
        onSelectNode={() => {}}
        emptyLabel="Hiç düğüm yok"
        testIdPrefix="test"
      />,
    );

    expect(screen.getByTestId('test-tree-empty')).toHaveTextContent('Hiç düğüm yok');
    expect(screen.queryByTestId('test-tree')).not.toBeInTheDocument();
  });

  it('applies the given testIdPrefix so two consumers never collide', () => {
    render(
      <ProtocolTree
        nodes={NODES}
        selectedNodeId={null}
        onSelectNode={() => {}}
        emptyLabel="empty"
        testIdPrefix="decode"
      />,
    );

    expect(screen.getByTestId('decode-tree')).toBeInTheDocument();
    expect(screen.getByTestId('decode-tree-group')).toBeInTheDocument();
    expect(screen.getAllByTestId('decode-tree-leaf')).toHaveLength(3);
  });
});

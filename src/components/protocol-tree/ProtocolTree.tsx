/**
 * Protokol ağacı — hiyerarşik düğümleri açılır/kapanır dallar olarak çizen
 * genel sunum bileşeni (spec §6 `components/protocol-tree`).
 *
 * i18n bağı YOK (`ByteViewer`/`LiveLineChart`/`PacketViewer`/`SignalViewer`
 * ile aynı kural): tek serbest metin `emptyLabel` prop'udur.
 *
 * Bileşen hiyerarşiyi ÜRETMEZ, yalnız ÇİZER — `nodes` zaten kurulmuş gelir.
 * Kasıtlı: `ParsedField.id`den (`mac-payload`, `nwk-frame-type` gibi)
 * otomatik bir gruplama denendi ve REDDEDİLDİ (2026-08-30) — 172 protokolün
 * `id` önekleri örneklendiğinde en sık görülenler (`data-`, `flag-`,
 * `frame-`, `length-`, `payload-`, `checksum-` …) katman adı değil, çok
 * kelimeli bir `id`nin ilk sözcüğü; bunları önekle gruplamak "MAC → NWK → APS"
 * gibi gerçek katmanlı protokollerde doğru sonuç verirken çoğunluk için
 * ANLAMSIZ ve YANILTICI bir hiyerarşi uydururdu (spec'in "gösterilir ≠
 * doğrulanır" ilkesi, bkz. CLAUDE.md). Gerçek bir tüketici (`DecodePanel`
 * ya da XML tanım panelleri gibi zaten hiyerarşik veri taşıyan bir kaynak)
 * bulunana kadar bileşen kablosuz kalıyor — bkz. `docs/plan-fazlar.md`.
 */

import type { ReactNode } from 'react';

export interface ProtocolTreeNode {
  readonly id: string;
  readonly label: string;
  /** Yoksa yaprak düğümdür. */
  readonly children?: readonly ProtocolTreeNode[];
}

export interface ProtocolTreeProps {
  readonly nodes: readonly ProtocolTreeNode[];
  readonly selectedNodeId: string | null;
  readonly onSelectNode: (nodeId: string) => void;
  readonly emptyLabel: string;
  readonly testIdPrefix: string;
}

function TreeNodeView({
  node,
  selectedNodeId,
  onSelectNode,
  testIdPrefix,
}: {
  node: ProtocolTreeNode;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  testIdPrefix: string;
}): ReactNode {
  if (node.children !== undefined) {
    return (
      <li>
        {/*
          Yerleşik `<details>` klavye ve açık/kapalı durumunu bedavaya verir;
          özel bir `role="tree"` ağacı kurmak WAI-ARIA'nın en hataya açık
          desenlerinden biridir ve burada gerek yok (bkz. `OutputPanel.tsx`
          `output-field-computation` — aynı desen, ayrı bağlamda).
        */}
        <details open data-testid={`${testIdPrefix}-tree-group`} data-group-id={node.id}>
          <summary className="cursor-pointer select-none rounded-token-sm px-1 py-0.5 text-sm font-medium text-text hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            {node.label}
          </summary>
          <ul className="ml-4 flex flex-col gap-0.5 border-l border-line pl-3">
            {node.children.map((child) => (
              <TreeNodeView
                key={child.id}
                node={child}
                selectedNodeId={selectedNodeId}
                onSelectNode={onSelectNode}
                testIdPrefix={testIdPrefix}
              />
            ))}
          </ul>
        </details>
      </li>
    );
  }

  const selected = node.id === selectedNodeId;
  return (
    <li>
      <button
        type="button"
        data-testid={`${testIdPrefix}-tree-leaf`}
        data-node-id={node.id}
        aria-pressed={selected}
        className={
          selected
            ? 'w-full rounded-token-sm bg-accent-soft px-1 py-0.5 text-left text-sm text-accent'
            : 'w-full rounded-token-sm px-1 py-0.5 text-left text-sm text-text hover:text-accent'
        }
        onClick={() => {
          onSelectNode(node.id);
        }}
      >
        {node.label}
      </button>
    </li>
  );
}

export function ProtocolTree({
  nodes,
  selectedNodeId,
  onSelectNode,
  emptyLabel,
  testIdPrefix,
}: ProtocolTreeProps): ReactNode {
  if (nodes.length === 0) {
    return (
      <p className="text-sm text-muted" data-testid={`${testIdPrefix}-tree-empty`}>
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-0.5" data-testid={`${testIdPrefix}-tree`}>
      {nodes.map((node) => (
        <TreeNodeView
          key={node.id}
          node={node}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
          testIdPrefix={testIdPrefix}
        />
      ))}
    </ul>
  );
}

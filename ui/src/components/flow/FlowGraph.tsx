import React, { useState, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  Position,
  Handle,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { DestinationChangeCase } from '../../types/case';
import {
  CANONICAL_NODES,
  CANONICAL_EDGES,
  computeNodeStates,
  type FlowNodeMeta,
  type NodeState,
} from './flowData';
import {
  ShieldCheck,
  User,
  Bot,
  ExternalLink,
  Lock,
  CheckCircle2,
  Clock,
  XCircle,
  Info,
  List,
  GitGraph,
} from 'lucide-react';
import styles from '../../styles/flowGraph.module.css';

interface Props {
  caseData?: DestinationChangeCase;
  isLive?: boolean;
}

// Custom Node Component for React Flow
function FlowNodeComponent({ data }: { data: FlowNodeMeta & { state: NodeState; onSelect: () => void } }) {
  const { label, sublabel, type, state, onSelect } = data;

  const getTypeIcon = () => {
    switch (type) {
      case 'trusted':
        return <ShieldCheck size={14} className={styles.iconTrusted} aria-hidden="true" />;
      case 'human':
        return <User size={14} className={styles.iconHuman} aria-hidden="true" />;
      case 'advisory':
        return <Bot size={14} className={styles.iconAdvisory} aria-hidden="true" />;
      case 'external':
        return <ExternalLink size={14} className={styles.iconExternal} aria-hidden="true" />;
      case 'untrusted':
      default:
        return <User size={14} className={styles.iconUntrusted} aria-hidden="true" />;
    }
  };

  const getStateBadge = () => {
    switch (state) {
      case 'done':
        return <span title="Completed"><CheckCircle2 size={14} className={styles.stateDone} /></span>;
      case 'active':
        return <span className={styles.stateActiveDot} title="Current active step" />;
      case 'blocked':
        return <span title="Blocked"><XCircle size={14} className={styles.stateBlocked} /></span>;
      case 'pending':
      default:
        return <span title="Pending"><Clock size={14} className={styles.statePending} /></span>;
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={`${styles.customNode} ${styles[type]} ${styles[`state_${state}`]}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-label={`${label}: ${sublabel}. Status: ${state}`}
    >
      <Handle type="target" position={Position.Left} className={styles.handle} />

      <div className={styles.nodeHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {getTypeIcon()}
          <span className={styles.nodeLabel}>{label}</span>
        </div>
        {getStateBadge()}
      </div>

      <div className={styles.nodeSub}>{sublabel}</div>

      {type === 'advisory' && (
        <div className={styles.lockBadge}>
          <Lock size={10} aria-hidden="true" />
          <span>No write path</span>
        </div>
      )}

      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
}

const nodeTypes = {
  customNode: FlowNodeComponent,
};

export function FlowGraph({ caseData, isLive = false }: Props) {
  const [selectedNode, setSelectedNode] = useState<FlowNodeMeta | null>(null);
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');

  const nodeStates = useMemo(() => computeNodeStates(caseData), [caseData]);

  // Construct React Flow nodes
  const nodes: Node[] = useMemo(() => {
    return CANONICAL_NODES.map((meta) => ({
      id: meta.id,
      type: 'customNode',
      position: { x: meta.x, y: meta.y },
      data: {
        ...meta,
        state: nodeStates[meta.id] || 'pending',
        onSelect: () => setSelectedNode(meta),
      },
    }));
  }, [nodeStates]);

  // Construct React Flow edges
  const edges: Edge[] = useMemo(() => {
    return CANONICAL_EDGES.map((edgeMeta) => {
      const sourceState = nodeStates[edgeMeta.source];
      const targetState = nodeStates[edgeMeta.target];
      const isActive = sourceState === 'done' && (targetState === 'active' || targetState === 'done');

      return {
        id: edgeMeta.id,
        source: edgeMeta.source,
        target: edgeMeta.target,
        animated: isActive,
        style: {
          stroke: edgeMeta.isAdvisory
            ? '#5a825b'
            : isActive
            ? '#b6995f'
            : '#d4ddc9',
          strokeWidth: isActive ? 2.5 : 1.5,
          strokeDasharray: edgeMeta.isDashed ? '5,5' : undefined,
        },
        label: edgeMeta.label,
        labelStyle: { fill: '#607650', fontSize: 14, fontFamily: 'Geist Mono' },
        labelBgStyle: { fill: '#f8f8f2', fillOpacity: 0.95 },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
      };
    });
  }, [nodeStates]);

  return (
    <div className={styles.flowWrapper}>
      {/* Header bar */}
      <div className={styles.toolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <GitGraph size={16} className={styles.iconGold} aria-hidden="true" />
          <strong style={{ fontSize: 'var(--text-sm)' }}>
            {isLive ? 'Live Case Execution Flow' : 'Destination Change Data Flow'}
          </strong>
          {isLive ? (
            <span className={styles.liveBadge}>LIVE STATE</span>
          ) : (
            <span className={styles.simBadge}>ILLUSTRATIVE SIMULATION</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className={`${styles.viewBtn} ${viewMode === 'graph' ? styles.activeViewBtn : ''}`}
            onClick={() => setViewMode('graph')}
            aria-label="Switch to node graph view"
            aria-pressed={viewMode === 'graph'}
          >
            <GitGraph size={13} aria-hidden="true" />
            <span>Graph</span>
          </button>
          <button
            type="button"
            className={`${styles.viewBtn} ${viewMode === 'list' ? styles.activeViewBtn : ''}`}
            onClick={() => setViewMode('list')}
            aria-label="Switch to accessible list view"
            aria-pressed={viewMode === 'list'}
          >
            <List size={13} aria-hidden="true" />
            <span>List (Accessible)</span>
          </button>
        </div>
      </div>

      {viewMode === 'graph' ? (
        <div className={styles.graphContainer}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={true}
            minZoom={0.4}
            maxZoom={1.5}
          >
            <Background color="#d4ddc9" gap={24} size={1} variant={BackgroundVariant.Dots} />
            <Controls showInteractive={false} className={styles.controls} />
          </ReactFlow>
        </div>
      ) : (
        /* Text list alternative for screen readers and keyboard users */
        <ol className={styles.accessibleList} aria-label="Step-by-step Destination Change sequence">
          {CANONICAL_NODES.map((node) => (
            <li key={node.id} className={styles.accessibleItem}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong style={{ color: 'var(--text)' }}>{node.label}</strong>
                <span className={styles.accessibleBadge}>{nodeStates[node.id]}</span>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)', margin: '4px 0' }}>
                {node.description}
              </p>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--sky)' }}>
                Governing Rule: {node.governingRule}
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Node detail side-drawer / modal */}
      {selectedNode && (
        <div className={styles.nodeDrawer} role="dialog" aria-label="Step detail">
          <div className={styles.drawerHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Info size={15} className={styles.iconSky} aria-hidden="true" />
              <strong>{selectedNode.label}</strong>
            </div>
            <button
              type="button"
              className={styles.closeDrawerBtn}
              onClick={() => setSelectedNode(null)}
              aria-label="Close step details"
            >
              ✕
            </button>
          </div>

          <div className={styles.drawerBody}>
            <div style={{ marginBottom: varSpace2 }}>
              <span className={styles.drawerMetaLabel}>Role & Boundary</span>
              <span className={styles.drawerTypeValue}>{selectedNode.type.toUpperCase()}</span>
            </div>

            <div style={{ marginBottom: varSpace2 }}>
              <span className={styles.drawerMetaLabel}>Explanation</span>
              <p className={styles.drawerDesc}>{selectedNode.description}</p>
            </div>

            <div style={{ marginBottom: varSpace2 }}>
              <span className={styles.drawerMetaLabel}>Governing Security Specification</span>
              <code className={styles.drawerRule}>{selectedNode.governingRule}</code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const varSpace2 = '8px';

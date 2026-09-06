// src/components/GameStateViewer.tsx
import { useState } from 'react';
import type { GameState } from '../hooks/useGameState';
import './GameStateViewer.css';

export interface GameStateViewerProps {
  visible: boolean;
  gameState: GameState | null;
  onClose: () => void;
}

interface TreeNodeProps {
  label: string;
  value: unknown;
  path: string;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
}

/**
 * Recursive tree-view node for the game state viewer (Issue 6).
 * Each object/array key gets an expand/collapse toggle button;
 * primitive values are shown inline as `key: value`.
 * Top-level keys start expanded; nested objects/arrays start collapsed.
 */
const TreeNode = ({ label, value, path, expandedPaths, onToggle }: TreeNodeProps) => {
  const isArray = Array.isArray(value);
  const isObject = value !== null && typeof value === 'object' && !isArray;
  const isExpandable = isObject || isArray;
  const isExpanded = expandedPaths.has(path);

  if (isExpandable) {
    const entries = Object.entries(value);
    return (
      <div className="gs-tree-node gs-tree-node--expandable">
        <div className="gs-tree-label" onClick={() => onToggle(path)} role="button">
          <button
            type="button"
            className={`gs-tree-toggle ${isExpanded ? 'gs-tree-toggle--expanded' : ''}`}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
          <span className="gs-tree-key">{label}</span>
          <span className="gs-tree-brace">
            {isArray ? `[${entries.length}]` : `{${entries.length}}`}
          </span>
        </div>
        {isExpanded && (
          <div className="gs-tree-children">
            {entries.map(([k, v]) => (
              <TreeNode
                key={`${path}.${k}`}
                label={k}
                value={v}
                path={`${path}.${k}`}
                expandedPaths={expandedPaths}
                onToggle={onToggle}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const displayValue = typeof value === 'string' ? `"${value}"` : String(value);
  const typeClass = typeof value;

  return (
    <div className={`gs-tree-node gs-tree-node--${typeClass}`}>
      <span className="gs-tree-key">{label}:</span>
      <span className={`gs-tree-value gs-tree-value--${typeClass}`}>{displayValue}</span>
    </div>
  );
};

/**
 * Centered modal overlay that displays the game state as an expandable /
 * collapsible tree for debugging purposes. Each JSON depth level has its own
 * toggle button (Issue 6). Top-level keys are expanded by default; nested
 * objects and arrays are collapsed by default for a more concise display.
 */
export const GameStateViewer = ({ visible, gameState, onClose }: GameStateViewerProps) => {
  // Top-level keys expanded by default; root always visible (Issue 6)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    const initial = new Set<string>(['root']);
    if (gameState) {
      Object.keys(gameState).forEach((k) => initial.add(`root.${k}`));
    }
    return initial;
  });

  const togglePath = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  if (!visible) return null;

  return (
    <aside className="game-state-viewer" data-testid="game-state-viewer">
      <div className="gs-backdrop" data-testid="game-state-backdrop" onClick={onClose} />
      <div className="gs-modal">
        <div className="gs-header">
          <h3 data-testid="game-state-title">Game State</h3>
          <button
            type="button"
            className="gs-close"
            data-testid="game-state-close"
            aria-label="Close game state viewer"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="gs-content" data-testid="game-state-content">
          {gameState ? (
            <div data-testid="game-state-json" className="gs-tree">
              <TreeNode
                label="root"
                value={gameState}
                path="root"
                expandedPaths={expandedPaths}
                onToggle={togglePath}
              />
            </div>
          ) : (
            <p data-testid="game-state-empty">No game state loaded</p>
          )}
        </div>
      </div>
    </aside>
  );
};

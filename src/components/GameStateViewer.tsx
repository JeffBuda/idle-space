// src/components/GameStateViewer.tsx
import type { GameState } from '../hooks/useGameState';
import './GameStateViewer.css';

export interface GameStateViewerProps {
  visible: boolean;
  gameState: GameState | null;
  onClose: () => void;
}

/**
 * Centered modal overlay that displays the raw game state as
 * formatted JSON for debugging purposes.
 *
 * Accessible from the SettingsMenu via the "View Game State" toggle.
 * Receives immutable GameState passed down from the useGameState hook.
 */
export const GameStateViewer = ({ visible, gameState, onClose }: GameStateViewerProps) => {
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
            <pre data-testid="game-state-json" className="gs-json">
              {JSON.stringify(gameState, null, 2)}
            </pre>
          ) : (
            <p data-testid="game-state-empty">No game state loaded</p>
          )}
        </div>
      </div>
    </aside>
  );
};

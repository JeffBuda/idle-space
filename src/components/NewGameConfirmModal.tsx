// src/components/NewGameConfirmModal.tsx
//
// Confirmation dialog surfaced from the SettingsMenu "New Game" item.
//
// Per the product requirement:
//   - This is purely presentational: clicking Cancel (or the backdrop / ✕ /
//     Escape) dismisses the modal with NO side effects.
//   - Clicking "Start New Game" (Ok) delegates to the useGameState hook's
//     `startNewGame`, which hard-resets all persisted progress + logs and
//     reseeds a fresh game state. The engine/db layers stay isolated from this
//     component (components may not import engine/db directly).
import { useEffect } from 'react';
import './NewGameConfirmModal.css';

export interface NewGameConfirmModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const NewGameConfirmModal = ({ visible, onCancel, onConfirm }: NewGameConfirmModalProps) => {
  // Treat Escape as "Cancel" (dismiss without resetting) while the modal is open.
  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, onCancel]);

  if (!visible) return null;

  return (
    // Backdrop click = Cancel (dismiss, no state change).
    <div className="new-game-overlay" data-testid="new-game-confirm-modal" onClick={onCancel}>
      <div className="new-game-content" onClick={(e) => e.stopPropagation()}>
        <header className="new-game-header">
          <h3 className="new-game-title" data-testid="new-game-title">
            Start a New Game?
          </h3>
          <button
            type="button"
            className="new-game-close"
            data-testid="new-game-close"
            aria-label="Cancel"
            onClick={onCancel}
          >
            ✕
          </button>
        </header>
        <div className="new-game-body" data-testid="new-game-body">
          <p className="new-game__message">
            All your current progress will be lost. This action cannot be undone.
          </p>
        </div>
        <div className="new-game-actions">
          <button
            type="button"
            className="btn btn--secondary"
            data-testid="new-game-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn new-game-confirm__confirm"
            data-testid="new-game-confirm"
            onClick={onConfirm}
          >
            Start New Game
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewGameConfirmModal;

// src/components/screens/MiningScreen.tsx
//
// Idle-gate view for surface mining. The player picks Common or Rare ore (a 30s
// or 60s gate respectively — target computed by engine/flow.ts `gateTarget`),
// then taps "Faster!" to rush it, or "Collect Ore" once it has expired.
import type { GameState, IdleGateStatus, OreType } from '../../types/game-state';

interface MiningScreenProps {
  gameState: GameState;
  gate: IdleGateStatus | null;
  onOreSelect: (ore: OreType) => void;
  onHurry: () => void;
  onComplete: () => void;
}

export const MiningScreen = ({
  gameState,
  gate,
  onOreSelect,
  onHurry,
  onComplete,
}: MiningScreenProps) => {
  const remaining = gate ? Math.round(gate.remainingSeconds) : 0;
  return (
    <section className="flow-screen" data-testid="mining-screen">
      <h2 data-testid="mining-title">Mining Operations</h2>
      <div className="ore-controls" data-testid="ore-controls">
        <button type="button" data-testid="ore-common" onClick={() => onOreSelect('commonOre')}>
          Common Ore
        </button>
        <button type="button" data-testid="ore-rare" onClick={() => onOreSelect('rareOre')}>
          Rare Ore
        </button>
      </div>
      <p data-testid="ore-counts">
        Common: {gameState.oreCounts.commonOre} | Rare: {gameState.oreCounts.rareOre}
      </p>
      {gameState.selectedOre && <p data-testid="selected-ore">Mining: {gameState.selectedOre}</p>}
      {gate?.active && (
        <>
          <div className="gate-bar" data-testid="gate-bar">
            <div className="gate-fill" style={{ width: `${gate.progressPercent}%` }} />
          </div>
          <p data-testid="gate-remaining">{remaining}s remaining</p>
          {gate.expired ? (
            <button
              type="button"
              className="primary-btn"
              data-testid="complete-action-btn"
              onClick={onComplete}
            >
              Collect Ore
            </button>
          ) : (
            <button type="button" data-testid="hurry-btn" onClick={onHurry}>
              Faster!
            </button>
          )}
        </>
      )}
    </section>
  );
};

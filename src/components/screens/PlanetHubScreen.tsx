// src/components/screens/PlanetHubScreen.tsx
//
// The planet-orbit hub: shown once a gate completes and `screen === 'PLANET'`.
// The always-visible AppStatusViewer still renders the travel stats; this panel
// just offers the next nav choice (Land / Depart).
import type { GameState, Screen } from '../../types/game-state';

interface PlanetHubScreenProps {
  gameState: GameState;
  onNavigate: (to: Screen) => void;
  onChartCourse: () => void;
}

export const PlanetHubScreen = ({ gameState, onNavigate, onChartCourse }: PlanetHubScreenProps) => (
  <section className="flow-screen" data-testid="planet-hub-screen">
    <h2 data-testid="planet-hub-title">Orbiting Planet X</h2>
    <p data-testid="ore-tally">
      Common Ore: {gameState.oreCounts.commonOre} | Rare Ore: {gameState.oreCounts.rareOre}
    </p>
    <div className="ore-controls">
      <button
        type="button"
        className="btn btn--primary"
        data-testid="nav-landing"
        onClick={() => onNavigate('LANDING')}
      >
        Land
      </button>
      <button
        type="button"
        className="btn btn--secondary"
        data-testid="nav-space-travel"
        onClick={() => onNavigate('SPACE_TRAVEL')}
      >
        Depart
      </button>
      <button
        type="button"
        className="btn btn--secondary"
        data-testid="nav-star-map"
        onClick={onChartCourse}
      >
        Chart Course
      </button>
    </div>
  </section>
);

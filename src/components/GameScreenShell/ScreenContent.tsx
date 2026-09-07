// src/components/GameScreenShell/ScreenContent.tsx
//
// Screen-specific content and shell-props builder.
// Assembles everything App.tsx needs to feed into GameScreenShell
// for each game screen: title, status items, main content, details
// tab content, action buttons, and star-map integration.
//
// Everything here is presentational — receives plain data + callbacks.
// No game math, no engine imports (components layer can import types/utils).
import type { GameState, GameAction, IdleGateStatus, Screen } from '../../types/game-state';
import type { GameScreenShellProps, StatusBarItem } from './GameScreenShell';
import { GateProgress } from './GateProgress';
import { getNodeName } from '../../utils/star-map';
import { formatElapsedTime } from '../../utils/time';
import { APP_VERSION, BUILD_TIME } from '../../config';
import './ScreenContent.css';

export interface ScreenDeps {
  gameState: GameState;
  screen: Screen;
  oreCounts: GameState['oreCounts'];
  gate: IdleGateStatus | null;
  dispatch: (action: GameAction) => void;
  dispatchStarMapGo: (route: string[]) => void;
}

// ── Status bar items ────────────────────────────────────────────────────

export function buildStatusItems(
  gate: IdleGateStatus | null,
  oreCounts: GameState['oreCounts'],
): StatusBarItem[] {
  const timeVariant = !gate ? 'default' : gate.expired ? 'warn' : 'accent';
  const timeValue = !gate ? '—' : gate.expired ? 'Ready!' : `${gate.remainingSeconds}s`;
  return [
    { label: 'Time', value: timeValue, variant: timeVariant },
    { label: 'Common', value: oreCounts.commonOre, variant: 'accent' },
    { label: 'Rare', value: oreCounts.rareOre, variant: 'warn' },
  ];
}

// ── Screen titles ────────────────────────────────────────────────────────

const screenTitles: Partial<Record<Screen, string>> = {
  WELCOME: 'Welcome to Space Exploration',
  STAR_MAP: 'Stellar Cartography',
  SPACE_TRAVEL: 'Approaching',
  PLANET: 'Orbiting',
  LANDING: 'Entering Atmosphere',
  MINING: 'Mining Operations',
};

// ── Main content components ─────────────────────────────────────────────

export function WelcomeContent() {
  return (
    <div className="screen-content-block" data-testid="welcome-content">
      <p className="screen-subtitle">Command your ship and chart the stars.</p>
      <p className="screen-hint">Tap "Launch!" to begin your journey.</p>
    </div>
  );
}

export function SpaceTravelContent({ gate }: { gate: IdleGateStatus | null }) {
  const planetName = 'Planet X';
  return (
    <div className="screen-content-block" data-testid="space-travel-content">
      <GateProgress gate={gate} label={`Approaching ${planetName}`} />
    </div>
  );
}

export function LandingContent({ gate }: { gate: IdleGateStatus | null }) {
  return (
    <div className="screen-content-block" data-testid="landing-content">
      <GateProgress gate={gate} label="Atmospheric Entry" />
    </div>
  );
}

export interface MiningContentProps {
  gate: IdleGateStatus | null;
  selectedOre: 'commonOre' | 'rareOre' | null;
  onOreSelect: (ore: 'commonOre' | 'rareOre') => void;
}

export function MiningContent({ gate, selectedOre, onOreSelect }: MiningContentProps) {
  return (
    <div className="screen-content-block" data-testid="mining-content">
      <div className="ore-selector" data-testid="ore-selector">
        <button
          type="button"
          data-testid="ore-common"
          className={`btn btn--primary ore-option ${selectedOre === 'commonOre' ? 'ore-option--selected' : ''}`}
          onClick={() => onOreSelect('commonOre')}
        >
          <span className="ore-name">Common Ore</span>
          <span className="ore-tag">Fast</span>
        </button>
        <button
          type="button"
          data-testid="ore-rare"
          className={`btn btn--primary ore-option ${selectedOre === 'rareOre' ? 'ore-option--selected' : ''}`}
          onClick={() => onOreSelect('rareOre')}
        >
          <span className="ore-name">Rare Ore</span>
          <span className="ore-tag">Slow</span>
        </button>
      </div>
      <GateProgress gate={gate} label="Mining" />
    </div>
  );
}

export function PlanetHubContent({ gameState }: { gameState: GameState }) {
  const planetName = getNodeName(gameState.starMap?.nodes ?? null, gameState.currentLocation);
  return (
    <div className="screen-content-block" data-testid="planet-hub-content">
      <h2 className="planet-name" data-testid="planet-name">
        {planetName}
      </h2>
      <div className="ore-tally" data-testid="ore-tally">
        <div className="tally-item">
          <span className="tally-label">Common Ore</span>
          <span className="tally-value" data-testid="common-ore-count">
            {gameState.oreCounts.commonOre.toLocaleString()}
          </span>
        </div>
        <div className="tally-item">
          <span className="tally-label">Rare Ore</span>
          <span className="tally-value" data-testid="rare-ore-count">
            {gameState.oreCounts.rareOre.toLocaleString()}
          </span>
        </div>
        <div className="tally-item">
          <span className="tally-label">Distance Traveled</span>
          <span className="tally-value" data-testid="total-distance">
            {Math.round(gameState.totalDistanceKm).toLocaleString()} km
          </span>
        </div>
        <div className="tally-item">
          <span className="tally-label">Total Time</span>
          <span className="tally-value" data-testid="total-travel-time">
            {formatElapsedTime(gameState.elapsedSeconds)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Details tab content (placeholder data in screen theme) ──────────────

function WelcomeDetails() {
  return (
    <div data-testid="welcome-details">
      <h3>Ship Status</h3>
      <ul>
        <li>
          <span>Version</span>
          <span className="value--default"> {APP_VERSION}</span>
        </li>
        <li>
          <span>Built</span>
          <span className="value--default"> {new Date(BUILD_TIME).toLocaleDateString()}</span>
        </li>
        <li>
          <span>Engine</span>
          <span className="value--accent"> Online</span>
        </li>
        <li>
          <span>Crew</span>
          <span className="value--default"> 1 (Solo)</span>
        </li>
      </ul>
    </div>
  );
}

function TravelDetails({ gameState }: { gameState: GameState }) {
  const planetName = getNodeName(
    gameState.starMap?.nodes ?? null,
    gameState.currentLocation,
    'Unknown',
  );
  return (
    <div data-testid="travel-details">
      <h3>Approach Data</h3>
      <ul>
        <li>
          <span>Destination</span>
          <span className="value--default"> {planetName}</span>
        </li>
        <li>
          <span>Distance</span>
          <span className="value--default">
            {' '}
            {Math.round(gameState.totalDistanceKm).toLocaleString()} km
          </span>
        </li>
        <li>
          <span>Elapsed</span>
          <span className="value--accent"> {formatElapsedTime(gameState.elapsedSeconds)}</span>
        </li>
        <li>
          <span>Speed</span>
          <span className="value--default"> 10 km/s</span>
        </li>
      </ul>
    </div>
  );
}

function LandingDetails({ gameState }: { gameState: GameState }) {
  const planetName = getNodeName(
    gameState.starMap?.nodes ?? null,
    gameState.currentLocation,
    'Unknown',
  );
  return (
    <div data-testid="landing-details">
      <h3>Atmospheric Entry</h3>
      <ul>
        <li>
          <span>Body</span>
          <span className="value--default"> {planetName}</span>
        </li>
        <li>
          <span>Atmosphere</span>
          <span className="value--warn"> Dense</span>
        </li>
        <li>
          <span>Entry Angle</span>
          <span className="value--default"> 6.2°</span>
        </li>
        <li>
          <span>Shield Heat</span>
          <span className="value--accent"> Nominal</span>
        </li>
      </ul>
    </div>
  );
}

function MiningDetails({ gameState }: { gameState: GameState }) {
  const rate = gameState.selectedOre === 'rareOre' ? '0.5/s' : '1/s';
  return (
    <div data-testid="mining-details">
      <h3>Mining Operations</h3>
      <ul>
        <li>
          <span>Site</span>
          <span className="value--default">
            {' '}
            {getNodeName(gameState.starMap?.nodes ?? null, gameState.currentLocation, 'Planet X')}
          </span>
        </li>
        <li>
          <span>Rate</span>
          <span className="value--accent"> {rate}</span>
        </li>
        <li>
          <span>Common Ore</span>
          <span className="value--accent"> {gameState.oreCounts.commonOre.toLocaleString()}</span>
        </li>
        <li>
          <span>Rare Ore</span>
          <span className="value--warn"> {gameState.oreCounts.rareOre.toLocaleString()}</span>
        </li>
      </ul>
    </div>
  );
}

function PlanetDetails({ gameState }: { gameState: GameState }) {
  const planetName = getNodeName(
    gameState.starMap?.nodes ?? null,
    gameState.currentLocation,
    'Unknown',
  );
  const visitedCount = gameState.starMap?.nodes.filter((n) => n.status === 'visited').length ?? 0;
  return (
    <div data-testid="planet-details">
      <h3>Planetary Data</h3>
      <ul>
        <li>
          <span>Planet</span>
          <span className="value--default"> {planetName}</span>
        </li>
        <li>
          <span>Systems Visited</span>
          <span className="value--accent"> {visitedCount}</span>
        </li>
        <li>
          <span>Total Distance</span>
          <span className="value--default">
            {' '}
            {Math.round(gameState.totalDistanceKm).toLocaleString()} km
          </span>
        </li>
        <li>
          <span>Elapsed Time</span>
          <span className="value--accent"> {formatElapsedTime(gameState.elapsedSeconds)}</span>
        </li>
      </ul>
    </div>
  );
}

// ── GateButton helper (thumb-zone action buttons) ───────────────────────

const GateButton = ({
  label,
  onClick,
  testId,
  variant = 'btn--accent',
  disabled = false,
}: {
  label: string;
  onClick?: () => void;
  testId: string;
  variant?: string;
  disabled?: boolean;
}) => (
  <button
    type="button"
    className={`btn ${variant} btn--lg`}
    data-testid={testId}
    onClick={onClick}
    disabled={disabled}
  >
    {label}
  </button>
);

// ── Main screen-config builder ─────────────────────────────────────────

/** Builds the full set of GameScreenShell props for the current screen. */
export function getScreenProps(deps: ScreenDeps): GameScreenShellProps {
  const { gameState, screen, oreCounts, gate, dispatch, dispatchStarMapGo } = deps;
  const planetName = getNodeName(
    gameState.starMap?.nodes ?? null,
    gameState.currentLocation,
    'Unknown',
  );
  const locationName = gameState.currentLocation && gameState.starMap ? planetName : 'Deep Space';

  const title = screenTitles[screen] ?? 'Unknown';
  const statusItems = buildStatusItems(gate, oreCounts);

  switch (screen) {
    case 'WELCOME':
      return {
        title,
        statusItems,
        children: <WelcomeContent />,
        detailsContent: <WelcomeDetails />,
        gameState,
        onStarMapGo: dispatchStarMapGo,
        actionButtons: (
          <GateButton
            label="Launch!"
            testId="launch-btn"
            variant="btn--primary"
            onClick={() => dispatch({ type: 'NAVIGATE', to: 'SPACE_TRAVEL' })}
          />
        ),
      };

    case 'SPACE_TRAVEL':
      return {
        title: `Approaching ${planetName}`,
        subtitle: formatElapsedTime(gameState.elapsedSeconds),
        statusItems,
        children: <SpaceTravelContent gate={gate} />,
        detailsContent: <TravelDetails gameState={gameState} />,
        gameState,
        onStarMapGo: dispatchStarMapGo,
        actionButtons: gate?.expired ? (
          <GateButton
            label="Landed!"
            testId="complete-action-btn"
            variant="btn--primary"
            onClick={() => dispatch({ type: 'COMPLETE_ACTION' })}
          />
        ) : (
          <GateButton
            label="Faster!"
            testId="hurry-btn"
            variant="btn--accent"
            onClick={() => dispatch({ type: 'HURRY' })}
          />
        ),
      };

    case 'LANDING':
      return {
        title,
        subtitle: formatElapsedTime(gameState.elapsedSeconds),
        statusItems,
        children: <LandingContent gate={gate} />,
        detailsContent: <LandingDetails gameState={gameState} />,
        gameState,
        onStarMapGo: dispatchStarMapGo,
        actionButtons: gate?.expired ? (
          <GateButton
            label="Touchdown!"
            testId="complete-action-btn"
            variant="btn--primary"
            onClick={() => dispatch({ type: 'COMPLETE_ACTION' })}
          />
        ) : (
          <GateButton
            label="Faster!"
            testId="hurry-btn"
            variant="btn--accent"
            onClick={() => dispatch({ type: 'HURRY' })}
          />
        ),
      };

    case 'MINING':
      return {
        title,
        subtitle: locationName,
        statusItems,
        children: (
          <MiningContent
            gate={gate}
            selectedOre={gameState.selectedOre}
            onOreSelect={(ore) => dispatch({ type: 'ORE_SELECTED', ore })}
          />
        ),
        detailsContent: <MiningDetails gameState={gameState} />,
        gameState,
        onStarMapGo: dispatchStarMapGo,
        defaultDrawerTab: 'details',
        actionButtons: (
          <>
            {gate && !gate.expired && (
              <GateButton
                label="Faster!"
                testId="hurry-btn"
                variant="btn--accent"
                onClick={() => dispatch({ type: 'HURRY' })}
              />
            )}
            {gate?.expired && (
              <GateButton
                label="Collect"
                testId="complete-action-btn"
                variant="btn--primary"
                onClick={() => dispatch({ type: 'COMPLETE_ACTION' })}
              />
            )}
            <GateButton
              label="Back to Planet"
              testId="back-to-planet-btn"
              variant="btn--secondary"
              onClick={() => dispatch({ type: 'NAVIGATE', to: 'PLANET' })}
            />
          </>
        ),
      };

    case 'PLANET': {
      // R8: when a route is plotted, Depart becomes "Follow Route" — same navigation
      // target (SPACE_TRAVEL) but the label communicates route-honoring intent.
      const hasRoute = gameState.routePath.length > 0;
      const departLabel = hasRoute ? 'Follow Route' : 'Depart';
      const departTestId = 'nav-space-travel';
      return {
        title: `Orbiting ${locationName}`,
        statusItems,
        children: <PlanetHubContent gameState={gameState} />,
        detailsContent: <PlanetDetails gameState={gameState} />,
        gameState,
        onStarMapGo: dispatchStarMapGo,
        actionButtons: (
          <>
            <GateButton
              label="Land"
              testId="nav-landing"
              variant="btn--primary"
              onClick={() => dispatch({ type: 'NAVIGATE', to: 'LANDING' })}
            />
            <GateButton
              label="Chart Course"
              testId="nav-star-map"
              variant="btn--primary"
              onClick={() => dispatch({ type: 'NAVIGATE', to: 'STAR_MAP' })}
            />
            <GateButton
              label={departLabel}
              testId={departTestId}
              variant="btn--secondary"
              onClick={() => dispatch({ type: 'NAVIGATE', to: 'SPACE_TRAVEL' })}
            />
          </>
        ),
      };
    }

    case 'STAR_MAP':
      return {
        title,
        statusItems,
        children: (
          <p className="screen-hint" data-testid="star-map-notice">
            Plan your route using the Star Map tab below.
          </p>
        ),
        detailsContent: <PlanetDetails gameState={gameState} />,
        gameState,
        onStarMapGo: dispatchStarMapGo,
        defaultDrawerTab: 'star-map',
        actionButtons: (
          <GateButton
            label="Back"
            testId="back-btn"
            variant="btn--secondary"
            onClick={() => dispatch({ type: 'NAVIGATE', to: 'PLANET' })}
          />
        ),
      };

    default:
      return {
        title,
        statusItems,
        children: null,
        detailsContent: null,
        gameState,
        onStarMapGo: dispatchStarMapGo,
        actionButtons: null,
      };
  }
}

export default getScreenProps;

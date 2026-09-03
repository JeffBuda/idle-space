// src/components/screens/WelcomeScreen.tsx
//
// The first screen shown on a brand-new save (`gameState.screen === 'WELCOME'`).
// It exists purely to gate the player's first interaction behind an explicit
// "Launch!" tap so the idle-progression clock starts cleanly at real start-of-play
// (see engine/flow.ts `navigate`, which seeds lastTimestamp to `now` on launch).
interface WelcomeScreenProps {
  onLaunch: () => void;
  onChartCourse: () => void;
}

export const WelcomeScreen = ({ onLaunch, onChartCourse }: WelcomeScreenProps) => (
  <section className="flow-screen" data-testid="welcome-screen">
    <h2 data-testid="welcome-title">Welcome to Space Exploration Idle</h2>
    <p className="flow-subtitle">Command your ship and chart the stars.</p>
    <button type="button" className="btn btn--primary" data-testid="launch-btn" onClick={onLaunch}>
      Launch!
    </button>
    <button
      type="button"
      className="btn btn--secondary"
      data-testid="welcome-chart-course"
      onClick={onChartCourse}
    >
      Chart Course
    </button>
  </section>
);

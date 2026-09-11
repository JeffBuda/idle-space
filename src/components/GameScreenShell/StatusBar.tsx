// src/components/GameScreenShell/StatusBar.tsx
//
// Top status row for the GameScreenShell. Shows the screen title on the left
// and a row of compact key-value status items (time-to-next, ore counts, etc.)
// on the right.
//
// All values are passed in as already-formatted strings — no game math here
// (per the "components only consume props" rule).
import './StatusBar.css';

export interface StatusBarItem {
  /** Short label shown above the value, e.g. "Time", "Common" */
  label: string;
  /** Already-formatted display value, e.g. "12s", "42" */
  value: string | number;
  /** Visual variant for the value text color */
  variant?: 'default' | 'accent' | 'warn';
}

export interface StatusBarProps {
  /** Screen title, e.g. "Mining Operations", "Approaching Sol" */
  title: string;
  /** Key-value status items displayed in the row */
  items: StatusBarItem[];
  /** Optional location subtitle, e.g. "Orbiting Sol", "Deep Space" */
  subtitle?: string;
}

/**
 * Compact top status row — always pinned below the app header.
 * Layout: title / subtitle on the left, status items on the right.
 */
export function StatusBar({ title, items, subtitle }: StatusBarProps) {
  return (
    <header className="screen-status-row" data-testid="screen-status-row">
      <div className="screen-status-title-group" data-testid="status-title-group">
        <h2 className="screen-status-title" data-testid="screen-title">
          {title}
        </h2>
        {subtitle && (
          <span className="screen-status-subtitle" data-testid="screen-subtitle">
            {subtitle}
          </span>
        )}
      </div>

      {items.length > 0 && (
        <div className="screen-status-items" data-testid="screen-status-items">
          {items.map((item) => (
            <div
              key={item.label}
              className="status-chip"
              data-testid={`status-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <span className="status-chip__label">{item.label}</span>
              <span
                className={`status-chip__value status-chip__value--${item.variant ?? 'default'}`}
                data-testid={`status-value-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </header>
  );
}

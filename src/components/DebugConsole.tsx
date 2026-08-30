import { useState } from 'react';
import { useDebugLogs } from '../hooks/useDebugLogs';
import { formatLogTimestamp } from '../utils/time';
import type { LogEntry } from '../hooks/useDebugLogs';
import './DebugConsole.css';

interface DebugConsoleProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Slide-up debug console overlay for inspecting engine log entries.
 *
 * Features:
 *   - Refresh, Clear, and Export (JSON download) actions
 *   - Expandable per-entry state-diff details
 *
 * All data is loaded via the useDebugLogs hook, which reads from the
 * `space_idle_logs` IndexedDB store.
 */
export const DebugConsole = ({ visible, onClose }: DebugConsoleProps) => {
  const { logs, isLoading, refresh, clear } = useDebugLogs();
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(
    new Set(),
  );

  const handleExport = () => {
    const dataStr = JSON.stringify(logs, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `idle-space-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleExpand = (id: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (!visible) return null;

  return (
    <aside className="debug-console" data-testid="debug-console">
      <div className="debug-header">
        <h3 data-testid="debug-title">Debug Console</h3>
        <button
          type="button"
          className="debug-close"
          data-testid="debug-close"
          aria-label="Close debug console"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div className="debug-controls">
        <button
          type="button"
          className="debug-btn"
          data-testid="debug-refresh"
          onClick={refresh}
        >
          Refresh
        </button>
        <button
          type="button"
          className="debug-btn"
          data-testid="debug-clear"
          onClick={clear}
        >
          Clear
        </button>
        <button
          type="button"
          className="debug-btn"
          data-testid="debug-export"
          onClick={handleExport}
        >
          Export
        </button>
      </div>

      <div className="debug-entries">
        {isLoading ? (
          <p data-testid="debug-loading">Loading logs...</p>
        ) : logs.length === 0 ? (
          <p data-testid="debug-empty">No log entries</p>
        ) : (
          logs.map((log: LogEntry) => (
            <div
              key={log.id}
              className="log-entry"
              data-testid={`log-entry-${log.id}`}
            >
              <div
                className="log-meta"
                onClick={() => toggleExpand(log.id)}
              >
                <span className="log-timestamp">
                  {formatLogTimestamp(log.timestamp)}
                </span>
                <span className="log-action">{log.actionType}</span>
                <span className="log-duration">
                  {log.executionTimeMs.toFixed(3)}ms
                </span>
              </div>
              {expandedEntries.has(log.id) && (
                <div className="log-diff" data-testid={`log-diff-${log.id}`}>
                  <pre>{JSON.stringify(log.stateDiff, null, 2)}</pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
};

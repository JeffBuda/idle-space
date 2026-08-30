// src/components/DebugConsole.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DebugConsole } from './DebugConsole';
import { useDebugLogs } from '../hooks/useDebugLogs';

// Mock the useDebugLogs hook
vi.mock('../hooks/useDebugLogs', () => ({
  useDebugLogs: vi.fn(),
}));

const mockLogs = [
  {
    id: 'log-1',
    timestamp: Date.now(),
    actionType: 'APP_WAKE',
    executionTimeMs: 0.05,
    stateDiff: [{ key: 'totalDistanceKm', from: 0, to: 10 }],
    seed: 'test-seed',
  },
  {
    id: 'log-2',
    timestamp: Date.now() + 1000,
    actionType: 'APP_SUSPEND',
    executionTimeMs: 0.03,
    stateDiff: [{ key: 'elapsedSeconds', from: 0, to: 1 }],
    seed: 'test-seed-2',
  },
];

const mockUseDebugLogs = (overrides = {}) => {
  vi.mocked(useDebugLogs).mockReturnValue({
    logs: overrides.logs ?? [],
    isLoading: overrides.isLoading ?? false,
    refresh: overrides.refresh ?? vi.fn(),
    clear: overrides.clear ?? vi.fn(),
  } as ReturnType<typeof useDebugLogs>);
};

describe('DebugConsole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when visible is false', () => {
    mockUseDebugLogs();
    const { container } = render(<DebugConsole visible={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render when visible is true', () => {
    mockUseDebugLogs();
    render(<DebugConsole visible={true} onClose={vi.fn()} />);
    expect(screen.getByTestId('debug-console')).toBeInTheDocument();
  });

  it('should display log entries when loaded', () => {
    mockUseDebugLogs({ logs: mockLogs });
    render(<DebugConsole visible={true} onClose={vi.fn()} />);
    expect(screen.getByTestId('log-entry-log-1')).toBeInTheDocument();
    expect(screen.getByTestId('log-entry-log-2')).toBeInTheDocument();
  });

  it('should show loading state when isLoading is true', () => {
    mockUseDebugLogs({ isLoading: true });
    render(<DebugConsole visible={true} onClose={vi.fn()} />);
    expect(screen.getByTestId('debug-loading')).toBeInTheDocument();
  });

  it('should show empty state when no logs are loaded', () => {
    mockUseDebugLogs({ logs: [] });
    render(<DebugConsole visible={true} onClose={vi.fn()} />);
    expect(screen.getByTestId('debug-empty')).toBeInTheDocument();
  });

  it('should call onClose when the close button is clicked', () => {
    mockUseDebugLogs();
    const onClose = vi.fn();
    render(<DebugConsole visible={true} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('debug-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should not render a category filter dropdown', () => {
    mockUseDebugLogs({ logs: mockLogs });
    render(<DebugConsole visible={true} onClose={vi.fn()} />);
    expect(screen.queryByTestId('debug-filter')).not.toBeInTheDocument();
  });

  it('should call refresh when the Refresh button is clicked', () => {
    const refreshMock = vi.fn();
    mockUseDebugLogs({ refresh: refreshMock });
    render(<DebugConsole visible={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('debug-refresh'));
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('should call clear when the Clear button is clicked', () => {
    const clearMock = vi.fn();
    mockUseDebugLogs({ clear: clearMock });
    render(<DebugConsole visible={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('debug-clear'));
    expect(clearMock).toHaveBeenCalledTimes(1);
  });

  it('should expand state-diff details when a log entry is clicked', () => {
    mockUseDebugLogs({ logs: mockLogs });
    render(<DebugConsole visible={true} onClose={vi.fn()} />);
    expect(screen.queryByTestId('log-diff-log-1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('log-entry-log-1').firstChild!);
    expect(screen.getByTestId('log-diff-log-1')).toBeInTheDocument();
  });

  it('should use short locale date and time for log timestamps', () => {
    const ts = new Date('2024-06-15T10:30:45.000Z').getTime();
    mockUseDebugLogs({ logs: [{ ...mockLogs[0], timestamp: ts }] });
    render(<DebugConsole visible={true} onClose={vi.fn()} />);
    const allText = document.body.textContent ?? '';
    expect(allText).not.toMatch(/2024-06-15T/);
    expect(allText).not.toMatch(/Z$/);
  });
});

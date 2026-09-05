// src/components/SettingsMenu.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsMenu } from './SettingsMenu';

describe('SettingsMenu', () => {
  const defaultProps = {
    debugConsoleVisible: false,
    onToggleDebugConsole: vi.fn(),
    gameStateVisible: false,
    onToggleGameState: vi.fn(),
    appStatusVisible: false,
    onToggleAppStatus: vi.fn(),
    onForceUpdate: vi.fn(),
    onNewGame: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the gear icon button', () => {
    render(<SettingsMenu {...defaultProps} />);
    expect(screen.getByTestId('settings-gear')).toBeInTheDocument();
  });

  it('has an accessible aria-label on the gear button', () => {
    render(<SettingsMenu {...defaultProps} />);
    expect(screen.getByLabelText('Open settings')).toBeInTheDocument();
  });

  it('does not show settings card before gear is clicked', () => {
    render(<SettingsMenu {...defaultProps} />);
    expect(screen.queryByTestId('settings-card')).not.toBeInTheDocument();
  });

  it('shows settings card when gear is clicked', () => {
    render(<SettingsMenu {...defaultProps} />);
    fireEvent.click(screen.getByTestId('settings-gear'));
    expect(screen.getByTestId('settings-card')).toBeInTheDocument();
  });

  it('calls onToggleDebugConsole when toggle button is clicked', () => {
    render(<SettingsMenu {...defaultProps} />);
    fireEvent.click(screen.getByTestId('settings-gear'));
    fireEvent.click(screen.getByTestId('toggle-debug-console'));
    expect(defaultProps.onToggleDebugConsole).toHaveBeenCalledTimes(1);
  });

  it('shows "Show Debug Console" when console is hidden', () => {
    render(<SettingsMenu {...defaultProps} />);
    fireEvent.click(screen.getByTestId('settings-gear'));
    expect(screen.getByTestId('toggle-debug-console').textContent).toContain('Show Debug Console');
  });

  it('shows "Hide Debug Console" when console is visible', () => {
    render(<SettingsMenu {...defaultProps} debugConsoleVisible={true} />);
    fireEvent.click(screen.getByTestId('settings-gear'));
    expect(screen.getByTestId('toggle-debug-console').textContent).toContain('Hide Debug Console');
  });

  it('closes settings card after toggling debug console', () => {
    render(<SettingsMenu {...defaultProps} />);
    fireEvent.click(screen.getByTestId('settings-gear'));
    expect(screen.getByTestId('settings-card')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('toggle-debug-console'));
    expect(screen.queryByTestId('settings-card')).not.toBeInTheDocument();
  });

  it('calls onToggleGameState when toggle button is clicked', () => {
    render(<SettingsMenu {...defaultProps} />);
    fireEvent.click(screen.getByTestId('settings-gear'));
    fireEvent.click(screen.getByTestId('toggle-game-state'));
    expect(defaultProps.onToggleGameState).toHaveBeenCalledTimes(1);
  });

  it('shows "View Game State" when game state viewer is hidden', () => {
    render(<SettingsMenu {...defaultProps} />);
    fireEvent.click(screen.getByTestId('settings-gear'));
    expect(screen.getByTestId('toggle-game-state').textContent).toContain('View Game State');
  });

  it('shows "Hide Game State" when game state viewer is visible', () => {
    render(<SettingsMenu {...defaultProps} gameStateVisible={true} />);
    fireEvent.click(screen.getByTestId('settings-gear'));
    expect(screen.getByTestId('toggle-game-state').textContent).toContain('Hide Game State');
  });

  it('closes settings card after toggling game state', () => {
    render(<SettingsMenu {...defaultProps} />);
    fireEvent.click(screen.getByTestId('settings-gear'));
    expect(screen.getByTestId('settings-card')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('toggle-game-state'));
    expect(screen.queryByTestId('settings-card')).not.toBeInTheDocument();
  });

  it('calls onToggleAppStatus when toggle button is clicked', () => {
    render(<SettingsMenu {...defaultProps} />);
    fireEvent.click(screen.getByTestId('settings-gear'));
    fireEvent.click(screen.getByTestId('toggle-app-status'));
    expect(defaultProps.onToggleAppStatus).toHaveBeenCalledTimes(1);
  });

  it('shows "View App Status" when status viewer is hidden', () => {
    render(<SettingsMenu {...defaultProps} />);
    fireEvent.click(screen.getByTestId('settings-gear'));
    expect(screen.getByTestId('toggle-app-status').textContent).toContain('View App Status');
  });

  it('shows "Hide App Status" when status viewer is visible', () => {
    render(<SettingsMenu {...defaultProps} appStatusVisible={true} />);
    fireEvent.click(screen.getByTestId('settings-gear'));
    expect(screen.getByTestId('toggle-app-status').textContent).toContain('Hide App Status');
  });

  it('closes settings card after toggling app status', () => {
    render(<SettingsMenu {...defaultProps} />);
    fireEvent.click(screen.getByTestId('settings-gear'));
    expect(screen.getByTestId('settings-card')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('toggle-app-status'));
    expect(screen.queryByTestId('settings-card')).not.toBeInTheDocument();
  });

  it('renders the Force UI Update button', () => {
    render(<SettingsMenu {...defaultProps} />);
    fireEvent.click(screen.getByTestId('settings-gear'));
    expect(screen.getByTestId('force-ui-update')).toBeInTheDocument();
  });

  it('has the warning styled class on the force update button', () => {
    render(<SettingsMenu {...defaultProps} />);
    fireEvent.click(screen.getByTestId('settings-gear'));
    const btn = screen.getByTestId('force-ui-update');
    expect(btn.className).toContain('settings-toggle--warning');
  });

  it('calls onForceUpdate when the force update button is clicked', () => {
    render(<SettingsMenu {...defaultProps} />);
    fireEvent.click(screen.getByTestId('settings-gear'));
    fireEvent.click(screen.getByTestId('force-ui-update'));
    expect(defaultProps.onForceUpdate).toHaveBeenCalledTimes(1);
  });

  it('closes settings card after triggering force update', () => {
    render(<SettingsMenu {...defaultProps} />);
    fireEvent.click(screen.getByTestId('settings-gear'));
    expect(screen.getByTestId('settings-card')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('force-ui-update'));
    expect(screen.queryByTestId('settings-card')).not.toBeInTheDocument();
  });

  it('renders the New Game button in the gear menu', () => {
    render(<SettingsMenu {...defaultProps} />);
    fireEvent.click(screen.getByTestId('settings-gear'));
    expect(screen.getByTestId('new-game')).toBeInTheDocument();
  });

  it('calls onNewGame when the New Game button is clicked', () => {
    render(<SettingsMenu {...defaultProps} />);
    fireEvent.click(screen.getByTestId('settings-gear'));
    fireEvent.click(screen.getByTestId('new-game'));
    expect(defaultProps.onNewGame).toHaveBeenCalledTimes(1);
  });

  it('closes settings card after triggering New Game', () => {
    render(<SettingsMenu {...defaultProps} />);
    fireEvent.click(screen.getByTestId('settings-gear'));
    expect(screen.getByTestId('settings-card')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('new-game'));
    expect(screen.queryByTestId('settings-card')).not.toBeInTheDocument();
  });
});

// src/components/SettingsMenu.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsMenu } from './SettingsMenu'

describe('SettingsMenu', () => {
  const defaultProps = {
    debugConsoleVisible: false,
    onToggleDebugConsole: vi.fn(),
    gameStateVisible: false,
    onToggleGameState: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the gear icon button', () => {
    render(<SettingsMenu {...defaultProps} />)
    expect(screen.getByTestId('settings-gear')).toBeInTheDocument()
  })

  it('has an accessible aria-label on the gear button', () => {
    render(<SettingsMenu {...defaultProps} />)
    expect(screen.getByLabelText('Open settings')).toBeInTheDocument()
  })

  it('does not show settings card before gear is clicked', () => {
    render(<SettingsMenu {...defaultProps} />)
    expect(screen.queryByTestId('settings-card')).not.toBeInTheDocument()
  })

  it('shows settings card when gear is clicked', () => {
    render(<SettingsMenu {...defaultProps} />)
    fireEvent.click(screen.getByTestId('settings-gear'))
    expect(screen.getByTestId('settings-card')).toBeInTheDocument()
  })

  it('calls onToggleDebugConsole when toggle button is clicked', () => {
    render(<SettingsMenu {...defaultProps} />)
    fireEvent.click(screen.getByTestId('settings-gear'))
    fireEvent.click(screen.getByTestId('toggle-debug-console'))
    expect(defaultProps.onToggleDebugConsole).toHaveBeenCalledTimes(1)
  })

  it('shows "Show Debug Console" when console is hidden', () => {
    render(<SettingsMenu {...defaultProps} />)
    fireEvent.click(screen.getByTestId('settings-gear'))
    expect(screen.getByTestId('toggle-debug-console').textContent).toContain('Show Debug Console')
  })

  it('shows "Hide Debug Console" when console is visible', () => {
    render(<SettingsMenu {...defaultProps} debugConsoleVisible={true} />)
    fireEvent.click(screen.getByTestId('settings-gear'))
    expect(screen.getByTestId('toggle-debug-console').textContent).toContain('Hide Debug Console')
  })

  it('closes settings card after toggling debug console', () => {
    render(<SettingsMenu {...defaultProps} />)
    fireEvent.click(screen.getByTestId('settings-gear'))
    expect(screen.getByTestId('settings-card')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('toggle-debug-console'))
    expect(screen.queryByTestId('settings-card')).not.toBeInTheDocument()
  })

  it('calls onToggleGameState when toggle button is clicked', () => {
    render(<SettingsMenu {...defaultProps} />)
    fireEvent.click(screen.getByTestId('settings-gear'))
    fireEvent.click(screen.getByTestId('toggle-game-state'))
    expect(defaultProps.onToggleGameState).toHaveBeenCalledTimes(1)
  })

  it('shows "View Game State" when game state viewer is hidden', () => {
    render(<SettingsMenu {...defaultProps} />)
    fireEvent.click(screen.getByTestId('settings-gear'))
    expect(screen.getByTestId('toggle-game-state').textContent).toContain('View Game State')
  })

  it('shows "Hide Game State" when game state viewer is visible', () => {
    render(<SettingsMenu {...defaultProps} gameStateVisible={true} />)
    fireEvent.click(screen.getByTestId('settings-gear'))
    expect(screen.getByTestId('toggle-game-state').textContent).toContain('Hide Game State')
  })

  it('closes settings card after toggling game state', () => {
    render(<SettingsMenu {...defaultProps} />)
    fireEvent.click(screen.getByTestId('settings-gear'))
    expect(screen.getByTestId('settings-card')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('toggle-game-state'))
    expect(screen.queryByTestId('settings-card')).not.toBeInTheDocument()
  })
})

// src/components/SettingsMenu.tsx
import { useState, useRef, useEffect } from 'react'
import './SettingsMenu.css'

interface SettingsMenuProps {
  debugConsoleVisible: boolean
  onToggleDebugConsole: () => void
  gameStateVisible: boolean
  onToggleGameState: () => void
}

/**
 * Settings overlay component rendered in the app header.
 *
 * A gear icon (⚙️) sits inline to the right of the title.
 * Clicking it reveals a dropdown card with toggles that show/hide
 * the DebugConsole and GameStateViewer overlays.
 *
 * The dropdown closes automatically when the user clicks
 * outside of it (document-level mousedown listener).
 */
export const SettingsMenu = ({
  debugConsoleVisible,
  onToggleDebugConsole,
  gameStateVisible,
  onToggleGameState,
}: SettingsMenuProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleOpen = () => setIsOpen((prev) => !prev)

  return (
    <div className="settings-menu" ref={menuRef} data-testid="settings-menu">
      <button
        type="button"
        className="settings-gear"
        data-testid="settings-gear"
        aria-label="Open settings"
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={toggleOpen}
      >
        ⚙️
      </button>

      {isOpen && (
        <div className="settings-card" data-testid="settings-card">
          <h3 className="settings-title">Settings</h3>
          <button
            type="button"
            className={`settings-toggle ${debugConsoleVisible ? 'settings-on' : 'settings-off'}`}
            data-testid="toggle-debug-console"
            onClick={() => {
              onToggleDebugConsole()
              setIsOpen(false)
            }}
          >
            {debugConsoleVisible ? 'Hide' : 'Show'} Debug Console
          </button>
          <button
            type="button"
            className={`settings-toggle ${gameStateVisible ? 'settings-on' : 'settings-off'}`}
            data-testid="toggle-game-state"
            onClick={() => {
              onToggleGameState()
              setIsOpen(false)
            }}
          >
            {gameStateVisible ? 'Hide' : 'View'} Game State
          </button>
        </div>
      )}
    </div>
  )
}

// src/components/GameScreenShell/GameScreenShell.tsx
//
// Reusable full-screen shell layout.
//
import { StatusBar, type StatusBarItem } from './StatusBar';
import type { GameState } from '../../types/game-state';
import './GameScreenShell.css';

export type { StatusBarItem };

export interface GameScreenShellProps {
  title: string;
  statusItems: StatusBarItem[];
  children: React.ReactNode;
  detailsContent: React.ReactNode;
  gameState: GameState;
  onStarMapGo: (plannedRoute: string[]) => void;
  actionButtons: React.ReactNode;
  subtitle?: string;
}

export function GameScreenShell({
  title,
  statusItems,
  children,
  actionButtons,
  subtitle,
}: GameScreenShellProps) {
  return (
    <div className="game-screen-shell" data-testid="game-screen-shell">
      <StatusBar title={title} items={statusItems} subtitle={subtitle} />
      <main className="game-screen-content" data-testid="screen-content">
        {children}
      </main>
      <div className="game-screen-actions" data-testid="action-button-bar">
        {actionButtons}
      </div>
    </div>
  );
}

export default GameScreenShell;

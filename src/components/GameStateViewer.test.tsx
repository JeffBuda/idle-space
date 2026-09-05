// src/components/GameStateViewer.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameStateViewer } from './GameStateViewer';

const mockGameState = {
  lastTimestamp: 1000000,
  elapsedSeconds: 500,
  rngSeed: 'test-seed',
  totalDistanceKm: 5000,
  version: '0.1.0',
};

describe('GameStateViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when visible is false', () => {
    const { container } = render(
      <GameStateViewer visible={false} gameState={null} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render when visible is true', () => {
    render(<GameStateViewer visible={true} gameState={mockGameState} onClose={vi.fn()} />);
    expect(screen.getByTestId('game-state-viewer')).toBeInTheDocument();
  });

  it('should display game state as tree when gameState is provided', () => {
    render(<GameStateViewer visible={true} gameState={mockGameState} onClose={vi.fn()} />);
    const json = screen.getByTestId('game-state-json');
    expect(json).toBeInTheDocument();
    expect(json.textContent).toContain('totalDistanceKm');
    expect(json.textContent).toContain('5000');
    expect(json.textContent).toContain('test-seed');
  });

  it('should show empty state when gameState is null', () => {
    render(<GameStateViewer visible={true} gameState={null} onClose={vi.fn()} />);
    expect(screen.getByTestId('game-state-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('game-state-json')).not.toBeInTheDocument();
  });

  it('should call onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<GameStateViewer visible={true} gameState={mockGameState} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('game-state-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<GameStateViewer visible={true} gameState={mockGameState} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('game-state-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should show nested object children when top-level key is expanded by default', () => {
    const stateWithNested = {
      ...mockGameState,
      oreCounts: { commonOre: 100, rareOre: 50 },
    };
    render(<GameStateViewer visible={true} gameState={stateWithNested} onClose={vi.fn()} />);
    const json = screen.getByTestId('game-state-json');
    expect(json.textContent).toContain('commonOre');
    expect(json.textContent).toContain('rareOre');
    expect(json.textContent).toContain('100');
  });

  it('should keep nested objects collapsed by default', () => {
    const stateWithNested = {
      ...mockGameState,
      oreCounts: { commonOre: 100, nested: { deepKey: 'deepValue' } },
    };
    render(<GameStateViewer visible={true} gameState={stateWithNested} onClose={vi.fn()} />);
    const json = screen.getByTestId('game-state-json');
    // oreCounts (top-level) is expanded — children visible
    expect(json.textContent).toContain('commonOre');
    // nested (nested object) is collapsed — children NOT visible
    expect(json.textContent).not.toContain('deepKey');
    expect(json.textContent).not.toContain('deepValue');
  });

  it('should collapse an expanded object when its toggle is clicked', () => {
    const stateWithNested = {
      ...mockGameState,
      oreCounts: { commonOre: 100, rareOre: 50 },
    };
    render(<GameStateViewer visible={true} gameState={stateWithNested} onClose={vi.fn()} />);
    const json = screen.getByTestId('game-state-json');
    const collapseToggle = json.querySelector('.gs-tree-toggle[aria-label="Collapse"]');
    expect(collapseToggle).not.toBeNull();
    fireEvent.click(collapseToggle!);
    expect(json.textContent).not.toContain('commonOre');
    expect(json.textContent).not.toContain('100');
  });

  it('should expand a collapsed object when its toggle is clicked', () => {
    const stateWithNested = {
      ...mockGameState,
      oreCounts: { commonOre: 100, nested: { deepKey: 'deepValue' } },
    };
    render(<GameStateViewer visible={true} gameState={stateWithNested} onClose={vi.fn()} />);
    const json = screen.getByTestId('game-state-json');
    const expandToggles = json.querySelectorAll('.gs-tree-toggle[aria-label="Expand"]');
    expect(expandToggles.length).toBeGreaterThan(0);
    fireEvent.click(expandToggles[0]);
    expect(json.textContent).toContain('deepKey');
    expect(json.textContent).toContain('deepValue');
  });

  it('should toggle the aria-label between Collapse and Expand', () => {
    const stateWithNested = {
      ...mockGameState,
      oreCounts: { commonOre: 100 },
    };
    render(<GameStateViewer visible={true} gameState={stateWithNested} onClose={vi.fn()} />);
    const json = screen.getByTestId('game-state-json');
    const collapseToggle = json.querySelector('.gs-tree-toggle[aria-label="Collapse"]');
    expect(collapseToggle).not.toBeNull();
    fireEvent.click(collapseToggle!);
    const expandToggle = json.querySelector('.gs-tree-toggle[aria-label="Expand"]');
    expect(expandToggle).not.toBeNull();
  });
});

// src/components/MiningRewardModal.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MiningRewardModal } from './MiningRewardModal';
import { formatElapsedTime } from '../utils/time';
import type { IdleRewardSummary } from '../types/game-state';

describe('MiningRewardModal', () => {
  const mockOnDismiss = vi.fn();
  const reward: IdleRewardSummary = {
    secondsAway: 3661, // 1h 1m 1s
    oreCollected: { commonOre: 4, rareOre: 1 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when reward is null', () => {
    const { container } = render(<MiningRewardModal reward={null} onDismiss={mockOnDismiss} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the welcome-back modal when a reward is provided', () => {
    render(<MiningRewardModal reward={reward} onDismiss={mockOnDismiss} />);
    expect(screen.getByTestId('mining-reward-modal')).toBeInTheDocument();
    expect(screen.getByText('Welcome Back, Explorer!')).toBeInTheDocument();
  });

  it('displays the formatted time the player was away', () => {
    render(<MiningRewardModal reward={reward} onDismiss={mockOnDismiss} />);
    expect(screen.getByTestId('mining-reward-time')).toHaveTextContent(formatElapsedTime(3661));
  });

  it('displays the ore collected while away, per type', () => {
    render(<MiningRewardModal reward={reward} onDismiss={mockOnDismiss} />);
    expect(screen.getByTestId('mining-reward-common')).toHaveTextContent(/Common Ore: \+4$/);
    expect(screen.getByTestId('mining-reward-rare')).toHaveTextContent(/Rare Ore: \+1$/);
  });

  it('calls onDismiss when the close button is clicked', () => {
    render(<MiningRewardModal reward={reward} onDismiss={mockOnDismiss} />);
    fireEvent.click(screen.getByTestId('mining-reward-close'));
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when the backdrop is clicked', () => {
    render(<MiningRewardModal reward={reward} onDismiss={mockOnDismiss} />);
    fireEvent.click(screen.getByTestId('mining-reward-modal'));
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when the Continue button is clicked', () => {
    render(<MiningRewardModal reward={reward} onDismiss={mockOnDismiss} />);
    fireEvent.click(screen.getByTestId('dismiss-mining-reward-btn'));
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });
});

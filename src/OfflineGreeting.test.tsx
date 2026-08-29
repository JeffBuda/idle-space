// src/OfflineGreeting.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OfflineGreeting } from './OfflineGreeting';
import { formatElapsedTime } from './utils/time';

describe('OfflineGreeting', () => {
  const mockOnDismiss = vi.fn();
  const mockOnCollectRewards = vi.fn();

  it('should render null when offlineSeconds is null', () => {
    const { container } = render(
      <OfflineGreeting
        offlineSeconds={null}
        onDismiss={mockOnDismiss}
        onCollectRewards={mockOnCollectRewards}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render the greeting when offlineSeconds is provided', () => {
    render(
      <OfflineGreeting
        offlineSeconds={3661} // 1h 1m 1s
        onDismiss={mockOnDismiss}
        onCollectRewards={mockOnCollectRewards}
      />
    );

    expect(screen.getByText('Welcome Back, Explorer!')).toBeInTheDocument();
    expect(screen.getByText("You've been away for:")).toBeInTheDocument();
  });

  it('should display formatted offline time', () => {
    const offlineSeconds = 90065; // 1d 1h 1m 5s
    render(
      <OfflineGreeting
        offlineSeconds={offlineSeconds}
        onDismiss={mockOnDismiss}
        onCollectRewards={mockOnCollectRewards}
      />
    );

    const expectedTime = formatElapsedTime(offlineSeconds);
    expect(screen.getByTestId('offline-time-display')).toHaveTextContent(
      expectedTime
    );
  });

  it('should call onDismiss when dismiss button is clicked', () => {
    render(
      <OfflineGreeting
        offlineSeconds={3600}
        onDismiss={mockOnDismiss}
        onCollectRewards={mockOnCollectRewards}
      />
    );

    const dismissBtn = screen.getByTestId('dismiss-offline-btn');
    fireEvent.click(dismissBtn);
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  it('should call onCollectRewards when collect button is clicked', () => {
    render(
      <OfflineGreeting
        offlineSeconds={3600}
        onDismiss={mockOnDismiss}
        onCollectRewards={mockOnCollectRewards}
      />
    );

    const collectBtn = screen.getByTestId('collect-rewards-btn');
    fireEvent.click(collectBtn);
    expect(mockOnCollectRewards).toHaveBeenCalledTimes(1);
  });

  it('should display the correct message about continued journey', () => {
    render(
      <OfflineGreeting
        offlineSeconds={7200}
        onDismiss={mockOnDismiss}
        onCollectRewards={mockOnCollectRewards}
      />
    );

    expect(
      screen.getByText("Your ship has continued its journey in your absence.")
    ).toBeInTheDocument();
  });
});
// src/components/NewGameConfirmModal.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NewGameConfirmModal } from './NewGameConfirmModal';

describe('NewGameConfirmModal', () => {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when visible is false', () => {
    render(<NewGameConfirmModal visible={false} onCancel={onCancel} onConfirm={onConfirm} />);
    expect(screen.queryByTestId('new-game-confirm-modal')).not.toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('renders the title, message, and both actions when visible is true', () => {
    render(<NewGameConfirmModal visible={true} onCancel={onCancel} onConfirm={onConfirm} />);
    expect(screen.getByTestId('new-game-confirm-modal')).toBeInTheDocument();
    expect(screen.getByTestId('new-game-title').textContent).toContain('Start a New Game?');
    expect(screen.getByTestId('new-game-body')).toBeInTheDocument();
    expect(screen.getByTestId('new-game-cancel')).toHaveTextContent('Cancel');
    expect(screen.getByTestId('new-game-confirm')).toHaveTextContent('Start New Game');
  });

  it('calls onCancel (and not onConfirm) when Cancel is clicked', () => {
    render(<NewGameConfirmModal visible={true} onCancel={onCancel} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('new-game-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onCancel when the backdrop is clicked', () => {
    render(<NewGameConfirmModal visible={true} onCancel={onCancel} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('new-game-confirm-modal'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onCancel when the close button is clicked', () => {
    render(<NewGameConfirmModal visible={true} onCancel={onCancel} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('new-game-close'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onConfirm when the Start New Game button is clicked', () => {
    render(<NewGameConfirmModal visible={true} onCancel={onCancel} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('new-game-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });
});

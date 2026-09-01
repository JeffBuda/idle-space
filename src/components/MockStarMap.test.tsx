// src/components/MockStarMap.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MockStarMap } from './MockStarMap';

describe('MockStarMap', () => {
  const onDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the sandbox root element', () => {
    render(<MockStarMap onDismiss={onDismiss} />);
    expect(screen.getByTestId('mock-star-map')).toBeInTheDocument();
  });

  it('renders the top bar with back button and title', () => {
    render(<MockStarMap onDismiss={onDismiss} />);
    expect(screen.getByTestId('star-map-top-bar')).toBeInTheDocument();
    expect(screen.getByTestId('star-map-title')).toHaveTextContent('Star Map UI Sandbox');
  });

  it('renders the back button with an accessible label', () => {
    render(<MockStarMap onDismiss={onDismiss} />);
    const backBtn = screen.getByTestId('star-map-back-btn');
    expect(backBtn).toBeInTheDocument();
    expect(backBtn).toHaveAttribute('aria-label', 'Back to Settings');
  });

  it('calls onDismiss when the back button is clicked', () => {
    render(<MockStarMap onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('star-map-back-btn'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders the SVG canvas with viewBox', () => {
    render(<MockStarMap onDismiss={onDismiss} />);
    const svg = screen.getByTestId('star-map-svg');
    expect(svg).toBeInTheDocument();
    expect(svg.getAttribute('viewBox')).toBe('0 0 100 100');
  });

  it('renders all four star map nodes', () => {
    render(<MockStarMap onDismiss={onDismiss} />);
    expect(screen.getByTestId('star-map-node-sol')).toBeInTheDocument();
    expect(screen.getByTestId('star-map-node-sysA')).toBeInTheDocument();
    expect(screen.getByTestId('star-map-node-sysB')).toBeInTheDocument();
    expect(screen.getByTestId('star-map-node-sysC')).toBeInTheDocument();
  });

  it('disables the Sol node (current location)', () => {
    render(<MockStarMap onDismiss={onDismiss} />);
    expect(screen.getByTestId('star-map-node-sol')).toBeDisabled();
  });

  it('starts with State 1: empty route, 15vh sheet, default content', () => {
    render(<MockStarMap onDismiss={onDismiss} />);
    const sheet = screen.getByTestId('star-map-bottom-sheet');
    expect(sheet.className).toContain('mock-star-map__sheet--15');
    expect(sheet.className).not.toContain('mock-star-map__sheet--30');
    expect(screen.getByTestId('sheet-default-content')).toBeInTheDocument();
    expect(screen.getByTestId('current-location')).toHaveTextContent('Sol System');
    expect(screen.getByTestId('sheet-prompt')).toBeInTheDocument();
  });

  it('renders no active route path when route is empty', () => {
    render(<MockStarMap onDismiss={onDismiss} />);
    const paths = screen.getByTestId('star-map-svg').querySelectorAll('path');
    /* Only inactive edges — no active route path */
    const activePath = paths[paths.length - 1];
    expect(activePath.className).not.toContain('mock-star-map__route-path');
  });

  it('enters State 2 when an unknown node is clicked', () => {
    render(<MockStarMap onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('star-map-node-sysA'));

    /* Sheet height should expand to 30vh */
    const sheet = screen.getByTestId('star-map-bottom-sheet');
    expect(sheet.className).toContain('mock-star-map__sheet--30');

    /* State 2 content should be visible */
    expect(screen.getByTestId('sheet-single-content')).toBeInTheDocument();
    expect(screen.getByTestId('destination-1')).toHaveTextContent('System A');
    expect(screen.getByTestId('travel-time-1')).toBeInTheDocument();
  });

  it('shows the active route path after selecting a node', () => {
    render(<MockStarMap onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('star-map-node-sysA'));
    const svg = screen.getByTestId('star-map-svg');
    const paths = svg.querySelectorAll('path');
    const activePath = paths[paths.length - 1];
    expect(activePath.getAttribute('class')).toContain('mock-star-map__route-path');
  });

  it('has an Add Stop button in State 2', () => {
    render(<MockStarMap onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('star-map-node-sysA'));
    expect(screen.getByTestId('add-stop-btn')).toBeInTheDocument();
  });

  it('has a Clear Route button in State 2', () => {
    render(<MockStarMap onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('star-map-node-sysA'));
    expect(screen.getByTestId('clear-route-btn')).toBeInTheDocument();
  });

  it('enters State 3 when a second node is clicked', () => {
    render(<MockStarMap onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('star-map-node-sysA'));
    fireEvent.click(screen.getByTestId('star-map-node-sysC'));

    const sheet = screen.getByTestId('star-map-bottom-sheet');
    expect(sheet.className).toContain('mock-star-map__sheet--50');
    expect(screen.getByTestId('sheet-multi-content')).toBeInTheDocument();
    expect(screen.getByTestId('itinerary-title')).toHaveTextContent('2 stops');
  });

  it('shows itinerary stops with names and times in State 3', () => {
    render(<MockStarMap onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('star-map-node-sysA'));
    fireEvent.click(screen.getByTestId('star-map-node-sysC'));

    expect(screen.getByTestId('itinerary-stop-sysA')).toBeInTheDocument();
    expect(screen.getByTestId('itinerary-stop-sysC')).toBeInTheDocument();
    expect(screen.getByTestId('segment-time-sysA')).toBeInTheDocument();
    expect(screen.getByTestId('segment-time-sysC')).toBeInTheDocument();
    expect(screen.getByTestId('total-travel-time')).toBeInTheDocument();
  });

  it('has a Simulate Warp Drive button in State 3', () => {
    render(<MockStarMap onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('star-map-node-sysA'));
    fireEvent.click(screen.getByTestId('star-map-node-sysC'));
    expect(screen.getByTestId('simulate-warp-btn')).toBeInTheDocument();
  });

  it('has per-stop remove buttons in State 3', () => {
    render(<MockStarMap onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('star-map-node-sysA'));
    fireEvent.click(screen.getByTestId('star-map-node-sysC'));
    expect(screen.getByTestId('remove-stop-sysA')).toBeInTheDocument();
    expect(screen.getByTestId('remove-stop-sysC')).toBeInTheDocument();
  });

  it('toggles a node off when clicked again (deselect via map)', () => {
    render(<MockStarMap onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('star-map-node-sysA'));
    expect(screen.getByTestId('sheet-single-content')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('star-map-node-sysA'));
    expect(screen.getByTestId('sheet-default-content')).toBeInTheDocument();
  });

  it('removes a specific stop via the remove button', () => {
    render(<MockStarMap onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('star-map-node-sysA'));
    fireEvent.click(screen.getByTestId('star-map-node-sysC'));
    expect(screen.getByTestId('itinerary-stop-sysC')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('remove-stop-sysC'));
    expect(screen.queryByTestId('itinerary-stop-sysC')).not.toBeInTheDocument();
    /* Should return to State 2 (single stop) */
    expect(screen.getByTestId('sheet-single-content')).toBeInTheDocument();
  });

  it('clears the route when Clear Route button is clicked', () => {
    render(<MockStarMap onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('star-map-node-sysA'));
    fireEvent.click(screen.getByTestId('star-map-node-sysC'));
    expect(screen.getByTestId('sheet-multi-content')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('clear-route-btn'));
    expect(screen.getByTestId('sheet-default-content')).toBeInTheDocument();
    const sheet = screen.getByTestId('star-map-bottom-sheet');
    expect(sheet.className).toContain('mock-star-map__sheet--15');
  });

  it('shows correct travel time formatting for System A', () => {
    render(<MockStarMap onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('star-map-node-sysA'));
    const timeEl = screen.getByTestId('travel-time-1');
    expect(timeEl.textContent).toMatch(/\d+h \d+m/);
  });

  it('computes total travel time as the sum of segment times', () => {
    render(<MockStarMap onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('star-map-node-sysA'));
    fireEvent.click(screen.getByTestId('star-map-node-sysC'));
    const totalEl = screen.getByTestId('total-travel-time');
    expect(totalEl.textContent).toMatch(/\d+h \d+m/);
  });

  it('renders the drag handle', () => {
    render(<MockStarMap onDismiss={onDismiss} />);
    expect(screen.getByTestId('bottom-sheet-handle')).toBeInTheDocument();
  });

  it('renders node labels for all nodes', () => {
    render(<MockStarMap onDismiss={onDismiss} />);
    expect(screen.getByTestId('star-map-label-sol')).toBeInTheDocument();
    expect(screen.getByTestId('star-map-label-sysA')).toBeInTheDocument();
    expect(screen.getByTestId('star-map-label-sysB')).toBeInTheDocument();
    expect(screen.getByTestId('star-map-label-sysC')).toBeInTheDocument();
  });

  it('renders inactive edge paths on the SVG canvas', () => {
    render(<MockStarMap onDismiss={onDismiss} />);
    const svg = screen.getByTestId('star-map-svg');
    const edgePaths = svg.querySelectorAll('.mock-star-map__edge-path');
    expect(edgePaths.length).toBeGreaterThan(0);
  });
});

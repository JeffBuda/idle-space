import { describe, it, expect } from 'vitest';
import { Action, reducer, calculatePoints } from './App';

// Define the initial state
const emptyInitialState = {
  score: 0,
  updateTimeMs: 0,
  isModalOpen: false,
  idleTimeMs: 0,
  idlePoints: 0,
};

describe('reducer', () => {
  it('should increment the score', () => {
    const action: Action = { type: 'increment' };
    const newState = reducer(emptyInitialState, action);
    expect(newState.score).toBe(1);
  });

  it('should update the time and increment the score based on elapsed time', () => {
    const lastUpdateTimeMs = Date.now() - 5000; // 5 seconds ago
    const initialState = { ...emptyInitialState, updateTimeMs: lastUpdateTimeMs };
    const currentTime = Date.now();
    const action: Action = { type: 'updateTime', payload: { nowMs: currentTime } };
    const newState = reducer(initialState, action);
    const expectedPoints = calculatePoints(currentTime - lastUpdateTimeMs);
    expect(newState.score).toBe(expectedPoints);
    expect(newState.updateTimeMs).toBe(currentTime);
  });

  it('should open the modal', () => {
    const action: Action = { type: 'openModal' };
    const newState = reducer(emptyInitialState, action);
    expect(newState.isModalOpen).toBe(true);
  });

  it('should close the modal', () => {
    const initialStateWithModalOpen = { ...emptyInitialState, isModalOpen: true };
    const action: Action = { type: 'closeModal' };
    const newState = reducer(initialStateWithModalOpen, action);
    expect(newState.isModalOpen).toBe(false);
  });

  it('should calculate idle points and update the state', () => {
    const lastUpdateTimeMs = Date.now() - 5000; // 5 seconds ago
    const initialState = { ...emptyInitialState, score: 1, updateTimeMs: lastUpdateTimeMs };
    const currentTime = Date.now();
    let state = reducer(initialState, { type: 'calculateIdlePoints', payload: { nowMs: currentTime } });
    const expectedPoints = calculatePoints(currentTime - lastUpdateTimeMs);
    expect(state.idlePoints).toBe(expectedPoints);
    expect(state.idleTimeMs).toBe(currentTime - lastUpdateTimeMs);
    expect(state.updateTimeMs).toBe(currentTime);
  });

  it('should award idle points and update the time', () => {
    const lastUpdateTimeMs = Date.now() - 5000; // 5 seconds ago
    const initialState = { ...emptyInitialState, updateTimeMs: lastUpdateTimeMs, idlePoints: 5, score: 10 };
    const currentTime = Date.now();
    const action: Action = { type: 'awardIdlePoints', payload: { nowMs: currentTime } };
    const newState = reducer(initialState, action);
    expect(newState.score).toBe(15); // 10 + 5 idle points
    expect(newState.idlePoints).toBe(0);
    expect(newState.updateTimeMs).toBe(currentTime);
  });

  it('should return the initial state for unknown action types', () => {
    const action: Action = { type: 'unknown' } as any;
    const newState = reducer(emptyInitialState, action);
    expect(newState).toBe(emptyInitialState);
  });
});
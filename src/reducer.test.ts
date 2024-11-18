import { describe, it, expect } from 'vitest';
import { Action, reducer } from './App';

// Define the initial state
const initialState = { count: 0, lastFrameTime: Date.now() };

describe('reducer', () => {
  it('should increment the count', () => {
    const action: Action = { type: 'increment' };
    const newState = reducer(initialState, action);
    expect(newState.count).toBe(1);
  });

  it('should decrement the count', () => {
    const action: Action = { type: 'decrement' };
    const newState = reducer(initialState, action);
    expect(newState.count).toBe(-1);
  });

  it('should update the time and increment the count based on elapsed time', () => {
    const lastFrameTime = Date.now() - 5000; // 5 seconds ago
    const initialState = { count: 0, lastFrameTime };
    const currentTime = Date.now();
    const action: Action = { type: 'autoIncrement', payload: { nowMs: currentTime } };
    const newState = reducer(initialState, action);
    expect(newState.count).toBe(5); // 5 seconds elapsed, so count should be incremented by 5
    expect(newState.lastFrameTime).toBe(currentTime);
  });

  it('should update the time without incrementing the count if less than 1 second has elapsed', () => {
    const lastFrameTime = Date.now() - 500; // 0.5 seconds ago
    const initialState = { count: 0, lastFrameTime };
    const currentTime = Date.now();
    const action: Action = { type: 'autoIncrement', payload: { nowMs: currentTime } };
    const newState = reducer(initialState, action);
    expect(newState.count).toBe(0); // Less than 1 second elapsed, so count should not be incremented
    expect(newState.lastFrameTime).toBe(currentTime);
  });

  it('should return the initial state for unknown action types', () => {
    const action = { type: 'unknown' } as any;
    const newState = reducer(initialState, action);
    expect(newState).toBe(initialState);
  });
});
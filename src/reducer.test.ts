import { describe, it, expect } from 'vitest';
import { Action, reducer } from './App';

// Define the initial state
const initialState = { count: 0 };

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

  it('should return the initial state for unknown action types', () => {
    const action = { type: 'unknown' } as any;
    const newState = reducer(initialState, action);
    expect(newState).toBe(initialState);
  });
});
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

  it('should update the time', () => {
    const currentTime = Date.now();
    const action: Action = { type: 'updateTime', payload: currentTime };
    const newState = reducer(initialState, action);
    expect(newState.lastFrameTime).toBe(currentTime);
  });

  it('should auto increment the count', () => {
    const action: Action = { type: 'autoIncrement', payload: 5 };
    const newState = reducer(initialState, action);
    expect(newState.count).toBe(5);
  });

  it('should auto increment the count and update the time', () => {
    const currentTime = Date.now();
    const action: Action = { type: 'autoIncrementAndUpdateTime', payload: { count: 5, time: currentTime } };
    const newState = reducer(initialState, action);
    expect(newState.count).toBe(5);
    expect(newState.lastFrameTime).toBe(currentTime);
  });

  it('should return the initial state for unknown action types', () => {
    const action = { type: 'unknown' } as any;
    const newState = reducer(initialState, action);
    expect(newState).toBe(initialState);
  });
});
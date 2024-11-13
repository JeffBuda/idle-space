import React, { useReducer, useEffect, useRef } from 'react';
import './App.css';

// Define the types for state and actions
interface State {
  count: number;
  lastFrameTime: number;
}

export type Action = 
  { type: 'increment' } | 
  { type: 'decrement' } | 
  { type: 'updateTime', payload: number } | 
  { type: 'autoIncrement', payload: number } | 
  { type: 'autoIncrementAndUpdateTime', payload: { count: number, time: number } };

// Define the reducer function
export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'increment':
      return { ...state, count: state.count + 1 };
    case 'decrement':
      return { ...state, count: state.count - 1 };
    case 'updateTime':
      return { ...state, lastFrameTime: action.payload };
    case 'autoIncrement':
      return { ...state, count: state.count + action.payload };
    case 'autoIncrementAndUpdateTime':
      return { ...state, count: state.count + action.payload.count, lastFrameTime: action.payload.time };
    default:
      return state;
  }
};

const App: React.FC = () => {
  const [state, dispatch] = useReducer(reducer, { count: 0, lastFrameTime: performance.now() });
  const requestRef = useRef<number>();

  const animate = (time: number) => {
    const timeElapsed = time - state.lastFrameTime;

    if (timeElapsed >= 1000) {
      const increments = Math.floor(timeElapsed / 1000);
      dispatch({ type: 'autoIncrementAndUpdateTime', payload: { count: increments, time } });
    }

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [state.lastFrameTime]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const currentTime = performance.now();
        dispatch({ type: 'updateTime', payload: currentTime });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <div className="container">
      <h1>Idle Game</h1>
      <p>Welcome to your idle game!</p>
      <p>Count: {state.count}</p>
      <button onClick={() => dispatch({ type: 'increment' })}>Increment</button>
      <button onClick={() => dispatch({ type: 'decrement' })}>Decrement</button>
      {/* Add more components and game logic here */}
    </div>
  );
};

export default App;

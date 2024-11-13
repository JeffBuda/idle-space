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
    case 'autoIncrementAndUpdateTime':
      return { ...state, count: state.count + action.payload.count, lastFrameTime: action.payload.time };
    default:
      return state;
  }
};

const App: React.FC = () => {
  const [state, dispatch] = useReducer(reducer, { count: 0, lastFrameTime: performance.now() });
  const intervalRef = useRef<number>();

  useEffect(() => {
    const interval = setInterval(() => {
      const currentTime = performance.now();
      const timeElapsed = currentTime - state.lastFrameTime;

      if (timeElapsed >= 1000) {
        const increments = Math.floor(timeElapsed / 1000);
        dispatch({ type: 'autoIncrementAndUpdateTime', payload: { count: increments, time: currentTime } });
      }
    }, 1000);

    intervalRef.current = interval;

    return () => {
      clearInterval(intervalRef.current);
    };
  }, [state.lastFrameTime]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const currentTime = performance.now();
        const timeElapsed = currentTime - state.lastFrameTime;
        const increments = Math.floor(timeElapsed / 1000);
        dispatch({ type: 'autoIncrementAndUpdateTime', payload: { count: increments, time: currentTime } });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.lastFrameTime]);

  useEffect(() => {
    document.title = `✨ Score: ${state.count.toLocaleString()} ✨`;
  }, [state.count]);

  return (
    <div className="container">
      <h1>🧙‍♂️ Scoresceror 🧙‍♀️</h1>
      <p>Press the button to increase your score!</p>
      <p>✨ Score: {state.count.toLocaleString()} ✨</p>
      <button onClick={() => dispatch({ type: 'increment' })}>🪄 Increase score! 🪄</button>
      {/* Add more components and game logic here */}
    </div>
  );
};

export default App;

import React, { useReducer, useEffect, useRef } from 'react';
import './App.css';
import Modal from './Modal';

// Define the types for state and actions
interface State {
  // persisted
  score: number;
  updateTimeMs: number;

  // transient
  isModalOpen: boolean;
  idleTimeMs: number;
  idlePoints: number;
}

export enum LocalStorageKeys { score = 'score', updateTimeMs = 'updateTimeMs' };

export type Action =
  { type: 'increment' } |
  { type: 'openModal', payload: { nowMs: number } } |
  { type: 'closeModal' } |
  { type: 'updateTime', payload: { nowMs: number } } |
  { type: 'awardIdlePoints', payload: { nowMs: number } };

// Define the reducer function
export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'increment':
      return { ...state, score: state.score + 1 };
    case 'updateTime':
      const timeElapsedMs = action.payload.nowMs - (state.updateTimeMs || 0)
      return {
        ...state,
        score: state.score + calculatePoints(timeElapsedMs),
        updateTimeMs: action.payload.nowMs
      };
    case 'openModal':
      return {
        ...state,
        isModalOpen: true,
      };
    case 'awardIdlePoints':
      if (state.updateTimeMs === 0 || state.score === 0) {
        // first time ever load of game
        return { ...state, score: 0, idlePoints: 0, idleTimeMs: 0, updateTimeMs: action.payload.nowMs };
      }

      //resume saved game
      const idleTimeMs = action.payload.nowMs - state.updateTimeMs;
      const idlePoints = calculatePoints(idleTimeMs);
      return {
        ...state,
        score: state.score + idlePoints,
        idleTimeMs,
        idlePoints,
        updateTimeMs: action.payload.nowMs
      };
    case 'closeModal':
      return {
        ...state,
        isModalOpen: false
      };
    default:
      return state;
  }
};

export function calculatePoints(deltaTimeMs: number): number {
  return Math.floor(deltaTimeMs / 1000);
}

export function restoreState(): State {
  const updateTimeMs = Number(localStorage.getItem(LocalStorageKeys.updateTimeMs) || 0);
  const score = Number(localStorage.getItem(LocalStorageKeys.score) || 0);
  return {
    score,
    updateTimeMs,
    isModalOpen: false,
    idleTimeMs: 0,
    idlePoints: 0,
  };
}

const App: React.FC = () => {
  const initialState: State = restoreState();
  const [state, dispatch] = useReducer(reducer, initialState);
  const intervalRef = useRef<number>();

  useEffect(() => {
    const interval = setInterval(() => {
      const currentTime = Date.now();
      dispatch({ type: 'updateTime', payload: { nowMs: currentTime } });
    }, 1000);

    intervalRef.current = interval;

    return () => {
      clearInterval(intervalRef.current);
    };
  }, []);

  // store state in local storage
  useEffect(
    () => {
      localStorage.setItem(LocalStorageKeys.score, state.score.toString());
      localStorage.setItem(LocalStorageKeys.updateTimeMs, state.updateTimeMs.toString());
    },
    [state.score]);

  // open the modal when the app is first opened
  useEffect(
    () => {
      dispatch({ type: 'awardIdlePoints', payload: { nowMs: Date.now() } });
      dispatch({ type: 'openModal', payload: { nowMs: Date.now() } });
    },
    []);

  // useEffect(() => {
  //   const handleVisibilityChange = () => {
  //     if (document.visibilityState === 'visible') {
  //       const currentTime = performance.now();
  //       dispatch({ type: 'restoreState', payload: { time: currentTime } });
  //     } else {
  //       const currentTime = performance.now();
  //       dispatch({ type: 'saveState', payload: { time: currentTime } });
  //     }
  //   };

  //   const handleBeforeUnload = () => {
  //     const currentTime = performance.now();
  //     dispatch({ type: 'saveState', payload: { time: currentTime } });
  //   };

  //   document.addEventListener('visibilitychange', handleVisibilityChange);
  //   window.addEventListener('beforeunload', handleBeforeUnload);

  //   return () => {
  //     document.removeEventListener('visibilitychange', handleVisibilityChange);
  //     window.removeEventListener('beforeunload', handleBeforeUnload);
  //   };
  // }, []);

  // useEffect(() => {
  //   const currentTime = performance.now();
  //   const lastInteractionTime = Number(localStorage.getItem('lastInteractionTime'));
  //   if (lastInteractionTime) {
  //     dispatch({ type: 'restoreState', payload: { time: currentTime } });
  //   }
  // }, []);

  const handleIncrement = () => {
    dispatch({ type: 'increment' });
  };

  const handleCloseModal = () => {
    dispatch({ type: 'closeModal' });
  };


  return (
    <div className="container">
      <h1>🧙‍♂️ Scoresceror 🧙‍♀️</h1>
      <p>Press the button to increase your score!</p>
      <p>✨ Score: {state.score.toLocaleString()} ✨</p>
      <button onClick={handleIncrement}>🪄 Increase score! 🪄</button>
      <Modal
        isOpen={state.isModalOpen}
        elapsedTimeMs={Math.floor((state.idleTimeMs || 0))}
        points={state.idlePoints || 0}
        onClose={handleCloseModal}
      />
      {/* Add more components and game logic here */}
    </div>
  );
};

export default App;
